# Etapa 2 — Janela operacional do faturamento/peso

**Data:** 2026-08-11
**Status:** discovery pendente (bloqueia o desenho final do "valor")

## Objetivo

Fazer o **faturamento bruto** e o **peso faturado** do card de fechamento
usarem o "dia operacional" (não meia-noite a meia-noite), conforme a regra da
operação, mantendo o **valor batendo com o 111**.

## A regra (definitiva)

Sobre a data/hora de faturamento de cada nota (`PCNFSAID.DTSAIDA` ou coluna de
hora equivalente — ver discovery Q1). Para uma nota emitida na data C, hora H:

| Faixa | Dia operacional |
|---|---|
| H < 07:00 (madrugada) | **C** (mesmo dia) |
| 07:00 ≤ H < 13:00 | **C** se motorista = Eugênio (`CODMOTORISTA 10059`); senão **C+1** |
| H ≥ 13:00 | **C+1** (dia seguinte) |

Equivale, em SQL, a uma "data operacional" por linha:

```sql
op_date =
  CASE
    WHEN hora < 7  THEN TRUNC(dt)
    WHEN hora < 13 THEN CASE WHEN cod_motorista = 10059 THEN TRUNC(dt) ELSE TRUNC(dt) + 1 END
    ELSE TRUNC(dt) + 1
  END
```

Para o card do dia/período [ini, fim]: filtrar `op_date BETWEEN ini AND fim`.
Motorista por nota: `PCNFSAID.NUMCAR → PCCARREG.CODMOTORISTA` (padrão já usado em
`src/data/devolucoes.ts`).

## O complicador (por que discovery primeiro)

- **Peso** vem do `PCMOV` (tem `DTMOV`/hora e liga em `NUMCAR → CODMOTORISTA`) →
  a regra é aplicável direto. **Viável.**
- **Valor (R$)** vem da `VIEW_BI_FATURAMENTO`, **agregada por dia/filial, sem
  hora nem motorista** (embute as deduções do 111 — ST, IPI, bonificação,
  avulsa; bate no centavo). Aplicar a regra ao valor exige uma fonte de valor
  com granularidade de nota/carga **que reconcilie com o 111** — e é isso que a
  discovery precisa achar.

---

## Fase 0 — Discovery (rodar no banco, dentro da rede)

> Não dá pra planejar o "valor" sem estas respostas. Rodar no Oracle do Winthor
> (filiais 1 e 11). Colar os resultados de volta.

### ✅ Resolvido (2026-08-11): a hora do faturamento

`DTSAIDA` guarda só a data (tudo 00h). A hora real está em
**`PCNFSAID.DTHORAAUTORIZACAOSEFAZ`** (DATE com data+hora da autorização SEFAZ) —
preenchida em 100% das notas (6441/6441), faixa `00-23`. `DTHORASAIDA`,
`HORAEMISSAO`, `HORASAIDA` e `DATAHORAEMISSAOSAT` vieram vazias.

→ A "data operacional" usa `TRUNC(DTHORAAUTORIZACAOSEFAZ)` (data) e
`TO_CHAR(DTHORAAUTORIZACAOSEFAZ,'HH24')` (hora). Motorista por
`NUMCAR → PCCARREG.CODMOTORISTA`. **Peso já é viável.** Falta só resolver o
**valor** (Q2/Q3 abaixo).

**Q1 (histórico) — DTSAIDA tem hora do dia (ou existe coluna de hora)?**

```sql
SELECT TO_CHAR(DTSAIDA,'HH24') HORA, COUNT(*)
  FROM PCNFSAID
 WHERE CODFILIAL IN (1,11) AND DTSAIDA >= TRUNC(SYSDATE) - 7
   AND TIPOVENDA IN ('VP','VV') AND DTCANCEL IS NULL
 GROUP BY TO_CHAR(DTSAIDA,'HH24') ORDER BY 1;

SELECT COLUMN_NAME, DATA_TYPE
  FROM ALL_TAB_COLUMNS
 WHERE TABLE_NAME = 'PCNFSAID'
   AND (COLUMN_NAME LIKE '%HORA%' OR COLUMN_NAME LIKE 'DT%');
```
- Se HORA variar (não for tudo '00') → `DTSAIDA` serve.
- Se for tudo '00' → achar a coluna de hora (ex.: `HORASAIDA`) e usá-la.

**Q2 — A VIEW_BI_FATURAMENTO tem nota/motorista/hora?**

```sql
SELECT COLUMN_NAME, DATA_TYPE
  FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'VIEW_BI_FATURAMENTO' ORDER BY COLUMN_ID;

SELECT * FROM VIEW_BI_FATURAMENTO
 WHERE CODFILIAL IN (1,11) AND DTSAIDA = TRUNC(SYSDATE) - 1 AND ROWNUM <= 3;
```
- Procurar colunas tipo `NUMNOTA` / `NUMTRANSVENDA` / `CODMOTORISTA` / `NUMCAR`
  e um `DTSAIDA` com hora.

