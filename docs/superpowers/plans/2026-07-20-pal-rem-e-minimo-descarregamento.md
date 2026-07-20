# Pal/Rem e valor mínimo de descarregamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o tipo de carga `Pal/Rem` (Paletizado Remanejado) ao módulo de receitas e aplicar um valor mínimo configurável de R$ 25,00 por descarregamento.

**Architecture:** O tipo é um enum Postgres (`descarregamento_tipo`) espelhado por um union TS; ampliar o union faz o TypeScript apontar sozinho cada ponto da UI que precisa do novo rótulo. O mínimo vira uma tabela de linha única (`config_descarregamento`), lida no backend na hora de gravar e congelada como snapshot em cada lançamento, na mesma filosofia do snapshot de `preco_por_tonelada` que já existe.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Supabase/Postgres, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-20-pal-rem-e-minimo-descarregamento-design.md`

## Global Constraints

- Rótulo do novo tipo é exatamente `Pal/Rem`. Valor do enum no banco é exatamente `pal_rem`.
- Valor mínimo default é `25` (R$ 25,00), configurável em runtime — nunca constante de código.
- O mínimo se aplica **por lançamento** de descarregamento, é **global** (não varia por tipo nem fornecedor), e nunca funciona como teto: se o cálculo superar o mínimo, vale o cálculo.
- Todo cálculo de receita acontece **no backend** (`src/data/receitas.ts`). O formulário só faz prévia.
- Migration é aditiva e idempotente — precisa rodar corretamente tanto se `0006_receitas.sql` já estiver aplicada no Supabase quanto se não estiver.
- Sem recálculo retroativo. Lançamentos existentes ficam com `minimo_aplicado = 0` e receita original.
- Sem badge de "mínimo aplicado" na tabela. Só o valor final.
- Escrita em qualquer tabela nova exige `public.is_admin()` via RLS; leitura liberada para `authenticated`.
- Rodar testes com `npm test` (Vitest, modo run).

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0007_pal_rem_e_minimo.sql` (criar) | Enum, linha de preço, tabela de config, coluna de snapshot, RLS |
| `src/domain/types.ts` (modificar) | Union `DescarregamentoTipo`, `ConfigDescarregamento`, campo `minimoAplicado` em `Receita` |
| `src/domain/descarregamento.ts` (criar) | Ordem canônica dos tipos e rótulos de exibição — elimina a triplicação de `rotuloTipo` hoje espalhada em 3 arquivos |
| `src/domain/receitas-metrics.ts` (modificar) | `calcularReceita` com mínimo, `receitaPorTipo` genérico sobre os tipos |
| `src/domain/receitas-metrics.test.ts` (modificar) | Cobertura do mínimo e do novo tipo |
| `src/data/mappers.ts` (modificar) | `mapReceita` lê `minimo_aplicado`; novo `mapConfig` |
| `src/data/config-descarregamento.ts` (criar) | `lerConfig` / `editarValorMinimo` |
| `src/data/receitas.ts` (modificar) | Aplica e grava o mínimo em criar/editar |
| `src/app/(app)/receitas/precos/page.tsx` (modificar) | Rótulo do 3º tipo + campo do valor mínimo |
| `src/app/(app)/receitas/descarregamento-form.tsx` (modificar) | Opção `pal_rem` + prévia respeitando o mínimo |
| `src/app/(app)/receitas/page.tsx` (modificar) | Rótulo, filtro, 3ª barra, tom do `Pill`, passar `valorMinimo` ao form |
| `src/app/(app)/receitas/export/route.ts` (modificar) | CSV com rótulo legível em vez do valor cru do enum |

---

### Task 1: Tipo `pal_rem` no domínio

Amplia o union e centraliza os rótulos. Ainda sem tocar em mínimo — essa é a Task 2.

**Files:**
- Modify: `src/domain/types.ts:53`
- Create: `src/domain/descarregamento.ts`
- Modify: `src/domain/receitas-metrics.ts:39-43`
- Test: `src/domain/receitas-metrics.test.ts:52-55`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - `DescarregamentoTipo = "batido" | "paletizado" | "pal_rem"` em `@/domain/types`
  - `TIPOS_DESCARREGAMENTO: readonly DescarregamentoTipo[]` em `@/domain/descarregamento`
  - `ROTULO_TIPO: Record<DescarregamentoTipo, string>` em `@/domain/descarregamento`
  - `receitaPorTipo(rs: Receita[]): Record<DescarregamentoTipo, number>`

- [ ] **Step 1: Escrever o teste que falha**

