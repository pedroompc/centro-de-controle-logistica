import { describe, expect, it } from "vitest";
import { custoGruposDoMes, ehAluguelGalpao, fracao, grupoDoLancamento, grupoDoSetor, projetarMes, somarMeses } from "./custo-grupos";

describe("grupoDoSetor", () => {
  it("separa entrega, administrativo e galpão", () => {
    expect(grupoDoSetor("Motoristas")).toBe("entrega");
    expect(grupoDoSetor("Ajudantes de Entrega")).toBe("entrega");
    expect(grupoDoSetor("Monitoramento")).toBe("administrativo");
    expect(grupoDoSetor("ADM")).toBe("administrativo");
    expect(grupoDoSetor("Separação")).toBe("galpao");
    expect(grupoDoSetor("Manutenção")).toBe("galpao");
    expect(grupoDoSetor("Noite")).toBe("galpao");
    expect(grupoDoSetor("Logística Geral")).toBe("administrativo");
  });
  it("tira setor de teste do custo", () => {
    expect(grupoDoSetor("ZZ Teste Comercial")).toBeNull();
  });
});

describe("grupoDoLancamento", () => {
  it("frota é entrega; equipamento e casa são galpão", () => {
    expect(grupoDoLancamento("Frota · Diesel (estimado)")).toBe("entrega");
    expect(grupoDoLancamento("Frota · Manutenção")).toBe("entrega");
    expect(grupoDoLancamento("Agregado")).toBe("entrega");
    expect(grupoDoLancamento("Equipamento · Empilhadeira (Recebimento)")).toBe("galpao");
    expect(grupoDoLancamento("Casa (Moreno)")).toBe("galpao");
    expect(grupoDoLancamento("Filme Stretch")).toBe("galpao");
  });
});

describe("ehAluguelGalpao", () => {
  it("só o lançamento do aluguel, não os do galpão", () => {
    expect(ehAluguelGalpao("Galpão")).toBe(true);
    expect(ehAluguelGalpao("Aluguel galpão")).toBe(true);
    expect(ehAluguelGalpao("Equipamento · Patinha")).toBe(false);
    expect(ehAluguelGalpao("Casa (Moreno)")).toBe(false);
  });
});

describe("custoGruposDoMes", () => {
  const m = custoGruposDoMes(
    "2026-11-01",
    [
      { setor: "Motoristas", custo: 300, ativos: 3 },
      { setor: "Separação", custo: 200 },
      { setor: "ADM", custo: 100 },
      { setor: "ZZ Teste Comercial", custo: 1000 },
      { setor: "INSS", custo: 0 },
    ],
    [
      { nome: "Frota · Diesel (estimado)", tipo: "variavel", valor: 50 },
      { nome: "Equipamento · Patinha", tipo: "fixo", valor: 20 },
      { nome: "Galpão", tipo: "fixo", valor: 400 },
    ],
  );
  it("aluguel do galpão fica fora dos grupos, mas entra no total logístico", () => {
    expect(m.aluguel).toBe(400);
    expect(m.totalComAluguel).toBe(1070);
    expect(m.lancamentos.map((l) => l.nome)).toEqual(["Frota · Diesel (estimado)", "Equipamento · Patinha"]);
    expect(somarMeses([m, m]).aluguel).toBe(800);
  });
  it("soma folha e lançamentos por grupo", () => {
    expect(m.grupos.entrega).toEqual({ folha: 300, fixos: 0, variaveis: 50, total: 350, pessoas: 3 });
    expect(m.grupos.galpao).toEqual({ folha: 200, fixos: 20, variaveis: 0, total: 220, pessoas: 0 });
    expect(m.grupos.administrativo.total).toBe(100);
    expect(m.total).toBe(670);
  });
  it("os grupos somam o total e o setor de teste fica fora", () => {
    expect(m.grupos.galpao.total + m.grupos.entrega.total + m.grupos.administrativo.total).toBe(m.total);
    expect(m.setores.map((s) => s.setor)).toEqual(["Motoristas", "Separação", "ADM"]);
  });
  it("acumula meses", () => {
    const s = somarMeses([m, m]);
    expect(s.total).toBe(1340);
    expect(s.grupos.entrega.variaveis).toBe(100);
  });
});

describe("fracao e projeção", () => {
  it("fração sem denominador é null", () => {
    expect(fracao(10, 0)).toBeNull();
    expect(fracao(null, 10)).toBeNull();
    expect(fracao(25, 100)).toBe(0.25);
  });
  it("projeta pelo ritmo dos dias corridos", () => {
    expect(projetarMes(100, new Date(2026, 10, 10))).toBe(300); // nov = 30 dias
  });
});
