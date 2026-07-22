# Receitas Diversas (venda de reciclagem) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir lançar receitas que não vêm de descarregamento — hoje a venda do plástico dos filmes stretch — somando ao custo líquido logístico sem contaminar os indicadores por tonelada.

**Architecture:** Tabela nova `receitas_diversas` com categoria extensível (enum `receita_categoria`, hoje só `reciclagem`), espelhando a estrutura já existente de descarregamento em domínio (`src/domain/`), dados (`src/data/`) e tela (seção nova em `/receitas`). O `valor` gravado é a fonte da verdade — quantidade e preço unitário são o memorial de como se chegou nele.

**Tech Stack:** Next.js 16.2.10 (App Router, Server Actions, convenção `proxy.ts`), Supabase (Postgres + RLS), TypeScript, Tailwind, Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-22-receitas-diversas-design.md` — ler antes de começar.
- **Next 16:** APIs diferem do treinamento. Consultar `node_modules/next/dist/docs/` antes de usar API nova. `middleware` foi renomeado para `proxy`.
- **Identidade visual:** verde (`emerald`) SÓ para valores de receita. Nunca para status, categoria ou tipo. Paleta do projeto: navy `#181d55` / `#141a4d`, âmbar/gold, slate.
- **RLS:** toda tabela nova tem `enable row level security`, `select` para `authenticated`, escrita só com `public.is_admin()`.
- **Escritas:** toda Server Action de escrita começa com `await assertAdmin()` e termina revalidando `/receitas`, `/custos` e `/`.
- **Cálculo no servidor:** o cliente nunca define o que é gravado sem validação. Exceção deliberada: o `valor` informado é aceito (é o dado negociado), mas validado como número finito > 0.
- **Idioma:** identificadores e comentários em português, como o resto do `src/`.
- **Commits:** um por tarefa, mensagem em português no padrão `tipo(escopo): descrição`.
- **Rodar testes:** `npx vitest run <arquivo>` para um arquivo, `npx vitest run` para tudo.
- **Falha pré-existente:** `src/data/mappers.test.ts` tem 1 teste falhando (`mapeia lançamento mensal`) desde antes deste trabalho. Não é regressão; não tentar consertar aqui.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0009_receitas_diversas.sql` | Enum, tabela, índice, RLS |
| `src/domain/types.ts` (modificar) | `ReceitaCategoria`, `ReceitaDiversa` |
| `src/domain/receitas-diversas.ts` (criar) | Ordem canônica das categorias e rótulos |
| `src/domain/receitas-metrics.ts` (modificar) | `calcularValorDiversa`, `valorTotalDiversas` |
| `src/domain/receitas-metrics.test.ts` (modificar) | Testes das funções novas + regressão do médio/ton |
| `src/data/mappers.ts` (modificar) | `mapReceitaDiversa` |
| `src/data/receitas-diversas.ts` (criar) | Queries e Server Actions das diversas |
| `src/data/receitas.ts` (modificar) | `receitaTotalDoMes` e `serieReceitasMensais` somam as duas origens |
| `src/app/(app)/receitas/diversa-form.tsx` (criar) | Formulário criar/editar |
| `src/app/(app)/receitas/page.tsx` (modificar) | Seção "Outras receitas", hero somando, StatCards de origem |
| `src/app/(app)/receitas/export/route.ts` (modificar) | CSV único com coluna `origem` |

---

### Task 1: Migration da tabela `receitas_diversas`

**Files:**
- Create: `supabase/migrations/0009_receitas_diversas.sql`

**Interfaces:**
- Consumes: função `public.is_admin()` (criada em `0003_roles.sql`)
- Produces: tabela `receitas_diversas` e tipo `receita_categoria`, consumidos pelas tasks 4 e 5

- [ ] **Step 1: Escrever a migration**

```sql
-- Receitas que não vêm de descarregamento. A primeira é a venda de material de
-- reciclagem (o plástico que sobra dos filmes stretch da paletização).
--
-- `valor` é a fonte da verdade: é o dinheiro que entrou. `quantidade` e
-- `preco_unitario` são o memorial de como se chegou nele e PODEM divergir do
-- produto exato (arredondamento de conversa, desconto, ajuste na balança).
--
-- Extensão futura: adicionar um tipo de receita custa um
-- `alter type receita_categoria add value 'x'`, sem tabela nem página nova.

create type receita_categoria as enum ('reciclagem');

