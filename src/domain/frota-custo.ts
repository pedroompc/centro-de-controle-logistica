/**
 * Custo ESTIMADO da frota (cadastro em Custos › Frota, migration 0028).
 *
 * - Diesel: km real da telemetria ÷ km/L do modelo × preço do litro. O Siga+ não
 *   manda litros e o Winthor não tem consumo cadastrado, então km/L e preço são
 *   referência editável — por isso tudo aqui é "estimado".
 * - Desgaste (pneu, recapagem, óleo, filtro, bateria) e manutenção (peça, mão de
 *   obra): média mensal da frota, rateada pela fração do mês do recorte e, por
 *   veículo, igual entre os veículos ativos do cadastro.
 */
import { normalizarPlaca, type ResumoKm } from "./frota";

export interface ModeloConsumo {
  modelo: string;
  kmPorLitro: number;
}

export interface VeiculoFrota {
  placa: string;
  modelo: string;
  tipo: string;
}

export interface ParametrosFrota {
  precoDiesel: number;
  desgasteMensal: number;
  manutencaoMensal: number;
}

export interface CadastroFrota {
  parametros: ParametrosFrota;
  modelos: ModeloConsumo[];
  veiculos: VeiculoFrota[];
}

export interface CustoVeiculo {
  modelo: string;
  tipo: string;
  litros: number;
  diesel: number;
}

export interface CustoTipo {
  tipo: string;
  veiculos: number;
  km: number;
  litros: number;
  diesel: number;
}

export interface CustoFrota {
  diesel: number;
  litros: number;
  kmComCadastro: number;
  desgaste: number;
  manutencao: number;
  total: number;
  precoDiesel: number;
  /** total ÷ km da frota rastreada */
  custoPorKm: number | null;
  porVeiculo: Map<string, CustoVeiculo>;
  porTipo: CustoTipo[];
  /** placas com km no recorte mas fora do cadastro (diesel não estimado) */
  semCadastro: string[];
}

/** "Três quarto" separa pelo número do modelo (11.180 → Ref. 11), como na planilha da frota. */
export function rotuloTipo(tipo: string, modelo: string): string {
  if (tipo.toLowerCase() === "três quarto" && /^\d+\./.test(modelo)) return `Três quarto (Ref. ${modelo.split(".")[0]})`;
  return tipo;
}

/**
 * @param fracaoMes parte do mês coberta pelo recorte (mês corrente = dias decorridos;
 *   mês fechado = 1; um dia = 1 ÷ dias do mês).
 */
export function custoFrota(km: ResumoKm, cadastro: CadastroFrota, fracaoMes: number): CustoFrota {
  const { precoDiesel, desgasteMensal, manutencaoMensal } = cadastro.parametros;
  const kmL = new Map(cadastro.modelos.map((m) => [m.modelo, m.kmPorLitro]));
  const veic = new Map(cadastro.veiculos.map((v) => [normalizarPlaca(v.placa), v]));

  const porVeiculo = new Map<string, CustoVeiculo>();
  const tipos = new Map<string, CustoTipo>();
  const semCadastro: string[] = [];
  let litros = 0;
  let kmComCadastro = 0;
  for (const v of km.porVeiculo) {
    if (v.km === null || v.km <= 0) continue;
    const c = veic.get(v.placa);
    const consumo = c ? kmL.get(c.modelo) : undefined;
    if (!c || !consumo || consumo <= 0) {
      semCadastro.push(v.placa);
      continue;
    }
    const l = v.km / consumo;
    const tipo = rotuloTipo(c.tipo, c.modelo);
    porVeiculo.set(v.placa, { modelo: c.modelo, tipo, litros: l, diesel: l * precoDiesel });
    const t = tipos.get(tipo) ?? { tipo, veiculos: 0, km: 0, litros: 0, diesel: 0 };
    t.veiculos += 1;
    t.km += v.km;
    t.litros += l;
    t.diesel += l * precoDiesel;
    tipos.set(tipo, t);
    litros += l;
    kmComCadastro += v.km;
  }

  const fracao = Math.max(0, Math.min(1, fracaoMes));
  const diesel = litros * precoDiesel;
  const desgaste = desgasteMensal * fracao;
  const manutencao = manutencaoMensal * fracao;
  const total = diesel + desgaste + manutencao;
  return {
    diesel,
    litros,
    kmComCadastro,
    desgaste,
    manutencao,
    total,
    precoDiesel,
    custoPorKm: km.km > 0 ? total / km.km : null,
    porVeiculo,
    porTipo: [...tipos.values()].sort((a, b) => b.diesel - a.diesel),
    semCadastro,
  };
}