Em `src/domain/receitas-metrics.test.ts`, substituir o teste `"agrupa receita por tipo"` (linhas 52-55) por:

```ts
  it("agrupa receita por tipo, incluindo pal_rem", () => {
    const rs = [
      r({ tipo: "batido", receita: 100 }),
      r({ tipo: "paletizado", receita: 40 }),
      r({ tipo: "batido", receita: 10 }),
      r({ tipo: "pal_rem", receita: 25 }),
    ];
    expect(receitaPorTipo(rs)).toEqual({ batido: 110, paletizado: 40, pal_rem: 25 });
  });

  it("zera os tipos sem lançamento em vez de omiti-los", () => {
    expect(receitaPorTipo([])).toEqual({ batido: 0, paletizado: 0, pal_rem: 0 });
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- receitas-metrics`
Expected: FAIL. O TypeScript reclama que `"pal_rem"` não é atribuível a `DescarregamentoTipo`, e o teste de lista vazia falha com `{}` recebido em vez das três chaves.

- [ ] **Step 3: Ampliar o union**

Em `src/domain/types.ts`, linha 53:

```ts
export type DescarregamentoTipo = "batido" | "paletizado" | "pal_rem";
```

- [ ] **Step 4: Criar o módulo de rótulos**

Criar `src/domain/descarregamento.ts`:

```ts
import type { DescarregamentoTipo } from "./types";

/** Ordem canônica dos tipos — usada em selects, barras e na tabela de preços. */
export const TIPOS_DESCARREGAMENTO = [
  "batido",
  "paletizado",
  "pal_rem",
] as const satisfies readonly DescarregamentoTipo[];

/**
 * Rótulos de exibição. `Record` sobre o union: ao adicionar um tipo novo, o
 * TypeScript aponta este objeto e todos os outros que mapeiam o union completo.
 */
export const ROTULO_TIPO: Record<DescarregamentoTipo, string> = {
  batido: "Batido",
  paletizado: "Paletizado",
  pal_rem: "Pal/Rem",
};
```

- [ ] **Step 5: Generalizar `receitaPorTipo`**

Em `src/domain/receitas-metrics.ts`, trocar o import da linha 1 e a função das linhas 39-43:

```ts
import type { Receita, DescarregamentoTipo } from "./types";
import { TIPOS_DESCARREGAMENTO } from "./descarregamento";
```

```ts
export function receitaPorTipo(rs: Receita[]): Record<DescarregamentoTipo, number> {
  const acc = Object.fromEntries(
    TIPOS_DESCARREGAMENTO.map((t) => [t, 0]),
  ) as Record<DescarregamentoTipo, number>;
  for (const r of rs) acc[r.tipo] = arredonda2(acc[r.tipo] + r.receita);
  return acc;
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test -- receitas-metrics`
Expected: PASS, todos os testes do arquivo.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/descarregamento.ts src/domain/receitas-metrics.ts src/domain/receitas-metrics.test.ts
git commit -m "feat: tipo de carga Pal/Rem (Paletizado Remanejado) no domínio"
```

---

### Task 2: Valor mínimo no cálculo de receita

**Files:**
- Modify: `src/domain/receitas-metrics.ts:12-15`
- Test: `src/domain/receitas-metrics.test.ts`

**Interfaces:**
- Consumes: `arredonda2`, `toneladas` de `@/domain/receitas-metrics`.
- Produces: `calcularReceita(pesoKg: number, precoPorTonelada: number, valorMinimo?: number): number` — terceiro parâmetro opcional, default `0`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/domain/receitas-metrics.test.ts`, adicionar dentro do `describe`, logo após o teste `"arredonda a receita a centavos"`:

```ts
  it("eleva a receita ao mínimo quando o cálculo fica abaixo dele", () => {
    // 500 kg = 0,5 t × 30 = R$ 15,00 → cobra o mínimo de R$ 25,00
    expect(calcularReceita(500, 30, 25)).toBe(25);
  });

  it("não usa o mínimo como teto: cálculo maior prevalece", () => {
    expect(calcularReceita(12500, 20, 25)).toBe(250);
  });

  it("cálculo exatamente igual ao mínimo devolve o mínimo", () => {
    // 1000 kg = 1 t × 25 = R$ 25,00
    expect(calcularReceita(1000, 25, 25)).toBe(25);
  });

  it("sem mínimo informado, mantém o cálculo puro", () => {
    expect(calcularReceita(500, 30)).toBe(15);
  });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- receitas-metrics`
