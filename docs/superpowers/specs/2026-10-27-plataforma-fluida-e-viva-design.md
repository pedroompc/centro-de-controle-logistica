# Plataforma fluida e viva — design

Data: 2026-10-27 · Destino: direto na `main` (confirmado pelo Pedro)

## Por quê

O Pedro acha a plataforma bonita, mas sente dois problemas:

1. **Travada.** Ao clicar, o botão parece congelado e a troca de página demora,
   principalmente nos painéis BI dos setores.
2. **Parada.** "Tudo não tem nenhum movimento" — ele quer o painel "mais vivo".

Sucesso = clicar e a tela responder na hora; abrir um BI e ele parecer pronto
em ~1 s; e a interface ter movimento discreto que passe a sensação de sistema
vivo, sem perder a cara atual.

## O que foi medido (recon)

- `src/lib/oracle/client.ts` abre **uma conexão nova por consulta** e fecha.
  Um `SELECT 1 FROM DUAL` leva ~3,7 s de ponta a ponta, quase tudo conexão.
  O BI da Separação dispara ~9 consultas em paralelo (`separacao-dados.ts`);
  a página já foi medida entre 9 e 20 s.
- `src/app/(app)/setores/[id]/page.tsx` espera **todos** os dados antes de
  renderizar. Não existe `loading.tsx` nessa rota (só em `devolucoes` e
  `tendencias`). Resultado: o clique não dá retorno visual nenhum.
- Nenhum cache nas leituras do Oracle: trocar de mês, sair e voltar para o
  BI refaz todas as consultas.
- Painel TV (`painel/painel-view.tsx`, `aquecer()`): os blocos são buscados
  **em sequência** (`await passo(...)` um após o outro), refresh a cada
  10 min. Não há `cacheComponents` no `next.config.ts`.
- Gráficos são SVG/HTML próprios (`bi-ui.tsx`: `BarrasTV`, `BarraComposicao`,
  `CalendarioBI`…; `tendencias/evolucao-chart.tsx`, `widgets.tsx`). Não há
  biblioteca de gráfico. `globals.css` tem só `sheet-up` e `fade-in`.

## Objetivos

### 1. Velocidade

- **Pool de conexões Oracle** no `queryWinthor` (e onde mais o Oracle for
  aberto pelo app). Uma instância por processo, guardada em `globalThis`
  para sobreviver ao HMR do dev. Mesma assinatura de `queryWinthor` — nenhum
  chamador muda. Fechamento/reconexão quando o pool cair (já vimos NJS-521).
