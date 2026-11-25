/**
 * Agregados: situação de cada um (selo da tela) e a tabela que vai para o
 * Excel e para o PDF. Funções puras — a tela, a rota do Excel e o PDF usam a
 * mesma tabela, então os três mostram exatamente os mesmos números.
 */
import { diferencaVsCasa, indicadores, type Casa, type LinhaAgregado, type Numeros, type RelatorioAgregados } from "./agregados";
import { formatBRL, formatPercent } from "./format";

export type Tom = "navy" | "gold" | "red" | "slate";
export interface Situacao {
  rotulo: string;
  tom: Tom;
  motivo: string;
}

/** Devolução "alta" = 1,5× a da casa no mesmo papel. */
const FATOR_DEVOLUCAO = 1.5;

export function situacao(a: LinhaAgregado, casa: Casa | undefined): Situacao {
  if (!a.papel) return { rotulo: "Sem carga", tom: "slate", motivo: "Recebeu no período, mas não achamos carga dele" };
  const vs = diferencaVsCasa(a, casa);
  const dev = indicadores(a).devolucao;
  const devCasa = casa ? indicadores(casa).devolucao : null;
  const caro = vs !== null && vs > 0;
  const devAlta = dev !== null && devCasa !== null && dev > devCasa * FATOR_DEVOLUCAO;
  if (caro && devAlta) return { rotulo: "Rever", tom: "red", motivo: "Mais caro que o CLT e devolve acima da casa" };
  if (caro) return { rotulo: "Mais caro", tom: "gold", motivo: "Custou mais do que um CLT pelos mesmos dias" };
  if (devAlta) return { rotulo: "Devolução alta", tom: "gold", motivo: "Mais barato, mas devolve bem acima da casa" };
  return { rotulo: "Compensa", tom: "navy", motivo: "Mais barato que o CLT e devolução dentro da casa" };
}

/** Grau de observação (tela: ponto colorido; PDF/Excel: texto). */
export const NIVEL_OBSERVACAO: Record<Tom, string> = { navy: "Sem observação", gold: "Atenção", red: "Rever", slate: "Sem carga" };

const MINUSCULAS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
/** "JOSE DA SILVA" → "Jose da Silva". */
export const nomeProprio = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && MINUSCULAS.has(w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

// ------------------------------------------------------------------ tabela

export type Formato = "texto" | "int" | "brl" | "pct" | "dec";
export interface Coluna {
  titulo: string;
  formato: Formato;
}
export type Celula = string | number | null;
export interface TabelaAgregados {
  colunas: Coluna[];
  linhas: Celula[][];
  totais: Celula[][];
}

export const COLUNAS: Coluna[] = [
  { titulo: "Agregado", formato: "texto" },
  { titulo: "Papel", formato: "texto" },
  { titulo: "Observação", formato: "texto" },
  { titulo: "Dias rodados", formato: "int" },
  { titulo: "Viagens", formato: "int" },
  { titulo: "Entregas", formato: "int" },
  { titulo: "Notas", formato: "int" },
  { titulo: "Peso (t)", formato: "dec" },
  { titulo: "Faturado", formato: "brl" },
  { titulo: "Devolvido", formato: "brl" },
  { titulo: "Devolução %", formato: "pct" },
  { titulo: "Custo", formato: "brl" },
  { titulo: "Custo por dia", formato: "brl" },
  { titulo: "Custo por entrega", formato: "brl" },
  { titulo: "Custo ÷ faturado líquido", formato: "pct" },
  { titulo: "Diferença vs CLT", formato: "brl" },
  { titulo: "Último pagamento", formato: "texto" },
];

const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null);

function numeros(x: Numeros & { custo: number }): Celula[] {
  const i = indicadores(x);
  return [x.dias, x.viagens, x.entregas, x.notas, x.kg / 1000, x.faturado, x.devolvido, i.devolucao, x.custo, i.custoPorDia, i.custoPorEntrega, i.custoSobreFaturado];
}

export function somarAgregados(as: LinhaAgregado[]): Numeros & { custo: number } {
  const t = { custo: 0, dias: 0, viagens: 0, notas: 0, entregas: 0, kg: 0, faturado: 0, notasDevolvidas: 0, devolvido: 0 };
  for (const a of as) {
    t.custo += a.custo;
    t.dias += a.dias;
    t.viagens += a.viagens;
    t.notas += a.notas;
    t.entregas += a.entregas;
    t.kg += a.kg;
    t.faturado += a.faturado;
    t.notasDevolvidas += a.notasDevolvidas;
    t.devolvido += a.devolvido;
  }
  return t;
}

/** Diferença total vs CLT de todos os agregados com carga. */
export const diferencaTotal = (rel: RelatorioAgregados) =>
  rel.agregados.reduce((t, a) => t + (diferencaVsCasa(a, a.papel ? rel.casa[a.papel] : undefined) ?? 0), 0);

/** Ordem da tela: quem mais custa a mais que o CLT primeiro; sem carga no fim. */
export function ordenar(rel: RelatorioAgregados): LinhaAgregado[] {
  const vs = (a: LinhaAgregado) => diferencaVsCasa(a, a.papel ? rel.casa[a.papel] : undefined) ?? -Infinity;
  return [...rel.agregados].sort((a, b) => vs(b) - vs(a));
}

