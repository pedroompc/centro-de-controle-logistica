/**
 * Relatórios de devolução para IMPRESSÃO / PDF (botão "Exportar PDF" de cada aba).
 * Funções puras: recebem os dados que a aba já carregou e devolvem o corpo HTML
 * do relatório; `documentoRelatorio` embrulha num documento A4 pronto para o
 * diálogo de impressão do navegador (imprimir direto ou "Salvar como PDF").
 */
import { formatBRL, formatPercent, formatKg } from "./format";
import type {
  DevolucaoPorMotivo,
  DevolucaoPorMotorista,
  MotivoDetalhe,
  SetorDevolucao,
} from "./devolucoes";
import type { CidadeDevolucao, BairroDevolucao } from "./devolucoes-mapa";
import type { DevolucaoDiaSemana } from "./devolucoes-dia-semana";
import type { PastaDevolucao } from "./devolucoes-supervisor";
import { resumirRetira, type LinhaRetira } from "./devolucoes-retira";
import { taxaSobreLiquido } from "./devolucoes-supervisor";
import { ETAPAS, formatHoras, type RelatorioProtocolos } from "./devolucoes-protocolos";

/** Cabeçalho comum: o que o relatório cobre. */
export interface ContextoRelatorio {
  periodo: string; // ex.: "nov/2026"
  base: "faturamento" | "devolucao";
  motivo?: string;
  setor?: string;
  cidade?: string;
  geradoEm: Date;
}

/** Item genérico de ranking (cliente / vendedor). */
export interface ItemRelatorio {
  cod: number;
  nome: string;
  notas: number;
  valor: number;
}

export const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const num = (n: number) => n.toLocaleString("pt-BR");
const pct = (f: number, casas = 1) => formatPercent(f, casas);
const SETOR_CLASSE: Record<string, string> = {
  Logística: "s-log",
  Comercial: "s-com",
  Faturamento: "s-fat",
};
const selo = (setor: string) => `<span class="selo ${SETOR_CLASSE[setor] ?? "s-nc"}">${esc(setor)}</span>`;
const ORDEM_SETOR: SetorDevolucao[] = ["Logística", "Comercial", "Faturamento", "Não classificado"];

function somaSetores(motivos: { setor: string; valor: number; notas: number }[]) {
  const m = new Map<string, { valor: number; notas: number }>();
  for (const x of motivos) {
    const a = m.get(x.setor) ?? { valor: 0, notas: 0 };
    a.valor += x.valor;
    a.notas += x.notas;
    m.set(x.setor, a);
  }
  return ORDEM_SETOR.filter((s) => m.has(s)).map((s) => ({ setor: s, ...m.get(s)! }));
}

/** Caixa de indicadores no topo do relatório. */
function indicadores(itens: { rotulo: string; valor: string; sub?: string }[]): string {
  return `<div class="kpis">${itens
    .map((i) => `<div class="kpi"><span class="kpi-r">${esc(i.rotulo)}</span><b>${esc(i.valor)}</b>${i.sub ? `<span class="kpi-s">${esc(i.sub)}</span>` : ""}</div>`)
    .join("")}</div>`;
}

/** Resumo do período pelos motivos (respeita os filtros da página). */
export function resumoDoPeriodo(porMotivo: DevolucaoPorMotivo[]): string {
  const total = porMotivo.reduce((t, m) => t + m.valor, 0);
  const notas = porMotivo.reduce((t, m) => t + m.notas, 0);
  return `<p class="legenda">Devolução do período — todas as notas</p>` + indicadores([
    { rotulo: "Total devolvido", valor: formatBRL(total), sub: `${num(notas)} notas` },
    ...somaSetores(porMotivo).map((s) => ({
      rotulo: s.setor,
      valor: formatBRL(s.valor),
      sub: total > 0 ? `${pct(s.valor / total)} do total` : undefined,
    })),
  ]);
}

