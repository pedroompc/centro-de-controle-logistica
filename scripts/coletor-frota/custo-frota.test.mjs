import { describe, it, expect } from "vitest";
import { kmDoDia as kmDoDiaApp, KM_MAX_DIA as KM_MAX_APP } from "../../src/domain/frota.ts";
import { kmDoDia, KM_MAX_DIA, linhasCustoFrota, mesesParaAtualizar, PREFIXO_FROTA } from "./custo-frota.mjs";

const cadastro = {
  precoDiesel: 7,
  desgasteMensal: 1000,
  manutencaoMensal: 2000,
  kmPorLitro: new Map([["13.190", 5], ["11.180", 10]]),
  modeloDaPlaca: new Map([["PDO8543", "13.190"], ["RZF6A21", "11.180"], ["SEMKML", "X.999"]]),
};
const h = (placa, dia, min, max, gps = null) => ({ placa, dia, hodometro_min_m: min, hodometro_max_m: max, km_gps: gps });

describe("kmDoDia", () => {
  it("é a mesma regra do app (src/domain/frota.ts)", () => {
    expect(KM_MAX_DIA).toBe(KM_MAX_APP);
    const casos = [h("A", "d", 0, 100_000), h("A", "d", 100_000, 0), h("A", "d", 0, 2_000_000), h("A", "d", null, null, 42), h("A", "d", null, null, 9999), h("A", "d", null, null)];
    for (const c of casos) {
      expect(kmDoDia(c)).toBe(kmDoDiaApp({ placa: c.placa, dia: c.dia, hodometroMinM: c.hodometro_min_m, hodometroMaxM: c.hodometro_max_m, kmGps: c.km_gps }));
    }
  });
});

describe("linhasCustoFrota", () => {
  it("diesel = km ÷ km/L do modelo × preço; desgaste e manutenção = valor do mês", () => {
    const linhas = linhasCustoFrota(
      [
        h("PDO8543", "2026-11-03", 0, 100_000), // 100 km ÷ 5 = 20 L
        h("RZF6A21", "2026-11-03", null, null, 50), // 50 km (GPS) ÷ 10 = 5 L
        h("PDO8543", "2026-11-04", 0, 9_000_000), // salto de hodômetro: descartado
      ],
      cadastro,
    );
    expect(linhas).toEqual([
      { nome: `${PREFIXO_FROTA}Diesel (estimado)`, tipo: "variavel", valor: 175 }, // 25 L × 7
      { nome: `${PREFIXO_FROTA}Desgaste`, tipo: "fixo", valor: 1000 },
      { nome: `${PREFIXO_FROTA}Manutenção`, tipo: "fixo", valor: 2000 },
    ]);
  });

  it("ignora placa fora da frota ativa ou sem km/L cadastrado", () => {
    const [diesel] = linhasCustoFrota([h("RZP3A43", "2026-11-03", 0, 100_000), h("SEMKML", "2026-11-03", 0, 100_000)], cadastro);
    expect(diesel.valor).toBe(0);
  });

  it("normaliza a placa gravada", () => {
    const [diesel] = linhasCustoFrota([h("pdo-8543", "2026-11-03", 0, 10_000)], cadastro);
    expect(diesel.valor).toBe(14); // 10 km ÷ 5 × 7
  });
});

describe("mesesParaAtualizar", () => {
  const hoje = new Date("2026-11-17T12:00:00Z");
  it("preenche os meses que faltam e refaz o mês corrente", () => {
    expect(mesesParaAtualizar("2026-07-01", hoje, new Set(["2026-07-01", "2026-08-01"]))).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(mesesParaAtualizar("2026-07-01", hoje, new Set(["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"]))).toEqual(["2026-11-01"]);
  });
  it("até o dia 3 do mês ainda refaz o anterior (km do último dia chega depois)", () => {
    const todos = new Set(["2026-10-01", "2026-11-01"]);
    expect(mesesParaAtualizar("2026-10-01", new Date("2026-11-03T12:00:00Z"), todos)).toEqual(["2026-10-01", "2026-11-01"]);
    expect(mesesParaAtualizar("2026-10-01", new Date("2026-11-04T12:00:00Z"), todos)).toEqual(["2026-11-01"]);
  });
});
