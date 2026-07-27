# Lançamento por total do dia — descarregamento

## Problema

Hoje cada descarregamento é lançado individualmente em `receitas_descarregamento`,
exigindo fornecedor, tipo (batido/paletizado/pal_rem) e preço/ton; a receita é
calculada no backend aplicando o mínimo de R$25 por descarrego. A assistente
perde muito tempo lançando fornecedor por fornecedor.

O pedido: ao fim do dia, ela lança **direto o total do dia** — nº de
descarregos, peso total e valor total — em vez de N lançamentos. A vista
"Simples" já existe, mas só como *relatório* que agrega os lançamentos
individuais por dia; ela não é uma forma de dar entrada.

## Decisões (alinhadas com o Pedro)

1. **Conviver, dia é um ou outro.** O lançamento detalhado por fornecedor
   continua funcionando. O total do dia é uma forma alternativa de entrada;
   quem quiser detalhar ainda pode. Nada é removido.
2. **"Quantidade total" = número de descarregamentos** (a contagem), batendo
   com a coluna "Descarregos" da vista Simples. Os três campos digitados são:
   **data · nº de descarregos · peso total (kg) · valor total (R$)**. Sem
   fornecedor, sem tipo, sem preço/ton, sem cálculo de mínimo — a assistente
   digita o valor final.
3. **É receita de descarregamento.** O total do dia rola para dentro do card
   "Descarregamento", do peso total e do "Valor médio/tonelada" (peso e valor
   entram no cálculo). É a mesma operação, só agregada.
4. **Dia misto** (raro — detalhado E total no mesmo dia): a vista Simples mostra
   **duas linhas** para essa data (uma só-leitura vinda do detalhado, uma
   editável vinda do total), claramente rotuladas por origem. Sem bloqueio
   rígido impedindo o lançamento.

## Arquitetura

Segue o padrão que o codebase já tem: `receitas_descarregamento` (detalhado) e
`receitas_diversas` são tabelas irmãs, cada uma com seu tipo de domínio, somadas
só no nível dos totais. O total do dia é a **terceira irmã**, análoga.

### 1. Dado — tabela nova `receitas_descarregamento_diario`

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `data` | date not null | |
| `descarregos` | int not null, check `> 0` | nº de descarregos do dia |
| `peso_kg` | numeric(14,3) not null, check `>= 0` | peso total (mesma precisão do detalhado) |
| `receita` | numeric(12,2) not null, check `>= 0` | valor total do dia (digitado) |
| `observacao` | text null | |
| `created_at` | timestamptz not null default now() | |

- Índice em `data` para o recorte por mês.
- RLS espelhando `receitas_descarregamento`: viewer lê, admin escreve
  (SELECT liberado a autenticados; INSERT/UPDATE/DELETE restritos a admin,
  mesmo predicado das policies existentes — replicar da 0009).
- Sem `fornecedor_id`, `tipo`, `preco_por_tonelada` nem `minimo_aplicado`:
  nenhum se aplica a um total agregado. Não reaproveitar a tabela detalhada
  com colunas nuláveis (rejeitado — espalharia `null` pelo tipo `Receita`, lido
  em toda a tela).
- **Numeração da migration:** `0013_receitas_descarregamento_diario.sql`. Neste
  repo a sequência local para em `0009`, mas o projeto de RH aplicou `0010–0012`
  no **mesmo** Supabase compartilhado; `0013` mantém o número único no banco.

### 2. Domínio (`src/domain/`)

Novo tipo em `types.ts`:

```ts
export interface TotalDiarioDescarregamento {
  id: string;
  data: string;        // ISO "yyyy-mm-dd"
  descarregos: number;
  pesoKg: number;
  receita: number;     // valor total digitado
  observacao: string | null;
}
```

Em `receitas-metrics.ts`:

- `DiaDescarregamento` ganha `origem: "detalhado" | "total"` e `id?: string`
  (só as linhas de origem `"total"` carregam id próprio editável).