/** Tabela de motivos de uma entidade (drill-down impresso). */
function tabelaMotivos(motivos: MotivoDetalhe[]): string {
  if (motivos.length === 0) return `<p class="vazio">Sem motivos registrados.</p>`;
  const total = motivos.reduce((t, m) => t + m.valor, 0);
  const notas = motivos.reduce((t, m) => t + m.notas, 0);
  const linhas = [...motivos]
    .sort((a, b) => b.valor - a.valor)
    .map(
      (m) => `<tr><td>${esc(m.motivo)}</td><td>${selo(m.setor)}</td><td class="n">${num(m.notas)}</td><td class="n">${formatBRL(m.valor)}</td><td class="n">${total > 0 ? pct(m.valor / total) : "—"}</td></tr>`,
    )
    .join("");
  return `<table class="mini"><thead><tr><th>Motivo</th><th>Setor</th><th class="n">Notas</th><th class="n">Valor</th><th class="n">% do valor</th></tr></thead>
<tbody>${linhas}</tbody><tfoot><tr><td colspan="2">Total</td><td class="n">${num(notas)}</td><td class="n">${formatBRL(total)}</td><td class="n">100%</td></tr></tfoot></table>`;
}

const linhaSetores = (motivos: MotivoDetalhe[]) =>
  somaSetores(motivos)
    .map((s) => `${selo(s.setor)} ${formatBRL(s.valor)} · ${num(s.notas)} notas`)
    .join(" &nbsp; ");

// ------------------------------------------------------------------ motoristas

/**
 * Motoristas: ranking completo + uma ficha por motorista com devolução, com os
 * motivos detalhados (notas, valor, setor). `so` = imprime só esse motorista.
 */
export function relatorioMotoristas(
  motoristas: DevolucaoPorMotorista[],
  motivos: Record<number, MotivoDetalhe[]>,
  so?: number,
): string {
  const lista = (so != null ? motoristas.filter((m) => m.codMotorista === so) : motoristas)
    .slice()
    .sort((a, b) => b.valorDevolvido - a.valorDevolvido || b.taxa - a.taxa);
  const entregas = lista.reduce((t, m) => t + m.expedidas, 0);
  const devolvidas = lista.reduce((t, m) => t + m.devolvidas, 0);
  const valor = lista.reduce((t, m) => t + m.valorDevolvido, 0);
  const faturado = lista.reduce((t, m) => t + m.valorExpedido, 0);
  const pdvsDev = lista.reduce((t, m) => t + m.pdvsDevolvidos, 0);
  // Participação no faturado em carga de TODOS os motoristas (mesmo no PDF de um só).
  const totalGeral = motoristas.reduce((t, m) => t + m.valorExpedido, 0);
  const share = (v: number) => (totalGeral > 0 ? pct(v / totalGeral) : "—");
  const totalDevGeral = motoristas.reduce((t, m) => t + m.valorDevolvido, 0);
  const shareDev = (v: number) => (totalDevGeral > 0 ? pct(v / totalDevGeral) : "—");
  const vinculo = (t: DevolucaoPorMotorista["tipo"]) => (t === "F" ? "Da casa" : t === "T" ? "Terceirizado" : "—");

  const kpis = `<p class="legenda">${so != null ? "Motorista" : "Motoristas — só notas entregues em carga"}</p>` + indicadores([
    { rotulo: so != null ? "Motorista" : "Motoristas", valor: so != null ? (lista[0]?.nome ?? "—") : num(lista.length) },
    { rotulo: "Faturado", valor: formatBRL(faturado), sub: so != null ? `representa ${share(faturado)} do faturamento` : undefined },
    { rotulo: "Entregas", valor: num(entregas) },
    { rotulo: "Notas devolvidas", valor: num(devolvidas), sub: entregas > 0 ? `taxa ${pct(devolvidas / entregas)}` : undefined },
    { rotulo: "PDVs devolvidos", valor: num(pdvsDev), sub: so != null && lista[0] ? `de ${num(lista[0].pdvs)} atendidos` : undefined },
    { rotulo: "Valor devolvido", valor: formatBRL(valor), sub: so != null ? `${shareDev(valor)} da devolução` : undefined },
  ]);

  const ranking =
    so != null
      ? ""
      : `<h2>Ranking dos motoristas</h2>
<table><thead><tr><th class="c">#</th><th>Motorista</th><th>Vínculo</th><th class="n">Faturado</th><th class="n">% do faturamento</th><th class="n">Entregas</th><th class="n">Notas dev.</th><th class="n">PDVs dev.</th><th class="n">Taxa</th><th class="n">Valor devolvido</th><th class="n">% da devolução</th></tr></thead><tbody>
${lista
  .map(
    (m, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(m.nome)}</b> <span class="cod">${m.codMotorista}</span></td><td>${vinculo(m.tipo)}</td><td class="n">${formatBRL(m.valorExpedido)}</td><td class="n">${share(m.valorExpedido)}</td><td class="n">${num(m.expedidas)}</td><td class="n">${num(m.devolvidas)}</td><td class="n">${num(m.pdvsDevolvidos)}/${num(m.pdvs)}</td><td class="n ${m.taxa >= 15 ? "alto" : m.taxa >= 8 ? "medio" : ""}">${pct(m.taxa / 100)}</td><td class="n">${formatBRL(m.valorDevolvido)}</td><td class="n">${shareDev(m.valorDevolvido)}</td></tr>`,
  )
  .join("")}
