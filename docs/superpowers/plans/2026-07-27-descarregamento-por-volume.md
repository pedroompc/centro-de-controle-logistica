# Descarregamento por Volume · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um 4º tipo de descarregamento, **Volume**, cobrado por caixas (quantidade × preço/caixa, com mínimo de R$25), que registra peso mas fica fora do R$/tonelada.

**Architecture:** Segue a migration `0007_pal_rem_e_minimo.sql` (enum + linha de preço), mas o Volume traz uma base de cobrança nova (caixas), então ganha colunas próprias (`quantidade`, `preco_por_unidade`) e o cálculo ramifica por tipo. Os tipos por peso não mudam.

**Tech Stack:** Next.js (App Router, server actions — **APIs com breaking changes, ver Global Constraints**), TypeScript, Supabase (Postgres + RLS), Vitest, Tailwind.

## Global Constraints

- **Este NÃO é o Next.js de treino.** Antes de escrever server actions/rotas/páginas, ler o guia relevante em `node_modules/next/dist/docs/`. (AGENTS.md)
- **Verde (emerald) só para valores de receita.** O tipo Volume usa `Pill` navy/slate como os outros, nunca verde.
- **Todo write passa por `assertAdmin()`**; RLS das tabelas já existe (não muda).
- **Somas de dinheiro usam `arredonda2`** de `@/domain/receitas-metrics`.
- **`preco_por_tonelada` continua NOT NULL** nas duas tabelas: no Volume fica **0** (n/a). `precoPorTonelada` no domínio continua `number` (nunca exibido para Volume). Não tornar anulável.
- **Migration aplicada à mão** no Supabase SQL Editor pelo Pedro. Verificação visual (dev server) só depois de aplicada.
- **Numeração:** `0015` — neste repo a sequência é 0001–0009 + 0013; no Supabase compartilhado o RH ocupou até 0014. `0015` mantém o número único. Confirmar com o Pedro antes de aplicar.
- **Rótulo do tipo:** exatamente `"Volume"`. **Unidade:** caixas (`quantidade` inteiro, `> 0`).
- **Baseline da suíte nesta branch:** `1 failed | 189 passed` — a única falha é o pré-existente `mapCustoMensal` em `src/data/mappers.test.ts`. Não é regressão; não mexer.

## File Structure

- `supabase/migrations/0015_descarregamento_por_volume.sql` — **criar**. Enum + colunas + constraint + coluna/linha de preço.
- `src/domain/types.ts` — **modificar**. `DescarregamentoTipo` += `volume`; `Receita` += `quantidade`/`precoPorUnidade`; `PrecoDescarregamento` += `precoPorUnidade`.
- `src/domain/descarregamento.ts` — **modificar**. `TIPOS_DESCARREGAMENTO` e `ROTULO_TIPO` += Volume.
- `src/domain/receitas-metrics.ts` — **modificar**. `calcularReceitaVolume`; `resumoReceitas` exclui Volume do R$/ton.
- `src/domain/receitas-metrics.test.ts` — **modificar**. Testes de Volume + ajuste das asserções de `receitaPorTipo` e do factory `r()`.
- `src/data/mappers.ts` — **modificar**. `mapReceita` e `mapPreco` com os campos novos.
- `src/data/mappers.test.ts` — **modificar**. Casos de Volume.
- `src/data/receitas.ts` — **modificar**. `parseForm`/`criarReceita`/`editarReceita` ramificam por tipo.
- `src/data/precos-descarregamento.ts` — **modificar**. `listarPrecos` e `editarPreco` com preço/caixa.
- `src/app/(app)/receitas/descarregamento-form.tsx` — **modificar**. Campos condicionais do Volume.
- `src/app/(app)/receitas/precos/page.tsx` — **modificar**. Preço/caixa do Volume.
- `src/app/(app)/receitas/page.tsx` — **modificar**. Coluna de preço da tabela detalhada por tipo.
- `src/app/(app)/receitas/export/route.ts` — **modificar**. Colunas de quantidade/preço-caixa do Volume.

---

### Task 1: Migration `0015_descarregamento_por_volume.sql`

**Files:**
- Create: `supabase/migrations/0015_descarregamento_por_volume.sql`

