import { describe, it, expect } from "vitest";
import { kmDoDia, mapaKmDia, kmDasViagens, resumoKm, normalizarPlaca, type LinhaHodometro } from "./frota";
import type { ViagemEntrega } from "./motoristas";

const hod = (over: Partial<LinhaHodometro>): LinhaHodometro => ({
  placa: "PDO8543", dia: "2026-10-22", hodometroMinM: 1_000_000, hodometroMaxM: 1_150_000, kmGps: null, ...over,
});

const viagem = (over: Partial<ViagemEntrega>): ViagemEntrega => ({
  dia: "2026-10-22", veiculo: 1, placa: "PDO-8543", descricaoVeiculo: "TOCO", capacidadeKg: 8000,
  motorista: 10, nomeMotorista: "JOSE", tipoMotorista: "F", ajudante: null, nomeAjudante: null,
  cargas: 1, notas: 10, entregas: 10, kg: 4000, valor: 10000, ...over,
});

describe("kmDoDia", () => {
  it("usa maior − menor hodômetro do dia", () => {
    expect(kmDoDia(hod({}))).toBe(150);
  });
  it("descarta dia com salto negativo ou acima de 1.500 km (hodômetro trocado)", () => {
    expect(kmDoDia(hod({ hodometroMaxM: 900_000 }))).toBeNull();
    expect(kmDoDia(hod({ hodometroMaxM: 3_000_000 }))).toBeNull();
  });
  it("sem hodômetro, usa o km do GPS; sem nada, null", () => {
    expect(kmDoDia(hod({ hodometroMinM: null, hodometroMaxM: null, kmGps: 72.4 }))).toBe(72.4);
    expect(kmDoDia(hod({ hodometroMinM: null, hodometroMaxM: null }))).toBeNull();
  });
  it("hodômetro tem prioridade sobre o GPS", () => {
    expect(kmDoDia(hod({ kmGps: 999 }))).toBe(150);
  });
});

describe("kmDasViagens", () => {
  it("dá o km do dia da placa à viagem; dois motoristas no mesmo carro dividem pelas entregas", () => {
    const mapa = mapaKmDia([hod({})]);
    const vs = [
      viagem({ motorista: 10, entregas: 30 }),
      viagem({ motorista: 20, entregas: 10 }),
      viagem({ placa: "SEM-0001", veiculo: 2 }),
    ];
    expect(kmDasViagens(vs, mapa)).toEqual([112.5, 37.5, null]);
  });
  it("divide igual quando as viagens não têm entrega", () => {
    const mapa = mapaKmDia([hod({})]);
    expect(kmDasViagens([viagem({ entregas: 0 }), viagem({ entregas: 0, motorista: 2 })], mapa)).toEqual([75, 75]);
  });
});

describe("resumoKm", () => {
  const linhas = [
    hod({}),
    hod({ dia: "2026-10-23", hodometroMinM: 1_150_000, hodometroMaxM: 1_250_000 }), // dia sem viagem: conta no km do veículo
    hod({ placa: "RZP1G87", hodometroMinM: 0, hodometroMaxM: 50_000 }), // carro fora da frota de entrega
  ];
  const vs = [viagem({ entregas: 20 }), viagem({ veiculo: 2, placa: "TER-0001", entregas: 5 })];

  it("soma o km só dos veículos que fizeram viagem, em todos os dias do período", () => {
    const r = resumoKm(vs, mapaKmDia(linhas), null);
    expect(r.km).toBe(250);
    expect(r.veiculos).toBe(2);
    expect(r.rastreados).toBe(1);
    expect(r.diasRodados).toBe(2);
    expect(r.kmPorVeiculoDia).toBe(125);
    expect(r.porDia.get("2026-10-23")).toBe(100);
  });

  it("no recorte de um dia, só aquele dia", () => {
    const r = resumoKm(vs, mapaKmDia(linhas), "2026-10-22");
    expect(r.km).toBe(150);
    expect(r.porVeiculo[0]).toMatchObject({ placa: "PDO8543", km: 150, diasRodados: 1, entregas: 20 });
  });

  it("dia abaixo de 5 km (manobra no pátio) soma no km mas não conta como dia rodado", () => {
    const comPatio = [...linhas, hod({ dia: "2026-10-24", hodometroMinM: 1_250_000, hodometroMaxM: 1_250_800 })];
    const r = resumoKm(vs, mapaKmDia(comPatio), null);
    expect(r.km).toBeCloseTo(250.8);
    expect(r.diasRodados).toBe(2);
    expect(r.kmPorVeiculoDia).toBeCloseTo(250.8 / 2);
  });

  it("sem dia rodado, km por veículo/dia é nulo", () => {
    expect(resumoKm(vs, new Map(), null).kmPorVeiculoDia).toBeNull();
  });

  it("veículo sem rastreador aparece com km nulo", () => {
    const r = resumoKm(vs, mapaKmDia(linhas), null);
    expect(r.porVeiculo.find((v) => v.placa === "TER0001")?.km).toBeNull();
  });
});

describe("normalizarPlaca", () => {
  it("tira pontuação e põe em maiúsculas", () => {
    expect(normalizarPlaca("pdo-8543")).toBe("PDO8543");
    expect(normalizarPlaca(null)).toBe("");
  });
});
