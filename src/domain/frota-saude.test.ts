import { describe, it, expect } from "vitest";
import { saudeColetor, haQuanto } from "./frota-saude";

const agora = new Date("2026-11-04T10:00:00-03:00");
const min = (m: number) => new Date(agora.getTime() - m * 60_000);

describe("saudeColetor", () => {
  it("ok até 30 min, atrasado até 2 h, parado depois", () => {
    expect(saudeColetor(min(8), [], agora)).toMatchObject({ estado: "ok", minutos: 8 });
    expect(saudeColetor(min(45), [], agora).estado).toBe("atrasado");
    expect(saudeColetor(min(121), [], agora).estado).toBe("parado");
  });

  it("sem gravação recente = sem-dados", () => {
    expect(saudeColetor(null, [], agora)).toEqual({ estado: "sem-dados", minutos: null, comunicando: 0 });
  });

  it("conta só as placas com leitura nas últimas 24 h", () => {
    const leituras = [{ ultimaLeitura: min(10) }, { ultimaLeitura: min(23 * 60) }, { ultimaLeitura: min(25 * 60) }, { ultimaLeitura: null }];
    expect(saudeColetor(min(10), leituras, agora).comunicando).toBe(2);
  });
});

describe("haQuanto", () => {
  it("formata o atraso", () => {
    expect(haQuanto(1)).toBe("agora");
    expect(haQuanto(25)).toBe("há 25 min");
    expect(haQuanto(185)).toBe("há 3 h");
    expect(haQuanto(3 * 24 * 60)).toBe("há 3 dias");
  });
});
