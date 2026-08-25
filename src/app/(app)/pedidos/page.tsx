import Link from "next/link";
import { getPedidos } from "@/data/pedidos-consulta";
import type { FiltrosPedidos } from "@/data/pedidos-consulta";
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

// Converte texto de código em número (>0) ou undefined.
function codigo(v: string | undefined): number | undefined {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    buscar?: string; ini?: string; fim?: string; status?: string | string[];
    cliente?: string; rca?: string; numped?: string;
  }>;
}) {
  const sp = await searchParams;
  const hoje = new Date();
  const iniDefault = isoDe(new Date(hoje.getFullYear(), hoje.getMonth(), 1)); // 1º do mês
  const fimDefault = isoDe(hoje);
  const ini = sp.ini || iniDefault;
  const fim = sp.fim || fimDefault;

  const statusArr = sp.status == null ? [] : Array.isArray(sp.status) ? sp.status : [sp.status];
  const estadosSel = statusArr.filter((s): s is EstadoPedido => (ESTADOS_PEDIDO as readonly string[]).includes(s));
  const estados: EstadoPedido[] = estadosSel.length ? estadosSel : [...ESTADOS_PEDIDO];

  const cliente = codigo(sp.cliente);
  const rca = codigo(sp.rca);
  const numped = codigo(sp.numped);

  // Só consulta o Winthor DEPOIS de o usuário clicar em Consultar (igual à 335).
  const buscou = sp.buscar === "1";
  const filtros: FiltrosPedidos = { ini, fim, estados, cliente, rca, numped };
  const pedidos = buscou ? await getPedidos(filtros) : undefined;

  const filtro = (
    <Card className="mb-5 p-4">
      <form method="get" className="space-y-3">
        <input type="hidden" name="buscar" value="1" />
        {/* Linha 1: identificadores diretos */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Nº Pedido
            <input name="numped" defaultValue={sp.numped ?? ""} inputMode="numeric" placeholder="ex.: 200145" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Cód. Cliente
            <input name="cliente" defaultValue={sp.cliente ?? ""} inputMode="numeric" placeholder="ex.: 25387" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Cód. RCA
            <input name="rca" defaultValue={sp.rca ?? ""} inputMode="numeric" placeholder="vendedor" className={inputCls} />
          </label>
        </div>
        {/* Linha 2: período */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Período de
            <input type="date" name="ini" defaultValue={ini} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            até
            <input type="date" name="fim" defaultValue={fim} className={inputCls} />
          </label>
        </div>
        {/* Linha 3: estados */}
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
        <div className="flex items-center gap-3 pt-1">
          <button className="rounded-xl bg-[#181d55] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            Consultar
          </button>
          <Link href="/pedidos" className="text-xs font-medium text-amber-600 hover:text-amber-700">limpar</Link>
          <span className="text-xs text-slate-400">Nº do pedido acha em qualquer data; os demais filtros usam o período.</span>
        </div>
      </form>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Consulta de Pedidos" subtitle="Rotina 335 · filiais 1 e 11 · ao vivo no Winthor" />

      {filtro}

      {!buscou ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-500">
            Defina os filtros acima e clique em <span className="font-semibold text-[#141a4d]">Consultar</span> para
            listar os pedidos.
          </p>
        </Card>
      ) : pedidos === null ? (
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Pedidos indisponíveis — sem conexão com o Winthor (o banco só responde de dentro da rede
            da empresa).
          </p>
        </Card>
      ) : (
        <>
          <TabelaPedidos pedidos={pedidos ?? []} />
          <p className="mt-4 text-xs text-slate-400">
            Clique num pedido para ver o endereço completo, os produtos, o faturamento e se houve
            devolução. Mostra até 500 pedidos por consulta — estreite os filtros se atingir o limite.
          </p>
        </>
      )}
    </div>
  );
}
