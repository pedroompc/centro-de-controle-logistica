import { describe, it, expect } from "vitest";
import { fotoAtual, composicaoFolha } from "./efetivo";
import { absenteismoPorMes } from "./absenteismo-mensal";
import type { Funcionario, Falta } from "./types";

function func(over: Partial<Funcionario>): Funcionario {
  return {
    id: "x", nome: "F", cargo: "C", setorId: "s1", custoMensal: 1000,
    dataAdmissao: "2026-01-01", status: "ativo",
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
