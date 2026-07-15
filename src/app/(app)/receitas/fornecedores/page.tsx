import { listarFornecedores, editarFornecedor, encerrarFornecedor } from "@/data/fornecedores";
import { isAdmin } from "@/data/auth";
import { PageHeader, Card, BackLink } from "@/components/ui";
import { FornecedorForm } from "./fornecedor-form";

const editInput =
  "w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export default async function FornecedoresPage() {
  const [fornecedores, admin] = await Promise.all([listarFornecedores(), isAdmin()]);

  return (
    <div>
      <BackLink href="/receitas">Receitas</BackLink>
      <PageHeader title="Fornecedores" subtitle="Cadastro usado nos lançamentos de descarregamento">
        {admin && <FornecedorForm />}
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Fornecedor</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    {admin ? (
                      <form action={editarFornecedor} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={f.id} />
                        <input name="nome" defaultValue={f.nome} required className={editInput} />
                        <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                      </form>
                    ) : (
                      <span className="font-medium text-[#141a4d]">{f.nome}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {admin && (
                      <form action={encerrarFornecedor.bind(null, f.id)}>
                        <button className="text-sm font-medium text-rose-600 hover:text-rose-700">encerrar</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {fornecedores.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-slate-400">Nenhum fornecedor cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
