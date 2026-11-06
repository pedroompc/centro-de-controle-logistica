import { describe, it, expect } from "vitest";
import { custoMensalDoSetor } from "./custo-setor";
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
