# Instala o site e o coletor da frota como serviços do Windows (NSSM): sobem
# sozinhos no boot, reiniciam se caírem e gravam log em arquivo com rotação.
#
# Rodar UMA vez, num PowerShell "Executar como administrador", na pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File scripts\servidor\instalar-servicos.ps1
#
# Antes: `npm ci` e `npm run build` já feitos, e o .env.local completo (ver README).
# Pode rodar de novo: remove e recria os dois serviços.

param(
  [string]$Projeto = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$Nssm = "nssm",
  [int]$Porta = 3000
)

$ErrorActionPreference = "Stop"
$node = (Get-Command node).Source
$logs = Join-Path $Projeto "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

if (-not (Test-Path (Join-Path $Projeto ".env.local"))) { throw ".env.local não encontrado em $Projeto" }
if (-not (Test-Path (Join-Path $Projeto ".next\BUILD_ID"))) { throw "Sem build. Rode 'npm run build' antes." }

function Instalar($nome, $argumentos, $arquivoLog) {
  & $Nssm stop $nome 2>$null | Out-Null
  & $Nssm remove $nome confirm 2>$null | Out-Null
  & $Nssm install $nome $node $argumentos
  & $Nssm set $nome AppDirectory $Projeto
  & $Nssm set $nome AppEnvironmentExtra "NODE_ENV=production" "TZ=America/Recife"
  & $Nssm set $nome AppStdout (Join-Path $logs $arquivoLog)
  & $Nssm set $nome AppStderr (Join-Path $logs $arquivoLog)
  & $Nssm set $nome AppRotateFiles 1
  & $Nssm set $nome AppRotateOnline 1
  & $Nssm set $nome AppRotateBytes 10000000
  & $Nssm set $nome Start SERVICE_AUTO_START
  # Caiu? Espera 10 s e sobe de novo.
  & $Nssm set $nome AppExit Default Restart
  & $Nssm set $nome AppRestartDelay 10000
  & $Nssm start $nome
}

Instalar "CentroControleSite" "node_modules\next\dist\bin\next start -p $Porta" "site.log"
Instalar "ColetorFrota" "scripts\coletor-frota\index.mjs" "coletor-frota.log"

Write-Host ""
Write-Host "Serviços instalados. Conferir:"
Write-Host "  Get-Service CentroControleSite, ColetorFrota"
Write-Host "  curl http://localhost:$Porta/api/saude"
Write-Host ""
Write-Host "Funnel do Tailscale (uma vez; fica salvo e volta sozinho no boot):"
Write-Host "  & 'C:\Program Files\Tailscale\tailscale.exe' funnel --bg $Porta"
