# Arte de Fechamento do Dia — compartilhável

**Data:** 2026-08-10
**Status:** aprovado (design) — pronto para o plano de implementação

## 1. Objetivo

Permitir que o gestor gere uma **arte (imagem PNG)** com o fechamento do dia da
operação de logística e a compartilhe direto no WhatsApp, e-mail, etc., pela
bandeja de compartilhamento nativa do celular. Público principal: **grupo /
chefia** — card caprichado, vertical (estilo "story"), com a marca DIA.

## 2. Escopo

**Faz parte:**
- Página "Fechamento" com seletor de **dia** (padrão: hoje) e opção de **período** (intervalo de datas).
- Geração da arte em PNG no servidor via `next/og` (`ImageResponse`).
- Botão "Compartilhar" que abre a bandeja nativa (Web Share API) com o PNG anexado; fallback de download.
- Preview da arte na própria página.

**Não faz parte (fora de escopo / futuro):**
- Postar automaticamente em grupo de WhatsApp (impossível via web — depende de ação do usuário na bandeja).
- Agendar/gerar a arte automaticamente todo dia.
- Comparativo vs. dia anterior dentro do card.
- Múltiplos templates/temas de arte.

## 3. Conteúdo da arte

Card vertical, proporção **4:5** (renderizado em ~1080×1350). Fundo navy
(gradiente `#0a1650 → #16205f`), respeitando a identidade: **verde só para
receita**, âmbar como destaque de marca.

| Elemento | Fonte do dado |
|---|---|
| Marca "DIA Distribuição" (topo, wordmark branco em texto — **sem sol**) | estático |
| Eyebrow "Centro de Controle · Fechamento do dia" (âmbar) | estático / muda p/ "Período" no intervalo |
| Data ("Sábado, 10 de agosto" ou "01 a 10 de agosto") | do período selecionado |
| **Faturamento bruto** (herói, branco, barra âmbar à esquerda) | `getResumoFaturamento(ini,fim).vendaFaturada` |
| Subtítulo do herói: "N PDVs atendidos · N notas emitidas" | `.atendimentos` e `.emitidas` |
| **Receitas logísticas** (tile, verde) | receitas do período (descarregamento + outras) |
| **Peso faturado** (tile, em **kg**) | `.pesoFaturado` (via `formatKg`) |
| **Devolução · mês** (tile, âmbar, em %) | **taxa do mês acumulada** (ver §4) |
| **Faltas no dia** (tile) | faltas no período |
| Rodapé: "Gerado DD/MM · HH:MM" + "Filiais 1 + 11" | timestamp de geração |

Layout aprovado (mockup v6): marca no topo → eyebrow + data → herói (faturamento)
com subtítulo → grade 2×2 de tiles → rodapé. Tudo alinhado à mesma margem
esquerda; único recuo é a barra âmbar do herói (acento de marca, intencional).

## 4. Regra da devolução (decidida)

A devolução **não** entra pelo dia — a maioria é lançada no dia seguinte, então
"devolução de hoje" não corresponde ao faturamento de hoje. Em vez disso, o card
mostra a **taxa de devolução acumulada do mês** do dia selecionado:

```
taxaDevolucaoMes = valorDevolvidoMes / vendaFaturadaMes   (0 se faturado = 0)
```

Onde `...Mes` vem de `getResumoFaturamento(primeiroDiaDoMes(fim), fim)`. Estável
e representativa, e alinhada à regra do 111 já firmada no sistema (devolução
líquida, por data de lançamento).

## 5. Geração da imagem (`next/og`)

Uma **rota** (`GET /fechamento/arte?ini=YYYY-MM-DD&fim=YYYY-MM-DD`) monta os dados
no servidor e devolve `image/png` via `ImageResponse` (JSX → PNG).

- **Fonte:** Sora (mesma da marca). O `ImageResponse` precisa dos bytes da fonte
  (não usa `next/font`), então os arquivos `.ttf` da Sora (weights 600/700/800)
  ficam versionados no projeto e são carregados no handler.
- **Marca:** wordmark "DIA Distribuição" desenhado como **texto** (Sora 800) — sem
  dependência de arquivo de imagem. (Opcional futuro: trocar por PNG exato do
  wordmark, se quiser fidelidade tipográfica total.)
- **Servidor-only:** o faturamento só existe no Oracle interno; gerar a imagem no
  servidor é natural.

> ⚠️ Regra do projeto (AGENTS.md): este é o Next 16 modificado. Antes de codar,
> conferir em `node_modules/next/dist/docs/` a API atual do `ImageResponse`
> (caminho de import, carga de fonte) — pode divergir do conhecido.

## 6. Página e navegação

- Rota `/fechamento` (dentro do grupo `(app)`, protegida por auth — **admin e
  viewer** podem gerar/compartilhar, é só leitura).