create table receitas_diversas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  categoria receita_categoria not null,
  material text,                  -- livre: "Plástico stretch"
  quantidade numeric(14,3),       -- nullable: nem toda receita é por quantidade
  unidade text not null default 'kg',
  preco_unitario numeric(14,2),   -- nullable, pelo mesmo motivo
  valor numeric(14,2) not null,
  observacao text,
  created_at timestamptz not null default now()
);

create index receitas_div_data_idx on receitas_diversas(data);

alter table receitas_diversas enable row level security;

-- RLS no padrão do projeto: leitura para logado, escrita só admin.
create policy "read receitas_diversas" on receitas_diversas
  for select to authenticated using (true);
create policy "write receitas_diversas" on receitas_diversas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Conferir que o SQL não referencia nada inexistente**

Run: `grep -n "is_admin" supabase/migrations/0003_roles.sql`
Expected: pelo menos uma linha definindo `function public.is_admin()`. Se não aparecer, PARE e reporte — a migration depende dela.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_receitas_diversas.sql
git commit -m "feat(receitas): migration da tabela de receitas diversas"
```

> **NOTA PARA O PEDRO (não é passo do agente):** esta migration precisa ser rodada no SQL editor do Supabase. Até lá a tela nova quebra ao carregar. Ver a seção "Aplicação" no fim deste plano.

---

### Task 2: Tipos e rótulos de categoria

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/receitas-diversas.ts`

**Interfaces:**
- Produces:
  - `type ReceitaCategoria = "reciclagem"`
  - `interface ReceitaDiversa { id: string; data: string; categoria: ReceitaCategoria; material: string | null; quantidade: number | null; unidade: string; precoUnitario: number | null; valor: number; observacao: string | null }`
  - `const CATEGORIAS_RECEITA: readonly ReceitaCategoria[]`
  - `const ROTULO_CATEGORIA: Record<ReceitaCategoria, string>`

- [ ] **Step 1: Adicionar os tipos em `src/domain/types.ts`**

Inserir logo após a interface `Receita` (que termina com `observacao: string | null; }`):

```typescript
export type ReceitaCategoria = "reciclagem";

/**
 * Receita que não vem de descarregamento. `valor` é a fonte da verdade — o
 * dinheiro que entrou. `quantidade` e `precoUnitario` são o memorial de como se
 * chegou nele e podem divergir do produto exato.
 */
export interface ReceitaDiversa {
  id: string;
  data: string; // ISO "yyyy-mm-dd"
  categoria: ReceitaCategoria;
  material: string | null;
  quantidade: number | null;
  unidade: string;
  precoUnitario: number | null;
  valor: number;
  observacao: string | null;
}
```

- [ ] **Step 2: Criar `src/domain/receitas-diversas.ts`**

```typescript
import type { ReceitaCategoria } from "./types";

/** Ordem canônica das categorias — usada em selects e quebras. */
export const CATEGORIAS_RECEITA = [
  "reciclagem",
] as const satisfies readonly ReceitaCategoria[];

/**
 * Rótulos de exibição. `Record` sobre o union: ao adicionar uma categoria nova,
 * o TypeScript aponta este objeto e todos os outros que mapeiam o union completo.
 */
export const ROTULO_CATEGORIA: Record<ReceitaCategoria, string> = {
  reciclagem: "Reciclagem",
};

/** Sugestões do datalist de material. Não é cadastro — só atalho de digitação. */
export const MATERIAIS_SUGERIDOS = [
  "Plástico stretch",
  "Papelão",
  "Pallet quebrado",
];
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem saída (sucesso). Se acusar erro em outro arquivo, PARE e reporte.

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts src/domain/receitas-diversas.ts
git commit -m "feat(receitas): tipos e rótulos de categoria das receitas diversas"
```

---

### Task 3: Funções de domínio + regressão do médio por tonelada

**Files:**
- Modify: `src/domain/receitas-metrics.ts`
- Test: `src/domain/receitas-metrics.test.ts`

**Interfaces:**
- Consumes: `ReceitaDiversa` (Task 2), `arredonda2` (já existe no arquivo)
- Produces:
  - `calcularValorDiversa(quantidade: number, precoUnitario: number): number`
  - `valorTotalDiversas(ds: ReceitaDiversa[]): number`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar no fim de `src/domain/receitas-metrics.test.ts`, ANTES do `});` que fecha o `describe` externo. Também adicionar `calcularValorDiversa, valorTotalDiversas` ao import de `./receitas-metrics` e `ReceitaDiversa` ao import de `./types` no topo do arquivo.

