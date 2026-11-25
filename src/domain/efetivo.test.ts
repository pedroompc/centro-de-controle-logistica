import { describe, it, expect } from "vitest";
import { fotoAtual, composicaoFolha, fotoSetorAtual, totaisEfetivoPorMes, custoMensalDaComposicao, efetivoSetorNoMes } from "./efetivo";
import { absenteismoPorMes } from "./absenteismo-mensal";
import type { Funcionario, Falta } from "./types";

function func(over: Partial<Funcionario>): Funcionario {
  return {
    id: "x", nome: "F", cargo: "C", setorId: "s1", custoMensal: 1000,
    dataAdmissao: "2026-01-01", status: "ativo", turno: "manha",
    salarioBase: null, passagem: null, alimentacao: null, planoSaude: null,
    ajudaCusto: null, premiacao: null, adicionalNoturno: null,
    ...over,
  };
}

describe("fotoAtual", () => {
  it("conta por status e soma folha só dos ativos", () => {
    const foto = fotoAtual([
      func({ id: "1", custoMensal: 2000, status: "ativo" }),
      func({ id: "2", custoMensal: 3000, status: "ativo" }),
      func({ id: "3", custoMensal: 5000, status: "afastado" }),
      func({ id: "4", custoMensal: 9000, status: "desligado" }),
    ]);
    expect(foto).toEqual({ ativos: 2, afastados: 1, desligados: 1, folhaTotal: 5000 });
  });
});

describe("composicaoFolha", () => {
  it("soma rubricas dos ativos, ignora null e omite rubrica zerada", () => {
    const itens = composicaoFolha([
      func({ id: "1", status: "ativo", salarioBase: 1500, passagem: 200, alimentacao: null }),
      func({ id: "2", status: "ativo", salarioBase: 1800, passagem: null, alimentacao: 300 }),
      func({ id: "3", status: "desligado", salarioBase: 9999 }), // fora (não é ativo)
    ]);
    const porChave = Object.fromEntries(itens.map((i) => [i.chave, i.valor]));
    expect(porChave.salarioBase).toBe(3300);
    expect(porChave.passagem).toBe(200);
    expect(porChave.alimentacao).toBe(300);
    // plano/ajuda/premiação/adicional zerados não aparecem
    expect(itens.some((i) => i.chave === "planoSaude")).toBe(false);
  });
});

describe("fotoSetorAtual", () => {
  const setores = [
    { id: "s1", nome: "Motoristas" },
    { id: "s2", nome: "Adega" },
    { id: "s3", nome: "Vazio" },
  ];
  it("agrega por setor, folha só dos ativos, e omite setor sem ninguém", () => {
    const linhas = fotoSetorAtual(
      [
        func({ id: "1", setorId: "s1", custoMensal: 2000, status: "ativo" }),
        func({ id: "2", setorId: "s1", custoMensal: 3000, status: "afastado" }),
        func({ id: "3", setorId: "s2", custoMensal: 1500, status: "ativo" }),
      ],
      setores,
    );
    const porSetor = Object.fromEntries(linhas.map((l) => [l.setor, l]));
    expect(porSetor.Motoristas).toEqual({ setor: "Motoristas", ativos: 1, afastados: 1, desligados: 0, custoAtivos: 2000 });
    expect(porSetor.Adega.custoAtivos).toBe(1500);
    expect(porSetor.Vazio).toBeUndefined(); // sem ninguém → fora
  });
});

describe("totaisEfetivoPorMes", () => {
  it("soma setores por mês e ordena por mês", () => {
    const totais = totaisEfetivoPorMes([
      { mes: "2026-08-01", ativos: 5, afastados: 1, custoAtivos: 10000 },
      { mes: "2026-07-01", ativos: 4, afastados: 0, custoAtivos: 8000 },
      { mes: "2026-08-01", ativos: 3, afastados: 0, custoAtivos: 6000 },
    ]);
    expect(totais.map((t) => t.mes)).toEqual(["2026-07-01", "2026-08-01"]);
    expect(totais[1]).toEqual({ mes: "2026-08-01", ativos: 8, afastados: 1, folhaTotal: 16000 });
  });
});

describe("absenteismoPorMes", () => {
  const falta = (data: string, tipo: Falta["tipo"]): Falta => ({
    id: data + tipo, funcionarioId: "f1", data, tipo, observacao: null,
  });

  it("agrega por mês, separa ausência real de folga/férias e zera mês vazio", () => {
    const meses = ["2026-07-01", "2026-08-01", "2026-09-01"];
    const pontos = absenteismoPorMes(
      [
        falta("2026-07-10", "injustificada"),
        falta("2026-07-15", "atestado"),
        falta("2026-07-20", "ferias"), // não conta no total
        falta("2026-09-02", "justificada"),
        falta("2025-12-01", "injustificada"), // fora da janela
      ],
      meses,
    );
    expect(pontos.map((p) => p.mes)).toEqual(meses);
    expect(pontos[0].total).toBe(2); // injustificada + atestado (férias fora)
    expect(pontos[0].porTipo.ferias).toBe(1);
    expect(pontos[1].total).toBe(0); // agosto vazio
    expect(pontos[2].total).toBe(1);
  });
});