- **Resposta imediata ao clique:**
  - `loading.tsx` com esqueleto em `setores/[id]` e nas demais rotas que
    consultam Oracle/Supabase de forma pesada (dashboard, painel,
    pedidos-a-faturar, fechamento…). O esqueleto imita o layout real da tela
    (mesmos blocos, mesmas alturas) para não "pular" quando os dados chegam.
  - Barrinha de progresso âmbar no topo durante qualquer navegação.
  - Links/botões mostram estado pendente (ex.: `useLinkStatus` do Next 16 —
    ler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`).
- **Streaming nos BIs:** em vez de um `await` de tudo no topo, os blocos que
  dependem de consultas lentas renderizam dentro de `<Suspense>` e preenchem
  conforme chegam. O quadro de KPIs principal pode esperar o conjunto mínimo
  que ele precisa; o resto chega depois.
- **Painel TV:** buscar os blocos em paralelo (`Promise.all`/`allSettled`
  preservando o registro de falhas por bloco que existe hoje).

### 2. Cache (só onde o Pedro autorizou)

- **BIs dos setores** (Separação, Abastecimento, Recebimento — abas BI,
  Desempenho, Projeções): leituras do Oracle cacheadas por **5 minutos**,
  chave = consulta + mês. Mês fechado pode ter cache mais longo.
- **Dashboard (`/`) e Painel TV: ao vivo, sem cache.** Eles ganham só o pool,
  o paralelismo e o retorno visual.
- O cache guarda só dado bruto do Oracle. Nada que dependa de quem está logado
  (`isAdmin()`, cookies) entra na chave nem dentro da função cacheada — o
  recorte admin/viewer continua sendo feito depois, fora do cache.

### 3. Movimento ("vivo")

Os três blocos que o Pedro aprovou no mockup:

- **A. Entrada animada** — ao abrir uma tela: cards em cascata (fade + leve
  subida), números contam até o valor, barras/linhas crescem a partir do zero.
- **B. Sinais de ao vivo** (Dashboard e Painel TV) — indicador "AO VIVO" com
  ponto âmbar pulsando + horário da última atualização; quando um número muda
  num refresh, o card dá um brilho âmbar curto e mostra a variação (ex.: `+3`);
  sparklines se desenham.
- **C. Resposta ao toque** — card levanta levemente no hover, botão "afunda"
  no clique, tooltip ao passar o mouse em barras/pontos dos gráficos, barrinha
  de progresso no topo e esqueleto com brilho enquanto carrega.

## Regras de movimento (decididas)

- Rápido (< 1 s) e **uma vez só**. Nada fica se mexendo em loop, exceto o
  ponto "ao vivo".
- **Painel TV:** a animação de mudança só dispara quando o número de fato muda
  — nada de reanimar a tela inteira a cada refresh.
- `prefers-reduced-motion: reduce` → tudo estático (números aparecem direto,
  sem contagem; sem cascata; sem pulso).
- Navegar entre meses no BI (`‹ mês ›`) reanima os números e barras para o
  novo valor (a `key={mes}` atual já remonta o componente).

## Restrições (não negociáveis)

- **Identidade visual intacta:** navy + âmbar; **verde só para receita**,
  nunca status/categoria (memória `identidade-visual`). Brilhos/pulsos usam
  âmbar.
- **BI com tela limpa:** nenhum texto explicativo novo na tela; detalhe vai
  para tooltip/hover. Layout fluido para qualquer tela/zoom.
- **Mobile:** a camada mobile (barra inferior, tabelas → cards) continua
  funcionando; animações não podem causar scroll horizontal nem travar o toque.
- **Nenhum número muda.** Esse projeto mexe em como e quando os dados aparecem,
  não em como são calculados. Os testes existentes (`vitest`) continuam
  passando.
- Sem nova dependência pesada. Movimento em CSS + um hook pequeno de contagem;
  nada de biblioteca de animação ou de gráfico.
- Next 16 tem mudanças de API: consultar `node_modules/next/dist/docs/` antes
  de usar `loading`, `Suspense`/streaming, `unstable_cache`, `useLinkStatus`.

## Não-objetivos

- Redesenhar telas, trocar cores, tipografia ou layout.
- Trocar os gráficos por biblioteca externa ou adicionar novos indicadores.
- Mudar a frequência de refresh do Painel TV (continua 10 min + botão).
- Ativar `cacheComponents` (migração maior, fora do escopo).

## Anti-objetivos (seria fracasso mesmo "funcionando")

- Painel que parece videogame: movimento contínuo, chamativo ou lento.
- Dashboard/Painel TV mostrando número velho por causa de cache.
- Esqueleto que não bate com o layout e faz a tela "pular".
- Admin vendo dado de viewer ou vice-versa por causa de cache compartilhado.

## Dashboard sem atualização automática (decidido 28/10)

- O Dashboard (`/`) continua buscando dados só ao abrir/recarregar a página —
  sem refresh automático. No Dashboard, o bloco B se resume a um selo
  "atualizado às HH:MM" (sem pulso, sem brilho de mudança). Pulso e brilho de
  mudança ficam só no Painel TV, que já se atualiza sozinho.

## Fica a critério de quem constrói

- Tamanho do pool (sugestão: min 2, max ~10) e timeouts.
- Usar `unstable_cache` ou outro mecanismo compatível com o modo atual (sem
  `cacheComponents`) — desde que respeite as regras acima.
- Quais blocos de cada BI vão para `<Suspense>` e qual é o "mínimo" do quadro.
- Implementação da barra de progresso de navegação.
- Curvas e durações exatas (referência: o mockup aprovado em
  `.superpowers/brainstorm/*/content/movimento.html` — ~450 ms de entrada,
  ~110 ms entre cards, ~900 ms de contagem, ease-out).
- Ordem de entrega. Sugestão: pool → loading/esqueleto + barra → streaming nos
  BIs → cache dos BIs → Painel TV paralelo → movimento.

## Como verificar

- Medir o tempo até o primeiro conteúdo e até a tela completa do BI da
  Separação antes e depois (mesmo mês).
- Clique em qualquer link deve mostrar retorno visual em < 100 ms.
- Dashboard e Painel TV: confirmar que um valor alterado no Oracle aparece no
  próximo carregamento/refresh (sem cache).
- Testar com "reduzir movimento" ligado no macOS.
- Testar em tela de celular e no zoom do Painel TV.
- `npm test` e `npm run lint` passando.
