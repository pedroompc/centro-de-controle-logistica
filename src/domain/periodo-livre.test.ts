import { describe, it, expect } from "vitest";
import {
  lerPeriodo, tipoPeriodo, periodoAnterior, periodoAnoPassado, deslocarPeriodo,
  paramsDoPeriodo, eixoDoPeriodo, atalhosPeriodo, rotuloPeriodo, rotuloCurto,
  mesesDoPeriodo, diasNoPeriodo, mesDoPeriodo, PISO_WINTHOR,
} from "./periodo";

const HOJE = new Date(2026, 10, 6, 10); // 06/11/2026
const Q3 = { de: "2026-07-01", ate: "2026-09-30" };

describe("lerPeriodo", () => {
  it("mes vira mês inteiro (mesmo critério do ?mes=)", () => {
    expect(lerPeriodo({ mes: "2026-09" }, { hoje: HOJE })).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
    expect(lerPeriodo({ mes: "2026-09-01" }, { hoje: HOJE })).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
  });
  it("nada → mês atual inteiro", () => {
    expect(lerPeriodo({}, { hoje: HOJE })).toEqual({ de: "2026-11-01", ate: "2026-11-30" });
  });
  it("de/ate vence mes; invertido é desinvertido", () => {
    expect(lerPeriodo({ mes: "2026-08", de: "2026-09-30", ate: "2026-07-01" }, { hoje: HOJE })).toEqual(Q3);
  });
  it("prende no piso e no fim do ano corrente; lixo → mês atual", () => {
    expect(lerPeriodo({ de: "2026-01-01", ate: "2026-08-31" }, { hoje: HOJE }).de).toBe("2026-07-01");
    expect(lerPeriodo({ de: "2026-01-01", ate: "2026-08-31" }, { hoje: HOJE, piso: PISO_WINTHOR }).de).toBe("2026-01-01");
    expect(lerPeriodo({ de: "2026-10-01", ate: "2027-03-01" }, { hoje: HOJE }).ate).toBe("2026-12-31");
    expect(lerPeriodo({ de: "lixo" }, { hoje: HOJE })).toEqual({ de: "2026-11-01", ate: "2026-11-30" });
    expect(lerPeriodo({ de: "2026-02-30" }, { hoje: HOJE })).toEqual({ de: "2026-11-01", ate: "2026-11-30" });
  });
  it("mes abaixo do piso cai no piso; futuro cai no atual", () => {
    expect(lerPeriodo({ mes: "2026-01" }, { hoje: HOJE })).toEqual({ de: "2026-07-01", ate: "2026-07-31" });
    expect(lerPeriodo({ mes: "2027-01" }, { hoje: HOJE })).toEqual({ de: "2026-11-01", ate: "2026-11-30" });
  });
  it("de sem ate = um dia", () => {
    expect(lerPeriodo({ de: "2026-08-10" }, { hoje: HOJE })).toEqual({ de: "2026-08-10", ate: "2026-08-10" });
  });
});

describe("tipoPeriodo", () => {
  it("reconhece mês, trimestre, ano e livre", () => {
    expect(tipoPeriodo({ de: "2026-02-01", ate: "2026-02-28" })).toBe("mes");
    expect(tipoPeriodo(Q3)).toBe("trimestre");
    expect(tipoPeriodo({ de: "2025-01-01", ate: "2025-12-31" })).toBe("ano");
    expect(tipoPeriodo({ de: "2026-08-01", ate: "2026-09-15" })).toBe("livre");
    expect(tipoPeriodo({ de: "2026-08-01", ate: "2026-10-31" })).toBe("livre"); // 3 meses fora do calendário
  });
  it("mesDoPeriodo só para mês inteiro", () => {
    expect(mesDoPeriodo({ de: "2026-09-01", ate: "2026-09-30" })).toBe("2026-09-01");
    expect(mesDoPeriodo(Q3)).toBeNull();
  });
});

describe("periodoAnterior", () => {
  const PASSADO = new Date(2027, 5, 1); // nenhum período do teste inclui "hoje"
  it("calendário anterior", () => {
    expect(periodoAnterior(Q3, PASSADO)).toEqual({ de: "2026-04-01", ate: "2026-06-30" });
    expect(periodoAnterior({ de: "2026-01-01", ate: "2026-03-31" }, PASSADO)).toEqual({ de: "2025-10-01", ate: "2025-12-31" });
    expect(periodoAnterior({ de: "2025-01-01", ate: "2025-12-31" }, PASSADO)).toEqual({ de: "2024-01-01", ate: "2024-12-31" });
    expect(periodoAnterior({ de: "2026-09-01", ate: "2026-09-30" }, PASSADO)).toEqual({ de: "2026-08-01", ate: "2026-08-31" });
  });
  it("livre: os N dias imediatamente antes", () => {
    const p = { de: "2026-08-01", ate: "2026-09-15" };
    expect(diasNoPeriodo(p)).toBe(46);
    expect(periodoAnterior(p, PASSADO)).toEqual({ de: "2026-06-16", ate: "2026-07-31" });
  });
  it("período corrente compara o trecho equivalente", () => {
    const q4 = { de: "2026-10-01", ate: "2026-12-31" }; // 37 dias decorridos em 06/11
    expect(periodoAnterior(q4, HOJE)).toEqual({ de: "2026-07-01", ate: "2026-08-06" });
    expect(periodoAnoPassado(q4, HOJE)).toEqual({ de: "2025-10-01", ate: "2025-11-06" });
    expect(periodoAnterior({ de: "2026-11-01", ate: "2026-11-30" }, HOJE)).toEqual({ de: "2026-10-01", ate: "2026-10-06" });
  });
});

