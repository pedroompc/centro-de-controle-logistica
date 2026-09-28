import { describe, it, expect } from "vitest";
import {
  nivelEndereco, formatarEndereco, classificarProdutos, resumirProdutos, alertasProduto,
  type ProdutoMovimentado,
} from "./wms-produtos";

const prod = (merc: number, movimentos: number, extra: Partial<ProdutoMovimentado> = {}): ProdutoMovimentado => ({
  merc, descricao: null, embalagem: null, movimentos, verticais: 0, abastecimentos: 0, armazenagens: 0,
  internas: 0, devolucoes: 0, quantidade: 0, peso: 0, operadores: 1, operadorPrincipal: null,
  picking: "010101001", pulmoes: 0, qtdPaletePraticada: null, lastro: null, camadas: null,
  qtdPaleteCadastro: null, ...extra,
});

describe("nivelEndereco / formatarEndereco", () => {
  it("lê o nível nos dígitos 5–6", () => {
    expect(nivelEndereco("070903002")).toBe("03");
    expect(nivelEndereco("DOCA01")).toBeNull();
    expect(nivelEndereco(null)).toBeNull();
  });
  it("formata rua-prédio-nível-apto", () => {
    expect(formatarEndereco("070901002")).toBe("07-09-01-002");
    expect(formatarEndereco("DOCA01")).toBe("DOCA01");
    expect(formatarEndereco(null)).toBe("—");
  });
});

describe("classificarProdutos", () => {
  it("ordena por movimentos e aplica ABC pelo acumulado antes do item", () => {
    const r = classificarProdutos([prod(3, 5), prod(1, 70), prod(2, 20), prod(4, 5)]);
    expect(r.map((l) => l.merc)).toEqual([1, 2, 3, 4]);
    // antes: 0 → A · 0,70 → A · 0,90 → B · 0,95 → C
    expect(r.map((l) => l.classe)).toEqual(["A", "A", "B", "C"]);
    expect(r[0].participacao).toBeCloseTo(0.7, 6);
    expect(r[3].acumulado).toBeCloseTo(1, 6);
  });
  it("lista vazia não quebra", () => {
    expect(classificarProdutos([])).toEqual([]);
    expect(resumirProdutos([]).skus).toBe(0);
  });
});

describe("alertasProduto", () => {
  it("classe A com picking acima do nível 01", () => {
    expect(alertasProduto(prod(1, 10, { picking: "070903002" }), "A", "03")).toContain("picking-alto");
    expect(alertasProduto(prod(1, 10, { picking: "070903002" }), "B", "03")).not.toContain("picking-alto");
  });
  it("classe A sem picking", () => {
    expect(alertasProduto(prod(1, 10, { picking: null }), "A", null)).toEqual(["sem-picking"]);
  });
  it("palete praticado diverge do cadastro acima de 10%", () => {
    expect(alertasProduto(prod(1, 10, { qtdPaletePraticada: 80, qtdPaleteCadastro: 100 }), "C", "01"))
      .toEqual(["palete-divergente"]);
    expect(alertasProduto(prod(1, 10, { qtdPaletePraticada: 95, qtdPaleteCadastro: 100 }), "C", "01"))
      .toEqual([]);
  });
});

describe("resumirProdutos", () => {
  it("conta SKUs, movimentos e alertas por classe", () => {
    const r = resumirProdutos(classificarProdutos([
      prod(1, 70, { picking: "010103001" }), prod(2, 20), prod(3, 10, { picking: null }),
    ]));
    expect(r.skus).toBe(3);
    expect(r.movimentos).toBe(100);
    expect(r.porClasse.A).toEqual({ skus: 2, movimentos: 90 });
    expect(r.pickingAlto).toBe(1);
    expect(r.semPicking).toBe(0); // o 3 é classe B
  });
});