```typescript
  const d = (over: Partial<ReceitaDiversa>): ReceitaDiversa => ({
    id: "d1", data: "2026-07-10", categoria: "reciclagem",
    material: "Plástico stretch", quantidade: 100, unidade: "kg",
    precoUnitario: 1.2, valor: 120, observacao: null, ...over,
  });

  it("calcula o valor sugerido de uma receita diversa", () => {
    expect(calcularValorDiversa(100, 1.2)).toBe(120);
  });

  it("arredonda o valor sugerido a centavos", () => {
    // 33,3 kg × 1,17 = 38,961 → 38,96
    expect(calcularValorDiversa(33.3, 1.17)).toBe(38.96);
  });

  it("não aplica piso mínimo em receita diversa (regra é de descarregamento)", () => {
    expect(calcularValorDiversa(1, 0.5)).toBe(0.5);
  });

  it("soma o valor GRAVADO, não o recalculado de quantidade × preço", () => {
    // Valor negociado (110) difere do produto (120): manda o negociado.
    const negociado = d({ quantidade: 100, precoUnitario: 1.2, valor: 110 });
    expect(valorTotalDiversas([negociado])).toBe(110);
  });

  it("soma várias diversas de forma estável", () => {
    expect(valorTotalDiversas([d({ valor: 10.1 }), d({ valor: 20.2 })])).toBe(30.3);
  });

  it("receita diversa NÃO contamina os indicadores de descarregamento", () => {
    // A armadilha central da spec: valor médio/tonelada tem que ignorar
    // receita que não veio de tonelada nenhuma.
    const descarregamentos = [r({ pesoKg: 10000, receita: 200 })];
    expect(valorMedioPorTonelada(descarregamentos)).toBe(20);
    expect(toneladasTotal(descarregamentos)).toBe(10);
    expect(receitaTotal(descarregamentos)).toBe(200);
  });
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `npx vitest run src/domain/receitas-metrics.test.ts`
Expected: FAIL — `calcularValorDiversa is not a function` (ou erro de import não resolvido).

- [ ] **Step 3: Implementar em `src/domain/receitas-metrics.ts`**

Adicionar `ReceitaDiversa` ao import de `./types` no topo, e as funções no fim do arquivo:

```typescript
/**
 * Valor SUGERIDO de uma receita diversa = quantidade × preço unitário.
 * Só sugere: o valor gravado é o negociado e pode divergir de propósito.
 * Sem piso mínimo — isso é regra de descarregamento.
 */
export function calcularValorDiversa(quantidade: number, precoUnitario: number): number {
  return arredonda2(quantidade * precoUnitario);
}

/** Soma o valor gravado das receitas diversas — nunca o recalculado. */
export function valorTotalDiversas(ds: ReceitaDiversa[]): number {
  return arredonda2(ds.reduce((t, d) => t + d.valor, 0));
}
```

- [ ] **Step 4: Rodar os testes para ver passar**

Run: `npx vitest run src/domain/receitas-metrics.test.ts`
Expected: PASS, todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add src/domain/receitas-metrics.ts src/domain/receitas-metrics.test.ts
git commit -m "feat(receitas): cálculo e soma de receitas diversas"
```

---

### Task 4: Mapper e camada de dados

**Files:**
- Modify: `src/data/mappers.ts`
- Create: `src/data/receitas-diversas.ts`

**Interfaces:**
- Consumes: `ReceitaDiversa`, `ReceitaCategoria` (Task 2); `calcularValorDiversa` (Task 3); tabela `receitas_diversas` (Task 1); `assertAdmin` de `./auth`; `inicioFimDoMes`, `primeiroDiaDoMes` de `@/domain/periodo`
- Produces:
  - `mapReceitaDiversa(row): ReceitaDiversa`
  - `listarDiversasDoMes(mes: string): Promise<ReceitaDiversa[]>`
  - `totalDiversasDoMes(mes: string): Promise<number>`
  - `serieDiversasMensais(): Promise<{ mes: string; valor: number }[]>`
  - `criarDiversa(formData: FormData): Promise<void>`
  - `editarDiversa(formData: FormData): Promise<void>`
  - `removerDiversa(id: string): Promise<void>`

- [ ] **Step 1: Adicionar o mapper em `src/data/mappers.ts`**

Adicionar `ReceitaDiversa, ReceitaCategoria` ao import de tipos no topo do arquivo, e a função após `mapReceita`:

