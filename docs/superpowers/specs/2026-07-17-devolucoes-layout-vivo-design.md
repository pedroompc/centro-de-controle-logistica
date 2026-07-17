# Devoluções — layout "vivo" (restyle)

Data: 2026-07-17
Status: aprovado para planejamento

## Objetivo

Trazer para a página de Devoluções os **padrões de layout e interação** do módulo de
devolução do "Projeto Principal" (`../Projeto Principal/frontend/src/components/devolucao/`),
mantendo a **identidade visual** deste site (navy `#141a4d` + dourado, fonte Sora, cantos
`2xl`, barra de acento à esquerda nos KPIs, SVG inline — **sem** `lucide-react`).

Escopo é **restyle com os dados atuais**. Nenhuma query nova de negócio. Nenhum drill-down,
produtos, supervisor/RCA ou peso (não há dado para isso hoje).

## O que muda vs. o que não muda

`src/app/(app)/devolucoes/page.tsx` continua **server component**. Ele:
- busca os dados (`getDevolucoesMesAtual`, `getResumoFaturamentoMesAtual`, `listarMotivosDoMes`);
- renderiza os **4 KPIs âncora** (rotina 111) exatamente como hoje (`StatCard`), sem reagir a filtro;
- renderiza o **filtro de motivo/setor** (roda no SQL, estreita as três quebras);
- passa os arrays já buscados para os novos **client components**.

Única mudança de dados: subir o teto de clientes de `ROWNUM <= 10` para `ROWNUM <= 50` em
`sqlCliente` (`src/data/devolucoes.ts`), para que a busca e a rolagem do painel de clientes
tenham conteúdo. Nada mais no data layer muda.

O param de URL `expandir` (o "ver todos" que recarregava a página) é **removido** — a
expansão vira rolagem interna dos painéis. O param `motorista` (busca por nome) também sai
da URL: a busca de motorista passa a ser client-side instantânea. Permanecem na URL apenas
`motivo` e `setor` (que dependem do SQL).

## Componentes

### 1. Padrão de painel (helper compartilhado)

Um cabeçalho de painel reutilizável, no estilo do Projeto Principal mas em navy/dourado:
chip de ícone + título + linha de contexto + slot opcional à direita (para a busca).

- Chip de ícone: `p-1.5 rounded-lg` com tint da marca — navy (`bg-[#eef0fb] text-[#1b2168]`)
  ou dourado (`bg-amber-50 text-amber-600`), conforme a seção.
- Título: `text-sm font-semibold text-[#141a4d]`.
- Contexto: `text-xs text-slate-400` (ex.: "47 motivos · por valor").
- Card externo: `Card` existente (`rounded-2xl border bg-white shadow-sm`), com
  `overflow-hidden`. Lista rolável interna: `max-h-[28rem] overflow-y-auto`, `thead`
  com `sticky top-0`.

Ícones: SVG inline (viewBox 24×24, stroke, `1.8`), seguindo o padrão de `sidebar-nav.tsx`.
Ícones necessários: caminhão (motorista), prédio (clientes), etiqueta/lista (motivo),
lupa (busca), chevron ↑/↓ (ordenação). Colocados num arquivo local de ícones da página.

### 2. Bloco "Responsabilidade por setor"

Substitui os 4 `StatCard` de setor soltos de hoje. Dentro de um `Card`:

- **Barra empilhada** por valor devolvido (`flex h-3 rounded-full overflow-hidden`), um
  segmento por setor, largura = % do valor, cor por setor:
  - Logística → navy (`bg-[#1b2168]`)
  - Comercial → dourado (`bg-amber-400`)
  - Faturamento → rosa (`bg-rose-400`)
  - Não classificado → cinza (`bg-slate-300`)
- Abaixo, grid de cards por setor (`sm:grid-cols-2 lg:grid-cols-4`): chip do setor +
  **% do valor** (destaque) + "N notas · R$".
- Cada card de setor **continua clicável** para filtrar (mesmo `href` de hoje:
  alterna `setor` na URL). Preserva o comportamento atual.

As cores de setor ficam centralizadas num mapa (reaproveitar/estender o `CORES` que já
existe em `page.tsx`).

### 3. Por motivo (server, dentro do padrão de painel)

