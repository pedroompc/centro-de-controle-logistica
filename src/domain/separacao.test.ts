import { describe, it, expect } from "vitest";
import { ehSetorSeparacao, mesmoSetor, papelSeparacao, serieCustoSetor } from "./separacao";

describe("separação", () => {
  it("reconhece o setor e compara nomes sem acento", () => {
    expect(ehSetorSeparacao("SEPARAÇÃO")).toBe(true);
    expect(ehSetorSeparacao("Recebimento")).toBe(false);
    expect(mesmoSetor("SEPARAÇÃO", "Separacao ")).toBe(true);
  });
  it("função pelo cargo", () => {
    expect(papelSeparacao("SEPARADOR")).toBe("separador");
    expect(papelSeparacao("AJUDANTE DE CARGA E DESCARGA")).toBe("separador");
    expect(papelSeparacao("CONFERENTE")).toBe("conferente");
    expect(papelSeparacao("Operador de empilhadeira")).toBe("maquina");
    expect(papelSeparacao("LÍDER DE SEPARAÇÃO")).toBe("lider");
    expect(papelSeparacao("Motorista")).toBe("outros");
  });
  it("série: foto nos meses passados, cadastro no corrente, vazio sem foto", () => {
    const s = serieCustoSetor(
      ["2026-08-01", "2026-09-01", "2026-10-01"],
      [{ mes: "2026-09-01", ativos: 10, custoAtivos: 40_000 }],
      "2026-10-01",
      { pessoas: 11, folha: 44_000 },
    );
    expect(s).toEqual([
      { mes: "2026-08-01", pessoas: null, folha: null },
      { mes: "2026-09-01", pessoas: 10, folha: 40_000 },
      { mes: "2026-10-01", pessoas: 11, folha: 44_000 },
    ]);
  });
});

import {
  totaisProducao, custoDoPeriodo, custosUnitarios, custoSobreFaturamento, resumoErros, porMilLinhas,
  atribuirTurno, resolverTurnos, skusPorTurnoDia, resumoPorTurno, rankingTurnos, horasUniao, porSeparador, sinalOperador, type LinhaSep, type ErroSep, type EquipeTurno,
} from "./separacao";
import type { Turno } from "./types";

const L = (o: Partial<LinhaSep>): LinhaSep => ({ mapa: 1, dia: "2026-10-01", usuario: null, hora: 15, linhas: 0, caixas: 0, unidades: 0, kg: 0, ...o });
const E = (o: Partial<ErroSep>): ErroSep => ({ mapa: 1, dia: "2026-10-01", usuario: null, hora: 15, origem: "separador", ocorrencias: 1, itens: 1, unidades: 1, falta: 1, sobra: 0, ...o });

describe("totais e custo", () => {
  const linhas = [L({ linhas: 10, caixas: 20, kg: 1000, usuario: 7 }), L({ dia: "2026-10-02", linhas: 30, kg: 3000 })];
  const dias = [
    { dia: "2026-10-01", pedidos: 5, clientes: 4, cargas: 1, mapas: 2 },
    { dia: "2026-10-02", pedidos: 15, clientes: 10, cargas: 2, mapas: 3 },
  ];
  const res = resolverTurnos(linhas, [], [], new Map()).linhas;
  it("soma linhas/kg das linhas e pedidos/clientes dos distintos do dia", () => {
    expect(totaisProducao(res, dias)).toMatchObject({ linhas: 40, kg: 4000, pedidos: 20, clientesDia: 14, cargas: 3, dias: 2, linhasComSeparador: 10 });
    expect(totaisProducao(res, dias, "2026-10-02")).toMatchObject({ linhas: 30, pedidos: 15, dias: 1, linhasComSeparador: 0 });
  });
  it("custo do mês corrente entra proporcional; 1 dia = período ÷ dias com separação", () => {
    expect(custoDoPeriodo(30_000, 0.5, 10, false)).toBe(15_000);
    expect(custoDoPeriodo(30_000, 0.5, 10, true)).toBe(1_500);
    expect(custoDoPeriodo(null, 1, 10, false)).toBeNull();
    expect(custosUnitarios(4_000, { pedidos: 20, linhas: 40, kg: 4000, caixas: 0 })).toEqual({ porPedido: 200, porLinha: 100, porTonelada: 1000, porCaixa: null });
    expect(custoSobreFaturamento(15_000, 1_000_000)).toBe(0.015);
    expect(custoSobreFaturamento(15_000, 0)).toBeNull();
  });
});