describe("periodoAnoPassado", () => {
  const PASSADO = new Date(2027, 5, 1);
  it("29/02 → 28/02; fevereiro inteiro → fevereiro inteiro", () => {
    expect(periodoAnoPassado({ de: "2024-02-29", ate: "2024-02-29" }, PASSADO)).toEqual({ de: "2023-02-28", ate: "2023-02-28" });
    expect(periodoAnoPassado({ de: "2025-02-01", ate: "2025-02-28" }, PASSADO)).toEqual({ de: "2024-02-01", ate: "2024-02-29" });
  });
  it("trimestre e ano", () => {
    expect(periodoAnoPassado(Q3, PASSADO)).toEqual({ de: "2025-07-01", ate: "2025-09-30" });
  });
});

describe("deslocarPeriodo", () => {
  it("anda pelo tamanho do período", () => {
    expect(deslocarPeriodo(Q3, 1)).toEqual({ de: "2026-10-01", ate: "2026-12-31" });
    expect(deslocarPeriodo({ de: "2026-01-01", ate: "2026-03-31" }, -1)).toEqual({ de: "2025-10-01", ate: "2025-12-31" });
    expect(deslocarPeriodo({ de: "2026-12-01", ate: "2026-12-31" }, 1)).toEqual({ de: "2027-01-01", ate: "2027-01-31" });
    expect(deslocarPeriodo({ de: "2026-08-01", ate: "2026-09-15" }, 1)).toEqual({ de: "2026-09-16", ate: "2026-10-31" });
  });
});

describe("paramsDoPeriodo", () => {
  it("mês atual = URL limpa; mês = mes; resto = de/ate", () => {
    expect(paramsDoPeriodo({ de: "2026-11-01", ate: "2026-11-30" }, HOJE)).toEqual({});
    expect(paramsDoPeriodo({ de: "2026-09-01", ate: "2026-09-30" }, HOJE)).toEqual({ mes: "2026-09-01" });
    expect(paramsDoPeriodo(Q3, HOJE)).toEqual({ de: "2026-07-01", ate: "2026-09-30" });
  });
});

describe("eixo, meses e rótulos", () => {
  it("62 dias = dia, 63 = mês", () => {
    expect(eixoDoPeriodo({ de: "2026-07-01", ate: "2026-08-31" })).toBe("dia");
    expect(eixoDoPeriodo({ de: "2026-07-01", ate: "2026-09-01" })).toBe("mes");
  });
  it("meses tocados", () => {
    expect(mesesDoPeriodo({ de: "2026-08-15", ate: "2026-10-02" })).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
  });
  it("rótulos", () => {
    expect(rotuloPeriodo({ de: "2026-11-01", ate: "2026-11-30" })).toBe("Novembro/2026");
    expect(rotuloPeriodo(Q3)).toBe("3º tri/2026");
    expect(rotuloPeriodo({ de: "2025-01-01", ate: "2025-12-31" })).toBe("2025");
    expect(rotuloPeriodo({ de: "2026-08-01", ate: "2026-10-31" })).toBe("Ago–Out/2026");
    expect(rotuloPeriodo({ de: "2026-08-01", ate: "2026-09-15" })).toBe("01/08 – 15/09/2026");
    expect(rotuloPeriodo({ de: "2025-12-15", ate: "2026-01-10" })).toBe("15/12/2025 – 10/01/2026");
    expect(rotuloCurto({ de: "2026-04-01", ate: "2026-06-30" })).toBe("2º tri/26");
    expect(rotuloCurto({ de: "2026-10-01", ate: "2026-10-31" })).toBe("Out/26");
  });
});

describe("atalhosPeriodo", () => {
  it("os 7 atalhos em 06/11/2026", () => {
    const a = atalhosPeriodo(HOJE);
    expect(a.map((x) => x.rotulo)).toEqual([
      "Este mês", "Mês passado", "Este trimestre", "Trimestre passado", "Este ano", "Ano passado", "Últimos 12 meses",
    ]);
    const p = Object.fromEntries(a.map((x) => [x.chave, x.periodo]));
    expect(p["tri"]).toEqual({ de: "2026-10-01", ate: "2026-12-31" });
    expect(p["tri-passado"]).toEqual(Q3);
    expect(p["ano-passado"]).toEqual({ de: "2025-01-01", ate: "2025-12-31" });
    expect(p["12m"]).toEqual({ de: "2025-12-01", ate: "2026-11-06" });
  });
});
