import { describe, it, expect } from "vitest";
import { buscarTodas, TAMANHO_PAGINA } from "./paginar";

describe("buscarTodas", () => {
  it("junta as páginas até vir uma incompleta", async () => {
    const total = TAMANHO_PAGINA * 2 + 5;
    const pedidas: [number, number][] = [];
    const linhas = await buscarTodas(async (de, ate) => {
      pedidas.push([de, ate]);
      const fim = Math.min(ate + 1, total);
      return { data: Array.from({ length: Math.max(fim - de, 0) }, (_, i) => de + i), error: null };
    });
    expect(linhas).toHaveLength(total);
    expect(linhas[total - 1]).toBe(total - 1);
    expect(pedidas).toHaveLength(3);
  });

  it("página exatamente cheia pede mais uma e para na vazia", async () => {
    let chamadas = 0;
    const linhas = await buscarTodas(async (de) => {
      chamadas += 1;
      return { data: de === 0 ? Array.from({ length: TAMANHO_PAGINA }, () => 1) : [], error: null };
    });
    expect(linhas).toHaveLength(TAMANHO_PAGINA);
    expect(chamadas).toBe(2);
  });

  it("propaga o erro do Supabase", async () => {
    await expect(buscarTodas(async () => ({ data: null, error: { message: "falhou" } }))).rejects.toThrow("falhou");
  });
});
