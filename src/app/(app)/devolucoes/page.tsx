import { getDevolucoesMesAtual } from "@/data/devolucoes";
import { getResumoFaturamentoMesAtual } from "@/data/faturamento";
import { taxaDevolucao } from "@/domain/faturamento";
import { formatBRL, formatPercent } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno } from "@/domain/periodo";
import { piorMotorista } from "@/domain/devolucoes";
import type { SetorDevolucao, DevolucaoPorMotivo } from "@/domain/devolucoes";
import { PageHeader, Card, SectionTitle, StatCard } from "@/components/ui";

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

export default async function DevolucoesPage() {
  const [r, fat] = await Promise.all([getDevolucoesMesAtual(), getResumoFaturamentoMesAtual()]);
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
  const pior = piorMotorista(r.porMotorista);

  return (
    <div>
      <PageHeader title="Devoluções" subtitle={`${mes} · filial 1`} />

      {/* Números OFICIAIS = rotina 111 (os mesmos do dashboard, que o diretor usa). */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Valor devolução"
          value={fat ? formatBRL(fat.valorDevolucao) : "—"}
          hint="oficial · rotina 111"
          accent="red"
        />
        <StatCard
          label="Devolução avulsa"
          value={fat ? formatBRL(fat.valorDevolucaoAvulsa) : "—"}
          hint={fat ? `${fat.devolvidasAvulsas} NFs · sem venda de origem` : "—"}
          accent="navy"
        />
        <StatCard
          label="Taxa de devolução"
          value={fat ? formatPercent(taxaDevolucao(fat)) : "—"}
          hint="sobre a venda faturada"
          accent="gold"
        />
      </div>

      <div className="mt-8 flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
          Análise · de onde vêm
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">rotina 111 · líquido</span>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Mesma regra do card oficial (rotina 111, valor líquido, pela data da devolução). A quebra
        cobre só a devolução vinculada a uma venda — a avulsa fica isolada no card acima —, então a
        soma das partes bate com o valor de devolução.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <SectionTitle>Por motorista</SectionTitle>
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
                {r.porMotorista.map((m) => (
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
                {r.porMotorista.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Sem entregas em carga no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
        Valor líquido da devolução (rotina 111), pela data da devolução — a mesma base do dashboard.
        Na tabela de motorista, o valor devolvido é atribuído às entregas em carga saídas no período.
      </p>
    </div>
  );
}
