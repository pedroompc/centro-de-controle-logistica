import { describe, it, expect } from "vitest";
import { montarSaude, cronometrar } from "./saude";

const ok = { ok: true, ms: 10 };
const fora = { ok: false, ms: null, erro: "sem resposta" };

describe("montarSaude", () => {
  it("tudo respondendo = 200", () => {
    const s = montarSaude({ oracle: ok, supabase: ok, coletor: { estado: "ok", minutos: 3 } });
    expect(s).toMatchObject({ ok: true, status: 200 });
  });

  it("Winthor ou Supabase fora = 503", () => {
    expect(montarSaude({ oracle: fora, supabase: ok, coletor: null }).status).toBe(503);
    expect(montarSaude({ oracle: ok, supabase: fora, coletor: null }).status).toBe(503);
  });

  it("coletor parado derruba; atrasado não", () => {
    expect(montarSaude({ oracle: ok, supabase: ok, coletor: { estado: "parado", minutos: 300 } }).status).toBe(503);
    expect(montarSaude({ oracle: ok, supabase: ok, coletor: { estado: "atrasado", minutos: 45 } }).status).toBe(200);
  });

  it("sem chave para ler o coletor: não checa, não derruba", () => {
    const s = montarSaude({ oracle: ok, supabase: ok, coletor: null });
    expect(s.coletor).toEqual({ estado: "nao-checado", minutos: null });
    expect(s.status).toBe(200);
  });
});

describe("cronometrar", () => {
  it("mede o tempo de quem responde", async () => {
    const c = await cronometrar(async () => 1);
    expect(c.ok).toBe(true);
    expect(c.ms).toBeGreaterThanOrEqual(0);
  });

  it("corta quem passa do teto e guarda só a 1ª linha do erro", async () => {
    expect(await cronometrar(() => new Promise(() => {}), 20)).toMatchObject({ ok: false, erro: "sem resposta em 0.02 s" });
    expect(await cronometrar(async () => { throw new Error("ORA-1\nhost secreto"); })).toMatchObject({ ok: false, erro: "ORA-1" });
  });
});
