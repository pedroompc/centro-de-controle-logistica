import { describe, it, expect } from "vitest";
import {
  cidadesPorMotorista, ehSetorMotoristas, papelMotoristas, resumoDevolucao, devolucaoPorDia, type DevolucaoMotDia, totaisEntregas, porMotorista, porVeiculo, porDiaEntregas, faixasOcupacao, type ViagemEntrega,
} from "./motoristas";

const v = (x: Partial<ViagemEntrega>): ViagemEntrega => ({
  dia: "2026-10-06",
  veiculo: 1,
  placa: "AAA0001",
  descricaoVeiculo: "VW 8.160",
  capacidadeKg: 4000,
  motorista: 10,
  nomeMotorista: "JOÃO",
  tipoMotorista: "F",
  ajudante: 100,
  nomeAjudante: "PEDRO",
  cargas: 2,
  notas: 20,
  entregas: 15,
  kg: 2000,
  valor: 30_000,
  ...x,
});

describe("motoristas", () => {
  it("reconhece o setor sem acento/caixa", () => {
    expect(ehSetorMotoristas("MOTORISTAS")).toBe(true);
    expect(ehSetorMotoristas("Motorista")).toBe(true);
    expect(ehSetorMotoristas("Separação")).toBe(false);
  });

  it("função pelo cargo: liderança antes de motorista", () => {
    expect(papelMotoristas("MOTORISTA")).toBe("motorista");
    expect(papelMotoristas("Motorista de caminhão")).toBe("motorista");
    expect(papelMotoristas("AJUDANTE DE MOTORISTA")).toBe("ajudante");
    expect(papelMotoristas("Auxiliar de entrega")).toBe("ajudante");
    expect(papelMotoristas("ENCARREGADO DE FROTA")).toBe("lider");
    expect(papelMotoristas("Supervisor de motoristas")).toBe("lider");
    expect(papelMotoristas("ROTEIRIZADOR")).toBe("outros");
  });

  it("totais do mês e de um dia; ocupação = peso ÷ capacidade das viagens com capacidade", () => {
    const vs = [
      v({}),
      v({ dia: "2026-10-07", veiculo: 2, capacidadeKg: 1000, kg: 800, entregas: 5, notas: 6, motorista: 11 }),
      v({ dia: "2026-10-07", veiculo: 3, capacidadeKg: null, kg: 500, entregas: 1, notas: 1, motorista: 12, ajudante: null }),
    ];
    const t = totaisEntregas(vs);
    expect(t).toMatchObject({ viagens: 3, entregas: 21, notas: 27, kg: 3300, dias: 2, veiculos: 3, motoristas: 3 });
    expect(t.ocupacao).toBeCloseTo(2800 / 5000);
    expect(t.entregasPorViagem).toBe(7);
    const d = totaisEntregas(vs, "2026-10-07");
    expect(d).toMatchObject({ viagens: 2, entregas: 6, kg: 1300, dias: 1 });
    expect(d.ocupacao).toBeCloseTo(0.8);
    expect(totaisEntregas([]).ocupacao).toBeNull();
  });

  it("por motorista: dias distintos, ajudantes distintos, ordenado por entregas", () => {
    const vs = [
      v({ motorista: 10, ajudante: 100 }),
      v({ motorista: 10, dia: "2026-10-07", ajudante: 101, entregas: 10, kg: 1000 }),
      v({ motorista: 20, nomeMotorista: "ANA", tipoMotorista: "T", entregas: 40 }),
    ];
    const r = porMotorista(vs);
    expect(r.map((m) => m.motorista)).toEqual([20, 10]);
    expect(r[1]).toMatchObject({ dias: 2, viagens: 2, entregas: 25, kg: 3000, ajudantes: 2, tipo: "F" });
    expect(r[1].ocupacao).toBeCloseTo(3000 / 8000);
    expect(r[0]).toMatchObject({ nome: "ANA", tipo: "T", ajudantes: 1 });
  });

  it("por veículo: ordenado por viagens", () => {
    const vs = [v({ veiculo: 1 }), v({ veiculo: 2, placa: "BBB" }), v({ veiculo: 2, placa: "BBB", dia: "2026-10-08", motorista: 30 })];
    const r = porVeiculo(vs);
    expect(r[0]).toMatchObject({ veiculo: 2, viagens: 2, dias: 2, motoristas: 2, kg: 4000 });
    expect(r[0].ocupacao).toBeCloseTo(0.5);
  });

  it("por dia e faixas de ocupação (viagem sem capacidade fica fora das faixas)", () => {
    const vs = [
      v({ kg: 1000 }), // 25%
      v({ kg: 3000, dia: "2026-10-07" }), // 75%
      v({ kg: 4400, dia: "2026-10-07" }), // 110%
      v({ capacidadeKg: null }),
    ];
    const pd = porDiaEntregas(vs);
    expect(pd.get("2026-10-07")).toMatchObject({ viagens: 2, kg: 7400 });
    const f = faixasOcupacao(vs);
    expect(f.map((x) => x.qtd)).toEqual([1, 0, 1, 0, 1]);
    expect(f.reduce((s, x) => s + x.qtd, 0)).toBe(3);
  });
});

