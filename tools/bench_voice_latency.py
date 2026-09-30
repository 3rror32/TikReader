from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Isolated voice benchmark. Does not change the server or play audio."""
import gc
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from time import perf_counter
import wave

ROOT = Path(__file__).resolve().parent.parent
RVC = ROOT / 'data' / 'rvc'
MODEL = ROOT / 'assets' / 'voice_models' / 'homero_simpson_la'
PIPER = RVC / 'assets' / 'piper' / 'es_MX-ald-medium.onnx'
TEXT = 'Hola, estoy leyendo los comentarios del live.'


def report(**values):
    print(json.dumps(values, ensure_ascii=False), flush=True)


def main():
    sys.path.insert(0, str(RVC))
    import torch
    from infer import cli
    from infer.vc.modules import VC
    from rvc_gpu_runner import require_cuda
    config = require_cuda(cli.create_config())
    os.environ['weight_root'] = str(MODEL)
    start = perf_counter()
    vc = VC(config)
    vc.get_vc('Homero-Simpson-LA.pth')
    report(stage='rvc_model_load', seconds=round(perf_counter() - start, 3), gpu=torch.cuda.get_device_name(torch.device(config.device)))
    index = str(next(MODEL.glob('*.index')))
    from piper import PiperVoice, SynthesisConfig
    syn = SynthesisConfig(length_scale=1.05)
    start = perf_counter()
    voice = PiperVoice.load(PIPER)
    report(stage='piper_model_load', seconds=round(perf_counter() - start, 3))
    rows = []
    with tempfile.TemporaryDirectory(prefix='tikreader-benchmark-') as folder:
        source = Path(folder) / 'source.wav'
        # Alternate modes; the first pass warms the RVC neural models/kernels.
        modes = ['warmup', 'current', 'prepared', 'current', 'prepared', 'current', 'prepared']
        modes += ['prepared'] * int(os.environ.get('VOICE_BENCH_EXTRA_RUNS', '0'))
        for mode in modes:
            start = perf_counter()
            if mode == 'current':
                subprocess.run([sys.executable, '-m', 'piper', '--model', str(PIPER),
                                '--output-file', str(source), '--length-scale', '1.05'],
                               input=TEXT + '\n', text=True, capture_output=True, check=True,
                               timeout=30, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            else:
                with wave.open(str(source), 'wb') as wav:
                    voice.synthesize_wav(TEXT, wav, syn_config=syn)
            base_seconds = perf_counter() - start
            start = perf_counter()
            status, result = vc.vc_single(0, str(source), 0, 'rmvpe', index, 0.75, 0, 1.0, 0.33)
            if not result or result[0] is None or result[1] is None:
                raise RuntimeError(status)
            torch.cuda.synchronize(config.device)
            rvc_seconds = perf_counter() - start
            row = dict(mode=mode, base_seconds=round(base_seconds, 3),
                       rvc_seconds=round(rvc_seconds, 3), total_seconds=round(base_seconds+rvc_seconds, 3),
                       audio_seconds=round(len(result[1])/result[0], 3),
                       allocated_vram_mb=round(torch.cuda.memory_allocated()/1048576, 1),
                       reserved_vram_mb=round(torch.cuda.memory_reserved()/1048576, 1))
            rows.append(row)
            report(**row)
    report(results=rows, note='Same text and quality parameters; timing excludes browser/network/playback. No game FPS measured.')
    del vc, voice
    gc.collect()
    torch.cuda.empty_cache()


if __name__ == '__main__':
    main()
