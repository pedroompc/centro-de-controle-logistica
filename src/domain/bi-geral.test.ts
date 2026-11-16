import { describe, expect, it } from "vitest";
import { resumoSeparacao, resumoAbastecimento, resumoMotoristas, resumoRecebimento, variacao, type IndicadorGeral } from "./bi-geral";
import { compararPct } from "./comparacao";
import type { DadosBISeparacao } from "@/app/(app)/setores/[id]/separacao-dados";
import type { DadosBIAbastecimento } from "@/app/(app)/setores/[id]/abastecimento-dados";
import type { DadosBIMotoristas } from "@/app/(app)/setores/[id]/motoristas-dados";
import type { DadosBI } from "@/app/(app)/setores/[id]/bi-recebimento/base";

const valores = (r: { indicadores: IndicadorGeral[] }) => r.indicadores.map((i) => i.valor);

const linha = (dia: string, caixas: number, kg: number) => ({ dia, turno: "dia", linhas: 10, caixas, unidades: 0, kg, comSeparador: true });
const eq = { pessoas: 1, separadores: 1, horasSeparadorDia: 8, conferentes: 0, custoMes: 0 };
const diaSep = (dia: string, pedidos: number) => ({ dia, pedidos, clientes: 0, cargas: 1, mapas: 1 });

describe("resumoSeparacao", () => {
  it("soma pedidos e peso e divide o custo pelas caixas", () => {
    const d = {
      ref: { custo: 4000, custoPeriodo: 4000 },
      fracaoMes: 1,
      faturamentoLiquido: null,
      folhaRef: null,
      producao: {
        linhas: [linha("2026-10-01", 150, 700), linha("2026-10-02", 250, 500)],
        dias: [diaSep("2026-10-01", 10), diaSep("2026-10-02", 20)],
        erros: [],
        equipe: { dia: eq, noite: eq },
        skusTurno: [],
      },
    } as unknown as DadosBISeparacao;
    const r = resumoSeparacao(d);
    expect(r.erro).toBeNull();
    expect(r.indicadores.map((i) => i.chave)).toEqual(["pedidos", "peso", "custoPorCaixa"]);
    expect(valores(r)).toEqual([30, 1200, 10]);
  });

  it("sem acesso ao Harpia devolve o erro e nenhum número", () => {
    const d = { ref: null, fracaoMes: 1, faturamentoLiquido: null, folhaRef: null, producao: { erro: "ORA-1" } } as unknown as DadosBISeparacao;
    const r = resumoSeparacao(d);
    expect(r.erro).toBe("ORA-1");
    expect(valores(r)).toEqual([null, null, null]);
  });
});

describe("resumoAbastecimento", () => {
  const h = {
    reabastecimento: [{ dia: "2026-10-01", abastecimentos: 7, caixas: 0, unidades: 0, skus: 0 }, { dia: "2026-10-02", abastecimentos: 5, caixas: 0, unidades: 0, skus: 0 }],
    movimentoPiso: { a424: [{ dia: "2026-10-01", funcao: "04", usuario: 1, tarefas: 40 }], empilhadores: [1], lancadoresWms: [] },
    rupturas: [{}, {}, {}],
  };

  it("movimentações, reabastecimentos e rupturas", () => {
    const r = resumoAbastecimento({ harpia: { dados: h } } as unknown as DadosBIAbastecimento);
    expect(r.indicadores.map((i) => i.chave)).toEqual(["movimentacoes", "reabastecimentos", "rupturas"]);
    expect(valores(r)).toEqual([40, 12, 3]);
  });

  it("Harpia fora: erro e nenhum número", () => {
    const r = resumoAbastecimento({ harpia: { erro: "x" } } as unknown as DadosBIAbastecimento);
    expect(r.erro).toBe("x");
    expect(valores(r)).toEqual([null, null, null]);
  });
});

describe("resumoMotoristas", () => {
  const viagem = (dia: string, entregas: number, kg: number) => ({ dia, veiculo: 1, placa: "AAA1B23", capacidadeKg: null, motorista: 1, cargas: 1, notas: 1, entregas, kg, valor: 0 });
  const base = {
    ref: null,
    fracaoMes: 1,
    faturamentoLiquido: null,
    entregas: { viagens: [viagem("2026-10-01", 5, 100), viagem("2026-10-02", 7, 50)] },
    devolucao: [{ dia: "2026-10-01", codMotorista: 1, nome: "A", tipo: "F", expedidas: 20, devolvidas: 1, valorExpedido: 0, valorDevolvido: 0 }],
    hodometro: null,
  };

  it("entregas, peso, clientes, devolução e km (sem telemetria = null)", () => {
    const r = resumoMotoristas(base as unknown as DadosBIMotoristas, 9);
    expect(r.indicadores.map((i) => i.chave)).toEqual(["entregas", "peso", "clientes", "devolucao", "kmPorEntrega"]);
    expect(valores(r)).toEqual([12, 150, 9, 0.05, null]);
  });

  it("sem Winthor: erro e nenhum número de entrega", () => {
    const r = resumoMotoristas({ ...base, entregas: { erro: "rede" }, devolucao: null } as unknown as DadosBIMotoristas, null);
    expect(r.erro).toBe("rede");
    expect(valores(r)).toEqual([null, null, null, null, null]);
  });
});

describe("resumoRecebimento", () => {
  const serie = [{ mes: "2026-10-01", pesoKg: 9000, carros: 30, receitaDescarrego: 800 }];

  it("com fatos usa os fatos do recorte", () => {
    const fatos = [{ dia: "2026-10-01", fornecedor: "X", tipo: "batido", carros: 2, descargasVolume: 0, caixas: 0, pesoKg: 1500, receita: 120, notas: 2 }];
    const r = resumoRecebimento({ mes: "2026-10-01", serie, fatos } as unknown as DadosBI);
    expect(r.indicadores.map((i) => i.chave)).toEqual(["peso", "carros", "receita"]);
    expect(valores(r)).toEqual([1500, 2, 120]);
  });

  it("sem fatos usa a série do mês", () => {
    const r = resumoRecebimento({ mes: "2026-10-01", serie, fatos: null } as unknown as DadosBI);
    expect(valores(r)).toEqual([9000, 30, 800]);
  });

  it("mês fora da série: nenhum número", () => {
    const r = resumoRecebimento({ mes: "2026-05-01", serie, fatos: null } as unknown as DadosBI);
    expect(valores(r)).toEqual([null, null, null]);
  });
});

describe("variacao", () => {
  const ind = (valor: number | null): IndicadorGeral => ({ chave: "x", rotulo: "X", valor, formato: "int", maiorEhBom: true });

  it("compara pelo percentual", () => {
    expect(variacao(ind(110), ind(100))).toEqual(compararPct(110, 100, true));
  });

  it("sem base: null", () => {
    expect(variacao(ind(110), ind(null))).toBeNull();
    expect(variacao(ind(110), undefined)).toBeNull();
    expect(variacao(ind(null), ind(100))).toBeNull();
  });
});
