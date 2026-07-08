import Link from "next/link";
import { listarCustosFixos, editarValorCustoFixo, encerrarCustoFixo } from "@/data/custos-fixos";
import { formatBRL } from "@/domain/format";
import { CustoFixoForm } from "./custo-fixo-form";

export default async function CustosFixosPage() {
  const fixos = await listarCustosFixos();
  const total = fixos.reduce((t, f) => t + f.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Custos fixos</h1>
          <Link href="/custos" className="text-sm text-slate-500 underline">← voltar aos custos</Link>
        </div>
        <CustoFixoForm />
      </div>

      <p className="text-sm text-slate-500">
        Total fixo mensal vigente: <span className="font-semibold text-slate-800">{formatBRL(total)}</span>
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Valor mensal</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {fixos.map((f) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-slate-700">{f.nome}</td>
                <td className="px-4 py-2">
                  <form action={editarValorCustoFixo} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <input name="valor" type="number" step="0.01" min="0" defaultValue={f.valor} required
                      className="w-32 rounded-lg border border-slate-300 px-2 py-1" />
                    <button className="text-xs text-slate-600 underline">salvar</button>
                  </form>
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={encerrarCustoFixo.bind(null, f.id)}>
                    <button className="text-sm text-red-600">encerrar</button>
                  </form>
                </td>
              </tr>
            ))}
            {fixos.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Nenhum custo fixo cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
