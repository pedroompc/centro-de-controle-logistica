import { describe, expect, it } from "vitest";
import { baseDasRegioes, ratearPorRegiao, regiaoDaCidade, type TrechoRegiao } from "./custo-regioes";

const t = (over: Partial<TrechoRegiao>): TrechoRegiao => ({
  viagem: "V1", placa: "AAA1A11", dia: "2026-10-01", regiao: "RMR", notas: 1, peso: 100, valor: 1000, entregas: 1, ...over,
});
const km = (pares: [string, string, number][]) => new Map(pares.map(([p, d, k]) => [`${p}|${d}`, k]));

describe("regiaoDaCidade", () => {
  const cal = (c: string | null) => ({ RECIFE: "METROPOLITANA", IPOJUCA: "LITORAL", PETROLINA: "SERTAO", NORONHA: "ESPECIAL" })[c ?? ""] ?? null;
  it("usa a região do calendário de rotas", () => {
    expect(regiaoDaCidade("RECIFE", "PE", cal)).toBe("RMR");
    expect(regiaoDaCidade("IPOJUCA", "PE", cal)).toBe("Litoral");
    expect(regiaoDaCidade("NORONHA", "PE", cal)).toBe("Outras");
  });
  it("fora do calendário cai na mesorregião (nome truncado do Winthor)", () => {
    expect(regiaoDaCidade("SAO BENTO DO UN", "PE", cal)).toBe("Agreste");
    expect(regiaoDaCidade("SALVADOR", "BA", cal)).toBe("Outras");
  });
});

describe("baseDasRegioes", () => {
  it("km da viagem vai até a véspera da próxima saída do caminhão", () => {
    const trechos = [t({ dia: "2026-10-01", regiao: "Sertão" }), t({ viagem: "V2", dia: "2026-10-04", regiao: "RMR" })];
    const mapa = km([["AAA1A11", "2026-10-01", 2], ["AAA1A11", "2026-10-02", 300], ["AAA1A11", "2026-10-03", 300], ["AAA1A11", "2026-10-04", 50]]);
    const b = baseDasRegioes(trechos, mapa, "2026-10-31");
    expect(b.find((x) => x.regiao === "Sertão")!.kmMedido).toBe(602);
    expect(b.find((x) => x.regiao === "RMR")!.kmMedido).toBe(50);
  });

  it("janela não passa de 7 dias nem do fim do período", () => {
    const mapa = km(Array.from({ length: 12 }, (_, i) => ["AAA1A11", `2026-10-${String(20 + i).padStart(2, "0")}`, 10] as [string, string, number]));
    expect(baseDasRegioes([t({ dia: "2026-10-20" })], mapa, "2026-10-31")[0].kmMedido).toBe(70);
    expect(baseDasRegioes([t({ dia: "2026-10-28" })], mapa, "2026-10-31")[0].kmMedido).toBe(40);
  });

  it("carga mista divide o km pelo peso", () => {
    const trechos = [t({ regiao: "Zona da Mata", peso: 300 }), t({ regiao: "Agreste", peso: 100 })];
    const b = baseDasRegioes(trechos, km([["AAA1A11", "2026-10-01", 400]]), "2026-10-31");
    expect(b.find((x) => x.regiao === "Zona da Mata")!.kmMedido).toBe(300);
    expect(b.find((x) => x.regiao === "Agreste")!.kmMedido).toBe(100);
  });

  it("caminhão sem rastreador recebe a média de km por viagem da região", () => {
    const trechos = [
      t({ regiao: "Sertão" }),
      t({ viagem: "V2", placa: "BBB2B22", regiao: "Sertão" }),
      t({ viagem: "V3", placa: "BBB2B22", dia: "2026-10-02", regiao: "RMR" }),
    ];
    const b = baseDasRegioes(trechos, km([["AAA1A11", "2026-10-01", 800]]), "2026-10-31");
    const sertao = b.find((x) => x.regiao === "Sertão")!;
    expect(sertao.kmMedido).toBe(800);
    expect(sertao.kmEstimado).toBe(800);
    // RMR não tem viagem medida → média geral (800 km / 1 viagem)
    expect(b.find((x) => x.regiao === "RMR")!.kmEstimado).toBe(800);
  });

  it("retira soma notas mas não tem km", () => {
    const b = baseDasRegioes([t({ viagem: null, placa: null, regiao: "Retira", notas: 5 })], new Map(), "2026-10-31");
    expect(b).toEqual([expect.objectContaining({ regiao: "Retira", notas: 5, kmMedido: 0, kmEstimado: 0, viagens: 0 })]);
  });
});

describe("ratearPorRegiao", () => {
  it("entrega pelo km, galpão pelas notas, soma bate com o total", () => {
    const base = baseDasRegioes(
      [t({ regiao: "RMR", notas: 3 }), t({ viagem: "V2", placa: "CCC3C33", regiao: "Sertão", notas: 1 }), t({ viagem: null, placa: null, regiao: "Retira", notas: 4 })],
      km([["AAA1A11", "2026-10-01", 100], ["CCC3C33", "2026-10-01", 300]]),
      "2026-10-31",
    );
    const r = ratearPorRegiao(base, 1000, 800);
    const por = Object.fromEntries(r.map((x) => [x.regiao, x]));
    expect(por.RMR.custoEntrega).toBe(250);
    expect(por["Sertão"].custoEntrega).toBe(750);
    expect(por.Retira.custoEntrega).toBe(0);
    expect(por.RMR.custoGalpao).toBe(300);
    expect(por.Retira.custoGalpao).toBe(400);
    expect(r.reduce((s, x) => s + x.custo, 0)).toBe(1800);
  });
});
