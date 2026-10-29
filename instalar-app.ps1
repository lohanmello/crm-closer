#requires -version 5
param(
    [string]$UserLocalAppData = $env:LOCALAPPDATA,
    [switch]$NoPrompt
)

$ErrorActionPreference = 'Stop'
$UserLocalAppData = $UserLocalAppData.Trim('"')

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    $argumentList = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"' + $PSCommandPath + '"'),
        '-UserLocalAppData', ('"' + $UserLocalAppData + '"')
    )
    if ($NoPrompt) { $argumentList += '-NoPrompt' }
    $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argumentList -Wait -PassThru
    exit $process.ExitCode
}

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$installDir = Join-Path $env:ProgramFiles 'CRM Closer'
$userProfile = Split-Path -Parent (Split-Path -Parent $UserLocalAppData)
$desktopDir = Join-Path $userProfile 'Desktop'
$startupDir = Join-Path $userProfile 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup'
$startMenuDir = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\CRM Closer'
$dataDir = Join-Path $UserLocalAppData 'CRM Closer\data'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

$origemServer = Join-Path $base 'server.js'
$origemPublic = Join-Path $base 'public'
$origemIcone = Join-Path $base 'crm.ico'
$origemLauncher = Join-Path $base 'build\CRMCloser.exe'
$origemNode = Join-Path $base 'runtime\node.exe'

foreach ($item in @($origemServer, $origemPublic, $origemIcone, $origemLauncher, $origemNode)) {
    if (-not (Test-Path $item)) {
        Write-Host "Arquivo de instalacao nao encontrado: $item" -ForegroundColor Red
        Write-Host "Baixe o pacote CRM-Closer-Windows.zip na aba Releases do repositorio." -ForegroundColor Yellow
        Write-Host "O runtime do Node e o CRMCloser.exe nao ficam versionados no codigo-fonte." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " CRM Closer - instalacao como programa" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Para qualquer instancia antiga do CRM
$processos = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -and
    $_.CommandLine -match 'server\.js' -and
    ($_.CommandLine -match 'crm-closer' -or $_.CommandLine -match 'CRM Closer')
}
foreach ($p in $processos) {
    try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "Instancia antiga parada (PID $($p.ProcessId))." -ForegroundColor DarkGray
    } catch { }
}
Start-Sleep -Milliseconds 800

# Backup dos dados atuais, se existirem
if (Test-Path (Join-Path $dataDir 'crm.db')) {
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupDir = Join-Path $dataDir ('backups\antes-instalacao-' + $ts)
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    foreach ($nome in @('crm.db', 'crm.db-wal', 'crm.db-shm')) {
        $origem = Join-Path $dataDir $nome
        if (Test-Path $origem) { Copy-Item $origem (Join-Path $backupDir $nome) -Force }
    }
    Write-Host "Backup do banco atual criado em $backupDir." -ForegroundColor DarkGray
}

# Instala os arquivos do programa
if (Test-Path $installDir) {
    Remove-Item $installDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $installDir 'runtime') | Out-Null

Copy-Item $origemServer (Join-Path $installDir 'server.js') -Force
Copy-Item $origemPublic (Join-Path $installDir 'public') -Recurse -Force
Copy-Item $origemIcone (Join-Path $installDir 'crm.ico') -Force
Copy-Item $origemLauncher (Join-Path $installDir 'CRMCloser.exe') -Force
Copy-Item $origemNode (Join-Path $installDir 'runtime\node.exe') -Force
if (Test-Path (Join-Path $base 'LEIA-ME.md')) {
    Copy-Item (Join-Path $base 'LEIA-ME.md') (Join-Path $installDir 'LEIA-ME.md') -Force
}
if (Test-Path (Join-Path $base 'runtime\LICENSE-node.txt')) {
    Copy-Item (Join-Path $base 'runtime\LICENSE-node.txt') (Join-Path $installDir 'runtime\LICENSE-node.txt') -Force
}
Copy-Item (Join-Path $base 'desinstalar.ps1') (Join-Path $installDir 'desinstalar.ps1') -Force

# Dados do usuario
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dataDir 'backups') | Out-Null

$destinoDb = Join-Path $dataDir 'crm.db'
if (-not (Test-Path $destinoDb)) {
    $origemDb = Join-Path $base 'db\crm.db'
    if (Test-Path $origemDb) {
        Copy-Item $origemDb $destinoDb -Force
        foreach ($sufixo in @('-wal', '-shm')) {
            $arq = Join-Path $base ('db\crm.db' + $sufixo)
            if (Test-Path $arq) { Copy-Item $arq (Join-Path $dataDir ('crm.db' + $sufixo)) -Force }
        }
        Write-Host "Banco de dados migrado para $dataDir." -ForegroundColor Green
    }
}

$origemBackups = Join-Path $base 'db\backups'
if (Test-Path $origemBackups) {
    Copy-Item (Join-Path $origemBackups '*') (Join-Path $dataDir 'backups') -Recurse -Force -ErrorAction SilentlyContinue
}

# Garante que o usuario consiga escrever na pasta de dados
try {
    $nomeUsuario = Split-Path -Leaf $userProfile
    & icacls $dataDir /grant "${nomeUsuario}:(OI)(CI)F" /T | Out-Null
} catch { }

# Atalhos
$wsh = New-Object -ComObject WScript.Shell
$atalhoDesktop = Join-Path $desktopDir 'CRM Closer.lnk'

