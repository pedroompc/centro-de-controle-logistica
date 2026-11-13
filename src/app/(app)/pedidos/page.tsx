import Link from "next/link";
import { getPedidos } from "@/data/pedidos-consulta";
import type { FiltrosPedidos } from "@/data/pedidos-consulta";
import { ESTADOS_PADRAO, ESTADOS_PEDIDO, ROTULO_ESTADO } from "@/domain/pedidos-consulta";
import type { EstadoPedido } from "@/domain/pedidos-consulta";
import { PageHeader, Card } from "@/components/ui";
import TabelaPedidos from "./tabela-pedidos";

// Campos no padrão do app Flask: fundo cinza-claro, foco âmbar.
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-[#F4F7FA] px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/50";
const rotuloCls = "flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";

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
  // Sem estado na URL: Liberado, Montado e Faturado, como no Flask.
  const estados: EstadoPedido[] = estadosSel.length ? estadosSel : [...ESTADOS_PADRAO];

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

  // "Limpar identificadores" mantém período e estados e consulta de novo (como no Flask).
  const limparIds = `/pedidos?${new URLSearchParams([["buscar", "1"], ["ini", ini], ["fim", fim], ...estados.map((e) => ["status", e])]).toString()}`;

  const filtro = (
    <Card className="mb-5 p-5">
      <form method="get" className="space-y-4">
        <input type="hidden" name="buscar" value="1" />
        {/* Identificadores diretos — acham o pedido em qualquer data (ignoram período/estado). */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className={rotuloCls}>
            Nº do Pedido
            <input name="numped" defaultValue={sp.numped ?? ""} inputMode="numeric" placeholder="Ex: 2651001011" className={inputCls} />
          </label>
          <label className={rotuloCls}>
            Nº Nota Fiscal (NF)
            <input name="nf" defaultValue={sp.nf ?? ""} inputMode="numeric" placeholder="Ex: 176398" className={inputCls} />
          </label>
          <label className={rotuloCls}>
            Nº Carregamento
            <input name="numcar" defaultValue={sp.numcar ?? ""} inputMode="numeric" placeholder="Ex: 12540" className={inputCls} />
          </label>
          <label className={rotuloCls}>
            Cód. Cliente
            <input name="cliente" defaultValue={sp.cliente ?? ""} inputMode="numeric" placeholder="Ex: 39493" className={inputCls} />
          </label>
          <label className={rotuloCls}>
            Cód. RCA (Vendedor)
            <input name="rca" defaultValue={sp.rca ?? ""} inputMode="numeric" placeholder="Ex: 120" className={inputCls} />
          </label>
        </div>
        {/* Período + posições */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 lg:grid-cols-4">
          <label className={rotuloCls}>
            Data emissão de
            <input type="date" name="ini" defaultValue={ini} className={inputCls} />
          </label>
          <label className={rotuloCls}>
            Até
            <input type="date" name="fim" defaultValue={fim} className={inputCls} />
          </label>
          <div className={`col-span-2 ${rotuloCls}`}>
            Posições / Estados
            <div className="flex flex-wrap gap-2 font-medium normal-case tracking-normal">
              {ESTADOS_PEDIDO.map((e) => (
                <label key={e} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition has-[:checked]:border-[#141a4d]/40 has-[:checked]:bg-[#eef0fb] has-[:checked]:text-[#141a4d]">
                  <input type="checkbox" name="status" value={e} defaultChecked={estados.includes(e)} className="accent-[#141a4d]" />
                  {ROTULO_ESTADO[e]} ({e})
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button className="flex items-center gap-2 rounded-xl bg-[#141a4d] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1b2168]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            Consultar
          </button>
          <Link href={limparIds} className="text-sm font-semibold text-amber-600 hover:text-amber-700">Limpar identificadores</Link>
          <span className="text-xs text-slate-400 sm:ml-auto">Nº do pedido, NF ou carga encontram em qualquer data, sem restrição de período.</span>
        </div>
      </form>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Consulta de Pedidos (Rotina 335)" subtitle="Pesquisa avançada · filiais 1 e 11 · itens, DANFE e boletos · ao vivo no Winthor" />

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
