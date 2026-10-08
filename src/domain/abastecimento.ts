/**
 * Abastecimento — regras do BI do setor. Quem prepara o abastecimento no
 * Harpia (`PREP_USU_FK_809`) é o FATURAMENTO gerando a ordem, não quem
 * executa no piso — por isso aqui nunca se rankeia por usuário do Harpia;
 * rendimento é sempre da EQUIPE cadastrada no setor (headcount do app).
 */
import { normalizarTexto } from "./recebimento";

export type PapelAbastecimento = "lider" | "operador";

export function ehSetorAbastecimento(nome: string): boolean {
  return normalizarTexto(nome).includes("abastec");
}

export function papelAbastecimento(cargo: string): PapelAbastecimento {
  const c = normalizarTexto(cargo);
  if (c.includes("lider") || c.includes("encarreg") || c.includes("supervis") || c.includes("coorden")) return "lider";
  return "operador";
}

export interface ResumoVolumeAbast {
  abastecimentos: number;
  caixas: number;
  unidades: number;
  dias: number; // dias do recorte com abastecimento
  skusMedioDia: number | null; // média de SKUs distintos abastecidos por dia (não soma — o mesmo SKU se repete em vários dias)
}

export function resumoVolume(dias: { abastecimentos: number; caixas: number; unidades: number; skus: number }[]): ResumoVolumeAbast {
  const r = { abastecimentos: 0, caixas: 0, unidades: 0, dias: 0 };
  let somaSkus = 0;
  for (const d of dias) {
    r.abastecimentos += d.abastecimentos;
    r.caixas += d.caixas;
    r.unidades += d.unidades;
    if (d.abastecimentos > 0) {
      r.dias += 1;
      somaSkus += d.skus;
    }
  }
  return { ...r, skusMedioDia: r.dias > 0 ? somaSkus / r.dias : null };
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/** Faixas de folga entre o abastecimento e o fim da separação da carga. */
export const FAIXAS_ANTECEDENCIA: { chave: string; rotulo: string; teste: (h: number) => boolean }[] = [
  { chave: "depois", rotulo: "depois/junto", teste: (h) => h <= 0 },
  { chave: "0-1h", rotulo: "até 1h", teste: (h) => h > 0 && h <= 1 },
  { chave: "1-6h", rotulo: "1-6h", teste: (h) => h > 1 && h <= 6 },
  { chave: "6-24h", rotulo: "6-24h", teste: (h) => h > 6 && h <= 24 },
  { chave: "24-72h", rotulo: "24-72h", teste: (h) => h > 24 && h <= 72 },
  { chave: "72h+", rotulo: "72h+", teste: (h) => h > 72 },
];

export interface ResumoAntecedencia {
  total: number; // cargas com abastecimento no recorte
  semSeparacao: number; // carga ainda sem DTFINALSEP no recorte
  antes: number; // abastecido com folga positiva
  depoisOuJunto: number;
  medianaHoras: number | null;
  faixas: { chave: string; rotulo: string; qtd: number }[];
}

/** `horasFolga` = horas entre o 1º abastecimento e o fim da separação da carga; `null` = carga sem separação ainda. */
export function resumoAntecedencia(cargas: { horasFolga: number | null }[]): ResumoAntecedencia {
  const comDado = cargas.filter((c): c is { horasFolga: number } => c.horasFolga !== null);
  return {
    total: cargas.length,
    semSeparacao: cargas.length - comDado.length,
    antes: comDado.filter((c) => c.horasFolga > 0).length,
    depoisOuJunto: comDado.filter((c) => c.horasFolga <= 0).length,
    medianaHoras: mediana(comDado.map((c) => c.horasFolga)),
    faixas: FAIXAS_ANTECEDENCIA.map((f) => ({ chave: f.chave, rotulo: f.rotulo, qtd: comDado.filter((c) => f.teste(c.horasFolga)).length })),
  };
}
