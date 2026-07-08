# Módulo de Efetivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o módulo de efetivo (funcionários por setor, com faltas e métricas) como um app web Next.js + Supabase.

**Architecture:** Next.js (App Router, TypeScript) para UI e Server Actions. Supabase (Postgres + Auth + RLS) como banco e autenticação. Uma camada de domínio **pura** (`src/domain`) contém os cálculos de métricas (custo do setor, contagem de faltas) e é 100% testável com Vitest, sem tocar no banco. As queries do Supabase são finas e chamam essa camada.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest + @testing-library/react.

## Global Constraints

- Idioma da interface: **português (BR)**.
- Nomes de tabelas/colunas em português conforme a spec: `setores`, `funcionarios`, `faltas`.
- `custo_mensal`: `numeric(10,2)`, valor único (salário + encargos somados).
- `status` do funcionário: enum `ativo` / `afastado` / `desligado`.
- `tipo` de falta: enum `justificada` / `injustificada` / `atestado` / `folga` / `ferias`.
- Custo do setor considera **apenas** funcionários com `status = 'ativo'`.
- Todo dinheiro exibido em BRL (`R$ 1.234,56`), datas em `dd/mm/aaaa`.
- Package manager: **npm**. Commits frequentes, mensagens em português no padrão `feat:/chore:/test:`.

---

## Estrutura de arquivos

```
src/
  domain/
    types.ts               # tipos de domínio (Funcionario, Setor, Falta, enums)
    metrics.ts             # cálculos puros (custo, headcount, faltas no período)
    metrics.test.ts        # testes unitários da lógica pura
    format.ts              # formatação BRL e datas
    format.test.ts
  lib/
    supabase/
      client.ts            # browser client
      server.ts            # server client (cookies)
      middleware.ts        # refresh de sessão
  app/
    layout.tsx             # layout raiz + nav
    login/page.tsx         # tela de login
    (app)/                 # grupo autenticado
      layout.tsx           # guarda de sessão + shell de navegação
      page.tsx             # dashboard
      setores/page.tsx
      setores/[id]/page.tsx
      funcionarios/page.tsx
      funcionarios/[id]/page.tsx
  data/
    setores.ts             # queries/mutations de setores (Server Actions)
    funcionarios.ts
    faltas.ts
supabase/
  migrations/0001_init.sql # schema: enums + tabelas + RLS
middleware.ts              # entrypoint do middleware Next
```

---

## Task 1: Scaffold do projeto Next.js + ferramentas de teste

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind config`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.gitignore`, `.env.local.example`

**Interfaces:**
- Produces: projeto Next.js rodando, comando `npm test` (Vitest) funcionando.

- [ ] **Step 1: Criar o app Next.js**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Expected: projeto gerado em `src/` com Tailwind e TypeScript.

- [ ] **Step 2: Instalar dependências de teste e Supabase**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configurar Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Sanity test**

Create `src/domain/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test harness", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Rodar o teste**

Run: `npm test`
Expected: PASS (1 teste).

- [ ] **Step 6: Criar `.env.local.example`**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js app com Tailwind e Vitest"
```

---

## Task 2: Tipos de domínio

**Files:**
- Create: `src/domain/types.ts`

**Interfaces:**
- Produces:
  - `type StatusFuncionario = "ativo" | "afastado" | "desligado"`
  - `type TipoFalta = "justificada" | "injustificada" | "atestado" | "folga" | "ferias"`
  - `interface Setor { id: string; nome: string }`
  - `interface Funcionario { id: string; nome: string; cargo: string; setorId: string; custoMensal: number; dataAdmissao: string; status: StatusFuncionario }`
  - `interface Falta { id: string; funcionarioId: string; data: string; tipo: TipoFalta; observacao: string | null }`

- [ ] **Step 1: Escrever os tipos**

Create `src/domain/types.ts`:
```ts
export type StatusFuncionario = "ativo" | "afastado" | "desligado";

export type TipoFalta =
  | "justificada"
  | "injustificada"
  | "atestado"
  | "folga"
  | "ferias";

export interface Setor {
  id: string;
  nome: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  setorId: string;
  custoMensal: number;
  dataAdmissao: string; // ISO date "yyyy-mm-dd"
  status: StatusFuncionario;
}

export interface Falta {
  id: string;
  funcionarioId: string;
  data: string; // ISO date "yyyy-mm-dd"
  tipo: TipoFalta;
  observacao: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: tipos de domínio do efetivo"
```

---

## Task 3: Lógica pura de métricas (TDD)

**Files:**
- Create: `src/domain/metrics.ts`
- Test: `src/domain/metrics.test.ts`

