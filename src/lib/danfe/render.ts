import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { toBuffer } from "bwip-js/node";
import type { DanfeData, DanfeItem } from "@/domain/danfe/parse-nfe";

// Gera um DANFE em PDF (A4 retrato) a partir dos dados da NF-e. Layout estilo
// DANFE (canhoto omitido; foco em legibilidade para envio ao vendedor).
// Sem dependência de navegador — pdf-lib desenha e bwip-js gera o código de barras.

const A4_W = 595.28;
const A4_H = 841.89;
const M = 18; // margem
const X0 = M;
const W = A4_W - 2 * M; // largura útil
const BOTTOM = M; // limite inferior do conteúdo
const LINE = rgb(0, 0, 0);
const GREY = rgb(0.45, 0.45, 0.45);

const FRETE: Record<string, string> = {
  "0": "0-Emitente", "1": "1-Dest/Rem", "2": "2-Terceiros",
  "3": "3-Próp.Rem", "4": "4-Próp.Dest", "9": "9-Sem frete",
};

// ---- formatação -------------------------------------------------------------
function san(v: unknown): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ""); // mantém Latin-1
}
function money(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}
function qty(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : san(v);
}
function dateBR(iso: string | null): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function timeBR(iso: string | null): string {
  const m = String(iso ?? "").match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}
