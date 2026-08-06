import { Card, StatCard, SectionTitle, Pill } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import type { Prioridade, Relatorio } from "@/domain/pedidos-a-faturar/tipos";

const TOM: Record<Prioridade, "red" | "gold" | "navy" | "slate"> = {
  CRITICA: "red",
  AJUSTAR_CALENDARIO: "gold",
  ALTA: "gold",
  MEDIA: "navy",
  BAIXA: "slate",
};

const ROTULO: Record<Prioridade, string> = {
  CRITICA: "Crítica",
  AJUSTAR_CALENDARIO: "Ajustar calendário",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

export function PedidosAFaturarView({ rel }: { rel: Relatorio }) {
  const { resumo, pedidos, rankingRca, rankingCidade, diagnostico } = rel;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Total parados" value={`${resumo.total}`} accent="navy" />
        <StatCard label="Críticos" value={`${resumo.criticos}`} accent="red" />
        <StatCard label="Alta" value={`${resumo.alta}`} accent="gold" />
        <StatCard label="Média" value={`${resumo.media}`} accent="navy" />
        <StatCard label="Baixa" value={`${resumo.baixa}`} accent="navy" />
        <StatCard label="Valor parado" value={formatBRL(resumo.valorTotal)} accent="navy" />
      </div>

      <Card className="p-6">
        <SectionTitle>Pedidos a faturar</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Prioridade</th>
                <th className="py-2 pr-3">Pedido</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Cidade / Rota</th>
                <th className="py-2 pr-3">RCA</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3 text-right">Horas</th>
                <th className="py-2 pr-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.numeroPedido} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3"><Pill tone={TOM[p.prioridade]}>{ROTULO[p.prioridade]}</Pill></td>
                  <td className="py-2 pr-3 tabular-nums">
                    {p.numeroPedido}{p.reentrega && <span className="ml-1 text-xs text-amber-600">↩</span>}
                  </td>
                  <td className="py-2 pr-3">{p.nomeCliente}</td>
                  <td className="py-2 pr-3">{p.cidadeCliente ?? "—"}{p.rota ? ` · ${p.rota}` : ""}</td>
                  <td className="py-2 pr-3">{p.nomeRca}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(p.valorPedido)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.horasParado.toFixed(0)}h</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{p.motivoPrioridade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Ranking por RCA</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">RCA</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Críticos</th>
                <th className="py-2 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rankingRca.map((r) => (
                <tr key={r.codigoRca} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{r.nomeRca}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.totalPedidos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.criticos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(r.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-6">
          <SectionTitle>Ranking por cidade</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Cidade</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Críticos</th>
                <th className="py-2 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rankingCidade.map((c) => (
                <tr key={c.cidade} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{c.cidade}{c.rota ? ` · ${c.rota}` : ""}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.totalPedidos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.criticos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(c.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {diagnostico.length > 0 && (
        <Card className="p-6">
          <SectionTitle>Cidades sem calendário</SectionTitle>
          <p className="mb-3 text-sm text-slate-500">
            Cidades presentes nos pedidos mas ausentes do calendário de rotas — cadastrar para melhorar a classificação.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Cidade (UF)</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3 text-right">Máx. horas</th>
                <th className="py-2 pr-3">Exemplos</th>
              </tr>
            </thead>
            <tbody>
              {diagnostico.map((d) => (
                <tr key={d.cidade} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{d.cidade}{d.uf ? ` (${d.uf})` : ""}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.totalPedidos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(d.valorTotal)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.maxHorasParado.toFixed(0)}h</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{d.exemplosNumped.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
