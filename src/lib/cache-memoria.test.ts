import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lembrar, limparCache, ttlDoMes } from "./cache-memoria";

const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 28, 9, 0, 0));
  limparCache();
});
afterEach(() => vi.useRealTimers());

describe("lembrar", () => {
  it("devolve o valor guardado dentro do TTL", async () => {
    const f = vi.fn(async () => 42);
    expect(await lembrar("k", 5 * MIN, f)).toBe(42);
    vi.advanceTimersByTime(5 * MIN - 1000);
    expect(await lembrar("k", 5 * MIN, f)).toBe(42);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("busca de novo depois do TTL", async () => {
    const f = vi.fn(async () => 42);
    await lembrar("k", 5 * MIN, f);
    vi.advanceTimersByTime(5 * MIN + 1000);
    await lembrar("k", 5 * MIN, f);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("não guarda erro", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("NJS-521")).mockResolvedValueOnce(7);
    await expect(lembrar("k", 5 * MIN, f)).rejects.toThrow("NJS-521");
    expect(await lembrar("k", 5 * MIN, f)).toBe(7);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("junta chamadas simultâneas", async () => {
    let soltar!: (v: number) => void;
    const f = vi.fn(() => new Promise<number>((r) => (soltar = r)));
    const a = lembrar("k", 5 * MIN, f);
    const b = lembrar("k", 5 * MIN, f);
    soltar(9);
    expect(await a).toBe(9);
    expect(await b).toBe(9);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("chaves diferentes não se misturam", async () => {
    expect(await lembrar("a", MIN, async () => 1)).toBe(1);
    expect(await lembrar("b", MIN, async () => 2)).toBe(2);
  });
});

describe("ttlDoMes", () => {
  const agora = new Date(2026, 9, 28);
  it("mês corrente: 5 min", () => expect(ttlDoMes("2026-10-01", agora)).toBe(300_000));
  it("mês fechado: 60 min", () => expect(ttlDoMes("2026-09-01", agora)).toBe(3_600_000));
});
