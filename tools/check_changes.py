from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Run the non-OBS regression suite, optionally again after each source change."""
import argparse
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parent.parent

def run():
    physics_test = ROOT / 'tests' / 'test_piggy_physics.cjs'
    # This six-contour simulation can exceed 30 seconds on Windows.
    commands=[[sys.executable,'-m','unittest','discover','-s','tests','-p','test_*.py'],
              ['node','--test','--test-timeout=30000',*[str(p) for p in (ROOT/'tests').glob('test_*.cjs') if p != physics_test]],
              ['node','--test','--test-timeout=90000',str(physics_test)]]
    commands += [['node','--check',str(p)] for p in (ROOT/'web'/'static').glob('*.js')]
    commands += [['npm.cmd' if os.name == 'nt' else 'npm','run','build:overlays']]
    if os.name == 'nt':
        commands += [['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',
                      str(ROOT/'packaging'/'build_installer.ps1'),'-CheckOnly']]
    if importlib.util.find_spec('ruff'):
        commands.append([sys.executable, '-m', 'ruff', 'check', '.'])
    else:
        print('AVISO: instala requirements-dev.txt para ejecutar Ruff.', flush=True)
    if importlib.util.find_spec('coverage'):
        commands += [[sys.executable, '-m', 'coverage', 'erase'],
                     [sys.executable, '-m', 'coverage', 'run', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'],
                     [sys.executable, '-m', 'coverage', 'report']]
    else:
        print('AVISO: instala requirements-dev.txt para medir cobertura.', flush=True)
    env = os.environ.copy()
    env['PYTHONPATH'] = os.pathsep.join([str(ROOT/'app'), str(ROOT/'tools'), env.get('PYTHONPATH', '')])
    env['PYTHONPYCACHEPREFIX'] = str(ROOT/'runtime'/'pycache')
    results=[subprocess.run(cmd,cwd=ROOT,env=env).returncode for cmd in commands]
    return int(any(results))

def snapshot():
    return {str(p):p.stat().st_mtime_ns for pattern in ('app/*.py','tools/*.py','tests/*.py','tests/*.cjs','frontend/**/*.ts','web/static/*.js','web/static/*.css','web/templates/*.html') for p in ROOT.glob(pattern)}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--watch',action='store_true');args=parser.parse_args()
    previous=snapshot();code=run()
    if not args.watch: raise SystemExit(code)
    print('Observando cambios. Ctrl+C para terminar.',flush=True)
    try:
        while True:
            time.sleep(2);current=snapshot()
            if current!=previous:
                previous=current;run()
    except KeyboardInterrupt: pass
