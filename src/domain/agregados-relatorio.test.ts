import { describe, it, expect } from "vitest";
import { montarAgregados, totaisCasa, type OperacaoPessoa, type RelatorioAgregados } from "./agregados";
import { documentoAgregados, nomeProprio, situacao, tabelaAgregados } from "./agregados-relatorio";
import { criarXlsx } from "@/lib/xlsx";
import { inflateRawSync } from "node:zlib";

const op = (o: Partial<OperacaoPessoa>): OperacaoPessoa => ({
  matricula: 1, papel: "motorista", nome: "X", cpf: null,
  dias: 10, viagens: 10, notas: 100, entregas: 50, kg: 1000, faturado: 100_000, notasDevolvidas: 5, devolvido: 3_000,
  ...o,
});

// CLT: R$ 300/dia, devolução 3%.
const casa = totaisCasa("motorista", [op({ matricula: 9, dias: 20, faturado: 100_000, devolvido: 3_000 })], new Set([9]), 6_000);
const agregado = (custo: number, devolvido: number) =>
  montarAgregados([{ codFornec: 1, nome: "JOSE DA SILVA SAURO", cgc: null, custo, lotes: 1, ultimo: "2026-10-28" }], [op({ matricula: 2, nome: "JOSE DA SILVA SAURO", devolvido })])[0];

describe("situacao", () => {
  it("barato e devolução normal = Compensa", () => expect(situacao(agregado(2_000, 3_000), casa).rotulo).toBe("Compensa"));
  it("mais caro que o CLT", () => expect(situacao(agregado(4_000, 3_000), casa).rotulo).toBe("Mais caro"));
  it("barato mas devolve > 1,5× a casa", () => expect(situacao(agregado(2_000, 5_000), casa).rotulo).toBe("Devolução alta"));
  it("caro e devolve muito = Rever", () => expect(situacao(agregado(4_000, 5_000), casa).rotulo).toBe("Rever"));
});

it("nomeProprio", () => expect(nomeProprio("JOSE DA SILVA DOS SANTOS")).toBe("Jose da Silva dos Santos"));

describe("tabela e documentos", () => {
  const rel: RelatorioAgregados = { agregados: [agregado(4_000, 3_000)], casa: { motorista: casa }, outros: [] };
  const t = tabelaAgregados(rel);
  it("linha com diferença vs CLT e totais com CLT", () => {
    const iVs = t.colunas.findIndex((c) => c.titulo === "Diferença vs CLT");
    expect(t.linhas[0][0]).toBe("Jose da Silva Sauro");
    expect(t.linhas[0][iVs]).toBe(1_000); // 4.000 − 300 × 10
    expect(t.totais.map((l) => l[0])).toEqual(["Agregados (1)", "CLT · motoristas (1)"]);
    expect(t.linhas[0]).toHaveLength(t.colunas.length);
  });
  it("PDF traz a tabela e o + em vermelho", () => {
    const h = documentoAgregados(t, { periodo: "Outubro/2026", geradoEm: new Date(2026, 10, 25), kpis: [["Custo", "R$ 1"]] });
    expect(h).toContain("<title>Agregados - Outubro-2026</title>");
    expect(h).toContain('class="n mais">+R$');
  });
  it("xlsx é um zip com a aba e número como número", () => {
    const buf = criarXlsx("Agregados", t.colunas, t.linhas, t.totais);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    // acha o sheet1.xml no zip e confere uma célula numérica
    const nome = Buffer.from("xl/worksheets/sheet1.xml");
    const i = buf.indexOf(nome);
    const tam = buf.readUInt32LE(i - 12);
    const xml = inflateRawSync(buf.subarray(i + nome.length, i + nome.length + tam)).toString();
    expect(xml).toContain("<v>4000</v>");
    expect(xml).toContain("Jose da Silva Sauro");
  });
});
