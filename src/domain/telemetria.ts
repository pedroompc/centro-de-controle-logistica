// Aba Telemetria & Frota (portada do app Flask, "Análise do Motorista"): entregas,
// devolução por motorista/rota/cidade/dia da semana e km + custo estimado da frota.
import { normalizarPlaca } from "./frota";
import type { ViagemEntrega } from "./motoristas";

/** Motorista × cidade das entregas do período. */
export interface RotaMotorista {
  codMotorista: number;
  motorista: string;
  ibge: string | null;
  cidade: string;
  cargas: number;
  notas: number;
  entregas: number; // cliente × dia
  clientes: number;
  entregasDev: number; // entregas com alguma devolução
  clientesDev: number;
  peso: number;
  valor: number;
  devolvido: number;
  pesoDev: number;
}

export interface TotaisEntrega {
  entregas: number;
  clientes: number;
  entregasDev: number;
  clientesDev: number;
  valor: number;
  devolvido: number;
}

export interface DiaSemanaFrota {
  ds: number; // 0 = segunda … 6 = domingo
  faturado: number;
  pesoFaturado: number;
  devolvidoFat: number; // devolução das notas vendidas nesse dia da semana
  pesoDevFat: number;
  devolvidoEnt: number; // devolução que entrou nesse dia da semana
  pesoDevEnt: number;
}

export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/** Motoristas com entrega no período, para o filtro (ordem alfabética). */
export function motoristasDasRotas(rotas: RotaMotorista[]): { cod: number; nome: string }[] {
  const m = new Map<number, string>();
  for (const r of rotas) m.set(r.codMotorista, r.motorista);
  return [...m].map(([cod, nome]) => ({ cod, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface CidadeFrota {
  ibge: string;
  cidade: string;
  faturado: number;
  devolvido: number;
  entregas: number;
  entregasDev: number;
  taxa: number | null;
}

/** Faturado e devolvido por município (IBGE), para o mapa e o ranking. */
export function porCidade(rotas: RotaMotorista[]): CidadeFrota[] {
  const m = new Map<string, CidadeFrota>();
  for (const r of rotas) {
    if (!r.ibge) continue;
    const c = m.get(r.ibge) ?? { ibge: r.ibge, cidade: r.cidade, faturado: 0, devolvido: 0, entregas: 0, entregasDev: 0, taxa: null };
    c.faturado += r.valor;
    c.devolvido += r.devolvido;
    c.entregas += r.entregas;
    c.entregasDev += r.entregasDev;
    m.set(r.ibge, c);
  }
  return [...m.values()]
    .map((c) => ({ ...c, taxa: c.faturado > 0 ? c.devolvido / c.faturado : null }))
    .sort((a, b) => b.devolvido - a.devolvido);
}

/** Linhas da tabela de rotas: só as que tiveram devolução, da maior para a menor. */
export function rotasComDevolucao(rotas: RotaMotorista[]): (RotaMotorista & { taxa: number | null })[] {
  return rotas
    .filter((r) => r.devolvido > 0)
    .map((r) => ({ ...r, taxa: r.valor > 0 ? r.devolvido / r.valor : null }))
    .sort((a, b) => b.devolvido - a.devolvido);
}

/**
 * Hodômetro só dos dias em que o veículo saiu com carga do motorista (outro
 * motorista no mesmo carro, em outro dia, não entra) — a regra do Flask.
 * `mapa` = "PLACA|yyyy-mm-dd" → km do dia.
 */
export function kmDoMotorista(viagens: ViagemEntrega[], mapa: Map<string, number>): Map<string, number> {
  const chaves = new Set(viagens.map((v) => `${normalizarPlaca(v.placa)}|${v.dia}`));
  return new Map([...mapa].filter(([k]) => chaves.has(k)));
}

/** Dias-veículo rodados pelo motorista (placa × dia com carga dele). */
export function veiculoDias(viagens: ViagemEntrega[]): number {
  return new Set(viagens.filter((v) => normalizarPlaca(v.placa)).map((v) => `${normalizarPlaca(v.placa)}|${v.dia}`)).size;
}

/**
 * Fração do mês da frota que cabe ao motorista: desgaste e manutenção mensais são
 * da frota inteira; o Flask rateia por caminhão-dia (mensal ÷ caminhões ÷ 30 ×
 * dias-veículo do motorista). Devolve a fração equivalente para `custoFrota`.
 */
export function fracaoMesDoMotorista(diasVeiculo: number, caminhoesFrota: number): number {
  return caminhoesFrota > 0 ? diasVeiculo / (caminhoesFrota * 30) : 0;
}
