import Link from "next/link";
import { getDevolucoes, listarMotivosDoMes } from "@/data/devolucoes";
import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { taxaDevolucao, taxaDevolucaoNotas } from "@/domain/faturamento";
import { formatBRL, formatPercent } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno, inicioFimDoMes, limitarAoHistorico } from "@/domain/periodo";
import type { SetorDevolucao, DevolucaoPorMotivo } from "@/domain/devolucoes";
import { PageHeader, Card, StatCard, PanelHeader } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";
import PainelClientes from "./painel-clientes";
import TabelaMotoristas from "./tabela-motoristas";
import { IconeEtiqueta } from "./icons";

const SETORES: SetorDevolucao[] = ["Logística", "Comercial", "Faturamento", "Não classificado"];

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

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
    <div className="px-5 py-2.5">
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

export default async function DevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; motivo?: string; setor?: string }>;
}) {
  const sp = await searchParams;
  const mesSel = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mesSel < primeiroDiaDoMes();
  // Intervalo do mês inteiro; no mês corrente não há devolução datada no futuro,
  // então o `fim` no fim do mês equivale a "1º → hoje".
  const { inicio, fim } = inicioFimDoMes(mesSel);
  const motivo = sp.motivo || undefined;
  const setor = sp.setor || undefined;
  const temFiltro = Boolean(motivo || setor);

  const [r, fat, motivosDisponiveis] = await Promise.all([
    getDevolucoes(inicio, fim, motivo, setor),
    getResumoFaturamentoDashboard(mesSel),
    listarMotivosDoMes(inicio, fim),
  ]);
  const mesLabel = `${formatMesAno(mesSel)}${mesFechado ? " · mês fechado" : " · em andamento"}`;

  // Monta URL preservando mês e filtro vigentes; `over` sobrescreve/limpa chaves.
  const url = (over: Record<string, string | undefined> = {}) => {
    const atual: Record<string, string | undefined> = {
      mes: mesFechado ? mesSel : undefined, // mês corrente = URL limpa
      motivo, setor, ...over,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/devolucoes?${qs}` : "/devolucoes";
  };

  if (!r) {
    return (
      <div>
        <PageHeader title="Devoluções" subtitle={`${mesLabel} · Winthor`}>
          <MesNav mes={mesSel} hrefFor={(m) => url({ mes: m })} />
        </PageHeader>
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Devoluções indisponíveis para {formatMesAno(mesSel)} — sem conexão com o Winthor (o
            banco só responde de dentro da rede da empresa; meses passados não têm foto
            congelada).
          </p>
        </Card>
      </div>
    );
  }

  const maxMotivo = Math.max(1, ...r.porMotivo.map((m) => m.valor));
  const totalSetor = Math.max(1, r.porSetor.reduce((t, s) => t + s.valor, 0));

  return (
    <div>
      <PageHeader title="Devoluções" subtitle={`${mesLabel} · filiais 1 e 11`}>
        <MesNav mes={mesSel} hrefFor={(m) => url({ mes: m })} />
      </PageHeader>

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
          <Link href={url({ motivo: undefined, setor: undefined })} className="text-xs font-medium text-amber-600 hover:text-amber-700">limpar filtros</Link>
        )}
      </div>

      {/* Filtro: motivo/setor vão no SQL e estreitam as três seções. */}
      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap gap-2">
          {/* Preserva o mês selecionado ao submeter o filtro (GET só envia os campos do form). */}
          {mesFechado && <input type="hidden" name="mes" value={mesSel} />}
          <select name="motivo" defaultValue={motivo ?? ""} className={`${inputCls} min-w-[12rem] flex-1`}>
            <option value="">Todos os motivos</option>
            {motivosDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select name="setor" defaultValue={setor ?? ""} className={inputCls}>
            <option value="">Todos os setores</option>
            {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            Filtrar
          </button>
        </form>
      </Card>

      {/* Responsabilidade por setor: barra empilhada + cards clicáveis (filtram). */}
      <Card className="mb-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#141a4d]">Responsabilidade por setor (no período)</h3>
        <div className="mb-4 flex h-3 overflow-hidden rounded-full">
          {r.porSetor.map((s) => (
            <div
              key={s.setor}
              className={CORES[s.setor].barra}
              style={{ width: `${(s.valor / totalSetor) * 100}%` }}
              title={`${s.setor}: ${((s.valor / totalSetor) * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {r.porSetor.map((s) => {
            const pct = (s.valor / totalSetor) * 100;
            const ativo = setor === s.setor;
            return (
              <Link
                key={s.setor}
                href={url({ setor: ativo ? undefined : s.setor })}
                className={`rounded-lg border p-3 transition hover:shadow-sm ${ativo ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-200"}`}
              >
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CORES[s.setor].pill}`}>
                  {s.setor}
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold leading-none tabular-nums text-[#141a4d]">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">do valor</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{s.notas} notas · {formatBRL(s.valor)}</div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Motivo + Clientes lado a lado no desktop. */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <PanelHeader
            icon={<IconeEtiqueta />}
            tone="gold"
            title="Por motivo"
            context={`${r.porMotivo.length} motivos · por valor`}
          />
          <div className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
            {r.porMotivo.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">Sem devoluções no período.</p>
            ) : (
              r.porMotivo.map((m) => <LinhaMotivo key={`${m.motivo}-${m.setor}`} m={m} max={maxMotivo} />)
            )}
          </div>
        </Card>

        <PainelClientes clientes={r.topClientes} />
      </div>

      <div className="mt-6">
        <TabelaMotoristas motoristas={r.porMotorista} />
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Os indicadores no topo são sempre o total do mês (não reagem ao filtro). Motivo e setor
        estreitam as três seções abaixo; a busca dentro de cada painel filtra só aquele painel.
        Valor líquido da devolução (rotina 111), pela data da devolução.
      </p>
    </div>
  );
}
