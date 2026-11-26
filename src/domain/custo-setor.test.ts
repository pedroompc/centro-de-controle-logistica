import { describe, it, expect } from "vitest";
import { custoMensalDoSetor, setorNoPeriodo } from "./custo-setor";
import type { Funcionario } from "./types";

const f = (id: string, setorId: string, custoMensal: number, cargo = "Ajudante", status: Funcionario["status"] = "ativo") =>
  ({ id, nome: id, cargo, setorId, custoMensal, status } as Funcionario);

const setores = [
  { id: "rec", nome: "Recebimento" },
  { id: "abs", nome: "Abastecimento" },
  { id: "emp", nome: "Empilhador" },
];
const funcionarios = [
  f("a", "rec", 3000),
  f("b", "rec", 2000, "Conferente"),
  f("c", "abs", 4000),
  f("d", "abs", 9000, "Ajudante", "afastado"),
  f("op", "emp", 5000, "Operador de empilhadeira"),
];
const equip = [
  { id: "1", nome: "Paleteira", setor: "abastecimento", quantidade: 2, custoUnitario: 500 },
  { id: "2", nome: "Empilhadeira", setor: "Recebimento", quantidade: 1, custoUnitario: 7000 },
];

describe("custoMensalDoSetor", () => {
  it("folha dos ativos + equipamentos do setor (nome sem caixa/acento)", () => {
    expect(custoMensalDoSetor(setores[1], funcionarios, setores, equip)).toEqual({ folha: 4000, equipamentos: 1000, empilhador: 0, total: 5000 });
  });
  it("Recebimento soma o empilhador de outro setor e os equipamentos dele", () => {
    expect(custoMensalDoSetor(setores[0], funcionarios, setores, equip)).toEqual({ folha: 5000, equipamentos: 7000, empilhador: 5000, total: 17000 });
  });
  it("sem tabela de equipamentos: Recebimento usa a empilhadeira padrão, os outros nada", () => {
    expect(custoMensalDoSetor(setores[0], funcionarios, setores, null).equipamentos).toBe(6000);
    expect(custoMensalDoSetor(setores[1], funcionarios, setores, null).total).toBe(4000);
  });
  it("setor sem equipamento fica só com a folha", () => {
    expect(custoMensalDoSetor(setores[2], funcionarios, setores, equip).total).toBe(5000);
  });
});

describe("setorNoPeriodo", () => {
  const atual = { folha: 9000, equipamentos: 1000, empilhador: 500, total: 10500 };
  const out = [{ setor: "Abastecimento", ativos: 3, afastados: 0, custoAtivos: 6000 }, { setor: "Adega", ativos: 9, afastados: 0, custoAtivos: 99 }];
  const nov = [{ setor: "Abastecimento", ativos: 4, afastados: 1, custoAtivos: 8000 }];

  it("soma a folha dos meses, multiplica equipamentos e pega as pessoas do último mês", () => {
    const r = setorNoPeriodo("Abastecimento", [out, nov], atual);
    expect(r.custo).toEqual({ folha: 14000, equipamentos: 2000, empilhador: 1000, total: 17000 });
    expect(r.ativos).toBe(4);
    expect(r.afastados).toBe(1);
  });

  it("setor sem gente no último mês fica com zero pessoas", () => {
    const r = setorNoPeriodo("Adega", [out, nov], { folha: 0, equipamentos: 0, empilhador: 0, total: 0 });
    expect(r.custo.total).toBe(99);
    expect(r.ativos).toBe(0);
  });
});
