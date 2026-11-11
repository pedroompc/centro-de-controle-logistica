# Sobe o app em produção na porta 3000 e o mantém de pé: se o processo cair (ou o
# deploy automático derrubar para trocar de versão), sobe de novo em 3 s.
# Chamado pela tarefa "Centro - App" (no boot do Windows). Log em logs\app.log.
#
# Qual build roda vem de logs\slot.txt (.next-a ou .next-b), que o
# auto-deploy.ps1 troca quando um build novo passa. Enquanto existir
# logs\pausado (manutenção manual), não sobe nada.
$raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $raiz
$logs = "$raiz\logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = "$logs\app.log"
$env:TZ = "America/Recife"
$env:NODE_ENV = "production"
$node = (Get-Command node.exe).Source
$next = "$raiz\node_modules\next\dist\bin\next"

function Registrar($msg) { "[$(Get-Date -Format s)] $msg" | Out-File -Append -Encoding ascii $log }

while ($true) {
  if (Test-Path "$logs\pausado") { Start-Sleep -Seconds 2; continue }

  $slot = ".next-a"
  if (Test-Path "$logs\slot.txt") { $slot = (Get-Content "$logs\slot.txt" -Raw).Trim() }
  if (-not (Test-Path "$raiz\$slot\BUILD_ID")) { Start-Sleep -Seconds 5; continue } # primeiro build ainda não saiu

  # Log não cresce sem fim: passou de 20 MB, guarda um anterior e recomeça.
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 20MB) { Move-Item -Force $log "$log.1" }

  $env:NEXT_DIST_DIR = $slot
  Registrar "iniciando ($slot, $(git -c safe.directory=* log --oneline -1))"
  # cmd faz o redirecionamento: o PowerShell 5.1 gravaria o log em UTF-16.
  cmd /c "`"$node`" `"$next`" start -p 3000 >> `"$log`" 2>&1"
  Registrar "app parou (codigo $LASTEXITCODE), subindo de novo em 3 s"
  Start-Sleep -Seconds 3
}
