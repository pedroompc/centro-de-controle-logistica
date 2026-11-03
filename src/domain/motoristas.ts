/**
 * Motoristas — regras do BI do setor (entrega). Tudo vem do Winthor, que grava
 * sozinho: nota de venda em carga (PCNFSAID.NUMCAR) → carga (PCCARREG: motorista,
 * ajudante, veículo) → veículo (PCVEICUL.PESOCARGAKG = capacidade).
 *
 * VIAGEM = mesmo veículo + mesmo motorista + mesmo dia de saída da nota. O
 * Winthor quebra uma saída do caminhão em várias cargas (uma por destino/frio),
 * então contar carga infla tudo. Peso vem das NOTAS (PCNFSAID.TOTPESO), não do
 * TOTPESO da carga, que tem digitação errada (já vimos 914 t numa carga de 8 t).
 *
 * Fora daqui (não tem rastro automático confiável): hora de saída/retorno do
 * veículo (digitada à mão, 96% em hora cheia) e KM (vazio).
 */
import { normalizarTexto } from "./recebimento";

export type PapelMotoristas = "motorista" | "ajudante" | "lider" | "outros";
export type TipoMotorista = "F" | "T" | null; // F = da casa · T = terceirizado (PCEMPR.TIPOMOTORISTA)

export function ehSetorMotoristas(nome: string): boolean {
  return normalizarTexto(nome).includes("motorist");
}

export function papelMotoristas(cargo: string): PapelMotoristas {
  const c = normalizarTexto(cargo);
  if (c.includes("lider") || c.includes("encarreg") || c.includes("supervis") || c.includes("coorden")) return "lider";
  if (c.includes("ajudante") || c.includes("auxiliar") || c.includes("aux ") || c.includes("entregador")) return "ajudante";
  if (c.includes("motorist")) return "motorista";
  return "outros";
}

