#requires -version 5
param(
    [switch]$NoPrompt
)

$ErrorActionPreference = 'SilentlyContinue'

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    $argumentList = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"' + $PSCommandPath + '"')
    )
    if ($NoPrompt) { $argumentList += '-NoPrompt' }
    $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argumentList -Wait -PassThru
    exit $process.ExitCode
}

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $installDir 'CRMCloser.exe'
$desktop = Join-Path $env:USERPROFILE 'Desktop\CRM Closer.lnk'
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$startMenuDir = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\CRM Closer'

Write-Host ''
Write-Host 'Desinstalando o CRM Closer...' -ForegroundColor Cyan

if (Test-Path $launcher) {
    & $launcher --stop --silent
    Start-Sleep -Milliseconds 1000
}

foreach ($item in @(
    $desktop,
    (Join-Path $startupDir 'CRM Closer.lnk'),
    (Join-Path $startupDir 'CRM Closer (iniciar com Windows).lnk')
)) {
    if (Test-Path $item) {
        Remove-Item $item -Force
        Write-Host "Removido: $item" -ForegroundColor DarkGray
    }
}

if (Test-Path $startMenuDir) {
    Remove-Item $startMenuDir -Recurse -Force
    Write-Host "Removido: $startMenuDir" -ForegroundColor DarkGray
}

netsh advfirewall firewall delete rule name="CRM Closer" | Out-Null
Remove-Item 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CRMCloser' -Recurse -Force

$dataDir = Join-Path $env:LOCALAPPDATA 'CRM Closer'
if (-not $NoPrompt) {
    Write-Host ''
    Write-Host "Os dados do CRM ficam em: $dataDir" -ForegroundColor Yellow
    $resposta = Read-Host 'Apagar tambem os dados? (s/N)'
    if ($resposta -match '^[sSyY]') {
        Remove-Item $dataDir -Recurse -Force
        Write-Host 'Dados apagados.' -ForegroundColor Yellow
    } else {
        Write-Host 'Dados mantidos.' -ForegroundColor Green
    }
}

$comando = 'timeout /t 2 >nul & rmdir /s /q "' + $installDir + '"'
Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\cmd.exe') -ArgumentList '/c', $comando -WindowStyle Hidden

Write-Host ''
Write-Host 'CRM Closer desinstalado. A pasta do programa sera removida em instantes.' -ForegroundColor Green
if (-not $NoPrompt) {
    Read-Host 'Pressione Enter para fechar'
}
