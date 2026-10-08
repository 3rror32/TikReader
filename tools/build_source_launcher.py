"""Build the branded live-source launcher when its inputs have changed."""

import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "packaging" / "TikReaderSource.spec"
OUTPUT = ROOT / "runtime" / "source-launcher"
WORK = ROOT / "runtime" / "source-launcher-work"
DEFAULT_PYINSTALLER_TOOLS = ROOT / "runtime" / "source-launcher-tools"
PYINSTALLER_TOOLS_ENV = "TIKREADER_PYINSTALLER_TOOLS"
FINGERPRINT = OUTPUT / ".source-launcher.sha256"
EXECUTABLE = OUTPUT / "TikReader" / "TikReader.exe"
INPUTS = (
    Path(__file__).resolve(),
    ROOT / "Iniciar TikReader.cmd",
    ROOT / "packaging" / "source_launch.pyw",
    SPEC,
    ROOT / "packaging" / "TikReaderVersion.txt",
    ROOT / "assets" / "icons" / "tikreader.ico",
)


def _required_env_path(name: str, *, directory: bool) -> Path:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Set {name} before building the source launcher.")
    path = Path(value).resolve()
    valid = path.is_dir() if directory else path.is_file()
    if not valid:
        raise RuntimeError(f"{name} does not identify an existing path: {path}")
    return path


def _fingerprint(backend: Path, site_packages: Path, python_version: str) -> str:
    digest = hashlib.sha256()
    for path in INPUTS:
        if not path.is_file():
            raise RuntimeError(f"A source launcher build input is missing: {path}")
        relative = path.relative_to(ROOT).as_posix().encode("utf-8")
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        data = path.read_bytes()
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
    for value in (str(backend), str(site_packages), python_version):
        encoded = value.encode("utf-8")
        digest.update(len(encoded).to_bytes(4, "big"))
        digest.update(encoded)
    return digest.hexdigest()


def _resolve_pyinstaller_tools(explicit_path: str | None = None) -> Path | None:
    configured = explicit_path or os.environ.get(PYINSTALLER_TOOLS_ENV, "").strip()
    candidate = Path(configured).expanduser().resolve() if configured else DEFAULT_PYINSTALLER_TOOLS.resolve()
    if candidate.is_dir() and (candidate / "PyInstaller" / "__main__.py").is_file():
        return candidate
    if candidate.name.casefold() == "pyinstaller" and (candidate / "__main__.py").is_file():
        return candidate.parent
    return None


def _environment_for_pyinstaller_tools(tool_root: Path | None) -> dict[str, str]:
    environment = os.environ.copy()
    if tool_root is not None:
        existing = environment.get("PYTHONPATH", "")
        paths = [str(tool_root)]
        if existing:
            paths.append(existing)
        environment["PYTHONPATH"] = os.pathsep.join(paths)
    return environment


def _probe_pyinstaller(backend: Path, tool_root: Path | None):
    command = [str(backend), "-m", "PyInstaller", "--version"]
    environment = _environment_for_pyinstaller_tools(None)
    probe = subprocess.run(command, capture_output=True, text=True, env=environment)
    if probe.returncode == 0:
        return probe, environment, "backend"
    if tool_root is not None:
        local_environment = _environment_for_pyinstaller_tools(tool_root)
        local_probe = subprocess.run(command, capture_output=True, text=True, env=local_environment)
        if local_probe.returncode == 0:
            return local_probe, local_environment, "local"
        detail = (local_probe.stderr or local_probe.stdout or "unknown import error").strip()
        raise RuntimeError(
            f"The local PyInstaller tools at {tool_root} could not run under the selected backend: {detail}. "
            "No Python UI fallback will be started."
        )
    detail = (probe.stderr or probe.stdout or "unknown import error").strip()
    raise RuntimeError(
        "PyInstaller is unavailable in the selected backend and no valid local tools were found at "
        f"{DEFAULT_PYINSTALLER_TOOLS} (or via {PYINSTALLER_TOOLS_ENV}). "
        f"Backend probe: {detail}. Provide the approved tool directory or install PyInstaller in the backend. "
        "No Python UI fallback will be started."
    )


def main() -> int:
    backend = _required_env_path("TIKREADER_SOURCE_BACKEND_PYTHON", directory=False)
    site_packages = _required_env_path("TIKREADER_SOURCE_BACKEND_SITE_PACKAGES", directory=True)
    os.environ["TIKREADER_SOURCE_ROOT"] = str(ROOT)
    os.environ["TIKREADER_SOURCE_BACKEND_PYTHON"] = str(backend)
    os.environ["TIKREADER_SOURCE_BACKEND_SITE_PACKAGES"] = str(site_packages)
    version = subprocess.run(
        [str(backend), "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    current_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if version != current_version:
        raise RuntimeError("Run this helper with the same Python interpreter selected for the backend.")

    fingerprint = _fingerprint(backend, site_packages, version)
    if EXECUTABLE.is_file() and FINGERPRINT.is_file() and FINGERPRINT.read_text(encoding="ascii").strip() == fingerprint:
        print(f"TikReader source launcher is current: {EXECUTABLE}")
        return 0

    tool_root = _resolve_pyinstaller_tools()
    probe, build_environment, tool_source = _probe_pyinstaller(backend, tool_root)

    generated = OUTPUT / "TikReader"
    if generated.exists():
        shutil.rmtree(generated)
    command = [
        str(backend),
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--distpath",
        str(OUTPUT),
        "--workpath",
        str(WORK),
        str(SPEC),
    ]
    subprocess.run(command, cwd=ROOT, env=build_environment, check=True)
    if not EXECUTABLE.is_file():
        raise RuntimeError(f"PyInstaller finished without producing the expected launcher: {EXECUTABLE}")
    FINGERPRINT.write_text(fingerprint + "\n", encoding="ascii")
    print(f"Built TikReader source launcher: {EXECUTABLE} (Python {version}, PyInstaller {probe.stdout.strip()} from {tool_source})")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
