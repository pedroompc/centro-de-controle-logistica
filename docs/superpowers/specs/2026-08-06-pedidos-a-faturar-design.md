# Spec — Relatório "Pedidos a Faturar"

**Data:** 2026-08-06
**Origem:** porte do projeto `monitor-winthor` (Python/FastAPI) para dentro do
`CENTRO DE CONTROLE LOGISTICA` (Next.js/TypeScript).
**Status:** aprovado para implementação (paridade total).

---

## 1. Objetivo

Replicar, como um relatório novo do dashboard, o Monitor Winthor: listar os
**pedidos liberados/montados que ainda não foram faturados**, cruzar cada pedido
com um **calendário de rotas por cidade** e classificar a **prioridade de
faturamento** (CRÍTICA / ALTA / MÉDIA / BAIXA / AJUSTAR_CALENDARIO). Além da
lista, o relatório mostra resumo por prioridade, ranking por RCA, ranking por
cidade e diagnóstico de cidades sem calendário — tudo numa única página.

O Python **não roda** dentro do Next; "replicar" aqui é **re-implementar a lógica
em TypeScript**, reaproveitando o `queryWinthor` que já existe.

### Nota sobre a regra de "atrasado"

As regras de entrega mudaram e a classificação de prioridade **será redefinida
depois**. Por isso a regra fica **isolada num único módulo** (`classificar.ts`)
com testes próprios — trocar a regra não deve exigir mexer em query, dados ou UI.
Esta spec porta a regra **atual, fiel ao Python**, como ponto de partida.

---

## 2. Escopo

**Dentro (paridade total):**
- Query de pedidos liberados (`L`) e montados (`M`) sem faturamento, últimos 30 dias.
- Calendário de rotas migrado para uma tabela no Supabase (editável sem redeploy).
- Classificação de prioridade por região/rota/horas (porte fiel).
- Resumo por prioridade + valor total parado.
- Ranking por RCA e ranking por cidade.
- Diagnóstico "cidades sem calendário" (mesmo bloco/página).
- Leitura **ao vivo** do Winthor a cada abertura.

**Fora:**
- Módulo WhatsApp / notificações (já desativado na origem).
- Endpoints REST soltos (aqui é página server-rendered, não API pública).
- UI de edição do calendário (edição via SQL por enquanto; CRUD fica p/ fase futura).

---

## 3. Rota e navegação

- Rota: `src/app/(app)/pedidos-a-faturar/page.tsx`
- Label do menu: **"Pedidos a Faturar"**
- Acesso (RBAC): segue o padrão atual — admin e viewer enxergam o relatório.

---

## 4. Arquitetura de arquivos

```
src/app/(app)/pedidos-a-faturar/
    page.tsx                      # server component: orquestra dados + Suspense
    pedidos-a-faturar-view.tsx    # apresentação (resumo, tabela, rankings, diagnóstico)
src/data/
    pedidos-a-faturar.ts          # query Oracle (queryWinthor) → PedidoPendente[]
    calendario-rotas.ts           # lê a tabela calendario_rotas do Supabase → Rota[]
src/domain/pedidos-a-faturar/
    tipos.ts                      # PedidoPendente, Rota, PedidoClassificado, Resumo, Rankings
    calendario.ts                 # normalização + lookup cidade→rota (com aliases)
    classificar.ts                # REGRA DE PRIORIDADE (único lugar da lógica de "atrasado")
    montar-relatorio.ts           # aplica classificar a todos, ordena, agrega resumo+rankings
supabase/migrations/
    0018_calendario_rotas.sql     # tabela + índices
```

Cada unidade tem um propósito só e é testável isolada. `classificar.ts` e
`calendario.ts` são funções puras (sem I/O) → cobertas por testes unitários.

---

## 5. Dados — tabela `calendario_rotas` (Supabase)

Migração `0018_calendario_rotas.sql`:

```sql
create table if not exists public.calendario_rotas (
  id                 bigint generated always as identity primary key,
  cidade             text not null,
  uf                 text,
  regiao_operacional text,               -- METROPOLITANA | AGRESTE | MATA | LITORAL | SERTAO | FORA_PE | ESPECIAL
  rota               text,               -- ex: SEG-01, QUA-04, QUI-01
  grupo_rota         text,
  dia_saida_rota     text[] not null default '{}',  -- ex: {SEGUNDA}
  dia_limite_pedido  text,
  janela_entrega     text[] not null default '{}',
  aliases            text[] not null default '{}',  -- nomes alternativos da cidade
  observacao         text,
  updated_at         timestamptz not null default now()
);

create index if not exists idx_calendario_rotas_cidade
  on public.calendario_rotas (cidade);
```