describe("custoMensalDaComposicao", () => {
  const vazio = {
    salarioBase: null, passagem: null, alimentacao: null, planoSaude: null,
    ajudaCusto: null, premiacao: null, adicionalNoturno: null,
  };

  it("salário × 1,85 + demais rubricas pelo valor (caso real: 1.640 + 198 + 330 = 3.562)", () => {
    expect(custoMensalDaComposicao({ ...vazio, salarioBase: 1640, passagem: 198, alimentacao: 330, ajudaCusto: 0, adicionalNoturno: 0 })).toBe(3562);
  });

  it("o fator vale só para o salário", () => {
    expect(custoMensalDaComposicao({ ...vazio, premiacao: 100, adicionalNoturno: 50 })).toBe(150);
  });

  it("arredonda a centavos", () => {
    expect(custoMensalDaComposicao({ ...vazio, salarioBase: 1234.57 })).toBe(2283.95);
  });

  it("sem nenhuma rubrica: null (custo fica o digitado)", () => {
    expect(custoMensalDaComposicao(vazio)).toBeNull();
  });
});

describe("efetivoSetorNoMes", () => {
  const setores = [{ id: "s1", nome: "Motoristas" }, { id: "s2", nome: "Separação" }];
  // Setembro/2026 tem 30 dias.
  const ef = (fs: Funcionario[], mes = "2026-09-01", hoje = "2026-11-25") => efetivoSetorNoMes(fs, setores, mes, hoje);

  it("conta quem estava na empresa no último dia do mês, com custo atual", () => {
    const [l] = ef([func({ id: "1", custoMensal: 3000 }), func({ id: "2", custoMensal: 6000 })]);
    expect(l).toMatchObject({ setor: "Motoristas", ativos: 2, desligados: 0 });
    expect(l.custoAtivos).toBeCloseTo(9000);
  });

  it("admitido depois do mês não conta; admitido no meio paga a fração", () => {
    const [l] = ef([func({ id: "1", dataAdmissao: "2026-10-01" }), func({ id: "2", dataAdmissao: "2026-09-16", custoMensal: 3000 })]);
    expect(l.ativos).toBe(1);
    expect(l.custoAtivos).toBeCloseTo(1500); // 15 de 30 dias
  });

  it("desligado no meio do mês: sai da contagem, paga os dias e entra como desligado do mês", () => {
    const [l] = ef([func({ id: "1", status: "desligado", dataDesligamento: "2026-09-10", custoMensal: 3000 })]);
    expect(l).toMatchObject({ ativos: 0, desligados: 1 });
    expect(l.custoAtivos).toBeCloseTo(1000); // 10 de 30 dias
  });

  it("desligado depois do mês ainda conta inteiro naquele mês", () => {
    const [l] = ef([func({ id: "1", status: "desligado", dataDesligamento: "2026-11-23", custoMensal: 3000 })]);
    expect(l).toMatchObject({ ativos: 1, desligados: 0 });
    expect(l.custoAtivos).toBeCloseTo(3000);
  });

  it("desligado sem data nunca conta (fora do efetivo, ex.: faturistas)", () => {
    expect(ef([func({ id: "1", status: "desligado", dataDesligamento: null })])).toEqual([]);
  });

  it("afastado conta como afastado, sem custo", () => {
    const [l] = ef([func({ id: "1", status: "afastado" })]);
    expect(l).toMatchObject({ ativos: 0, afastados: 1, custoAtivos: 0 });
  });

  it("mês aberto: conta quem está hoje, mês cheio de custo; quem entra depois de hoje fica fora", () => {
    const [l] = ef(
      [func({ id: "1", custoMensal: 3000 }), func({ id: "2", dataAdmissao: "2026-11-28" })],
      "2026-11-01",
      "2026-11-25",
    );
    expect(l.ativos).toBe(1);
    expect(l.custoAtivos).toBeCloseTo(3000);
  });

  it("mês futuro não tem efetivo", () => {
    expect(ef([func({ id: "1" })], "2026-12-01")).toEqual([]);
  });

  it("separa por setor de hoje", () => {
    const linhas = ef([func({ id: "1", setorId: "s1" }), func({ id: "2", setorId: "s2" }), func({ id: "3", setorId: "s2" })]);
    expect(linhas.map((l) => [l.setor, l.ativos])).toEqual([["Motoristas", 1], ["Separação", 2]]);
  });
});
