import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPool: vi.fn(),
}));

vi.mock("oracledb", () => ({
  default: { OUT_FORMAT_OBJECT: 4002, CLOB: 2017, createPool: mocks.createPool },
}));

import { queryWinthor, conexaoSuspeita, TEMPO_MAX_CONSULTA_MS } from "./client";
import { eventosConsulta } from "./registro";

function poolFalso(conexao: () => Promise<unknown>) {
  return { getConnection: vi.fn(conexao), close: vi.fn(async () => {}) };
}

function conexaoFalsa(rows: unknown[] = [{ X: 1 }]) {
  return { execute: vi.fn(async (): Promise<{ rows?: unknown[] }> => ({ rows })), close: vi.fn(async () => {}) };
}

beforeEach(() => {
  mocks.createPool.mockReset();
  delete (globalThis as { __poolWinthor?: unknown }).__poolWinthor;
  delete (globalThis as { __poolWinthorAtual?: unknown }).__poolWinthorAtual;
  delete (globalThis as { __consultasOracle?: unknown }).__consultasOracle;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("queryWinthor", () => {
  it("reaproveita o pool entre consultas", async () => {
    const c = conexaoFalsa();
    const pool = poolFalso(async () => c);
    mocks.createPool.mockResolvedValue(pool);

    await queryWinthor("SELECT 1 FROM DUAL");
    await queryWinthor("SELECT 1 FROM DUAL");

    expect(mocks.createPool).toHaveBeenCalledTimes(1);
    expect(pool.getConnection).toHaveBeenCalledTimes(2);
    expect(c.close).toHaveBeenCalledTimes(2);
  });

  it("devolve result.rows ou []", async () => {
    const c = conexaoFalsa();
    c.execute.mockResolvedValue({ rows: undefined });
    mocks.createPool.mockResolvedValue(poolFalso(async () => c));
    expect(await queryWinthor("SELECT 1 FROM DUAL")).toEqual([]);
  });

  it("recria o pool quando ele morre", async () => {
    const morto = poolFalso(async () => {
      throw new Error("NJS-521");
    });
    const novo = poolFalso(async () => conexaoFalsa());
    mocks.createPool.mockResolvedValueOnce(morto).mockResolvedValueOnce(novo);

    await expect(queryWinthor("SELECT 1 FROM DUAL")).rejects.toThrow("NJS-521");
    expect(await queryWinthor("SELECT 1 FROM DUAL")).toEqual([{ X: 1 }]);
    expect(mocks.createPool).toHaveBeenCalledTimes(2);
    expect(morto.close).toHaveBeenCalled();
  });

  it("fecha a conexão mesmo se execute falhar", async () => {
    const c = conexaoFalsa();
    c.execute.mockRejectedValue(new Error("ORA-00942"));
    mocks.createPool.mockResolvedValue(poolFalso(async () => c));

    await expect(queryWinthor("SELECT * FROM NADA")).rejects.toThrow("ORA-00942");
    expect(c.close).toHaveBeenCalled();
  });

  it("erro de SQL devolve a conexão ao pool e mantém o pool", async () => {
    const c = conexaoFalsa();
    c.execute.mockRejectedValue(new Error("ORA-00942: table or view does not exist"));
    const pool = poolFalso(async () => c);
    mocks.createPool.mockResolvedValue(pool);

    await expect(queryWinthor("SELECT * FROM NADA")).rejects.toThrow("ORA-00942");
    expect(c.close).toHaveBeenCalledWith();
    expect(pool.close).not.toHaveBeenCalled();
  });

  it("conexão corrompida sai do pool (drop) e o pool é recriado", async () => {
    const ruim = conexaoFalsa();
    ruim.execute.mockRejectedValue(new RangeError("Attempt to access memory outside buffer bounds"));
    const velho = poolFalso(async () => ruim);
    const novo = poolFalso(async () => conexaoFalsa());
    mocks.createPool.mockResolvedValueOnce(velho).mockResolvedValueOnce(novo);

    await expect(queryWinthor("SELECT 1 FROM DUAL")).rejects.toThrow("buffer bounds");
    expect(ruim.close).toHaveBeenCalledWith({ drop: true });
    expect(velho.close).toHaveBeenCalled();
    expect(await queryWinthor("SELECT 1 FROM DUAL")).toEqual([{ X: 1 }]);
    expect(mocks.createPool).toHaveBeenCalledTimes(2);
  });

  it("registra cada consulta, com o tipo do erro quando falha", async () => {
    const ruim = conexaoFalsa();
    ruim.execute.mockRejectedValueOnce(new RangeError("Attempt to access memory outside buffer bounds"));
    mocks.createPool.mockResolvedValue(poolFalso(async () => ruim));

    await expect(queryWinthor("SELECT X FROM PCNFSAID")).rejects.toThrow();
    await queryWinthor("SELECT X FROM PCNFSAID");
    const ev = eventosConsulta();
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ rotulo: expect.stringMatching(/^PCNFSAID·/), erro: "buffer-bounds" });
    expect(ev[1].erro).toBeUndefined();
  });

  it("aplica o teto de tempo na conexão", async () => {
    const c = conexaoFalsa() as ReturnType<typeof conexaoFalsa> & { callTimeout?: number };
    mocks.createPool.mockResolvedValue(poolFalso(async () => c));
    await queryWinthor("SELECT 1 FROM DUAL");
    expect(c.callTimeout).toBe(TEMPO_MAX_CONSULTA_MS);
  });
});

describe("conexaoSuspeita", () => {
  it("erro de SQL comum não estraga a conexão", () => {
    expect(conexaoSuspeita(new Error('ORA-00904: "X": invalid identifier'))).toBe(false);
    expect(conexaoSuspeita(new Error("ORA-00918: column ambiguously defined"))).toBe(false);
  });

  it("ORA- de conexão perdida, erro do driver ou do protocolo descartam", () => {
    expect(conexaoSuspeita(new Error("ORA-03113: end-of-file on communication channel"))).toBe(true);
    expect(conexaoSuspeita(new RangeError("Attempt to access memory outside buffer bounds"))).toBe(true);
    expect(conexaoSuspeita(new Error("NJS-500: connection to the Oracle Database was broken"))).toBe(true);
    expect(conexaoSuspeita(new Error("NJS-123: call timeout of 120000 ms exceeded"))).toBe(true);
  });
});
