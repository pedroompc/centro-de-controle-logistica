# Coletor da frota (Fulltrack / Siga+ → Supabase)

Grava sozinho o hodômetro diário de cada rastreador em `frota_hodometro_diario`
(migration 0027). O BI dos Motoristas lê essa tabela na visão "KM rodado".

## Variáveis (`.env.local` ou ambiente do serviço)

```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...      # só no servidor, nunca no front
FULLTRACK_API_KEY=...
FULLTRACK_SECRET_KEY=...
FULLTRACK_BASE_URL=https://ws.fulltrack2.com
```

## Rodar

```
npm run coletor:frota -- --seco --uma-vez          # testa sem gravar
npm run coletor:frota -- --uma-vez --max-janelas=3  # grava um ciclo curto
npm run coletor:frota                               # contínuo
```

Posições a cada 10 min; histórico (janelas de 15 dias desde 01/07/2026) a cada 6 h.
Janela encerrada é baixada uma vez só.

## Serviço no Windows (NSSM)

```
nssm install ColetorFrota "C:\Program Files\nodejs\node.exe" scripts\coletor-frota\index.mjs
nssm set ColetorFrota AppDirectory C:\caminho\do\projeto
nssm set ColetorFrota AppStdout C:\caminho\do\projeto\logs\coletor-frota.log
nssm set ColetorFrota AppStderr C:\caminho\do\projeto\logs\coletor-frota.log
nssm set ColetorFrota AppRotateFiles 1
nssm set ColetorFrota AppRotateBytes 5000000
nssm start ColetorFrota
```

## Histórico da plataforma antiga

`node scripts/importar-historico-siga.mjs "<gestao_logistica.db>" > importar-siga.sql`
e rodar o SQL no SQL Editor do Supabase (é idempotente).
