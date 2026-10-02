import { describe, it, expect } from "vitest";
import { chaveFornecedor, acharDuplicado } from "./fornecedores";

describe("chaveFornecedor", () => {
  it("ignora acento, pontuação, espaço e razão social (casos reais do cadastro)", () => {
    const pares: [string, string][] = [
      ["BUNGE ALIMENTOS S/A.", "BUNGE ALIMENTOS S/A"],
      ["TIMBAUBA S.A", "TIMBAÚBA . S.A"],
      ["YPIOCA INDL.DE BEBIDAS LTDA - MATRIZ", "YPIOCA INDL. DE BEBIDAS LTDA- MATRIZ"],
      ["COPOBRÁS S/A IND.COM.DE EMBALAGENS", "COPOBRÁS S/A IND. E COM. DE EMBALAGENS"],
      ["USINA CENTRAL OLHO DÀGUA", "USINA CENTRAL OLHO D' ÁGUA"],
      ["HEINZ BRASIL S.A ( HEMMER)", "HEINZ BRASIL S.A (HEMMER)"],
      ["INDALI IND. DE ALIMENTOS LTDA.", "INDALI IND.DE ALIMENTOS LTD"],
      ["HYPERA S/A", "HYPERA S.A."],
    ];
    for (const [a, b] of pares) expect(chaveFornecedor(a), `${a} × ${b}`).toBe(chaveFornecedor(b));
  });
  it("empresas diferentes continuam diferentes", () => {
    expect(chaveFornecedor("LATICINIOS NOSSO LTDA")).not.toBe(chaveFornecedor("LATICINIOS SÃO JOÃO S/A"));
    expect(chaveFornecedor("COOP. VINICOLA GARIBALDI LTDA")).not.toBe(chaveFornecedor("COOP.COOPER FOODS"));
    expect(chaveFornecedor("SA")).toBe("SA"); // nome só com razão social não vira vazio
  });
});

describe("acharDuplicado", () => {
  const cadastro = [
    { id: "1", nome: "BUNGE ALIMENTOS S/A.", ativo: true },
    { id: "2", nome: "BUNGE ALIMENTOS S/A", ativo: false },
    { id: "3", nome: "SEARA ALIMENTOS LTDA", ativo: false },
  ];
  it("acha o ativo primeiro", () => {
    expect(acharDuplicado("Bunge Alimentos SA", cadastro)?.id).toBe("1");
  });
  it("acha encerrado quando não há ativo", () => {
    expect(acharDuplicado("SEARA ALIMENTOS", cadastro)?.id).toBe("3");
  });
  it("renomear o próprio cadastro não é duplicado", () => {
    expect(acharDuplicado("BUNGE ALIMENTOS S/A", [cadastro[0]], "1")).toBeNull();
    expect(acharDuplicado("MASSA LEVE", cadastro)).toBeNull();
  });
});
