# Atualiza o servidor para a última versão da main e reinicia os serviços.
#   powershell -ExecutionPolicy Bypass -File scripts\servidor\atualizar.ps1
# Para no primeiro erro. Se o build falhar, volta o build anterior e o site
# sobe de novo na versão antiga (o código fica no commit novo: corrija e rode de novo).

param(
  [string]$Projeto = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$Nssm = "nssm",
  [int]$Porta = 3000
)

$ErrorActionPreference = "Stop"
Set-Location $Projeto

function Rodar($cmd) {
  Write-Host "> $cmd"
  cmd /c $cmd
  if ($LASTEXITCODE -ne 0) { throw "falhou: $cmd" }
}

$arquivoEnv = Get-Item ".env.local" -ErrorAction SilentlyContinue
if (-not $arquivoEnv -or $arquivoEnv.Length -lt 200) { throw ".env.local ausente ou vazio — recrie antes de atualizar." }

Rodar "git pull --ff-only"

# O site para antes do npm ci (trocar node_modules com ele rodando o derruba)
# e fica fora do ar até o build terminar (~2-3 min). NEXT_PUBLIC_* são
# embutidos no build: sempre build limpo, guardando o anterior para voltar.
& $Nssm stop CentroControleSite | Out-Null
Remove-Item -Recurse -Force ".next-anterior" -ErrorAction SilentlyContinue
if (Test-Path ".next") { Rename-Item ".next" ".next-anterior" }
try {
  Rodar "npm ci"
  Rodar "npm run build"
  Remove-Item -Recurse -Force ".next-anterior" -ErrorAction SilentlyContinue
} catch {
  Write-Host "npm ci ou build falhou — voltando o build anterior."
  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
  if (Test-Path ".next-anterior") { Rename-Item ".next-anterior" ".next" }
  throw
} finally {
  & $Nssm start CentroControleSite | Out-Null
}
& $Nssm restart ColetorFrota | Out-Null

Start-Sleep -Seconds 8
try {
  $r = Invoke-WebRequest -UseBasicParsing "http://localhost:$Porta/api/saude" -TimeoutSec 30
  Write-Host "Saúde: HTTP $($r.StatusCode) $($r.Content)"
} catch {
  Write-Host "Saúde: $($_.Exception.Message)"
}