**Interfaces:**
- Consumes: `Funcionario`, `Falta`, `StatusFuncionario` de `@/domain/types`.
- Produces:
  - `custoDoSetor(funcionarios: Funcionario[], setorId: string): number` — soma `custoMensal` dos `ativo` do setor.
  - `headcountPorStatus(funcionarios: Funcionario[], setorId: string): Record<StatusFuncionario, number>`
  - `faltasNoPeriodo(faltas: Falta[], funcionarioIds: string[], inicio: string, fim: string): number` — conta faltas cujo `funcionarioId` está na lista e `inicio <= data <= fim`.

- [ ] **Step 1: Escrever os testes que falham**

Create `src/domain/metrics.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "./metrics";
import type { Funcionario, Falta } from "./types";

const f = (over: Partial<Funcionario>): Funcionario => ({
  id: "1",
  nome: "X",
  cargo: "Operador",
  setorId: "s1",
  custoMensal: 1000,
  dataAdmissao: "2024-01-01",
  status: "ativo",
  ...over,
});

describe("custoDoSetor", () => {
  it("soma apenas ativos do setor", () => {
    const funcs = [
      f({ id: "1", setorId: "s1", custoMensal: 1000, status: "ativo" }),
      f({ id: "2", setorId: "s1", custoMensal: 2000, status: "ativo" }),
      f({ id: "3", setorId: "s1", custoMensal: 5000, status: "afastado" }),
      f({ id: "4", setorId: "s2", custoMensal: 9000, status: "ativo" }),
    ];
    expect(custoDoSetor(funcs, "s1")).toBe(3000);
  });

  it("retorna 0 para setor sem ativos", () => {
    expect(custoDoSetor([f({ status: "desligado" })], "s1")).toBe(0);
  });
});

describe("headcountPorStatus", () => {
  it("conta por status dentro do setor", () => {
    const funcs = [
      f({ id: "1", setorId: "s1", status: "ativo" }),
      f({ id: "2", setorId: "s1", status: "ativo" }),
      f({ id: "3", setorId: "s1", status: "afastado" }),
      f({ id: "4", setorId: "s2", status: "ativo" }),
    ];
    expect(headcountPorStatus(funcs, "s1")).toEqual({
      ativo: 2,
      afastado: 1,
      desligado: 0,
    });
  });
});

describe("faltasNoPeriodo", () => {
  const faltas: Falta[] = [
    { id: "1", funcionarioId: "a", data: "2026-07-03", tipo: "injustificada", observacao: null },
    { id: "2", funcionarioId: "a", data: "2026-06-30", tipo: "atestado", observacao: null },
    { id: "3", funcionarioId: "b", data: "2026-07-10", tipo: "folga", observacao: null },
    { id: "4", funcionarioId: "c", data: "2026-07-05", tipo: "ferias", observacao: null },
  ];

  it("conta faltas dos funcionários no intervalo (inclusive)", () => {
    expect(faltasNoPeriodo(faltas, ["a", "b"], "2026-07-01", "2026-07-31")).toBe(2);
  });

  it("exclui funcionário fora da lista", () => {
    expect(faltasNoPeriodo(faltas, ["a"], "2026-07-01", "2026-07-31")).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test`
Expected: FAIL — "custoDoSetor is not defined" / módulo não encontrado.

- [ ] **Step 3: Implementar**

Create `src/domain/metrics.ts`:
```ts
import type { Funcionario, Falta, StatusFuncionario } from "./types";

export function custoDoSetor(funcionarios: Funcionario[], setorId: string): number {
  return funcionarios
    .filter((f) => f.setorId === setorId && f.status === "ativo")
    .reduce((total, f) => total + f.custoMensal, 0);
}

export function headcountPorStatus(
  funcionarios: Funcionario[],
  setorId: string,
): Record<StatusFuncionario, number> {
  const base: Record<StatusFuncionario, number> = {
    ativo: 0,
    afastado: 0,
    desligado: 0,
  };
  for (const f of funcionarios) {
    if (f.setorId === setorId) base[f.status] += 1;
  }
  return base;
}

export function faltasNoPeriodo(
  faltas: Falta[],
  funcionarioIds: string[],
  inicio: string,
  fim: string,
): number {
  const ids = new Set(funcionarioIds);
  return faltas.filter(
    (falta) =>
      ids.has(falta.funcionarioId) && falta.data >= inicio && falta.data <= fim,
  ).length;
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test`
Expected: PASS (todos os testes de metrics).

- [ ] **Step 5: Commit**

```bash
git add src/domain/metrics.ts src/domain/metrics.test.ts
git commit -m "feat: métricas puras do efetivo (custo, headcount, faltas)"
```

