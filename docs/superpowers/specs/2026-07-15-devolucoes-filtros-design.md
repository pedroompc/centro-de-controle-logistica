# Devoluções — filtros e página enxuta

**Data:** 2026-07-15
**Autor:** Pedro + Claude
**Status:** Aprovado

## Problema

A página `/devolucoes` está longa demais: além dos 4 cards de indicador e dos 4 cards de
setor, ela lista **todos** os motivos, **todos** os motoristas e o top 10 de clientes.
Pedro quer uma versão curta, com filtro por **motivo**, por **setor** e **busca por
motorista** — no mesmo padrão da tela de Funcionários deste projeto.

## Decisões (validadas com o Pedro)

1. **Seções enxutas**: mantém as seções (motivo / motorista / clientes), cada uma cortada
   num top N com "ver todos". A barra de filtro estreita todas ao mesmo tempo.
2. **Cards do topo NÃO filtram**: os 4 indicadores continuam sendo o total oficial do mês
   (âncora que bate com o 111). Motivo técnico além do conceitual: "Devolução avulsa" e as
   duas taxas vêm da `VIEW_BI_FATURAMENTO`, que **não tem motivo/setor** — não há como
   filtrá-las sem misturar escopos.
3. **Padrão de filtro = Funcionários**: `Card` + `form method="get"`, Server Component, sem
   JS. Estado na querystring.

## UI — `src/app/(app)/devolucoes/page.tsx`

`searchParams`: `{ motivo?, setor?, motorista?, expandir? }`.

Ordem da página:

1. **4 cards de indicador** — inalterados (total oficial do mês).
2. **"Análise · de onde vêm"** + **barra de filtro** (`Card` + `form method="get"`):
   - `select name="motivo"` — "Todos os motivos" + os motivos do mês (vindos de `porMotivo`).
   - `select name="setor"` — "Todos os setores" + Logística / Comercial / Faturamento / Não classificado.
   - `input name="motorista"` — "Buscar motorista".
   - botão **Filtrar**; link **limpar** (`/devolucoes`) visível só quando há filtro ativo.
3. **Cards de setor** — refletem o filtro. Ficam **clicáveis**: cada card leva a
   `/devolucoes?setor=<nome>` (o `StatCard` já aceita `href`), servindo de atalho.
4. **Por motivo** — top 8 + "ver todos".
5. **Por motorista** — top 8 + "ver todos".
6. **Clientes que mais devolvem** — top 5 + "ver todos".

Cada seção mostra **"X de Y"** quando está cortada ou filtrada.
"Ver todos" = link `?expandir=motivos|motoristas|clientes` (preservando os demais filtros);
quando expandida, mostra tudo e o link vira "ver menos".

## Filtros — como agem

- **Motivo** e **Setor** → aplicados **no SQL**, afetam as três seções. Necessário porque as
  queries de cliente e de motorista não trazem motivo por linha (não dá pra filtrar em
  memória sem errar: `SQL_CLIENTE` já corta `ROWNUM <= 10` no banco).
- **Busca motorista** → filtra a tabela de motoristas por nome, **em memória** na página
  (case-insensitive, `includes`). Não faz sentido propagar para motivo/clientes.

## Camada de dados — `src/data/devolucoes.ts`

As três queries (`SQL_MOTIVO`, `SQL_CLIENTE`, `SQL_MOTORISTA`) já compartilham o `ED_CTE`.
Aplicamos o filtro **num único ponto**, via uma CTE derivada:

```sql
ed AS ( ... igual hoje ... ),
edf AS (                       -- ed + motivo/setor resolvidos + filtros
  SELECT ed.NUMTRANSENT, ed.NUMTRANSVENDA, ed.VL,
         NVL(td.MOTIVO,'Não informado') MOTIVO, <SETOR> SETOR
  FROM ed LEFT JOIN PCTABDEV td ON td.CODDEVOL = ed.CODDEVOL
  WHERE 1=1
    [AND NVL(td.MOTIVO,'Não informado') = :motivo]   -- só quando filtrado
    [AND <SETOR> = :setor]                            -- só quando filtrado
)
```

As três queries passam a ler de `edf`:
- `SQL_MOTIVO`: `FROM edf WHERE NUMTRANSVENDA > 0 GROUP BY MOTIVO, SETOR`
- `SQL_CLIENTE`: `FROM edf JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA ...`
- `SQL_MOTORISTA`: `devv AS (SELECT NUMTRANSVENDA, SUM(VL) FROM edf WHERE NUMTRANSVENDA > 0 GROUP BY NUMTRANSVENDA)`

Assinatura: `getDevolucoesMesAtual(motivo?: string, setor?: string)`.
**Parâmetros primitivos** (não objeto) porque a função é memoizada com `cache()` do React,
que compara argumentos por identidade — um objeto literal novo a cada chamada furaria o cache.

As cláusulas de filtro só entram no SQL quando presentes, e os binds correspondentes só são
passados nesses casos (o Oracle recusa bind que não aparece na query).

Nada muda na valoração (`NET = (PUNIT − ST) × QT`) nem na regra de devolução — ver
[[devolucao-regra]].

## Fora de escopo

- Filtrar os cards de indicador do topo (decisão 2).
- Propagar a busca de motorista para as seções de motivo/clientes.
- Filtro por período (a página é sempre mês corrente, como hoje).

## Testes

Sem nova lógica pura: os filtros são SQL + um `includes` na página. A suíte existente
(`npm test`) deve continuar passando; typecheck e build limpos.
Verificação real: Pedro roda no app (a página exige login) e confere que a soma dos setores
continua batendo com o card e que os filtros estreitam as três seções.
