import Link from "next/link";
import { Suspense } from "react";
import { getPainelGestao, getEvolucaoGestao } from "@/data/gestao";
import {
  INDICADORES, comparar, mesAnoAnterior,
  type Indicador, type Formato, type Comparacao, type MesGestao,
} from "@/domain/gestao";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno } from "@/domain/periodo";
import { formatBRL, formatPercent } from "@/domain/format";
import { Card, SectionTitle } from "@/components/ui";

// Primeiro mês navegável: a comparação anual precisa do WinThor de 12 meses antes.
const MES_MINIMO = "2025-01-01";

// Os números do topo: serviço, qualidade e eficiência — o que diz se a operação melhorou.
const DESTAQUES = ["d1", "d3", "devLog", "devolucao", "movTon", "peso"];

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotulo = (mes: string) => {
  const [ano, m] = mes.split("-").map(Number);
  return `${MES_ABREV[m - 1]}/${String(ano).slice(2)}`;
};

const dec = (v: number, c = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

function formatar(v: number | null, f: Formato, compacto = false): string {
  if (v === null || !Number.isFinite(v)) return "—";
  switch (f) {
    case "brl": return compacto && Math.abs(v) >= 1e6 ? `R$ ${dec(v / 1e6)} mi` : formatBRL(v);
    case "toneladas": return `${dec(v / 1000)} t`;
    case "inteiro": return Math.round(v).toLocaleString("pt-BR");
    case "percent": return formatPercent(v);
    case "decimal": return dec(v, v < 10 ? 2 : 1);
    case "horas": return v < 1 ? `${Math.round(v * 60)} min` : `${dec(v)} h`;
  }
}

// Abaixo da última casa exibida a variação é zero: "−0,0" sugeriria uma piora que não existe.
const irrelevante = (c: Comparacao, ind: Indicador) =>
  c.delta !== null && Math.abs(c.delta) < (ind.comparacao === "pp" ? 0.05 : 0.0005);

function textoDelta(c: Comparacao, ind: Indicador): string {
  if (c.delta === null) return "—";
  const sinal = irrelevante(c, ind) ? "" : c.delta > 0 ? "+" : "−";
  return ind.comparacao === "pp"
    ? `${sinal}${dec(Math.abs(c.delta))} p.p.`
    : `${sinal}${formatPercent(Math.abs(c.delta))}`;
}

// Regra de identidade do app: variação boa fica neutra; só a ruim ganha cor.
const corDelta = (c: Comparacao, ind: Indicador) =>
  c.delta === null ? "text-slate-300" : c.bom === false && !irrelevante(c, ind) ? "text-rose-600" : "text-slate-500";

const seta = (c: Comparacao, ind: Indicador) =>
  c.delta === null || irrelevante(c, ind) ? "" : c.delta > 0 ? "↑ " : "↓ ";

/** Mês da aba Gestão: padrão = último mês fechado, limitado a [MES_MINIMO, mês atual]. */
export function mesGestao(param?: string): string {
  const atual = primeiroDiaDoMes();
  let mes = param ? primeiroDiaDoMes(param) : mesAnterior(atual);
  if (mes > atual) mes = atual;
  if (mes < MES_MINIMO) mes = MES_MINIMO;
  return mes;
}

const hrefGestao = (mes: string, evolucao = false) =>
  `/galpao?aba=gestao&mes=${mes}${evolucao ? "&evolucao=1" : ""}`;

/**
 * Aba "Gestão": o mês contra o anterior e contra o mesmo mês do ano passado.
 * Lê só esses 3 meses; a evolução de 13 meses carrega apenas quando pedida.
 */
export async function Gestao({ mes, evolucao }: { mes: string; evolucao: boolean }) {
  const parcial = mes === primeiroDiaDoMes();
  const { serie, indisponivel, primeiroMesFaltas } = await getPainelGestao(mes);
  const porMes = new Map(serie.map((m) => [m.mes, m]));
  const mAtual = porMes.get(mes);
  const mAnt = porMes.get(mesAnterior(mes));
  const mAno = porMes.get(mesAnoAnterior(mes));
  const grupos = [...new Set(INDICADORES.map((i) => i.grupo))];

  return (
    <div>
      <p className="mb-6 text-sm text-slate-500">
        {formatMesAno(mes)}{parcial ? " (em andamento)" : ""} · comparado com {rotulo(mesAnterior(mes))} e {rotulo(mesAnoAnterior(mes))}
      </p>

      {indisponivel.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">
            Parte dos dados não carregou ({indisponivel.join(", ")}). Onde faltar dado aparece “—”, nunca zero.
          </p>
        </Card>
      )}
      {parcial && (
        <Card className="mb-6 p-4">
          <p className="text-sm text-slate-600">
            Mês em andamento: volumes (pedidos, peso, entregas, movimentos) ainda vão crescer e não são comparáveis
            com meses fechados. Taxas e percentuais já são.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DESTAQUES.map((id) => {
          const ind = INDICADORES.find((i) => i.id === id)!;
          return <CardDestaque key={id} ind={ind} atual={mAtual} ant={mAnt} ano={mAno} />;
        })}
      </div>

      <div className="mt-8">
        <SectionTitle>Quadro comparativo</SectionTitle>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 text-left font-semibold">Indicador</th>
              <th className="px-3 py-3 text-right font-semibold text-[#141a4d]">{rotulo(mes)}</th>
              <th className="px-3 py-3 text-right font-semibold">{rotulo(mesAnterior(mes))}</th>
              <th className="px-3 py-3 text-right font-semibold">vs mês ant.</th>
              <th className="px-3 py-3 text-right font-semibold">{rotulo(mesAnoAnterior(mes))}</th>
              <th className="px-3 py-3 text-right font-semibold">vs ano ant.</th>
            </tr>
          </thead>
          {grupos.map((g) => (
            <tbody key={g} className="tabular-nums">
              <tr>
                <td colSpan={6} className="bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{g}</td>
              </tr>
              {INDICADORES.filter((i) => i.grupo === g).map((ind) => {
                const cm = comparar(ind, mAtual, mAnt);
                const ca = comparar(ind, mAtual, mAno);
                return (
                  <tr key={ind.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 text-slate-700" title={ind.ajuda}>{ind.nome}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#141a4d]">{formatar(cm.valor, ind.formato)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{formatar(cm.base, ind.formato)}</td>
                    <td className={`px-3 py-2.5 text-right text-xs font-semibold ${corDelta(cm, ind)}`}>{seta(cm, ind)}{textoDelta(cm, ind)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{formatar(ca.base, ind.formato)}</td>
                    <td className={`px-3 py-2.5 text-right text-xs font-semibold ${corDelta(ca, ind)}`}>{seta(ca, ind)}{textoDelta(ca, ind)}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </Card>

      <div className="mt-8">
        <SectionTitle>Evolução — 13 meses</SectionTitle>
      </div>
      {evolucao ? (
        <Suspense fallback={<Card className="p-5"><p className="text-sm text-slate-500">Carregando 13 meses…</p></Card>}>
          <Evolucao mes={mes} />
        </Suspense>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-slate-600">
            A série de 13 meses é mais pesada: meses que o app ainda não guardou são calculados no WinThor, um de cada vez.
          </p>
          <Link href={hrefGestao(mes, true)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50">
            Carregar evolução
          </Link>
        </Card>
      )}

      <Card className="mt-6 p-5">
        <SectionTitle>Como ler e o que ainda falta</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li><b>Taxas</b> (%, devolução, D+1) comparam em <b>pontos percentuais</b>; volumes, em % de variação. Seta vermelha = piorou. Variação boa fica cinza.</li>
          <li><b>Serviço</b>: dias de calendário entre a liberação do pedido (WinThor) e a primeira nota autorizada na SEFAZ. Pedido = venda VP/VV das filiais do app.</li>
          <li><b>Armazém</b> começa quando o Harpia entrou em uso; antes disso aparece “—”. <b>Faltas</b> começam em {primeiroMesFaltas ? rotulo(primeiroMesFaltas) : "—"} (primeiro lançamento no app).</li>
          <li><b>Ainda não está aqui</b>: custo logístico por mês (o app guarda o salário de hoje, não o de cada mês), erro de separação e o tempo de cada etapa dentro do galpão — dependem das validações do WMS em andamento.</li>
        </ul>
      </Card>
    </div>
  );
}

/** Tabela de 13 meses (sem devolução logística — a quebra por motivo mês a mês pesaria demais). */
async function Evolucao({ mes }: { mes: string }) {
  const { serie } = await getEvolucaoGestao(mes);
  const indicadores = INDICADORES.filter((i) => i.id !== "devLog");
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[1300px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
            <th className="sticky left-0 min-w-[220px] bg-white px-4 py-3 text-left font-semibold">Indicador</th>
            {serie.map((m) => (
              <th key={m.mes} className={`px-2.5 py-3 text-right font-semibold ${m.mes === mes ? "text-[#141a4d]" : ""}`}>
                {rotulo(m.mes)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {indicadores.map((ind) => (
            <tr key={ind.id} className="border-b border-slate-50 last:border-0">
              <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-2 text-slate-700" title={ind.ajuda}>{ind.nome}</td>
              {serie.map((m: MesGestao) => (
                <td key={m.mes} className={`whitespace-nowrap px-2.5 py-2 text-right ${m.mes === mes ? "font-semibold text-[#141a4d]" : "text-slate-500"}`}>
                  {formatar(ind.valor(m), ind.formato, true)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function CardDestaque({ ind, atual, ant, ano }: {
  ind: Indicador; atual?: MesGestao; ant?: MesGestao; ano?: MesGestao;
}) {
  const cm = comparar(ind, atual, ant);
  const ca = comparar(ind, atual, ano);
  return (
    <Card className="p-5">
      <span className="text-sm font-medium text-slate-500" title={ind.ajuda}>{ind.nome}</span>
      <p className="mt-3 font-[family-name:var(--font-sora)] text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums text-[#141a4d]">
        {formatar(cm.valor, ind.formato)}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={`font-semibold ${corDelta(cm, ind)}`}>{seta(cm, ind)}{textoDelta(cm, ind)} <span className="font-normal text-slate-400">vs mês ant.</span></span>
        <span className={`font-semibold ${corDelta(ca, ind)}`}>{seta(ca, ind)}{textoDelta(ca, ind)} <span className="font-normal text-slate-400">vs ano ant.</span></span>
      </div>
    </Card>
  );
}

const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 transition hover:bg-slate-50";
const btnOff = "rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-slate-300";

/** ◀ Mês ▶ da aba Gestão: vai além do piso da navegação global (o WinThor tem mais histórico). */
export function NavMesGestao({ mes }: { mes: string }) {
  const atual = primeiroDiaDoMes();
  return (
    <div className="flex items-center gap-1">
      {mes > MES_MINIMO
        ? <Link href={hrefGestao(mesAnterior(mes))} aria-label="Mês anterior" className={btn}>◀</Link>
        : <span aria-hidden className={btnOff}>◀</span>}
      <span className="min-w-[7rem] text-center text-sm font-semibold text-[#141a4d]">{formatMesAno(mes)}</span>
      {mes < atual
        ? <Link href={hrefGestao(mesProximo(mes))} aria-label="Próximo mês" className={btn}>▶</Link>
        : <span aria-hidden className={btnOff}>▶</span>}
    </div>
  );
}