---

## Task 4: Formatação (BRL e datas) (TDD)

**Files:**
- Create: `src/domain/format.ts`
- Test: `src/domain/format.test.ts`

**Interfaces:**
- Produces:
  - `formatBRL(valor: number): string` → `"R$ 1.234,56"`
  - `formatDataBR(iso: string): string` → `"08/07/2026"` a partir de `"2026-07-08"`

- [ ] **Step 1: Escrever os testes**

Create `src/domain/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatBRL, formatDataBR } from "./format";

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
  });
  it("formata zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});

describe("formatDataBR", () => {
  it("converte ISO para dd/mm/aaaa", () => {
    expect(formatDataBR("2026-07-08")).toBe("08/07/2026");
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Create `src/domain/format.ts`:
```ts
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(valor: number): string {
  // Intl usa espaço não-quebrável entre "R$" e o número; normalizamos para espaço comum.
  return brl.format(valor).replace(/ /g, " ");
}

export function formatDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/format.ts src/domain/format.test.ts
git commit -m "feat: formatação BRL e datas"
```

---

## Task 5: Schema do banco (migration Supabase)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tabelas `setores`, `funcionarios`, `faltas` com enums e RLS. Colunas em snake_case no banco (`setor_id`, `custo_mensal`, `data_admissao`, `funcionario_id`).

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0001_init.sql`:
```sql
-- Enums
create type status_funcionario as enum ('ativo', 'afastado', 'desligado');
create type tipo_falta as enum ('justificada', 'injustificada', 'atestado', 'folga', 'ferias');

-- Setores
create table setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

-- Funcionários
create table funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text not null,
  setor_id uuid not null references setores(id) on delete restrict,
  custo_mensal numeric(10,2) not null default 0,
  data_admissao date not null,
  status status_funcionario not null default 'ativo',
  created_at timestamptz not null default now()
);
create index funcionarios_setor_id_idx on funcionarios(setor_id);

-- Faltas
create table faltas (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  data date not null,
  tipo tipo_falta not null,
  observacao text,
  created_at timestamptz not null default now()
);
create index faltas_funcionario_id_idx on faltas(funcionario_id);
create index faltas_data_idx on faltas(data);

-- RLS: nesta fase todo usuário autenticado tem acesso total.
alter table setores enable row level security;
alter table funcionarios enable row level security;
alter table faltas enable row level security;

create policy "auth full access setores" on setores
  for all to authenticated using (true) with check (true);
create policy "auth full access funcionarios" on funcionarios
  for all to authenticated using (true) with check (true);
create policy "auth full access faltas" on faltas
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar a migration no projeto Supabase (via SQL Editor do painel, ou `supabase db push` se o CLI estiver configurado). Este passo depende de credenciais e é validado manualmente no checkpoint (ver Task 6).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: schema inicial (setores, funcionarios, faltas) com RLS"
```

---

## Task 6: Clients Supabase + variáveis de ambiente

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `middleware.ts`
- Create: `.env.local` (local, não versionado)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Produces:
  - `createClient()` (browser) de `@/lib/supabase/client`
  - `createClient()` async (server, com cookies) de `@/lib/supabase/server`
  - `updateSession(request)` de `@/lib/supabase/middleware`

- [ ] **Step 1: Browser client**

Create `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Server client**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chamado de Server Component; ignorável quando há middleware.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Middleware de sessão**

Create `src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
```

Create `middleware.ts` (raiz):
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: Criar `.env.local`**

Criar `.env.local` com as credenciais reais do projeto Supabase (copiado de `.env.local.example`). Este arquivo NÃO é versionado.

- [ ] **Step 5: Verificar o build**

Run: `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase middleware.ts .env.local.example
git commit -m "feat: clients Supabase e middleware de sessão"
```

---

## Task 7: Tela de Login + logout

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/(app)/layout.tsx`
- Modify: `src/app/layout.tsx` (metadata/título)

**Interfaces:**
- Consumes: `createClient` (browser) de `@/lib/supabase/client`; `createClient` (server) de `@/lib/supabase/server`.
- Produces: rota `/login` funcional; grupo `(app)` protegido que redireciona sem sessão.

- [ ] **Step 1: Página de login**

Create `src/app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <h1 className="text-xl font-bold text-slate-800">
          Centro de Controle Logística
        </h1>
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-slate-800 py-2 font-medium text-white disabled:opacity-60"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Layout autenticado com nav + logout**

Create `src/app/(app)/layout.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex gap-4 text-sm font-medium text-slate-700">
          <Link href="/">Dashboard</Link>
          <Link href="/setores">Setores</Link>
          <Link href="/funcionarios">Funcionários</Link>
        </nav>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-slate-500 hover:text-slate-800">Sair</button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Rota de signout**

