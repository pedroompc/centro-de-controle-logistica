import Link from "next/link";
import { getPedidos } from "@/data/pedidos-consulta";
import { ESTADOS_PEDIDO, ROTULO_ESTADO } from "@/domain/pedidos-consulta";
import type { EstadoPedido } from "@/domain/pedidos-consulta";
import { PageHeader, Card } from "@/components/ui";
import TabelaPedidos from "./tabela-pedidos";

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

function isoDe(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ ini?: string; fim?: string; status?: string | string[] }>;
}) {
  const sp = await searchParams;
  const hoje = new Date();
  const fim = sp.fim || isoDe(hoje);
  const ini = sp.ini || isoDe(new Date(hoje.getTime() - 15 * 86400000)); // padrão: últimos 15 dias

  const statusArr = sp.status == null ? [] : Array.isArray(sp.status) ? sp.status : [sp.status];
  const estadosSel = statusArr.filter((s): s is EstadoPedido => (ESTADOS_PEDIDO as readonly string[]).includes(s));
  const estados: EstadoPedido[] = estadosSel.length ? estadosSel : [...ESTADOS_PEDIDO];

  const pedidos = await getPedidos(ini, fim, estados);

  const filtro = (
    <Card className="mb-5 p-3">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          De
          <input type="date" name="ini" defaultValue={ini} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Até
          <input type="date" name="fim" defaultValue={fim} className={inputCls} />
        </label>
        <div className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Estados
          <div className="flex flex-wrap gap-1.5">
            {ESTADOS_PEDIDO.map((e) => (
              <label key={e} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 has-[:checked]:text-amber-700">
                <input type="checkbox" name="status" value={e} defaultChecked={estados.includes(e)} className="accent-amber-500" />
                {ROTULO_ESTADO[e]}
              </label>
            ))}
          </div>
        </div>
        <button className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
          Consultar
        </button>
        <Link href="/pedidos" className="px-1 py-2 text-xs font-medium text-amber-600 hover:text-amber-700">limpar</Link>
      </form>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Consulta de Pedidos" subtitle="Rotina 335 · filiais 1 e 11 · ao vivo no Winthor" />

      {filtro}

      {pedidos === null ? (
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Pedidos indisponíveis — sem conexão com o Winthor (o banco só responde de dentro da rede
            da empresa).
          </p>
        </Card>
      ) : (
        <>
          <TabelaPedidos pedidos={pedidos} />
          <p className="mt-4 text-xs text-slate-400">
            Filtro por data de emissão do pedido. Clique num pedido para ver o endereço completo, os
            produtos, o faturamento e se houve devolução. Mostra até 500 pedidos por consulta —
            estreite o intervalo ou os estados se atingir o limite.
          </p>
        </>
      )}
    </div>
  );
}
