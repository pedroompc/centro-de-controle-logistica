import { describe, it, expect } from "vitest";
import { camposAlterados, rotuloRegistro } from "./auditoria";

describe("camposAlterados", () => {
  it("alteração: só o que mudou, sem carimbo de data", () => {
    const antes = { id: "1", nome: "JOAO", custo_mensal: 2500, atualizado_em: "a" };
    const depois = { id: "1", nome: "JOAO", custo_mensal: 2800, atualizado_em: "b" };
    expect(camposAlterados(antes, depois)).toEqual([{ campo: "custo_mensal", antes: "2500", depois: "2800" }]);
  });

  it("inclusão lista os campos preenchidos; exclusão, os que existiam", () => {
    expect(camposAlterados(null, { id: "1", nome: "X", obs: null, ativo: true })).toEqual([
      { campo: "nome", antes: "—", depois: "X" },
      { campo: "ativo", antes: "—", depois: "sim" },
    ]);
    expect(camposAlterados({ id: "1", valor: 10 }, null)).toEqual([{ campo: "valor", antes: "10", depois: "—" }]);
  });
});

describe("rotuloRegistro", () => {
  it("usa o nome quando existe, senão a chave", () => {
    expect(rotuloRegistro({ antes: null, depois: { nome: "Separação" }, registro: "uuid" })).toBe("Separação");
    expect(rotuloRegistro({ antes: { valor: 1 }, depois: null, registro: "abc" })).toBe("abc");
  });
});
