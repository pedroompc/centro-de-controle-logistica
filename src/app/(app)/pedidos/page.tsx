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
    cliente?: string; rca?: string; numped?: string; nf?: string; numcar?: string;
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
  const notaFiscal = codigo(sp.nf);
  const numcar = codigo(sp.numcar);

  // Só consulta o Winthor DEPOIS de o usuário clicar em Consultar (igual à 335).
  const buscou = sp.buscar === "1";
  const filtros: FiltrosPedidos = { ini, fim, estados, cliente, rca, numped, notaFiscal, numcar };
  const resultado = buscou ? await getPedidos(filtros) : undefined;
  const pedidos = resultado && "pedidos" in resultado ? resultado.pedidos : null;
  const erro = resultado && "erro" in resultado ? resultado.erro : null;

  const filtro = (
    <Card className="mb-5 p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
        <h2 className="text-sm font-semibold text-[#141a4d]">Filtros</h2>
        <span className="text-xs text-slate-400">preencha e clique em Consultar (igual à 335)</span>
      </div>
      <form method="get" className="space-y-3">
        <input type="hidden" name="buscar" value="1" />
        {/* Identificadores diretos — acham o pedido em qualquer data (ignoram período/estado). */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            Nº Pedido
            <input name="numped" defaultValue={sp.numped ?? ""} inputMode="numeric" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            Nº Nota Fiscal
            <input name="nf" defaultValue={sp.nf ?? ""} inputMode="numeric" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            Nº Carregamento
            <input name="numcar" defaultValue={sp.numcar ?? ""} inputMode="numeric" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            Cód. Cliente
            <input name="cliente" defaultValue={sp.cliente ?? ""} inputMode="numeric" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            Cód. RCA (vendedor)
            <input name="rca" defaultValue={sp.rca ?? ""} inputMode="numeric" className={inputCls} />
          </label>
        </div>
        {/* Período + estados */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            Período de
            <input type="date" name="ini" defaultValue={ini} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
            até
            <input type="date" name="fim" defaultValue={fim} className={inputCls} />
          </label>
          <div className="col-span-2 flex flex-col gap-1 text-xs font-bold text-slate-600">
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
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button className="rounded-xl bg-[#181d55] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            Consultar
          </button>
          <Link href="/pedidos" className="text-xs font-medium text-amber-600 hover:text-amber-700">limpar campos</Link>
          <span className="hidden text-xs text-slate-400 sm:inline">Nº do pedido / nota / carregamento acham em qualquer data; os demais usam o período.</span>
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
      ) : erro !== null ? (
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Pedidos indisponíveis. Se você está fora da rede da empresa, o Winthor não responde. Se
            está dentro e mesmo assim deu erro, o detalhe técnico abaixo aponta a causa (ex.: uma
            coluna com nome diferente nesta base).
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-rose-700">{erro}</pre>
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