- Conteúdo: seletor de **dia** (default hoje) + toggle **"período"** que revela a
  segunda data; **preview** da arte; botão **Compartilhar**.
- **Preview = a própria imagem**: `<img src="/fechamento/arte?ini=…&fim=…">`
  (WYSIWYG, sem duplicar layout em HTML). Ao mudar as datas, atualiza o `src`.
- Acesso: item **"Fechamento"** na folha **"Mais"** (mobile) e na lateral (desktop);
  atalho **"Compartilhar fechamento"** no topo do Dashboard levando a `/fechamento`
  no dia de hoje.

## 7. Compartilhamento

- **Celular:** `navigator.share({ files: [pngFile], title, text })` → bandeja
  nativa (WhatsApp, e-mail, Telegram…). Requer HTTPS (ok via Tailscale Funnel) e
  iOS 15+/Android Chrome.
- **Desktop / sem suporte:** baixa o PNG automaticamente; quando o navegador
  permitir, também oferece "Copiar imagem".
- O botão faz `fetch` do PNG da rota `/fechamento/arte?…`, transforma em `File` e
  chama o share.

## 8. Casos de borda

- **Winthor indisponível** (fora da rede): `getResumoFaturamento` retorna `null` →
  os campos do Winthor (faturamento, peso, PDVs, notas, taxa) mostram "—" e um aviso
  discreto "Faturamento indisponível (fora da rede)". Receitas e faltas (Supabase)
  continuam preenchidos.
- **Sem dados no dia:** gera normal com zeros.
- **Período:** eyebrow vira "Período", data vira "01 a 10 de agosto"; faturamento,
  receitas, peso e faltas somam o intervalo; a taxa de devolução continua sendo a
  **do mês** do `fim`.
- **Datas inválidas / futuras:** presas à janela navegável (reusa `limitarAoHistorico`/regras de período já existentes).

## 9. Arquitetura e arquivos

Reaproveita as fontes de dados existentes — nenhuma lógica de negócio nova de dados.

| Arquivo | Papel |
|---|---|
| `src/domain/fechamento.ts` (+ `.test.ts`) | Tipos `ResumoFechamento`; funções **puras** e testáveis: `taxaDevolucaoMes`, `rotuloPeriodo(ini,fim)` (dia vs. intervalo), formatações. |
| `src/data/fechamento.ts` | `montarFechamento(ini, fim)`: busca faturamento do período, faturamento do mês (p/ taxa), receitas do período e faltas do período; devolve `ResumoFechamento` (faturamento pode vir `null`). |
| `src/app/(app)/fechamento/arte/route.ts` | `GET` → `montarFechamento` → `ImageResponse` (PNG). Carrega a fonte Sora. |
| `src/app/(app)/fechamento/page.tsx` | Página: seletor dia/período + preview (`<img>`) + botão. |
| `src/app/(app)/fechamento/compartilhar-button.tsx` | Client: `fetch` do PNG → `navigator.share` (ou download). |
| `src/app/(app)/fechamento/seletor-periodo.tsx` | Client: seletor de dia + toggle período (atualiza a URL/preview). |
| `src/app/(app)/sidebar-nav.tsx` | Acrescenta o item "Fechamento" (secundário → folha "Mais"). |
| `src/app/(app)/page.tsx` | Atalho "Compartilhar fechamento" no Dashboard. |
| `src/assets/fonts/Sora-*.ttf` (ou similar) | Bytes da fonte p/ o `ImageResponse`. |

Fluxo: página lê datas → `<img>` aponta p/ a rota → rota gera PNG → botão faz
`fetch` do mesmo PNG e joga na bandeja nativa.

## 10. Testes

- `src/domain/fechamento.test.ts`, seguindo o padrão dos outros `domain/*.test.ts`:
  - `taxaDevolucaoMes`: cálculo normal, divisão por zero (faturado 0 → 0), arredondamento.
  - `rotuloPeriodo`: dia único vs. intervalo; mesmo mês vs. meses diferentes.
  - Montagem/normalização do `ResumoFechamento` a partir de dados mockados (faturamento presente e `null`).
- `data/fechamento.ts` fica fino (orquestra chamadas já testadas); sem teste de Oracle.

## 11. Riscos e dependências

- **`next/og` no Next modificado** — conferir a doc em `node_modules` antes (import + fonte).
- **Fonte Sora** precisa ser versionada como `.ttf` para o `ImageResponse`.
- **Web Share com arquivos** exige HTTPS e navegador compatível (ok no cenário on-prem + Funnel; no desktop cai no download).
- **Rede interna:** faturamento só preenche quando acessado de dentro da rede (mesma limitação do card do Dashboard).

## 12. Fora de escopo (futuro)

- Envio automático a grupos; agendamento diário.
- Comparativo dia-a-dia dentro do card; múltiplos templates.
- Wordmark como PNG exato (hoje é texto Sora).