</tbody><tfoot><tr><td></td><td colspan="2">Total</td><td class="n">${formatBRL(faturado)}</td><td class="n">${share(faturado)}</td><td class="n">${num(entregas)}</td><td class="n">${num(devolvidas)}</td><td class="n">${num(pdvsDev)}</td><td class="n">${entregas > 0 ? pct(devolvidas / entregas) : "—"}</td><td class="n">${formatBRL(valor)}</td><td class="n">${shareDev(valor)}</td></tr></tfoot></table>`;

  const fichas = lista
    .filter((m) => m.devolvidas > 0 || (motivos[m.codMotorista]?.length ?? 0) > 0)
    .map((m) => {
      const mot = motivos[m.codMotorista] ?? [];
      return `<section class="ficha">
<div class="ficha-cab"><div><b>${esc(m.nome)}</b> <span class="cod">Cód. ${m.codMotorista} · ${vinculo(m.tipo)}</span></div>
<div class="ficha-num"><span>Faturado <b>${formatBRL(m.valorExpedido)}</b> (${share(m.valorExpedido)})</span><span>Entregas <b>${num(m.expedidas)}</b></span><span>Notas dev. <b>${num(m.devolvidas)}</b></span><span>PDVs dev. <b>${num(m.pdvsDevolvidos)}/${num(m.pdvs)}</b></span><span>Taxa <b>${pct(m.taxa / 100)}</b></span><span>Devolvido <b>${formatBRL(m.valorDevolvido)}</b> (${shareDev(m.valorDevolvido)} da devolução)</span></div></div>
${mot.length ? `<p class="setores">${linhaSetores(mot)}</p>` : ""}
${tabelaMotivos(mot)}
</section>`;
    })
    .join("");

  return `${kpis}${ranking}<h2 ${so != null ? "" : 'class="quebra"'}>Detalhamento por motorista — motivos da devolução</h2>${fichas || `<p class="vazio">Nenhuma devolução no período.</p>`}`;
}

// ------------------------------------------------------- clientes / vendedores

/** Ranking + detalhamento por motivo dos `detalhe` maiores (cliente ou vendedor). */
export function relatorioRanking(
  rotulo: string,
  itens: ItemRelatorio[],
  motivos: Record<number, MotivoDetalhe[]>,
  detalhe = 50,
): string {
  const lista = itens.slice().sort((a, b) => b.valor - a.valor);
  const total = lista.reduce((t, x) => t + x.valor, 0);
  const notas = lista.reduce((t, x) => t + x.notas, 0);
  const top = lista.slice(0, detalhe);
  return `${indicadores([
    { rotulo: `${rotulo}s com devolução`, valor: num(lista.length) },
    { rotulo: "Notas devolvidas", valor: num(notas) },
    { rotulo: "Valor devolvido", valor: formatBRL(total) },
  ])}
