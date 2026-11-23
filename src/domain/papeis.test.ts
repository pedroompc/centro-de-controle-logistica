import { describe, it, expect } from "vitest";
import { rotaLiberadaParaEquipe, lerPapel, rotuloPapel, INICIO_EQUIPE } from "./papeis";

describe("papel equipe", () => {
  it("libera as telas de monitoramento de entrega, com subtelas e rotas de download", () => {
    for (const p of ["/pedidos", "/pedidos/123456", "/pedidos/123/danfe", "/pedidos/notas/xml", "/devolucoes", "/devolucoes/qualquer", "/pedidos-a-faturar", "/cortes", "/cortes/export", "/frota"]) {
      expect(rotaLiberadaParaEquipe(p), p).toBe(true);
    }
  });

  it("libera o sair", () => {
    expect(rotaLiberadaParaEquipe("/auth/signout")).toBe(true);
  });

  it("bloqueia o resto, inclusive o Dashboard e o cadastro de custos da frota", () => {
    for (const p of ["/", "/devolucoes-x", "/frotas", "/bi", "/setores/3", "/custos", "/custos/frota", "/receitas/export", "/estoque/export", "/painel", "/api/saude"]) {
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
