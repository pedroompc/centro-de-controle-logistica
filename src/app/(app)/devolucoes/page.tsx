import Link from "next/link";
import { getDevolucoesMesAtual, listarMotivosDoMes } from "@/data/devolucoes";
import { getResumoFaturamentoMesAtual } from "@/data/faturamento";
import { taxaDevolucao, taxaDevolucaoNotas } from "@/domain/faturamento";
import { formatBRL, formatPercent } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno } from "@/domain/periodo";
import { piorMotorista } from "@/domain/devolucoes";
import type { SetorDevolucao, DevolucaoPorMotivo } from "@/domain/devolucoes";
import { PageHeader, Card, SectionTitle, StatCard } from "@/components/ui";

// Quantas linhas cada seção mostra antes do "ver todos".
const TOP_MOTIVOS = 8;
const TOP_MOTORISTAS = 8;
const TOP_CLIENTES = 5;

const SETORES: SetorDevolucao[] = ["Logística", "Comercial", "Faturamento", "Não classificado"];

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

// Cor da taxa de devolução por severidade.
function corTaxa(taxa: number) {
  if (taxa >= 15) return "text-rose-600";
  if (taxa >= 8) return "text-amber-600";
  return "text-slate-500";
}

// Cor da barra/etiqueta por setor responsável.
const CORES: Record<SetorDevolucao, { barra: string; pill: string }> = {
  "Logística": { barra: "bg-[#1b2168]", pill: "bg-[#eef0fb] text-[#1b2168]" },
  "Comercial": { barra: "bg-amber-400", pill: "bg-amber-50 text-amber-700" },
  "Faturamento": { barra: "bg-rose-400", pill: "bg-rose-50 text-rose-700" },
  "Não classificado": { barra: "bg-slate-300", pill: "bg-slate-100 text-slate-500" },
};

function LinhaMotivo({ m, max }: { m: DevolucaoPorMotivo; max: number }) {
  const pct = Math.max(2, Math.round((m.valor / max) * 100));
  const cor = CORES[m.setor];
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-[#141a4d]" title={m.motivo}>{m.motivo}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cor.pill}`}>{m.setor}</span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(m.valor)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-16 shrink-0 text-right text-xs text-slate-400">{m.notas} notas</span>
      </div>
    </div>
  );
}

