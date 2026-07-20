# Pal/Rem e valor mínimo de descarregamento

Data: 2026-07-20
Módulo: `receitas` (receitas logísticas de descarregamento)

## Contexto

O módulo de receitas cobra fornecedores por descarregamento. Hoje existem dois tipos
de carga (`batido`, `paletizado`), cada um com um preço/tonelada global, e a receita
de cada lançamento é `toneladas × preço/ton`, gravada como snapshot imutável.

Duas regras de negócio novas:

1. **Pal/Rem (Paletizado Remanejado)** — carga que chega paletizada mas precisa ser
   rebatida (ajuste de mesa/altura) ou conferida por suspeita de avaria. O trabalho é
   maior que o paletizado puro e menor que o batido, então merece preço/ton próprio.
2. **Valor mínimo por descarregamento** — qualquer descarregamento cujo cálculo dê
   menos que R$ 25,00 é cobrado a R$ 25,00. Um descarrego que calculou R$ 15,00 é
   faturado como R$ 25,00.

## Decisões

- O mínimo é **configurável**, não constante de código. A empresa pode mudar o valor
  sem deploy.
- O mínimo é **global** (não varia por tipo nem por fornecedor) e se aplica **por
  lançamento** de descarregamento.
- Cada lançamento grava o mínimo vigente como **snapshot**, na mesma filosofia do
  snapshot de `preco_por_tonelada` que já existe. Lançamentos antigos continuam
  explicáveis depois que o valor mudar.
- A tabela de descarregamentos exibe só o valor final. Sem badge de "mínimo aplicado".
- A migration é **aditiva e idempotente**, para rodar corretamente independentemente
  de a `0006_receitas.sql` já estar aplicada no Supabase ou não.

## Arquitetura

### Banco — `supabase/migrations/0007_pal_rem_e_minimo.sql`

Quatro mudanças, em statements separados:

```sql
-- 1. Novo valor de enum. Precisa estar commitado antes de ser usado.
alter type descarregamento_tipo add value if not exists 'pal_rem';
commit;

-- 2. Linha de preço do novo tipo. Preço inicial 0; definido na tela de preços.
insert into precos_descarregamento (tipo, preco_por_tonelada)
  values ('pal_rem', 0)
  on conflict (tipo) do nothing;

-- 3. Configuração global do valor mínimo. Linha única garantida pelo check.
create table if not exists config_descarregamento (
  id boolean primary key default true check (id),
  valor_minimo numeric(14,2) not null default 25,
  atualizado_em timestamptz not null default now()
);
insert into config_descarregamento (id) values (true) on conflict (id) do nothing;

-- 4. Snapshot do mínimo vigente em cada lançamento.
alter table receitas_descarregamento
  add column if not exists minimo_aplicado numeric(14,2) not null default 0;
```

RLS em `config_descarregamento` segue o padrão do projeto: leitura para `authenticated`,
escrita só para `public.is_admin()`.

`ALTER TYPE ... ADD VALUE` não pode ocorrer na mesma transação que usa o valor novo,
daí o `commit` explícito entre (1) e (2).

### Domínio — `src/domain/`

`types.ts`:

```ts
export type DescarregamentoTipo = "batido" | "paletizado" | "pal_rem";

export interface ConfigDescarregamento {
  valorMinimo: number;
}
```

`Receita` ganha `minimoAplicado: number`.

`receitas-metrics.ts`:

```ts
export function calcularReceita(pesoKg, precoPorTonelada, valorMinimo = 0): number {
  return Math.max(arredonda2(toneladas(pesoKg) * precoPorTonelada), valorMinimo);
}
```

O parâmetro tem default `0` para que as chamadas existentes e os testes atuais
continuem válidos — sem mínimo, o comportamento é idêntico ao de hoje.

`receitaPorTipo` passa a acumular as três chaves. A forma de retorno vira
`Record<DescarregamentoTipo, number>` em vez do objeto literal de dois campos, para
que adicionar um quarto tipo no futuro não exija mexer na assinatura.

