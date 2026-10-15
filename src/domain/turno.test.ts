import { describe, it, expect } from "vitest";
import { sugerirFuncionario, ligacoesEfetivas, resumoTurnosProducao } from "./turno";

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

describe("resumoTurnosProducao", () => {
  it("agrega por turno do operador: total, pessoas distintas e média por pessoa/dia", () => {
    const turnos = new Map([[1, "noite" as const], [2, "noite" as const], [3, "manha" as const]]);
    const r = resumoTurnosProducao(
      [
        { usuario: 1, dia: "2026-10-01", valor: 100 },
        { usuario: 1, dia: "2026-10-02", valor: 50 },
        { usuario: 2, dia: "2026-10-01", valor: 30 },
        { usuario: 3, dia: "2026-10-01", valor: 40 },
        { usuario: 99, dia: "2026-10-01", valor: 7 },
      ],
      turnos,
    );
    expect(r.noite).toEqual({ total: 180, pessoas: 2, diasPessoa: 3, porPessoaDia: 60 });
    expect(r.manha).toEqual({ total: 40, pessoas: 1, diasPessoa: 1, porPessoaDia: 40 });
    expect(r.tarde).toEqual({ total: 0, pessoas: 0, diasPessoa: 0, porPessoaDia: null });
    expect(r.sem).toEqual({ total: 7, pessoas: 1, diasPessoa: 1, porPessoaDia: 7 });
  });
});
