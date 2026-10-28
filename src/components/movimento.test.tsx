import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { deltaNoFormato, interpolarTexto, numeroDoTexto, NumeroAnimado, SeloVivo, ValorVivo } from "./movimento";

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

describe("ValorVivo", () => {
  const delta = (d: number) => (d > 0 ? `+${d}` : `−${Math.abs(d)}`);

  it("primeiro render sem brilho", () => {
    const { container } = render(<ValorVivo valor={86} texto="86" formatarDelta={delta} />);
    expect(container.querySelector(".brilho-ambar")).toBeNull();
  });

  it("valor que muda brilha e mostra a variação", () => {
    const { container, rerender } = render(<ValorVivo valor={86} texto="86" formatarDelta={delta} />);
    rerender(<ValorVivo valor={89} texto="89" formatarDelta={delta} />);
    expect(container.querySelector(".brilho-ambar")).not.toBeNull();
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("mesmo valor não mostra variação", () => {
    const { container, rerender } = render(<ValorVivo valor={86} texto="86" formatarDelta={delta} />);
    rerender(<ValorVivo valor={86} texto="86" formatarDelta={delta} />);
    expect(container.querySelector(".brilho-ambar")).toBeNull();
    expect(screen.queryByText("+0")).toBeNull();
  });

  it("vindo de null não brilha", () => {
    const { container, rerender } = render(<ValorVivo valor={null} texto="—" formatarDelta={delta} />);
    rerender(<ValorVivo valor={86} texto="86" formatarDelta={delta} />);
    expect(container.querySelector(".brilho-ambar")).toBeNull();
  });
});

describe("SeloVivo", () => {
  it("pulsando: AO VIVO com a hora", () => {
    const { container } = render(<SeloVivo relogio="09:40" pulsando />);
    expect(screen.getByText(/AO VIVO/)).toBeInTheDocument();
    expect(screen.getByText(/09:40/)).toBeInTheDocument();
    expect(container.querySelector(".pulso-vivo")).not.toBeNull();
  });

  it("parado: só a hora da atualização", () => {
    const { container } = render(<SeloVivo relogio="09:40" pulsando={false} />);
    expect(screen.getByText(/Atualizado às 09:40/)).toBeInTheDocument();
    expect(container.querySelector(".pulso-vivo")).toBeNull();
  });
});

describe("numeroDoTexto / deltaNoFormato", () => {
  it("lê o número do texto formatado", () => {
    expect(numeroDoTexto("R$ 39.170.836,20")).toBe(39170836.2);
    expect(numeroDoTexto("1.821.757 kg")).toBe(1821757);
    expect(numeroDoTexto("-R$ 40,00")).toBe(-40);
    expect(numeroDoTexto("—")).toBeNull();
  });
  it("formata a variação nas casas do original", () => {
    expect(deltaNoFormato("86", 3)).toBe("+3");
    expect(deltaNoFormato("R$ 1.234,56", -1250.4)).toBe("−1.250,40");
  });
});
