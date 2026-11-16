# Instala só o coletor da frota como tarefa do Windows (sem mexer no app nem no
# deploy). Rodar UMA vez, no PowerShell como Administrador:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\instalar-coletor.ps1
#
#   "Centro - Coletor frota" -> no boot, sobe o coletor da Fulltrack (volta sozinho se cair)
# Roda como SYSTEM: não depende de alguém logado no servidor.
$ErrorActionPreference = "Stop"
$raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $raiz
if (-not (Test-Path ".env.local")) { throw ".env.local ausente - crie antes de instalar" }
$conteudo = Get-Content ".env.local" -Raw
foreach ($v in "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FULLTRACK_API_KEY", "FULLTRACK_SECRET_KEY") {
  if ($conteudo -notmatch "(?m)^\s*$v\s*=\s*\S") { throw "Falta $v no .env.local - o coletor precisa dela" }
}

$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$quem = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$acao = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$raiz\deploy\windows\coletor-frota.ps1`"" -WorkingDirectory $raiz
$boot = New-ScheduledTaskTrigger -AtStartup
$cfg = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Centro - Coletor frota" -Action $acao -Trigger $boot -Principal $quem -Settings $cfg -Force | Out-Null

Stop-ScheduledTask -TaskName "Centro - Coletor frota" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "Centro - Coletor frota"
Write-Host "Coletor iniciado. Acompanhe: Get-Content logs\coletor-frota.log -Tail 20 -Wait"