<h2>Ranking</h2>
<table><thead><tr><th class="c">#</th><th>${esc(rotulo)}</th><th class="n">Notas</th><th class="n">Valor</th><th class="n">% do total</th></tr></thead><tbody>
${lista.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.nome)} <span class="cod">${x.cod}</span></td><td class="n">${num(x.notas)}</td><td class="n">${formatBRL(x.valor)}</td><td class="n">${total > 0 ? pct(x.valor / total) : "—"}</td></tr>`).join("")}
</tbody><tfoot><tr><td></td><td>Total</td><td class="n">${num(notas)}</td><td class="n">${formatBRL(total)}</td><td class="n">100%</td></tr></tfoot></table>
<h2 class="quebra">Motivos por ${esc(rotulo.toLowerCase())}${lista.length > detalhe ? ` — os ${detalhe} maiores` : ""}</h2>
${top
  .map(
    (x) => `<section class="ficha"><div class="ficha-cab"><div><b>${esc(x.nome)}</b> <span class="cod">Cód. ${x.cod}</span></div><div class="ficha-num"><span>Notas <b>${num(x.notas)}</b></span><span>Devolvido <b>${formatBRL(x.valor)}</b></span></div></div>${tabelaMotivos(motivos[x.cod] ?? [])}</section>`,
  )
  .join("")}`;
}

// ---------------------------------------------------------------- retira

const dataBR = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

/** Devoluções de venda sem carga / balcão: cliente, motivo, NF de origem e de devolução. */
export function relatorioRetira(linhas: LinhaRetira[]): string {
  const r = resumirRetira(linhas);
  const dup = [...new Set(linhas.filter((l) => l.duplicada).map((l) => l.nfOrigem))];
  return `<p class="legenda">Venda sem carga ou no balcão (DIALOG) · uma linha por NF de devolução</p>${indicadores([
    { rotulo: "Devolvido", valor: formatBRL(r.valor) },
    { rotulo: "NFs de devolução", valor: num(r.notas) },
    { rotulo: "Clientes", valor: num(r.clientes) },
  ])}${dup.length ? `<p class="setores"><b>NF de origem devolvida mais de uma vez:</b> ${dup.join(", ")} — ${formatBRL(r.excessoDuplicado)} acima do valor da nota.</p>` : ""}
<table><thead><tr><th>Cliente</th><th>Motivo</th><th>NF origem</th><th>Venda</th><th>NF devolução</th><th>Devolução</th><th>RCA</th><th class="n">Devolvido</th></tr></thead><tbody>
${linhas
  .map(
    (l) => `<tr${l.duplicada ? ' class="alto"' : ""}><td><b>${esc(l.cliente)}</b> <span class="cod">${l.codcli}</span></td><td>${esc(l.motivo)} ${selo(l.setor)}</td><td>${l.nfOrigem}${l.duplicada ? ` <b>(${l.devolucoesDaOrigem}×)</b>` : ""}</td><td>${dataBR(l.dataVenda)}</td><td>${l.nfDevolucao}</td><td>${dataBR(l.dataDevolucao)}</td><td>${esc(l.rca)}</td><td class="n">${formatBRL(l.valor)}</td></tr>`,
  )
  .join("")}
</tbody><tfoot><tr><td colspan="7">Total</td><td class="n">${formatBRL(r.valor)}</td></tr></tfoot></table>`;
}

// ---------------------------------------------------------------- supervisores

