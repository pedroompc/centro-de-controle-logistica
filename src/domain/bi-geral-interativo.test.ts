import { describe, expect, it } from "vitest";
import {
  composicaoCusto, efetivoPorSetor, lerVisao, lerVisaoGeral, totalFaturamentoDias, visaoDoIndicador,
} from "./bi-geral-interativo";
import type { CustoMensal, Funcionario } from "./types";

describe("lerVisao / lerVisaoGeral", () => {
  it("aceita só visões conhecidas; o resto é null (palco volta aos Setores)", () => {
    expect(lerVisaoGeral("efetivo")).toBe("efetivo");
    expect(lerVisaoGeral("custoSobreFat")).toBe("custoSobreFat");
    expect(lerVisaoGeral("x")).toBeNull();
    expect(lerVisaoGeral(undefined)).toBeNull();
    expect(lerVisao("km", ["km", "custo"] as const)).toBe("km");
    expect(lerVisao("frota", ["km", "custo"] as const)).toBeNull();
  });
});

describe("visaoDoIndicador", () => {
  it("cada linha da Geral abre o quadro do BI do setor que tem aquele número", () => {
    expect(visaoDoIndicador("separacao", "pedidos")).toBe("producao");
    expect(visaoDoIndicador("separacao", "custoPorCaixa")).toBe("custo");
    expect(visaoDoIndicador("recebimento", "carros")).toBe("descarrego");
    expect(visaoDoIndicador("recebimento", "receita")).toBe("receita");
    expect(visaoDoIndicador("abastecimento", "movimentacoes")).toBe("movimento");
    expect(visaoDoIndicador("abastecimento", "rupturas")).toBe("rupturas");
    expect(visaoDoIndicador("motoristas", "devolucao")).toBe("devolucao");
    expect(visaoDoIndicador("motoristas", "kmPorEntrega")).toBe("km");
    expect(visaoDoIndicador("motoristas", "desconhecido")).toBeNull();
  });
});

const func = (p: Partial<Funcionario>): Funcionario => ({
  id: p.nome ?? "x", nome: "x", cargo: "Aux", setorId: "s1", custoMensal: 3000, dataAdmissao: "2025-01-01", status: "ativo", turno: "manha",
  salarioBase: null, passagem: null, alimentacao: null, planoSaude: null, ajudaCusto: null, premiacao: null, adicionalNoturno: null,
  ...p,
} as Funcionario);

describe("efetivoPorSetor", () => {
  it("só ativos, agrupados por setor (maior primeiro), pessoas em ordem alfabética, com total de custo", () => {
    const g = efetivoPorSetor(
      [
        func({ nome: "Zé", setorId: "s1", custoMensal: 2000 }),
        func({ nome: "Ana", setorId: "s1", custoMensal: 3000 }),
        func({ nome: "Bia", setorId: "s2" }),
        func({ nome: "Caio", setorId: "s2", status: "desligado" as Funcionario["status"] }),
        func({ nome: "Duda", setorId: "sX" }),
      ],
      [{ id: "s1", nome: "Separação" }, { id: "s2", nome: "Recebimento" }],
    );
    expect(g.map((x) => x.setor)).toEqual(["Separação", "Recebimento", "Sem setor"]);
    expect(g[0].pessoas.map((p) => p.nome)).toEqual(["Ana", "Zé"]);
    expect(g[0].custo).toBe(5000);
    expect(g[1].pessoas).toHaveLength(1);
  });
});

const lanc = (nome: string, tipo: "fixo" | "variavel", valor: number): CustoMensal => ({ id: nome, mes: "2026-10-01", nome, tipo, valor, data: null } as CustoMensal);

describe("composicaoCusto", () => {
  it("folha + fixos + variáveis = total; maiores lançamentos em ordem decrescente", () => {
    const c = composicaoCusto({ folha: 1000, lancamentos: [lanc("Aluguel", "fixo", 300), lanc("Diesel", "variavel", 500), lanc("Filme", "variavel", 50)], top: 2 });
    expect(c).toMatchObject({ folha: 1000, fixos: 300, variaveis: 550, total: 1850 });
    expect(c.maiores.map((l) => l.nome)).toEqual(["Diesel", "Aluguel"]);
  });

  it("mesmo nome em meses diferentes (período livre) soma numa linha só", () => {
    const c = composicaoCusto({ folha: 0, lancamentos: [lanc("Diesel", "variavel", 500), { ...lanc("Diesel", "variavel", 200), id: "d2", mes: "2026-11-01" }], top: 5 });
    expect(c.maiores).toEqual([{ nome: "Diesel", tipo: "variavel", valor: 700 }]);
  });
});

describe("totalFaturamentoDias", () => {
  it("líquido = venda − devolução − avulsa, por dia e no total", () => {
    const t = totalFaturamentoDias([
      { dia: "2026-10-01", venda: 100, devolucao: 10, avulsa: 1 },
      { dia: "2026-10-02", venda: 200, devolucao: 0, avulsa: 0 },
    ]);
    expect(t.dias.map((d) => d.liquido)).toEqual([89, 200]);
    expect(t.total).toMatchObject({ venda: 300, devolucao: 10, avulsa: 1, liquido: 289 });
  });
});
