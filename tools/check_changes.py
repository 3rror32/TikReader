from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Bounded named regression stages, with resumable selection and local stage logs."""
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import importlib.util
import json
import os
import re
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
MAX_LOG_BYTES = 2 * 1024**2


@dataclass
class Stage:
    id: str
    commands: list
    timeout: float
    skip: str = ''
    depends: tuple = ()


def default_stages():
    physics = ROOT / 'tests' / 'test_piggy_physics.cjs'
    coverage = '' if importlib.util.find_spec('coverage') else 'Optional coverage dependency unavailable'
    return [
        Stage('python-tests', [[sys.executable,'-m','unittest','discover','-s','tests','-p','test_*.py']], 900),
        Stage('node-tests', [['node','--test','--test-timeout=30000', *[str(p) for p in sorted((ROOT/'tests').glob('test_*.cjs')) if p != physics]]], 600),
        Stage('node-physics', [['node','--test','--test-timeout=90000',str(physics)]], 180),
        Stage('javascript-syntax', [['node','--check',str(p)] for p in sorted((ROOT/'web/static').glob('*.js'))], 180),
        Stage('frontend-build', [['npm.cmd' if os.name == 'nt' else 'npm','run','build:overlays']], 600),
        Stage('installer-check', [['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(ROOT/'packaging/build_installer.ps1'),'-CheckOnly']], 300,
              skip='' if os.name == 'nt' else 'Windows-only installer CheckOnly stage'),
        Stage('ruff', [[sys.executable,'-m','ruff','check','.']], 180,
              skip='' if importlib.util.find_spec('ruff') else 'Optional Ruff dependency unavailable'),
        Stage('coverage-erase', [[sys.executable,'-m','coverage','erase']], 30, skip=coverage),
        Stage('coverage-tests', [[sys.executable,'-m','coverage','run','-m','unittest','discover','-s','tests','-p','test_*.py']], 1200, skip=coverage, depends=('coverage-erase',)),
        Stage('coverage-report', [[sys.executable,'-m','coverage','report']], 60, skip=coverage, depends=('coverage-erase',)),
    ]


def select_stages(stages, stage=None, from_stage=None):
    ids = [item.id for item in stages]
    if stage and from_stage or stage and stage not in ids or from_stage and from_stage not in ids:
        raise ValueError('Choose one valid --stage or --from-stage identifier.')
    selected = set(ids if not (stage or from_stage) else [stage] if stage else ids[ids.index(from_stage):])
    if 'coverage-report' in selected:
        selected.update(name for name in ('coverage-erase','coverage-tests') if name in ids)
    elif 'coverage-tests' in selected and 'coverage-erase' in ids:
        selected.add('coverage-erase')
    return selected


class WindowsJob:
    """A suspended child enters our kill-on-close job before it can create descendants."""
    def __init__(self, process):
        import ctypes
        from ctypes import wintypes as w
        class Basic(ctypes.Structure):
            _fields_ = [('process_time',ctypes.c_longlong),('job_time',ctypes.c_longlong),('flags',w.DWORD),
                        ('min_work',ctypes.c_size_t),('max_work',ctypes.c_size_t),('active',w.DWORD),
                        ('affinity',ctypes.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
        class IO(ctypes.Structure):
            _fields_ = [(name,ctypes.c_ulonglong) for name in ('read_ops','write_ops','other_ops','read_bytes','write_bytes','other_bytes')]
        class Extended(ctypes.Structure):
            _fields_ = [('basic',Basic),('io',IO),('process_memory',ctypes.c_size_t),('job_memory',ctypes.c_size_t),
                        ('peak_process',ctypes.c_size_t),('peak_job',ctypes.c_size_t)]
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        create = self.kernel.CreateJobObjectW; create.argtypes = [ctypes.c_void_p,w.LPCWSTR]; create.restype = w.HANDLE
        self.handle = create(None,None)
        close = self.kernel.CloseHandle; close.argtypes = [w.HANDLE]; close.restype = w.BOOL
        terminate = self.kernel.TerminateJobObject; terminate.argtypes = [w.HANDLE,w.UINT]; terminate.restype = w.BOOL
        info = Extended(); info.basic.flags = 0x2000
        set_info = self.kernel.SetInformationJobObject
        set_info.argtypes = [w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD]; set_info.restype = w.BOOL
        assign = self.kernel.AssignProcessToJobObject; assign.argtypes = [w.HANDLE,w.HANDLE]; assign.restype = w.BOOL
        try:
            if not self.handle or not set_info(self.handle,9,ctypes.byref(info),ctypes.sizeof(info)) or not assign(self.handle,int(process._handle)):
                raise OSError('Owned process isolation unavailable')
            resume = ctypes.WinDLL('ntdll').NtResumeProcess; resume.argtypes = [w.HANDLE]; resume.restype = w.LONG
            if resume(int(process._handle)) < 0:
                raise OSError('Owned child could not resume')
        except Exception:
            process.kill(); self.close(); raise

    def kill(self):
        self.kernel.TerminateJobObject(self.handle,1)

    def close(self):
        if self.handle:
            self.kernel.CloseHandle(self.handle); self.handle = None


def _execute(command, timeout, stream, env):
    options = {'creationflags': 0x08000000 | 0x00000004} if os.name == 'nt' else {'start_new_session': True}
    process = subprocess.Popen(command,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,**options)
    job = None
    truncated = [False]
    failure = [None]
    def drain():
        try:
            while chunk := process.stdout.read(8192):
                room = MAX_LOG_BYTES - stream.tell()
                if len(chunk) > max(0,room):
                    truncated[0] = True
                if room > 0:
                    stream.write(chunk[:room]); stream.flush()
        except OSError:
            failure[0] = True
    def kill():
        if job:
            job.kill()
        elif os.name != 'nt':
            try: os.killpg(process.pid,signal.SIGKILL)
            except ProcessLookupError: pass
        elif process.poll() is None:
            process.kill()
    reader = None
    try:
        if os.name == 'nt':
            job = WindowsJob(process)
        reader = threading.Thread(target=drain,daemon=True); reader.start()
        deadline = time.monotonic() + timeout
        try:
            code = process.wait(timeout=max(.01,deadline-time.monotonic()))
            reader.join(max(0,deadline-time.monotonic()))
            if reader.is_alive():
                raise subprocess.TimeoutExpired('stage',timeout)
            if failure[0]:
                return 'failed', code or 1, truncated[0]
            return ('passed' if code == 0 else 'failed'),code,truncated[0]
        except subprocess.TimeoutExpired:
            kill(); process.wait(timeout=5); reader.join(5)
            return 'timeout',124,truncated[0]
        except BaseException:
            kill(); process.wait(timeout=5); raise
    finally:
        if job:
            job.close()
        if reader:
            reader.join(2)
        if process.stdout:
            process.stdout.close()


def _utc():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def run(stages=None, stage=None, from_stage=None, log_root=None):
    stages = default_stages() if stages is None else stages
    selected = select_stages(stages,stage,from_stage)  # Validate before creating artifacts or running commands.
    log_root = Path(log_root or ROOT/'runtime/check-changes')
    run_id = 'run-' + time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8]
    folder = log_root/run_id; folder.mkdir(parents=True)
    # Retain only our bounded run directories; never remove unrelated runtime files.
    previous = []
    for old in log_root.glob('run-*'):
        if (old == folder or not re.fullmatch(r'run-\d{8}-\d{6}-[0-9a-f]{8}',old.name) or
                not old.is_dir() or old.is_symlink() or getattr(old,'is_junction',lambda:False)()):
            continue
        try:
            if json.loads((old/'results.json').read_text(encoding='utf-8')).get('run_id') == old.name:
                previous.append(old)
        except (OSError, ValueError, AttributeError):
            continue
    for old in sorted(previous,key=lambda p:p.stat().st_mtime,reverse=True)[7:]:
        if old.resolve().parent == log_root.resolve():
            shutil.rmtree(old)
    env = os.environ.copy(); env['PYTHONPATH'] = os.pathsep.join([str(ROOT/'app'),str(ROOT/'tools'),env.get('PYTHONPATH','')])
    env['PYTHONPYCACHEPREFIX'] = str(ROOT/'runtime/pycache')
    report = {'run_id':run_id,'started_at':_utc(),'stages':[
        {'id':item.id,'status':'pending' if item.id in selected else 'not_selected','duration_seconds':0,'log':None}
        for item in stages]}
    def persist():
        payload = json.dumps(report,indent=2)
        (folder/'results.json').write_text(payload,encoding='utf-8')
        latest = log_root/('latest.partial-' + uuid.uuid4().hex)
        latest.write_text(payload,encoding='utf-8'); latest.replace(log_root/'latest.json')
    persist()
    for item,result in zip(stages,report['stages']):
        if item.id not in selected:
            continue
        if item.skip:
            result.update(status='skipped',reason=item.skip); persist(); print(f'[{item.id}] skipped: {item.skip}',flush=True); continue
        if any(next((r['status'] for r in report['stages'] if r['id']==dependency),None) != 'passed' for dependency in item.depends):
            result.update(status='blocked',reason='Prerequisite did not pass'); persist(); continue
        started = time.monotonic(); result.update(started_at=_utc(),log=f'{run_id}/{item.id}.log')
        print(f'[{item.id}] start (limit {item.timeout}s)',flush=True)
        result['status'] = 'running'; result['log_truncated'] = False; persist()
        with (folder/f'{item.id}.log').open('wb') as stream:
            for command in item.commands:
                remaining = item.timeout - (time.monotonic()-started)
                if remaining <= 0:
                    result.update(status='timeout',returncode=124); break
                try:
                    status,code,truncated = _execute(command,remaining,stream,env)
                except OSError:
                    status,code,truncated = 'failed',1,False
                    result['reason'] = 'Unable to start an isolated stage process'
                result['log_truncated'] |= truncated
                if status != 'passed':
                    result.update(status=status,returncode=code); break
        if result['status'] == 'running': result['status'] = 'passed'
        result.update(ended_at=_utc(),duration_seconds=round(time.monotonic()-started,3))
        persist()
        print(f'[{item.id}] end: {result["status"]} ({result["duration_seconds"]}s)',flush=True)
    report.update(ended_at=_utc(),passed=not any(row['status'] in ('failed','timeout','blocked') for row in report['stages']))
    persist()
    return int(not report['passed'])


def snapshot():
    return {str(p):p.stat().st_mtime_ns for pattern in ('app/*.py','tools/*.py','tests/*.py','tests/*.cjs','frontend/**/*.ts','web/static/*.js','web/static/*.css','web/templates/*.html') for p in ROOT.glob(pattern)}


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--watch',action='store_true')
    selection = parser.add_mutually_exclusive_group(); selection.add_argument('--stage'); selection.add_argument('--from-stage')
    parser.add_argument('--list-stages',action='store_true'); args = parser.parse_args()
    stages = default_stages()
    try: select_stages(stages,args.stage,args.from_stage)
    except ValueError as exc: parser.error(str(exc))
    if args.list_stages:
        for item in stages: print(f'{item.id}: {item.timeout}s')
        return 0
    previous = snapshot(); code = run(stages,args.stage,args.from_stage)
    if not args.watch: return code
    print('Observando cambios. Ctrl+C para terminar.',flush=True)
    try:
        while True:
            time.sleep(2); current = snapshot()
            if current != previous:
                previous = current; run(default_stages(),args.stage,args.from_stage)
    except KeyboardInterrupt: return 0


if __name__ == '__main__':
    raise SystemExit(main())
