# Deploy automático. A tarefa "Centro - Deploy automatico" roda isto a cada 3 min:
#   1. olha se a main no GitHub tem commit novo (se não tem, sai na hora);
#   2. git reset para esse commit (SEM npm ci: dependência nova se instala à mão);
#   3. builda na pasta que NÃO está no ar (.next-a / .next-b) — o app segue rodando;
#   4. build ok → troca logs\slot.txt e derruba o app; o iniciar.ps1 sobe na versão nova;
#   5. confere se /login responde; se não responder, volta para o build anterior.
# Build que falha tenta de novo na hora (uma vez, depois de 30 s): o next/font/google
# do Turbopack às vezes falha ao baixar as fontes, sem nada errado no código. Se
# falhar de novo, o mesmo commit volta a ser tentado a cada 15 min (contagem em
# logs\build-falhou.txt), até 4 rodadas; depois fica marcado em logs\falhou.txt e
# só é tentado de novo quando chegar outro commit (ou com -Forcar). Versão que
# builda mas não responde vai direto para o falhou.txt. Tudo vai para logs\deploy.log.
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
$arqBuildFalhou = "$logs\build-falhou.txt" # "<commit> <rodadas que falharam>"
$rodadasMax = 4       # rodadas de build (2 tentativas cada) antes de desistir do commit
$esperaRodada = 15    # minutos entre uma rodada que falhou e a próxima
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
  # Rodadas que já falharam no build deste commit (outro commit zera a contagem).
  $rodadas = 0
  $bf = (Ler $arqBuildFalhou) -split " "
  if ($bf[0] -eq $novo -and $bf.Count -ge 2) {
    $rodadas = [int]$bf[1]
    $minutos = ((Get-Date) - (Get-Item $arqBuildFalhou).LastWriteTime).TotalMinutes
    if (-not $Forcar -and $minutos -lt $esperaRodada) { exit 0 }
  }

  if (-not (Test-Path ".env.local") -or (Get-Item ".env.local").Length -lt 200) {
    Registrar "ERRO: .env.local ausente ou vazio - deploy cancelado"; exit 1
  }

  # Sem npm ci (decisão do Pedro): o node_modules do servidor fica como está. Se
  # o commit mexeu em dependência, só avisa no log — instale à mão (npm install).
  $depsMudaram = $false
  if ($atual) {
    cmd /c "$git diff --quiet $atual $novo -- package.json package-lock.json" | Out-Null
    $depsMudaram = ($LASTEXITCODE -ne 0)
  }

  $slotAtivo = Ler $arqSlot
  if (-not $slotAtivo) { $slotAtivo = ".next-b" } # primeira vez: builda na .next-a
  $slotNovo = if ($slotAtivo -eq ".next-a") { ".next-b" } else { ".next-a" }

  Registrar "=== deploy $(if ($atual) { $atual.Substring(0,7) } else { '(primeiro)' }) -> $($novo.Substring(0,7)) em $slotNovo$(if ($rodadas) { " (rodada $($rodadas + 1) de $rodadasMax)" })"
  if ((Rodar "$git reset --hard $novo") -ne 0) { throw "git reset falhou" }

  if ($depsMudaram) { Registrar "AVISO: package.json/package-lock mudou - se o build falhar, rode npm install na mao e -Forcar" }

  # O tsconfig inclui .next/types: um .next velho (do npm start manual de antes) com
  # rota que não existe mais quebra o type-check. Ninguém roda dali, pode apagar.
  # (O Next também acrescenta o slot ao tsconfig.json — o git reset do próximo deploy desfaz.)
  if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue }
  if (Test-Path $slotNovo) { Remove-Item -Recurse -Force $slotNovo }
  $env:NEXT_DIST_DIR = $slotNovo
  if ((Rodar "npm run build") -ne 0) {
    Registrar "AVISO: build falhou - tentando de novo em 30 s"
    Start-Sleep -Seconds 30
    if (Test-Path $slotNovo) { Remove-Item -Recurse -Force $slotNovo }
    if ((Rodar "npm run build") -ne 0) { throw "build falhou" }
  }
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
    if (Test-Path $arqBuildFalhou) { Remove-Item -Force $arqBuildFalhou }
    Registrar "OK: no ar $(cmd /c "$git log --oneline -1")"
  } else {
    Registrar "ERRO: versao nova nao respondeu em 90 s - voltando para $slotAtivo"
    Set-Content -Path $arqFalhou -Value $novo -Encoding ascii
    if (Test-Path "$slotAtivo\BUILD_ID") { Set-Content -Path $arqSlot -Value $slotAtivo -Encoding ascii; Parar-App }
  }
} catch {
  Registrar "ERRO: $($_.Exception.Message) - continua no ar o build anterior ($(Ler $arqSlot))"
  if ($novo) {
    $rodadas++
    if ($rodadas -ge $rodadasMax) {
      Set-Content -Path $arqFalhou -Value $novo -Encoding ascii
      if (Test-Path $arqBuildFalhou) { Remove-Item -Force $arqBuildFalhou }
      Registrar "Desistindo de $($novo.Substring(0,7)) depois de $rodadas rodadas - so tenta de novo com commit novo ou -Forcar"
    } else {
      Set-Content -Path $arqBuildFalhou -Value "$novo $rodadas" -Encoding ascii
      Registrar "Tenta $($novo.Substring(0,7)) de novo em $esperaRodada min (rodada $($rodadas + 1) de $rodadasMax)"
    }
  }
} finally {
  if (Test-Path $arqPausado) { Remove-Item -Force $arqPausado }
  $trava.Close()
}
