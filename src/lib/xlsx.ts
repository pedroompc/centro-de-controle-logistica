import { criarZip } from "./zip";

// Planilha .xlsx mínima (uma aba) montada à mão sobre o zip.ts — o deploy não
// roda npm install, então nada de biblioteca nova. Número vai como número (o
// Excel soma/filtra), com formato de moeda, % ou inteiro; texto vai inline.

export type FormatoXlsx = "texto" | "int" | "brl" | "pct" | "dec";
export interface ColunaXlsx {
  titulo: string;
  formato: FormatoXlsx;
  largura?: number;
}
export type CelulaXlsx = string | number | null;

// Índices dos estilos em styles.xml (cellXfs).
const ESTILO: Record<FormatoXlsx, number> = { texto: 0, int: 2, brl: 3, pct: 4, dec: 5 };
const CABECALHO = 1;
const NEGRITO_DESLOC = 5; // estilos 6..10 = mesmos formatos em negrito (linhas de total)

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function letra(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function celula(v: CelulaXlsx, ref: string, estilo: number): string {
  if (v === null || v === "") return `<c r="${ref}" s="${estilo}"/>`;
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="#,##0.0"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B2168"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF0FB"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="3" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="165" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="166" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Uma aba: cabeçalho, linhas e linhas de total (em negrito, fundo claro). */
export function criarXlsx(aba: string, colunas: ColunaXlsx[], linhas: CelulaXlsx[][], totais: CelulaXlsx[][] = []): Buffer {
  const estiloTotal = (f: FormatoXlsx) => (f === "texto" ? 6 : ESTILO[f] + NEGRITO_DESLOC);
  const rows: string[] = [];
  rows.push(`<row r="1" ht="30" customHeight="1">${colunas.map((c, i) => celula(c.titulo, `${letra(i)}1`, CABECALHO)).join("")}</row>`);
  const todas = [...linhas.map((l) => ({ l, tot: false })), ...totais.map((l) => ({ l, tot: true }))];
  todas.forEach(({ l, tot }, k) => {
    const r = k + 2;
    rows.push(`<row r="${r}">${colunas.map((c, i) => celula(l[i] ?? null, `${letra(i)}${r}`, tot ? estiloTotal(c.formato) : ESTILO[c.formato])).join("")}</row>`);
  });
  const cols = colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura ?? (c.formato === "texto" ? 18 : 14)}" customWidth="1"/>`).join("");
  const ultima = `${letra(colunas.length - 1)}${linhas.length + 1}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A1:${ultima}"/></worksheet>`;
  const nomeAba = esc(aba.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  return criarZip([
    {
      nome: "[Content_Types].xml",
      dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      nome: "_rels/.rels",
      dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nome: "xl/workbook.xml",
      dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nomeAba}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nomeAba}'!$A$1:$${letra(colunas.length - 1)}$${linhas.length + 1}</definedName></definedNames></workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nome: "xl/worksheets/sheet1.xml", dados: sheet },
    { nome: "xl/styles.xml", dados: STYLES },
  ]);
}
