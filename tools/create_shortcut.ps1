param(
    [string]$Destination = [Environment]::GetFolderPath('Desktop')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot 'Iniciar TikReader.cmd'
$icon = Join-Path $projectRoot 'assets\icons\tikreader.ico'
if (!(Test-Path -LiteralPath $launcher) -or !(Test-Path -LiteralPath $icon)) {
    throw 'No se encontraron el lanzador o el icono de TikReader.'
}
if (!(Test-Path -LiteralPath $Destination -PathType Container)) {
    throw 'No se encontro la carpeta de destino del acceso directo.'
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $Destination 'TikReader.lnk'))
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = "$icon,0"
$shortcut.Description = 'TikReader - Estudio en vivo'
$shortcut.Save()
Write-Output 'Acceso directo de TikReader creado.'