const dv = (x: Partial<DevolucaoMotDia>): DevolucaoMotDia => ({
  dia: "2026-10-06", codMotorista: 10, nome: "JOÃO", tipo: "F", expedidas: 100, devolvidas: 2, valorExpedido: 10_000, valorDevolvido: 300, ...x,
});

describe("devolução por faturamento", () => {
  const ls = [
    dv({}),
    dv({ dia: "2026-10-07", devolvidas: 8, valorDevolvido: 900 }),
    dv({ codMotorista: 20, nome: "ANA", tipo: "T", expedidas: 50, devolvidas: 0, valorDevolvido: 0 }),
  ];
  it("resume o mês e soma por motorista (taxa em fração)", () => {
    const r = resumoDevolucao(ls);
    expect(r).toMatchObject({ expedidas: 250, devolvidas: 10, valorDevolvido: 1200 });
    expect(r.taxa).toBeCloseTo(0.04);
    expect(r.porMotorista[0]).toMatchObject({ codMotorista: 10, expedidas: 200, devolvidas: 10 });
    expect(r.porMotorista[0].taxa).toBeCloseTo(0.05);
    expect(r.porMotorista[1].taxa).toBe(0);
  });
  it("recorta um dia", () => {
    const r = resumoDevolucao(ls, "2026-10-07");
    expect(r).toMatchObject({ expedidas: 100, devolvidas: 8 });
    expect(r.porMotorista).toHaveLength(1);
    expect(resumoDevolucao([]).taxa).toBeNull();
  });
  it("taxa por dia", () => {
    const m = devolucaoPorDia(ls);
    expect(m.get("2026-10-06")).toMatchObject({ expedidas: 150, devolvidas: 2 });
    expect(m.get("2026-10-06")!.taxa).toBeCloseTo(2 / 150);
    expect(m.get("2026-10-07")!.taxa).toBeCloseTo(0.08);
  });
});

describe("cidadesPorMotorista", () => {
  const l = (codMotorista: number, cidade: string, notas: number, clientes: number, clientesDevolveram = 0) =>
    ({ codMotorista, cidade, notas, clientes, devolvidas: clientesDevolveram, clientesDevolveram, valorDevolvido: 0 });

  it("agrupa por motorista, soma clientes e ordena cidades por notas", () => {
    const m = cidadesPorMotorista([l(1, "OLINDA · PE", 5, 4, 1), l(1, "RECIFE · PE", 20, 15, 2), l(2, "PAULISTA · PE", 3, 3)]);
    expect(m.get(1)).toMatchObject({ clientes: 19, clientesDevolveram: 3 });
    expect(m.get(1)!.cidades.map((c) => c.cidade)).toEqual(["RECIFE · PE", "OLINDA · PE"]);
    expect(m.get(2)!.cidades).toHaveLength(1);
  });
});
