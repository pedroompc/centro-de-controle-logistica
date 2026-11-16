import { describe, expect, it } from "vitest";
import { numerosSeparacao, numerosMotoristas, numerosAbastecimento, numerosRecebimento, variacaoDoQuadro, carregarComparacao } from "./bi-quadros";
import { compararPct, compararTaxa } from "./comparacao";
import type { IndicadorGeral } from "./bi-geral";
import type { DadosBISeparacao } from "@/app/(app)/setores/[id]/separacao-dados";
import type { DadosBIAbastecimento } from "@/app/(app)/setores/[id]/abastecimento-dados";
import type { DadosBIMotoristas } from "@/app/(app)/setores/[id]/motoristas-dados";
import type { DadosBI } from "@/app/(app)/setores/[id]/bi-recebimento/base";

const mapa = (xs: IndicadorGeral[]) => Object.fromEntries(xs.map((i) => [i.chave, i.valor]));

const linha = (dia: string, turno: string, caixas: number, kg: number) => ({ dia, turno, linhas: 10, caixas, unidades: 0, kg, comSeparador: true });
const eq = { pessoas: 1, separadores: 1, horasSeparadorDia: 8, conferentes: 0, custoMes: 0 };
const diaSep = (dia: string, pedidos: number) => ({ dia, pedidos, clientes: 0, cargas: 1, mapas: 1 });

describe("numerosSeparacao", () => {
  it("custo, endereços, kg dos turnos e erro por mil", () => {
    const d = {
      ref: { custo: 4000, custoPeriodo: 4000 },
      fracaoMes: 1,
      faturamentoLiquido: null,
      folhaRef: null,
      producao: {
        linhas: [linha("2026-10-01", "dia", 150, 700), linha("2026-10-02", "noite", 250, 500)],
        dias: [diaSep("2026-10-01", 10), diaSep("2026-10-02", 20)],
        erros: [],
        equipe: { dia: eq, noite: eq },
        skusTurno: [],
      },
    } as unknown as DadosBISeparacao;
    const r = numerosSeparacao(d);
    expect(r.map((i) => i.chave)).toEqual(["custo", "producao", "turnos", "qualidade"]);
    expect(mapa(r)).toEqual({ custo: 4000, producao: 20, turnos: 1200, qualidade: 0 });
    expect(r.find((i) => i.chave === "qualidade")!.formato).toBe("permil");
  });
  it("Harpia fora: produção sem número (custo segue)", () => {
    const d = { ref: { custo: 4000, custoPeriodo: 4000 }, fracaoMes: 1, faturamentoLiquido: null, folhaRef: null, producao: { erro: "x" } } as unknown as DadosBISeparacao;
    expect(mapa(numerosSeparacao(d))).toEqual({ custo: 4000, producao: null, turnos: null, qualidade: null });
  });
});

describe("numerosMotoristas", () => {
  const viagem = (dia: string, entregas: number, kg: number) => ({ dia, veiculo: 1, placa: "AAA1B23", capacidadeKg: 1000, motorista: 1, cargas: 1, notas: 1, entregas, kg, valor: 0 });
  const base = {
    ref: { custo: 9000, custoPeriodo: 9000 },
    fracaoMes: 1,
    faturamentoLiquido: null,
    entregas: { viagens: [viagem("2026-10-01", 5, 500), viagem("2026-10-02", 7, 300)] },
    devolucao: [{ dia: "2026-10-01", codMotorista: 1, nome: "A", tipo: "F", expedidas: 20, devolvidas: 1, valorExpedido: 0, valorDevolvido: 0 }],
    hodometro: null,
  };
  it("custo, entregas, ocupação, km (sem telemetria = null) e devolução", () => {
    const r = numerosMotoristas(base as unknown as DadosBIMotoristas);
    expect(r.map((i) => i.chave)).toEqual(["custo", "entregas", "frota", "km", "devolucao"]);
    const m = mapa(r);
    expect(m.custo).toBe(9000);
    expect(m.entregas).toBe(12);
    expect(m.frota).toBeCloseTo(0.4);
    expect(m.km).toBeNull();
    expect(m.devolucao).toBe(0.05);
  });
});

describe("numerosAbastecimento", () => {
  it("custo, caixas, abastecimentos do giro, movimentação e rupturas", () => {
    const h = {
      reabastecimento: [{ dia: "2026-10-01", abastecimentos: 7, caixas: 30, unidades: 0, skus: 0 }, { dia: "2026-10-02", abastecimentos: 5, caixas: 20, unidades: 0, skus: 0 }],
      movimentoPiso: { a424: [{ dia: "2026-10-01", funcao: "04", usuario: 1, tarefas: 40 }], empilhadores: [1], lancadoresWms: [] },
      rupturas: [{}, {}],
      curvas: [{ abastecimentos: 8, skus: 3 }, { abastecimentos: 4, skus: 1 }],
    };
    const r = numerosAbastecimento({ custoRecorte: 5000, harpia: { dados: h } } as unknown as DadosBIAbastecimento);
    expect(r.map((i) => i.chave)).toEqual(["custo", "volume", "giro", "movimento", "rupturas"]);
    expect(mapa(r)).toEqual({ custo: 5000, volume: 50, giro: 12, movimento: 40, rupturas: 2 });
  });
  it("Harpia fora: só o custo", () => {
    const r = numerosAbastecimento({ custoRecorte: null, harpia: { erro: "x" } } as unknown as DadosBIAbastecimento);
    expect(mapa(r)).toEqual({ custo: null, volume: null, giro: null, movimento: null, rupturas: null });
  });
});

