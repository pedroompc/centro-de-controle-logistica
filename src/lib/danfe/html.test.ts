import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderDanfeHtml, renderDanfesHtml } from "./html";
import { parseNfe } from "@/domain/danfe/parse-nfe";
import type { DanfeWinthor } from "@/data/danfe";

// Reaproveita o XML de exemplo do teste do parser.
const fonte = readFileSync(resolve(process.cwd(), "src/domain/danfe/parse-nfe.test.ts"), "utf8");
const XML = fonte.slice(fonte.indexOf("<?xml"), fonte.indexOf("</nfeProc>") + "</nfeProc>".length);

const wt: DanfeWinthor = {
  numcar: 403183, numtrans: 14986120, codcli: 28975, rca: 718,
  placa: "RZI0E03", ufPlaca: "PE", dtSaidaVeiculo: null, volumes: 15,
};

describe("renderDanfeHtml", () => {
  const html = renderDanfeHtml(parseNfe(XML), wt);

  it("é uma página completa com título da nota", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>DANFE NF-e 2495812</title>");
  });

  it("traz os campos do Winthor no canhoto e a placa do XML", () => {
    expect(html).toContain("NUMCAR: <b>403183</b>");
    expect(html).toContain("RCA: <b>718</b>");
    expect(html).toContain("ABC1D23"); // placa do XML tem prioridade sobre a do Winthor
    expect(html).toMatch(/Volumes<\/span><span class="dnf-v ">15</);
  });

  it("formata documentos, valores e a chave", () => {
    expect(html).toContain("12.345.678/0001-99");
    expect(html).toContain("502,50");
    expect(html).toContain("2626 0912 3456");
    expect(html).toContain("<svg"); // código de barras da chave
  });

  it("escapa texto vindo do XML", () => {
    // No XML o texto vem com entidades; o parser decodifica e o HTML precisa reescapar.
    const sujo = XML.replace("MERCADINHO DO JOAO LTDA", "JOAO &lt;script&gt;x&lt;/script&gt; &amp; CIA");
    const h = renderDanfeHtml(parseNfe(sujo), wt);
    expect(h).not.toContain("<script>x</script>");
    expect(h).toContain("JOAO &lt;script&gt;x&lt;/script&gt; &amp; CIA");
  });
});

describe("renderDanfesHtml", () => {
  const nota = { d: parseNfe(XML), wt };

  it("um DANFE por folha, com o total no título", () => {
    const html = renderDanfesHtml([nota, nota]);
    expect(html.match(/<div class="dnf">/g)).toHaveLength(2);
    expect(html).toContain("<title>DANFEs - 2 notas</title>");
    expect(html).toContain(".folha > .dnf { break-after: page;");
    expect(html).not.toContain("window.print(); }, 300)");
  });

  it("lista o que ficou de fora (só na tela) e chama a impressão quando pedido", () => {
    const html = renderDanfesHtml([nota], ["Pedido 9 sem NF-e"], true);
    expect(html).toContain('<div class="avisos"><p>Pedido 9 sem NF-e</p></div>');
    expect(html).toContain("window.print(); }, 300)");
  });

  it("sem nota nenhuma não chama a impressão", () => {
    expect(renderDanfesHtml([], ["nada"], true)).not.toContain("window.print(); }, 300)");
  });
});