Expected: FAIL. `calcularReceita(500, 30, 25)` devolve `15`, esperado `25`. O terceiro argumento é ignorado (TypeScript acusa excesso de argumentos).

- [ ] **Step 3: Aplicar o mínimo**

Em `src/domain/receitas-metrics.ts`, substituir `calcularReceita` (linhas 12-15):

```ts
/**
 * Receita de um descarregamento = toneladas × preço/ton, respeitando o valor
 * mínimo cobrado por descarrego. O mínimo é piso, nunca teto.
 * Default `0` preserva o cálculo puro para quem não passa o mínimo (prévias e testes).
 */
export function calcularReceita(
  pesoKg: number,
  precoPorTonelada: number,
  valorMinimo = 0,
): number {
  return Math.max(arredonda2(toneladas(pesoKg) * precoPorTonelada), valorMinimo);
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- receitas-metrics`
Expected: PASS, incluindo os testes antigos de `calcularReceita` que não passam o terceiro argumento.

- [ ] **Step 5: Commit**

```bash
git add src/domain/receitas-metrics.ts src/domain/receitas-metrics.test.ts
git commit -m "feat: valor mínimo por descarregamento no cálculo de receita"
```

---

### Task 3: Migration

Sem teste automatizado — o critério de aceite é a migration aplicar limpa e rodar duas vezes sem erro.

**Files:**
- Create: `supabase/migrations/0007_pal_rem_e_minimo.sql`

**Interfaces:**
- Produces: valor de enum `pal_rem`; tabela `config_descarregamento(id boolean, valor_minimo numeric, atualizado_em timestamptz)`; coluna `receitas_descarregamento.minimo_aplicado numeric(14,2) not null default 0`.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0007_pal_rem_e_minimo.sql`:

```sql
-- Pal/Rem (Paletizado Remanejado): carga que chega paletizada mas precisa ser
-- rebatida (mesa/altura) ou conferida por avaria. Preço/ton próprio.
-- E valor mínimo global cobrado por descarregamento (R$ 25,00 por padrão).
--
-- Aditiva e idempotente: roda igual com a 0006 já aplicada ou não.

-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação que insere
-- usando o valor novo. Daí o commit explícito antes do INSERT abaixo.
alter type descarregamento_tipo add value if not exists 'pal_rem';
commit;

insert into precos_descarregamento (tipo, preco_por_tonelada)
  values ('pal_rem', 0)
  on conflict (tipo) do nothing;

-- Configuração global. O check no PK garante no máximo uma linha.
create table if not exists config_descarregamento (
  id boolean primary key default true check (id),
  valor_minimo numeric(14,2) not null default 25,
  atualizado_em timestamptz not null default now()
);
insert into config_descarregamento (id) values (true) on conflict (id) do nothing;

alter table config_descarregamento enable row level security;

drop policy if exists "read config_descarregamento" on config_descarregamento;
create policy "read config_descarregamento" on config_descarregamento
  for select to authenticated using (true);

drop policy if exists "write config_descarregamento" on config_descarregamento;
create policy "write config_descarregamento" on config_descarregamento
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Snapshot do mínimo vigente no momento do lançamento, igual ao snapshot de
-- preco_por_tonelada. Lançamentos anteriores ficam com 0 (sem recálculo retroativo).
alter table receitas_descarregamento
  add column if not exists minimo_aplicado numeric(14,2) not null default 0;
```

- [ ] **Step 2: Aplicar no Supabase**

Colar o conteúdo do arquivo no SQL Editor do Supabase e executar.
Expected: sucesso. Se a `0006` ainda não tiver sido aplicada, aplicar a `0006` primeiro — a `0007` depende do enum e das tabelas dela.

- [ ] **Step 3: Verificar a idempotência**

Executar o mesmo SQL uma segunda vez.
Expected: sucesso, sem erro e sem linha duplicada.

- [ ] **Step 4: Conferir o estado**

Rodar no SQL Editor:

```sql
select unnest(enum_range(null::descarregamento_tipo)) as tipo;
select * from precos_descarregamento order by tipo;
select * from config_descarregamento;
```

Expected: três tipos (`batido`, `paletizado`, `pal_rem`); três linhas de preço, com `pal_rem` em `0.00`; uma linha de config com `valor_minimo = 25.00`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_pal_rem_e_minimo.sql
git commit -m "feat(db): enum pal_rem, config de valor mínimo e snapshot minimo_aplicado"
```

---

### Task 4: Camada de dados

