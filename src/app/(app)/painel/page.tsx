import { formatMesAno, limitarAoHistorico, primeiroDiaDoMes } from "@/domain/periodo";
import { carregarResumoDevolucao } from "./painel-actions";
import PainelView from "./painel-view";

/**
 * Painel da Operação (Modo TV) — tela cheia que fica rodando as telas do site:
 * mapa de devolução de PE, rankings, o que falta faturar, receitas e
 * descarregamento, sob um placar com o faturamento líquido. Herda a auth do
 * layout de `(app)` e cobre a navegação com overlay `fixed inset-0`. Dá para
 * passar as páginas na mão (◀ ▶ / setas) e travar numa página.
 */
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const mesSel = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mesSel < primeiroDiaDoMes();
  const mesLabel = `${formatMesAno(mesSel)}${mesFechado ? " · mês fechado" : " · em andamento"}`;

  const devInicial = await carregarResumoDevolucao(mesSel);

  // `key` por mês: ao navegar de mês o painel recomeça do zero (estado e dados).
  return <PainelView key={mesSel} mes={mesFechado ? mesSel : ""} mesLabel={mesLabel} devInicial={devInicial} />;
}
