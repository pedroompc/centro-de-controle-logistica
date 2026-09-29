import { describe, it, expect } from "vitest";
import {
  faixaDaHora, diaDoTurno, montarPainel, resumirOcupacao,
  type MovHoraOperador, type CargaSeparada,
} from "./wms-eficiencia";

const MES = "2026-08-01";
const TETO = 12 * 60;

const mov = (dia: string, hora: number | null, usuario: number, verticais: number, horizontais = 0): MovHoraOperador =>
  ({ dia, hora, usuario, nome: `Op ${usuario}`, verticais, horizontais });
const carga = (id: string, dia: string, hora: number | null, minutos: number | null, skus = 10, pesoKg = 1000): CargaSeparada =>
  ({ carga: id, dia, hora, minutos, skus, pesoKg });

describe("faixaDaHora", () => {
  it("segue as faixas de turno", () => {
    expect(faixaDaHora(7)).toBe("manha");
    expect(faixaDaHora(13)).toBe("sobreposicao");
    expect(faixaDaHora(17)).toBe("tarde");
    expect(faixaDaHora(22)).toBe("noite");
    expect(faixaDaHora(3)).toBe("noite");
  });
});

describe("diaDoTurno", () => {
  it("madrugada pertence à Noite do dia anterior, inclusive na virada do mês", () => {
    expect(diaDoTurno("2026-08-10", 3)).toBe("2026-08-09");
    expect(diaDoTurno("2026-09-01", 6)).toBe("2026-08-31");
    expect(diaDoTurno("2026-08-10", 7)).toBe("2026-08-10");
  });
});

describe("montarPainel", () => {
  const movs = [
    mov("2026-08-03", 8, 1, 10, 5), // manhã dia 3
    mov("2026-08-04", 9, 1, 20, 5), // manhã dia 4
    mov("2026-08-03", 23, 2, 30), // noite dia 3
    mov("2026-08-04", 2, 2, 10), // mesma noite do dia 3
    mov("2026-08-01", 3, 2, 99), // noite de 31/07 → fora do mês
    mov("2026-09-01", 5, 2, 7), // noite de 31/08 → dentro
    mov("2026-08-05", null, 3, 4, 1), // sem hora
  ];
  const cargas = [
    carga("A", "2026-08-03", 8, 60, 10, 2000),
    carga("B", "2026-08-04", 9, 120, 20, 4000),
    carga("C", "2026-08-03", 23, 30, 6, 600),
    carga("D", "2026-08-05", null, 50),
  ];

  it("normaliza por turno trabalhado e deixa fora o que não é do mês ou não tem hora", () => {
    const p = montarPainel(MES, movs, cargas, {}, TETO);
    expect(p.geral.movimento.verticais).toBe(10 + 20 + 30 + 10 + 7);
    expect(p.geral.movimento.turnos).toBe(4); // manhã 3, manhã 4, noite 3, noite 31
    expect(p.movSemHora).toBe(5);
    expect(p.cargasSemHora).toBe(1);
  });

  it("recorta por turno com média de tempo, SKUs e peso por carga", () => {
    const manha = montarPainel(MES, movs, cargas, { faixa: "manha" }, TETO);
    expect(manha.geral.movimento.verticaisPorTurno).toBe(15); // 30 ÷ 2 turnos
    expect(manha.geral.movimento.horizontaisPorTurno).toBe(5);
    expect(manha.geral.separacao.cargas).toBe(2);
    expect(manha.geral.separacao.tempo.medianaMin).toBe(90);
    expect(manha.geral.separacao.mediaSkus).toBe(15);
    expect(manha.geral.separacao.mediaPesoKg).toBe(3000);
    expect(manha.cargas.map((c) => c.carga)).toEqual(["B", "A"]); // mais lenta primeiro
  });

  it("a quebra por turno ignora o próprio filtro de turno, mas respeita os outros", () => {
    const p = montarPainel(MES, movs, cargas, { faixa: "manha", dia: "2026-08-03" }, TETO);
    const noite = p.porFaixa.find((f) => f.faixa.id === "noite")!.fatia;
    expect(noite.movimento.verticais).toBe(40); // 30 + 10 da madrugada do dia 4
    expect(p.porDia.map((d) => d.dia)).toContain("2026-08-04");
    expect(p.geral.movimento.verticais).toBe(10);
  });

  it("filtro de operador recorta movimentos e não esconde a separação", () => {
    const p = montarPainel(MES, movs, cargas, { usuario: 2 }, TETO);
    expect(p.geral.movimento.verticais).toBe(47);
    expect(p.geral.separacao.cargas).toBe(3);
    expect(p.operadores.map((o) => o.usuario)).toEqual([2, 1]); // ranking ignora o próprio filtro
    expect(p.operadores[0].porTurno).toBeCloseTo(47 / 2);
  });
});

describe("montarPainel — visão geral", () => {
  it("dá o total do mês com média por dia e por turno", () => {
    const p = montarPainel(MES, [
      mov("2026-08-03", 8, 1, 10, 4),
      mov("2026-08-03", 23, 2, 20, 6),
      mov("2026-08-04", 9, 1, 30, 2),
    ], [carga("A", "2026-08-03", 8, 60, 10, 2000), carga("B", "2026-08-04", 9, 60, 10, 3000)], {}, TETO);
    const m = p.geral.movimento;
    expect(m.dias).toBe(2);
    expect(m.turnos).toBe(3);
    expect(m.operadores).toBe(2);
    expect(m.verticaisPorDia).toBe(30);
    expect(m.horizontaisPorDia).toBe(6);
    expect(p.geral.separacao.pesoTotalKg).toBe(5000);
  });
});

describe("resumirOcupacao", () => {
  it("separa picking e pulmão e mostra tipos não mapeados à parte", () => {
    const r = resumirOcupacao([
      { tipo: "P", total: 100, uteis: 90, ocupados: 72 },
      { tipo: "M", total: 400, uteis: 380, ocupados: 342 },
      { tipo: "X", total: 10, uteis: 10, ocupados: 1 },
    ]);
    expect(r.picking?.taxa).toBeCloseTo(0.8);
    expect(r.pulmao?.taxa).toBeCloseTo(0.9);
    expect(r.pulmao?.bloqueados).toBe(20);
    expect(r.estoque.uteis).toBe(480);
    expect(r.estoque.taxa).toBeCloseTo(415 / 480);
    expect(r.outros.map((o) => o.rotulo)).toEqual(["Tipo X"]);
  });
  it("sem o código de picking devolve null em vez de 0%", () => {
    expect(resumirOcupacao([{ tipo: "M", total: 1, uteis: 1, ocupados: 1 }]).picking).toBeNull();
  });
});
