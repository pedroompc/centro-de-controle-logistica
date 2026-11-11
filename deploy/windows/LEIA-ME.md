# Deploy no servidor Windows

Push na `main` → em até ~3 min o servidor percebe, builda e troca de versão sozinho.

## Instalar (uma vez)

1. No servidor, feche o terminal do `npm start` (Ctrl+C) e o do `tailscale funnel` se houver.
2. PowerShell **como Administrador**:
   ```powershell
   cd C:\apps\centro-de-controle-logistica
   git pull
   powershell -ExecutionPolicy Bypass -File deploy\windows\instalar-tarefas.ps1
   ```
   O app fica fora só durante esse primeiro build.

## Como funciona

- **Centro - App** (boot): `iniciar.ps1` roda `next start -p 3000` e sobe de novo se cair.
- **Centro - Deploy automatico** (a cada 3 min): `auto-deploy.ps1`
  - sem commit novo → sai na hora;
  - commit novo → `git reset --hard` para ele, build na pasta que **não** está no ar
    (`.next-a` / `.next-b`), troca e reinicia (~10 s fora do ar);
  - **sem `npm ci`**: o `node_modules` do servidor fica como está. Se um commit trouxer dependência nova,
    o log avisa; rode `npm install` à mão e depois o deploy com `-Forcar`;
  - build quebrou ou versão nova não respondeu → **continua o build anterior** e o commit fica
    marcado em `logs\falhou.txt` (não tenta de novo até chegar outro commit).

> `git reset --hard`: qualquer arquivo versionado editado à mão no servidor é descartado.
> `.env.local`, `logs\` e `node_modules` não são tocados.

## Dia a dia

| O quê | Como |
|---|---|
| Ver o que aconteceu | `Get-Content logs\deploy.log -Tail 30` |
| Log do app | `Get-Content logs\app.log -Tail 50` |
| Forçar deploy agora | `powershell -ExecutionPolicy Bypass -File deploy\windows\auto-deploy.ps1 -Forcar` |
| Reiniciar o app | `Stop-ScheduledTask "Centro - App"; Start-ScheduledTask "Centro - App"` |
| Pausar o deploy automático | `Disable-ScheduledTask "Centro - Deploy automatico"` (volta com `Enable-`) |

Mudou o `.env.local`? `NEXT_PUBLIC_*` entram no build → rode o deploy com `-Forcar`.
