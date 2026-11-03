import { describe, it, expect } from "vitest";
import { custoFrota, rotuloTipo, type CadastroFrota } from "./frota-custo";
import type { ResumoKm, KmVeiculo } from "./frota";

const veiculo = (over: Partial<KmVeiculo>): KmVeiculo => ({
  placa: "PDO8543", descricao: null, km: 510, diasRodados: 3, viagens: 3, entregas: 30, kmPorEntrega: 17, ...over,
});

const resumo = (porVeiculo: KmVeiculo[]): ResumoKm => ({
  km: porVeiculo.reduce((s, v) => s + (v.km ?? 0), 0),
  kmEmViagem: 0, veiculos: porVeiculo.length, rastreados: porVeiculo.filter((v) => v.km !== null).length,
  entregasRastreadas: 0, kmPorEntrega: null, porDia: new Map(), porVeiculo,
});

const cadastro: CadastroFrota = {
  parametros: { precoDiesel: 7, desgasteMensal: 3000, manutencaoMensal: 6000 },
  modelos: [{ modelo: "13.190", kmPorLitro: 4.25 }, { modelo: "11.180", kmPorLitro: 5 }],
  veiculos: [
    { placa: "PDO-8543", modelo: "13.190", tipo: "Toco" },
    { placa: "RZI1B33", modelo: "11.180", tipo: "Três quarto" },
  ],
};

describe("custoFrota", () => {
  it("diesel = km ÷ km/L do modelo × preço do litro", () => {
    const c = custoFrota(resumo([veiculo({})]), cadastro, 1);
    expect(c.litros).toBeCloseTo(120);
    expect(c.diesel).toBeCloseTo(840);
    expect(c.porVeiculo.get("PDO8543")).toMatchObject({ modelo: "13.190", tipo: "Toco" });
  });

  it("desgaste e manutenção pela fração do mês do recorte", () => {
    const c = custoFrota(resumo([veiculo({})]), cadastro, 0.5);
    expect(c.desgaste).toBe(1500);
    expect(c.manutencao).toBe(3000);
    expect(c.total).toBeCloseTo(840 + 4500);
    expect(c.custoPorKm).toBeCloseTo((840 + 4500) / 510);
  });

  it("placa com km fora do cadastro fica listada e sem diesel; sem rastreador é ignorada", () => {
    const c = custoFrota(resumo([veiculo({}), veiculo({ placa: "TER0001", km: 100 }), veiculo({ placa: "SEM0001", km: null })]), cadastro, 1);
    expect(c.semCadastro).toEqual(["TER0001"]);
    expect(c.kmComCadastro).toBe(510);
  });

  it("agrupa por tipo, com o três quarto separado pela referência do modelo", () => {
    const c = custoFrota(resumo([veiculo({}), veiculo({ placa: "RZI1B33", km: 1000 })]), cadastro, 1);
    expect(c.porTipo.map((t) => t.tipo)).toEqual(["Três quarto (Ref. 11)", "Toco"]);
    expect(c.porTipo[0].diesel).toBeCloseTo(1400);
  });
});

describe("rotuloTipo", () => {
  it("só o três quarto ganha a referência", () => {
    expect(rotuloTipo("Três quarto", "9.170")).toBe("Três quarto (Ref. 9)");
    expect(rotuloTipo("Toco", "17.230")).toBe("Toco");
    expect(rotuloTipo("Kia Bongo", "KIA BONGO")).toBe("Kia Bongo");
  });
});
