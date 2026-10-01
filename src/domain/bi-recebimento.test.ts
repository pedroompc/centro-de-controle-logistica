import { describe, it, expect } from "vitest";
import { fatosDoMes, filtrarFatos, resumir, agrupar, custoNoRecorte } from "./bi-recebimento";
import { agregarPorMes, diariosDosLancamentos } from "./descarregamento-tendencia";
import type { TotalDiarioDescarregamento } from "./types";

const lanc = (data: string, fornecedorNome: string, tipo: "batido" | "paletizado" | "pal_rem" | "volume", pesoKg: number, receita: number, extra: { quantidade?: number; carros?: number } = {}) => ({
  data,
  fornecedorNome,
  tipo,
  pesoKg,
  receita,
  quantidade: extra.quantidade ?? null,
  carros: extra.carros ?? null,
});
const lancs = [
  lanc("2026-09-01", "NESTLE", "pal_rem", 20_000, 1200),
  lanc("2026-09-01", "NESTLE", "pal_rem", 18_000, 1100), // 2 notas no mesmo carro
  lanc("2026-09-01", "BRF", "batido", 9_000, 900),
  lanc("2026-09-02", "BRF", "volume", 3_000, 400, { quantidade: 500, carros: 2 }),
];
const carrosDia = [{ data: "2026-09-01", porTipo: { batido: 1, paletizado: 0, pal_rem: 1, volume: 0 } }];
const totais: TotalDiarioDescarregamento[] = [
  { id: "t", data: "2026-09-03", descarregos: 3, porTipo: { batido: 2, paletizado: 1, pal_rem: 0, volume: 100 }, pesoKg: 30_000, receita: 2500, observacao: null },
];
const fatos = fatosDoMes(lancs, totais, carrosDia);

describe("fatosDoMes", () => {
  it("sem filtro, bate com o agregado oficial do mês", () => {
    const oficial = agregarPorMes([...totais, ...diariosDosLancamentos(lancs, carrosDia)])[0];
    const r = resumir(fatos);
    expect(r.carros).toBe(oficial.carros);
    expect(r.pesoKg).toBe(oficial.pesoKg);
    expect(r.receita).toBe(oficial.receita);
    expect(r.caixas).toBe(oficial.caixas);
    expect(r.descargasVolume).toBe(oficial.descargasVolume);
    expect(r.dias).toBe(oficial.dias);
  });
  it("filtro por fornecedor: só as notas dele (sem ajuste nem total do dia)", () => {
    const r = resumir(filtrarFatos(fatos, { fornecedor: "NESTLE" }));
    expect(r.notas).toBe(2);
    expect(r.carros).toBe(2);
    expect(r.pesoKg).toBe(38_000);
  });
  it("filtro por tipo + dia; e 'ignorar' mantém a dimensão do próprio visual", () => {
    expect(resumir(filtrarFatos(fatos, { tipo: "pal_rem", dia: "2026-09-01" })).carros).toBe(1); // contagem real
    const porTipo = agrupar(filtrarFatos(fatos, { tipo: "batido" }, "tipo"), (f) => f.tipo);
    expect(porTipo.map((g) => g.chave).sort()).toEqual(["batido", "pal_rem", "paletizado", "volume"]);
  });
});

describe("custoNoRecorte", () => {
  const base = { custoMes: 30_000, diasMes: 20, pesoMes: 2_000_000, pesoDoDia: 100_000 };
  it("sem filtro = custo do mês; dia = mês ÷ dias; fornecedor = rateio por peso", () => {
    expect(custoNoRecorte({ ...base, pesoRecorte: 2_000_000, filtro: {} }).custo).toBe(30_000);
    expect(custoNoRecorte({ ...base, pesoRecorte: 100_000, filtro: { dia: "x" } }).custo).toBe(1500);
    expect(custoNoRecorte({ ...base, pesoRecorte: 500_000, filtro: { fornecedor: "X" } }).custo).toBe(7500);
    expect(custoNoRecorte({ ...base, pesoRecorte: 50_000, filtro: { dia: "x", fornecedor: "X" } }).custo).toBe(750);
  });
});