**Interfaces:**
- Produces: valor de enum `volume`; colunas `receitas_descarregamento.quantidade`, `receitas_descarregamento.preco_por_unidade`, `precos_descarregamento.preco_por_unidade`; linha de preço do `volume`.

- [ ] **Step 1: Escrever a migration**

Espelha a estrutura da `0007_pal_rem_e_minimo.sql`: add value no enum, **`commit;`
explícito** (o valor novo do enum não pode ser usado na mesma transação que o
insere — a 0007 tem esse commit por isso), depois o resto. O `add constraint` não
tem `IF NOT EXISTS`, então um `drop constraint if exists` antes o torna idempotente.

```sql
-- 4º tipo de descarregamento: Volume, cobrado por caixas (quantidade ×
-- preço/caixa), não por peso. Registra peso como os outros, mas o valor vem da
-- contagem de caixas. Colunas próprias porque a base de cobrança é nova.

-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação que insere
-- usando o valor novo. Daí o commit explícito antes do INSERT abaixo (mesma
-- forma da 0007).
alter type descarregamento_tipo add value if not exists 'volume';
commit;

alter table receitas_descarregamento
  add column if not exists quantidade integer,
  add column if not exists preco_por_unidade numeric(14,2);

-- ADD CONSTRAINT não tem IF NOT EXISTS; o drop-if-exists antes torna idempotente.
alter table receitas_descarregamento drop constraint if exists receitas_desc_quantidade_pos;
alter table receitas_descarregamento
  add constraint receitas_desc_quantidade_pos
  check (quantidade is null or quantidade > 0);

-- Preço/caixa padrão do Volume, configurável na página de Preços. preco_por_tonelada
-- fica 0 no Volume (n/a), mesmo padrão do pal_rem.
alter table precos_descarregamento add column if not exists preco_por_unidade numeric(14,2);
insert into precos_descarregamento (tipo, preco_por_tonelada, preco_por_unidade)
  values ('volume', 0, 0)
  on conflict (tipo) do nothing;
```

- [ ] **Step 2: Conferir que usa o mesmo idioma da 0007**

Run: `grep -c "add value if not exists" supabase/migrations/0015_descarregamento_por_volume.sql`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_descarregamento_por_volume.sql
git commit -m "feat(db): tipo de descarregamento Volume (por caixa)"
```

> **Aplicação:** o Pedro roda no Supabase SQL Editor. As tasks de código seguem sem depender disso (build/test não tocam o banco); só a verificação visual precisa da migration aplicada.

---

### Task 2: Tipo `volume` no union e nos rótulos

**Files:**
- Modify: `src/domain/types.ts` (`DescarregamentoTipo`, linha ~78)
- Modify: `src/domain/descarregamento.ts`
- Test: `src/domain/receitas-metrics.test.ts` (asserções de `receitaPorTipo`)

**Interfaces:**
- Produces: `DescarregamentoTipo = "batido" | "paletizado" | "pal_rem" | "volume"`; `TIPOS_DESCARREGAMENTO` e `ROTULO_TIPO` incluem `volume`.

- [ ] **Step 1: Adicionar `volume` ao union** (`types.ts`)

```ts
export type DescarregamentoTipo = "batido" | "paletizado" | "pal_rem" | "volume";
```

- [ ] **Step 2: Adicionar à lista e ao rótulo** (`descarregamento.ts`)

`TIPOS_DESCARREGAMENTO`:
```ts
export const TIPOS_DESCARREGAMENTO = [
  "batido",
  "paletizado",
  "pal_rem",
  "volume",
] as const satisfies readonly DescarregamentoTipo[];
```
`ROTULO_TIPO`:
```ts
export const ROTULO_TIPO: Record<DescarregamentoTipo, string> = {
  batido: "Batido",
  paletizado: "Paletizado",
  pal_rem: "Pal/Rem",
  volume: "Volume",
};
```

- [ ] **Step 3: Atualizar as asserções de `receitaPorTipo`** (`receitas-metrics.test.ts`)

Duas asserções passam a incluir `volume: 0` (o `Record` agora tem 4 chaves).

O teste "agrupa receita por tipo, incluindo pal_rem" (linha ~86):
```ts
    expect(receitaPorTipo(rs)).toEqual({ batido: 110, paletizado: 40, pal_rem: 25, volume: 0 });
