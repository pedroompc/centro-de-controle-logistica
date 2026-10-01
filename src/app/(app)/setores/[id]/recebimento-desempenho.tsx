import { Card, SectionTitle, StatCard, BarList } from "@/components/ui";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { formatMesAno, primeiroDiaDoMes } from "@/domain/periodo";
import { ehMelhorDaJanela, type IndicadoresRecebimento, type IndicadorComparavel } from "@/domain/recebimento";
import type { AnaliseRecebimento } from "./recebimento-dados";

const inteiro = new Intl.NumberFormat("pt-BR");
const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const t = (kg: number) => `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} t`;

type Linha = {
  rotulo: string;
  ajuda?: string;
  valor: (r: IndicadoresRecebimento) => number | null;
  fmt: (v: number) => string;
  comparar?: IndicadorComparavel; // verde no melhor mês do trimestre
};

// Grupos da tabela mês a mês — volume, dinheiro e pessoas, nessa ordem.
const GRUPOS: { titulo: string; linhas: Linha[] }[] = [
  {
    titulo: "Volume",
    linhas: [
      { rotulo: "Carros descarregados", valor: (r) => r.carros, fmt: (v) => inteiro.format(v) },
      { rotulo: "Peso descarregado", valor: (r) => r.pesoKg, fmt: t },
      { rotulo: "Dias de descarrego", valor: (r) => r.diasDescarrego, fmt: (v) => inteiro.format(v) },
      { rotulo: "Carros por dia", valor: (r) => r.carrosPorDia, fmt: dec1, comparar: "carrosPorDia" },
      { rotulo: "Kg por carro", valor: (r) => r.kgPorCarro, fmt: (v) => formatKg(v) },
    ],
  },
  {
    titulo: "Dinheiro",
    linhas: [
      { rotulo: "Receita de descarrego", valor: (r) => r.receitaDescarrego, fmt: formatBRL },
      { rotulo: "Custo do recebimento", ajuda: "folha + empilhador + empilhadeira", valor: (r) => r.equipe.custo, fmt: formatBRL },
      { rotulo: "Resultado", ajuda: "descarrego − custo", valor: (r) => r.resultado, fmt: formatBRL, comparar: "resultado" },
      { rotulo: "Margem", ajuda: "resultado ÷ descarrego", valor: (r) => r.margem, fmt: (v) => formatPercent(v), comparar: "margem" },
      { rotulo: "Custo / descarrego", valor: (r) => r.custoSobreDescarrego, fmt: (v) => formatPercent(v), comparar: "custoSobreDescarrego" },
      { rotulo: "Custo / faturamento líquido", valor: (r) => r.custoSobreFaturamento, fmt: (v) => formatPercent(v, 2), comparar: "custoSobreFaturamento" },
      { rotulo: "Receita por tonelada", valor: (r) => r.receitaPorTonelada, fmt: formatBRL, comparar: "receitaPorTonelada" },
      { rotulo: "Custo por tonelada", valor: (r) => r.custoPorTonelada, fmt: formatBRL, comparar: "custoPorTonelada" },
    ],
  },
  {
    titulo: "Pessoas",
    linhas: [
      { rotulo: "Equipe", ajuda: "ajudantes · conferentes · empilhador", valor: (r) => r.equipe.total, fmt: (v) => inteiro.format(v) },
      { rotulo: "Kg por ajudante", valor: (r) => r.kgPorAjudante, fmt: t, comparar: "kgPorAjudante" },
      { rotulo: "Kg por ajudante por dia", valor: (r) => r.kgPorAjudanteDia, fmt: (v) => formatKg(v), comparar: "kgPorAjudanteDia" },
      { rotulo: "Carros por conferente", valor: (r) => r.carrosPorConferente, fmt: (v) => inteiro.format(Math.round(v)), comparar: "carrosPorConferente" },
      { rotulo: "Kg por conferente", valor: (r) => r.kgPorConferente, fmt: t, comparar: "kgPorConferente" },
    ],
  },
];

