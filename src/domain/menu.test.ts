import { describe, it, expect } from "vitest";
import { GRUPOS_MENU, RODAPE_MENU, agruparMenu, ordenarMenu, rodapeMenu } from "./menu";

const it_ = (href: string) => ({ href });

describe("menu", () => {
  it("cada tela aparece uma vez só", () => {
    const todos = [...GRUPOS_MENU.flatMap((g) => g.hrefs), ...RODAPE_MENU];
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("Gestão é o último grupo, com Custos e Receitas primeiro", () => {
    const ultimo = GRUPOS_MENU.at(-1)!;
    expect(ultimo.titulo).toBe("Gestão");
    expect(ultimo.hrefs.slice(0, 2)).toEqual(["/custos", "/receitas"]);
    expect(ultimo.hrefs).toEqual(expect.arrayContaining(["/tendencias", "/estoque", "/fechamento"]));
  });

  it("agrupa só o que o perfil enxerga e some com grupo vazio", () => {
    const g = agruparMenu([it_("/custos"), it_("/"), it_("/painel")]);
    expect(g.map((x) => [x.titulo, x.itens.map((i) => i.href)])).toEqual([["Visão geral", ["/"]], ["Gestão", ["/custos"]]]);
    expect(rodapeMenu([it_("/auditoria"), it_("/painel")]).map((i) => i.href)).toEqual(["/painel", "/auditoria"]);
  });

  it("lista plana: grupos, tela nova fora do mapa e rodapé no fim", () => {
    expect(ordenarMenu([it_("/painel"), it_("/nova"), it_("/receitas"), it_("/")]).map((i) => i.href)).toEqual(["/", "/receitas", "/nova", "/painel"]);
  });
});
