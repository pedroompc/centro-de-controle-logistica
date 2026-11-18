// BI Geral: o resumo de cada setor na aba Geral. Nenhuma conta nova — cada
// número sai da MESMA função que o BI do setor usa nos quadros dele (ver
// docs/superpowers/specs/2026-11-16-bi-geral-design.md).
import { compararAbs, compararPct, compararTaxa, type Comparacao } from "./comparacao";
import { resumir } from "./bi-recebimento";
import { resumoVolume, premiacaoA424 } from "./abastecimento";
import { resumoDevolucao } from "./motoristas";
import { mapaKmDia, resumoKm } from "./frota";
import { indicadoresSeparacao } from "@/app/(app)/setores/[id]/separacao-indicadores";
import { indicadoresMotoristas } from "@/app/(app)/setores/[id]/motoristas-indicadores";
import type { DadosBISeparacao } from "@/app/(app)/setores/[id]/separacao-dados";
import type { DadosBIAbastecimento } from "@/app/(app)/setores/[id]/abastecimento-dados";
import type { DadosBIMotoristas } from "@/app/(app)/setores/[id]/motoristas-dados";
import type { DadosBI } from "@/app/(app)/setores/[id]/bi-recebimento/base";

export type FormatoIndicador = "int" | "kg" | "brl" | "pct" | "permil" | "brlPorCx" | "brlPorT" | "km";

export interface IndicadorGeral {
  chave: string;
  rotulo: string;
  valor: number | null; // null = sem dado (nunca 0 no lugar)
  formato: FormatoIndicador;
  maiorEhBom: boolean;
}

export type SetorGeral = "separacao" | "recebimento" | "abastecimento" | "motoristas";

export interface ResumoSetorGeral {
  setor: SetorGeral;
  indicadores: IndicadorGeral[];
  erro: string | null; // fonte fora (Harpia/Winthor): os números daquela fonte vêm null
}

const ind = (chave: string, rotulo: string, valor: number | null, formato: FormatoIndicador, maiorEhBom: boolean): IndicadorGeral => ({
  chave, rotulo, valor, formato, maiorEhBom,
});

/** Pedidos separados, peso separado e custo por caixa (quadros do BI da Separação). */
export function resumoSeparacao(d: DadosBISeparacao): ResumoSetorGeral {
  const erro = "erro" in d.producao ? d.producao.erro : null;
  const i = erro ? null : indicadoresSeparacao(d, null);
  return {
    setor: "separacao",
    erro,
    indicadores: [
      ind("pedidos", "Pedidos separados", i?.tot?.pedidos ?? null, "int", true),
      ind("peso", "Peso separado", i?.tot?.kg ?? null, "kg", true),
      ind("custoPorCaixa", "Custo por caixa", i?.unit.porCaixa ?? null, "brlPorCx", false),
    ],
  };
}

/** Peso, carros e receita do descarrego — mesma escolha do BI (fatos do recorte; sem fatos, a série do mês). */
export function resumoRecebimento(d: DadosBI): ResumoSetorGeral {
  // Período livre sem os fatos do descarrego: o `ref` vem zerado — sem dado, não 0.
  const semFatos = !d.mensal && d.fatos === null;
  const r = semFatos ? null : (d.ref ?? d.serie.find((x) => x.mes === d.mes) ?? null);
  const f = r && d.fatos !== null ? resumir(d.fatos) : null;
  return {
    setor: "recebimento",
    erro: semFatos ? "descarrego indisponível" : null,
    indicadores: [
      ind("peso", "Peso descarregado", r ? (f ? f.pesoKg : r.pesoKg) : null, "kg", true),
      ind("carros", "Carros descarregados", r ? (f ? f.carros : r.carros) : null, "int", true),
      ind("receita", "Receita de descarrego", r ? (f ? f.receita : r.receitaDescarrego) : null, "brl", true),
    ],
  };
}