**Files:**
- Modify: `src/domain/types.ts` (interface `Receita`, nova `ConfigDescarregamento`)
- Modify: `src/data/mappers.ts:70-88`
- Create: `src/data/config-descarregamento.ts`
- Modify: `src/data/receitas.ts`
- Test: `src/domain/receitas-metrics.test.ts:8-11` (ajustar a factory)

**Interfaces:**
- Consumes: `calcularReceita(pesoKg, precoPorTonelada, valorMinimo)` da Task 2; coluna `minimo_aplicado` e tabela `config_descarregamento` da Task 3.
- Produces:
  - `ConfigDescarregamento { valorMinimo: number }` em `@/domain/types`
  - `Receita.minimoAplicado: number`
  - `lerConfig(): Promise<ConfigDescarregamento>` em `@/data/config-descarregamento`
  - `editarValorMinimo(formData: FormData): Promise<void>` em `@/data/config-descarregamento`
  - `mapConfig(row: { valor_minimo: string | number }): ConfigDescarregamento` em `@/data/mappers`

- [ ] **Step 1: Ampliar os tipos**

Em `src/domain/types.ts`, adicionar após a interface `PrecoDescarregamento`:

```ts
export interface ConfigDescarregamento {
  /** Valor mínimo cobrado por descarregamento, em reais. */
  valorMinimo: number;
}
```

E adicionar o campo em `Receita`, logo após `receita`:

```ts
  minimoAplicado: number; // SNAPSHOT do mínimo vigente no lançamento
```

- [ ] **Step 2: Rodar os testes e ver a factory quebrar**

Run: `npm test -- receitas-metrics`
Expected: FAIL. A factory `r()` em `receitas-metrics.test.ts:9-11` não fornece `minimoAplicado`, então não satisfaz `Receita`.

- [ ] **Step 3: Ajustar a factory de teste**

Em `src/domain/receitas-metrics.test.ts`, linhas 8-11:

```ts
const r = (over: Partial<Receita>): Receita => ({
  id: "x", data: "2026-07-10", fornecedorId: "f1", fornecedorNome: "Forn 1",
  pesoKg: 1000, tipo: "batido", precoPorTonelada: 20, receita: 20,
  minimoAplicado: 0, observacao: null, ...over,
});
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- receitas-metrics`
Expected: PASS.

- [ ] **Step 5: Atualizar os mappers**

Em `src/data/mappers.ts`, na assinatura de `mapReceita` adicionar `minimo_aplicado` e no retorno o campo mapeado:

```ts
export function mapReceita(row: {
  id: string; data: string; fornecedor_id: string;
  fornecedores?: { nome: string } | { nome: string }[] | null;
  peso_kg: string | number; tipo: string;
  preco_por_tonelada: string | number; receita: string | number;
  minimo_aplicado: string | number; observacao: string | null;
}): Receita {
```

```ts
    receita: Number(row.receita),
    minimoAplicado: Number(row.minimo_aplicado),
    observacao: row.observacao,
```

E adicionar no fim do arquivo:

```ts
export function mapConfig(row: { valor_minimo: string | number }): ConfigDescarregamento {
  return { valorMinimo: Number(row.valor_minimo) };
}
```

Incluir `ConfigDescarregamento` no import de tipos no topo de `mappers.ts`.

- [ ] **Step 6: Criar o acesso à config**

Criar `src/data/config-descarregamento.ts`, seguindo o padrão de `precos-descarregamento.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapConfig } from "./mappers";
import { assertAdmin } from "./auth";
import type { ConfigDescarregamento } from "@/domain/types";

export async function lerConfig(): Promise<ConfigDescarregamento> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("config_descarregamento")
    .select("valor_minimo")
    .single();
  if (error) throw new Error(error.message);
  return mapConfig(data);
}

export async function editarValorMinimo(formData: FormData): Promise<void> {
  await assertAdmin();
  const raw = formData.get("valor_minimo");
  if (raw === null || String(raw).trim() === "") return;
  const valor = Number(raw);
  if (Number.isNaN(valor) || valor < 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("config_descarregamento")
    .update({ valor_minimo: valor, atualizado_em: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/precos");
  revalidatePath("/receitas");
}
```

- [ ] **Step 7: Aplicar o mínimo ao gravar**

Em `src/data/receitas.ts`:

Adicionar ao topo, junto dos outros imports:

```ts
import { lerConfig } from "./config-descarregamento";
```

Incluir a coluna nova em `COLS` (linha 10-11):

