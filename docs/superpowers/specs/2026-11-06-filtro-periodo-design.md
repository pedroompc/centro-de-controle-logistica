# Filtro por período (calendário + atalhos) — design

Data: 06/11/2026 · Branch: `feat/filtro-periodo`

## Intenção

Hoje toda tela analítica olha **um mês por vez** (`?mes=AAAA-MM`, navegador ◀/▶
em `src/components/mes-nav.tsx`). Pedro quer, além disso, escolher **qualquer
intervalo** — trimestre, ano, ou um período maior que um mês — para enxergar a
operação num horizonte maior em vez de mês a mês, e **comparar** esse período.

## Objetivos

1. Um seletor de período único, reaproveitado em todas as telas que hoje têm
   seletor de mês.
2. Seletor com **atalhos** e **calendário livre** (início + fim).
3. Cada indicador do período mostra variação contra:
   - **período anterior** de mesmo tamanho;
   - **mesmo período do ano passado**.
4. O mês continua funcionando exatamente como hoje (◀/▶ não some).

## Não-objetivos

- Painel TV (`/painel`) e o card de faturamento ao vivo do Dashboard: continuam
  "hoje / mês corrente", fora do filtro.
- Pedidos a Faturar: é lista ao vivo, não tem período.
- Efetivo/salário: não tem histórico mensal (mostra "hoje"); não ganha
  histórico por causa disso.
- Rateio diário de custo fixo/salário.

## Anti-objetivos (seria falha mesmo funcionando)

- Número de um período que não bate com a soma dos meses que ele cobre (ou com
  o 111 do Winthor no faturamento/devolução).
- Comparação "ano passado" mostrando zero quando na verdade **não existe dado**
  — tem que aparecer como "sem dado", nunca como queda de 100%.
- Texto explicativo na tela do BI (regra "BI tela limpa": explicação vai pro
  hover/docs).
- Qualquer seletor de "confirmar/trocar" manual.
- Verde em variação/status (verde é só receita).

## Comportamento

### URL

- Período: `?de=AAAA-MM-DD&ate=AAAA-MM-DD`.
- Mês (como hoje): `?mes=AAAA-MM`. Internamente `mes` vira `de=1º dia`,
  `ate=último dia`.
- Se `de/ate` vier, ele vence `mes`. Sem nada → mês atual (como hoje).
- **Decisão minha:** o período **acompanha a navegação** entre telas (links do
  menu lateral/mobile preservam `de/ate`/`mes`), para comparar o mesmo período
  em várias telas e poder mandar o link.
- `ate` é preso a hoje; `de > ate` é invertido; datas inválidas caem no mês
  atual.

### Seletor

Ao lado do ◀/▶ atual, um botão com o rótulo do período ativo
("Jul–Set/2026", "01/08 – 15/09/2026", ou "Novembro/2026") que abre um popover:

- **Atalhos:** Este mês · Mês passado · Este trimestre · Trimestre passado ·
  Este ano · Ano passado · Últimos 12 meses.
- **Calendário livre:** clica início, clica fim, aplica.
- Quando o período ativo é um mês inteiro, ◀/▶ funciona como hoje. Quando é
  outro período, ◀/▶ **desloca o período inteiro** pelo seu tamanho (trimestre
  → trimestre anterior/próximo; intervalo livre → bloco anterior de mesmo
  nº de dias). *Decisão minha.*
- Mobile: popover vira folha de baixo para cima (padrão do app shell mobile).
- Existe protótipo de seletor de/até em `src/app/(app)/fechamento/seletor-periodo.tsx`
  (inputs nativos). O novo componente substitui esse também.

### Comparações

Para período `[de, ate]` com N dias:

- **Anterior:** `[de − N dias, de − 1]`. Exceção: se o período é mês/trimestre/
  ano **calendário inteiro**, o anterior é o mês/trimestre/ano calendário
  anterior (ex.: Q3 → Q2, mesmo com nº de dias diferente). *Decisão minha* —
  é o que um gestor espera de "trimestre contra trimestre".
- **Ano passado:** mesmas datas com ano − 1 (29/02 → 28/02).
- Exibição: o mesmo componente de variação já usado (`src/components/variacao.tsx`),
  com duas linhas/chips (vs anterior, vs ano passado). Sem dado no período de
  comparação → "sem dado" (anti-objetivo acima).
- Período corrente que termina hoje: compara com o trecho **equivalente** do
  período de comparação (ex.: este trimestre até 06/11 vs trimestre anterior
  até o mesmo dia relativo). *Decisão minha.* Se o Dashboard hoje compara o
  mês corrente de outro jeito, o construtor mantém o critério atual para o
  caso "um mês" (regressão zero) e avisa.

