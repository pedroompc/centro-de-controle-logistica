import { getDevolucoesMesAtual } from "@/data/devolucoes";
import { formatBRL } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno } from "@/domain/periodo";
import type { SetorDevolucao, DevolucaoPorMotivo } from "@/domain/devolucoes";
import { PageHeader, Card, SectionTitle, StatCard } from "@/components/ui";

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

export default async function DevolucoesPage() {
  const r = await getDevolucoesMesAtual();
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

  const maxMotivo = Math.max(1, ...r.porMotivo.map((m) => m.valor));
  const accentSetor = (s: SetorDevolucao) => (s === "Logística" ? "red" : s === "Comercial" ? "gold" : "navy");

  return (
    <div>
      <PageHeader title="Devoluções" subtitle={`${mes} · filial 1 · valor bruto (rotina 1311)`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total devolvido" value={formatBRL(r.total)} hint="no mês" accent="gold" />
        {r.porSetor.map((s) => (
          <StatCard key={s.setor} label={s.setor} value={formatBRL(s.valor)} hint={`${s.notas} notas`} accent={accentSetor(s.setor)} />
        ))}
      </div>

      <section className="mt-6">
        <SectionTitle>Por motivo</SectionTitle>
        <Card className="p-5">
          {r.porMotivo.length === 0 ? (
            <p className="text-sm text-slate-400">Sem devoluções no período.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {r.porMotivo.map((m) => (
                <LinhaMotivo key={`${m.motivo}-${m.setor}`} m={m} max={maxMotivo} />
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <SectionTitle>Clientes que mais devolvem</SectionTitle>
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
                {r.topClientes.map((c) => (
                  <tr key={c.codcli} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-[#141a4d]">{c.nome}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-500">{c.notas}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-[#141a4d]">{formatBRL(c.valor)}</td>
                  </tr>
                ))}
                {r.topClientes.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">Sem devoluções no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <p className="mt-4 text-xs text-slate-400">
        Valor bruto da nota de devolução (rotina 1311). Difere do card de devolução do dashboard,
        que usa a base de faturamento líquida (rotina 111).
      </p>
    </div>
  );
}
