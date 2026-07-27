# Descarregamento por Volume (caixas)

## Problema

Hoje o descarregamento tem 3 tipos, todos cobrados por tonelada
(`receita = máx(toneladas × preço/ton, R$25)`): Batido, Paletizado, Pal/Rem.
Falta um 4º tipo, **Volume**, cobrado pela **quantidade de caixas** (ex.: caixas
de vinho), não pelo peso.

## Decisões (alinhadas com o Pedro)

1. **Rótulo:** "Volume".
2. **Cálculo:** `receita = máx(quantidade × preço/caixa, R$25)`. O mínimo de R$25
   por descarrego **vale** para o Volume, igual aos outros.
3. **Peso:** o Volume **registra peso** (kg), que entra no **peso total** como
   qualquer descarrego. O peso NÃO influencia o valor.
4. **Quantidade:** número **inteiro** de caixas (sem fração).
5. **R$/tonelada:** o Volume **fica de fora** do indicador "Valor médio /
   tonelada" — esse indicador continua só com os tipos cobrados por tonelada
   (batido/paletizado/pal_rem, e os totais do dia). O Volume conta no card
   "Descarregamento" e no peso total, mas não polui a média por tonelada.
6. **Preço padrão:** o Volume tem um preço/caixa configurável na página de
   Preços, igual os outros têm preço/ton. Pré-preenche o formulário e pode ser
   ajustado por lançamento.

## Arquitetura

Segue o padrão da migration `0007_pal_rem_e_minimo.sql`, que adicionou o tipo
`pal_rem` (enum + linha de preço). A diferença é que o Volume traz uma base de
cobrança nova (quantidade × preço/caixa), então precisa de colunas próprias e de
ramificação no cálculo — sem tocar no caminho dos tipos por peso.

### 1. Banco — migration `0015_descarregamento_por_volume.sql`

- **Numeração:** neste repo a sequência é 0001–0009 + 0013 (total do dia). No
  Supabase compartilhado o RH ocupou até 0014 (rubricas). `0015` mantém o número
  único no banco — **confirmar com o Pedro antes de aplicar** (mesma ressalva da
  0013).
- DDL (autocommit por statement no SQL Editor, sem begin/commit — mesma forma da
  0007, que usou o novo valor do enum no `insert` seguinte sem erro):

```sql
alter type descarregamento_tipo add value if not exists 'volume';

-- Base de cobrança do Volume: caixas × preço/caixa. Nulas nos tipos por peso.
alter table receitas_descarregamento
  add column if not exists quantidade integer,
  add column if not exists preco_por_unidade numeric(14,2);

alter table receitas_descarregamento
  add constraint receitas_desc_quantidade_pos
  check (quantidade is null or quantidade > 0);

-- Preço/caixa padrão do Volume (configurável na página de Preços).
alter table precos_descarregamento add column if not exists preco_por_unidade numeric(14,2);
insert into precos_descarregamento (tipo, preco_por_tonelada, preco_por_unidade)
  values ('volume', 0, 0)
  on conflict (tipo) do nothing;
```

`preco_por_tonelada` continua **NOT NULL** nas duas tabelas: no Volume fica **0**
(n/a — o valor vem da quantidade), mesmo padrão do `pal_rem` que já nasce 0. Isso
evita tornar `precoPorTonelada` anulável em todo o domínio; como a exibição já
ramifica por tipo, o Volume nunca mostra o preço/ton mesmo.

### 2. Domínio (`src/domain/`)

- `types.ts`: `Receita` ganha `quantidade: number | null` e
  `precoPorUnidade: number | null`; `precoPorTonelada` continua `number` (0 no
  Volume, nunca exibido para ele). `PrecoDescarregamento` ganha
  `precoPorUnidade: number | null`.
- `receitas-metrics.ts`:
  - Nova função `calcularReceitaVolume(quantidade, precoPorUnidade, valorMinimo = 0)`
    = `arredonda2(máx(quantidade × precoPorUnidade, valorMinimo))`.
  - `receitaPorTipo`: já itera `TIPOS_DESCARREGAMENTO` sobre um `Record` do union
    — ao adicionar `volume` ao union e à lista, o TypeScript força os rótulos e a
    barra nova sai automática.
  - `resumoReceitas` passa a separar os tipos por peso do Volume:
    - `totalDescarregamento` = receita de **todos** os tipos (inclui Volume) +
      totais do dia. (card Descarregamento)
    - `toneladas` exibido = peso de **todos** os tipos (inclui Volume) + totais do
      dia. (peso total no hint)
    - `medioPorTonelada` = receita dos tipos **por peso** (exclui Volume) ÷
      toneladas dos tipos **por peso**, ainda somando os totais do dia — como
      hoje. Volume fora do numerador e do denominador.

