import { classificarPedido } from "./classificar";
import type {
  CidadeSemCalendario, IndiceCalendario, PedidoClassificado, PedidoPendente,
  Prioridade, RankingCidade, RankingRca, Relatorio,
} from "./tipos";

const ORDEM: Record<Prioridade, number> = {
  CRITICA: 0, AJUSTAR_CALENDARIO: 1, ALTA: 2, MEDIA: 3, BAIXA: 4,
};

export function montarRelatorio(
  pedidos: PedidoPendente[],
  indice: IndiceCalendario,
  hoje: Date,
): Relatorio {
  const classificados: PedidoClassificado[] = pedidos.map((p) =>
    classificarPedido(p, indice.buscar(p.cidadeCliente), hoje),
  );

  classificados.sort((a, b) => {
    const po = ORDEM[a.prioridade] - ORDEM[b.prioridade];
    if (po !== 0) return po;
    const da = a.dataPrevistaFaturamento ?? "9999-12-31";
    const db = b.dataPrevistaFaturamento ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return b.horasParado - a.horasParado;
  });

  const resumo = {
    total: classificados.length,
    criticos: classificados.filter((p) => p.prioridade === "CRITICA").length,
    alta: classificados.filter((p) => p.prioridade === "ALTA").length,
    media: classificados.filter((p) => p.prioridade === "MEDIA").length,
    baixa: classificados.filter((p) => p.prioridade === "BAIXA").length,
    ajustarCalendario: classificados.filter((p) => p.prioridade === "AJUSTAR_CALENDARIO").length,
    valorTotal: classificados.reduce((s, p) => s + p.valorPedido, 0),
  };

  const rcaAcc = new Map<number, RankingRca>();
  for (const p of classificados) {
    const r = rcaAcc.get(p.codigoRca) ?? {
      codigoRca: p.codigoRca, nomeRca: p.nomeRca,
      totalPedidos: 0, criticos: 0, alta: 0, valorTotal: 0,
    };
    r.totalPedidos += 1;
    r.valorTotal += p.valorPedido;
    if (p.prioridade === "CRITICA") r.criticos += 1;
    if (p.prioridade === "ALTA") r.alta += 1;
    rcaAcc.set(p.codigoRca, r);
  }
  const rankingRca = [...rcaAcc.values()].sort(
    (a, b) => b.criticos - a.criticos || b.alta - a.alta || b.totalPedidos - a.totalPedidos,
  );

  const cidadeAcc = new Map<string, RankingCidade>();
  for (const p of classificados) {
    const chave = p.cidadeCliente ?? "SEM CIDADE";
    const c = cidadeAcc.get(chave) ?? {
      cidade: chave, rota: p.rota, totalPedidos: 0, criticos: 0, alta: 0, valorTotal: 0,
    };
    c.totalPedidos += 1;
    c.valorTotal += p.valorPedido;
    if (p.prioridade === "CRITICA") c.criticos += 1;
    if (p.prioridade === "ALTA") c.alta += 1;
    cidadeAcc.set(chave, c);
  }
  const rankingCidade = [...cidadeAcc.values()].sort(
    (a, b) => b.criticos - a.criticos || b.alta - a.alta || b.totalPedidos - a.totalPedidos,
  );

  // Diagnóstico: cidades dos pedidos que NÃO existem no calendário.
  const diagAcc = new Map<string, CidadeSemCalendario>();
  for (const p of classificados) {
    if (indice.buscar(p.cidadeCliente) !== null) continue;
    const chave = p.cidadeCliente ?? "SEM CIDADE";
    const d = diagAcc.get(chave) ?? {
      cidade: chave, uf: p.ufCliente, totalPedidos: 0, valorTotal: 0,
      maxHorasParado: 0, exemplosNumped: [],
    };
    d.totalPedidos += 1;
    d.valorTotal += p.valorPedido;
    d.maxHorasParado = Math.max(d.maxHorasParado, p.horasParado);
    if (d.exemplosNumped.length < 5) d.exemplosNumped.push(p.numeroPedido);
    diagAcc.set(chave, d);
  }
  const diagnostico = [...diagAcc.values()].sort((a, b) => b.totalPedidos - a.totalPedidos);

  return { resumo, pedidos: classificados, rankingRca, rankingCidade, diagnostico };
}