```typescript
export function mapReceitaDiversa(row: {
  id: string; data: string; categoria: string;
  material: string | null; quantidade: string | number | null;
  unidade: string; preco_unitario: string | number | null;
  valor: string | number; observacao: string | null;
}): ReceitaDiversa {
  return {
    id: row.id,
    data: row.data,
    categoria: row.categoria as ReceitaCategoria,
    material: row.material,
    // null é significativo (receita sem quantidade), então não vira 0.
    quantidade: row.quantidade === null ? null : Number(row.quantidade),
    unidade: row.unidade,
    precoUnitario: row.preco_unitario === null ? null : Number(row.preco_unitario),
    valor: Number(row.valor),
    observacao: row.observacao,
  };
}
```

- [ ] **Step 2: Criar `src/data/receitas-diversas.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapReceitaDiversa } from "./mappers";
import { assertAdmin } from "./auth";
import { calcularValorDiversa } from "@/domain/receitas-metrics";
import { inicioFimDoMes, primeiroDiaDoMes } from "@/domain/periodo";
import type { ReceitaDiversa, ReceitaCategoria } from "@/domain/types";

const COLS =
  "id, data, categoria, material, quantidade, unidade, preco_unitario, valor, observacao";

export async function listarDiversasDoMes(mes: string): Promise<ReceitaDiversa[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receitas_diversas")
    .select(COLS)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapReceitaDiversa(row as Parameters<typeof mapReceitaDiversa>[0]));
}

export async function totalDiversasDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receitas_diversas")
    .select("valor")
    .gte("data", inicio)
    .lte("data", fim);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((t, d) => t + Number(d.valor), 0);
}

export async function serieDiversasMensais(): Promise<{ mes: string; valor: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("receitas_diversas").select("data, valor");
  if (error) throw new Error(error.message);
  const porMes = new Map<string, number>();
  for (const d of data ?? []) {
    const mes = primeiroDiaDoMes(String(d.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(d.valor));
  }
  return [...porMes.entries()].map(([mes, valor]) => ({ mes, valor }));
}

function parseForm(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "reciclagem") as ReceitaCategoria;
  const material = String(formData.get("material") ?? "").trim() || null;
  const quantidade = Number(formData.get("quantidade") ?? 0);
  const precoUnitario = Number(formData.get("preco_unitario") ?? 0);
  const valorBruto = formData.get("valor");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  // O valor informado é o negociado e manda sobre o produto. Só cai no cálculo
  // quando não veio nada — nunca sobrescreve um valor válido do usuário.
  const valorInformado = Number(valorBruto ?? NaN);
  const valor = Number.isFinite(valorInformado) && valorInformado > 0
    ? valorInformado
    : calcularValorDiversa(quantidade, precoUnitario);

  return { data, categoria, material, quantidade, precoUnitario, valor, observacao };
}

/** Campos gravados no banco, compartilhados por criar e editar. */
function toRow(f: ReturnType<typeof parseForm>) {
  return {
    data: f.data,
    categoria: f.categoria,
    material: f.material,
    quantidade: f.quantidade || null,
    unidade: "kg",
    preco_unitario: f.precoUnitario || null,
    valor: f.valor,
    observacao: f.observacao,
  };
}

function revalidar() {
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function criarDiversa(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  if (!f.data || !f.valor) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_diversas").insert(toRow(f));
  if (error) throw new Error(error.message);
  revalidar();
}

export async function editarDiversa(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !f.data || !f.valor) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_diversas").update(toRow(f)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

export async function removerDiversa(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_diversas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem saída.

- [ ] **Step 4: Commit**

```bash
git add src/data/mappers.ts src/data/receitas-diversas.ts
git commit -m "feat(receitas): camada de dados das receitas diversas"
```

---

### Task 5: Somar as duas origens no total do mês

**Files:**
- Modify: `src/data/receitas.ts:36-60` (funções `receitaTotalDoMes` e `serieReceitasMensais`)

**Interfaces:**
- Consumes: `totalDiversasDoMes`, `serieDiversasMensais` (Task 4)
- Produces: `receitaTotalDoMes` e `serieReceitasMensais` com semântica nova (as duas origens). Assinaturas não mudam — os três consumidores existentes não precisam de alteração.

- [ ] **Step 1: Adicionar o import no topo de `src/data/receitas.ts`**

Após a linha `import { lerConfig } from "./config-descarregamento";`:

```typescript
import { totalDiversasDoMes, serieDiversasMensais } from "./receitas-diversas";
```

- [ ] **Step 2: Substituir `receitaTotalDoMes` inteira**

```typescript
/**
 * Receita total do mês: descarregamento + diversas. Alimenta o custo líquido do
 * dashboard, da página de custos e do resultado logístico.
 */
