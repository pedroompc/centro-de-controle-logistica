# Mantém o coletor da telemetria (Fulltrack -> Supabase) de pé: se o processo
# cair, sobe de novo em 30 s. Chamado pela tarefa "Centro - Coletor frota" (no
# boot do Windows). Log em logs\coletor-frota.log. Lê as chaves do .env.local.
$raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $raiz
$logs = "$raiz\logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = "$logs\coletor-frota.log"
$env:TZ = "America/Recife"
$node = (Get-Command node.exe).Source

function Registrar($msg) { "[$(Get-Date -Format s)] $msg" | Out-File -Append -Encoding ascii $log }

while ($true) {
  # Log não cresce sem fim: passou de 10 MB, guarda um anterior e recomeça.
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 10MB) { Move-Item -Force $log "$log.1" }

  Registrar "iniciando coletor ($(git -c safe.directory=* log --oneline -1))"
  # cmd faz o redirecionamento: o PowerShell 5.1 gravaria o log em UTF-16.
  cmd /c "`"$node`" `"$raiz\scripts\coletor-frota\index.mjs`" >> `"$log`" 2>&1"
  Registrar "coletor parou (codigo $LASTEXITCODE), subindo de novo em 30 s"
  Start-Sleep -Seconds 30
}
