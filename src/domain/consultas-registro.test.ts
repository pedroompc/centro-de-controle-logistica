import { describe, it, expect } from "vitest";
import { rotuloConsulta, classificarErro, resumirConsultas, LIMITE_LENTA_MS, JANELA_MS } from "./consultas-registro";

describe("rotuloConsulta", () => {
  it("nomeia pelas tabelas lidas, sem esquema nem CTE, e não expõe o SQL", () => {
    const sql = `WITH nf AS (SELECT * FROM PCNFSAID n WHERE n.X = :a), viagem AS (SELECT * FROM nf JOIN PCCARREG c ON 1=1)
      SELECT * FROM viagem LEFT JOIN PCVEICUL v ON 1=1`;
    const r = rotuloConsulta(sql);
    expect(r).toMatch(/^PCNFSAID\+PCCARREG·[0-9a-f]{6}$/);
    expect(rotuloConsulta("SELECT * FROM HARPIAW2.PLAN_SEP_MAPA_AVERIG_1197")).toMatch(/^PLAN_SEP_MAPA_AVERIG_1197·/);
    expect(rotuloConsulta("SELECT 1 FROM DUAL")).toMatch(/^SQL·/);
  });
  it("mesmo SQL com espaçamento diferente dá o mesmo rótulo; SQL diferente, outro", () => {
    expect(rotuloConsulta("SELECT a FROM T")).toBe(rotuloConsulta("SELECT  a\n FROM T"));
    expect(rotuloConsulta("SELECT a FROM T")).not.toBe(rotuloConsulta("SELECT b FROM T"));
  });
});

describe("classificarErro", () => {
  it("separa corrupção, conexão perdida, timeout e erro de SQL", () => {
    expect(classificarErro("Attempt to access memory outside buffer bounds")).toBe("buffer-bounds");
    expect(classificarErro("NJS-521: connection to host received end-of-file")).toBe("conexao-perdida");
    expect(classificarErro("NJS-500: connection to Oracle Database was closed or broken")).toBe("conexao-perdida");
    expect(classificarErro("NJS-123: call timeout of 120000 ms exceeded")).toBe("timeout");
    expect(classificarErro("ORA-00942: table or view does not exist")).toBe("sql");
    expect(classificarErro("qualquer coisa")).toBe("outro");
  });
});

describe("resumirConsultas", () => {
  const agora = 10 * JANELA_MS;
  it("conta erros, lista lentas e ignora o que passou da janela de 24 h", () => {
    const r = resumirConsultas(
      [
        { em: agora - 1000, rotulo: "A·1", ms: 200 },
        { em: agora - 2000, rotulo: "B·2", ms: LIMITE_LENTA_MS + 100 },
        { em: agora - 3000, rotulo: "B·2", ms: LIMITE_LENTA_MS + 900 },
        { em: agora - 5 * 60_000, rotulo: "A·1", ms: 50, erro: "buffer-bounds" },
        { em: agora - JANELA_MS - 1, rotulo: "C·3", ms: 99_000, erro: "timeout" },
      ],
      agora,
    );
    expect(r.total).toBe(4);
    expect(r.erros).toEqual({ "buffer-bounds": 1 });
    expect(r.ultimoErro).toEqual({ tipo: "buffer-bounds", ha: 5 });
    expect(r.lentas).toEqual([{ rotulo: "B·2", vezes: 2, maxMs: LIMITE_LENTA_MS + 900 }]);
    expect(r.p95Ms).toBe(LIMITE_LENTA_MS + 900);
  });
  it("sem consultas não inventa número", () => {
    expect(resumirConsultas([], agora)).toMatchObject({ total: 0, erros: {}, ultimoErro: null, lentas: [], p95Ms: null });
  });
});