function docMask(v: string | null): string {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return san(v);
}
function chaveFmt(c: string): string {
  return c.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export async function renderDanfePdf(d: DanfeData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let barcode: PDFImage | null = null;
  try {
    const buf = await toBuffer({ bcid: "code128", text: d.chave, scale: 2, height: 9, includetext: false, paddingwidth: 0, paddingheight: 0, backgroundcolor: "FFFFFF" });
    barcode = await doc.embedPng(buf);
  } catch {
    barcode = null; // sem barra ainda mostra a chave em texto
  }

  // ---- primitivas de desenho (coordenadas top-down) -------------------------
  const page0 = doc.addPage([A4_W, A4_H]);
  let page: PDFPage = page0;

  const rect = (x: number, top: number, w: number, h: number) =>
    page.drawRectangle({ x, y: A4_H - top - h, width: w, height: h, borderColor: LINE, borderWidth: 0.5 });

  function clip(text: string, f: PDFFont, size: number, maxW: number): string {
    if (f.widthOfTextAtSize(text, size) <= maxW) return text;
    let t = text;
    while (t.length > 1 && f.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
    return t + "...";
  }
  function txt(
    x: number, top: number, str: unknown,
    o: { size?: number; bold?: boolean; align?: "left" | "right" | "center"; w?: number; color?: typeof LINE } = {},
  ) {
    const size = o.size ?? 8;
    const f = o.bold ? bold : font;
    let text = san(str);
    if (!text) return;
    if (o.w) text = clip(text, f, size, o.w - 3);
    let xx = x;
    const tw = f.widthOfTextAtSize(text, size);
    if (o.align === "right") xx = x + (o.w ?? 0) - tw - 2;
    else if (o.align === "center") xx = x + ((o.w ?? 0) - tw) / 2;
    page.drawText(text, { x: xx, y: A4_H - top - size, size, font: f, color: o.color ?? LINE });
  }
  // Célula: caixa + rótulo pequeno + valor.
  function cell(
    x: number, top: number, w: number, h: number, label: string, value: unknown,
    o: { size?: number; bold?: boolean; align?: "left" | "right" | "center" } = {},
  ) {
    rect(x, top, w, h);
    if (label) txt(x + 2, top + 1.5, label, { size: 5, color: GREY });
    txt(x + 2, top + (label ? 8 : 3), value, { size: o.size ?? 8, bold: o.bold, align: o.align, w });
  }
  // Barra de título de seção.
  function titulo(top: number, label: string) {
    txt(X0, top, label, { size: 6, bold: true, color: GREY });
    return top + 8;
  }

  // ============================ CABEÇALHO ====================================
  let y = M;
  const headH = 78;
  const colE = W * 0.46; // emitente
  const colC = W * 0.20; // danfe
  const colD = W - colE - colC; // chave/barcode
  const xC = X0 + colE;
  const xD = xC + colC;

  // Emitente
  rect(X0, y, colE, headH);
  txt(X0 + 4, y + 6, d.emitente.nome, { size: 10, bold: true, w: colE - 8 });
  const end = d.emitente.endereco;
  const linhaEnd = [end.logradouro, end.numero].filter(Boolean).join(", ");
  const linhaMun = [end.bairro, end.municipio && `${end.municipio}/${end.uf ?? ""}`].filter(Boolean).join(" - ");
  txt(X0 + 4, y + 22, linhaEnd, { size: 7, w: colE - 8 });
  txt(X0 + 4, y + 31, linhaMun, { size: 7, w: colE - 8 });
  if (end.cep) txt(X0 + 4, y + 40, `CEP ${end.cep}`, { size: 7 });
  if (end.fone) txt(X0 + 4, y + 49, `Fone ${end.fone}`, { size: 7 });
  txt(X0 + 4, y + 60, `CNPJ ${docMask(d.emitente.documento)}`, { size: 7, bold: true });
  txt(X0 + 4, y + 69, `IE ${san(d.emitente.ie)}`, { size: 7 });

  // DANFE (centro)
  rect(xC, y, colC, headH);
  txt(xC, y + 5, "DANFE", { size: 12, bold: true, align: "center", w: colC });
  txt(xC + 3, y + 20, "Documento Auxiliar da Nota Fiscal Eletrônica", { size: 5.5, align: "center", w: colC - 6 });
  // 0/1 entrada-saída
  rect(xC + colC / 2 - 9, y + 30, 18, 14);
  txt(xC + colC / 2 - 9, y + 33, d.ide.tipo ?? "", { size: 9, bold: true, align: "center", w: 18 });
  txt(xC, y + 46, "0-ENTRADA  1-SAÍDA", { size: 5, align: "center", w: colC });
  txt(xC, y + 56, `Nº ${san(d.ide.numero)}`, { size: 8, bold: true, align: "center", w: colC });
  txt(xC, y + 66, `SÉRIE ${san(d.ide.serie)}   FL 1/1`, { size: 6, align: "center", w: colC });

  // Chave + código de barras (direita)
  rect(xD, y, colD, headH);
  if (barcode) {
    const bw = colD - 12;
    const bh = 26;
    page.drawImage(barcode, { x: xD + 6, y: A4_H - (y + 6) - bh, width: bw, height: bh });
  }
  txt(xD + 4, y + 36, "CHAVE DE ACESSO", { size: 5, color: GREY });
  txt(xD + 4, y + 43, chaveFmt(d.chave), { size: 7, bold: true, w: colD - 8 });
  txt(xD + 4, y + 56, "Consulte pela chave em www.nfe.fazenda.gov.br/portal", { size: 5, color: GREY, w: colD - 8 });
  txt(xD + 4, y + 66, `Protocolo ${san(d.protocolo)}  ${dateBR(d.dataAutorizacao)} ${timeBR(d.dataAutorizacao)}`, { size: 6, w: colD - 8 });
  y += headH;

  // Natureza da operação
  cell(X0, y, colE + colC, 20, "NATUREZA DA OPERAÇÃO", d.ide.naturezaOperacao, { size: 8 });
  cell(xD, y, colD, 20, "PROTOCOLO DE AUTORIZAÇÃO DE USO", `${san(d.protocolo)}  ${dateBR(d.dataAutorizacao)} ${timeBR(d.dataAutorizacao)}`, { size: 7 });
  y += 20;

  // ============================ DESTINATÁRIO =================================
  y = titulo(y, "DESTINATÁRIO / REMETENTE");
  const dEnd = d.destinatario.endereco;
  // Linha 1: nome | CNPJ | data emissão
  cell(X0, y, W - 200, 20, "NOME / RAZÃO SOCIAL", d.destinatario.nome, { size: 8, bold: true });
  cell(X0 + W - 200, y, 110, 20, "CNPJ / CPF", docMask(d.destinatario.documento), { size: 8 });
  cell(X0 + W - 90, y, 90, 20, "DATA DA EMISSÃO", dateBR(d.ide.dataEmissao), { size: 8 });
  y += 20;
  // Linha 2: endereço | bairro | CEP | data saída
  cell(X0, y, W - 320, 20, "ENDEREÇO", [dEnd.logradouro, dEnd.numero].filter(Boolean).join(", "), { size: 8 });
  cell(X0 + W - 320, y, 130, 20, "BAIRRO", dEnd.bairro, { size: 8 });
  cell(X0 + W - 190, y, 100, 20, "CEP", dEnd.cep, { size: 8 });
  cell(X0 + W - 90, y, 90, 20, "DATA SAÍDA", dateBR(d.ide.dataSaida), { size: 8 });
  y += 20;
  // Linha 3: município | fone | UF | IE | hora saída
  cell(X0, y, W - 320, 20, "MUNICÍPIO", dEnd.municipio, { size: 8 });
  cell(X0 + W - 320, y, 110, 20, "FONE", dEnd.fone, { size: 8 });
  cell(X0 + W - 210, y, 40, 20, "UF", dEnd.uf, { size: 8, align: "center" });
  cell(X0 + W - 170, y, 110, 20, "INSCRIÇÃO ESTADUAL", d.destinatario.ie, { size: 8 });
  cell(X0 + W - 60, y, 60, 20, "HORA SAÍDA", timeBR(d.ide.dataSaida), { size: 8, align: "center" });
  y += 20;

  // ============================ DUPLICATAS ===================================
  if (d.duplicatas.length > 0) {
    y = titulo(y, "FATURA / DUPLICATAS");
    const perRow = 4;
    const dw = W / perRow;
    for (let i = 0; i < d.duplicatas.length; i += perRow) {
      const linha = d.duplicatas.slice(i, i + perRow);
      linha.forEach((dup, j) => {
        cell(X0 + j * dw, y, dw, 18, `DUP ${san(dup.numero)}`, `${dateBR(dup.vencimento)}  R$ ${money(dup.valor)}`, { size: 7 });
      });
      y += 18;
    }
  }

  // ============================ CÁLCULO DO IMPOSTO ===========================
  y = titulo(y, "CÁLCULO DO IMPOSTO");
  const t = d.totais;
  const c5 = W / 5;
  const linhaTot = (top: number, cols: [string, string | null][]) => {
    cols.forEach(([label, val], i) => cell(X0 + i * c5, top, c5, 20, label, `R$ ${money(val)}`, { size: 8, align: "right" }));
    return top + 20;
  };
  y = linhaTot(y, [
    ["BASE ICMS", t.baseIcms], ["VALOR ICMS", t.valorIcms],
    ["BASE ICMS ST", t.baseIcmsSt], ["VALOR ICMS ST", t.valorIcmsSt], ["VALOR PRODUTOS", t.valorProdutos],
  ]);
  y = linhaTot(y, [
    ["VALOR FRETE", t.valorFrete], ["VALOR SEGURO", t.valorSeguro],
    ["DESCONTO", t.desconto], ["OUTRAS DESP.", t.outras], ["VALOR IPI", t.valorIpi],
  ]);
  // Total da nota em destaque
  cell(X0, y, W, 22, "VALOR TOTAL DA NOTA", `R$ ${money(t.valorNota)}`, { size: 12, bold: true, align: "right" });
  y += 22;

  // ============================ TRANSPORTADOR ================================
  y = titulo(y, "TRANSPORTADOR / VOLUMES");
  const tr = d.transporte;
  cell(X0, y, W - 250, 20, "NOME / RAZÃO SOCIAL", tr.transportadora?.nome, { size: 8 });
  cell(X0 + W - 250, y, 90, 20, "FRETE P/ CONTA", FRETE[tr.modalidade ?? ""] ?? san(tr.modalidade), { size: 7 });
  cell(X0 + W - 160, y, 70, 20, "PLACA", tr.veiculo?.placa, { size: 8, align: "center" });
  cell(X0 + W - 90, y, 90, 20, "CNPJ / CPF", docMask(tr.transportadora?.documento ?? null), { size: 7 });
  y += 20;
  const vol = tr.volumes;
  cell(X0, y, W - 340, 20, "QUANTIDADE", vol?.quantidade, { size: 8 });
  cell(X0 + W - 340, y, 110, 20, "ESPÉCIE", vol?.especie, { size: 8 });
  cell(X0 + W - 230, y, 110, 20, "MARCA", vol?.marca, { size: 8 });
  cell(X0 + W - 120, y, 60, 20, "PESO BRUTO", vol?.pesoBruto, { size: 8, align: "right" });
  cell(X0 + W - 60, y, 60, 20, "PESO LÍQ.", vol?.pesoLiquido, { size: 8, align: "right" });
  y += 20;

  // ============================ ITENS ========================================
  y = titulo(y, "DADOS DOS PRODUTOS / SERVIÇOS");
  // colunas: cód, descrição, ncm, cfop, un, qtd, v.unit, v.total, v.icms, aliq
  const COLS: { key: string; label: string; w: number; align?: "right" | "center" }[] = [
    { key: "codigo", label: "CÓD", w: 34 },
    { key: "descricao", label: "DESCRIÇÃO DO PRODUTO / SERVIÇO", w: 183 },
    { key: "ncm", label: "NCM", w: 44, align: "center" },
    { key: "cfop", label: "CFOP", w: 30, align: "center" },
    { key: "unidade", label: "UN", w: 24, align: "center" },
    { key: "quantidade", label: "QTD", w: 44, align: "right" },
    { key: "valorUnitario", label: "V.UNIT", w: 52, align: "right" },
    { key: "valorTotal", label: "V.TOTAL", w: 56, align: "right" },
    { key: "valorIcms", label: "V.ICMS", w: 40, align: "right" },
    { key: "aliqIcms", label: "ALIQ", w: 30, align: "right" },
  ];
  const ROW_H = 12;
  const HEAD_H = 14;

  const drawItensHead = (top: number) => {
    let x = X0;
    for (const c of COLS) {
      rect(x, top, c.w, HEAD_H);
      txt(x + 2, top + 4, c.label, { size: 5.5, bold: true, align: c.align, w: c.w, color: GREY });
      x += c.w;
    }
    return top + HEAD_H;
  };
  const drawItemRow = (item: DanfeItem, top: number) => {
    let x = X0;
    for (const c of COLS) {
      rect(x, top, c.w, ROW_H);
      const raw = (item as unknown as Record<string, string | null>)[c.key];
      let val: string;
      if (["valorUnitario", "valorTotal", "valorIcms"].includes(c.key)) val = money(raw);
      else if (c.key === "quantidade") val = qty(raw);
      else if (c.key === "aliqIcms") val = raw ? `${money(raw)}%` : "";
      else val = san(raw);
      txt(x + 2, top + 3.5, val, { size: 6.5, align: c.align, w: c.w });
      x += c.w;
    }
    return top + ROW_H;
  };

  y = drawItensHead(y);
  for (const item of d.itens) {
    if (y + ROW_H > A4_H - BOTTOM - 4) {
      // nova página: cabeçalho mínimo + cabeçalho da tabela
      page = doc.addPage([A4_W, A4_H]);
      let top = M;
      txt(X0, top, `DANFE (continuação) — NF-e nº ${san(d.ide.numero)} série ${san(d.ide.serie)}`, { size: 8, bold: true });
      txt(X0, top + 10, `Chave ${chaveFmt(d.chave)}`, { size: 6, color: GREY });
      top += 22;
      y = drawItensHead(top);
    }
    y = drawItemRow(item, y);
  }

  // ============================ DADOS ADICIONAIS =============================
  const info = [d.informacoesComplementares, d.informacoesFisco].filter(Boolean).join(" | ");
  if (y + 60 > A4_H - BOTTOM) {
    page = doc.addPage([A4_W, A4_H]);
    y = M;
  } else {
    y += 4;
  }
  y = titulo(y, "DADOS ADICIONAIS");
  const infoH = 54;
  rect(X0, y, W, infoH);
  // quebra em linhas simples pela largura
  const linhasInfo = wrap(san(info), font, 7, W - 8);
  linhasInfo.slice(0, 6).forEach((ln, i) => txt(X0 + 4, y + 4 + i * 8.5, ln, { size: 7 }));

  return await doc.save();
}

// Quebra texto em linhas que cabem em maxW.
function wrap(text: string, f: PDFFont, size: number, maxW: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const tent = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(tent, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = tent;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
