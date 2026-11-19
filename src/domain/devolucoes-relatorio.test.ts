import { describe, it, expect } from "vitest";
import { esc, relatorioMotoristas, relatorioMotivos, relatorioSupervisores, documentoRelatorio } from "./devolucoes-relatorio";
import type { DevolucaoPorMotorista, MotivoDetalhe } from "./devolucoes";
import { agruparPorPasta, setoresZerados } from "./devolucoes-supervisor";

const mot = (over: Partial<DevolucaoPorMotorista>): DevolucaoPorMotorista => ({
  codMotorista: 1, nome: "JOAO", tipo: "F", expedidas: 100, devolvidas: 5, taxa: 5,
  valorExpedido: 10000, valorDevolvido: 500, pdvs: 0, pdvsDevolvidos: 0, ...over,
});
const motivos: Record<number, MotivoDetalhe[]> = {
  1: [
    { motivo: "R- CLIENTE FECHADO", setor: "Comercial", notas: 2, valor: 200 },
    { motivo: "R- FORA DO HORARIO COMERCIAL", setor: "Logística", notas: 3, valor: 300 },
  ],
  2: [{ motivo: "D- AVARIA", setor: "Logística", notas: 1, valor: 50 }],
};

describe("esc", () => {
  it("escapa HTML", () => {
    expect(esc(`<b>"A&B"</b>`)).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
  });
});

describe("relatorioMotoristas", () => {
  const lista = [mot({}), mot({ codMotorista: 2, nome: "MARIA <X>", tipo: "T", devolvidas: 1, taxa: 1, valorDevolvido: 50 })];

  it("traz o ranking e uma ficha com os motivos de cada motorista", () => {
    const h = relatorioMotoristas(lista, motivos);
    expect(h).toContain("Ranking dos motoristas");
    expect(h).toContain("R- FORA DO HORARIO COMERCIAL");
    expect(h).toContain("D- AVARIA");
    expect(h).toContain("MARIA &lt;X&gt;");
    expect(h.match(/class="ficha"/g)).toHaveLength(2);
    // motivo de maior valor vem primeiro na ficha
    expect(h.indexOf("FORA DO HORARIO")).toBeLessThan(h.indexOf("CLIENTE FECHADO"));
  });

  it("mostra o faturado e a participação no total (mesmo no PDF de um só motorista)", () => {
    const dois = [mot({ pdvs: 40, pdvsDevolvidos: 3 }), mot({ codMotorista: 2, nome: "MARIA", valorExpedido: 30000 })];
    const h = relatorioMotoristas(dois, motivos);
    expect(h).toContain("25,0%"); // JOAO: 10 mil de 40 mil
    expect(h).toContain("3/40");
    const so = relatorioMotoristas(dois, motivos, 2);
    expect(so).toContain("75,0% do total");
  });

  it("com `so` imprime só aquele motorista, sem ranking", () => {
    const h = relatorioMotoristas(lista, motivos, 2);
    expect(h).not.toContain("Ranking dos motoristas");
    expect(h).toContain("D- AVARIA");
    expect(h).not.toContain("CLIENTE FECHADO");
  });
});

describe("relatorioMotivos", () => {
  it("soma por setor e lista os motivos", () => {
    const h = relatorioMotivos(motivos[1]);
    expect(h).toContain("Por setor");
    expect(h).toContain("60,0%"); // logística 300 de 500
  });
});

describe("relatorioSupervisores", () => {
  it("mostra a pasta e os supervisores dentro", () => {
    const pastas = agruparPorPasta([
      { cod: 15, nome: "DIA FOOD SERVICE TELEVENDAS", faturado: 1000, devolvidoTodos: 100, setores: { ...setoresZerados(), Comercial: 100 } },
      { cod: 16, nome: "DIA FOOD SERVICE VENDA EXTERNA", faturado: 1000, devolvidoTodos: 0, setores: setoresZerados() },
    ]);
    const h = relatorioSupervisores(pastas);
    expect(h).toContain("<b>DIA FOOD</b>");
    expect(h).toContain("DIA FOOD SERVICE TELEVENDAS");
    expect(h).toContain("11,11%"); // 100 / 900
  });
});

describe("documentoRelatorio", () => {
  it("monta o documento com cabeçalho, filtros e título de arquivo", () => {
    const h = documentoRelatorio("Motoristas", { periodo: "nov/2026", base: "faturamento", setor: "Logística", geradoEm: new Date(2026, 10, 17, 15, 30) }, "<p>corpo</p>");
    expect(h).toContain("<title>Devoluções - Motoristas - nov-2026</title>");
    expect(h).toContain("Base: dia faturado");
    expect(h).toContain("Setor: Logística");
    expect(h).toContain("<p>corpo</p>");
  });
});
