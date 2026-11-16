// Gráficos da aba Geral do BI Geral: a evolução mês a mês dos números da casa
// e o placar de variação dos setores contra o período de comparação.
import { compararPct } from "./comparacao";
import { custoBrutoDoPeriodo, type CustoDoMes } from "./custo-periodo";
import { INICIO_HISTORICO, mesAnterior } from "./periodo";
import type { IndicadorGeral, SetorGeral } from "./bi-geral";

export interface PontoCasa {
  mes: string; // "yyyy-mm-01"
  faturamento: number | null;
  custo: number | null;
  custoSobreFat: number | null; // fração 0..1
  clientes: number | null;
  parcial: boolean; // mês corrente, ainda aberto
}

export interface MesCasaAtual {
  mes: string;
  faturamento: number | null;
  custo: number | null;
  clientes: number | null;
}

/**
 * Janela de `qtd` meses terminando em `ateMes`. Meses fechados vêm das fotos
 * (faturamento) e dos custos do mês (folha da foto + fixos + variáveis); o mês
 * escolhido na tela, quando é um mês só, vem dos cartões — o gráfico termina
 * no mesmo número que está escrito em cima dele.
 */
export function montarEvolucaoCasa(e: {
  ateMes: string;
  qtd: number;
  hojeMes: string;
  fechados: { mes: string; vendaLiquida: number; atendimentos: number }[];
  folhaPorMes: Map<string, number>;
  custosPorMes: Map<string, CustoDoMes>;
  atual: MesCasaAtual | null;
}): PontoCasa[] {
  const meses: string[] = [];
  for (let m = e.ateMes, i = 0; i < e.qtd; i++, m = mesAnterior(m)) meses.unshift(m);
  const fotos = new Map(e.fechados.map((f) => [f.mes, f]));
  const pontos: PontoCasa[] = [];
  for (const mes of meses) {
    let fat: number | null, custo: number | null, clientes: number | null;
    if (e.atual && e.atual.mes === mes) {
      ({ faturamento: fat, custo, clientes } = e.atual);
    } else {
      const f = fotos.get(mes);
      // Foto zerada = a métrica ainda não existia naquele mês: sem dado, não 0.
      fat = f && f.vendaLiquida > 0 ? f.vendaLiquida : null;
      clientes = f && f.atendimentos > 0 ? f.atendimentos : null;
      custo = mes >= INICIO_HISTORICO ? custoBrutoDoPeriodo([mes], e.folhaPorMes, e.custosPorMes) : null;
    }
    if (fat === null && custo === null && clientes === null) continue;
    pontos.push({
      mes,
      faturamento: fat,
      custo,
      clientes,
      custoSobreFat: custo === null || fat === null || fat <= 0 ? null : custo / fat,
      parcial: mes === e.hojeMes,
    });
  }
  return pontos;
}

export interface LinhaPlacar {
  setor: SetorGeral;
  chave: string;
  rotulo: string;
  pct: number; // variação relativa, em %
  texto: string; // "+12,7%"
  positivo: boolean; // a direção é boa para o setor
}

/**
 * Variação relativa (%) de cada indicador de setor contra a base. Taxas
 * (% e ‰) ficam fora: a variação delas é em pontos, e não cabe no mesmo eixo.
 */
export function montarPlacar(setores: { setor: SetorGeral; atuais: IndicadorGeral[]; base: IndicadorGeral[] | null }[]): LinhaPlacar[] {
  const linhas: LinhaPlacar[] = [];
  for (const s of setores) {
    if (!s.base) continue;
    for (const a of s.atuais) {
      if (a.formato === "pct" || a.formato === "permil") continue;
      const b = s.base.find((x) => x.chave === a.chave)?.valor ?? null;
      if (a.valor === null || b === null || b <= 0) continue;
      const c = compararPct(a.valor, b, a.maiorEhBom);
      if (!c) continue;
      linhas.push({ setor: s.setor, chave: a.chave, rotulo: a.rotulo, pct: ((a.valor - b) / b) * 100, texto: c.texto, positivo: c.positivo });
    }
  }
  return linhas;
}
