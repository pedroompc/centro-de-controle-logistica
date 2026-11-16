// Indicadores do recorte da Separação — a MESMA conta alimenta o BI do setor
// (cards, tabelas e gráficos) e o resumo do BI Geral. Sem "use client": roda no
// servidor e no cliente.
import {
  totaisProducao, custoDoPeriodo, custosUnitarios, custoSobreFaturamento, resumoErros, porMilLinhas, resumoPorTurno,
} from "@/domain/separacao";
import type { DadosBISeparacao, ProducaoBI } from "./separacao-dados";

export const temProd = (p: DadosBISeparacao["producao"]): p is ProducaoBI => "linhas" in p;

/** Indicadores do recorte (mês/período ou 1 dia) — a MESMA conta alimenta cards, tabelas e gráficos. */
export function indicadoresSeparacao(d: DadosBISeparacao, dia: string | null) {
  const p = temProd(d.producao) ? d.producao : null;
  const h = d.ref;
  const totMes = p ? totaisProducao(p.linhas, p.dias) : null;
  const tot = p ? totaisProducao(p.linhas, p.dias, dia) : null;
  const custo = custoDoPeriodo(h?.custo ?? null, d.fracaoMes, totMes?.dias ?? 0, !!dia);
  const unit = tot ? custosUnitarios(custo, tot) : custosUnitarios(null, { pedidos: 0, linhas: 0, kg: 0, caixas: 0 });
  const sobreFat = custoSobreFaturamento(h?.custoPeriodo ?? null, d.faturamentoLiquido);
  const erros = p ? resumoErros(p.erros, dia) : null;
  const folha = d.folhaRef;
  const turnos = p
    ? resumoPorTurno({ linhas: p.linhas, erros: p.erros, equipe: p.equipe, custoFolhaPeriodo: custoDoPeriodo(folha, d.fracaoMes, totMes?.dias ?? 0, !!dia), skus: p.skusTurno, dia })
    : [];
  return { p, h, tot, totMes, custo, unit, sobreFat, erros, turnos, taxaErro: erros && tot ? porMilLinhas(erros.separador.itens, tot.linhas) : null };
}