describe("qualidade", () => {
  it("separa por origem e conta falta/sobra em ocorrências", () => {
    const r = resumoErros([E({ ocorrencias: 3, itens: 2, unidades: 10, falta: 2, sobra: 1 }), E({ origem: "conferente", falta: 0, sobra: 1 }), E({ dia: "2026-10-02" })]);
    expect(r.separador).toEqual({ ocorrencias: 4, itens: 3, unidades: 11, falta: 3, sobra: 1 });
    expect(r.conferente.sobra).toBe(1);
    expect(porMilLinhas(3, 1500)).toBe(2);
    expect(porMilLinhas(3, 0)).toBeNull();
  });
});

describe("turnos", () => {
  const cadastro = new Map<number, Turno>([[7, "tarde"]]);
  it("operador ligado vale o cadastro; sem operador vale a janela de horário", () => {
    expect(atribuirTurno(7, 9, cadastro)).toEqual({ turno: "tarde", regra: "operador" });
    expect(atribuirTurno(99, 9, cadastro)).toEqual({ turno: "manha", regra: "horario" });
    expect(atribuirTurno(null, 23, cadastro)).toEqual({ turno: "noite", regra: "horario" });
    expect(atribuirTurno(null, 3, cadastro).turno).toBe("noite");
  });
  const eq = (separadores: number, custoMes: number): EquipeTurno => ({ pessoas: separadores, separadores, conferentes: 0, custoMes });
  const equipe: Record<Turno, EquipeTurno> = { manha: eq(2, 10_000), tarde: eq(4, 20_000), noite: eq(0, 0) };
  const resolvido = resolverTurnos(
    [L({ mapa: 1, usuario: 7, linhas: 30, kg: 300 }), L({ mapa: 1, hora: 9, linhas: 10, kg: 100 }), L({ mapa: 2, dia: "2026-10-02", hora: 9, linhas: 20, kg: 200 })],
    [E({ usuario: 7, itens: 3 }), E({ hora: 9, origem: "conferente", itens: 5 })],
    [{ mapa: 1, dia: "2026-10-01", tipo: 0, pedidos: 8, clientes: 4 }, { mapa: 2, dia: "2026-10-02", tipo: 4, pedidos: 2, clientes: 2 }],
    cadastro,
  );
  it("o que vai para a tela não carrega o id do separador", () => {
    expect(resolvido.linhas.every((l) => !("usuario" in l) && !("mapa" in l))).toBe(true);
    expect(resolvido.erros.find((e) => e.origem === "separador")).toMatchObject({ turno: "tarde", atribuido: true });
  });
  const r = resumoPorTurno({
    linhas: resolvido.linhas,
    erros: resolvido.erros,
    equipe,
    custoFolhaPeriodo: 15_000,
  });
  const [manha, tarde, noite] = r;
  it("rateia pedidos pelo peso das linhas no mapa e soma o total", () => {
    expect(tarde.pedidos).toBe(6); // 30 de 40 linhas do mapa 1 × 8 pedidos
    expect(manha.pedidos).toBe(4); // 10/40 × 8 + mapa 2 inteiro
    expect(manha.pedidos + tarde.pedidos + noite.pedidos).toBe(10);
  });
  it("horas disponíveis = separadores × jornada × dias; custo rateado pela folha", () => {
    expect(manha.horasDisponiveis).toBe(2 * 8 * 2);
    expect(manha.linhasPorHora).toBe(30 / 32);
    expect(tarde.custo).toBe(10_000);
    expect(manha.custo).toBe(5_000);
    expect(noite.horasDisponiveis).toBeNull();
    expect(manha.linhasPorOperador).toBe(0);
    expect(tarde.linhasPorOperador).toBe(30);
  });
  it("erro de conferente não entra na qualidade da separação", () => {
    expect(tarde.errosSeparador).toBe(3);
    expect(manha.errosSeparador).toBe(0);
  });
  it("ranking: produção absoluta e produtividade podem apontar turnos diferentes", () => {
    expect(rankingTurnos(r).producao).toBeNull(); // manhã 30 × tarde 30: empate não elege ninguém
    // Tarde produz mais no total, mas com o dobro de gente rende menos por hora.
    const r2 = resumoPorTurno({
      linhas: resolverTurnos([L({ usuario: 7, linhas: 60, kg: 600 }), L({ hora: 9, linhas: 40, kg: 400 })], [], [{ mapa: 1, dia: "2026-10-01", tipo: 4, pedidos: 10, clientes: 10 }], cadastro).linhas,
      erros: [],
      equipe: { manha: eq(1, 5_000), tarde: eq(4, 20_000), noite: eq(0, 0) },
      custoFolhaPeriodo: 25_000,
    });
    const rk = rankingTurnos(r2);
    expect(rk.producao).toBe("tarde");
    expect(rk.linhasPorHora).toBe("manha");
    expect(rk.custoPorPedido).toBe("manha");
  });
});

