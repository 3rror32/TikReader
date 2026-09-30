"""Run the installed RVC CLI with a strict CUDA inference requirement."""
import json
import sys
import os
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import wave
import threading


def watch_parent(pid):
    """Exit this GPU process if its owning server is forcibly terminated."""
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        kernel.WaitForSingleObject.restype = wintypes.DWORD
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.CloseHandle.restype = wintypes.BOOL
        handle = kernel.OpenProcess(0x00100000, False, pid)  # SYNCHRONIZE only
        if not handle:
            raise RuntimeError('No se pudo vigilar el proceso dueño de RVC.')

        def monitor():
            try:
                result = kernel.WaitForSingleObject(handle, 0xFFFFFFFF)
            finally:
                kernel.CloseHandle(handle)
            if result in (0, 0xFFFFFFFF):
                os._exit(0)
    else:
        def monitor():
            import time
            while os.getppid() == pid:
                time.sleep(.5)
            os._exit(0)
    threading.Thread(target=monitor, daemon=True).start()


def require_cuda(config):
    device = str(config.device)
    if not device.startswith('cuda:') or getattr(config, 'dml', False):
        raise RuntimeError('RVC requiere GPU CUDA; no se permite convertir en CPU.')
    return config


def worker(cli, args, root):
    """One model per process; EOF releases all CUDA allocations on exit."""
    protocol = sys.stdout
    with redirect_stdout(sys.stderr):
        parsed = cli.build_parser().parse_args(args)
        model = cli.resolve_model(parsed.model)
        os.environ['weight_root'] = str(model.parent)
        count, speakers = cli.load_model_metadata(model)
        speaker = cli.select_speaker(count, speakers, None)
        index = cli.resolve_index(parsed.index, model.name, speaker, parsed.index_rate)
        config = cli.create_config()
        from infer.vc.modules import VC
        import torch
        vc = VC(config)
        vc.get_vc(model.name)
        # Piper is CPU-bound, but loading its ONNX model in a fresh process for
        # every phrase costs considerably more than synthesis itself.  Keep it
        # beside the warm RVC worker so both stages really are preloaded.
        from piper import PiperVoice, SynthesisConfig
        piper = PiperVoice.load(root / 'assets' / 'piper' / 'es_MX-ald-medium.onnx')
        piper_config = SynthesisConfig(length_scale=1.05)
        gpu = {'device': str(config.device), 'name': torch.cuda.get_device_name(torch.device(config.device))}
    print('TIKREADER_READY=' + json.dumps({'ok': True, 'gpu': gpu}), file=protocol, flush=True)
    for line in sys.stdin:
        try:
            job = json.loads(line)
            with redirect_stdout(sys.stderr):
                with tempfile.TemporaryDirectory(prefix='tikreader-rvc-worker-') as folder:
                    source = Path(folder) / 'source.wav'
                    with wave.open(str(source), 'wb') as wav:
                        piper.synthesize_wav(job['text'], wav, syn_config=piper_config)
                    status, result = vc.vc_single(speaker, str(source), job['pitch'], 'rmvpe',
                                                 index, parsed.index_rate, 0, 1.0, 0.33)
                if not result or result[0] is None or result[1] is None:
                    raise RuntimeError(status)
                cli.write_audio(Path(job['output']), result[1], result[0], 'wav')
            reply = {'ok': True, 'gpu': gpu}
        except Exception as exc:
            reply = {'ok': False, 'error': str(exc)}
        print('TIKREADER_RESULT=' + json.dumps(reply), file=protocol, flush=True)
        if not reply['ok']:
            return 1
    return 0


def main():
    parent = os.environ.get('TIKREADER_PARENT_PID')
    if parent:
        watch_parent(int(parent))
    root = Path(sys.argv[1]).resolve()
    sys.path.insert(0, str(root))
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError('GPU CUDA no disponible. RVC se detuvo sin usar CPU.')
    from infer import cli
    original = cli.create_config

    def gpu_config():
        config = require_cuda(original())
        # Confirm a CUDA operation works before loading the voice network.
        torch.ones(1, device=config.device).sum().item()
        torch.cuda.synchronize(config.device)
        print('TIKREADER_GPU=' + json.dumps({
            'device': str(config.device),
            'name': torch.cuda.get_device_name(torch.device(config.device)),
        }), flush=True)
        return config

    cli.create_config = gpu_config
    args = sys.argv[2:]
    if args and args[0] == '--worker':
        return worker(cli, args[1:], root)
    if args == ['--probe']:
        gpu_config()
        return 0
    return cli.main(args)


if __name__ == '__main__':
    raise SystemExit(main())