$atalho = $wsh.CreateShortcut($atalhoDesktop)
$atalho.TargetPath = (Join-Path $installDir 'CRMCloser.exe')
$atalho.Arguments = ''
$atalho.WorkingDirectory = $installDir
$atalho.IconLocation = (Join-Path $installDir 'crm.ico')
$atalho.Description = 'CRM do Closer - vendas, comissoes e metas'
$atalho.WindowStyle = 1
$atalho.Save()

foreach ($nome in @('CRM Closer (iniciar com Windows).lnk', 'CRM Closer.lnk')) {
    $antigo = Join-Path $startupDir $nome
    if (Test-Path $antigo) { Remove-Item $antigo -Force }
}

$inicio = $wsh.CreateShortcut((Join-Path $startupDir 'CRM Closer.lnk'))
$inicio.TargetPath = (Join-Path $installDir 'CRMCloser.exe')
$inicio.Arguments = '--silent'
$inicio.WorkingDirectory = $installDir
$inicio.IconLocation = (Join-Path $installDir 'crm.ico')
$inicio.Description = 'Inicia o CRM Closer em segundo plano'
$inicio.WindowStyle = 7
$inicio.Save()

if (Test-Path $startMenuDir) { Remove-Item $startMenuDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null

$menu = $wsh.CreateShortcut((Join-Path $startMenuDir 'CRM Closer.lnk'))
$menu.TargetPath = (Join-Path $installDir 'CRMCloser.exe')
$menu.WorkingDirectory = $installDir
$menu.IconLocation = (Join-Path $installDir 'crm.ico')
$menu.Description = 'Abrir o CRM Closer'
$menu.Save()

$parar = $wsh.CreateShortcut((Join-Path $startMenuDir 'Parar CRM Closer.lnk'))
$parar.TargetPath = (Join-Path $installDir 'CRMCloser.exe')
$parar.Arguments = '--stop'
$parar.WorkingDirectory = $installDir
$parar.IconLocation = (Join-Path $installDir 'crm.ico')
$parar.Description = 'Parar o servidor do CRM Closer'
$parar.Save()

$desinstalar = $wsh.CreateShortcut((Join-Path $startMenuDir 'Desinstalar CRM Closer.lnk'))
$desinstalar.TargetPath = $powershell
$desinstalar.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $installDir 'desinstalar.ps1') + '"'
$desinstalar.WorkingDirectory = $installDir
$desinstalar.IconLocation = (Join-Path $installDir 'crm.ico')
$desinstalar.Description = 'Desinstalar o CRM Closer'
$desinstalar.Save()

# Registro em Aplicativos instalados
$chave = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CRMCloser'
New-Item -Path $chave -Force | Out-Null
$tamanho = 0
try {
    $tamanho = [int]((Get-ChildItem $installDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1KB)
} catch { }
Set-ItemProperty -Path $chave -Name DisplayName -Value 'CRM Closer'
Set-ItemProperty -Path $chave -Name DisplayVersion -Value '1.0.0'
Set-ItemProperty -Path $chave -Name Publisher -Value 'CRM Closer'
Set-ItemProperty -Path $chave -Name InstallLocation -Value $installDir
Set-ItemProperty -Path $chave -Name DisplayIcon -Value ((Join-Path $installDir 'CRMCloser.exe') + ',0')
Set-ItemProperty -Path $chave -Name UninstallString -Value ('"' + $powershell + '" -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $installDir 'desinstalar.ps1') + '"')
New-ItemProperty -Path $chave -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $chave -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $chave -Name EstimatedSize -Value $tamanho -PropertyType DWord -Force | Out-Null

# Firewall
try {
    netsh advfirewall firewall delete rule name="CRM Closer" | Out-Null
    netsh advfirewall firewall add rule name="CRM Closer" dir=in action=allow protocol=TCP localport=3200-3209 profile=private | Out-Null
    Write-Host "Firewall: portas 3200-3209 liberadas para redes privadas." -ForegroundColor Green
} catch {
    Write-Host "Nao foi possivel configurar o firewall automaticamente." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Instalado em: $installDir" -ForegroundColor Green
Write-Host "Dados em:    $dataDir" -ForegroundColor Green
Write-Host ""
Write-Host "Acesso neste PC: http://127.0.0.1:3200" -ForegroundColor Cyan
try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -ExpandProperty IPAddress
    foreach ($ip in $ips) {
        Write-Host ("Acesso no celular (mesma rede): http://" + $ip + ":3200") -ForegroundColor Cyan
    }
} catch { }

$perfilRede = Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -First 1
if ($perfilRede -and $perfilRede.NetworkCategory -eq 'Public') {
    Write-Host ""
    Write-Host "Atencao: a rede atual esta como Publica. A regra de firewall privada nao vale." -ForegroundColor Yellow
    Write-Host "Para acessar pelo celular, mude a rede para Privada nas configuracoes do Windows." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Atalhos criados no Desktop, Menu Iniciar e Inicializar." -ForegroundColor Green
Write-Host "Para desinstalar: Menu Iniciar > CRM Closer > Desinstalar." -ForegroundColor DarkGray

if (-not $NoPrompt) {
    $resposta = Read-Host "Abrir o CRM agora? (S/N)"
    if ($resposta -match '^[sSyY]') {
        Start-Process -FilePath (Join-Path $env:SystemRoot 'explorer.exe') -ArgumentList ('"' + $atalhoDesktop + '"')
    }
    Write-Host ""
    Read-Host "Pressione Enter para fechar"
}
