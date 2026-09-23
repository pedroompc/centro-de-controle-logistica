import { describe, it, expect } from "vitest";
import {
  FAIXAS_TURNO, resumirTurnos, horaDePico, rankingOperadores, medianaEquipe,
  type OperadorMes,
} from "./wms-operacao";

const horasVazias = () => Array.from({ length: 24 }, () => 0);

describe("FAIXAS_TURNO", () => {
  it("cobre as 24 horas sem repetir nenhuma", () => {
    const todas = FAIXAS_TURNO.flatMap((f) => f.horas).sort((a, b) => a - b);
    expect(todas).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });
  it("isola a sobreposição Manhã+Tarde das 13h às 16h59", () => {
    expect(FAIXAS_TURNO.find((f) => f.id === "sobreposicao")?.horas).toEqual([13, 14, 15, 16]);
  });
});

describe("resumirTurnos", () => {
  it("soma por faixa, calcula participação e média por hora/dia", () => {
    const h = horasVazias();
    h[8] = 60; // manhã
    h[14] = 40; // sobreposição
    h[23] = 100; // noite
    const r = resumirTurnos(h, 2);
    const manha = r.find((x) => x.faixa.id === "manha")!;
    expect(manha.movimentos).toBe(60);
    expect(manha.participacao).toBeCloseTo(0.3, 6);
    expect(manha.porHora).toBe(5); // 60 ÷ (6 h × 2 dias)
    expect(r.find((x) => x.faixa.id === "noite")!.movimentos).toBe(100);
  });
  it("sem dias nem movimentos não divide por zero", () => {
    expect(resumirTurnos(horasVazias(), 0).every((x) => x.porHora === 0 && x.participacao === 0)).toBe(true);
  });
});

describe("horaDePico", () => {
  it("devolve a hora com mais movimentos", () => {
    const h = horasVazias();
    h[9] = 10;
    h[15] = 30;
    h[22] = 20;
    expect(horaDePico(h)).toBe(15);
  });
  it("é null quando não houve movimento", () => {
    expect(horaDePico(horasVazias())).toBeNull();
  });
});

const op = (usuario: number, movimentos: number, dias: number): OperadorMes => ({
  usuario, nome: `Op ${usuario}`, movimentos, dias,
  verticais: 0, horizontais: 0, abastecimentos: 0, armazenagens: 0,
});

describe("rankingOperadores", () => {
  it("ranqueia por movimentos por dia trabalhado, não pelo total", () => {
    const r = rankingOperadores([op(1, 1000, 25), op(2, 600, 10)], []);
    expect(r.map((l) => l.usuario)).toEqual([2, 1]); // 60/dia > 40/dia
  });
  it("manda para o fim quem trabalhou menos dias que o mínimo", () => {
    const r = rankingOperadores([op(1, 400, 20), op(2, 200, 1)], [], 3);
    expect(r.map((l) => l.usuario)).toEqual([1, 2]); // 200/dia em 1 dia não lidera
  });
  it("compara com o mês anterior do mesmo operador", () => {
    const [l] = rankingOperadores([op(1, 500, 10)], [op(1, 400, 10)]);
    expect(l.porDiaAnterior).toBe(40);
    expect(l.variacao).toBeCloseTo(0.25, 6);
  });
  it("sem histórico no mês anterior, variação é null", () => {
    const [l] = rankingOperadores([op(1, 500, 10)], [op(9, 400, 10)]);
    expect(l.variacao).toBeNull();
  });
  it("calcula participação no total do mês", () => {
    const r = rankingOperadores([op(1, 300, 10), op(2, 100, 10)], []);
    expect(r[0].participacao).toBeCloseTo(0.75, 6);
  });
});

describe("medianaEquipe", () => {
  it("usa só quem tem amostra suficiente", () => {
    const r = rankingOperadores([op(1, 300, 10), op(2, 500, 10), op(3, 900, 1)], []);
    expect(medianaEquipe(r)).toBe(40); // (30 + 50) / 2; o de 1 dia fica fora
  });
});