/** Movimentações, reabastecimentos e rupturas (quadros do BI do Abastecimento). */
export function resumoAbastecimento(d: DadosBIAbastecimento): ResumoSetorGeral {
  const h = "dados" in d.harpia ? d.harpia.dados : null;
  const erro = "erro" in d.harpia ? d.harpia.erro : null;
  const prem = h ? premiacaoA424(h.movimentoPiso.a424, null, h.movimentoPiso.empilhadores, h.movimentoPiso.lancadoresWms) : null;
  return {
    setor: "abastecimento",
    erro,
    indicadores: [
      ind("movimentacoes", "Movimentações", prem?.total ?? null, "int", true),
      ind("reabastecimentos", "Reabastecimentos", h ? resumoVolume(h.reabastecimento).abastecimentos : null, "int", true),
      ind("rupturas", "Rupturas", h ? h.rupturas.length : null, "int", false),
    ],
  };
}

/**
 * Entregas, peso, clientes atendidos, devolução logística e km por veículo/dia.
 * `clientesAtendidos` = cliente distinto por dia (o mesmo do Início), vem de fora.
 */
export function resumoMotoristas(d: DadosBIMotoristas, clientesAtendidos: number | null): ResumoSetorGeral {
  const erro = "erro" in d.entregas ? d.entregas.erro : null;
  const i = indicadoresMotoristas(d, null);
  const dev = d.devolucao ? resumoDevolucao(d.devolucao) : null;
  const km = i.vs && d.hodometro ? resumoKm(i.vs, mapaKmDia(d.hodometro), null) : null;
  return {
    setor: "motoristas",
    erro,
    indicadores: [
      ind("entregas", "Entregas", i.tot?.entregas ?? null, "int", true),
      ind("peso", "Peso entregue", i.tot?.kg ?? null, "kg", true),
      ind("clientes", "Clientes atendidos", erro ? null : clientesAtendidos, "int", true),
      ind("devolucao", "Devolução logística", erro ? null : dev?.taxa ?? null, "pct", false),
      ind("kmPorVeiculoDia", "Km por veículo/dia", km?.kmPorVeiculoDia ?? null, "km", false),
    ],
  };
}

/** Variação contra o período de comparação (taxa em p.p., o resto em %); null quando falta um dos lados. */
export function variacao(atual: IndicadorGeral, base: IndicadorGeral | undefined): Comparacao | null {
  if (atual.valor === null || !base || base.valor === null) return null;
  if (atual.formato === "pct") return compararTaxa(atual.valor, base.valor, atual.maiorEhBom);
  if (atual.formato === "permil") {
    return compararAbs(atual.valor, base.valor, atual.maiorEhBom, (n) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ‰`);
  }
  if (atual.formato === "int" && base.valor === 0) return compararAbs(atual.valor, 0, atual.maiorEhBom);
  return compararPct(atual.valor, base.valor, atual.maiorEhBom);
}

/**
 * Roda de novo UMA vez quando a fonte do setor falhou (`erro`): com todos os
 * setores consultando o Oracle ao mesmo tempo, uma conexão às vezes cai no meio
 * ("buffer bounds"); a segunda tentativa já pega conexão nova do pool.
 */
export async function comNovaTentativa<T extends { erro: string | null }>(f: () => Promise<T>): Promise<T> {
  const r = await f();
  return r.erro && conexaoCaiu(r.erro) ? f() : r;
}

/** Conexão morta no meio da consulta (vale repetir). Timeout e erro de SQL não: repetir só faria esperar de novo. */
export function conexaoCaiu(msg: string): boolean {
  return /buffer bounds|NJS-(500|521)|ORA-(03113|03114|03135)/i.test(msg);
}

/**
 * Fila com no máximo `limite` tarefas ao mesmo tempo, na ordem de chegada. A
 * aba Geral não dispara todos os setores juntos: com tudo de uma vez o Oracle
 * derruba conexões e o faturamento cai na foto antiga. Com 2 por vez um setor
 * lento não segura sozinho os outros.
 */
export function criarFila(limite: number): <T>(f: () => Promise<T>) => Promise<T> {
  let rodando = 0;
  const espera: (() => void)[] = [];
  const liberar = () => {
    rodando--;
    espera.shift()?.();
  };
  return <T>(f: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const iniciar = () => {
        rodando++;
        f().then(resolve, reject).finally(liberar);
      };
      if (rodando < limite) iniciar();
      else espera.push(iniciar);
    });
}
