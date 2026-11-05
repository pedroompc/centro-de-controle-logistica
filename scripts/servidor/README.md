# Servidor (Windows) — serviços, atualização e monitoramento

O site e o coletor da frota rodam como serviços do Windows via [NSSM](https://nssm.cc):
sobem no boot, voltam sozinhos se caírem e gravam log em `logs\` com rotação (10 MB).

## Instalar (uma vez)

1. Baixar o NSSM e pôr o `nssm.exe` no PATH (ou passar `-Nssm C:\caminho\nssm.exe`).
2. Na pasta do projeto, com `.env.local` completo (Supabase, `DB_*`,
   `SUPABASE_SERVICE_ROLE_KEY`, `FULLTRACK_*`, `CONFERENCIA_TOKEN` com 16+ caracteres), `npm ci` e `npm run build` feitos.
3. PowerShell **como administrador**:

```
powershell -ExecutionPolicy Bypass -File scripts\servidor\instalar-servicos.ps1
& 'C:\Program Files\Tailscale\tailscale.exe' funnel --bg 3000
```

Fechar os terminais que rodavam `npm start` / `tailscale funnel` à mão antes de instalar
(senão a porta 3000 fica ocupada).

Serviços: `CentroControleSite` (next start, porta 3000) e `ColetorFrota`.
Ambos com `TZ=America/Recife` (o "mês corrente" depende disso).

## Atualizar a versão

```
powershell -ExecutionPolicy Bypass -File scripts\servidor\atualizar.ps1
```

`git pull` → `npm ci` → build limpo → reinicia os serviços → testa `/api/saude`.
Se o `npm ci` ou o build falhar, volta o build anterior e o site sobe na versão antiga.

## Logs

`logs\site.log` e `logs\coletor-frota.log` (os antigos ganham data no nome ao girar).
A pasta está no `.gitignore`.

## Monitoramento

`GET /api/saude` — pública, sem login, só estados e tempos:

```json
{ "ok": true, "status": 200,
  "oracle":   { "ok": true, "ms": 180 },
  "supabase": { "ok": true, "ms": 95 },
  "coletor":  { "estado": "ok", "minutos": 4 } }
```

Responde **503** quando o Winthor ou o Supabase não respondem, ou quando o coletor
está parado (> 2 h sem gravar). Para receber aviso, cadastrar a URL pública
`https://gerencialogistica.<tailnet>.ts.net/api/saude` num monitor gratuito
(ex.: UptimeRobot, checagem a cada 5 min, alerta por e-mail quando não for 200).

## Conferência cruzada

O site confere todo dia às 6h se os números que devem bater entre telas batem
(devolução Devoluções × Dashboard, notas do BI Motoristas × devolução por
motorista, foto do mês × Winthor). Resultado resumido em `/api/saude` →
`conferencia` (só quais pares divergiram). Detalhe com valores:
`npm run conferir https://<endereço-do-funnel>` (usa o `CONFERENCIA_TOKEN`) ou
`/api/conferencia` logado como admin.
