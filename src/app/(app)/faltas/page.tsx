import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarFaltas } from "@/data/faltas";
import { detalharFaltasDoPeriodo, rankingFaltas } from "@/domain/faltas-analise";
import { formatDataBR } from "@/domain/format";
import {
  primeiroDiaDoMes,
  formatMesAno,
  inicioFimDoMes,
  limitarAoHistorico,
} from "@/domain/periodo";
import type { TipoFalta } from "@/domain/types";
import { MesNav } from "@/components/mes-nav";
import { PageHeader, StatCard, Card, SectionTitle, BackLink, BarList, Pill } from "@/components/ui";

const TONE_TIPO: Record<TipoFalta, "red" | "gold" | "navy" | "slate"> = {
  injustificada: "red",
  justificada: "gold",
  atestado: "navy",
  folga: "slate",
  ferias: "slate",
};

const LABEL_TIPO: Record<TipoFalta, string> = {
  injustificada: "Injustificada",
  justificada: "Justificada",
  atestado: "Atestado",
  folga: "Folga",
  ferias: "Férias",
};

function TipoPill({ tipo }: { tipo: TipoFalta }) {
  return <Pill tone={TONE_TIPO[tipo]}>{LABEL_TIPO[tipo]}</Pill>;
}

export default async function FaltasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const mesAtual = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mesAtual < primeiroDiaDoMes();
  const { inicio, fim } = inicioFimDoMes(mesAtual);

  const [funcionarios, setores, faltas] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarFaltas(),
  ]);
  const setorNome = new Map(setores.map((s) => [s.id, s.nome]));

  const detalhe = detalharFaltasDoPeriodo(faltas, funcionarios, inicio, fim);
  const ranking = rankingFaltas(faltas, funcionarios);

  const injustificadasMes = detalhe.filter((d) => d.tipo === "injustificada").length;
  const rankingItems = ranking.map((r) => ({
    label: `${r.nome} · ${setorNome.get(r.setorId) ?? "—"}`,
    value: r.total,
    display: `${r.total} falta${r.total === 1 ? "" : "s"}`,
    href: `/funcionarios/${r.funcionarioId}`,
  }));

  return (
    <div>
      <BackLink href={`/?mes=${mesAtual}`}>Visão geral</BackLink>
      <PageHeader
        title="Faltas"
        subtitle={`${formatMesAno(mesAtual)}${mesFechado ? " · mês fechado" : " · em andamento"}`}
      >
        <MesNav mes={mesAtual} hrefFor={(m) => `/faltas?mes=${m}`} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Faltas no mês" value={`${detalhe.length}`} hint="todos os tipos" accent="red" />
        <StatCard label="Injustificadas no mês" value={`${injustificadasMes}`} accent="red" />
        <StatCard label="Pessoas com falta no mês" value={`${new Set(detalhe.map((d) => d.funcionarioId)).size}`} accent="navy" />
      </div>

      <section className="mt-8">
        <SectionTitle>Quem faltou em {formatMesAno(mesAtual)}</SectionTitle>
        <Card className="overflow-hidden">
          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data</th>
                  <th className="px-5 py-3 font-semibold">Funcionário</th>
                  <th className="px-5 py-3 font-semibold">Setor</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 tabular-nums text-slate-700">{formatDataBR(d.data)}</td>
                    <td className="px-5 py-3">
                      <Link href={`/funcionarios/${d.funcionarioId}`} className="font-medium text-[#141a4d] hover:underline">
                        {d.funcionarioNome}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{setorNome.get(d.setorId) ?? "—"}</td>
                    <td className="px-5 py-3"><TipoPill tipo={d.tipo} /></td>
                    <td className="px-5 py-3 text-slate-500">{d.observacao ?? "—"}</td>
                  </tr>
                ))}
                {detalhe.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nenhuma falta registrada neste mês.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {detalhe.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/funcionarios/${d.funcionarioId}`} className="min-w-0 truncate font-medium text-[#141a4d]">
                    {d.funcionarioNome}
                  </Link>
                  <TipoPill tipo={d.tipo} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="tabular-nums">{formatDataBR(d.data)}</span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{setorNome.get(d.setorId) ?? "—"}</span>
                </div>
                {d.observacao && <p className="mt-1 text-xs text-slate-500">{d.observacao}</p>}
              </li>
            ))}
            {detalhe.length === 0 && (
              <li className="px-4 py-8 text-center text-slate-400">Nenhuma falta registrada neste mês.</li>
            )}
          </ul>
        </Card>
      </section>

      <section className="mt-8">
        <SectionTitle>Ranking geral de faltas (todos os períodos)</SectionTitle>
        <Card className="p-6">
          <p className="mb-4 text-xs text-slate-400">
            Conta ausências reais (injustificada, justificada e atestado). Férias e folga não entram no ranking.
          </p>
          <BarList items={rankingItems} tone="navy" />
        </Card>
      </section>
    </div>
  );
}
