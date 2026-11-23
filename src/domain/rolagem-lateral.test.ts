import { describe, it, expect } from "vitest";
import { estadoRolagem, passoRolagem } from "./rolagem-lateral";

describe("rolagem lateral", () => {
  it("tabela que cabe não mostra botões ativos", () => {
    expect(estadoRolagem({ scrollLeft: 0, scrollWidth: 1000, clientWidth: 1000 })).toEqual({ transborda: false, podeEsquerda: false, podeDireita: false });
  });

  it("no começo só anda para a direita", () => {
    expect(estadoRolagem({ scrollLeft: 0, scrollWidth: 2000, clientWidth: 1000 })).toEqual({ transborda: true, podeEsquerda: false, podeDireita: true });
  });

  it("no meio anda para os dois lados", () => {
    expect(estadoRolagem({ scrollLeft: 500, scrollWidth: 2000, clientWidth: 1000 })).toEqual({ transborda: true, podeEsquerda: true, podeDireita: true });
  });

  it("no fim (com fração de pixel do zoom) só volta", () => {
    expect(estadoRolagem({ scrollLeft: 999.5, scrollWidth: 2000, clientWidth: 1000 })).toEqual({ transborda: true, podeEsquerda: true, podeDireita: false });
  });

  it("passo = 80% da parte que rola, com piso", () => {
    expect(passoRolagem(1200, 200)).toBe(800);
    expect(passoRolagem(300, 250)).toBe(160);
  });
});