Mantém as barras horizontais que já existem (`LinhaMotivo` — motivo + pill do setor +
R$ + barra + "N notas"). Só passa a viver no **padrão de painel rolável** (cabeçalho com
chip de ícone, lista `max-h` rolável). Sem o link "ver todos".

Fica **lado a lado com Clientes** no desktop: um `grid xl:grid-cols-2 gap-5`.

### 4. Clientes (client component)

`painel-clientes.tsx` (`"use client"`). Recebe `topClientes` (até 50).

- **Busca instantânea** no cabeçalho (filtra por nome ou código, em memória).
- Tabela: coluna `#` (ranking), Cliente (nome + "Cód. N"), **Notas** com **mini-barra
  inline** (`h-1.5 w-24`, dourada) ao lado do número, **Valor** (dourado, `tabular-nums`).
- Rolável com `thead` grudado. Estado vazio quando a busca não acha nada.

### 5. Por motorista (client component)

`tabela-motoristas.tsx` (`"use client"`). Recebe `porMotorista` (lista completa).

- **Busca instantânea** (nome ou código) — remove o `<form>`/reload atual.
- **Colunas ordenáveis**: clicar no cabeçalho ordena; seta chevron indica coluna/direção
  ativa (dourada). Ordenáveis: Expedidas, Devolvidas, Taxa, Valor devolvido. Padrão:
  Taxa desc.
- **Semáforo** na Taxa: verde `<8%`, âmbar `8–15%`, vermelho `≥15%`.
- Coluna `#` (ranking), chip de ícone no nome, "Cód. N" abaixo.
- Mantém a frase do "pior motorista" (usa `piorMotorista`, ≥50 entregas) acima da tabela.
- Estado vazio: "Nenhum motorista para '<busca>'" quando filtrando.

**Fora de escopo** (sem dado): badges Da casa/Terceirizado/Inativo, colunas de peso,
drill-down do olho.

## Layout da página (ordem)

1. `PageHeader` (inalterado).
2. Grid dos 4 KPIs âncora (inalterado).
3. Título "Análise · de onde vêm" + "limpar filtros" (quando há filtro).
4. Card de filtro — agora só **motivo** + **setor** + botão (a busca de motorista sai daqui).
   Foco dos inputs com anel **dourado**.
5. Bloco "Responsabilidade por setor" (barra empilhada + cards clicáveis).
6. `grid xl:grid-cols-2 gap-5`: **Por motivo** | **Clientes**.
7. **Por motorista** (largura total).
8. Nota de rodapé (ajustada: remove a menção à busca de motorista via filtro; a busca de
   motorista agora é no próprio painel).

## Identidade visual (regras)

- Chips de ícone: navy-tint `bg-[#eef0fb] text-[#1b2168]` ou `bg-amber-50 text-amber-600`.
- Foco de input: `focus:ring-2 focus:ring-amber-300/50 focus:border-amber-400` (dourado,
  não laranja).
- Cantos: `Card` = `2xl`; painéis internos seguem o `Card`.
- Números: `tabular-nums`; KPIs e destaques em Sora (`font-[family-name:var(--font-sora)]`).
- Cor do dinheiro: navy `#141a4d` para valores de destaque; dourado para o acento — **não**
  usar o verde/emerald do Projeto Principal (mantém coerência com Efetivo/Custos/Receitas).

## Arquivos

- `src/app/(app)/devolucoes/page.tsx` — reescrita da árvore de render (server); mantém
  fetch e KPIs.
- `src/app/(app)/devolucoes/painel-clientes.tsx` — **novo** (client).
- `src/app/(app)/devolucoes/tabela-motoristas.tsx` — **novo** (client).
- `src/app/(app)/devolucoes/icons.tsx` — **novo** (SVG inline locais).
- `src/data/devolucoes.ts` — `sqlCliente`: `ROWNUM <= 10` → `<= 50`.
- Possível helper de painel: em `page.tsx` ou em `src/components/ui.tsx` (`PanelHeader`),
  a decidir no plano.

## Não-objetivos

- Nenhuma query nova de negócio (produtos, supervisor/RCA, drill-down, peso).
- Não migrar a identidade do Projeto Principal (laranja/emerald) para cá.
- Não mexer em outras páginas do site.