Create `src/app/auth/signout/route.ts`:
```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 5: Checkpoint manual**

Criar um usuário no painel Supabase (Authentication → Add user). Rodar `npm run dev`, acessar `/`, confirmar redirecionamento para `/login`, logar e voltar ao dashboard vazio. Sair e confirmar retorno ao login.

- [ ] **Step 6: Commit**

```bash
git add src/app/login src/app/\(app\)/layout.tsx src/app/auth
git commit -m "feat: login, layout autenticado e logout"
```

---

## Task 8: Data layer + mapeamento (row → domínio)

**Files:**
- Create: `src/data/mappers.ts`
- Test: `src/data/mappers.test.ts`

**Interfaces:**
- Consumes: tipos de `@/domain/types`.
- Produces:
  - `mapSetor(row): Setor`
  - `mapFuncionario(row): Funcionario` — converte snake_case do banco e `custo_mensal` (que vem string do Postgres numeric) para `number`.
  - `mapFalta(row): Falta`

- [ ] **Step 1: Testes de mapeamento**

Create `src/data/mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapFuncionario, mapSetor, mapFalta } from "./mappers";

describe("mapFuncionario", () => {
  it("converte snake_case e custo_mensal string em number", () => {
    const row = {
      id: "u1",
      nome: "João",
      cargo: "Operador",
      setor_id: "s1",
      custo_mensal: "2500.50",
      data_admissao: "2024-03-01",
      status: "ativo",
    };
    expect(mapFuncionario(row)).toEqual({
      id: "u1",
      nome: "João",
      cargo: "Operador",
      setorId: "s1",
      custoMensal: 2500.5,
      dataAdmissao: "2024-03-01",
      status: "ativo",
    });
  });
});

describe("mapSetor", () => {
  it("mapeia setor", () => {
    expect(mapSetor({ id: "s1", nome: "Expedição" })).toEqual({
      id: "s1",
      nome: "Expedição",
    });
  });
});

