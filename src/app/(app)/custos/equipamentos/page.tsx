import { listarEquipamentos, editarEquipamento, encerrarEquipamento } from "@/data/equipamentos";
import { isAdmin } from "@/data/auth";
import { formatBRL } from "@/domain/format";
import { PageHeader, Card, BackLink, StatCard } from "@/components/ui";
import { EquipamentoForm } from "./equipamento-form";

const ROTULO_TIPO = { empilhadeira: "Empilhadeira", patinha: "Patinha elétrica", outro: "Outro" } as const;
const editInput =
  "rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm tabular-nums outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

/**
 * Equipamentos do recebimento (empilhadeira, patinha elétrica…). Quantidade ×
 * custo mensal por unidade entra no custo do recebimento do Painel e de
 * Setores › Recebimento.
 */
export default async function EquipamentosPage() {
  const [lista, admin] = await Promise.all([listarEquipamentos(), isAdmin()]);
  const equipamentos = lista ?? [];
  const total = equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const unidades = equipamentos.reduce((t, e) => t + e.quantidade, 0);

  return (
    <div>
      <BackLink href="/custos">Custos</BackLink>
      <PageHeader title="Equipamentos do recebimento" subtitle="Quantidade × custo mensal por unidade — entra no custo do recebimento">
        {admin && <EquipamentoForm />}
      </PageHeader>

      {lista === null && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A tabela de equipamentos ainda não existe no banco — rode a migração <code>0023_equipamentos.sql</code> no Supabase. Até lá o custo usa 1
          empilhadeira de R$ 6.000.
        </Card>
      )}

      <div className="mb-6 grid max-w-xl gap-4 sm:grid-cols-2">
        <StatCard label="Custo mensal dos equipamentos" value={formatBRL(total)} hint={`${unidades} unidades`} accent="gold" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Equipamento</th>
              <th className="px-5 py-3 font-semibold">Tipo</th>
              <th className="px-5 py-3 font-semibold">Quantidade · custo por unidade</th>
              <th className="px-5 py-3 text-right font-semibold">Total/mês</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-[#141a4d]">{e.nome}</td>
                <td className="px-5 py-3 text-slate-500">{ROTULO_TIPO[e.tipo]}</td>
                <td className="px-5 py-3">
                  {admin ? (
                    <form action={editarEquipamento} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={e.id} />
                      <input name="quantidade" type="number" min="0" step="1" defaultValue={e.quantidade} required className={`${editInput} w-16`} aria-label="Quantidade" />
                      <span className="text-slate-400">×</span>
                      <input name="custo_unitario" type="number" min="0" step="0.01" defaultValue={e.custoUnitario} required className={`${editInput} w-28`} aria-label="Custo por unidade" />
                      <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                    </form>
                  ) : (
                    <span className="tabular-nums text-slate-600">
                      {e.quantidade} × {formatBRL(e.custoUnitario)}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(e.quantidade * e.custoUnitario)}</td>
                <td className="px-5 py-3 text-right">
                  {admin && (
                    <form action={encerrarEquipamento.bind(null, e.id)}>
                      <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {equipamentos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nenhum equipamento cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