### 3. `DescarregamentoTipo` e rótulos (`src/domain/descarregamento.ts`)

- `DescarregamentoTipo = "batido" | "paletizado" | "pal_rem" | "volume"`.
- `TIPOS_DESCARREGAMENTO` ganha `"volume"` no fim.
- `ROTULO_TIPO` (Record sobre o union) ganha `volume: "Volume"` — o TypeScript
  aponta todos os outros mapas do union completo se faltar.

### 4. Dados (`src/data/`)

- `mappers.ts` (`mapReceita`): mapeia `quantidade`, `preco_por_unidade` e o
  `preco_por_tonelada` agora anulável. `mapPreco`: mapeia `preco_por_unidade`.
- `receitas.ts` (`parseForm`, `criarReceita`, `editarReceita`): lê `quantidade` e
  `preco_por_unidade`; o cálculo da receita **ramifica por tipo** — Volume usa
  `calcularReceitaVolume`, os demais usam `calcularReceita`. Grava as colunas
  certas (Volume: `preco_por_tonelada` nulo, `quantidade`/`preco_por_unidade`
  preenchidos; tipos por peso: o contrário).
- `precos-descarregamento.ts`:
  - `listarPrecos`: seleciona também `preco_por_unidade`.
  - `editarPreco`: **ramifica por tipo** — Volume grava `preco_por_unidade`;
    demais gravam `preco_por_tonelada`.

### 5. Formulário de lançamento (`descarregamento-form.tsx`)

- O `select` de tipo ganha "Volume" (vem de `TIPOS_DESCARREGAMENTO`/`ROTULO_TIPO`,
  então aparece sozinho).
- Quando `tipo === "volume"`: some o campo **preço/ton**; aparecem **Caixas**
  (inteiro, `step=1 min=1`) e **R$/caixa**. O **peso** continua. A prévia usa
  `calcularReceitaVolume(quantidade, precoUnidade, mínimo)`.
- Quando é tipo por peso: comportamento atual (peso + preço/ton).
- Defaults do preço vêm de `precos`: preço/ton para tipos por peso, preço/caixa
  para o Volume.

### 6. Página de Preços (`receitas/precos/page.tsx`)

- Lista o Volume com um campo **preço/caixa** (rótulo/coluna própria), gravando em
  `preco_por_unidade` via `editarPreco`.

### 7. Tabela detalhada (`receitas/page.tsx`)

- Linhas de Volume: a coluna **R$/ton** mostra a base do Volume —
  `"{quantidade} cx × {R$ preço/caixa}"` — em vez de R$/ton (que fica "—" para o
  Volume, ou é substituída por essa informação). O **peso** aparece normalmente.
- "Receita por tipo": ganha a 4ª barra, **Volume**, automática.

### 8. Export CSV (`receitas/export/route.ts`)

- Linhas de Volume reaproveitam as colunas existentes: `Quantidade` = nº de
  caixas, `Preço unitário` = R$/caixa, `Tipo` = "Volume", `Preço/ton` e `Mínimo`
  conforme aplicável (`Preço/ton` em branco no Volume). Peso preenchido.

## Identidade visual

Verde só para valores de receita, como já é. O tipo Volume usa o mesmo padrão de
`Pill` dos outros tipos (navy/gold/slate), nunca verde.

## Testes

- `receitas-metrics.test.ts`:
  - `calcularReceitaVolume`: quantidade × preço; aplica o mínimo de R$25; arredonda
    a centavos.
  - `resumoReceitas` com um Volume misturado: `totalDescarregamento` e `toneladas`
    incluem o Volume; `medioPorTonelada` exclui o Volume (numerador e denominador).
  - `receitaPorTipo` inclui `volume`.
- `mappers.test.ts`: `mapReceita` com Volume (preco_por_tonelada nulo, quantidade
  e preco_por_unidade preenchidos) e `mapPreco` com `preco_por_unidade`.

## Fora de escopo (YAGNI)

- Outros tipos de volume além de caixas (o rótulo do campo é "Caixas"; generalizar
  só quando surgir outra unidade).
- Recalcular lançamentos antigos (não há Volume no passado).
- Quantidade fracionária.