export function relatorioSupervisores(pastas: PastaDevolucao[]): string {
  const tot = pastas.reduce(
    (a, p) => ({ l: a.l + p.liquido, d: a.d + p.devolucao, c: a.c + p.setores.Comercial, g: a.g + p.setores.Logística, o: a.o + p.setores.Faturamento + p.setores["Não classificado"] }),
    { l: 0, d: 0, c: 0, g: 0, o: 0 },
  );
  const cel = (v: number, l: number) => `<td class="n">${v ? `${pct(taxaSobreLiquido(v, l), 2)}<br><span class="cod">${formatBRL(v)}</span>` : "—"}</td>`;
  const linha = (nome: string, l: number, d: number, c: number, g: number, o: number, cls = "") =>
    `<tr class="${cls}"><td>${nome}</td><td class="n">${formatBRL(l)}</td><td class="n">${formatBRL(d)}</td><td class="n"><b>${pct(taxaSobreLiquido(d, l), 2)}</b></td>${cel(c, l)}${cel(g, l)}${cel(o, l)}</tr>`;
  return `${indicadores([
    { rotulo: "Faturamento líquido", valor: formatBRL(tot.l) },
    { rotulo: "Devolução", valor: formatBRL(tot.d), sub: `taxa ${pct(taxaSobreLiquido(tot.d, tot.l), 2)}` },
    { rotulo: "Comercial", valor: pct(taxaSobreLiquido(tot.c, tot.l), 2), sub: formatBRL(tot.c) },
    { rotulo: "Logística", valor: pct(taxaSobreLiquido(tot.g, tot.l), 2), sub: formatBRL(tot.g) },
  ])}
<p class="nota">Taxas sobre o faturamento líquido. "Outros" = setor Faturamento + não classificado.</p>
<table><thead><tr><th>Pasta / supervisor</th><th class="n">Fat. líquido</th><th class="n">Devolução</th><th class="n">Taxa</th><th class="n">Comercial</th><th class="n">Logística</th><th class="n">Outros</th></tr></thead><tbody>
${pastas
  .map((p) => {
    const o = (s: PastaDevolucao["setores"]) => s.Faturamento + s["Não classificado"];
    const cab = linha(`<b>${esc(p.pasta)}</b>`, p.liquido, p.devolucao, p.setores.Comercial, p.setores.Logística, o(p.setores), "pasta");
    const filhos =
      p.supervisores.length > 1 || p.supervisores[0]?.nome !== p.pasta
        ? p.supervisores.map((s) => linha(`<span class="rec">${esc(s.nome)} <span class="cod">${s.cod}</span></span>`, s.liquido, s.devolucao, s.setores.Comercial, s.setores.Logística, o(s.setores))).join("")
        : "";
    return cab + filhos;
  })
  .join("")}
</tbody><tfoot>${linha("Total", tot.l, tot.d, tot.c, tot.g, tot.o)}</tfoot></table>`;
}

// --------------------------------------------------------------------- motivos

export function relatorioMotivos(porMotivo: DevolucaoPorMotivo[]): string {
  const total = porMotivo.reduce((t, m) => t + m.valor, 0);
  const notas = porMotivo.reduce((t, m) => t + m.notas, 0);
  const setores = somaSetores(porMotivo);
  return `<h2>Por setor</h2>
<table><thead><tr><th>Setor</th><th class="n">Notas</th><th class="n">Valor</th><th class="n">% do total</th></tr></thead><tbody>
${setores.map((s) => `<tr><td>${selo(s.setor)}</td><td class="n">${num(s.notas)}</td><td class="n">${formatBRL(s.valor)}</td><td class="n">${total > 0 ? pct(s.valor / total) : "—"}</td></tr>`).join("")}
</tbody></table>
<h2>Por motivo</h2>
<table><thead><tr><th class="c">#</th><th>Motivo</th><th>Setor</th><th class="n">Notas</th><th class="n">Valor</th><th class="n">% do total</th></tr></thead><tbody>
${porMotivo
  .slice()
  .sort((a, b) => b.valor - a.valor)
  .map((m, i) => `<tr><td class="c">${i + 1}</td><td>${esc(m.motivo)}</td><td>${selo(m.setor)}</td><td class="n">${num(m.notas)}</td><td class="n">${formatBRL(m.valor)}</td><td class="n">${total > 0 ? pct(m.valor / total) : "—"}</td></tr>`)
  .join("")}
</tbody><tfoot><tr><td></td><td colspan="2">Total</td><td class="n">${num(notas)}</td><td class="n">${formatBRL(total)}</td><td class="n">100%</td></tr></tfoot></table>`;
}