export async function receitaTotalDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const [descarregamento, diversas] = await Promise.all([
    supabase
      .from("receitas_descarregamento")
      .select("receita")
      .gte("data", inicio)
      .lte("data", fim),
    totalDiversasDoMes(mes),
  ]);
  if (descarregamento.error) throw new Error(descarregamento.error.message);
  const somaDesc = (descarregamento.data ?? []).reduce((t, r) => t + Number(r.receita), 0);
  return somaDesc + diversas;
}
```

- [ ] **Step 3: Substituir `serieReceitasMensais` inteira**

```typescript
/**
 * Série mensal somando as duas origens — precisa bater com o total exibido logo
 * acima do gráfico, senão o usuário vê dois números diferentes para a mesma coisa.
 */
export async function serieReceitasMensais(qtd = 12): Promise<{ mes: string; valor: number }[]> {
  const supabase = await createClient();
  const [desc, diversas] = await Promise.all([
    supabase.from("receitas_descarregamento").select("data, receita"),
    serieDiversasMensais(),
  ]);
  if (desc.error) throw new Error(desc.error.message);
  const porMes = new Map<string, number>();
  for (const r of desc.data ?? []) {
    const mes = primeiroDiaDoMes(String(r.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(r.receita));
  }
  for (const d of diversas) {
    porMes.set(d.mes, (porMes.get(d.mes) ?? 0) + d.valor);
  }
  return [...porMes.entries()]
    .map(([mes, valor]) => ({ mes, valor }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(-qtd);
}
```

- [ ] **Step 4: Verificar que compila e que nada quebrou**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc sem saída; vitest com 1 falha — apenas `mapeia lançamento mensal` em `src/data/mappers.test.ts`, a falha pré-existente. Qualquer outra falha é regressão: PARE e reporte.

- [ ] **Step 5: Commit**

```bash
git add src/data/receitas.ts
git commit -m "feat(receitas): total do mês soma descarregamento e diversas"
```

---

### Task 6: Formulário de receita diversa

**Files:**
- Create: `src/app/(app)/receitas/diversa-form.tsx`

**Interfaces:**
- Consumes: `criarDiversa`, `editarDiversa` (Task 4); `calcularValorDiversa` (Task 3); `MATERIAIS_SUGERIDOS` (Task 2); `formatBRL` de `@/domain/format`
- Produces: `<DiversaForm mes={string} diversa?={ReceitaDiversa} />`

- [ ] **Step 1: Criar o arquivo**

Espelha `descarregamento-form.tsx`: mesmo `field`, mesmo padrão aberto/fechado, mesma alternância criar/editar por prop opcional.

```tsx
"use client";

import { useState } from "react";
import { criarDiversa, editarDiversa } from "@/data/receitas-diversas";
import { calcularValorDiversa } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import { MATERIAIS_SUGERIDOS } from "@/domain/receitas-diversas";
import type { ReceitaDiversa } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function DiversaForm({ mes, diversa }: { mes: string; diversa?: ReceitaDiversa }) {
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState(diversa?.quantidade ?? 0);
  const [preco, setPreco] = useState(diversa?.precoUnitario ?? 0);
  const [valor, setValor] = useState(diversa?.valor ?? 0);
  // Uma vez que o usuário mexe no valor, digitar quantidade/preço não sobrescreve
  // mais o que ele pôs — o negociado manda.
  const [valorTocado, setValorTocado] = useState(Boolean(diversa));

  const sugerido = calcularValorDiversa(quantidade || 0, preco || 0);
  const divergente = valorTocado && valor > 0 && sugerido > 0 && valor !== sugerido;

  function mudarQuantidade(n: number) {
    setQuantidade(n);
    if (!valorTocado) setValor(calcularValorDiversa(n || 0, preco || 0));
  }

  function mudarPreco(n: number) {
    setPreco(n);
    if (!valorTocado) setValor(calcularValorDiversa(quantidade || 0, n || 0));
  }

  if (!aberto) {
    return diversa ? (
      <button onClick={() => setAberto(true)} className="text-sm font-medium text-slate-500 hover:text-[#141a4d]">
        editar
      </button>
    ) : (
      <button
        onClick={() => setAberto(true)}
        className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
      >
        Lançar outra receita
      </button>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const dataPadrao = diversa?.data ?? (hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);

  return (
    <form action={diversa ? editarDiversa : criarDiversa} className="flex flex-wrap items-end gap-2 text-sm">
      {diversa && <input type="hidden" name="id" value={diversa.id} />}
      <input type="hidden" name="categoria" value="reciclagem" />
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <input
        name="material"
        list="materiais-sugeridos"
        defaultValue={diversa?.material ?? ""}
        placeholder="Material"
        className={field}
      />
      <datalist id="materiais-sugeridos">
        {MATERIAIS_SUGERIDOS.map((m) => <option key={m} value={m} />)}
      </datalist>
      <input
        name="quantidade"
        type="number"
        step="0.001"
        min="0"
        placeholder="Quantidade (kg)"
        value={quantidade || ""}
        onChange={(e) => mudarQuantidade(Number(e.target.value))}
        className={field}
      />
      <input
        name="preco_unitario"
        type="number"
        step="0.01"
        min="0"
        placeholder="R$/kg"
        value={preco || ""}
        onChange={(e) => mudarPreco(Number(e.target.value))}
        className={field}
      />
      <input
        name="valor"
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Valor"
        value={valor || ""}
        onChange={(e) => {
          setValorTocado(true);
          setValor(Number(e.target.value));
        }}
        className={field}
      />
      <input name="observacao" defaultValue={diversa?.observacao ?? ""} placeholder="Observação" className={field} />
      {divergente && (
        <span className="px-2 py-2 text-xs text-slate-500">
          calculado: {formatBRL(sugerido)} · dif. {formatBRL(valor - sugerido)}
        </span>
      )}
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        {diversa ? "Salvar" : "Adicionar"}
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

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/receitas/diversa-form.tsx"
git commit -m "feat(receitas): formulário de receita diversa"
```

---

### Task 7: Seção "Outras receitas" na página

**Files:**
- Modify: `src/app/(app)/receitas/page.tsx`

**Interfaces:**
- Consumes: `listarDiversasDoMes`, `removerDiversa` (Task 4); `valorTotalDiversas` (Task 3); `DiversaForm` (Task 6); `ROTULO_CATEGORIA` (Task 2)

- [ ] **Step 1: Ajustar os imports no topo**

Adicionar estes três imports novos:

```typescript
import { listarDiversasDoMes, removerDiversa } from "@/data/receitas-diversas";
import { ROTULO_CATEGORIA } from "@/domain/receitas-diversas";
import { DiversaForm } from "./diversa-form";
```

E acrescentar `valorTotalDiversas` ao import **já existente** de `@/domain/receitas-metrics` (que hoje traz `receitaTotal, toneladasTotal, valorMedioPorTonelada, receitaPorFornecedor, receitaPorTipo, toneladas`). Não criar um segundo import do mesmo módulo.

- [ ] **Step 2: Carregar as diversas junto do resto**

No `Promise.all` existente, adicionar `listarDiversasDoMes(mes)` como último item e `diversas` como última variável desestruturada:

```typescript
  const [receitas, fornecedores, precos, config, serie, admin, diversas] = await Promise.all([
    listarReceitasDoMes(mes, filtros),
    listarFornecedores(),
    listarPrecos(),
    lerConfig(),
    serieReceitasMensais(),
    isAdmin(),
    listarDiversasDoMes(mes),
  ]);
```

- [ ] **Step 3: Calcular os totais das duas origens**

Substituir a linha `const total = receitaTotal(receitas);` por estas três:

```typescript
  const totalDescarregamento = receitaTotal(receitas);
  const totalDiversas = valorTotalDiversas(diversas);
  const total = totalDescarregamento + totalDiversas;
```

- [ ] **Step 4: Trocar o subtítulo e os StatCards do topo**

O subtítulo do `PageHeader` passa de `"Descarregamentos cobrados de fornecedores"` para `"Descarregamentos e outras receitas da operação"`.

O bloco de indicadores passa a ser:

```tsx
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1"><HeroStat label="Receita total" value={formatBRL(total)} /></div>
        <StatCard
          label="Descarregamento"
          value={formatBRL(totalDescarregamento)}
          hint={`${receitas.length} lançamentos · ${fmtTon(tons)}`}
          accent="green"
        />
        <StatCard
          label="Outras receitas"
          value={formatBRL(totalDiversas)}
          hint={`${diversas.length} lançamentos`}
          accent="green"
        />
        <StatCard
          label="Valor médio / tonelada"
          value={formatBRL(medioTon)}
          hint="só descarregamento"
          accent="gold"
        />
      </div>
```

Duas coisas propositais aqui:

- Os `hint` preservam a informação dos dois cartões que saíram ("Toneladas descarregadas" e a contagem de descarregamentos), mantendo a grade em 4 colunas em vez de virar 6 cartões.
- O hint `"só descarregamento"` no valor médio por tonelada documenta a armadilha da spec **na própria tela**, para quem olhar o número daqui a seis meses não achar que ele deveria incluir a reciclagem.

Verde aqui é permitido: são valores de receita, a exceção da regra de identidade.

- [ ] **Step 5: Adicionar a seção nova antes de "Comparação mensal"**

Inserir entre o `</section>` da tabela de descarregamentos e o `{/* Comparação mensal */}`:

```tsx
      {/* Outras receitas */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Outras receitas do mês</SectionTitle>
          {admin && <DiversaForm mes={mes} />}
        </div>
        {diversas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma outra receita no período.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Categoria</th>
                    <th className="px-5 py-3 font-semibold">Material</th>
                    <th className="px-5 py-3 font-semibold">Quantidade</th>
                    <th className="px-5 py-3 font-semibold">R$/kg</th>
                    <th className="px-5 py-3 font-semibold">Valor</th>
                    <th className="px-5 py-3 font-semibold">Obs.</th>
                    {admin && <th className="px-5 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {diversas.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 last:border-0 align-top">
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(d.data)}</td>
                      <td className="px-5 py-3">
                        <Pill tone="navy">{ROTULO_CATEGORIA[d.categoria] ?? d.categoria}</Pill>
                      </td>
                      <td className="px-5 py-3 font-medium text-[#141a4d]">{d.material ?? "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-600">
                        {d.quantidade === null ? "—" : `${formatKg(d.quantidade)}`}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-600">
                        {d.precoUnitario === null ? "—" : formatBRL(d.precoUnitario)}
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{formatBRL(d.valor)}</td>
                      <td className="px-5 py-3 max-w-[16rem] truncate text-slate-500" title={d.observacao ?? ""}>{d.observacao ?? "—"}</td>
                      {admin && (
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-end gap-2">
                            <DiversaForm mes={mes} diversa={d} />
                            <form action={removerDiversa.bind(null, d.id)}>
                              <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
```

- [ ] **Step 6: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem saída.

- [ ] **Step 7: Verificar no navegador**

Subir o preview (`preview_start` com `{name: "dev"}`) e conferir:
1. `/receitas` carrega sem erro no console.
2. Os quatro indicadores do topo aparecem; "Outras receitas" mostra R$ 0,00 com o banco vazio.
3. A seção "Outras receitas do mês" aparece com o texto de vazio.
4. Se a migration da Task 1 ainda não foi aplicada no Supabase, a página vai estourar erro de tabela inexistente — nesse caso PARE e reporte que a migration precisa ser aplicada.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/receitas/page.tsx"
git commit -m "feat(receitas): seção de outras receitas na página"
```

---

### Task 8: Export CSV unificado

**Files:**
- Modify: `src/app/(app)/receitas/export/route.ts`

**Interfaces:**
- Consumes: `listarDiversasDoMes` (Task 4); `ROTULO_CATEGORIA` (Task 2)

- [ ] **Step 1: Reescrever o arquivo inteiro**

```typescript
import { NextRequest } from "next/server";
import { listarReceitasDoMes } from "@/data/receitas";
import { listarDiversasDoMes } from "@/data/receitas-diversas";
import { toneladas } from "@/domain/receitas-metrics";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { ROTULO_TIPO } from "@/domain/descarregamento";
import { ROTULO_CATEGORIA } from "@/domain/receitas-diversas";
import type { DescarregamentoTipo } from "@/domain/types";

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
const num = (n: number) => String(n).replace(".", ",");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mes = sp.get("mes") ? primeiroDiaDoMes(sp.get("mes")!) : primeiroDiaDoMes();
  const fornecedorId = sp.get("fornecedor") || undefined;
  const tipo = (sp.get("tipo") as DescarregamentoTipo) || undefined;

  const [receitas, diversas] = await Promise.all([
    listarReceitasDoMes(mes, { fornecedorId, tipo }),
    listarDiversasDoMes(mes),
  ]);

  // Arquivo único com as duas origens: colunas específicas ficam vazias onde
  // não se aplicam. Decisão do Pedro — facilita jogar tudo numa dinâmica só.
  const header = [
    "Origem", "Data", "Fornecedor", "Peso (kg)", "Peso (t)", "Tipo", "Preço/ton",
    "Mínimo aplicado", "Material", "Quantidade", "Preço unitário", "Valor",
  ];

  const linhasDesc = receitas.map((r) => ({
    data: r.data,
    campos: [
      "Descarregamento",
      r.data,
      esc(r.fornecedorNome),
      num(r.pesoKg),
      num(toneladas(r.pesoKg)),
      ROTULO_TIPO[r.tipo] ?? r.tipo,
      num(r.precoPorTonelada),
      num(r.minimoAplicado),
      "", "", "",
      num(r.receita),
    ],
  }));

  const linhasDiv = diversas.map((d) => ({
    data: d.data,
    campos: [
      // Rótulo da categoria, não string fixa: uma categoria futura sai certa
      // sem ninguém lembrar de editar este arquivo.
      esc(ROTULO_CATEGORIA[d.categoria] ?? d.categoria),
      d.data,
      "", "", "", "", "", "",
      esc(d.material ?? ""),
      d.quantidade === null ? "" : num(d.quantidade),
      d.precoUnitario === null ? "" : num(d.precoUnitario),
      num(d.valor),
    ],
  }));

  const linhas = [...linhasDesc, ...linhasDiv]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((l) => l.campos.join(";"));

  const csv = "﻿" + [header.join(";"), ...linhas].join("\n"); // BOM p/ Excel PT-BR

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receitas-${mes}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Conferir a contagem de colunas**

Cada linha precisa ter exatamente 12 campos, igual ao header. Contar manualmente nos dois arrays: `linhasDesc` tem 8 valores + 3 vazios + 1 = 12; `linhasDiv` tem 2 valores + 6 vazios + 4 = 12. Se não bater, o CSV desalinha silenciosamente no Excel.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem saída.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/receitas/export/route.ts"
git commit -m "feat(receitas): export CSV único com as duas origens"
```

---

### Task 9: Verificação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run`
Expected: 1 falha — apenas `mapeia lançamento mensal` em `src/data/mappers.test.ts`. Qualquer outra é regressão.

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: nenhuma saída de erro.

- [ ] **Step 3: Verificação no navegador (requer migration aplicada)**

Com a migration da Task 1 já rodada no Supabase e logado como admin:
1. Lançar uma receita diversa: 100 kg, R$ 1,20/kg. Conferir que o valor auto-preencheu R$ 120,00.
2. Sobrescrever o valor para 110. Conferir que aparece a nota "calculado: R$ 120,00 · dif. -R$ 10,00".
3. Salvar. Conferir que a linha aparece na tabela com valor R$ 110,00.
4. Conferir que o StatCard "Outras receitas" mostra R$ 110,00 e que "Receita total" cresceu no mesmo valor.
5. Conferir que "Valor médio / tonelada" **não** mudou — esta é a regressão crítica da spec.
6. Ir em `/custos` e no dashboard: o custo líquido deve ter caído R$ 110,00.
7. Baixar o CSV e conferir que a linha de reciclagem aparece com as colunas de descarregamento vazias.
8. Editar o lançamento e remover, conferindo que os totais acompanham.

- [ ] **Step 4: Reportar o resultado**

Relatar o que foi verificado e o que não foi. Não afirmar que algo funciona sem ter rodado.

---

## Aplicação (para o Pedro, fora do plano de código)

1. **Rodar `supabase/migrations/0009_receitas_diversas.sql`** no SQL editor do Supabase. Antes disso, `/receitas` quebra ao carregar (tabela inexistente).
2. **Deploy no servidor Windows** — pela memória do projeto, o servidor está com cópia manual antiga.

## Spec Coverage

| Requisito da spec | Task |
|---|---|
| Tabela `receitas_diversas` + enum + RLS | 1 |
| `ReceitaCategoria`, `ReceitaDiversa`, rótulos | 2 |
| `calcularValorDiversa`, `valorTotalDiversas` | 3 |
| Armadilha do médio/tonelada (teste de regressão) | 3, 9 |
| Mapper e camada de dados, criar/editar/remover | 4 |
| Valor negociado manda; validação no servidor | 4 |
| `receitaTotalDoMes` e série somando as duas origens | 5 |
| Integração com custo líquido (3 consumidores) | 5, 9 |
| Formulário com auto-preenchimento e nota de divergência | 6 |
| Material como datalist livre | 2, 6 |
| Hero somando + StatCards por origem + subtítulo | 7 |
| Seção com lista, editar e remover gated por admin | 7 |
| Export CSV único com coluna origem | 8 |
| Preço médio por kg | — (registrado na spec como decidido e **não** implementado) |