```ts
const COLS =
  "id, data, fornecedor_id, peso_kg, tipo, preco_por_tonelada, receita, minimo_aplicado, observacao, fornecedores(nome)";
```

Em `criarReceita`, substituir a linha do cálculo e adicionar o campo no `insert`:

```ts
  const { valorMinimo } = await lerConfig();
  const receita = calcularReceita(f.pesoKg, f.precoPorTonelada, valorMinimo); // cálculo no backend
```

```ts
    receita,
    minimo_aplicado: valorMinimo,
    observacao: f.observacao,
```

Em `editarReceita`, a mesma coisa:

```ts
  const { valorMinimo } = await lerConfig();
  const receita = calcularReceita(f.pesoKg, f.precoPorTonelada, valorMinimo);
```

```ts
      receita,
      minimo_aplicado: valorMinimo,
      observacao: f.observacao,
```

- [ ] **Step 8: Verificar tipos e testes**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` sem erros nos arquivos de `src/data` e `src/domain`. Testes PASS. Os arquivos de UI ainda vão acusar erro de `Record<DescarregamentoTipo, string>` incompleto — isso é esperado e será resolvido nas Tasks 5 e 6.

- [ ] **Step 9: Commit**

```bash
git add src/domain/types.ts src/domain/receitas-metrics.test.ts src/data/mappers.ts src/data/config-descarregamento.ts src/data/receitas.ts
git commit -m "feat: lê e congela o valor mínimo de descarregamento ao gravar receita"
```

---

### Task 5: Tela de preços — 3º tipo e campo do mínimo

**Files:**
- Modify: `src/app/(app)/receitas/precos/page.tsx`

**Interfaces:**
- Consumes: `ROTULO_TIPO` (Task 1), `lerConfig` / `editarValorMinimo` (Task 4).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Usar o rótulo compartilhado e ler a config**

Em `src/app/(app)/receitas/precos/page.tsx`, substituir os imports e o `rotulo` local (linhas 1-10) por:

```ts
import { listarPrecos, editarPreco } from "@/data/precos-descarregamento";
import { lerConfig, editarValorMinimo } from "@/data/config-descarregamento";
import { isAdmin } from "@/data/auth";
import { formatBRL } from "@/domain/format";
import { ROTULO_TIPO } from "@/domain/descarregamento";
import { PageHeader, Card, BackLink } from "@/components/ui";

const editInput =
  "w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";
```

Trocar o `Promise.all` e o uso do rótulo:

```ts
  const [precos, config, admin] = await Promise.all([listarPrecos(), lerConfig(), isAdmin()]);
```

```tsx
                <td className="px-5 py-3 font-medium text-[#141a4d]">{ROTULO_TIPO[p.tipo] ?? p.tipo}</td>
```

- [ ] **Step 2: Adicionar o card do valor mínimo**

Logo depois do `</Card>` da tabela de preços, antes do `</div>` final:

```tsx
      <Card className="mt-4 max-w-lg p-5">
        <h2 className="text-sm font-semibold text-[#141a4d]">Valor mínimo por descarregamento</h2>
        <p className="mt-1 text-xs text-slate-500">
          Descarregamento cujo cálculo fique abaixo deste valor é cobrado pelo mínimo.
        </p>
        {admin ? (
          <form action={editarValorMinimo} className="mt-3 flex items-center gap-2">
            <input
              name="valor_minimo"
              type="number"
              step="0.01"
              min="0"
              defaultValue={config.valorMinimo}
              required
              className={editInput}
            />
            <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
          </form>
        ) : (
          <p className="mt-3 tabular-nums text-sm text-slate-600">{formatBRL(config.valorMinimo)}</p>
        )}
      </Card>
```

- [ ] **Step 3: Verificar na aplicação**

Subir o dev server e abrir `/receitas/precos`.
Expected: três linhas na tabela (Batido, Paletizado, Pal/Rem — esta última em R$ 0,00) e o card do valor mínimo mostrando R$ 25,00. Como admin, salvar um valor diferente e recarregar para confirmar que persistiu; depois voltar para 25.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/receitas/precos/page.tsx"
git commit -m "feat: preço do Pal/Rem e edição do valor mínimo na tela de preços"
```

---

### Task 6: Lançamento, relatório e export

**Files:**
- Modify: `src/app/(app)/receitas/descarregamento-form.tsx`
- Modify: `src/app/(app)/receitas/page.tsx`
- Modify: `src/app/(app)/receitas/export/route.ts`

