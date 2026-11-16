# BI Geral — um BI só com todos os setores

Data: 16/11/2026 · Pedido do Pedro (gestor de logística).

## Por quê

O Pedro e a diretoria precisam **cobrar resultado dos setores** num lugar só,
sem pular de setor em setor. A diretoria não vive dentro do sistema: tem de ser
fácil de manusear e de ler. Hoje cada BI mora dentro do seu setor
(`/setores/[id]?aba=bi`) e o resumo da casa está espalhado em Início,
Tendências e Fechamento.

## O que é

**Um BI só** (`/bi`, item "BI Geral" no menu) com **todas as funcionalidades
dos BIs de setor**, num único lugar:

```
┌ BI Geral · Novembro/2026 ‹ › ─────────────── [Comparar ▾] [Tela cheia] [Sair] ┐
│ [Geral]  Separação  Recebimento  Abastecimento  Motoristas                     │
├────────────────────────────────────────────────────────────────────────────────┤
│ aba Geral: números da casa + resumo de cada setor (clique abre a aba do setor) │
│ aba de setor: o BI do setor inteiro — quadros, palco, gráficos, hover, clique  │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Período único** para o BI inteiro (‹ › + seletor de período já existentes);
  trocar de aba mantém o período.
- **Comparação opcional** (`?cmp=`: desligada por padrão; mês anterior, mesmo
  período do ano passado ou livre) — o `SeletorComparacao` que o Início já usa.
- **Visual**: o mesmo dos BIs de setor (`BIShell`, fundo navy, quadros que abrem
  o palco). Nada de planilha resumida.
- Os BIs separados em Setores **continuam existindo** (decisão do Pedro). Por
  baixo é o mesmo código: o número é sempre o mesmo nas duas telas.

## Aba Geral (indicadores escolhidos pelo Pedro)

| Bloco | Indicadores |
|---|---|
| Geral | efetivo · faturamento líquido · custo logístico · custo ÷ faturamento |
| Separação | pedidos separados · peso separado · custo por caixa |
| Recebimento | peso descarregado · carros descarregados · receita de descarrego |
| Abastecimento | movimentações · reabastecimentos · rupturas |
| Motoristas | entregas · peso entregue · clientes atendidos · devolução · km por entrega |

- Cada bloco de setor é um quadro clicável que leva à aba do setor (mesmo período e `cmp`).
- Com comparação ligada, cada número mostra a variação (`ComparaPeriodos` /
  `compararPct`) contra o período escolhido.
- **Fonte de cada número = o mesmo loader do BI do setor** (`carregarBISeparacao`,
  `carregarBIAbastecimento`, `carregarBIMotoristas`, dados do Recebimento) e, para o
  bloco Geral, as mesmas fontes do Início (faturamento ao vivo, custos do mês,
  efetivo). Nunca uma conta paralela: se o loader não expõe o número, expor no
  loader (ou no domínio) e o BI do setor ganha junto.
- Definições (chamadas minhas, aprovadas na conversa):
  - clientes atendidos = cliente distinto **por dia** (regra do dashboard, ver PDVs atendidos);
  - devolução = **devolução logística** do BI dos Motoristas, não a total da empresa;
  - efetivo = o mesmo número do Início (efetivo **de hoje** — não há foto mensal
    antes de a série `efetivo-mensal` existir; mostrar como "hoje" em mês fechado sem foto).

## Histórico e "sem dado"

| Fonte | Começa em | Efeito |
|---|---|---|
| Harpia (separação, abastecimento) | out/2025 (`PISO_HARPIA`) | ano passado funciona de out/2026 em diante |
| Winthor (faturamento, entregas) | `PISO_WINTHOR` | ano passado ok |
| Supabase (custos, efetivo, receitas, descarrego) | jul/2026 (`INICIO_HISTORICO`) | custo/receita contra ano passado só a partir de jul/2027 |

Número sem base de comparação mostra **"sem histórico"** — nunca zero nem
número inventado. Aba de setor com período antes do seu piso mostra o aviso do
próprio BI (comportamento atual).

## Como fica por dentro (abordagem escolhida: A)

Abordagens consideradas:
- **A (escolhida)** — tela nova com abas, reaproveitando os componentes dos BIs
  de setor. Tudo num lugar, visual já aprovado, um código só.
- B — só a página Geral com links para os BIs em Setores: rejeitada, a diretoria
  sai da tela e cai em outro menu.
- C — refazer os BIs do zero dentro do BI Geral: rejeitada, duas versões de cada
  número que divergem com o tempo e muito mais trabalho.

Decisões:
- Rota `src/app/(app)/bi/page.tsx`. Query: `?aba=geral|separacao|recebimento|abastecimento|motoristas`
  + `mes`/`de`/`ate` + `cmp`. Sem `aba` = Geral.
- Os `Conteudo*` de `setores/[id]/page.tsx` (BI de Separação, Abastecimento,
  Motoristas, Recebimento) saem para um módulo compartilhado e passam a ser usados
  pelas duas rotas. O setor de cada aba é achado em `listarSetores()` pelos
  `ehSetorX` que já existem.
- `BIShell` ganha um slot opcional de **abas** (barra Geral/Separação/…) e de
  **comparação**; sem eles, fica idêntico ao de hoje. `hrefMes`/`hrefSair` são
  montados para `/bi` (Sair volta ao Início).
- Troca de aba/período: `Suspense` com `key` + `EsqueletoBI`, como em Setores.
- Aba Geral: cada bloco de setor num `Suspense` próprio (um setor lento não
  segura os outros). Respeita o cache só-Oracle dos BIs (nunca cache em Supabase/RLS).
- Visões admin-only (Operadores, Motoristas) continuam só para admin.

## Fases

1. **BI Geral com as abas** — `/bi`, abas de setor com o BI completo, aba Geral
   com os indicadores acima e comparação opcional **na aba Geral**.
2. **Comparação nas abas de setor** — o mesmo `?cmp=` passa a valer nos quadros de
   cada BI de setor (hoje eles comparam fixo com o período anterior; passam a
   seguir a escolha, incluindo ano passado). Mexe nos quatro BIs → fase própria.

## Fora do escopo / não fazer

- BI Devolução (branch `feat/bi-devolucao`): o Pedro não gostou; não entra.
- Metas: não existem no sistema; a régua é mês anterior / ano passado.
- Indicador novo sem rastro automático no banco.
- Tirar os BIs de Setores do menu; mexer no Painel TV.
- Verde em status/variação (verde só para receita — identidade visual).
- Textos explicativos na tela (vão para hover/docs — "BI tela limpa").

## Fica para quem constrói

- Layout exato dos blocos da aba Geral (seguir o desenho dos quadros do `BIShell`
  e validar no navegador em 1366, 1920 e celular).
- Onde exatamente cada indicador mora em cada loader e o que precisa ser exposto.
- Posição do item "BI Geral" no menu (proposta: logo abaixo de Início).