/** Aba Desempenho do setor Recebimento: o mês a mês detalhado. */
export function RecebimentoDesempenho({ dados }: { dados: AnaliseRecebimento }) {
  const { serie, perfil, dias, linhas, empilhador } = dados;
  const fechados = serie.filter((r) => r.fracaoMes >= 1);
  const ref = fechados.at(-1) ?? serie.at(-1);
  if (!ref) return <Card className="p-8 text-center text-slate-400">Sem dados de recebimento ainda.</Card>;
  const janela = fechados.slice(-3); // o trimestre fechado
  const estimada = serie.some((r) => r.equipeEstimada);

  const custoGrupo = (g: string) => linhas.find((l) => l.grupo === g)?.custoAtivos ?? 0;
  const composicao = [
    { label: "Ajudantes", value: custoGrupo("ajudante") },
    { label: "Conferentes", value: custoGrupo("conferente") },
    { label: "Outros do setor", value: custoGrupo("outros") },
    { label: "Empilhador", value: ref.equipe.custoEmpilhador ?? 0 },
    { label: "Empilhadeira", value: ref.equipe.custoEmpilhadeira ?? 0 },
  ].filter((c) => c.value > 0);

  const ultimos = dias.slice(-30);
  const maxDia = Math.max(1, ...ultimos.map((d) => d.carros));

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm text-slate-500">
          Referência: <strong className="text-[#141a4d]">{formatMesAno(ref.mes)}</strong>
          {ref.fracaoMes < 1 ? " (em andamento)" : " (último mês fechado)"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Custo do recebimento" value={formatBRL(ref.equipe.custo)} hint={`${ref.equipe.total} pessoas + empilhadeira`} accent="gold" />
          <StatCard label="Resultado" value={formatBRL(ref.resultado)} hint={`margem ${ref.margem === null ? "—" : formatPercent(ref.margem)}`} accent="green" />
          <StatCard label="Custo / descarrego" value={ref.custoSobreDescarrego === null ? "—" : formatPercent(ref.custoSobreDescarrego)} hint="quanto da receita a equipe consome" />
          <StatCard label="Kg por ajudante / dia" value={ref.kgPorAjudanteDia === null ? "—" : formatKg(ref.kgPorAjudanteDia)} hint={`${ref.equipe.ajudantes} ajudantes · ${ref.diasDescarrego} dias`} />
          <StatCard label="Carros por conferente" value={ref.carrosPorConferente === null ? "—" : inteiro.format(Math.round(ref.carrosPorConferente))} hint={`${ref.equipe.conferentes} conferentes`} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <SectionTitle>Mês a mês</SectionTitle>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> melhor do trimestre fechado
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Indicador</th>
                {serie.map((r) => (
                  <th key={r.mes} className="px-5 py-3 text-right font-semibold">
                    {formatMesAno(r.mes)}
                    {r.fracaoMes < 1 && <span className="ml-1 normal-case tracking-normal text-amber-600">parcial</span>}
                  </th>
                ))}
              </tr>
            </thead>
            {GRUPOS.map((g) => (
              <tbody key={g.titulo}>
                <tr>
                  <td colSpan={serie.length + 1} className="bg-slate-50/40 px-5 pb-1 pt-4 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-amber-600">
                    {g.titulo}
                  </td>
                </tr>
                {g.linhas.map((l) => (
                  <tr key={l.rotulo} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-[#141a4d]">{l.rotulo}</div>
                      {l.ajuda && <div className="text-xs text-slate-400">{l.ajuda}</div>}
                    </td>
                    {serie.map((r) => {
                      const v = l.valor(r);
                      const melhor = !!l.comparar && janela.some((x) => x.mes === r.mes) && ehMelhorDaJanela(janela, r.mes, l.comparar);
                      return (
                        <td key={r.mes} className={`px-5 py-2.5 text-right tabular-nums ${melhor ? "font-bold text-emerald-600" : "text-slate-700"}`}>
                          <span className="inline-flex items-center gap-1.5">
                            {melhor && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="melhor do trimestre" />}
                            {v === null ? <span className="text-slate-300">—</span> : l.fmt(v)}
                          </span>
                          {l.rotulo === "Equipe" && (
                            <div className="text-xs text-slate-400">
                              {r.equipe.ajudantes} · {r.equipe.conferentes} · {r.equipe.empilhadores ?? 0}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="px-5 py-4 text-xs text-slate-400">
          Médias da equipe (peso ÷ pessoas do cargo), não por pessoa. No mês parcial o custo entra proporcional aos dias corridos.
          {estimada && " Meses sem foto mensal por cargo usam a equipe de hoje (estimativa)."}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Do que é feito o custo · {formatMesAno(primeiroDiaDoMes())}</SectionTitle>
          <BarList items={composicao.map((c) => ({ label: c.label, value: c.value, display: formatBRL(c.value) }))} />
          {empilhador.candidatos === 0 && (
            <p className="mt-3 text-xs text-amber-600">Nenhum funcionário ativo com cargo de máquina/empilhadeira — só o custo da máquina entrou.</p>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle>Ritmo diário</SectionTitle>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="font-[family-name:var(--font-sora)] text-2xl font-extrabold text-[#141a4d]">{dec1(perfil.media)}</div>
              <div className="text-xs text-slate-500">carros num dia comum</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-2xl font-extrabold text-[#141a4d]">{dec1(perfil.p90)}</div>
              <div className="text-xs text-slate-500">num dia forte (9 em 10 dias ficam abaixo)</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-2xl font-extrabold text-[#141a4d]">{inteiro.format(perfil.pico)}</div>
              <div className="text-xs text-slate-500">
                maior dia{perfil.diaPico ? ` · ${perfil.diaPico.slice(8, 10)}/${perfil.diaPico.slice(5, 7)}` : ""}
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Últimos {ultimos.length} dias com descarrego</div>
          <div className="mt-2 flex h-28 items-end gap-[3px]">
            {ultimos.map((d) => (
              <div key={d.data} className="group relative flex h-full flex-1 items-end" title={`${d.data.slice(8, 10)}/${d.data.slice(5, 7)}: ${d.carros} carros`}>
                <div className={`w-full rounded-t ${d.carros >= perfil.p90 ? "bg-amber-400" : "bg-[#2a327f]/70"}`} style={{ height: `${Math.max(4, (d.carros / maxDia) * 100)}%` }} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Em âmbar, os dias fortes (no nível do dia forte ou acima).</p>
        </Card>
      </div>
    </div>
  );
}
