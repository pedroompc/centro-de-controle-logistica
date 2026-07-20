import { listarPrecos, editarPreco } from "@/data/precos-descarregamento";
import { lerConfig, editarValorMinimo } from "@/data/config-descarregamento";
import { isAdmin } from "@/data/auth";
import { formatBRL } from "@/domain/format";
import { ROTULO_TIPO } from "@/domain/descarregamento";
import { PageHeader, Card, BackLink } from "@/components/ui";

const editInput =
  "w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export default async function PrecosPage() {
  const [precos, config, admin] = await Promise.all([listarPrecos(), lerConfig(), isAdmin()]);

  return (
    <div>
      <BackLink href="/receitas">Receitas</BackLink>
      <PageHeader title="Preços por tonelada" subtitle="Valores globais aplicados por tipo de descarregamento" />

      <Card className="max-w-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Tipo</th>
              <th className="px-5 py-3 font-semibold">Preço / tonelada</th>
            </tr>
          </thead>
          <tbody>
            {precos.map((p) => (
              <tr key={p.tipo} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-[#141a4d]">{ROTULO_TIPO[p.tipo] ?? p.tipo}</td>
                <td className="px-5 py-3">
                  {admin ? (
                    <form action={editarPreco} className="flex items-center gap-2">
                      <input type="hidden" name="tipo" value={p.tipo} />
                      <input
                        name="preco"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={p.precoPorTonelada}
                        required
                        className={editInput}
                      />
                      <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                    </form>
                  ) : (
                    <span className="tabular-nums text-slate-600">{formatBRL(p.precoPorTonelada)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4 max-w-lg p-5">
        <h2 className="text-sm font-semibold text-[#141a4d]">Valor mínimo por descarregamento</h2>
        <p className="mt-1 text-xs text-slate-500">
          Descarregamento cujo cálculo fique abaixo deste valor é cobrado pelo mínimo.
        </p>
        {admin ? (
          <form action={editarValorMinimo} className="mt-3 flex items-center gap-2">
            <input
              name="valor_minimo"
              type="number"
              step="0.01"
              min="0"
              defaultValue={config.valorMinimo}
              required
              className={editInput}
            />
            <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
          </form>
        ) : (
          <p className="mt-3 tabular-nums text-sm text-slate-600">{formatBRL(config.valorMinimo)}</p>
        )}
      </Card>
    </div>
  );
}