**Interfaces:**
- Consumes: `TIPOS_DESCARREGAMENTO` e `ROTULO_TIPO` (Task 1), `calcularReceita` com mínimo (Task 2), `lerConfig` (Task 4).
- Produces: `DescarregamentoForm` passa a exigir a prop `valorMinimo: number`.

- [ ] **Step 1: Formulário — novo tipo e prévia com mínimo**

Em `src/app/(app)/receitas/descarregamento-form.tsx`:

Adicionar ao import de domínio, junto dos outros:

```ts
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
```

Adicionar `valorMinimo` às props e usá-lo na prévia:

```tsx
export function DescarregamentoForm({
  fornecedores,
  precos,
  mes,
  valorMinimo,
  receita,
}: {
  fornecedores: Fornecedor[];
  precos: PrecoDescarregamento[];
  mes: string;
  valorMinimo: number;
  receita?: Receita;
}) {
```

```ts
  const previa = calcularReceita(peso || 0, preco || 0, valorMinimo);
```

Substituir as duas `<option>` fixas do select de tipo pela lista canônica:

```tsx
        {TIPOS_DESCARREGAMENTO.map((t) => (
          <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
        ))}
```

- [ ] **Step 2: Relatório — rótulo, filtro, barra e tom**

Em `src/app/(app)/receitas/page.tsx`:

Adicionar aos imports:

```ts
import { lerConfig } from "@/data/config-descarregamento";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
```

Remover a constante local `rotuloTipo` (linha 18) e o import agora não usado de `DescarregamentoTipo` se ele ficar órfão.

No `Promise.all` (linha 44-48), adicionar a leitura da config:

```ts
  const [receitas, fornecedores, precos, config, serie, admin] = await Promise.all([
```

inserindo `lerConfig(),` logo após `listarPrecos(),`.

Trocar `barrasTipo` (linhas 61-63) para percorrer a lista canônica:

```ts
  const barrasTipo = TIPOS_DESCARREGAMENTO.map((t) => ({
    label: ROTULO_TIPO[t], value: porTipo[t], display: formatBRL(porTipo[t]),
  }));
```

No select de filtro de tipo, substituir as duas `<option>` fixas:

```tsx
            {TIPOS_DESCARREGAMENTO.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
            ))}
```

Na célula de tipo da tabela (linha 149), dar tom próprio ao `pal_rem`:

```tsx
                      <td className="px-5 py-3">
                        <Pill tone={r.tipo === "paletizado" ? "gold" : r.tipo === "pal_rem" ? "green" : "slate"}>
                          {ROTULO_TIPO[r.tipo]}
                        </Pill>
                      </td>
```

Passar `valorMinimo` nas duas renderizações do formulário (linhas 104 e 156):

```tsx
          {admin && <DescarregamentoForm fornecedores={fornecedores} precos={precos} mes={mes} valorMinimo={config.valorMinimo} />}
```

```tsx
                            <DescarregamentoForm fornecedores={fornecedores} precos={precos} mes={mes} valorMinimo={config.valorMinimo} receita={r} />
```

- [ ] **Step 3: Export — rótulo legível no CSV**

Em `src/app/(app)/receitas/export/route.ts`, adicionar o import:

```ts
import { ROTULO_TIPO } from "@/domain/descarregamento";
```

E trocar a linha `r.tipo,` dentro do `map` por:

```ts
      ROTULO_TIPO[r.tipo],
```

- [ ] **Step 4: Verificar tipos, lint e testes**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tudo limpo, sem erro. Em particular, nenhum erro remanescente de `Record<DescarregamentoTipo, ...>` incompleto.

- [ ] **Step 5: Verificar na aplicação**

Abrir `/receitas` no dev server e conferir:
- O select de tipo do formulário lista Batido, Paletizado e Pal/Rem.
- Lançar um descarrego pequeno o suficiente para o cálculo dar menos de R$ 25,00 (ex.: 500 kg a R$ 30/ton = R$ 15,00). A prévia deve mostrar R$ 25,00, e a linha gravada na tabela também.
- Lançar um descarrego acima do mínimo e conferir que a receita é o cálculo normal.
- O gráfico por tipo mostra três barras; o filtro de tipo tem as três opções.
- Baixar o CSV e conferir que a coluna Tipo traz `Pal/Rem`, não `pal_rem`.

Remover os lançamentos de teste ao final.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/receitas/descarregamento-form.tsx" "src/app/(app)/receitas/page.tsx" "src/app/(app)/receitas/export/route.ts"
git commit -m "feat: Pal/Rem e valor mínimo no lançamento, relatório e export de receitas"
```