// ------------------------------------------------------------- dia da semana

export function relatorioDiaSemana(dias: DevolucaoDiaSemana[]): string {
  const t = dias.reduce((a, d) => ({ v: a.v + d.valor, p: a.p + d.peso, n: a.n + d.notas }), { v: 0, p: 0, n: 0 });
  return `<table><thead><tr><th>Dia</th><th class="n">Notas</th><th class="n">Valor</th><th class="n">% do valor</th><th class="n">Peso</th><th class="n">% do peso</th></tr></thead><tbody>
${dias.map((d) => `<tr><td>${esc(d.rotulo)}</td><td class="n">${num(d.notas)}</td><td class="n">${formatBRL(d.valor)}</td><td class="n">${pct(d.pctValor)}</td><td class="n">${formatKg(d.peso)}</td><td class="n">${pct(d.pctPeso)}</td></tr>`).join("")}
</tbody><tfoot><tr><td>Total</td><td class="n">${num(t.n)}</td><td class="n">${formatBRL(t.v)}</td><td class="n">100%</td><td class="n">${formatKg(t.p)}</td><td class="n">100%</td></tr></tfoot></table>`;
}

// ---------------------------------------------------------- cidades / bairros

export function relatorioCidades(cidades: CidadeDevolucao[]): string {
  const lista = cidades.filter((c) => c.devolvido > 0 || c.faturado > 0).sort((a, b) => b.devolvido - a.devolvido);
  const f = lista.reduce((t, c) => t + c.faturado, 0);
  const d = lista.reduce((t, c) => t + c.devolvido, 0);
  return `${indicadores([
    { rotulo: "Cidades", valor: num(lista.length) },
    { rotulo: "Faturado", valor: formatBRL(f) },
    { rotulo: "Devolvido", valor: formatBRL(d), sub: f > 0 ? `taxa ${pct(d / f, 2)}` : undefined },
  ])}
<table><thead><tr><th class="c">#</th><th>Cidade</th><th class="n">Faturado</th><th class="n">Devolvido</th><th class="n">Taxa</th><th class="n">Notas</th><th class="n">Devolvidas</th><th>Motivo principal</th></tr></thead><tbody>
${lista
  .map((c, i) => `<tr><td class="c">${i + 1}</td><td>${esc(c.cidade)}</td><td class="n">${formatBRL(c.faturado)}</td><td class="n">${formatBRL(c.devolvido)}</td><td class="n">${c.faturado > 0 ? pct(c.taxa, 2) : "—"}</td><td class="n">${num(c.notasEntregues)}</td><td class="n">${num(c.notasDevolvidas)}</td><td>${esc(c.motivo)}</td></tr>`)
  .join("")}
</tbody></table>`;
}

export function relatorioBairros(bairros: BairroDevolucao[]): string {
  const lista = bairros.slice().sort((a, b) => b.devolvido - a.devolvido);
  const d = lista.reduce((t, b) => t + b.devolvido, 0);
  return `${indicadores([
    { rotulo: "Bairros", valor: num(lista.length) },
    { rotulo: "Devolvido", valor: formatBRL(d) },
  ])}
<table><thead><tr><th class="c">#</th><th>Cidade</th><th>Bairro</th><th class="n">Faturado</th><th class="n">Devolvido</th><th class="n">Notas</th><th class="n">Peso</th><th>Motivo principal</th></tr></thead><tbody>
${lista
  .map((b, i) => `<tr><td class="c">${i + 1}</td><td>${esc(b.cidade)}</td><td>${esc(b.bairro)}</td><td class="n">${formatBRL(b.faturado)}</td><td class="n">${formatBRL(b.devolvido)}</td><td class="n">${num(b.notas)}</td><td class="n">${formatKg(b.peso)}</td><td>${esc(b.motivo)}</td></tr>`)
  .join("")}
</tbody></table>`;
}

// ------------------------------------------------------ retorno ao estoque