```
O teste "zera os tipos sem lançamento" (linha ~90):
```ts
    expect(receitaPorTipo([])).toEqual({ batido: 0, paletizado: 0, pal_rem: 0, volume: 0 });
```

- [ ] **Step 4: Rodar os testes e o typecheck**

Run: `npx vitest run receitas-metrics && npx tsc --noEmit`
Expected: PASS; tsc sem erros (o `Record<DescarregamentoTipo>` do `ROTULO_TIPO` já cobre o valor novo).

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/descarregamento.ts src/domain/receitas-metrics.test.ts
git commit -m "feat(receitas): tipo Volume no union e nos rótulos"
```

---

### Task 3: Forma de dados e cálculo do Volume (domínio + mappers)

**Files:**
- Modify: `src/domain/types.ts` (`Receita`, `PrecoDescarregamento`)
- Modify: `src/domain/receitas-metrics.ts` (`calcularReceitaVolume`, `resumoReceitas`)
- Modify: `src/data/mappers.ts` (`mapReceita`, `mapPreco`)
- Test: `src/domain/receitas-metrics.test.ts`, `src/data/mappers.test.ts`

**Interfaces:**
- Consumes: `DescarregamentoTipo` com `volume` (Task 2).
- Produces:
  - `Receita` += `quantidade: number | null`, `precoPorUnidade: number | null`.
  - `PrecoDescarregamento` += `precoPorUnidade: number | null`.
  - `calcularReceitaVolume(quantidade: number, precoPorUnidade: number, valorMinimo?: number): number`
  - `resumoReceitas` com R$/ton excluindo o Volume.

- [ ] **Step 1: Escrever os testes que falham** (nos dois arquivos de teste)

Em `src/domain/receitas-metrics.test.ts`, importar `calcularReceitaVolume` e acrescentar `quantidade`/`precoPorUnidade` ao factory `r` (linha ~10):
```ts
import {
  toneladas, calcularReceita, arredonda2, receitaTotal, toneladasTotal,
  valorMedioPorTonelada, receitaPorFornecedor, receitaPorTipo, custoLiquido,
  calcularValorDiversa, valorTotalDiversas, resumoReceitas, resolverValorDiversa,
  receitaPorDia, calcularReceitaVolume,
} from "./receitas-metrics";
```
```ts
const r = (over: Partial<Receita>): Receita => ({
  id: "x", data: "2026-07-10", fornecedorId: "f1", fornecedorNome: "Forn 1",
  pesoKg: 1000, tipo: "batido", precoPorTonelada: 20, receita: 20,
  minimoAplicado: 0, observacao: null, quantidade: null, precoPorUnidade: null, ...over,
});
```
Novos testes:
```ts
describe("calcularReceitaVolume", () => {
  it("receita de volume = caixas × preço/caixa", () => {
    expect(calcularReceitaVolume(100, 3)).toBe(300);
  });
  it("aplica o mínimo quando caixas × preço fica abaixo", () => {
    expect(calcularReceitaVolume(2, 5, 25)).toBe(25); // 10 < 25
  });
  it("sem mínimo informado, mantém o produto puro", () => {
    expect(calcularReceitaVolume(3, 1.15)).toBe(3.45);
  });
});

it("Volume: soma no card e no peso total, mas fica fora do R$/ton", () => {
  const resumo = resumoReceitas(
    [
      r({ tipo: "batido", pesoKg: 10000, receita: 200 }),
      r({ tipo: "volume", pesoKg: 5000, receita: 300, quantidade: 100, precoPorUnidade: 3, precoPorTonelada: 0 }),
    ],
    [],
  );
  expect(resumo.totalDescarregamento).toBe(500); // 200 + 300 (inclui Volume)
  expect(resumo.toneladas).toBe(15);             // 10 t + 5 t (inclui Volume)
  expect(resumo.medioPorTonelada).toBe(20);      // 200 / 10 t — Volume fora
});
```

