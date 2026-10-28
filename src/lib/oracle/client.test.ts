import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPool: vi.fn(),
}));

vi.mock("oracledb", () => ({
  default: { OUT_FORMAT_OBJECT: 4002, CLOB: 2017, createPool: mocks.createPool },
}));

import { queryWinthor } from "./client";

function poolFalso(conexao: () => Promise<unknown>) {
  return { getConnection: vi.fn(conexao), close: vi.fn(async () => {}) };
}

function conexaoFalsa(rows: unknown[] = [{ X: 1 }]) {
  return { execute: vi.fn(async (): Promise<{ rows?: unknown[] }> => ({ rows })), close: vi.fn(async () => {}) };
}

beforeEach(() => {
  mocks.createPool.mockReset();
  delete (globalThis as { __poolWinthor?: unknown }).__poolWinthor;
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
});
