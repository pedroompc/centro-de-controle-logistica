import { describe, it, expect } from "vitest";
import { filtrarPorBusca, filtrarPorTipo, ordenarMotoristas, corTaxa, tipoMotoristaInfo } from "./devolucoes-ui";
import type { DevolucaoPorMotorista } from "./devolucoes";

const m = (over: Partial<DevolucaoPorMotorista>): DevolucaoPorMotorista => ({
  codMotorista: 1, nome: "Fulano", tipo: null, expedidas: 100, devolvidas: 5, taxa: 5, valorDevolvido: 1000, ...over,
});

describe("filtrarPorBusca", () => {
  const lista = [
    { nome: "João Silva", cod: 12 },
    { nome: "Maria Souza", cod: 34 },
  ];
  const campos = (x: { nome: string; cod: number }) => [x.nome, x.cod];

  it("retorna tudo quando a busca é vazia", () => {
    expect(filtrarPorBusca(lista, "", campos)).toHaveLength(2);
    expect(filtrarPorBusca(lista, "   ", campos)).toHaveLength(2);
  });

  it("filtra por nome, sem diferenciar maiúsculas", () => {
    const r = filtrarPorBusca(lista, "joão", campos);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("João Silva");
  });

  it("filtra por código numérico", () => {
    const r = filtrarPorBusca(lista, "34", campos);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("Maria Souza");
  });
});

describe("ordenarMotoristas", () => {
  const lista = [
    m({ codMotorista: 1, taxa: 5, valorDevolvido: 300 }),
    m({ codMotorista: 2, taxa: 20, valorDevolvido: 100 }),
    m({ codMotorista: 3, taxa: 12, valorDevolvido: 200 }),
  ];

  it("ordena por taxa desc", () => {
    const r = ordenarMotoristas(lista, "taxa", "desc");
    expect(r.map((x) => x.codMotorista)).toEqual([2, 3, 1]);
  });

  it("ordena por valorDevolvido asc", () => {
    const r = ordenarMotoristas(lista, "valorDevolvido", "asc");
    expect(r.map((x) => x.codMotorista)).toEqual([2, 3, 1]);
  });

  it("não muta a lista original", () => {
    const antes = lista.map((x) => x.codMotorista);
    ordenarMotoristas(lista, "taxa", "asc");
    expect(lista.map((x) => x.codMotorista)).toEqual(antes);
  });
});

describe("corTaxa (semáforo)", () => {
  it("neutro abaixo de 8%", () => expect(corTaxa(5)).toBe("text-slate-500"));
  it("âmbar de 8% a 15%", () => expect(corTaxa(10)).toBe("text-amber-600"));
  it("vermelho em 15% ou mais", () => expect(corTaxa(15)).toBe("text-rose-600"));
});

describe("filtrarPorTipo (vínculo do motorista)", () => {
  const lista = [
    m({ codMotorista: 1, tipo: "F" }),
    m({ codMotorista: 2, tipo: "T" }),
    m({ codMotorista: 3, tipo: null }),
  ];

  it("sem filtro (''), devolve a lista inteira", () => {
    expect(filtrarPorTipo(lista, "")).toHaveLength(3);
  });
  it("filtra só os da casa (F)", () => {
    const r = filtrarPorTipo(lista, "F");
    expect(r.map((x) => x.codMotorista)).toEqual([1]);
  });
  it("filtra só os terceirizados (T)", () => {
    const r = filtrarPorTipo(lista, "T");
    expect(r.map((x) => x.codMotorista)).toEqual([2]);
  });
});

describe("tipoMotoristaInfo (rótulo do vínculo)", () => {
  it("F → Da casa", () => expect(tipoMotoristaInfo("F").label).toBe("Da casa"));
  it("T → Terceirizado", () => expect(tipoMotoristaInfo("T").label).toBe("Terceirizado"));
  it("null → Não informado", () => expect(tipoMotoristaInfo(null).label).toBe("Não informado"));
});