describe("média por dia trabalhado do turno", () => {
  const cadastro = new Map<number, Turno>([[7, "tarde"]]);
  const sem: EquipeTurno = { pessoas: 0, separadores: 0, conferentes: 0, custoMes: 0 };
  it("SKU conta 1 vez por dia e turno; separador do cadastro vence a hora", () => {
    const s = skusPorTurnoDia(
      [
        { dia: "2026-10-01", usuario: null, turnoHora: "noite", produto: 1 },
        { dia: "2026-10-01", usuario: null, turnoHora: "noite", produto: 1 }, // mesmo produto em outro mapa
        { dia: "2026-10-01", usuario: null, turnoHora: "noite", produto: 2 },
        { dia: "2026-10-02", usuario: null, turnoHora: "noite", produto: 1 },
        { dia: "2026-10-01", usuario: 7, turnoHora: "noite", produto: 3 }, // hora extra: conta na tarde
      ],
      cadastro,
    );
    const de = (dia: string, turno: Turno) => s.find((x) => x.dia === dia && x.turno === turno)?.skus;
    expect(de("2026-10-01", "noite")).toBe(2);
    expect(de("2026-10-02", "noite")).toBe(1);
    expect(de("2026-10-01", "tarde")).toBe(1);
  });
  it("divide pelos dias em que o turno separou, sem depender de nome", () => {
    const r = resumoPorTurno({
      linhas: resolverTurnos([L({ hora: 23, linhas: 100, kg: 30_000, caixas: 50 }), L({ dia: "2026-10-02", hora: 2, linhas: 60, kg: 10_000 })], [], [], cadastro).linhas,
      erros: [],
      equipe: { manha: sem, tarde: sem, noite: sem },
      custoFolhaPeriodo: null,
      skus: [{ dia: "2026-10-01", turno: "noite", skus: 900 }, { dia: "2026-10-02", turno: "noite", skus: 700 }],
    });
    const noite = r.find((t) => t.turno === "noite")!;
    expect(noite.porDia).toEqual({ kg: 20_000, linhas: 80, pedidos: 0, caixas: 25, skus: 800 });
    expect(r.find((t) => t.turno === "manha")!.porDia).toBeNull();
  });
});

describe("operadores", () => {
  it("união de intervalos: páginas paralelas não somam duas vezes", () => {
    const h = 3_600_000;
    expect(horasUniao([{ ini: 0, fim: 2 * h }, { ini: h, fim: 3 * h }, { ini: 5 * h, fim: 6 * h }])).toBe(4);
    expect(horasUniao([])).toBe(0);
  });
  it("por separador e sinal contra o mês anterior", () => {
    const h = 3_600_000;
    const pags = [1, 2, 3].map((d) => ({ usuario: 7, dia: `2026-10-0${d}`, ini: d * 24 * h, fim: d * 24 * h + 4 * h }));
    const s = porSeparador([L({ usuario: 7, linhas: 120, kg: 600 }), L({ linhas: 50 })], pags, [E({ usuario: 7, itens: 2 })], new Map([[7, "tarde"]]));
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ usuario: 7, turno: "tarde", dias: 3, horasAtivas: 12, linhasPorHora: 10, erros: 2, amostraSuficiente: true });
    const ant = { ...s[0], linhasPorHora: 8 };
    expect(sinalOperador(s[0], ant, 10, 5)).toBe("evolucao");
    expect(sinalOperador(s[0], null, 20, 5)).toBe("atencao");
    expect(sinalOperador(s[0], null, 20, 2)).toBeNull(); // linha bem mais pesada que a média: não sinaliza
  });
});

import { porConferente } from "./separacao";

describe("conferência", () => {
  it("soma por conferente e só calcula unidades/h com dias de 1h+", () => {
    const r = porConferente([
      { dia: "2026-10-01", usuario: 24, bipagens: 40, unidades: 900, mapas: 3, horas: 4 },
      { dia: "2026-10-02", usuario: 24, bipagens: 20, unidades: 100, mapas: 1, horas: 0.5 },
    ]);
    expect(r[0]).toMatchObject({ dias: 2, unidades: 1000, horas: 4.5, unidadesPorHora: 225 });
  });
});