export function relatorioProtocolos(r: RelatorioProtocolos): string {
  const p = r.periodo;
  const rotEtapa = (id: string) => ETAPAS.find((e) => e.id === id)?.rotulo ?? id;
  return `${indicadores([
    { rotulo: "Protocolos no período", valor: num(p.total.protocolos), sub: formatBRL(p.total.valor) },
    { rotulo: "Finalizados", valor: num(p.finalizados.protocolos), sub: pct(p.finalizados.pct) },
    { rotulo: "Em aberto", valor: num(p.abertos.protocolos), sub: pct(p.abertos.pct) },
    { rotulo: "Com avaria", valor: num(p.avaria.protocolos), sub: pct(p.avaria.pct) },
    { rotulo: "Mediana até finalizar", valor: formatHoras(p.tempos.medianaHorasFinalizar) },
  ])}
<h2>Abertos agora, por etapa</h2>
<table><thead><tr><th>Etapa</th><th class="n">Protocolos</th><th class="n">Valor</th></tr></thead><tbody>
${r.porEtapa.map((e) => `<tr><td>${esc(rotEtapa(e.etapa))}</td><td class="n">${num(e.protocolos)}</td><td class="n">${formatBRL(e.valor)}</td></tr>`).join("")}
</tbody><tfoot><tr><td>Total</td><td class="n">${num(r.abertos.length)}</td><td class="n">${formatBRL(r.valorAberto)}</td></tr></tfoot></table>
<h2>Por motorista</h2>
<table><thead><tr><th>Motorista</th><th class="n">Protocolos</th><th class="n">Abertos</th><th class="n">Com divergência</th><th class="n">Itens falta</th><th class="n">Itens sobra</th><th class="n">Itens avaria</th><th class="n">Mediana até finalizar</th></tr></thead><tbody>
${r.motoristas.map((m) => `<tr><td>${esc(m.nome)}</td><td class="n">${num(m.protocolos)}</td><td class="n">${num(m.abertos)}</td><td class="n">${num(m.comDivergencia)}</td><td class="n">${num(m.itensFalta)}</td><td class="n">${num(m.itensSobra)}</td><td class="n">${num(m.itensAvaria)}</td><td class="n">${formatHoras(m.medianaHorasFinalizar)}</td></tr>`).join("")}
</tbody></table>
<h2 class="quebra">Protocolos em aberto</h2>
<table><thead><tr><th>Protocolo</th><th>Criado</th><th>Cliente</th><th>Motorista</th><th>Etapa</th><th class="n">Aberto há</th><th class="n">Valor</th></tr></thead><tbody>
${r.abertos.map((a) => `<tr><td>${a.protocolo}</td><td>${esc(a.criado ?? "—")}</td><td>${esc(a.cliente ?? "—")}</td><td>${esc(a.motorista ?? a.rotulo ?? "—")}</td><td>${esc(rotEtapa(a.etapa))}</td><td class="n">${formatHoras(a.horasAberto)}</td><td class="n">${formatBRL(a.valor)}</td></tr>`).join("") || `<tr><td colspan="7" class="vazio">Nenhum protocolo em aberto.</td></tr>`}
</tbody></table>`;
}

// ------------------------------------------------------------------ documento