**Efeito colateral aceito:** `valorMedioPorTonelada` fica levemente distorcido para
cima quando há descarregamentos pequenos elevados ao mínimo, porque o numerador passa
a incluir a diferença cobrada. Isso é fiel ao faturamento real e não será corrigido.

### Dados — `src/data/`

- Novo `config-descarregamento.ts`: `lerConfig()` e `editarValorMinimo(formData)`,
  seguindo o padrão de `precos-descarregamento.ts` (`assertAdmin`, `revalidatePath`).
- `mappers.ts`: `mapReceita` lê `minimo_aplicado`; novo `mapConfig`.
- `receitas.ts`: `criarReceita` e `editarReceita` leem o mínimo vigente, passam para
  `calcularReceita` e gravam `minimo_aplicado` junto. O cálculo continua sendo feito
  no backend — o front só faz prévia.

### UI — `src/app/(app)/receitas/`

- `descarregamento-form.tsx`: opção `pal_rem` no select de tipo; recebe `valorMinimo`
  por prop e aplica na prévia, para o número mostrado bater com o que será gravado.
- `page.tsx`: rótulo `pal_rem: "Pal/Rem"` em `rotuloTipo`, opção no filtro de tipo,
  terceira barra em `barrasTipo`, e tom `green` no `Pill` para `pal_rem` (fica
  `batido: slate`, `paletizado: gold`, `pal_rem: green`; `red` segue reservado para
  estado negativo).
- `precos/page.tsx`: rótulo `pal_rem: "Pal/Rem"` — a tabela já itera sobre o retorno
  do banco, então a terceira linha aparece sozinha. Abaixo da tabela de preços, um
  campo para o valor mínimo global, editável só por admin, no mesmo estilo.

Como `rotuloTipo` é `Record<DescarregamentoTipo, string>`, o TypeScript aponta
sozinho todos os lugares que precisam do novo rótulo ao ampliar o union.

## Testes

Em `receitas-metrics.test.ts`:

- `calcularReceita` sem mínimo mantém o comportamento atual (testes existentes passam).
- `calcularReceita(pesoKg, preco, 25)` devolve 25 quando o cálculo dá abaixo de 25.
- `calcularReceita` devolve o cálculo quando ele supera o mínimo (o mínimo não vira teto).
- Cálculo exatamente igual ao mínimo devolve o mínimo.
- `receitaPorTipo` soma corretamente com lançamentos `pal_rem` presentes.

## Fora de escopo

- Mínimo diferenciado por tipo ou por fornecedor.
- Badge visual de "mínimo aplicado" na tabela.

## Revisão de 2026-07-20 (pós-implementação)

Duas decisões do Pedro que **revertem** o que este spec dizia. Ficam aqui em vez de
serem editadas por cima, para que a mudança de entendimento fique registrada.

### Recálculo retroativo: agora SIM, via backfill

O spec original excluía recálculo retroativo, partindo da premissa de que a regra do
mínimo era nova. **A premissa estava errada.** A regra não é nova na empresa — é nova
no sistema. A Dia sempre cobrou R$ 25,00 nos descarregamentos que calculavam menos
que isso; o software é que gravava o valor cru.

Logo, os lançamentos históricos abaixo de R$ 25 são registros **errados**: divergem do
que foi de fato faturado. O backfill (`0008_backfill_minimo_descarregamento.sql`) sobe
para 25,00 as linhas com `minimo_aplicado = 0` e `receita < 25,00`, corrigindo o sistema
para bater com a realidade. A migration faz backup da tabela antes e documenta a reversão.

### Edição de lançamento aplica o mínimo vigente

O review final levantou que `editarReceita` lê o mínimo de hoje e sobrescreve a receita,
mesmo quando a edição foi só num campo de texto — de modo que corrigir uma observação
pode mudar o valor cobrado. **Decisão do Pedro: manter esse comportamento.** Qualquer
edição traz o lançamento para a regra vigente.

Consequência a ter em mente se o mínimo mudar no futuro (ex.: 25 → 30): editar a
observação de um lançamento antigo vai re-cobrá-lo pelo mínimo novo. O formulário mostra
o valor na prévia antes de salvar, mas não avisa que ele mudou.