- **RLS**: seguir o padrão das demais tabelas (leitura para autenticados). Se o
  projeto usa RLS por profile, replicar a policy de leitura já existente.
- **Seed inicial**: importar as 173 cidades do `calendario_rotas.json` da origem
  via SQL Editor (import em massa, autocommit — padrão já usado no projeto).
  Um script gera os `INSERT`s a partir do JSON. Distribuição atual: AGRESTE 60,
  SERTAO 44, MATA 42, METROPOLITANA 12, LITORAL 10, FORA_PE 4, ESPECIAL 1.
- Editar rota/cidade depois = `UPDATE` no Supabase, **sem redeploy**.

`src/data/calendario-rotas.ts` lê a tabela inteira (é pequena) uma vez por
request e devolve `Rota[]`; `calendario.ts` monta o índice normalizado em memória.

---

## 6. Query Oracle — `pedidos-a-faturar.ts`

Porte fiel do `pedidos_liberados_72h.sql`. Binds: `:status_liberado='L'`,
`:status_montado='M'`.

```sql
SELECT
    ped.NUMPED               AS numero_pedido,
    ped.CODCLI               AS codigo_cliente,
    cli.CLIENTE              AS nome_cliente,
    cli.MUNICENT             AS cidade_cliente,
    cli.BAIRROENT            AS bairro_cliente,
    cli.ESTENT               AS uf_cliente,
    ped.CODUSUR              AS codigo_rca,
    rca.NOME                 AS nome_rca,
    rca.CODSUPERVISOR        AS codigo_supervisor,
    s.NOME                   AS nome_supervisor,
    ped.DATA                 AS data_pedido,
    NVL(ped.DTLIBERA, ped.DATA) AS data_liberacao,
    ped.POSICAO              AS status_winthor,
    NVL(ped.VLATEND, 0)      AS valor_pedido,
    NVL(ped.TOTPESO, 0)      AS peso_pedido,
    ROUND((SYSDATE - NVL(ped.DTLIBERA, ped.DATA)) * 24, 1) AS horas_parado,
    ped.CODEMITENTE          AS codigo_emitente,
    emp.NOME                 AS nome_emitente,
    CASE WHEN ped.CODEMITENTE IN (644, 629, 521, 1015) THEN 'S' ELSE 'N' END AS reentrega
FROM PCPEDC ped
LEFT JOIN PCCLIENT cli ON cli.CODCLI = ped.CODCLI
LEFT JOIN PCUSUARI rca ON rca.CODUSUR = ped.CODUSUR
LEFT JOIN PCSUPERV s   ON s.CODSUPERVISOR = rca.CODSUPERVISOR
LEFT JOIN PCEMPR  emp  ON emp.MATRICULA   = ped.CODEMITENTE
WHERE ped.POSICAO IN (:status_liberado, :status_montado)
  AND ped.CODUSUR != 4
  AND NVL(ped.DTLIBERA, ped.DATA) >= SYSDATE - 30
  AND NOT EXISTS (SELECT 1 FROM PCNFSAID fat WHERE fat.NUMPED = ped.NUMPED)
ORDER BY NVL(ped.DTLIBERA, ped.DATA) ASC
```

- Sem `;` no final (padrão do `queryWinthor`).
- Retorna `null`/tratamento de indisponibilidade igual a `getResumoFaturamento`
  (try/catch, log, retorna lista vazia ou sinaliza "Winthor indisponível").
- Sempre ao vivo — é operacional ("o que está travado agora").

---

## 7. Classificação de prioridade — `classificar.ts` (porte fiel)

Entrada: um `PedidoPendente` + a `Rota` da cidade (ou `null`). Saída:
`PedidoClassificado` com `prioridade`, `situacaoRota`, `dataPrevistaFaturamento`,
`motivoPrioridade` e os campos da rota.

Auxiliar de data (rota semanal), com o **fix do delta-zero**:
> próximo dia-da-semana **estritamente após** a data de referência; se cair no
> mesmo dia (delta 0), joga para a semana seguinte (+7).

Regras por região (idênticas ao `dashboard_service._analisar_pedido`):

1. **Cidade sem rota no calendário** → `situacao = SEM_CALENDARIO_USANDO_72H`.
   `horas_parado ≥ 72` → `AJUSTAR_CALENDARIO`; senão `BAIXA`.