**Q3 — Existe valor por nota que reconcilia com o BI?** (só se Q2 não tiver nota)

```sql
-- Definição da view: mostra de quais tabelas/colunas o valor sai.
SELECT TEXT FROM ALL_VIEWS WHERE VIEW_NAME = 'VIEW_BI_FATURAMENTO';
```
- Objetivo: descobrir se o valor pode ser somado por `NUMTRANSVENDA` (nota) e
  ainda fechar com o total do BI para um dia.

### Matriz de decisão (resultado da discovery → caminho do valor)

| Achado | Caminho do VALOR |
|---|---|
| **A.** BI (ou irmã) tem valor por nota/carga **com** motorista/hora, e soma = 111 | Aplica a regra direto na fonte de valor. **Ideal.** |
| **B.** Dá pra somar o valor do BI por `NUMTRANSVENDA` e reconciliar com o total | Monta o conjunto de notas do dia operacional (base, com hora+motorista) e soma o valor dessas notas. |
| **C.** Só existe o BI agregado por dia (sem nota) | **Fallback:** valor usa corte **só por tempo** (madrugada→mesmo dia + corte 13:00), **sem** a exceção do Eugênio (que fica só no peso/contagens). Documentar a diferença. |

---

## Fase 1 — Domínio: classificador do dia operacional (independe da discovery)

**Files:** `src/domain/fechamento-janela.ts` (+ `.test.ts`)

Função pura e testável que espelha o `CASE` do SQL (útil p/ testes e para o
fallback C, se preciso computar no app):

```ts
export const EUGENIO = 10059;

/** Dia operacional (YYYY-MM-DD) de uma nota, dada a hora e o motorista. */
export function diaOperacional(
  dataISO: string,        // YYYY-MM-DD da nota
  hora: number,           // 0..23
  codMotorista: number | null,
  eugenio: number = EUGENIO,
): string {
  if (hora < 7) return dataISO;
  if (hora < 13) return codMotorista === eugenio ? dataISO : somaDia(dataISO, 1);
  return somaDia(dataISO, 1);
}
```

Testes: madrugada→mesmo dia; 07–12 Eugênio→mesmo dia; 07–12 outro→+1; ≥13→+1;
virada de mês (31→01).

## Fase 2 — Peso pela janela (PCMOV)

Nova query (ou parâmetro) que soma o peso com `op_date` via o `CASE` acima,
juntando `NUMCAR → CODMOTORISTA`. Validar o total contra o peso atual num dia de
teste. Provável arquivo: estender `src/data/faturamento.ts` com uma variante
`getResumoFaturamentoOperacional(ini, fim)` ou uma função só de peso.

## Fase 3 — Valor pela janela (depende da Fase 0)

Implementar o caminho A, B ou C da matriz. Em qualquer caso: **validar contra o
111** num intervalo conhecido antes de dar como pronto (regra "martelo batido").

## Fase 4 — Integração no card

- `montarFechamento` passa a usar a fonte operacional para `faturamentoBruto` e
  `pesoFaturadoKg` (mês/taxa continuam como estão — a janela move menos de um dia
  nas bordas do mês, irrelevante para a taxa).
- Sem mudança visual (o card já mostra os campos); só os números mudam.
- Remover qualquer rótulo provisório.

## Fase 5 — Validação e testes

- Testes de `diaOperacional` (Fase 1).
- Conferência manual dos totais (faturamento e peso) contra o 111 num dia com
  faturamento do Eugênio na janela 07–13, provando que a regra reclassificou
  certo.

## Riscos

- **DTSAIDA sem hora** (Q1) → a regra inteira depende de achar a coluna de hora.
- **Valor não reconciliável por nota** (caminho C) → faturamento e peso podem
  ficar com datas ligeiramente diferentes nas notas do Eugênio (07–13); decisão
  do Pedro se aceita o fallback ou se investe na reconstrução.
- Custo Oracle: a query operacional é mais pesada (join carga + CASE por linha) —
  medir o tempo (o padrão do projeto exige índice, ver comentários em
  `faturamento.ts`).

## Dependências

- Rodar a Fase 0 no Winthor (rede interna). Eu não tenho acesso ao Oracle daqui.
- `CODMOTORISTA` do Eugênio = **10059** (confirmado).

---

# Discovery encerrada + Plano de implementação (2026-08-11)

**Achados:**
- Hora do faturamento = **`PCNFSAID.DTHORAAUTORIZACAOSEFAZ`** (100% preenchida).
- `DTSAIDA` = data da autorização SEFAZ, **sem deslocamento** (o Winthor não bucketiza pelo dia operacional → o valor por DTSAIDA é por data de emissão).
- Faturamento concentrado à **noite (18–23h)** e **madrugada (00–05h)**; manhã fraca.
- `VIEW_BI_FATURAMENTO` é agregada por cliente×produto×dia — **sem hora/nota/motorista**.