describe("mapFalta", () => {
  it("mapeia falta com observacao null", () => {
    const row = {
      id: "fa1",
      funcionario_id: "u1",
      data: "2026-07-03",
      tipo: "injustificada",
      observacao: null,
    };
    expect(mapFalta(row)).toEqual({
      id: "fa1",
      funcionarioId: "u1",
      data: "2026-07-03",
      tipo: "injustificada",
      observacao: null,
    });
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar mappers**

Create `src/data/mappers.ts`:
```ts
import type { Setor, Funcionario, Falta, StatusFuncionario, TipoFalta } from "@/domain/types";

export function mapSetor(row: { id: string; nome: string }): Setor {
  return { id: row.id, nome: row.nome };
}

export function mapFuncionario(row: {
  id: string;
  nome: string;
  cargo: string;
  setor_id: string;
  custo_mensal: string | number;
  data_admissao: string;
  status: string;
}): Funcionario {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo,
    setorId: row.setor_id,
    custoMensal: Number(row.custo_mensal),
    dataAdmissao: row.data_admissao,
    status: row.status as StatusFuncionario,
  };
}

export function mapFalta(row: {
  id: string;
  funcionario_id: string;
  data: string;
  tipo: string;
  observacao: string | null;
}): Falta {
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    data: row.data,
    tipo: row.tipo as TipoFalta,
    observacao: row.observacao,
  };
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/mappers.ts src/data/mappers.test.ts
git commit -m "feat: mappers row->domínio"
```

---

## Task 9: CRUD de Setores (Server Actions) + tela

**Files:**
- Create: `src/data/setores.ts`
- Create: `src/app/(app)/setores/page.tsx`
- Create: `src/app/(app)/setores/setor-form.tsx`

**Interfaces:**
- Consumes: `createClient` (server), `mapSetor`, métricas de `@/domain/metrics`.
- Produces:
  - `listarSetores(): Promise<Setor[]>`
  - `criarSetor(formData: FormData): Promise<void>` (Server Action)
  - `excluirSetor(id: string): Promise<void>` (Server Action)

- [ ] **Step 1: Data layer de setores**

Create `src/data/setores.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapSetor } from "./mappers";
import type { Setor } from "@/domain/types";

export async function listarSetores(): Promise<Setor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("setores")
    .select("id, nome")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSetor);
}

export async function criarSetor(formData: FormData): Promise<void> {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("setores").insert({ nome });
  if (error) throw new Error(error.message);
  revalidatePath("/setores");
}

export async function excluirSetor(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("setores").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/setores");
}
```

- [ ] **Step 2: Formulário (client) de novo setor**

Create `src/app/(app)/setores/setor-form.tsx`:
```tsx
"use client";

import { criarSetor } from "@/data/setores";

export function SetorForm() {
  return (
    <form action={criarSetor} className="flex gap-2">
      <input
        name="nome"
        required
        placeholder="Novo setor"
        className="rounded-lg border border-slate-300 px-3 py-2"
      />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">
        Adicionar
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Página de setores com métricas por card**

Create `src/app/(app)/setores/page.tsx`:
```tsx
import Link from "next/link";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";
import { SetorForm } from "./setor-form";

export default async function SetoresPage() {
  const [setores, funcionarios, faltas] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
  ]);
  const { inicio, fim } = inicioFimMesAtual();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Setores</h1>
        <SetorForm />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {setores.map((setor) => {
          const head = headcountPorStatus(funcionarios, setor.id);
          const ids = funcionarios
            .filter((f) => f.setorId === setor.id)
            .map((f) => f.id);
          const totalFaltas = faltasNoPeriodo(faltas, ids, inicio, fim);
          return (
            <Link
              key={setor.id}
              href={`/setores/${setor.id}`}
              className="rounded-xl border bg-white p-4 shadow-sm hover:shadow"
            >
              <h2 className="font-semibold text-slate-800">{setor.nome}</h2>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {formatBRL(custoDoSetor(funcionarios, setor.id))}
              </p>
              <p className="text-sm text-slate-500">
                {head.ativo} ativos · {head.afastado} afastados · {head.desligado} desligados
              </p>
              <p className="text-sm text-slate-500">Faltas no mês: {totalFaltas}</p>
            </Link>
          );
        })}
        {setores.length === 0 && (
          <p className="text-slate-500">Nenhum setor cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Helper de período (mês atual)**

Create `src/domain/periodo.ts`:
```ts
export function inicioFimMesAtual(hoje = new Date()): { inicio: string; fim: string } {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(primeiro), fim: iso(ultimo) };
}
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: build sem erros (depende das Tasks 10 e 11 exportarem `listarFuncionarios` e `listarFaltas` — se executado isoladamente, criar stubs; ao seguir a ordem do plano, Task 10/11 já existem se reordenadas — ver nota).

> **Nota de ordem:** Se executar estritamente em ordem, adiantar os Steps 1 de Task 10 e Task 11 (as funções `listarFuncionarios` e `listarFaltas`) antes do build desta task. Elas são pré-requisito das páginas.

- [ ] **Step 6: Commit**

```bash
git add src/data/setores.ts "src/app/(app)/setores" src/domain/periodo.ts
git commit -m "feat: CRUD de setores com métricas por card"
```

---

## Task 10: CRUD de Funcionários (Server Actions)

**Files:**
- Create: `src/data/funcionarios.ts`

**Interfaces:**
- Consumes: `createClient` (server), `mapFuncionario`.
- Produces:
  - `listarFuncionarios(): Promise<Funcionario[]>`
  - `buscarFuncionario(id: string): Promise<Funcionario | null>`
  - `salvarFuncionario(formData: FormData): Promise<void>` — cria (sem `id`) ou atualiza (com `id`).
  - `excluirFuncionario(id: string): Promise<void>`

- [ ] **Step 1: Implementar data layer**

Create `src/data/funcionarios.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapFuncionario } from "./mappers";
import type { Funcionario } from "@/domain/types";

const COLUNAS = "id, nome, cargo, setor_id, custo_mensal, data_admissao, status";

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("funcionarios").select(COLUNAS).order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFuncionario);
}

export async function buscarFuncionario(id: string): Promise<Funcionario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionarios")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapFuncionario(data) : null;
}

export async function salvarFuncionario(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const registro = {
    nome: String(formData.get("nome") ?? "").trim(),
    cargo: String(formData.get("cargo") ?? "").trim(),
    setor_id: String(formData.get("setor_id") ?? ""),
    custo_mensal: Number(formData.get("custo_mensal") ?? 0),
    data_admissao: String(formData.get("data_admissao") ?? ""),
    status: String(formData.get("status") ?? "ativo"),
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("funcionarios").update(registro).eq("id", id)
    : supabase.from("funcionarios").insert(registro);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/funcionarios");
  revalidatePath("/setores");
  revalidatePath("/");
}

export async function excluirFuncionario(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("funcionarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/funcionarios");
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/data/funcionarios.ts
git commit -m "feat: data layer de funcionários"
```

---

## Task 11: Data layer de Faltas (Server Actions)

**Files:**
- Create: `src/data/faltas.ts`

**Interfaces:**
- Consumes: `createClient` (server), `mapFalta`.
- Produces:
  - `listarFaltas(): Promise<Falta[]>`
  - `faltasDoFuncionario(funcionarioId: string): Promise<Falta[]>`
  - `registrarFalta(formData: FormData): Promise<void>`
  - `excluirFalta(id: string): Promise<void>`

- [ ] **Step 1: Implementar**

Create `src/data/faltas.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapFalta } from "./mappers";
import type { Falta } from "@/domain/types";

const COLUNAS = "id, funcionario_id, data, tipo, observacao";

export async function listarFaltas(): Promise<Falta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("faltas").select(COLUNAS);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFalta);
}

