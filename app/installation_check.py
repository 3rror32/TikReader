"""Return nonzero while the installed app owns its user-data lock."""
from app_paths import data_dir
from runtime_guard import InstanceGuard

if __name__ == '__main__':
    try:
        guard = InstanceGuard(data_dir() / 'server.lock', port=None)
        guard.close()
    except RuntimeError:
        raise SystemExit(1)
