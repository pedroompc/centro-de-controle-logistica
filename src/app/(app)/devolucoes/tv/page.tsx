import { formatMesAno, limitarAoHistorico, primeiroDiaDoMes } from "@/domain/periodo";
import { carregarResumoTv } from "./tv-actions";
import TvView from "./tv-view";

/**
 * Modo TV das Devoluções — tela cheia que fica rodando o mapa de PE e os
 * rankings (motoristas/clientes/vendedores/motivos) sob um placar com o
 * faturamento líquido. Herda a autenticação do layout de `(app)` e cobre a
 * navegação com um overlay `fixed inset-0`. O placar já vem do servidor para
 * aparecer na hora; o resto é aquecido no cliente, um dado de cada vez.
 */
export default async function DevolucoesTvPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const mesSel = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mesSel < primeiroDiaDoMes();
  const mesLabel = `${formatMesAno(mesSel)}${mesFechado ? " · mês fechado" : " · em andamento"}`;

  const resumoInicial = await carregarResumoTv(mesSel);

  return (
    <TvView
      mes={mesFechado ? mesSel : ""} // mês corrente = URL limpa (igual à página)
      mesLabel={mesLabel}
      resumoInicial={resumoInicial}
    />
  );
}