export async function faltasDoFuncionario(funcionarioId: string): Promise<Falta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faltas")
    .select(COLUNAS)
    .eq("funcionario_id", funcionarioId)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFalta);
}

export async function registrarFalta(formData: FormData): Promise<void> {
  const registro = {
    funcionario_id: String(formData.get("funcionario_id") ?? ""),
    data: String(formData.get("data") ?? ""),
    tipo: String(formData.get("tipo") ?? "injustificada"),
    observacao: String(formData.get("observacao") ?? "").trim() || null,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("faltas").insert(registro);
  if (error) throw new Error(error.message);
  revalidatePath(`/funcionarios/${registro.funcionario_id}`);
  revalidatePath("/setores");
}

export async function excluirFalta(id: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faltas")
    .delete()
    .eq("id", id)
    .select("funcionario_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) revalidatePath(`/funcionarios/${data.funcionario_id}`);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/data/faltas.ts
git commit -m "feat: data layer de faltas"
```

---

## Task 12: Tela de Funcionários (lista + filtros + formulário)

**Files:**
- Create: `src/app/(app)/funcionarios/page.tsx`
- Create: `src/app/(app)/funcionarios/funcionario-form.tsx`

**Interfaces:**
- Consumes: `listarFuncionarios`, `salvarFuncionario`, `listarSetores`, `formatBRL`.
- Produces: rota `/funcionarios` com lista filtrável e formulário de criação/edição.

- [ ] **Step 1: Formulário (client) de funcionário**

Create `src/app/(app)/funcionarios/funcionario-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { salvarFuncionario } from "@/data/funcionarios";
import type { Setor, Funcionario } from "@/domain/types";

const STATUS = ["ativo", "afastado", "desligado"] as const;

export function FuncionarioForm({
  setores,
  inicial,
}: {
  setores: Setor[];
  inicial?: Funcionario;
}) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg bg-slate-800 px-4 py-2 text-white"
      >
        {inicial ? "Editar" : "Novo funcionário"}
      </button>
    );
  }
  return (
    <form
      action={salvarFuncionario}
      className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2"
    >
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input name="nome" required defaultValue={inicial?.nome} placeholder="Nome"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="cargo" required defaultValue={inicial?.cargo} placeholder="Cargo"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <select name="setor_id" required defaultValue={inicial?.setorId ?? ""}
        className="rounded-lg border border-slate-300 px-3 py-2">
        <option value="" disabled>Setor…</option>
        {setores.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>
      <input name="custo_mensal" type="number" step="0.01" min="0" required
        defaultValue={inicial?.custoMensal} placeholder="Custo mensal (R$)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="data_admissao" type="date" required
        defaultValue={inicial?.dataAdmissao}
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <select name="status" defaultValue={inicial?.status ?? "ativo"}
        className="rounded-lg border border-slate-300 px-3 py-2">
        {STATUS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <div className="col-span-full flex gap-2">
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">Salvar</button>
        <button type="button" onClick={() => setAberto(false)}
          className="rounded-lg border px-4 py-2 text-slate-600">Cancelar</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Página com lista e filtros (via searchParams)**

Create `src/app/(app)/funcionarios/page.tsx`:
```tsx
import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { formatBRL } from "@/domain/format";
import { FuncionarioForm } from "./funcionario-form";

export default async function FuncionariosPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; status?: string; q?: string }>;
}) {
  const { setor, status, q } = await searchParams;
  const [funcionarios, setores] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
  ]);
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));

  const filtrados = funcionarios.filter((f) => {
    if (setor && f.setorId !== setor) return false;
    if (status && f.status !== status) return false;
    if (q && !f.nome.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Funcionários</h1>
        <FuncionarioForm setores={setores} />
      </div>

      <form className="flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={q} placeholder="Buscar por nome"
          className="rounded-lg border border-slate-300 px-3 py-2" />
        <select name="setor" defaultValue={setor ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Todos os setores</option>
          {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="afastado">Afastado</option>
          <option value="desligado">Desligado</option>
        </select>
        <button className="rounded-lg border px-4 py-2 text-slate-700">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Cargo</th>
              <th className="px-4 py-2">Setor</th>
              <th className="px-4 py-2">Custo mensal</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/funcionarios/${f.id}`} className="font-medium text-slate-800">
                    {f.nome}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{f.cargo}</td>
                <td className="px-4 py-2 text-slate-600">{nomeSetor.get(f.setorId) ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{formatBRL(f.custoMensal)}</td>
                <td className="px-4 py-2 text-slate-600">{f.status}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Nenhum funcionário encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/funcionarios"
git commit -m "feat: tela de funcionários com lista, filtros e formulário"
```

---

## Task 13: Detalhe do Funcionário + gestão de faltas

**Files:**
- Create: `src/app/(app)/funcionarios/[id]/page.tsx`
- Create: `src/app/(app)/funcionarios/[id]/falta-form.tsx`

**Interfaces:**
- Consumes: `buscarFuncionario`, `faltasDoFuncionario`, `registrarFalta`, `excluirFalta`, `listarSetores`, `formatBRL`, `formatDataBR`, `FuncionarioForm`.
- Produces: rota `/funcionarios/[id]` com dados + histórico de faltas (adicionar/remover).

- [ ] **Step 1: Formulário de falta (client)**

Create `src/app/(app)/funcionarios/[id]/falta-form.tsx`:
```tsx
"use client";

import { registrarFalta } from "@/data/faltas";

const TIPOS = ["justificada", "injustificada", "atestado", "folga", "ferias"] as const;

export function FaltaForm({ funcionarioId }: { funcionarioId: string }) {
  return (
    <form action={registrarFalta} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="funcionario_id" value={funcionarioId} />
      <input name="data" type="date" required
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <select name="tipo" defaultValue="injustificada"
        className="rounded-lg border border-slate-300 px-3 py-2">
        {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input name="observacao" placeholder="Observação (opcional)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">
        Registrar falta
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Página de detalhe**

Create `src/app/(app)/funcionarios/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { buscarFuncionario } from "@/data/funcionarios";
import { faltasDoFuncionario, excluirFalta } from "@/data/faltas";
import { listarSetores } from "@/data/setores";
import { formatBRL, formatDataBR } from "@/domain/format";
import { FuncionarioForm } from "../funcionario-form";
import { FaltaForm } from "./falta-form";

export default async function FuncionarioDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [funcionario, setores, faltas] = await Promise.all([
    buscarFuncionario(id),
    listarSetores(),
    faltasDoFuncionario(id),
  ]);
  if (!funcionario) notFound();
  const setor = setores.find((s) => s.id === funcionario.setorId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{funcionario.nome}</h1>
          <p className="text-slate-500">
            {funcionario.cargo} · {setor?.nome ?? "—"} · {funcionario.status}
          </p>
        </div>
        <FuncionarioForm setores={setores} inicial={funcionario} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Custo mensal</p>
          <p className="text-lg font-bold">{formatBRL(funcionario.custoMensal)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Admissão</p>
          <p className="text-lg font-bold">{formatDataBR(funcionario.dataAdmissao)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total de faltas</p>
          <p className="text-lg font-bold">{faltas.length}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Faltas</h2>
        <FaltaForm funcionarioId={funcionario.id} />
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Observação</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {faltas.map((falta) => (
                <tr key={falta.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{formatDataBR(falta.data)}</td>
                  <td className="px-4 py-2">{falta.tipo}</td>
                  <td className="px-4 py-2 text-slate-500">{falta.observacao ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={excluirFalta.bind(null, falta.id)}>
                      <button className="text-sm text-red-600">Remover</button>
                    </form>
                  </td>
                </tr>
              ))}
              {faltas.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Sem faltas registradas.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/funcionarios/[id]"
git commit -m "feat: detalhe do funcionário com gestão de faltas"
```

---

## Task 14: Detalhe do Setor

**Files:**
- Create: `src/app/(app)/setores/[id]/page.tsx`

**Interfaces:**
- Consumes: `listarSetores`, `listarFuncionarios`, `listarFaltas`, métricas, `formatBRL`, `inicioFimMesAtual`.
- Produces: rota `/setores/[id]` com métricas do setor + lista de funcionários.

- [ ] **Step 1: Página de detalhe do setor**

Create `src/app/(app)/setores/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";

export default async function SetorDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [setores, funcionarios, faltas] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
  ]);
  const setor = setores.find((s) => s.id === id);
  if (!setor) notFound();

  const doSetor = funcionarios.filter((f) => f.setorId === id);
  const head = headcountPorStatus(funcionarios, id);
  const { inicio, fim } = inicioFimMesAtual();
  const totalFaltas = faltasNoPeriodo(faltas, doSetor.map((f) => f.id), inicio, fim);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{setor.nome}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Custo total (ativos)</p>
          <p className="text-lg font-bold">{formatBRL(custoDoSetor(funcionarios, id))}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Pessoas</p>
          <p className="text-lg font-bold">
            {head.ativo} ativos · {head.afastado} afastados · {head.desligado} desligados
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Faltas no mês</p>
          <p className="text-lg font-bold">{totalFaltas}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Cargo</th>
              <th className="px-4 py-2">Custo mensal</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {doSetor.map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/funcionarios/${f.id}`} className="font-medium text-slate-800">
                    {f.nome}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{f.cargo}</td>
                <td className="px-4 py-2 text-slate-600">{formatBRL(f.custoMensal)}</td>
                <td className="px-4 py-2 text-slate-600">{f.status}</td>
              </tr>
            ))}
            {doSetor.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                Nenhum funcionário neste setor.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/setores/[id]"
git commit -m "feat: detalhe do setor com métricas e lista"
```

---

## Task 15: Dashboard

**Files:**
- Create: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `listarFuncionarios`, `listarSetores`, `listarFaltas`, métricas, `formatBRL`, `inicioFimMesAtual`.
- Produces: rota `/` (dashboard) com totais gerais e cards por setor.

- [ ] **Step 1: Página do dashboard**

Create `src/app/(app)/page.tsx`:
```tsx
import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";

export default async function Dashboard() {
  const [funcionarios, setores, faltas] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarFaltas(),
  ]);
  const { inicio, fim } = inicioFimMesAtual();

  const ativos = funcionarios.filter((f) => f.status === "ativo");
  const custoTotal = ativos.reduce((t, f) => t + f.custoMensal, 0);
  const faltasMes = faltasNoPeriodo(faltas, funcionarios.map((f) => f.id), inicio, fim);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Funcionários ativos</p>
          <p className="text-2xl font-bold">{ativos.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Custo total do efetivo</p>
          <p className="text-2xl font-bold">{formatBRL(custoTotal)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Faltas no mês</p>
          <p className="text-2xl font-bold">{faltasMes}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Por setor</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {setores.map((setor) => {
            const ids = funcionarios.filter((f) => f.setorId === setor.id).map((f) => f.id);
            return (
              <Link key={setor.id} href={`/setores/${setor.id}`}
                className="rounded-xl border bg-white p-4 shadow-sm hover:shadow">
                <h3 className="font-semibold text-slate-800">{setor.nome}</h3>
                <p className="mt-2 text-lg font-bold">{formatBRL(custoDoSetor(funcionarios, setor.id))}</p>
                <p className="text-sm text-slate-500">
                  Faltas no mês: {faltasNoPeriodo(faltas, ids, inicio, fim)}
                </p>
              </Link>
            );
          })}
          {setores.length === 0 && (
            <p className="text-slate-500">Cadastre setores para ver os números aqui.</p>
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build e testes**

Run: `npm run build && npm test`
Expected: build sem erros; todos os testes PASS.

- [ ] **Step 3: Checkpoint manual (fluxo ponta a ponta)**

Rodar `npm run dev`. Logar, criar 2 setores, criar funcionários em cada, registrar faltas, e conferir que dashboard, detalhe do setor e detalhe do funcionário mostram os números corretos (custo só de ativos, faltas do mês).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: dashboard com totais gerais e cards por setor"
```

---

## Self-Review (cobertura da spec)

- **Modelo de dados (setores/funcionarios/faltas + enums):** Task 5. ✅
- **Valor único custo_mensal:** Task 5 (numeric) + Task 8 (map para number). ✅
- **Login e-mail/senha, acesso total autenticado, RLS:** Tasks 5, 6, 7. ✅
- **Métricas (custo do setor só ativos, headcount, faltas no mês):** Task 3 (puro, testado) usado nas Tasks 9, 14, 15. ✅
- **Tela Login:** Task 7. **Dashboard:** Task 15. **Setores (lista/CRUD):** Task 9. **Detalhe Setor:** Task 14. **Funcionários (lista/filtro/CRUD):** Tasks 10, 12. **Detalhe Funcionário + faltas:** Tasks 11, 13. ✅
- **Formatação BRL/data:** Task 4. ✅
- **Fora de escopo (custos, rendimentos, permissões granulares, alertas):** não incluídos. ✅

Dependência de ordem observada em Task 9 (precisa de `listarFuncionarios`/`listarFaltas` das Tasks 10/11) — nota adicionada no Step 5 da Task 9.
