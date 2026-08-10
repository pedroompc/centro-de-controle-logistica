import { listarCustosFixos, editarValorCustoFixo, encerrarCustoFixo } from "@/data/custos-fixos";
import { isAdmin } from "@/data/auth";
import { formatBRL } from "@/domain/format";
import { PageHeader, Card, BackLink, StatCard } from "@/components/ui";
import { CustoFixoForm } from "./custo-fixo-form";

const editInput =
  "w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export default async function CustosFixosPage() {
  const [fixos, admin] = await Promise.all([listarCustosFixos(), isAdmin()]);
  const total = fixos.reduce((t, f) => t + f.valor, 0);

  return (
    <div>
      <BackLink href="/custos">Custos</BackLink>
      <PageHeader title="Custos fixos" subtitle="Molde recorrente — vale para os próximos meses">
        {admin && <CustoFixoForm />}
      </PageHeader>

      <div className="mb-6 max-w-xs">
        <StatCard label="Total fixo mensal vigente" value={formatBRL(total)} hint={`${fixos.length} itens`} accent="gold" />
      </div>

      <Card className="overflow-hidden">
        {/* Desktop: tabela */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Valor mensal</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {fixos.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-[#141a4d]">{f.nome}</td>
                  <td className="px-5 py-3">
                    {admin ? (
                      <form action={editarValorCustoFixo} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={f.id} />
                        <input name="valor" type="number" step="0.01" min="0" defaultValue={f.valor} required className={editInput} />
                        <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                      </form>
                    ) : (
                      <span className="tabular-nums text-slate-600">{formatBRL(f.valor)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {admin && (
                      <form action={encerrarCustoFixo.bind(null, f.id)}>
                        <button className="text-sm font-medium text-rose-600 hover:text-rose-700">encerrar</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {fixos.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400">Nenhum custo fixo cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {fixos.map((f) => (
            <li key={f.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-medium text-[#141a4d]">{f.nome}</p>
                {!admin && <span className="shrink-0 tabular-nums font-semibold text-slate-700">{formatBRL(f.valor)}</span>}
              </div>
              {admin && (
                <div className="mt-2.5 flex items-center gap-2">
                  <form action={editarValorCustoFixo} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <input
                      name="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={f.valor}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                    />
                    <button className="shrink-0 rounded-lg bg-[#181d55] px-3 py-2 text-xs font-semibold text-white active:bg-[#10143f]">
                      Salvar
                    </button>
                  </form>
                  <form action={encerrarCustoFixo.bind(null, f.id)}>
                    <button className="shrink-0 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 active:bg-rose-50">
                      Encerrar
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
          {fixos.length === 0 && (
            <li className="px-4 py-8 text-center text-slate-400">Nenhum custo fixo cadastrado.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
