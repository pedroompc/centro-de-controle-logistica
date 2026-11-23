import { describe, it, expect } from "vitest";
import { rotaLiberadaParaEquipe, lerPapel, rotuloPapel, INICIO_EQUIPE } from "./papeis";

describe("papel equipe", () => {
  it("libera Consulta de Pedidos e Devoluções, com subtelas e rotas de download", () => {
    for (const p of ["/pedidos", "/pedidos/123456", "/pedidos/123/danfe", "/pedidos/notas/xml", "/devolucoes", "/devolucoes/qualquer"]) {
      expect(rotaLiberadaParaEquipe(p), p).toBe(true);
    }
  });

  it("libera o sair", () => {
    expect(rotaLiberadaParaEquipe("/auth/signout")).toBe(true);
  });

  it("bloqueia o resto, inclusive Pedidos a Faturar e o Dashboard", () => {
    for (const p of ["/", "/pedidos-a-faturar", "/devolucoes-x", "/bi", "/setores/3", "/custos", "/receitas/export", "/cortes/export", "/painel", "/api/saude"]) {
      expect(rotaLiberadaParaEquipe(p), p).toBe(false);
    }
  });

  it("a tela inicial da equipe é liberada para ela", () => {
    expect(rotaLiberadaParaEquipe(INICIO_EQUIPE)).toBe(true);
  });

  it("lê papel só de valor conhecido", () => {
    expect(lerPapel("equipe")).toBe("equipe");
    expect(lerPapel("admin")).toBe("admin");
    expect(lerPapel("chefe")).toBeNull();
    expect(lerPapel(undefined)).toBeNull();
  });

  it("rótulo do selo", () => {
    expect(rotuloPapel("equipe")).toBe("Equipe");
    expect(rotuloPapel("admin")).toBe("Admin");
    expect(rotuloPapel("viewer")).toBe("Somente leitura");
    expect(rotuloPapel("viewer", true)).toBe("Leitura");
  });
});