2. **METROPOLITANA** → `data_prevista = liberação + 3 dias`. Por horas paradas:
   `≥72h` → CRÍTICA (`ATRASADO_PARA_FATURAMENTO`); `≥48h` → ALTA (`SAIDA_HOJE`);
   senão BAIXA (`AGUARDANDO_DIA_DE_FATURAMENTO`).
3. **SERTAO** → usa a mesma lógica de rota semanal (stub separado para regras
   próprias futuras).
4. **FORA_PE / ESPECIAL** → sem rota operacional; `situacao =
   SEM_CALENDARIO_USANDO_72H`. `≥72h` → `AJUSTAR_CALENDARIO`; senão `BAIXA`.
5. **Demais regiões (rota semanal)** → `data_prevista` = próximo dia de saída
   após a liberação. Se não há dia de saída reconhecido → `AJUSTAR_CALENDARIO`.
   Senão, comparando com hoje: passou → CRÍTICA; hoje → ALTA; amanhã → MÉDIA;
   futuro → BAIXA.

`motivoPrioridade` traz a explicação textual (datas em `dd/mm/yyyy`), como no Python.

---

## 8. Agregação — `montar-relatorio.ts` (porte de `montar_dashboard`)

1. Classifica todos os pedidos (erro num pedido não derruba os outros — loga e segue).
2. **Ordenação**: por prioridade (`CRITICA < AJUSTAR_CALENDARIO < ALTA < MEDIA <
   BAIXA`), depois `data_prevista_faturamento` asc, depois `horas_parado` desc.
3. **Resumo**: total, críticos, alta, média, baixa, ajustar_calendario, `valor_total`.
4. **Ranking RCA**: agrupado por `codigo_rca` → total, críticos, alta, valor;
   ordenado por `-criticos, -alta, -total`.
5. **Ranking cidade**: agrupado por `cidade_cliente` (nulo → "SEM CIDADE") → mesma
   estrutura e ordenação do ranking RCA.
6. **Diagnóstico**: cidades presentes nos pedidos mas ausentes do calendário,
   agrupadas por cidade → total de pedidos, valor total, maior `horas_parado`,
   exemplos de `numero_pedido` (até 5). Ordenado por total de pedidos desc.

---

## 9. UI — `pedidos-a-faturar-view.tsx`

Layout (server component + Suspense, com skeleton, igual aos cards de faturamento):

- **Cabeçalho**: título "Pedidos a Faturar" + timestamp da leitura.
- **Resumo (cards no topo)**: Total · Críticos · Alta · Média · Baixa · Valor parado.
- **Tabela de pedidos**: ordenada por prioridade, com badge de prioridade colorido
  e colunas nº pedido, cliente, cidade/rota, RCA, valor, horas parado, situação,
  motivo. Reentrega sinalizada.
- **Ranking RCA** e **Ranking cidade**: dois blocos lado a lado.
- **Diagnóstico "cidades sem calendário"**: bloco no rodapé; se vazio, não aparece.
- **Fallback**: se o Winthor estiver indisponível, mensagem "Pedidos a Faturar
  indisponível — sem conexão com o Winthor" (mesmo tom do card de faturamento).

**Identidade visual (regra do projeto):** verde é SÓ para receita. Prioridade usa
vermelho (crítica), âmbar (alta/atenção) e navy (neutro) — **nunca verde** para
status/categoria. Validar a paleta antes de fechar.

---

## 10. Testes

- `classificar.test.ts` — **cobertura central**. Casos: metropolitana <48/48-72/≥72;
  rota semanal com liberação no próprio dia de saída (delta-zero → próxima semana);
  passou/hoje/amanhã/futuro; FORA_PE e ESPECIAL; cidade sem calendário <72/≥72;
  dia de saída não reconhecido → AJUSTAR.
- `calendario.test.ts` — normalização (acento, caixa, espaços) e match por alias.
- `montar-relatorio.test.ts` — ordenação, contadores do resumo, rankings, diagnóstico.
- Datas nos testes usam referência fixa (injetar "hoje") para não depender do relógio.

---

## 11. Riscos / pontos a validar

- `PCNFSAID.NUMPED` é o vínculo suficiente de faturamento (pendência herdada da
  origem — validar com dados reais).
- Nomes de cidade do Winthor (`MUNICENT`) que não batem no calendário aparecem no
  diagnóstico — esperado; alimenta o ajuste do calendário.
- A regra de prioridade é a **atual**; será redefinida depois (por isso isolada).