/** Cabeçalho de seção com "X de Y" e o link ver todos / ver menos. */
function CabecalhoSecao({
  titulo, mostrados, total, href, expandido,
}: {
  titulo: string; mostrados: number; total: number; href: string; expandido: boolean;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <SectionTitle>{titulo}</SectionTitle>
      <div className="flex items-baseline gap-3">
        {total > 0 && <span className="text-xs text-slate-400">{mostrados} de {total}</span>}
        {total > mostrados || expandido ? (
          <Link href={href} className="text-xs font-medium text-amber-600 hover:text-amber-700">
            {expandido ? "ver menos" : "ver todos"}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function DevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; setor?: string; motorista?: string; expandir?: string }>;
}) {
  const sp = await searchParams;
  const motivo = sp.motivo || undefined;
  const setor = sp.setor || undefined;
  const buscaMotorista = (sp.motorista ?? "").trim();
  const expandir = sp.expandir;
  const temFiltro = Boolean(motivo || setor || buscaMotorista);

  const [r, fat, motivosDisponiveis] = await Promise.all([
    getDevolucoesMesAtual(motivo, setor),
    getResumoFaturamentoMesAtual(),
    listarMotivosDoMes(),
  ]);
  const mes = formatMesAno(primeiroDiaDoMes());

  if (!r) {
    return (
      <div>
        <PageHeader title="Devoluções" subtitle={`${mes} · Winthor`} />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Devoluções indisponíveis — sem conexão com o Winthor (o banco só responde de dentro
            da rede da empresa).
          </p>
        </Card>
      </div>
    );
  }

  // Monta URL preservando os filtros vigentes; `over` sobrescreve/limpa chaves.
  const url = (over: Record<string, string | undefined>) => {
    const atual: Record<string, string | undefined> = {
      motivo, setor, motorista: buscaMotorista || undefined, expandir, ...over,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/devolucoes?${qs}` : "/devolucoes";
  };

  // Busca de motorista: filtro por nome, em memória (não faz sentido propagar
  // para motivo/clientes).
  const motoristasFiltrados = buscaMotorista
    ? r.porMotorista.filter((m) => m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()))
    : r.porMotorista;

  const motivosVis = expandir === "motivos" ? r.porMotivo : r.porMotivo.slice(0, TOP_MOTIVOS);
  const motoristasVis = expandir === "motoristas" ? motoristasFiltrados : motoristasFiltrados.slice(0, TOP_MOTORISTAS);
  const clientesVis = expandir === "clientes" ? r.topClientes : r.topClientes.slice(0, TOP_CLIENTES);

  const maxMotivo = Math.max(1, ...r.porMotivo.map((m) => m.valor));
  const accentSetor = (s: SetorDevolucao) => (s === "Logística" ? "red" : s === "Comercial" ? "gold" : "navy");
  const pior = piorMotorista(motoristasFiltrados);

  return (
    <div>
      <PageHeader title="Devoluções" subtitle={`${mes} · filiais 1 e 11`} />

      {/* Números OFICIAIS do mês = rotina 111. NÃO reagem ao filtro (âncora). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor devolução" value={formatBRL(r.total)} hint="= soma por setor · ~igual ao 111" accent="red" />
        <StatCard
          label="Devolução avulsa"
          value={fat ? formatBRL(fat.valorDevolucaoAvulsa) : "—"}
          hint={fat ? `${fat.devolvidasAvulsas} NFs · sem venda de origem` : "—"}
          accent="navy"
        />
        <StatCard
          label="Taxa de devolução (valor)"
          value={fat ? formatPercent(taxaDevolucao(fat)) : "—"}
          hint="R$ devolvido / venda faturada"
          accent="gold"
        />
        <StatCard
          label="Taxa de devolução (notas)"
          value={fat ? formatPercent(taxaDevolucaoNotas(fat)) : "—"}
          hint={fat ? `${fat.devolvidas} de ${fat.emitidas} NFs emitidas` : "—"}
          accent="gold"
        />
      </div>

      <div className="mt-8 mb-4 flex items-baseline gap-3">
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
          Análise · de onde vêm
        </h2>
        {temFiltro && (
          <Link href="/devolucoes" className="text-xs font-medium text-amber-600 hover:text-amber-700">limpar filtros</Link>
        )}
      </div>

      {/* Filtro: motivo/setor vão no SQL (estreitam as 3 seções); motorista é busca por nome. */}
      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap gap-2">
          <select name="motivo" defaultValue={motivo ?? ""} className={`${inputCls} min-w-[12rem] flex-1`}>
            <option value="">Todos os motivos</option>
            {motivosDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select name="setor" defaultValue={setor ?? ""} className={inputCls}>
            <option value="">Todos os setores</option>
            {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input name="motorista" defaultValue={buscaMotorista} placeholder="Buscar motorista" className={`${inputCls} min-w-[10rem]`} />
          <button className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            Filtrar
          </button>
        </form>
      </Card>

      {/* Cards de setor — clicáveis: viram atalho de filtro. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {r.porSetor.map((s) => (
          <StatCard
            key={s.setor}
            label={s.setor}
            value={formatBRL(s.valor)}
            hint={`${s.notas} notas`}
            accent={accentSetor(s.setor)}
            href={url({ setor: setor === s.setor ? undefined : s.setor, expandir: undefined })}
          />
        ))}
      </div>

      <section className="mt-6">
        <CabecalhoSecao
          titulo="Por motivo"
          mostrados={motivosVis.length}
          total={r.porMotivo.length}
          expandido={expandir === "motivos"}
          href={url({ expandir: expandir === "motivos" ? undefined : "motivos" })}
        />
        <Card className="p-5">
          {motivosVis.length === 0 ? (
            <p className="text-sm text-slate-400">Sem devoluções no período.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {motivosVis.map((m) => (
                <LinhaMotivo key={`${m.motivo}-${m.setor}`} m={m} max={maxMotivo} />
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <CabecalhoSecao
          titulo="Por motorista"
          mostrados={motoristasVis.length}
          total={motoristasFiltrados.length}
          expandido={expandir === "motoristas"}
          href={url({ expandir: expandir === "motoristas" ? undefined : "motoristas" })}
        />
        {pior && (
          <p className="mb-3 text-sm text-slate-500">
            Maior taxa (com 50+ entregas):{" "}
            <span className="font-semibold text-rose-600">{pior.nome}</span> —{" "}
            {formatPercent(pior.taxa / 100)} ({pior.devolvidas} de {pior.expedidas}).
          </p>
        )}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Motorista</th>
                  <th className="px-5 py-3 font-semibold text-right">Entregas</th>
                  <th className="px-5 py-3 font-semibold text-right">Devolvidas</th>
                  <th className="px-5 py-3 font-semibold text-right">Taxa</th>
                  <th className="px-5 py-3 font-semibold text-right">Valor devolvido</th>
                </tr>
              </thead>
              <tbody>
                {motoristasVis.map((m) => (
                  <tr key={m.codMotorista} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-[#141a4d]">{m.nome}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-500">{m.expedidas}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-500">{m.devolvidas}</td>
                    <td className={`px-5 py-3 text-right tabular-nums font-semibold ${corTaxa(m.taxa)}`}>
                      {formatPercent(m.taxa / 100)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-[#141a4d]">{formatBRL(m.valorDevolvido)}</td>
                  </tr>
                ))}
                {motoristasVis.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    {buscaMotorista ? `Nenhum motorista encontrado para "${buscaMotorista}".` : "Sem entregas em carga no período."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <CabecalhoSecao
          titulo="Clientes que mais devolvem"
          mostrados={clientesVis.length}
          total={r.topClientes.length}
          expandido={expandir === "clientes"}
          href={url({ expandir: expandir === "clientes" ? undefined : "clientes" })}
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-5 py-3 font-semibold">Notas</th>
                  <th className="px-5 py-3 font-semibold text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {clientesVis.map((c) => (
                  <tr key={c.codcli} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-[#141a4d]">{c.nome}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-500">{c.notas}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-[#141a4d]">{formatBRL(c.valor)}</td>
                  </tr>
                ))}
                {clientesVis.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">Sem devoluções no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <p className="mt-4 text-xs text-slate-400">
        Os indicadores no topo são sempre o total do mês (não reagem ao filtro). Motivo e setor
        estreitam as três seções; a busca de motorista filtra só a tabela de motoristas.
        Valor líquido da devolução (rotina 111), pela data da devolução.
      </p>
    </div>
  );
}