- `receitaPorDia` passa a receber também os totais diários e produz a lista do
  dia unificada:
  - dias vindos do detalhado: `origem: "detalhado"`, `descarregos` = contagem de
    linhas, `id` ausente (edita-se pela vista Detalhado);
  - dias vindos de total: `origem: "total"`, `descarregos`/`pesoKg`/`receita`
    do registro, `id` presente;
  - se a mesma data existir nas duas origens, saem **duas** entradas (não
    fundir) — preserva o id editável e a rotulagem por origem.
  - ordenação: mais recente primeiro (mantém o comportamento atual).
- `resumoReceitas` passa a receber os totais diários; `totalDescarregamento`,
  `toneladas` e `medioPorTonelada` somam detalhado + totais diários. O tipo
  `Receita` **não muda**.

O tipo `Receita` e o caminho do lançamento detalhado ficam intactos.

### 3. Camada de dados (`src/data/`)

Novo módulo `receitas-diario.ts` (server actions + leitura):

- `listarTotaisDiariosDoMes(mes): Promise<TotalDiarioDescarregamento[]>`
- `criarTotalDiario(formData)` — parse de data/descarregos/peso/valor/obs;
  `assertAdmin()`; insert; `revalidatePath("/receitas" | "/custos" | "/")`.
- `editarTotalDiario(formData)` — idem com `id`.
- `removerTotalDiario(id)` — `assertAdmin()`; delete; revalidate.
- Mapper `mapTotalDiario` em `mappers.ts`.

**Fluxo para o resto do sistema (custo líquido):** `receitaTotalDoMes` e
`serieReceitasMensais` (em `receitas.ts`) passam a somar também os totais
diários, para que o custo líquido do dashboard, da página de custos e do
resultado logístico já incluam essa receita — exatamente como o detalhado e as
diversas fazem hoje.

### 4. UI (`src/app/(app)/receitas/`)

A entrada mora na vista **Simples**, que é literalmente a visão por dia — casa
natural do fluxo da assistente.

- Novo componente `total-diario-form.tsx`: formulário **"Lançar total do dia"**
  (data · nº descarregos · peso · valor), com prévia do que será gravado.
  Reaproveita o padrão visual de `descarregamento-form.tsx`.
- `page.tsx`:
  - Carrega `listarTotaisDiariosDoMes(mes)` junto das demais consultas.
  - Passa os totais diários para `receitaPorDia` e `resumoReceitas`.
  - Na vista **Simples**: mostra o form "Lançar total do dia" (admin); cada
    linha `origem: "total"` ganha *editar/remover*; linhas `origem: "detalhado"`
    seguem só-leitura. Rótulo discreto de origem quando útil (ex.: dia misto).
  - Cards do topo, peso total e R$/ton já refletem detalhado + totais diários.
  - Quebras "por fornecedor" e "por tipo": inalteradas — totais diários não
    aparecem nelas (não têm fornecedor/tipo). Custo aceito de lançar agregado.
- Export CSV (`export/route.ts`): inclui os totais diários, com colunas de
  fornecedor/tipo/preço em branco e um marcador de origem ("total do dia").

### Cores / identidade visual

Verde (emerald) **só** para valores de receita, como já é feito na Simples.
Origem/rótulos usam navy/slate/âmbar, nunca verde.

## Testes

- `receitas-metrics.test.ts`:
  - `receitaPorDia` com só detalhado (comportamento atual preservado);
  - com só totais diários;
  - misto na mesma data → duas entradas, ids/origens corretos;
  - ordenação por data desc.
  - `resumoReceitas` somando as duas origens: `totalDescarregamento`, peso,
    `medioPorTonelada`.
- Mapper `mapTotalDiario` (numéricos vindos como string do Supabase).

## Fora de escopo (YAGNI)

- Bloqueio rígido de dia misto.
- Distribuir o total de volta por fornecedor/tipo.
- Preencher a quebra "por fornecedor"/"por tipo" a partir dos totais diários.
- Qualquer cálculo de mínimo sobre o total do dia (a assistente digita o final).
