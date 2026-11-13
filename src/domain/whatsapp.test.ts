import { describe, expect, it } from "vitest";
import { formatarFoneBR, linkWhatsApp, normalizarFoneBR, primeiroFoneValido } from "./whatsapp";

describe("normalizarFoneBR", () => {
  it("aceita os formatos do cadastro do RCA", () => {
    expect(normalizarFoneBR("81 983355048")).toBe("81983355048");
    expect(normalizarFoneBR("87 99811-7656")).toBe("87998117656");
    expect(normalizarFoneBR("819 9257-2788")).toBe("81992572788");
    expect(normalizarFoneBR("81 9925.92744")).toBe("81992592744");
    expect(normalizarFoneBR("8199899-2164")).toBe("81998992164");
  });
  it("número sem DDD ganha o 81", () => {
    expect(normalizarFoneBR("986016410")).toBe("81986016410");
    expect(normalizarFoneBR("9 9215-3291")).toBe("81992153291");
    expect(normalizarFoneBR("3333-4444")).toBe("8133334444");
  });
  it("tira o 55 e o zero da frente", () => {
    expect(normalizarFoneBR("+55 81 98335-5048")).toBe("81983355048");
    expect(normalizarFoneBR("081 98335-5048")).toBe("81983355048");
  });
  it("vazio ou inválido vira null", () => {
    expect(normalizarFoneBR(null)).toBeNull();
    expect(normalizarFoneBR("")).toBeNull();
    expect(normalizarFoneBR("123")).toBeNull();
    expect(normalizarFoneBR("81 88335-5048")).toBeNull(); // 11 dígitos sem o 9 do celular
  });
});

describe("primeiro válido, formato e link", () => {
  it("cai no TELEFONE2 quando o 1 não serve", () => {
    expect(primeiroFoneValido("", "87 99811-7656")).toBe("87998117656");
    expect(primeiroFoneValido(null, null)).toBeNull();
  });
  it("formata para exibir", () => {
    expect(formatarFoneBR("81983355048")).toBe("(81) 98335-5048");
    expect(formatarFoneBR("8133334444")).toBe("(81) 3333-4444");
  });
  it("monta o wa.me com a mensagem codificada", () => {
    expect(linkWhatsApp("81983355048")).toBe("https://wa.me/5581983355048");
    expect(linkWhatsApp("81983355048", "Pedido 12 · A&B")).toBe("https://wa.me/5581983355048?text=Pedido%2012%20%C2%B7%20A%26B");
  });
});
