# BI Geral interativo (aba Geral) — design

Aprovado pelo Pedro em 16/11/2026 ("pode seguir com essa lista").

## Intenção
A aba Geral é a tela da diretoria. Pedro quer ela "100% interativa": cada número
abre o que está por trás dele (ex.: clico no Efetivo e vejo os funcionários).

## Como abre
Mesmo padrão dos BIs de setor: clicar num cartão troca o **palco** (área de baixo,
hoje "Setores") pela visão daquele cartão; clicar de novo ou Esc volta aos Setores.
A visão aberta fica na URL (`?ver=efetivo`), para o servidor carregar só ela
(nenhuma consulta pesada de detalhe roda sem o clique) e para o link ser
compartilhável.

## O que cada clique abre
- **Efetivo** → funcionários ativos por setor (nome, cargo, turno, admissão), com
  busca. Custo por pessoa só para admin (conta de leitura/TV não vê).
- **Faturamento líquido** → dia a dia do período: venda, devolução, avulsa e
  líquido (VIEW_BI_FATURAMENTO por dia; a soma bate com o cartão — conferido em
  out/2026: R$ 51.754.478,69).
- **Custo logístico** → composição (folha, fixos, variáveis) e maiores lançamentos.
- **Custo ÷ faturamento** → tabela mês a mês (faturamento, custo, %).
- **Gráfico de evolução** → clicar num mês leva o BI inteiro para aquele mês.
- **Linha de setor / barra do placar** → abre o BI do setor já na visão daquele
  quadro (`?aba=<setor>&ver=<quadro>`).

## Fora
Novas métricas; foto mensal dos setores; nada muda nos BIs de Setores fora do /bi
além de aceitar a visão inicial.
