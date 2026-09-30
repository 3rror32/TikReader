from pathlib import Path
import shutil
from xml.sax.saxutils import escape

root = Path(__file__).resolve().parent.parent
release = root / 'release'
package = release / 'sandbox-package'
results = release / 'sandbox-results'
package.mkdir(exist_ok=True)
results.mkdir(exist_ok=True)
shutil.copy2(release / 'TikReader-1.0.0.7-Beta-Setup.exe', package)
shutil.copy2(root / 'packaging' / 'validate_clean_windows.ps1', package / 'validate.ps1')
(release / 'Probar TikReader en Windows limpio.wsb').write_text(fr'''<Configuration>
  <Networking>Enable</Networking>
  <MappedFolders>
    <MappedFolder><HostFolder>{escape(str(package))}</HostFolder><SandboxFolder>C:\TikReaderPackage</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>{escape(str(results))}</HostFolder><SandboxFolder>C:\TikReaderResults</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\TikReaderPackage\validate.ps1</Command></LogonCommand>
</Configuration>''', encoding='utf-8')
print('Prueba Windows Sandbox preparada; no ejecutada.')
