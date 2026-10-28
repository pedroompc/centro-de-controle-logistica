import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { interpolarTexto, NumeroAnimado } from "./movimento";

describe("interpolarTexto", () => {
  it("termina exatamente no texto original", () => {
    expect(interpolarTexto("R$ 1.234,56", 1)).toBe("R$ 1.234,56");
    expect(interpolarTexto("312 t", 1)).toBe("312 t");
    expect(interpolarTexto("-R$ 40,00", 1)).toBe("-R$ 40,00");
    expect(interpolarTexto("1.284", 1)).toBe("1.284");
  });

  it("começa em zero mantendo prefixo, sufixo e casas", () => {
    expect(interpolarTexto("R$ 1.234,56", 0)).toBe("R$ 0,00");
    expect(interpolarTexto("312 t", 0)).toBe("0 t");
  });

  it("no meio do caminho mantém as casas decimais e o separador", () => {
    expect(interpolarTexto("R$ 1.234,56", 0.5)).toBe("R$ 617,28");
    expect(interpolarTexto("12,5%", 0.5)).toBe("6,3%");
  });

  it("texto sem número aparece direto", () => {
    expect(interpolarTexto("—", 0.3)).toBe("—");
  });
});

describe("NumeroAnimado", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("com 'reduzir movimento' mostra o valor final direto", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    render(<NumeroAnimado texto="R$ 1.234,56" />);
    expect(screen.getByText("R$ 1.234,56")).toBeInTheDocument();
  });
});