### Agregação

- **Dados diários/transacionais** (Winthor, Harpia, receitas, descarregamentos,
  faltas, cortes, devoluções): somam no intervalo exato de datas.
- **Dados mensais** (lançamentos de custo fixo/variável, foto do efetivo por
  setor): somam **os meses que o período toca**, sem rateio. A tela indica isso
  só no hover do indicador.
- **Taxas/médias** (absenteísmo, % devolução, produtividade): recalculadas a
  partir dos numeradores/denominadores do período — **nunca** média das médias
  mensais.
- **Gráficos:** período ≤ ~62 dias → eixo diário (como hoje); maior → eixo
  mensal. *Decisão minha.*

### Histórico disponível

- Supabase (receitas, custos, efetivo mensal, PDVs) começa em jul/2026
  (`INICIO_HISTORICO`). Comparação "ano passado" nessas métricas → "sem dado"
  até jul/2027.
- Winthor/Harpia têm histórico anterior; comparação contra ano passado
  funciona.
- Cortes: PCCORTEI de 2025 tem o erro da época → **sem** comparação ano
  passado nos cortes (regra existente).
- Ver pergunta aberta 1 sobre o piso de seleção.

### Cache

`src/lib/cache-memoria.ts` usa TTL por mês (`ttlDoMes`). Passa a usar TTL por
período: período que inclui hoje → TTL curto (5 min); totalmente fechado →
60 min. Chave de cache = `de|ate`. Continua só nos BIs e só Oracle.

## Escopo por tela

Estado atual dos dados (relevante para o esforço):

| Tela | Hoje recebe | Observação |
|---|---|---|
| Dashboard `/` | `mes` | comparativos mês a mês usam séries de 12 meses |
| Devoluções | `mes` → já consulta por `ini/fim` | fácil |
| Cortes (+ export) | `mes` → `lerCortes(ini, fim)` | fácil; sem ano passado |
| Receitas (+ export) | `listarReceitasDoMes(mes)` | trocar para intervalo |
| Custos | `listarLancamentosDoMes(mes)` | mensal → soma dos meses tocados |
| Faltas | `mes` | intervalo |
| Fechamento | `ini/fim` próprio | migra para o seletor comum e `de/ate` |
| Tendências (descarrego, efetivos) | séries mensais | o período define a janela da série |
| Setores `/setores/[id]` (BIs Separação, Recebimento, Abastecimento, Motoristas) | `mes` → `carregarBI*(…, mes)`, `lerSeparacaoHarpia(mes)`, `lerAbastecimentoHarpia(mes)` | maior esforço: assinaturas por mês |
| Conferência cruzada (`src/data/conferencia.ts`) | mês | as checagens continuam valendo por período |

## Etapas sugeridas (o construtor pode reordenar)

1. **Base:** tipo `Periodo` em `src/domain/periodo.ts` (parse da URL,
   atalhos, anterior/ano passado, deslocar, rótulo, eixo dia/mês) com testes;
   componente `SeletorPeriodo` comum; links do menu preservando o período.
2. **Dashboard.**
3. **Telas que já são por intervalo:** Devoluções, Cortes, Fechamento.
4. **Receitas, Custos, Faltas, Tendências.**
5. **BIs dos setores** (um por vez: Separação, Recebimento, Abastecimento,
   Motoristas).

Cada etapa sai testável sozinha na branch; o mês continua funcionando em todas
as telas durante a transição.

## Verificação

- Testes de domínio para `Periodo` (atalhos, ano bissexto, virada de ano,
  trimestre anterior, período corrente parcial).
- Para cada tela: período = um mês inteiro tem que dar **o mesmo número** que
  `?mes=` dava antes (regressão zero).
- Período de 3 meses = soma dos 3 meses (métricas aditivas).
- Faturamento/devolução de um trimestre bate com o 111 do Winthor no mesmo
  intervalo.

## Deixado para o construtor

Visual exato do popover/calendário (seguir identidade navy + âmbar, sem verde),
estrutura interna do componente, se usa lib de calendário ou implementação
própria (preferir não adicionar dependência pesada), nomes de funções.

## Perguntas abertas (do Pedro)

1. **Piso de seleção jul/2026.** Hoje a navegação para em jul/2026. O atalho
   "Ano passado" (2025) e qualquer período antes disso cairiam abaixo do piso.
   Liberar seleção antes de jul/2026 nas telas que vêm do Winthor/Harpia, ou
   manter o piso e permitir só a *comparação* com 2025?
