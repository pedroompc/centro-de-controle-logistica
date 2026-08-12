# Mapa de calor — devolução por cidade (Pernambuco)

**Data:** 2026-08-12
**Página:** nova seção em `/devolucoes`

## Objetivo

Responder visualmente: **qual cidade de PE tem a maior taxa de devolução?**
Um choropleth (mapa de calor) dos municípios de Pernambuco, colorido pela
**taxa de devolução = R$ devolvido ÷ R$ faturado** — a mesma fórmula do card do
dashboard (`taxaDevolucao` em `src/domain/faturamento.ts`), só que quebrada por
município.

## Contexto atual

- Devoluções vêm do Winthor (Oracle, rotina 111 líquido) via
  `src/data/devolucoes.ts`. Hoje a quebra é por setor/motivo/cliente/motorista —
  **não há quebra por cidade**.
- O projeto **não usa lib de gráfico**; toda visualização é SVG inline na mão
  (ex.: `src/app/(app)/tendencias/evolucao-chart.tsx`). O mapa segue esse padrão.
- A página `/devolucoes` já usa o seletor de mês (`MesNav`) e busca tudo num
  `Promise.all` no server component.
- Regra de identidade visual: **verde é só para receita**. Devolução é ruim →
  escala **âmbar → vermelho**.

## Métrica

`taxa = devolvido / faturado` por cidade, `0` se `faturado <= 0`. Idêntica à
`taxaDevolucao` do dashboard, aplicada por município em vez de por filial.

**Chave de atribuição:** cidade do **cliente da NF de venda**. O valor devolvido
é atribuído à cidade do cliente da venda de origem
(`devolução → NUMTRANSVENDA → PCNFSAID → PCCLIENT → PCCIDADE`); o faturado por
cidade vem da mesma junção. Assim numerador e denominador compartilham a mesma
definição de "cidade", e a taxa é coerente.

**Escopo geográfico:** apenas UF = 'PE'. Cidades de outras UF ficam fora do mapa.

## Arquitetura

Quatro unidades independentes, cada uma testável isoladamente.

### 1. Dados — `getDevolucaoPorCidade(ini, fim)` em `src/data/devolucoes.ts`

Nova função exportada (padrão `cache()` como as demais do arquivo, argumentos
primitivos para não furar a memoização do React).

Retorna `LinhaCidadeDevolucao[]` — tipo **definido no domínio**
(`src/domain/devolucoes-mapa.ts`) e importado aqui, seguindo a convenção do
projeto (a camada de dados importa tipos do domínio):
```ts
interface LinhaCidadeDevolucao {
  ibge: string;        // código IBGE do município (chave de junção com a geometria)
  cidade: string;      // nome do município
  faturado: number;    // R$ faturado atribuído à cidade no período
  devolvido: number;   // R$ devolvido (líquido, rotina 111) atribuído à cidade
  notasDevolvidas: number;
}
```
A `taxa` NÃO vem do SQL — é derivada no domínio (item 2), para manter a fórmula
num único lugar e testável sem Oracle.

**SQL (duas agregações que casam por IBGE):**
- **Faturado por cidade:** `PCNFSAID` (mesmos filtros da query de motorista:
  `filialIn`, faixa de `DTSAIDA`, `CONDVENDA NOT IN (4,8,10,13,20,98,99)`,
  `DTCANCEL IS NULL`) → `PCCLIENT` → `PCCIDADE`, filtrado UF='PE', agrupado por
  cidade.
- **Devolvido por cidade:** reaproveita a CTE `edf` já existente
  (`NUMTRANSVENDA > 0`), junta em `PCNFSAID` → `PCCLIENT` → `PCCIDADE` pela venda
  de origem, filtrado UF='PE', agrupado por cidade. Valor = `SUM(edf.VL)`
  (líquido, sem arredondar até a agregação final).
- `FULL OUTER JOIN` das duas por código de cidade (cidade pode ter faturamento
  sem devolução e — raramente — o inverso).

⚠️ **A verificar na rede da empresa (banco só responde on-site):** nomes exatos
das colunas de cidade/IBGE/UF no Winthor. Hipótese de trabalho:
`PCCLIENT.CODCIDADE → PCCIDADE (CODCIDADE, CIDADE, CODIBGE, ESTADO)`. Se o nome
divergir, ajusta-se só esta função; domínio e UI não mudam. Erro do Oracle →
`return []` (mesmo tratamento defensivo do restante do arquivo), e a seção do
mapa exibe estado vazio.

### 2. Domínio — `src/domain/devolucoes-mapa.ts` (+ `.test.ts`)

