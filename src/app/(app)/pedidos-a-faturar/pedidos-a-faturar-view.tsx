import { Card, StatCard, SectionTitle, Pill } from "@/components/ui";
import { formatBRL, formatKg, formatDataBR } from "@/domain/format";
import type { PedidoPendente } from "@/domain/pedidos-a-faturar/tipos";

export interface ResumoPedidos {
  total: number;
  valorTotal: number;
  pesoTotal: number;
}

/** Horas paradas → "3d 1h" (ou "5h" abaixo de um dia). Tempo no sistema. */
function tempoParado(horas: number): string {
  const h = Math.floor(horas);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  const resto = h % 24;
  return resto ? `${dias}d ${resto}h` : `${dias}d`;
}

/** Rótulo do status do Winthor (POSICAO). */
function statusLabel(status: string): string {
  if (status === "L") return "Liberado";
  if (status === "M") return "Montado";
  return status;
}

export function PedidosAFaturarView({
  pedidos,
  resumo,
}: {
  pedidos: PedidoPendente[];
  resumo: ResumoPedidos;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pedidos a faturar" value={`${resumo.total}`} accent="navy" />
        <StatCard label="Valor parado" value={formatBRL(resumo.valorTotal)} accent="navy" />
        <StatCard label="Peso parado" value={formatKg(resumo.pesoTotal)} accent="navy" />
      </div>

      <Card className="p-6">
        <SectionTitle>Pedidos a faturar · do mais antigo ao mais recente</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Pedido</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Cidade</th>
                <th className="py-2 pr-3">Vendedor (RCA)</th>
                <th className="py-2 pr-3">Supervisor</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3 text-right">Peso</th>
                <th className="py-2 pr-3 text-right">Tempo parado</th>
                <th className="py-2 pr-3">Liberação</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.numeroPedido} className="border-b border-slate-100">
                  <td className="py-2 pr-3 tabular-nums">
                    {p.numeroPedido}
                    {p.reentrega && (
                      <span className="ml-1 text-xs font-medium text-amber-600" title="Reentrega">
                        ↩
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{p.nomeCliente}</td>
                  <td className="py-2 pr-3">
                    {p.cidadeCliente ?? "—"}
                    {p.ufCliente ? ` / ${p.ufCliente}` : ""}
                  </td>
                  <td className="py-2 pr-3">{p.nomeRca}</td>
                  <td className="py-2 pr-3">{p.nomeSupervisor ?? "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(p.valorPedido)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatKg(p.pesoPedido)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-[#141a4d]">
                    {tempoParado(p.horasParado)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{formatDataBR(p.dataLiberacao)}</td>
                  <td className="py-2 pr-3">
                    <Pill tone={p.statusWinthor === "M" ? "gold" : "navy"}>
                      {statusLabel(p.statusWinthor)}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pedidos.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">Nenhum pedido a faturar no momento.</p>
        )}
      </Card>
    </div>
  );
}