Em `src/data/mappers.test.ts`, no `describe("mapReceita")` (ou criar um novo), casos com os campos novos:
```ts
  it("mapeia um descarregamento por peso com quantidade/preço-unidade nulos", () => {
    const row = {
      id: "d1", data: "2026-07-10", fornecedor_id: "f1", fornecedores: { nome: "Forn 1" },
      peso_kg: "1000", tipo: "batido", preco_por_tonelada: "20", receita: "20",
      minimo_aplicado: "0", observacao: null, quantidade: null, preco_por_unidade: null,
    };
    expect(mapReceita(row)).toMatchObject({ tipo: "batido", quantidade: null, precoPorUnidade: null });
  });

  it("mapeia um Volume com quantidade e preço/caixa", () => {
    const row = {
      id: "d2", data: "2026-07-10", fornecedor_id: "f1", fornecedores: { nome: "Forn 1" },
      peso_kg: "5000", tipo: "volume", preco_por_tonelada: "0", receita: "300",
      minimo_aplicado: "25", observacao: null, quantidade: "100", preco_por_unidade: "3.00",
    };
    expect(mapReceita(row)).toMatchObject({ tipo: "volume", quantidade: 100, precoPorUnidade: 3 });
  });

  it("mapPreco lê o preço/caixa", () => {
    expect(mapPreco({ tipo: "volume", preco_por_tonelada: "0", preco_por_unidade: "3.50" }))
      .toEqual({ tipo: "volume", precoPorTonelada: 0, precoPorUnidade: 3.5 });
  });
```
(garanta que `mapReceita` e `mapPreco` estão no import do topo do arquivo — `mapPreco` pode não estar ainda.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run receitas-metrics mappers`
Expected: FAIL — `calcularReceitaVolume` não existe; `Receita`/`PrecoDescarregamento` sem os campos; `resumoReceitas` inclui Volume no R$/ton.

- [ ] **Step 3: Estender os tipos** (`types.ts`)

`Receita` (após `precoPorTonelada`):
```ts
export interface Receita {
  id: string;
  data: string; // ISO "yyyy-mm-dd"
  fornecedorId: string;
  fornecedorNome: string;
  pesoKg: number;
  tipo: DescarregamentoTipo;
  precoPorTonelada: number;     // 0 no Volume (n/a)
  quantidade: number | null;    // só Volume: nº de caixas
  precoPorUnidade: number | null; // só Volume: R$/caixa
  receita: number;
  minimoAplicado: number;
  observacao: string | null;
}
```
`PrecoDescarregamento`:
```ts
export interface PrecoDescarregamento {
  tipo: DescarregamentoTipo;
  precoPorTonelada: number;
  precoPorUnidade: number | null; // preço/caixa; só o Volume usa
}
```

- [ ] **Step 4: `calcularReceitaVolume` e `resumoReceitas`** (`receitas-metrics.ts`)

Após `calcularReceita` (linha ~25):
```ts
/**
 * Receita de um descarregamento por Volume = caixas × preço/caixa, respeitando o
 * mesmo mínimo por descarrego. Sem peso na conta — o peso do Volume é registrado,
 * mas não entra no valor.
 */
export function calcularReceitaVolume(
  quantidade: number,
  precoPorUnidade: number,
  valorMinimo = 0,
): number {
  return arredonda2(Math.max(quantidade * precoPorUnidade, valorMinimo));
}
```
Substituir `resumoReceitas` (linha ~155): o card e o peso total incluem o Volume; o R$/ton exclui.
```ts
export function resumoReceitas(
  descarregamentos: Receita[],
  diversas: ReceitaDiversa[],
  totaisDiarios: TotalDiarioDescarregamento[] = [],
): ResumoReceitas {
  const totalTotaisDiarios = arredonda2(totaisDiarios.reduce((t, x) => t + x.receita, 0));
  const tonsTotaisDiarios = arredonda2(totaisDiarios.reduce((t, x) => t + toneladas(x.pesoKg), 0));

  // Card e peso total: todos os tipos, inclusive o Volume.
  const totalDescarregamento = arredonda2(receitaTotal(descarregamentos) + totalTotaisDiarios);
  const tons = arredonda2(toneladasTotal(descarregamentos) + tonsTotaisDiarios);

  // R$/ton: só os tipos cobrados por tonelada (Volume fora), somando os totais do dia.
  const porPeso = descarregamentos.filter((r) => r.tipo !== "volume");
  const receitaPorPeso = arredonda2(receitaTotal(porPeso) + totalTotaisDiarios);
  const tonsPorPeso = arredonda2(toneladasTotal(porPeso) + tonsTotaisDiarios);

  const totalDiversas = valorTotalDiversas(diversas);
  return {
    totalDescarregamento,
    totalDiversas,
    total: arredonda2(totalDescarregamento + totalDiversas),
    toneladas: tons,
    medioPorTonelada: tonsPorPeso === 0 ? 0 : arredonda2(receitaPorPeso / tonsPorPeso),
  };
}
```

- [ ] **Step 5: Mappers** (`mappers.ts`)

`mapPreco`:
```ts
export function mapPreco(row: {
  tipo: string; preco_por_tonelada: string | number; preco_por_unidade?: string | number | null;
}): PrecoDescarregamento {
  return {
    tipo: row.tipo as DescarregamentoTipo,
    precoPorTonelada: Number(row.preco_por_tonelada),
    precoPorUnidade: row.preco_por_unidade == null ? null : Number(row.preco_por_unidade),
  };
}
```
`mapReceita` — acrescentar os campos na assinatura do row e no retorno:
```ts
export function mapReceita(row: {
  id: string; data: string; fornecedor_id: string;
  fornecedores?: { nome: string } | { nome: string }[] | null;
  peso_kg: string | number; tipo: string;
  preco_por_tonelada: string | number; receita: string | number;
  minimo_aplicado: string | number; observacao: string | null;
  quantidade?: string | number | null; preco_por_unidade?: string | number | null;
}): Receita {
  const forn = Array.isArray(row.fornecedores) ? row.fornecedores[0] : row.fornecedores;
  return {
    id: row.id,
    data: row.data,
    fornecedorId: row.fornecedor_id,
    fornecedorNome: forn?.nome ?? "—",
    pesoKg: Number(row.peso_kg),
    tipo: row.tipo as DescarregamentoTipo,
    precoPorTonelada: Number(row.preco_por_tonelada),
    quantidade: row.quantidade == null ? null : Number(row.quantidade),
    precoPorUnidade: row.preco_por_unidade == null ? null : Number(row.preco_por_unidade),
    receita: Number(row.receita),
    minimoAplicado: Number(row.minimo_aplicado),
    observacao: row.observacao,
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run receitas-metrics mappers && npx tsc --noEmit`
Expected: PASS; tsc limpo.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/receitas-metrics.ts src/domain/receitas-metrics.test.ts src/data/mappers.ts src/data/mappers.test.ts
git commit -m "feat(receitas): forma de dados e cálculo do Volume"
```

---

### Task 4: Gravação (server actions de receita e de preços)

**Files:**
- Modify: `src/data/receitas.ts` (`COLS`, `parseForm`, `criarReceita`, `editarReceita`)
- Modify: `src/data/precos-descarregamento.ts` (`listarPrecos`, `editarPreco`)

**Interfaces:**
- Consumes: `calcularReceitaVolume` (Task 3), `TIPOS_DESCARREGAMENTO`.
- Produces: gravação correta por tipo; `listarPrecos` devolve `precoPorUnidade`.

- [ ] **Step 1: Ler o guia de server actions do Next**

Conferir `node_modules/next/dist/docs/` sobre server actions e confirmar que o padrão atual de `receitas.ts` segue válido.

- [ ] **Step 2: `receitas.ts` — colunas, parse e cálculo por tipo**

`COLS` (linha ~13) passa a trazer as colunas novas:
```ts
const COLS =
  "id, data, fornecedor_id, peso_kg, tipo, preco_por_tonelada, quantidade, preco_por_unidade, receita, minimo_aplicado, observacao, fornecedores(nome)";
```
`parseForm` (linha ~82):
```ts
function parseForm(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const fornecedorId = String(formData.get("fornecedor_id") ?? "");
  const pesoKg = Number(formData.get("peso_kg") ?? 0);
  const tipo = String(formData.get("tipo") ?? "batido") as DescarregamentoTipo;
  const precoPorTonelada = Number(formData.get("preco_por_tonelada") ?? 0);
  const quantidade = Number(formData.get("quantidade") ?? 0);
  const precoPorUnidade = Number(formData.get("preco_por_unidade") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  return { data, fornecedorId, pesoKg, tipo, precoPorTonelada, quantidade, precoPorUnidade, observacao };
}
```
Importar `calcularReceitaVolume` (juntar ao import de `calcularReceita`):
```ts
import { calcularReceita, calcularReceitaVolume } from "@/domain/receitas-metrics";
```
Uma função compartilhada para valor + colunas (evita duplicar a ramificação em criar e editar). Adicionar acima de `criarReceita`:
```ts
/** Valor e colunas gravadas, ramificando Volume × tipos por peso. */
function calcularEColunas(f: ReturnType<typeof parseForm>, valorMinimo: number) {
  const ehVolume = f.tipo === "volume";
  const receita = ehVolume
    ? calcularReceitaVolume(f.quantidade, f.precoPorUnidade, valorMinimo)
    : calcularReceita(f.pesoKg, f.precoPorTonelada, valorMinimo);
  return {
    data: f.data,
    fornecedor_id: f.fornecedorId,
    peso_kg: f.pesoKg,
    tipo: f.tipo,
    preco_por_tonelada: ehVolume ? 0 : f.precoPorTonelada,
    quantidade: ehVolume ? f.quantidade : null,
    preco_por_unidade: ehVolume ? f.precoPorUnidade : null,
    receita,
    minimo_aplicado: valorMinimo,
    observacao: f.observacao,
  };
}
```
`criarReceita` (linha ~92) usa a função e valida a quantidade do Volume:
```ts
export async function criarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  if (!f.data || !f.fornecedorId || !f.pesoKg) return;
  if (f.tipo === "volume" && !f.quantidade) return; // Volume exige nº de caixas
  const { valorMinimo } = await lerConfig();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").insert(calcularEColunas(f, valorMinimo));
  if (error) throw new Error(error.message);
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}
```
`editarReceita` (linha ~115), mesma ideia:
```ts
export async function editarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !f.data || !f.fornecedorId || !f.pesoKg) return;
  if (f.tipo === "volume" && !f.quantidade) return;
  const { valorMinimo } = await lerConfig();
  const supabase = await createClient();
  const { error } = await supabase
    .from("receitas_descarregamento")
    .update(calcularEColunas(f, valorMinimo))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}
```

- [ ] **Step 3: `precos-descarregamento.ts` — ler e gravar o preço/caixa**

`listarPrecos` (linha ~9):
```ts
export async function listarPrecos(): Promise<PrecoDescarregamento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("precos_descarregamento")
    .select("tipo, preco_por_tonelada, preco_por_unidade")
    .order("tipo");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPreco);
}
```
`editarPreco` (linha ~19) — grava a coluna certa por tipo:
```ts
export async function editarPreco(formData: FormData): Promise<void> {
  await assertAdmin();
  const tipo = String(formData.get("tipo") ?? "") as DescarregamentoTipo;
  const raw = formData.get("preco");
  if (!tipo || raw === null || String(raw).trim() === "") return;
  const preco = Number(raw);
  if (Number.isNaN(preco)) return;
  const atualizado_em = new Date().toISOString();
  const patch =
    tipo === "volume"
      ? { preco_por_unidade: preco, atualizado_em }
      : { preco_por_tonelada: preco, atualizado_em };
  const supabase = await createClient();
  const { error } = await supabase.from("precos_descarregamento").update(patch).eq("tipo", tipo);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/precos");
  revalidatePath("/receitas");
}
```

- [ ] **Step 4: Typecheck/lint/build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 5: Commit**

```bash
git add src/data/receitas.ts src/data/precos-descarregamento.ts
git commit -m "feat(receitas): gravação do Volume e do preço/caixa"
```

---

### Task 5: Formulário de lançamento com campos do Volume

**Files:**
- Modify: `src/app/(app)/receitas/descarregamento-form.tsx`

**Interfaces:**
- Consumes: `calcularReceitaVolume` (Task 3); `PrecoDescarregamento.precoPorUnidade`; `criarReceita`/`editarReceita`.

- [ ] **Step 1: Reescrever o componente**

Mantém o comportamento atual dos tipos por peso; quando `tipo === "volume"`, troca "preço/ton" por **Caixas** + **R$/caixa** (o peso continua) e calcula a prévia por caixas.

```tsx
"use client";

import { useState } from "react";
import { criarReceita, editarReceita } from "@/data/receitas";
import { calcularReceita, calcularReceitaVolume, toneladas } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { Fornecedor, PrecoDescarregamento, Receita, DescarregamentoTipo } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

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
  const precoDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorTonelada ?? 0;
  const precoUnidadeDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorUnidade ?? 0;
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<DescarregamentoTipo>(receita?.tipo ?? "batido");
  const [peso, setPeso] = useState(receita?.pesoKg ?? 0);
  const [preco, setPreco] = useState(receita?.precoPorTonelada ?? precoDe("batido"));
  const [quantidade, setQuantidade] = useState(receita?.quantidade ?? 0);
  const [precoUnidade, setPrecoUnidade] = useState(receita?.precoPorUnidade ?? precoUnidadeDe("volume"));

  const ehVolume = tipo === "volume";
  const previa = ehVolume
    ? calcularReceitaVolume(quantidade || 0, precoUnidade || 0, valorMinimo)
    : calcularReceita(peso || 0, preco || 0, valorMinimo);
  const temPrevia = ehVolume ? quantidade > 0 : peso > 0;

  if (!aberto) {
    return receita ? (
      <button onClick={() => setAberto(true)} className="text-sm font-medium text-slate-500 hover:text-[#141a4d]">
        editar
      </button>
    ) : (
      <button
        onClick={() => setAberto(true)}
        className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
      >
        Lançar descarregamento
      </button>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const dataPadrao = receita?.data ?? (hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);

  return (
    <form action={receita ? editarReceita : criarReceita} className="flex flex-wrap items-end gap-2 text-sm">
      {receita && <input type="hidden" name="id" value={receita.id} />}
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <select name="fornecedor_id" required defaultValue={receita?.fornecedorId ?? ""} className={field}>
        <option value="" disabled>
          Fornecedor
        </option>
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </select>
      <input
        name="peso_kg"
        type="number"
        step="0.001"
        min="0"
        required
        placeholder="Peso (kg)"
        value={peso || ""}
        onChange={(e) => setPeso(Number(e.target.value))}
        className={field}
      />
      <select
        name="tipo"
        value={tipo}
        onChange={(e) => {
          const t = e.target.value as DescarregamentoTipo;
          setTipo(t);
          if (t === "volume") setPrecoUnidade(precoUnidadeDe(t));
          else setPreco(precoDe(t));
        }}
        className={field}
      >
        {TIPOS_DESCARREGAMENTO.map((t) => (
          <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
        ))}
      </select>
      {ehVolume ? (
        <>
          <input
            name="quantidade"
            type="number"
            step="1"
            min="1"
            required
            placeholder="Caixas"
            value={quantidade || ""}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            className={field}
          />
          <input
            name="preco_por_unidade"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="R$/caixa"
            value={precoUnidade || ""}
            onChange={(e) => setPrecoUnidade(Number(e.target.value))}
            className={field}
          />
        </>
      ) : (
        <input
          name="preco_por_tonelada"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="R$/ton"
          value={preco || ""}
          onChange={(e) => setPreco(Number(e.target.value))}
          className={field}
        />
      )}
      <input name="observacao" defaultValue={receita?.observacao ?? ""} placeholder="Observação" className={field} />
      <span className="px-2 py-2 text-sm font-semibold text-emerald-700">
        {ehVolume
          ? `${quantidade || 0} cx → ${temPrevia ? formatBRL(previa) : "—"}`
          : `${toneladas(peso || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t → ${temPrevia ? formatBRL(previa) : "—"}`}
      </span>
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        {receita ? "Salvar" : "Adicionar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
      >
        Cancelar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/receitas/descarregamento-form.tsx
git commit -m "feat(receitas): campos de Caixas e R$/caixa no formulário do Volume"
```

---

### Task 6: Página de Preços com preço/caixa do Volume

**Files:**
- Modify: `src/app/(app)/receitas/precos/page.tsx`

**Interfaces:**
- Consumes: `PrecoDescarregamento.precoPorUnidade`; `editarPreco` ramificado (Task 4).

- [ ] **Step 1: Mostrar o preço certo por tipo**

O cabeçalho da coluna passa a "Preço" (serve para ton e caixa); cada linha mostra o valor da sua base e uma etiqueta de unidade. Substituir o `<thead>`/`<tbody>` da tabela de preços (linhas ~21-52):

```tsx
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Tipo</th>
              <th className="px-5 py-3 font-semibold">Preço</th>
            </tr>
          </thead>
          <tbody>
            {precos.map((p) => {
              const ehVolume = p.tipo === "volume";
              const valor = ehVolume ? p.precoPorUnidade ?? 0 : p.precoPorTonelada;
              const unidade = ehVolume ? "/caixa" : "/ton";
              return (
                <tr key={p.tipo} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-[#141a4d]">{ROTULO_TIPO[p.tipo] ?? p.tipo}</td>
                  <td className="px-5 py-3">
                    {admin ? (
                      <form action={editarPreco} className="flex items-center gap-2">
                        <input type="hidden" name="tipo" value={p.tipo} />
                        <input
                          name="preco"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={valor}
                          required
                          className={editInput}
                        />
                        <span className="text-xs text-slate-400">{unidade}</span>
                        <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                      </form>
                    ) : (
                      <span className="tabular-nums text-slate-600">
                        {formatBRL(valor)} <span className="text-slate-400">{unidade}</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
```

Ajustar o subtítulo do `PageHeader` (linha ~17) para não dizer só "por tonelada":
```tsx
      <PageHeader title="Preços" subtitle="Valores globais por tipo de descarregamento (por tonelada; o Volume é por caixa)" />
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/receitas/precos/page.tsx
git commit -m "feat(receitas): preço por caixa do Volume na página de Preços"
```

---

### Task 7: Tabela detalhada mostra a base do Volume

**Files:**
- Modify: `src/app/(app)/receitas/page.tsx` (tabela detalhada, cabeçalho "R$/ton" e a célula de preço)

**Interfaces:**
- Consumes: `Receita.quantidade`/`precoPorUnidade` (Task 3).

- [ ] **Step 1: Renomear o cabeçalho e ramificar a célula**

No `<thead>` da tabela detalhada, trocar o rótulo `R$/ton` por `Preço` (serve para os dois):
```tsx
                    <th className="px-5 py-3 font-semibold">Preço</th>
```
Na linha do `<tbody>`, a célula que hoje é `<td>{formatBRL(r.precoPorTonelada)}</td>` (a coluna de preço) passa a ramificar por tipo:
```tsx
                      <td className="px-5 py-3 tabular-nums text-slate-600">
                        {r.tipo === "volume"
                          ? `${r.quantidade ?? 0} cx × ${formatBRL(r.precoPorUnidade ?? 0)}`
                          : formatBRL(r.precoPorTonelada)}
                      </td>
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/receitas/page.tsx
git commit -m "feat(receitas): base do Volume (caixas × preço) na tabela detalhada"
```

---

### Task 8: Export CSV inclui a base do Volume

**Files:**
- Modify: `src/app/(app)/receitas/export/route.ts`

**Interfaces:**
- Consumes: `Receita.quantidade`/`precoPorUnidade`.

- [ ] **Step 1: Ramificar as linhas de descarregamento por tipo**

Substituir o bloco `linhasDesc` (linhas ~38-52). No Volume, `Quantidade` = nº de caixas e `Preço unitário` = R$/caixa; `Preço/ton` fica em branco.

```ts
  const linhasDesc = receitas.map((r) => ({
    data: r.data,
    campos: [
      "Descarregamento",
      r.data,
      esc(r.fornecedorNome),
      num(r.pesoKg),
      num(toneladas(r.pesoKg)),
      ROTULO_TIPO[r.tipo] ?? r.tipo,
      r.tipo === "volume" ? "" : num(r.precoPorTonelada),                        // Preço/ton
      num(r.minimoAplicado),                                                     // Mínimo aplicado
      "",                                                                        // Material
      r.tipo === "volume" && r.quantidade !== null ? String(r.quantidade) : "", // Quantidade (caixas)
      r.tipo === "volume" && r.precoPorUnidade !== null ? num(r.precoPorUnidade) : "", // Preço unitário (R$/caixa)
      num(r.receita),
    ],
  }));
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/receitas/export/route.ts
git commit -m "feat(receitas): CSV inclui caixas e R$/caixa do Volume"
```

---

## Notas de verificação final

- `npm test` — suíte verde (só o `mapCustoMensal` pré-existente falha).
- `npm run lint && npm run build` — sem erros.
- Verificação visual (após o Pedro aplicar a 0015): lançar um descarrego **Volume** (peso + caixas + R$/caixa), conferir a prévia, o card **Descarregamento** e o **peso total** subindo, o **R$/ton** NÃO mudando, a barra **Volume** em "Receita por tipo", a base "N cx × R$Y" na tabela detalhada, o preço/caixa na página de Preços, e a linha no CSV.