const CSS = `
@page { size: A4; margin: 14mm 12mm 16mm; @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #64748b; } }
* { box-sizing: border-box; }
body { font: 9.5pt/1.35 Arial, Helvetica, sans-serif; color: #141a4d; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header { border-bottom: 2.5pt solid #1b2168; padding-bottom: 8pt; margin-bottom: 10pt; display: flex; justify-content: space-between; align-items: flex-end; gap: 12pt; }
header h1 { font-size: 16pt; margin: 0; letter-spacing: -.2pt; }
header .marca { font-size: 8pt; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 1pt; margin-bottom: 2pt; }
header .meta { text-align: right; font-size: 8.5pt; color: #475569; }
header .meta b { color: #141a4d; }
h2 { font-size: 11pt; margin: 14pt 0 6pt; padding-bottom: 3pt; border-bottom: 1pt solid #cbd5e1; break-after: avoid; }
h2.quebra { break-before: page; }
.kpis { display: flex; gap: 6pt; margin: 4pt 0 8pt; flex-wrap: wrap; }
.kpi { flex: 1 1 0; min-width: 90pt; border: 1pt solid #e2e8f0; border-left: 3pt solid #f59e0b; border-radius: 4pt; padding: 5pt 7pt; }
.kpi-r { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5pt; color: #64748b; }
.kpi b { font-size: 11.5pt; display: block; white-space: nowrap; }
.legenda { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .6pt; color: #64748b; margin: 2pt 0 0; }
.kpi-s { font-size: 7.5pt; color: #64748b; }
table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
thead { display: table-header-group; }
tfoot { display: table-row-group; }
tr { break-inside: avoid; }
th { background: #1b2168; color: #fff; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .4pt; text-align: left; padding: 4pt 5pt; }
td { padding: 3.5pt 5pt; border-bottom: .6pt solid #e2e8f0; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f8fafc; }
tfoot td { font-weight: bold; background: #eef0fb; border-top: 1pt solid #1b2168; }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.c { text-align: center; width: 18pt; color: #94a3b8; }
.cod { color: #94a3b8; font-size: 7.5pt; font-weight: normal; }
.alto { color: #e11d48; font-weight: bold; }
.medio { color: #d97706; font-weight: bold; }
tr.pasta td { background: #eef0fb !important; border-top: 1pt solid #c7cdee; }
.rec { padding-left: 12pt; display: inline-block; }
.selo { display: inline-block; border-radius: 8pt; padding: 0 5pt; font-size: 7pt; font-weight: bold; white-space: nowrap; }
.s-log { background: #eef0fb; color: #1b2168; } .s-com { background: #fef3c7; color: #b45309; }
.s-fat { background: #ffe4e6; color: #be123c; } .s-nc { background: #f1f5f9; color: #64748b; }
.ficha { break-inside: avoid; border: 1pt solid #e2e8f0; border-radius: 5pt; padding: 7pt 8pt 4pt; margin-bottom: 8pt; }
.ficha-cab { display: flex; justify-content: space-between; gap: 8pt; align-items: baseline; flex-wrap: wrap; margin-bottom: 4pt; }
.ficha-cab > div:first-child b { font-size: 10.5pt; }
.ficha-num { display: flex; gap: 10pt; font-size: 8.5pt; color: #475569; }
.ficha-num b { color: #141a4d; }
.setores { margin: 0 0 5pt; font-size: 8pt; color: #475569; }
table.mini th { background: #f1f5f9; color: #334155; }
table.mini tbody tr:nth-child(even) td { background: transparent; }
.nota { font-size: 8pt; color: #64748b; margin: 0 0 6pt; }
.vazio { color: #94a3b8; text-align: center; padding: 10pt; }
@media screen { body { max-width: 190mm; margin: 12mm auto; } }
`;

const fmtData = (d: Date) =>
  `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

/** Documento HTML completo (A4) com cabeçalho, filtros e o corpo do relatório. */
export function documentoRelatorio(secao: string, ctx: ContextoRelatorio, corpo: string, resumo = ""): string {
  const filtros = [
    ctx.base === "faturamento" ? "Base: dia faturado" : "Base: data da devolução (rotina 111)",
    ctx.motivo ? `Motivo: ${ctx.motivo}` : "",
    ctx.setor ? `Setor: ${ctx.setor}` : "",
    ctx.cidade ? `Cidade: ${ctx.cidade}` : "",
  ].filter(Boolean);
  const titulo = `Devoluções - ${secao} - ${ctx.periodo}`.replace(/[\\/:*?"<>|]/g, "-");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>
<header><div><div class="marca">DIA · Centro de Controle Logístico</div><h1>Devoluções — ${esc(secao)}</h1></div>
<div class="meta">Período <b>${esc(ctx.periodo)}</b><br>${filtros.map(esc).join(" · ")}<br>Gerado em ${esc(fmtData(ctx.geradoEm))}</div></header>
${resumo}${corpo}
</body></html>`;
}