Puro, sem I/O. Testado com fixtures. Aqui vivem os tipos (`LinhaCidadeDevolucao`,
`CidadeDevolucao`) que a camada de dados importa.

```ts
interface CidadeDevolucao extends LinhaCidadeDevolucao {
  taxa: number;          // devolvido / faturado (0..1); 0 se faturado <= 0
  relevante: boolean;    // faturado >= minFaturado
}

// Enriquece as linhas com taxa e o flag de volume relevante.
function comTaxa(linhas: LinhaCidadeDevolucao[], minFaturado: number): CidadeDevolucao[]

// A resposta da pergunta: maior taxa ENTRE as cidades com volume relevante.
// null se nenhuma atinge o piso.
function piorCidade(cidades: CidadeDevolucao[]): CidadeDevolucao | null

// Mapeia a taxa para um passo da escala âmbar→vermelho, relativo ao teto das
// cidades relevantes (o pior vira o tom mais intenso). Cidade não-relevante ou
// sem dado → cor neutra (cinza).
function corDaTaxa(taxa: number, tetoRelevante: number): string
```

**Piso de volume (`minFaturado`):** cidade abaixo do piso entra no mapa em cinza,
não colorida — senão uma cidade com 1 venda e 1 devolução vira 100% e sequestra a
escala (mesma proteção do `piorMotorista`/`minExpedidas`). Valor default definido
no domínio (ex.: `MIN_FATURADO_CIDADE`), ajustável.

### 3. Geometria — `src/data/geo/pe-municipios.json` (asset estático)

`Array<{ ibge: string; nome: string; d: string }>` — `d` é o path SVG já
projetado dos 184 municípios de PE.

Gerado **uma vez** por um script único (`scripts/gen-geo-pe.mjs`, não roda em
runtime) a partir do GeoJSON de municípios do IBGE: projeção simples (equirretangular
ou Mercator) + normalização do viewBox. Nenhuma dependência nova em produção — o
runtime só lê JSON e cospe `<path d>`.

### 4. UI — seção em `/devolucoes`

- **Server component** (`page.tsx`): adiciona `getDevolucaoPorCidade(inicio, fim)`
  ao `Promise.all` existente; enriquece via `comTaxa`; casa com a geometria por
  `ibge`; passa o resultado ao client component.
- **Client component** `src/app/(app)/devolucoes/mapa-devolucoes.tsx`:
  - Choropleth SVG inline — um `<path>` por município, `fill` via `corDaTaxa`.
  - **Hover:** tooltip com cidade, taxa %, R$ devolvido, R$ faturado.
  - **Lista ranqueada ao lado:** top cidades por taxa (só as relevantes), clicável
    para destacar no mapa.
  - **Legenda** da escala âmbar→vermelho + amostra "cinza = volume baixo/sem dado".
  - **Destaque no topo da seção:** "Maior índice: {cidade} — {taxa}%" (via
    `piorCidade`). Estado vazio se `getDevolucaoPorCidade` retornar `[]`.

## Fluxo de dados

```
MesNav (mês) → page.tsx server
  → getDevolucaoPorCidade(ini, fim)  [Oracle, por cidade PE]
  → comTaxa(linhas, MIN_FATURADO)    [domínio: taxa + relevante]
  → junta com pe-municipios.json por ibge
  → <MapaDevolucoes cidades={...} />  [client: SVG + tooltip + ranking]
       ├─ piorCidade → headline
       └─ corDaTaxa  → fill de cada município
```

## Erros e casos de borda

- Oracle indisponível (mês passado / fora da rede): `getDevolucaoPorCidade → []`;
  seção mostra "Mapa indisponível para {mês}" no mesmo tom do resto da página.
- Cidade no Winthor sem match na geometria (IBGE ausente/divergente): não pinta
  no mapa, mas **aparece na lista ranqueada** (não some do ranking).
- Cidade na geometria sem dado no período: path cinza.
- `faturado = 0`: taxa 0, tratada como não-relevante (cinza).

## Testes

- `devolucoes-mapa.test.ts`: `comTaxa` (taxa, flag relevante, piso), `piorCidade`
  (ignora não-relevantes, `null` quando nenhuma atinge o piso, desempate),
  `corDaTaxa` (relevante colore, não-relevante = cinza, monotonicidade).
- Camada de dados (SQL) validada manualmente na rede da empresa contra a rotina
  111 / dashboard, como as demais queries do projeto.

## Fora de escopo (YAGNI)

- Histórico/animação do mapa por mês (usa o `MesNav` que já existe, um mês por vez).
- Outras UFs / outras filiais.
- Drill-down cidade → bairro/cliente dentro do mapa (o painel de clientes já existe
  na mesma página).
- Taxa por nota no mapa (a métrica escolhida é por valor).
