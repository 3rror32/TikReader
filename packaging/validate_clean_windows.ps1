$ErrorActionPreference = 'Stop'
$package = 'C:\TikReaderPackage'
$results = 'C:\TikReaderResults'
$installer = Join-Path $package 'TikReader-1.0.0.7-Beta-Setup.exe'
$program = Join-Path $env:LOCALAPPDATA 'Programs\TikReader'
$userData = Join-Path $env:LOCALAPPDATA 'TikReader'
$checks = [System.Collections.Generic.List[string]]::new()
function Install-Package {
    $process = Start-Process -FilePath $installer -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/TASKS=' -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -ne 0) { throw "Falló el instalador: $($process.ExitCode)" }
}
function Start-TikReader {
    $launcher = Join-Path $program 'app\launcher.py'
    $python = Join-Path $program 'python\python.exe'
    $process = Start-Process -FilePath $python -ArgumentList ('"' + $launcher + '" --no-browser') -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -ne 0) { throw 'El programa no inició.' }
    return Invoke-RestMethod 'http://127.0.0.1:5000/health'
}
function Stop-TikReader {
    Invoke-RestMethod 'http://127.0.0.1:5000/system/exit' -Method Post -ContentType 'application/json' -Body '{"confirm":true}' | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        try { Invoke-RestMethod 'http://127.0.0.1:5000/health' -TimeoutSec 1 | Out-Null }
        catch { return }
    }
    throw 'El servidor no se cerró.'
}
try {
    Install-Package
    $checks.Add('Instalador finalizó sin Python instalado por separado')
    $health = Start-TikReader
    if ($health.application -ne 'TikReader') { throw 'Servidor inesperado.' }
    $checks.Add('Inicio con runtime incluido')
    Invoke-RestMethod 'http://127.0.0.1:5000/system/preferences' -Method Post -ContentType 'application/json' -Body '{"tikreader.skin":"light"}' | Out-Null
    Invoke-WebRequest 'http://127.0.0.1:5000/diagnostics/export' -OutFile (Join-Path $results 'diagnostico-limpio.json')
    Stop-TikReader
    $checks.Add('Guardado y cierre completo')
    $hashBefore = (Get-FileHash -LiteralPath (Join-Path $userData 'history.sqlite3')).Hash
    Install-Package
    $hashAfter = (Get-FileHash -LiteralPath (Join-Path $userData 'history.sqlite3')).Hash
    if ($hashBefore -ne $hashAfter) { throw 'La reinstalación cambió la base de datos.' }
    $checks.Add('Reinstalación conserva base de datos')
    Start-TikReader | Out-Null
    $preferences = Invoke-RestMethod 'http://127.0.0.1:5000/system/preferences'
    if ($preferences.values.'tikreader.skin' -ne 'light') { throw 'No se conservó el ajuste.' }
    $checks.Add('Reapertura conserva ajustes')
    @{passed=$true;checks=$checks;pending=@('Conexión LIVE','Audio audible','Voces opcionales','Desinstalación')} | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $results 'resultado.json')
    Start-Process 'http://127.0.0.1:5000'
} catch {
    @{passed=$false;checks=$checks;error=$_.Exception.Message} | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $results 'resultado.json')
    throw
}
