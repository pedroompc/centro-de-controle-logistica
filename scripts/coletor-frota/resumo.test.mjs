import { describe, it, expect } from "vitest";
import {
  dataEvento,
  diaRecife,
  normalizarPlaca,
  leiturasRecentes,
  resumirHodometroPorDia,
  kmGpsPorDia,
  janelasHistorico,
} from "./resumo.mjs";

const ev = (over) => ({
  ras_vei_placa: "PDO-8543",
  ras_eve_data_gps: "22/10/2026 12:00:00",
  ras_eve_hodometro: "1000000",
  ras_eve_latitude: "-8.05",
  ras_eve_longitude: "-34.9",
  ras_ras_sinal_gps: "1",
  ras_eve_ignicao: "1",
  ...over,
});

describe("datas e placa", () => {
  it("lê a data da Fulltrack como UTC e dá o dia de Recife (UTC−3)", () => {
    const d = dataEvento("22/10/2026 02:30:00");
    expect(d.toISOString()).toBe("2026-10-22T02:30:00.000Z");
    expect(diaRecife(d)).toBe("2026-10-21"); // 23:30 do dia anterior em Recife
    expect(dataEvento("")).toBeNull();
    expect(dataEvento("lixo")).toBeNull();
  });

  it("normaliza a placa sem hífen e em maiúsculas", () => {
    expect(normalizarPlaca(" pdo-8543 ")).toBe("PDO8543");
    expect(normalizarPlaca(null)).toBe("");
  });
});

describe("leiturasRecentes", () => {
  it("pega só posições com hodômetro > 0 e das últimas 48 h", () => {
    const agora = new Date("2026-10-22T15:00:00Z");
    const l = leiturasRecentes(
      [ev({}), ev({ ras_eve_hodometro: "0" }), ev({ ras_eve_data_gps: "01/10/2026 12:00:00" })],
      agora,
    );
    expect(l).toEqual([{ placa: "PDO8543", dia: "2026-10-22", hodometro_m: 1000000, momento: "2026-10-22T12:00:00.000Z" }]);
  });
});

describe("resumirHodometroPorDia", () => {
  it("guarda a menor e a maior leitura de cada placa por dia", () => {
    const l = resumirHodometroPorDia([
      ev({ ras_eve_data_gps: "22/10/2026 11:00:00", ras_eve_hodometro: "1000000" }),
      ev({ ras_eve_data_gps: "22/10/2026 20:00:00", ras_eve_hodometro: "1180000" }),
      ev({ ras_eve_data_gps: "22/10/2026 15:00:00", ras_eve_hodometro: "1090000" }),
      ev({ ras_eve_data_gps: "22/10/2026 16:00:00", ras_eve_hodometro: "0" }),
    ]);
    expect(l).toHaveLength(2);
    expect(l.map((x) => x.hodometro_m).sort()).toEqual([1000000, 1180000]);
    expect(new Set(l.map((x) => x.dia))).toEqual(new Set(["2026-10-22"]));
  });
});

describe("kmGpsPorDia", () => {
  it("soma trechos com ignição ligada e só nos dias sem hodômetro", () => {
    // ~1,11 km por 0,01° de latitude
    const km = kmGpsPorDia([
      ev({ ras_eve_hodometro: "0", ras_eve_data_gps: "22/10/2026 12:00:00", ras_eve_latitude: "-8.00" }),
      ev({ ras_eve_hodometro: "0", ras_eve_data_gps: "22/10/2026 12:10:00", ras_eve_latitude: "-8.01" }),
      ev({ ras_eve_hodometro: "0", ras_eve_data_gps: "22/10/2026 12:20:00", ras_eve_latitude: "-8.02", ras_eve_ignicao: "0" }),
      ev({ ras_eve_hodometro: "0", ras_eve_data_gps: "22/10/2026 12:30:00", ras_eve_latitude: "-8.03", ras_eve_ignicao: "0" }),
    ]);
    expect(km).toHaveLength(1);
    expect(km[0].placa).toBe("PDO8543");
    expect(km[0].km).toBeCloseTo(2.22, 1); // 3º trecho (ambos desligados) não conta
  });

  it("descarta salto impossível (> 150 km/h) e dia que tem hodômetro", () => {
    expect(kmGpsPorDia([
      ev({ ras_eve_data_gps: "22/10/2026 12:00:00", ras_eve_latitude: "-8.0" }),
      ev({ ras_eve_data_gps: "22/10/2026 12:01:00", ras_eve_latitude: "-8.5" }),
    ])).toEqual([]);
    expect(kmGpsPorDia([
      ev({ ras_eve_hodometro: "0", ras_eve_data_gps: "22/10/2026 12:00:00", ras_eve_latitude: "-8.0" }),
      ev({ ras_eve_hodometro: "0", ras_eve_data_gps: "22/10/2026 12:01:00", ras_eve_latitude: "-8.5" }),
    ])).toEqual([]);
  });
});

describe("janelasHistorico", () => {
  it("corta em blocos de 15 dias a partir do início, o último até agora", () => {
    const j = janelasHistorico(new Date("2026-07-01T03:00:00Z"), new Date("2026-07-20T12:00:00Z"));
    expect(j.map((x) => x.inicioDia)).toEqual(["2026-07-01", "2026-07-16"]);
    expect(j[1].fim.toISOString()).toBe("2026-07-20T12:00:00.000Z");
    expect(j[0].fim.getTime() - j[0].inicio.getTime()).toBe(15 * 86400000 - 1000);
  });
});
