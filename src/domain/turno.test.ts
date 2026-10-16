import { describe, it, expect } from "vitest";
import { sugerirFuncionario, ligacoesEfetivas } from "./turno";

const func = (id: string, nome: string, turno: "manha" | "tarde" | "noite" = "manha") => ({ id, nome, turno });

describe("sugerirFuncionario", () => {
  const cadastro = [
    func("1", "LEONARDO JOSÉ DA SILVA"),
    func("2", "CARLOS JOSE VELOSO JUNIOR"),
    func("3", "BRUNO LEONARDO SANTOS"),
    func("4", "DEYVSON WILLIAM"),
    func("5", "DEIVISON SANTOS"),
    func("6", "MATHEUS GABRIEL SILVA DE MELO"),
    func("7", "MATHEUS GABRIEL COSTA"),
  ];

  it("casa nome idêntico ignorando acento e caixa", () => {
    expect(sugerirFuncionario("Leonardo Jose da Silva", cadastro)).toBe("1");
  });

  it("casa quando o Harpia tem parte do nome, na ordem, começando pelo primeiro nome", () => {
    expect(sugerirFuncionario("CARLOS VELOSO EXPEDIÇÃO", cadastro)).toBe("2");
    expect(sugerirFuncionario("BRUNO LEONARDO", cadastro)).toBe("3");
  });

  it("não chuta com um nome só (CONF DEYVSON NOITE poderia ser outra pessoa)", () => {
    expect(sugerirFuncionario("CONF DEYVSON NOITE", cadastro)).toBeNull();
  });

  it("não chuta quando há mais de um candidato", () => {
    expect(sugerirFuncionario("MATHEUS GABRIEL", cadastro)).toBeNull();
  });

  it("nome vazio não liga", () => {
    expect(sugerirFuncionario(null, cadastro)).toBeNull();
  });
});

describe("ligacoesEfetivas", () => {
  const cadastro = [func("1", "LEONARDO JOSÉ DA SILVA", "tarde"), func("2", "OSMAR EMILIANO", "manha")];

  it("ligação manual vence a automática; automática preenche o resto", () => {
    const r = ligacoesEfetivas(
      [{ usuario: 64, nome: "LEONARDO JOSÉ DA SILVA" }, { usuario: 65, nome: "OSMAR EMILIANO DA SILVA" }, { usuario: 9, nome: "X Y" }],
      { 64: "2" },
      cadastro,
    );
    expect(r[64]).toEqual({ funcionarioId: "2", auto: false });
    expect(r[65]).toEqual({ funcionarioId: "2", auto: true });
    expect(r[9]).toBeUndefined();
  });
});