describe("numerosRecebimento", () => {
  const r0 = { mes: "2026-10-01", pesoKg: 9000, carros: 30, receitaDescarrego: 800, custoPeriodo: 3000 };
  it("mês com fatos: custo, carros, receita e custo por tonelada", () => {
    const fatos = [{ dia: "2026-10-01", fornecedor: "X", tipo: "batido", carros: 2, descargasVolume: 0, caixas: 0, pesoKg: 1500, receita: 120, notas: 2 }];
    const r = numerosRecebimento({ mes: "2026-10-01", mensal: true, serie: [r0], fatos } as unknown as DadosBI);
    expect(r.map((i) => i.chave)).toEqual(["custo", "descarrego", "receita", "eficiencia"]);
    expect(mapa(r)).toEqual({ custo: 3000, descarrego: 2, receita: 120, eficiencia: 2000 });
  });
  it("mês sem fatos: a série do mês", () => {
    const r = numerosRecebimento({ mes: "2026-10-01", mensal: true, serie: [r0], fatos: null } as unknown as DadosBI);
    expect(mapa(r)).toMatchObject({ descarrego: 30, receita: 800 });
  });
  it("período livre sem fatos: nada (nunca 0)", () => {
    const r = numerosRecebimento({ mes: "2026-10-01", mensal: false, ref: { ...r0, pesoKg: 0, carros: 0, receitaDescarrego: 0 }, serie: [r0], fatos: null } as unknown as DadosBI);
    expect(mapa(r)).toEqual({ custo: null, descarrego: null, receita: null, eficiencia: null });
  });
});

describe("variacaoDoQuadro", () => {
  const ind = (chave: string, valor: number | null, formato: IndicadorGeral["formato"] = "int", maiorEhBom = true): IndicadorGeral => ({ chave, rotulo: chave, valor, formato, maiorEhBom });
  it("acha o quadro dos dois lados e compara", () => {
    expect(variacaoDoQuadro("a", [ind("a", 110)], [ind("a", 100)])).toEqual(compararPct(110, 100, true));
  });
  it("erro por mil compara pela diferença absoluta", () => {
    const c = variacaoDoQuadro("q", [ind("q", 2.5, "permil", false)], [ind("q", 2, "permil", false)]);
    expect(c).toEqual({ texto: "+0,5 ‰", subindo: true, positivo: false });
  });
  it("taxa em p.p.", () => {
    expect(variacaoDoQuadro("f", [ind("f", 0.5, "pct")], [ind("f", 0.4, "pct")])).toEqual(compararTaxa(0.5, 0.4, true));
  });
  it("sem base (antes do piso ou falha): null", () => {
    expect(variacaoDoQuadro("a", [ind("a", 1)], null)).toBeNull();
  });
});

describe("carregarComparacao", () => {
  const cmp = { modo: "ant" as const, periodo: { de: "2026-09-01", ate: "2026-09-30" } };
  const numeros = (d: { n: number }): IndicadorGeral[] => [{ chave: "a", rotulo: "a", valor: d.n, formato: "int", maiorEhBom: true }];

  it("sem ?cmp=: nada", async () => {
    expect(await carregarComparacao(null, "2025-10-01", async () => ({ n: 1 }), numeros, () => null)).toBeUndefined();
  });
  it("carrega o período de comparação pelo mesmo carregador", async () => {
    const vistos: string[] = [];
    const r = await carregarComparacao(cmp, "2025-10-01", async (p) => (vistos.push(p.de), { n: 7 }), numeros, () => null);
    expect(vistos).toEqual(["2026-09-01"]);
    expect(r).toEqual({ rotulo: "vs Set/26", base: numeros({ n: 7 }), falhou: false });
  });
  it("antes do piso do setor: sem histórico, sem consultar", async () => {
    let chamou = false;
    const r = await carregarComparacao(cmp, "2026-10-01", async () => ((chamou = true), { n: 1 }), numeros, () => null);
    expect(chamou).toBe(false);
    expect(r).toEqual({ rotulo: "vs Set/26", base: null, falhou: false });
  });
  it("fonte do setor fora no período de comparação: falhou (os números que vieram ficam)", async () => {
    const r = await carregarComparacao(cmp, "2025-10-01", async () => ({ n: 3 }), numeros, () => "ORA-1");
    expect(r).toEqual({ rotulo: "vs Set/26", base: numeros({ n: 3 }), falhou: true });
  });
  it("carregador lançou: falhou, sem base", async () => {
    const r = await carregarComparacao(cmp, "2025-10-01", async () => { throw new Error("x"); }, numeros, () => null);
    expect(r).toEqual({ rotulo: "vs Set/26", base: null, falhou: true });
  });
});