export function tabelaAgregados(rel: RelatorioAgregados): TabelaAgregados {
  const linhas = ordenar(rel).map((a) => {
    const casa = a.papel ? rel.casa[a.papel] : undefined;
    const sem = !a.papel;
    const n = numeros(a);
    return [
      nomeProprio(a.nome),
      a.papel ?? "—",
      NIVEL_OBSERVACAO[situacao(a, casa).tom],
      ...(sem ? n.map((v, i) => (i === 8 ? v : null)) : n), // sem carga: só o custo
      diferencaVsCasa(a, casa),
      dataBR(a.ultimoPagamento),
    ];
  });
  const com = rel.agregados.filter((a) => a.papel);
  const totais: Celula[][] = [[`Agregados (${com.length})`, "", "", ...numeros(somarAgregados(com)), diferencaTotal(rel), null]];
  for (const papel of ["motorista", "ajudante"] as const) {
    const c = rel.casa[papel];
    if (c) totais.push([`CLT · ${papel === "motorista" ? "motoristas" : "ajudantes"} (${c.pessoas})`, "", "", ...numeros(c), null, null]);
  }
  return { colunas: COLUNAS, linhas, totais };
}

// ------------------------------------------------------------------ PDF

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function formatarCelula(v: Celula, f: Formato): string {
  if (v === null) return "—";
  if (typeof v === "string") return v;
  switch (f) {
    case "brl":
      return formatBRL(v);
    case "pct":
      return formatPercent(v, 1);
    case "dec":
      return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "int":
      return v.toLocaleString("pt-BR");
    default:
      return String(v);
  }
}

const CSS = `
@page { size: A4 landscape; margin: 10mm 9mm 12mm; }
* { box-sizing: border-box; }
body { font: 8pt/1.3 Arial, Helvetica, sans-serif; color: #141a4d; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header { border-bottom: 2.5pt solid #1b2168; padding-bottom: 6pt; margin-bottom: 8pt; display: flex; justify-content: space-between; align-items: flex-end; }
h1 { font-size: 15pt; margin: 0; }
.marca { font-size: 7.5pt; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 1pt; }
.meta { text-align: right; font-size: 8pt; color: #475569; }
.kpis { display: flex; gap: 6pt; margin-bottom: 8pt; }
.kpi { flex: 1; border: 1pt solid #e2e8f0; border-left: 3pt solid #f59e0b; border-radius: 4pt; padding: 4pt 6pt; }
.kpi span { display: block; font-size: 7pt; text-transform: uppercase; color: #64748b; letter-spacing: .4pt; }
.kpi b { font-size: 11pt; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #1b2168; color: #fff; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .3pt; padding: 3pt 4pt; text-align: left; }
td { padding: 3pt 4pt; border-bottom: .6pt solid #e2e8f0; }
tbody tr:nth-child(even) td { background: #f8fafc; }
tr.tot td { font-weight: bold; background: #eef0fb; border-top: 1pt solid #1b2168; }
.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mais { color: #e11d48; font-weight: bold; }
.nota { margin-top: 6pt; font-size: 7pt; color: #64748b; }
@media screen { body { max-width: 280mm; margin: 10mm auto; } }
`;

export function documentoAgregados(t: TabelaAgregados, ctx: { periodo: string; geradoEm: Date; kpis: [string, string][] }): string {
  const iVs = t.colunas.findIndex((c) => c.titulo === "Diferença vs CLT");
  const linha = (l: Celula[], cls = "") =>
    `<tr class="${cls}">${l
      .map((v, i) => {
        const f = t.colunas[i].formato;
        const mais = i === iVs && typeof v === "number" && v > 0 ? " mais" : "";
        const txt = i === iVs && typeof v === "number" ? `${v > 0 ? "+" : "−"}${formatBRL(Math.abs(v))}` : formatarCelula(v, f);
        return `<td class="${f === "texto" ? "" : "n"}${mais}">${esc(txt)}</td>`;
      })
      .join("")}</tr>`;
  const gerado = `${ctx.geradoEm.toLocaleDateString("pt-BR")} ${ctx.geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const titulo = `Agregados - ${ctx.periodo}`.replace(/[\\/:*?"<>|]/g, "-");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>
<header><div><div class="marca">DIA · Centro de Controle Logístico</div><h1>Agregados — custo × entrega</h1></div>
<div class="meta">Período <b>${esc(ctx.periodo)}</b><br>Gerado em ${esc(gerado)}</div></header>
<div class="kpis">${ctx.kpis.map(([r, v]) => `<div class="kpi"><span>${esc(r)}</span><b>${esc(v)}</b></div>`).join("")}</div>
<table><thead><tr>${t.colunas.map((c) => `<th class="${c.formato === "texto" ? "" : "n"}">${esc(c.titulo)}</th>`).join("")}</tr></thead>
<tbody>${t.linhas.map((l) => linha(l)).join("")}${t.totais.map((l) => linha(l, "tot")).join("")}</tbody></table>
<p class="nota">Devolução = valor devolvido ÷ valor faturado das notas que o agregado levou no período. Diferença vs CLT = custo do agregado − (folha dos CLT do mesmo papel ÷ dias que eles rodaram) × dias que o agregado rodou; + = agregado mais caro. Folha CLT só pessoal, sem veículo nem diesel.</p>
</body></html>`;
}
