$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$cachePath = Join-Path $projectRoot 'release\cache'
$builderPath = Join-Path $projectRoot 'release\inno'
New-Item -ItemType Directory -Force -Path $cachePath | Out-Null
$downloadPath = Join-Path $cachePath 'innosetup-6.7.3.exe'
if (-not (Test-Path -LiteralPath $downloadPath)) {
    Invoke-WebRequest 'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe' -OutFile $downloadPath
}
$signature = Get-AuthenticodeSignature -LiteralPath $downloadPath
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Pyrsys') {
    throw 'El compilador no tiene la firma oficial esperada.'
}
$process = Start-Process -FilePath $downloadPath -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CURRENTUSER', '/NOICONS', '/TASKS=', ('/DIR="' + $builderPath + '"')) -Wait -PassThru -WindowStyle Hidden
if ($process.ExitCode -ne 0) { throw 'No se pudo preparar Inno Setup.' }
Write-Output (Join-Path $builderPath 'ISCC.exe')
