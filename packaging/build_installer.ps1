param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot
$releasePath = Join-Path $projectRoot 'release'
$transcriptStarted = $false
$result = 0

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments, [string]$Step)
    Write-Host "`n$Step" -ForegroundColor Cyan
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Step fallo (codigo $LASTEXITCODE). Revisa los detalles anteriores."
    }
}

Push-Location $projectRoot
try {
    if (-not $CheckOnly) {
        New-Item -ItemType Directory -Force -Path $releasePath | Out-Null
        $logPath = Join-Path $releasePath ('build-installer-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.log')
        Start-Transcript -LiteralPath $logPath | Out-Null
        $transcriptStarted = $true
    }

    $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    $pythonArguments = @()
    if (-not $pythonCommand) {
        $pythonCommand = Get-Command py.exe -ErrorAction SilentlyContinue
        $pythonArguments = @('-3')
    }
    if (-not $pythonCommand) { throw 'No se encontro Python. Instala Python 3 con pip y vuelve a ejecutar este archivo.' }
    $pythonPath = $pythonCommand.Source
    Invoke-Checked $pythonPath ($pythonArguments + @('--version')) 'Comprobando Python'
    Invoke-Checked $pythonPath ($pythonArguments + @('-m', 'pip', '--version')) 'Comprobando pip'

    $appConfig = Get-Content -LiteralPath (Join-Path $projectRoot 'app\app_config.py') -Raw
    $installerConfig = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'TikReader.iss') -Raw
    $appMatch = [regex]::Match($appConfig, '(?m)^APP_VERSION\s*=\s*"([^"]+)"')
    $installerMatch = [regex]::Match($installerConfig, '(?m)^#define AppVersion\s+"([^"]+)"')
    if (-not $appMatch.Success -or -not $installerMatch.Success) { throw 'No se pudo leer la version de la aplicacion o del instalador.' }
    $version = $appMatch.Groups[1].Value
    if ($version -ne $installerMatch.Groups[1].Value) {
        throw 'Las versiones no coinciden. Usa el mismo numero en app\app_config.py y packaging\TikReader.iss.'
    }
    if ($version -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'La version debe tener cuatro numeros, por ejemplo 1.0.0.3.' }
    $versionInfo = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'TikReaderVersion.txt') -Raw
    if ($versionInfo -notmatch "StringStruct\('FileVersion',\s*'$([regex]::Escape($version))'\)" -or
        $versionInfo -notmatch "StringStruct\('ProductVersion',\s*'$([regex]::Escape($version))'\)") {
        throw 'La version del recurso de TikReader.exe no coincide con la version de la aplicacion.'
    }
    if ($CheckOnly) {
        Write-Host "Comprobaciones correctas. Version: $version. No se genero ni modifico el instalador." -ForegroundColor Green
    } else {
        Invoke-Checked $pythonPath ($pythonArguments + @('-m', 'PyInstaller', '--version')) 'Comprobando PyInstaller'
        $pythonBuildVersion = (& $pythonPath @pythonArguments --version 2>&1) -join ' '
        if ($pythonBuildVersion -notmatch '^Python 3\.13\.') {
            throw 'PyInstaller debe ejecutarse con Python 3.13 para coincidir con las dependencias binarias incluidas.'
        }
        $compilerPath = Join-Path $releasePath 'inno\ISCC.exe'
        if (-not (Test-Path -LiteralPath $compilerPath)) {
            Invoke-Checked 'powershell.exe' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'install_builder.ps1')) 'Preparando Inno Setup'
        }
        if (-not (Test-Path -LiteralPath $compilerPath)) { throw 'No se encontro el compilador Inno Setup.' }

        # Preserve previous output and start fresh so removed files and old dependencies cannot leak into the installer.
        $backupPath = Join-Path $releasePath ('backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
        New-Item -ItemType Directory -Path $backupPath | Out-Null
        foreach ($relativePath in @('TikReader', 'cache\dependencies-ready', "TikReader-$version-Beta-Setup.exe")) {
            $sourcePath = [IO.Path]::GetFullPath((Join-Path $releasePath $relativePath))
            $destinationPath = [IO.Path]::GetFullPath((Join-Path $backupPath (Split-Path $relativePath -Leaf)))
            $allowedPrefix = [IO.Path]::GetFullPath($releasePath).TrimEnd('\') + '\'
            if (-not $sourcePath.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase) -or
                -not $destinationPath.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw 'La ruta de respaldo esta fuera de release.'
            }
            if (Test-Path -LiteralPath $sourcePath) { Move-Item -LiteralPath $sourcePath -Destination $destinationPath }
        }
        Write-Host "Preparacion anterior conservada en: $backupPath"
        Invoke-Checked $pythonPath ($pythonArguments + @((Join-Path $projectRoot 'tools\build_release.py'))) 'Preparando archivos y dependencias (requiere internet)'
        $launcherDist = Join-Path $releasePath 'launcher-dist'
        $launcherWork = Join-Path $releasePath 'launcher-work'
        Invoke-Checked $pythonPath ($pythonArguments + @('-m', 'PyInstaller', '--clean', '--noconfirm',
            '--distpath', $launcherDist, '--workpath', $launcherWork,
            (Join-Path $PSScriptRoot 'TikReader.spec'))) 'Generando TikReader.exe'
        $builtLauncher = Join-Path $launcherDist 'TikReader\TikReader.exe'
        if (-not (Test-Path -LiteralPath $builtLauncher)) { throw 'PyInstaller termino pero no se encontro TikReader.exe.' }
        Copy-Item -LiteralPath $builtLauncher -Destination (Join-Path $releasePath 'TikReader\TikReader.exe') -Force
        Invoke-Checked $compilerPath @((Join-Path $PSScriptRoot 'TikReader.iss')) 'Generando instalador'
        $installerPath = Join-Path $releasePath "TikReader-$version-Beta-Setup.exe"
        if (-not (Test-Path -LiteralPath $installerPath)) { throw 'El compilador termino pero no se encontro el instalador.' }
        if ((Get-Item -LiteralPath $installerPath).Length -eq 0) { throw 'El instalador generado esta vacio.' }
        # Remove obsolete generated builds only after the replacement compiled successfully.
        $obsolete = @(Get-ChildItem -LiteralPath $releasePath -Directory -Filter 'backup-*') +
            @(Get-ChildItem -LiteralPath $releasePath -File -Filter 'TikReader-*-Beta-Setup*.exe' | Where-Object { $_.FullName -ne $installerPath })
        foreach ($item in $obsolete) {
            $targetPath = [IO.Path]::GetFullPath($item.FullName)
            if (-not $targetPath.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw 'La ruta de limpieza esta fuera de release.'
            }
            Remove-Item -LiteralPath $targetPath -Recurse -Force
        }
        Write-Host "`nInstalador creado correctamente: $installerPath" -ForegroundColor Green
    }
} catch {
    $result = 1
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($transcriptStarted) {
        Write-Host "Registro: $logPath"
        Stop-Transcript | Out-Null
    }
    Pop-Location
}
exit $result
