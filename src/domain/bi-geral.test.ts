import { describe, expect, it } from "vitest";
import { resumoSeparacao, resumoAbastecimento, resumoMotoristas, resumoRecebimento, variacao, comNovaTentativa, criarFila, conexaoCaiu, type IndicadorGeral } from "./bi-geral";
import { compararAbs, compararPct, compararTaxa } from "./comparacao";
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
    expect(r.indicadores.map((i) => i.chave)).toEqual(["entregas", "peso", "clientes", "devolucao", "kmPorVeiculoDia"]);
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
    const r = resumoRecebimento({ mes: "2026-10-01", mensal: true, serie, fatos } as unknown as DadosBI);
    expect(r.indicadores.map((i) => i.chave)).toEqual(["peso", "carros", "receita"]);
    expect(valores(r)).toEqual([1500, 2, 120]);
  });

  it("mês inteiro sem fatos usa a série do mês", () => {
    const r = resumoRecebimento({ mes: "2026-10-01", mensal: true, serie, fatos: null } as unknown as DadosBI);
    expect(valores(r)).toEqual([9000, 30, 800]);
  });

  it("período livre com o descarrego fora: erro e nenhum número (nunca 0)", () => {
    const ref = { mes: "2026-10-01", pesoKg: 0, carros: 0, receitaDescarrego: 0 };
    const r = resumoRecebimento({ mes: "2026-10-01", mensal: false, ref, serie, fatos: null } as unknown as DadosBI);
    expect(r.erro).toBeTruthy();
    expect(valores(r)).toEqual([null, null, null]);
  });

  it("mês fora da série: nenhum número", () => {
    const r = resumoRecebimento({ mes: "2026-05-01", mensal: true, serie, fatos: null } as unknown as DadosBI);
    expect(valores(r)).toEqual([null, null, null]);
  });
});

describe("variacao", () => {
  const ind = (valor: number | null): IndicadorGeral => ({ chave: "x", rotulo: "X", valor, formato: "int", maiorEhBom: true });

  it("compara pelo percentual", () => {
    expect(variacao(ind(110), ind(100))).toEqual(compararPct(110, 100, true));
  });

  it("taxa compara em pontos percentuais", () => {
    const taxa = (valor: number): IndicadorGeral => ({ chave: "devolucao", rotulo: "Devolução", valor, formato: "pct", maiorEhBom: false });
    expect(variacao(taxa(0.03), taxa(0.02))).toEqual(compararTaxa(0.03, 0.02, false));
  });

  it("contagem com base zero compara pela diferença absoluta", () => {
    const r = (valor: number): IndicadorGeral => ({ chave: "rupturas", rotulo: "Rupturas", valor, formato: "int", maiorEhBom: false });
    expect(variacao(r(6), r(0))).toEqual(compararAbs(6, 0, false));
  });

  it("sem base: null", () => {
    expect(variacao(ind(110), ind(null))).toBeNull();
    expect(variacao(ind(110), undefined)).toBeNull();
    expect(variacao(ind(null), ind(100))).toBeNull();
  });
});

describe("comNovaTentativa", () => {
  it("fonte falhou: tenta mais uma vez e fica com a segunda resposta", async () => {
    const respostas = [{ erro: "Attempt to access memory outside buffer bounds" as string | null }, { erro: null }];
    let n = 0;
    const r = await comNovaTentativa(async () => respostas[n++]);
    expect(n).toBe(2);
    expect(r.erro).toBeNull();
  });
  it("deu certo de primeira: não repete", async () => {
    let n = 0;
    await comNovaTentativa(async () => (n++, { erro: null }));
    expect(n).toBe(1);
  });
  it("conexão caiu duas vezes: devolve a falha", async () => {
    let n = 0;
    const r = await comNovaTentativa(async () => (n++, { erro: "Attempt to access memory outside buffer bounds" as string | null }));
    expect(n).toBe(2);
    expect(r.erro).toMatch(/buffer bounds/);
  });
  it("timeout ou erro de SQL: não repete (só esperaria de novo)", async () => {
    let n = 0;
    const r = await comNovaTentativa(async () => (n++, { erro: "NJS-040: connection request timeout" as string | null }));
    expect(n).toBe(1);
    expect(r.erro).toMatch(/NJS-040/);
  });
});

describe("criarFila", () => {
  it("com limite 1, roda uma tarefa por vez, na ordem de chegada", async () => {
    const fila = criarFila(1);
    const log: string[] = [];
    const tarefa = (nome: string, ms: number) => fila(async () => {
      log.push(`ini ${nome}`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`fim ${nome}`);
      return nome;
    });
    const r = await Promise.all([tarefa("a", 20), tarefa("b", 1)]);
    expect(r).toEqual(["a", "b"]);
    expect(log).toEqual(["ini a", "fim a", "ini b", "fim b"]);
  });
  it("com limite 2, roda no máximo duas ao mesmo tempo", async () => {
    const fila = criarFila(2);
    let rodando = 0;
    let pico = 0;
    const tarefa = () => fila(async () => {
      rodando++;
      pico = Math.max(pico, rodando);
      await new Promise((r) => setTimeout(r, 5));
      rodando--;
    });
    await Promise.all([tarefa(), tarefa(), tarefa(), tarefa()]);
    expect(pico).toBe(2);
  });
  it("uma tarefa que falha não trava a fila", async () => {
    const fila = criarFila(1);
    const a = fila(async () => { throw new Error("x"); });
    const b = fila(async () => "ok");
    await expect(a).rejects.toThrow("x");
    await expect(b).resolves.toBe("ok");
  });
});

describe("conexaoCaiu", () => {
  it("reconhece conexão morta, não timeout", () => {
    expect(conexaoCaiu("Attempt to access memory outside buffer bounds")).toBe(true);
    expect(conexaoCaiu("NJS-521: connection to host was closed")).toBe(true);
    expect(conexaoCaiu("ORA-03113: end-of-file on communication channel")).toBe(true);
    expect(conexaoCaiu("NJS-040: connection request timeout")).toBe(false);
    expect(conexaoCaiu("ORA-00904: invalid identifier")).toBe(false);
  });
});
