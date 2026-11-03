/**
 * KM real da frota pela telemetria (Fulltrack / Siga+), gravada sozinha pelo
 * coletor (scripts/coletor-frota). Por placa e dia o banco guarda a menor e a
 * maior leitura do hodômetro; o km do dia é a diferença. Rastreador sem hodômetro
 * tem o km somado pelo GPS.
 *
 * Frota de ENTREGA = veículos que aparecem nas viagens do Winthor no recorte — os
 * carros do comercial e rastreadores duplicados ficam de fora sozinhos, sem lista
 * fixa de placas. O km do veículo conta todos os dias do período (dia sem viagem
 * também roda e custa); o km POR ENTREGA usa só os dias com viagem.
 */
import type { ViagemEntrega } from "./motoristas";

export interface LinhaHodometro {
  placa: string;
  dia: string; // "yyyy-mm-dd"
  hodometroMinM: number | null;
  hodometroMaxM: number | null;
  kmGps: number | null;
}

/** Acima disso num dia é hodômetro trocado ou leitura errada. */
export const KM_MAX_DIA = 1500;

export const normalizarPlaca = (p: string | null | undefined): string => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const chave = (placa: string, dia: string) => `${placa}|${dia}`;

/** km do dia: hodômetro (se houver e for plausível) → senão GPS → senão null. */
export function kmDoDia(l: LinhaHodometro): number | null {
  if (l.hodometroMinM !== null && l.hodometroMaxM !== null) {
    const km = (l.hodometroMaxM - l.hodometroMinM) / 1000;
    return km < 0 || km > KM_MAX_DIA ? null : km;
  }
  return l.kmGps !== null && l.kmGps >= 0 && l.kmGps <= KM_MAX_DIA ? l.kmGps : null;
}

/** "PLACA|dia" → km do dia (só dias com km válido). */
export function mapaKmDia(linhas: LinhaHodometro[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of linhas) {
    const km = kmDoDia(l);
    if (km !== null) m.set(chave(normalizarPlaca(l.placa), l.dia), km);
  }
  return m;
}

/**
 * km de cada viagem (mesma ordem de `viagens`): o km do dia da placa. Se dois
 * motoristas usaram o carro no mesmo dia, o km é dividido pelas entregas de cada
 * um (igual, se ninguém entregou). Sem telemetria → null.
 */
export function kmDasViagens(viagens: ViagemEntrega[], mapa: Map<string, number>): (number | null)[] {
  const peso = new Map<string, { entregas: number; n: number }>();
  for (const v of viagens) {
    const k = chave(normalizarPlaca(v.placa), v.dia);
    const p = peso.get(k) ?? { entregas: 0, n: 0 };
    p.entregas += v.entregas;
    p.n += 1;
    peso.set(k, p);
  }
  return viagens.map((v) => {
    const k = chave(normalizarPlaca(v.placa), v.dia);
    const km = mapa.get(k);
    if (km === undefined) return null;
    const p = peso.get(k)!;
    return p.entregas > 0 ? (km * v.entregas) / p.entregas : km / p.n;
  });
}

export interface KmVeiculo {
  placa: string;
  descricao: string | null;
  km: number | null; // null = sem rastreador / sem telemetria no recorte
  diasRodados: number;
  viagens: number;
  entregas: number;
  kmPorEntrega: number | null; // km nos dias de viagem ÷ entregas
}

export interface ResumoKm {
  km: number; // total da frota de entrega rastreada no recorte
  kmEmViagem: number; // só dias com viagem
  veiculos: number; // veículos com viagem no recorte
  rastreados: number; // desses, quantos têm telemetria
  entregasRastreadas: number;
  kmPorEntrega: number | null;
  porDia: Map<string, number>;
  porVeiculo: KmVeiculo[];
}

export function resumoKm(viagens: ViagemEntrega[], mapa: Map<string, number>, dia: string | null): ResumoKm {
  const noRecorte = (d: string) => !dia || d === dia;
  const vs = viagens.filter((v) => noRecorte(v.dia));
  const veic = new Map<string, { descricao: string | null; dias: Set<string>; viagens: number; entregas: number }>();
  for (const v of vs) {
    const placa = normalizarPlaca(v.placa);
    if (!placa) continue;
    const g = veic.get(placa) ?? { descricao: v.descricaoVeiculo, dias: new Set<string>(), viagens: 0, entregas: 0 };
    g.dias.add(v.dia);
    g.viagens += 1;
    g.entregas += v.entregas;
    veic.set(placa, g);
  }

  const kmPorPlaca = new Map<string, { km: number; dias: number }>();
  const porDia = new Map<string, number>();
  for (const [k, km] of mapa) {
    const [placa, d] = k.split("|");
    if (!veic.has(placa) || !noRecorte(d)) continue;
    const p = kmPorPlaca.get(placa) ?? { km: 0, dias: 0 };
    p.km += km;
    if (km > 0) p.dias += 1;
    kmPorPlaca.set(placa, p);
    porDia.set(d, (porDia.get(d) ?? 0) + km);
  }

  let kmEmViagem = 0;
  let entregasRastreadas = 0;
  const porVeiculo: KmVeiculo[] = [...veic.entries()].map(([placa, g]) => {
    const t = kmPorPlaca.get(placa);
    let kmViagem = 0;
    let temKm = false;
    for (const d of g.dias) {
      const km = mapa.get(chave(placa, d));
      if (km !== undefined) {
        kmViagem += km;
        temKm = true;
      }
    }
    if (temKm) {
      kmEmViagem += kmViagem;
      entregasRastreadas += g.entregas;
    }
    return {
      placa,
      descricao: g.descricao,
      km: t ? t.km : null,
      diasRodados: t?.dias ?? 0,
      viagens: g.viagens,
      entregas: g.entregas,
      kmPorEntrega: temKm && g.entregas > 0 ? kmViagem / g.entregas : null,
    };
  });
  porVeiculo.sort((a, b) => (b.km ?? -1) - (a.km ?? -1) || b.viagens - a.viagens);

  return {
    km: [...kmPorPlaca.values()].reduce((s, p) => s + p.km, 0),
    kmEmViagem,
    veiculos: veic.size,
    rastreados: kmPorPlaca.size,
    entregasRastreadas,
    kmPorEntrega: entregasRastreadas > 0 ? kmEmViagem / entregasRastreadas : null,
    porDia,
    porVeiculo,
  };
}
