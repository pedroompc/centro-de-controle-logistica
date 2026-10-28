import { describe, expect, it } from "vitest";
import { deveIniciarBarra } from "./barra-navegacao";

const ATUAL = "https://x/setores/1";
const clique = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const link = (href: string, target = "", attrs: string[] = []) => ({ href, target, hasAttribute: (n: string) => attrs.includes(n) });

describe("deveIniciarBarra", () => {
  it("clique esquerdo simples em outra URL do app", () => {
    expect(deveIniciarBarra(clique, link("https://x/setores/1?aba=bi"), ATUAL)).toBe(true);
  });

  it("não inicia com teclas modificadoras ou botão do meio", () => {
    expect(deveIniciarBarra({ ...clique, metaKey: true }, link("https://x/a"), ATUAL)).toBe(false);
    expect(deveIniciarBarra({ ...clique, ctrlKey: true }, link("https://x/a"), ATUAL)).toBe(false);
    expect(deveIniciarBarra({ ...clique, shiftKey: true }, link("https://x/a"), ATUAL)).toBe(false);
    expect(deveIniciarBarra({ ...clique, button: 1 }, link("https://x/a"), ATUAL)).toBe(false);
  });

  it("não inicia em nova aba, download, link externo ou evento cancelado", () => {
    expect(deveIniciarBarra(clique, link("https://x/a", "_blank"), ATUAL)).toBe(false);
    expect(deveIniciarBarra(clique, link("https://x/a", "", ["download"]), ATUAL)).toBe(false);
    expect(deveIniciarBarra(clique, link("https://google.com/"), ATUAL)).toBe(false);
    expect(deveIniciarBarra({ ...clique, defaultPrevented: true }, link("https://x/a"), ATUAL)).toBe(false);
  });

  it("não inicia para a mesma URL nem para âncora na mesma página", () => {
    expect(deveIniciarBarra(clique, link(ATUAL), ATUAL)).toBe(false);
    expect(deveIniciarBarra(clique, link(`${ATUAL}#equipe`), ATUAL)).toBe(false);
  });
});
