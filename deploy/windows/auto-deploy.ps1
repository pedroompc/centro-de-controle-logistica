# Deploy automático. A tarefa "Centro - Deploy automatico" roda isto a cada 3 min:
#   1. olha se a main no GitHub tem commit novo (se não tem, sai na hora);
#   2. git reset para esse commit; npm ci SÓ se package.json/package-lock mudou;
#   3. builda na pasta que NÃO está no ar (.next-a / .next-b) — o app segue rodando;
#   4. build ok → troca logs\slot.txt e derruba o app; o iniciar.ps1 sobe na versão nova;
#   5. confere se /login responde; se não responder, volta para o build anterior.
# Build que falha fica marcado em logs\falhou.txt e não é tentado de novo até
# chegar outro commit (ou apagar o arquivo). Tudo vai para logs\deploy.log.
#
# Manual (PowerShell como Administrador), força o deploy do commit atual da main:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\auto-deploy.ps1 -Forcar
param([switch]$Forcar)

$ErrorActionPreference = "Continue" # comandos nativos: checamos $LASTEXITCODE na mão
$raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $raiz
$logs = "$raiz\logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = "$logs\deploy.log"
$arqSlot = "$logs\slot.txt"
$arqDeployado = "$logs\deployado.txt"
$arqFalhou = "$logs\falhou.txt"
$arqPausado = "$logs\pausado"
$git = "git -c safe.directory=*" # tarefa roda como SYSTEM; a pasta é de outro usuário

function Registrar($msg) { "[$(Get-Date -Format s)] $msg" | Out-File -Append -Encoding ascii $log }
function Rodar($cmd) { cmd /c "$cmd >> `"$log`" 2>&1"; return $LASTEXITCODE }
function Ler($arq) { if (Test-Path $arq) { (Get-Content $arq -Raw).Trim() } else { "" } }

function Parar-App {
  $pids = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
}

function App-Responde {
  try {
    $r = Invoke-WebRequest "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    return $r.StatusCode -lt 500
  } catch {
    if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode -lt 500 }
    return $false
  }
}

# Uma execução por vez (a tarefa de 3 em 3 min e uma rodada manual não se atropelam).
try {
  $trava = [System.IO.File]::Open("$logs\deploy.trava", "OpenOrCreate", "ReadWrite", "None")
} catch { exit 0 }

try {
  if ((Rodar "$git fetch --quiet origin main") -ne 0) { Registrar "git fetch falhou (sem internet?)"; exit 1 }
  $novo = (cmd /c "$git rev-parse origin/main").Trim()
  $atual = Ler $arqDeployado
  if (-not $Forcar) {
    if ($novo -eq $atual) { exit 0 }
    if ($novo -eq (Ler $arqFalhou)) { exit 0 }
  }

  if (-not (Test-Path ".env.local") -or (Get-Item ".env.local").Length -lt 200) {
    Registrar "ERRO: .env.local ausente ou vazio - deploy cancelado"; exit 1
  }

  $depsMudaram = $true
  if ($atual) {
    cmd /c "$git diff --quiet $atual $novo -- package.json package-lock.json" | Out-Null
    $depsMudaram = ($LASTEXITCODE -ne 0)
  }

  $slotAtivo = Ler $arqSlot
  if (-not $slotAtivo) { $slotAtivo = ".next-b" } # primeira vez: builda na .next-a
  $slotNovo = if ($slotAtivo -eq ".next-a") { ".next-b" } else { ".next-a" }

  Registrar "=== deploy $(if ($atual) { $atual.Substring(0,7) } else { '(primeiro)' }) -> $($novo.Substring(0,7)) em $slotNovo (npm ci: $depsMudaram)"
  if ((Rodar "$git reset --hard $novo") -ne 0) { throw "git reset falhou" }

  if ($depsMudaram) {
    # node_modules em uso não pode ser trocado: aqui o app fica fora até o build acabar.
    New-Item -ItemType File -Force -Path $arqPausado | Out-Null
    Parar-App
    if ((Rodar "npm ci") -ne 0) { throw "npm ci falhou" }
  }

  # O tsconfig inclui .next/types: um .next velho (do npm start manual de antes) com
  # rota que não existe mais quebra o type-check. Ninguém roda dali, pode apagar.
  # (O Next também acrescenta o slot ao tsconfig.json — o git reset do próximo deploy desfaz.)
  if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue }
  if (Test-Path $slotNovo) { Remove-Item -Recurse -Force $slotNovo }
  $env:NEXT_DIST_DIR = $slotNovo
  if ((Rodar "npm run build") -ne 0) { throw "build falhou" }
  if (-not (Test-Path "$slotNovo\BUILD_ID")) { throw "build terminou sem BUILD_ID" }

  Set-Content -Path $arqSlot -Value $slotNovo -Encoding ascii
  if (Test-Path $arqPausado) { Remove-Item -Force $arqPausado }
  Parar-App # o iniciar.ps1 sobe de novo, agora lendo o slot novo

  $ok = $false
  Start-Sleep -Seconds 5
  for ($i = 0; $i -lt 18 -and -not $ok; $i++) { $ok = App-Responde; if (-not $ok) { Start-Sleep -Seconds 5 } }

  if ($ok) {
    Set-Content -Path $arqDeployado -Value $novo -Encoding ascii
    if (Test-Path $arqFalhou) { Remove-Item -Force $arqFalhou }
    Registrar "OK: no ar $(cmd /c "$git log --oneline -1")"
  } else {
    Registrar "ERRO: versao nova nao respondeu em 90 s - voltando para $slotAtivo"
    Set-Content -Path $arqFalhou -Value $novo -Encoding ascii
    if (Test-Path "$slotAtivo\BUILD_ID") { Set-Content -Path $arqSlot -Value $slotAtivo -Encoding ascii; Parar-App }
  }
} catch {
  Registrar "ERRO: $($_.Exception.Message) - continua no ar o build anterior ($(Ler $arqSlot))"
  if ($novo) { Set-Content -Path $arqFalhou -Value $novo -Encoding ascii }
} finally {
  if (Test-Path $arqPausado) { Remove-Item -Force $arqPausado }
  $trava.Close()
}
