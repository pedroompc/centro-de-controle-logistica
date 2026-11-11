# Instala o app como tarefa do Windows + o deploy automático. Rodar UMA vez, no
# PowerShell como Administrador, DEPOIS de fechar o terminal do "npm start" e o do funnel:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\instalar-tarefas.ps1
#
#   "Centro - App"               -> no boot, sobe o app na porta 3000 (volta sozinho se cair)
#   "Centro - Deploy automatico" -> a cada 3 min, publica commit novo da main
# Rodam como SYSTEM: não dependem de alguém logado no servidor.
$ErrorActionPreference = "Stop"
$raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $raiz
if (-not (Test-Path ".env.local") -or (Get-Item ".env.local").Length -lt 200) { throw ".env.local ausente ou vazio - crie antes de instalar" }

$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$quem = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$app = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$raiz\deploy\windows\iniciar.ps1`"" -WorkingDirectory $raiz
$boot = New-ScheduledTaskTrigger -AtStartup
$cfgApp = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Centro - App" -Action $app -Trigger $boot -Principal $quem -Settings $cfgApp -Force | Out-Null

$dep = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$raiz\deploy\windows\auto-deploy.ps1`"" -WorkingDirectory $raiz
$cada3 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 3)
$cfgDep = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 45) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Centro - Deploy automatico" -Action $dep -Trigger $cada3 -Principal $quem -Settings $cfgDep -Force | Out-Null

# Funnel em segundo plano: a configuração fica salva no Tailscale e volta no boot.
$ts = "C:\Program Files\Tailscale\tailscale.exe"
if (Test-Path $ts) { & $ts funnel --bg 3000 } else { Write-Warning "tailscale.exe nao encontrado - rode o funnel --bg 3000 na mao" }

Start-ScheduledTask -TaskName "Centro - App" # fica esperando o primeiro build
Write-Host "Primeiro deploy (build, alguns minutos)... acompanhe em logs\deploy.log"
& $ps -NoProfile -ExecutionPolicy Bypass -File "$raiz\deploy\windows\auto-deploy.ps1" -Forcar
Get-Content "$raiz\logs\deploy.log" -Tail 3
