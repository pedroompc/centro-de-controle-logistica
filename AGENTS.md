<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git: branches e destino das alterações

Regra do dono do projeto (Pedro), vale para toda sessão nova:

- **Não crie branch por conta própria.** Nem para "trabalhar isolado", nem porque o ambiente sugeriu um nome de branch.
- **Antes da primeira alteração de código, pergunte onde ela deve ir** (ex.: direto na `main`, numa branch existente, ou numa branch nova com qual nome) e espere a resposta.
- Se a sessão já começou numa branch criada automaticamente, avise isso logo de cara e pergunte se as alterações devem ir para a `main` ou para outro lugar antes de commitar.
- Commit, push e merge só no destino que o Pedro confirmou.

# Acesso ao Oracle (Winthor/Harpia) nesta máquina

Este Mac tem acesso direto ao Oracle de produção (Winthor + Harpia, mesmo
banco). Use isso para investigar e validar antes de escrever qualquer query
de produto.

- **Consulta**: `npm run oracle -- "SELECT ..."` (ou `npm run oracle -- -f arquivo.sql`).
  Só aceita SELECT/WITH, abre transação READ ONLY e corta em 500 linhas
  (ver `scripts/consulta-oracle.mjs`).
- **Paginação**: use `ROWNUM`, nunca `FETCH FIRST`/`OFFSET` — a versão do
  Oracle em produção não aceita a sintaxe ANSI.
- **Esquemas**: tabelas do Winthor ficam sem prefixo (`PCPEDC`, `PCPEDI`,
  `PCMOVENDPEND`, ...); tabelas do Harpia (WMS) ficam no esquema
  `HARPIAW2` e precisam do prefixo (`HARPIAW2.PLAN_SEP_MAPA_AVERIG_1197`, etc.).
- **Filiais**: o dashboard só existe para `CODFILIAL` 1 e 11 (ver
  `src/data/filiais.ts` → `filialIn()`). Sempre filtrar por elas.
- **Dados**: nunca inventar coluna/tabela por suposição — consultar o
  catálogo (`ALL_TAB_COLUMNS`, `ALL_TABLES`) antes de assumir estrutura.
  Todo indicador do BI vem de dado que o sistema já grava sozinho (sem
  processo manual) — se não tem rastro automático no banco, não é métrica.