**Decisão do valor: PROPORCIONAL.** Totais exatos da BI redistribuídos entre os dias operacionais pela proporção de valor por hora+motorista das notas. Mês bate no 111 no centavo; dia fica próximo. **Peso: direto** do `PCMOV` pela classificação por nota.

## Data operacional (base de tudo)

Por nota, com `h = TO_CHAR(DTHORAAUTORIZACAOSEFAZ,'HH24')`, `c = TRUNC(DTHORAAUTORIZACAOSEFAZ)`, `mot = PCCARREG.CODMOTORISTA` (via `PCNFSAID.NUMCAR`):

```sql
op_date =
  CASE WHEN h < 7  THEN c
       WHEN h < 13 THEN CASE WHEN mot = 10059 THEN c ELSE c + 1 END
       ELSE c + 1 END
-- "fica no dia" (stay) = op_date = c ; "vai p/ o dia seguinte" (move) = op_date = c+1
```

## Isolamento

**Não** mexer em `getResumoFaturamento` (usado pelo dashboard, calendário). Criar função nova **só p/ o fechamento**: `getFaturamentoOperacional(ini, fim)` em `src/data/faturamento-operacional.ts`. O dashboard continua calendário.

## Fase 1 — Domínio: classificador (`src/domain/fechamento-janela.ts` + test)

```ts
export const EUGENIO = 10059;
/** Dia operacional (YYYY-MM-DD) de uma nota. */
export function diaOperacional(dataISO: string, hora: number, codMotorista: number | null, eugenio = EUGENIO): string {
  if (hora < 7) return dataISO;
  if (hora < 13) return codMotorista === eugenio ? dataISO : somaDia(dataISO, 1);
  return somaDia(dataISO, 1);
}
```
Testes: <7→mesmo; 7–12 Eugênio→mesmo; 7–12 outro→+1; ≥13→+1; virada de mês.

## Fase 2 — `getFaturamentoOperacional(ini, fim)` (SQL)

Retorna `{ vendaFaturada, pesoFaturadoBrutoKg, emitidas, atendimentos }` para a janela operacional. Três blocos:

1. **Valor (proporcional):**
   - `biPorDia`: `SELECT TRUNC(DTSAIDA) dia, SUM(VENDAS) v FROM VIEW_BI_FATURAMENTO WHERE filial IN (1,11) AND DTSAIDA BETWEEN :ini-1 AND :fim GROUP BY TRUNC(DTSAIDA)`.
   - `pesosPorDia` (proporção): das notas (PCNFSAID + join carga), por `TRUNC(DTHORAAUTORIZACAOSEFAZ) dia` e `stay/move` (do CASE), somar `VLTOTAL`. `w_move(dia) = move/(stay+move)`, `w_stay = 1 − w_move`.
   - Em código: `valor(D) = bi(D)·w_stay(D) + bi(D-1)·w_move(D-1)`, somado para D em [ini,fim]. (VLTOTAL é só peso da proporção — não precisa bater com o 111; os totais vêm da BI.)
2. **Peso bruto (direto):** `SUM(PESO_ITEM)` do `PCMOV` das notas de venda cujo `op_date ∈ [ini,fim]` (join PCMOV→PCNFSAID p/ hora SEFAZ, →PCCARREG p/ motorista). Bruto (sem deduzir devolução — coerente com "faturamento bruto").
3. **Contagens:** `emitidas` = nº de notas com `op_date ∈ [ini,fim]`; `atendimentos` = `COUNT(DISTINCT CODCLI || op_date)`.

Cuidar do índice/tempo (o join de carga + CASE por linha; ver comentários de performance em `faturamento.ts`).

## Fase 3 — Integração (`src/data/fechamento.ts`)

`montarFechamento` passa a usar `getFaturamentoOperacional(ini, fim)` para **faturamentoBruto, pesoFaturadoKg, pdvsAtendidos, notasEmitidas**. O faturamento do **mês** (base da taxa de devolução) continua em `getResumoFaturamento` (calendário) — a janela desloca < 1 dia nas bordas do mês, irrelevante p/ a taxa. Card não muda visualmente.

## Fase 4 — Validação contra o 111 (rodar na rede)

- Escolher um dia D com faturamento do Eugênio na janela 07–13.
- Conferir: `vendaFaturada` operacional do dia ≈ o esperado; **soma do mês = 111 no centavo** (invariante do proporcional).
- Conferir o peso bruto operacional contra uma referência do dia.
- Só dar como pronto após bater (regra "martelo batido", ver [[devolucao-regra]]).

## Riscos

- Proporcional: dia é aproximado (o mix de dedução ST/IPI varia por produto, não por hora → erro pequeno). Mês é exato.
- Confirmar `PCNFSAID.VLTOTAL` (peso da proporção) e `NUMCAR`→`PCCARREG.CODMOTORISTA` no schema.
- Custo da query operacional (join + CASE). Medir.
