import { describe, it, expect } from "vitest";
import {
  grupoDoCargo,
  ehSetorRecebimento,
  linhasEquipePorCargo,
  equipeDasLinhas,
  fracaoDoMes,
  calcularIndicadores,
} from "./recebimento";
import type { Funcionario } from "./types";

function func(p: Partial<Funcionario>): Funcionario {
  return {
    id: "x",
    nome: "Fulano",
    cargo: "Ajudante",
    setorId: "rec",
    custoMensal: 1000,
    dataAdmissao: "2026-01-01",
    status: "ativo",
    salarioBase: null,
    passagem: null,
    alimentacao: null,
    planoSaude: null,
    ajudaCusto: null,
    premiacao: null,
    adicionalNoturno: null,
    ...p,
  } as Funcionario;
}

describe("grupoDoCargo", () => {
  it("casa ajudante e conferente sem acento e sem caixa", () => {
    expect(grupoDoCargo("AJUDANTE DE CARGA")).toBe("ajudante");
    expect(grupoDoCargo(" Conferente ")).toBe("conferente");
    expect(grupoDoCargo("CONFERENTE LÍDER")).toBe("conferente");
    expect(grupoDoCargo("Operador de empilhadeira")).toBe("outros");
  });
});

describe("ehSetorRecebimento", () => {
  it("aceita variações de grafia", () => {
    expect(ehSetorRecebimento("RECEBIMENTO")).toBe(true);
    expect(ehSetorRecebimento("Recebimento / Doca")).toBe(true);
    expect(ehSetorRecebimento("Expedição")).toBe(false);
  });
});

describe("linhasEquipePorCargo + equipeDasLinhas", () => {
  const setores = [
    { id: "rec", nome: "Recebimento" },
    { id: "exp", nome: "Expedição" },
  ];
  it("conta só ativos do recebimento, por cargo, e soma a folha", () => {
    const fs = [
      func({ cargo: "Ajudante", custoMensal: 2000 }),
      func({ cargo: "Ajudante", custoMensal: 2000 }),
      func({ cargo: "Ajudante", status: "afastado", custoMensal: 2000 }),
      func({ cargo: "Conferente", custoMensal: 3000 }),
      func({ cargo: "Operador", custoMensal: 2500 }),
      func({ cargo: "Ajudante", setorId: "exp", custoMensal: 9999 }),
    ];
    const { setor, linhas } = linhasEquipePorCargo(fs, setores);
    expect(setor).toBe("Recebimento");
    expect(equipeDasLinhas(setor, linhas)).toEqual({
      setor: "Recebimento",
      total: 4,
      ajudantes: 2,
      conferentes: 1,
      custo: 9500,
    });
  });
  it("sem setor de recebimento → equipe vazia", () => {
    const { setor, linhas } = linhasEquipePorCargo([func({})], [{ id: "exp", nome: "Expedição" }]);
    expect(equipeDasLinhas(setor, linhas).total).toBe(0);
  });
});

describe("fracaoDoMes", () => {
  const hoje = new Date(2026, 9, 10); // 10/out/2026
  it("mês fechado = 1, corrente = proporcional, futuro = 0", () => {
    expect(fracaoDoMes("2026-09-01", hoje)).toBe(1);
    expect(fracaoDoMes("2026-10-01", hoje)).toBeCloseTo(10 / 31);
    expect(fracaoDoMes("2026-11-01", hoje)).toBe(0);
  });
});

describe("calcularIndicadores", () => {
  const equipe = { setor: "Recebimento", total: 12, ajudantes: 10, conferentes: 2, custo: 30_000 };
  it("calcula médias e razões do mês fechado", () => {
    const r = calcularIndicadores({
      mes: "2026-09-01",
      equipe,
      equipeEstimada: false,
      diasDescarrego: 20,
      carros: 150,
      pesoKg: 2_000_000,
      receitaDescarrego: 150_000,
      faturamentoLiquido: 3_000_000,
      fracaoMes: 1,
    });
    expect(r.kgPorAjudante).toBe(200_000);
    expect(r.kgPorAjudanteDia).toBe(10_000);
    expect(r.carrosPorConferente).toBe(75);
    expect(r.kgPorConferente).toBe(1_000_000);
    expect(r.custoSobreFaturamento).toBeCloseTo(0.01);
    expect(r.custoSobreDescarrego).toBeCloseTo(0.2);
    expect(r.custoPorTonelada).toBe(15);
    expect(r.kgPorCarro).toBeCloseTo(13_333.33, 1);
    expect(r.carrosPorDia).toBe(7.5);
    expect(r.resultado).toBe(120_000);
  });
  it("mês corrente usa a folha proporcional e não divide por zero", () => {
    const r = calcularIndicadores({
      mes: "2026-10-01",
      equipe: { ...equipe, ajudantes: 0, conferentes: 0 },
      equipeEstimada: false,
      diasDescarrego: 0,
      carros: 0,
      pesoKg: 0,
      receitaDescarrego: 0,
      faturamentoLiquido: null,
      fracaoMes: 0.5,
    });
    expect(r.custoPeriodo).toBe(15_000);
    expect(r.kgPorAjudante).toBeNull();
    expect(r.carrosPorConferente).toBeNull();
    expect(r.custoSobreFaturamento).toBeNull();
    expect(r.custoSobreDescarrego).toBeNull();
    expect(r.resultado).toBe(-15_000);
  });
});