export interface ViagemEntrega {
  dia: string; // "yyyy-mm-dd" da saída da nota
  veiculo: number;
  placa: string | null;
  descricaoVeiculo: string | null;
  capacidadeKg: number | null; // null = veículo sem capacidade cadastrada
  motorista: number;
  nomeMotorista: string | null;
  tipoMotorista: TipoMotorista;
  ajudante: number | null; // ajudante principal (o da maioria das cargas)
  nomeAjudante: string | null;
  cargas: number;
  notas: number;
  entregas: number; // clientes distintos atendidos na viagem
  kg: number;
  valor: number;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

/** Ocupação ponderada: peso ÷ capacidade, só das viagens com capacidade cadastrada. */
function ocupacaoDe(vs: ViagemEntrega[]): number | null {
  let kg = 0;
  let cap = 0;
  for (const x of vs) {
    if (!x.capacidadeKg || x.capacidadeKg <= 0) continue;
    kg += x.kg;
    cap += x.capacidadeKg;
  }
  return div(kg, cap);
}

export interface TotaisEntregas {
  viagens: number;
  entregas: number;
  notas: number;
  cargas: number;
  kg: number;
  valor: number;
  dias: number;
  veiculos: number;
  motoristas: number;
  ocupacao: number | null;
  entregasPorViagem: number | null;
  kgPorViagem: number | null;
}

export function totaisEntregas(viagens: ViagemEntrega[], dia: string | null = null): TotaisEntregas {
  const vs = dia ? viagens.filter((x) => x.dia === dia) : viagens;
  const t = { viagens: vs.length, entregas: 0, notas: 0, cargas: 0, kg: 0, valor: 0 };
  for (const x of vs) {
    t.entregas += x.entregas;
    t.notas += x.notas;
    t.cargas += x.cargas;
    t.kg += x.kg;
    t.valor += x.valor;
  }
  return {
    ...t,
    dias: new Set(vs.map((x) => x.dia)).size,
    veiculos: new Set(vs.map((x) => x.veiculo)).size,
    motoristas: new Set(vs.map((x) => x.motorista)).size,
    ocupacao: ocupacaoDe(vs),
    entregasPorViagem: div(t.entregas, t.viagens),
    kgPorViagem: div(t.kg, t.viagens),
  };
}

export interface ResumoMotorista {
  motorista: number;
  nome: string;
  tipo: TipoMotorista;
  dias: number;
  viagens: number;
  entregas: number;
  notas: number;
  kg: number;
  valor: number;
  ocupacao: number | null;
  ajudantes: number; // ajudantes distintos que rodaram com ele
}

export function porMotorista(viagens: ViagemEntrega[]): ResumoMotorista[] {
  const g = new Map<number, ViagemEntrega[]>();
  for (const x of viagens) (g.get(x.motorista) ?? g.set(x.motorista, []).get(x.motorista)!).push(x);
  return [...g.entries()]
    .map(([motorista, vs]) => {
      const t = totaisEntregas(vs);
      return {
        motorista,
        nome: vs.find((x) => x.nomeMotorista)?.nomeMotorista ?? `Motorista ${motorista}`,
        tipo: vs.find((x) => x.tipoMotorista)?.tipoMotorista ?? null,
        dias: t.dias,
        viagens: t.viagens,
        entregas: t.entregas,
        notas: t.notas,
        kg: t.kg,
        valor: t.valor,
        ocupacao: t.ocupacao,
        ajudantes: new Set(vs.flatMap((x) => (x.ajudante === null ? [] : [x.ajudante]))).size,
      };
    })
    .sort((a, b) => b.entregas - a.entregas);
}

export interface ResumoVeiculo {
  veiculo: number;
  placa: string | null;
  descricao: string | null;
  capacidadeKg: number | null;
  viagens: number;
  dias: number;
  entregas: number;
  kg: number;
  ocupacao: number | null;
  motoristas: number;
}

export function porVeiculo(viagens: ViagemEntrega[]): ResumoVeiculo[] {
  const g = new Map<number, ViagemEntrega[]>();
  for (const x of viagens) (g.get(x.veiculo) ?? g.set(x.veiculo, []).get(x.veiculo)!).push(x);
  return [...g.entries()]
    .map(([veiculo, vs]) => {
      const t = totaisEntregas(vs);
      return {
        veiculo,
        placa: vs[0].placa,
        descricao: vs[0].descricaoVeiculo,
        capacidadeKg: vs[0].capacidadeKg,
        viagens: t.viagens,
        dias: t.dias,
        entregas: t.entregas,
        kg: t.kg,
        ocupacao: t.ocupacao,
        motoristas: t.motoristas,
      };
    })
    .sort((a, b) => b.viagens - a.viagens || b.kg - a.kg);
}

export interface DiaEntregas {
  viagens: number;
  entregas: number;
  notas: number;
  kg: number;
}

export function porDiaEntregas(viagens: ViagemEntrega[]): Map<string, DiaEntregas> {
  const m = new Map<string, DiaEntregas>();
  for (const x of viagens) {
    const d = m.get(x.dia) ?? { viagens: 0, entregas: 0, notas: 0, kg: 0 };
    d.viagens += 1;
    d.entregas += x.entregas;
    d.notas += x.notas;
    d.kg += x.kg;
    m.set(x.dia, d);
  }
  return m;
}

/** Faixas de ocupação por viagem (peso ÷ capacidade do veículo). */
export const FAIXAS_OCUPACAO: { chave: string; rotulo: string; teste: (o: number) => boolean }[] = [
  { chave: "ate40", rotulo: "até 40%", teste: (o) => o <= 0.4 },
  { chave: "40-60", rotulo: "40-60%", teste: (o) => o > 0.4 && o <= 0.6 },
  { chave: "60-80", rotulo: "60-80%", teste: (o) => o > 0.6 && o <= 0.8 },
  { chave: "80-100", rotulo: "80-100%", teste: (o) => o > 0.8 && o <= 1 },
  { chave: "100+", rotulo: "acima de 100%", teste: (o) => o > 1 },
];

export function faixasOcupacao(viagens: ViagemEntrega[]): { chave: string; rotulo: string; qtd: number }[] {
  const os = viagens.flatMap((x) => (x.capacidadeKg && x.capacidadeKg > 0 ? [x.kg / x.capacidadeKg] : []));
  return FAIXAS_OCUPACAO.map((f) => ({ chave: f.chave, rotulo: f.rotulo, qtd: os.filter(f.teste).length }));
}

// --- Devolução logística POR PERÍODO DE FATURAMENTO ----------------------------

/** Uma linha por motorista × dia de saída da nota: notas saídas e quantas voltaram (Logística). */
export interface DevolucaoMotDia {
  dia: string;
  codMotorista: number;
  nome: string;
  tipo: TipoMotorista;
  expedidas: number;
  devolvidas: number;
  valorExpedido: number;
  valorDevolvido: number;
}

export interface DevolucaoMotResumo {
  codMotorista: number;
  nome: string;
  tipo: TipoMotorista;
  expedidas: number;
  devolvidas: number;
  taxa: number | null; // fração (devolvidas ÷ expedidas)
  valorExpedido: number;
  valorDevolvido: number;
}

export interface ResumoDevolucao {
  expedidas: number;
  devolvidas: number;
  valorExpedido: number;
  valorDevolvido: number;
  taxa: number | null;
  porMotorista: DevolucaoMotResumo[];
}

export function resumoDevolucao(linhas: DevolucaoMotDia[], dia: string | null = null): ResumoDevolucao {
  const ls = dia ? linhas.filter((l) => l.dia === dia) : linhas;
  const g = new Map<number, DevolucaoMotResumo>();
  for (const l of ls) {
    const m = g.get(l.codMotorista) ?? { codMotorista: l.codMotorista, nome: l.nome, tipo: l.tipo, expedidas: 0, devolvidas: 0, taxa: null, valorExpedido: 0, valorDevolvido: 0 };
    m.expedidas += l.expedidas;
    m.devolvidas += l.devolvidas;
    m.valorExpedido += l.valorExpedido;
    m.valorDevolvido += l.valorDevolvido;
    g.set(l.codMotorista, m);
  }
  const porMotorista = [...g.values()]
    .map((m) => ({ ...m, taxa: div(m.devolvidas, m.expedidas) }))
    .sort((a, b) => b.devolvidas - a.devolvidas || b.valorDevolvido - a.valorDevolvido);
  const soma = (k: "expedidas" | "devolvidas" | "valorExpedido" | "valorDevolvido") => porMotorista.reduce((t, m) => t + m[k], 0);
  const expedidas = soma("expedidas");
  const devolvidas = soma("devolvidas");
  return { expedidas, devolvidas, valorExpedido: soma("valorExpedido"), valorDevolvido: soma("valorDevolvido"), taxa: div(devolvidas, expedidas), porMotorista };
}

export function devolucaoPorDia(linhas: DevolucaoMotDia[]): Map<string, { expedidas: number; devolvidas: number; taxa: number | null }> {
  const m = new Map<string, { expedidas: number; devolvidas: number; taxa: number | null }>();
  for (const l of linhas) {
    const d = m.get(l.dia) ?? { expedidas: 0, devolvidas: 0, taxa: null };
    d.expedidas += l.expedidas;
    d.devolvidas += l.devolvidas;
    d.taxa = div(d.devolvidas, d.expedidas);
    m.set(l.dia, d);
  }
  return m;
}
