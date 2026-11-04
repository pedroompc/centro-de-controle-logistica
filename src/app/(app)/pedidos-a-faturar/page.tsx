import { Suspense } from "react";
import { PageHeader, Card } from "@/components/ui";
import { getPedidosPendentes } from "@/data/pedidos-a-faturar";
import { getRotas } from "@/data/calendario-rotas";
import { criarIndiceCalendario } from "@/domain/pedidos-a-faturar/calendario";
import { PedidosAFaturarView, type PedidoLista } from "./pedidos-a-faturar-view";

export const dynamic = "force-dynamic"; // lista ao vivo do Winthor, nunca cacheada

async function Conteudo() {
  const [pedidos, rotas] = await Promise.all([getPedidosPendentes(), getRotas()]);

  if (pedidos === null) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">
          Pedidos a Faturar indisponível — sem conexão com o Winthor. O banco só responde de
          dentro da rede da empresa.
        </p>
      </Card>
    );
  }

  // O calendário serve só para MARCAR a região de cada pedido (filtro). Sem
  // classificação de prioridade/prazo — se o calendário não carregou/está vazio,
  // a região fica nula e o filtro de região aparece indisponível.
  const indice = criarIndiceCalendario(rotas ?? []);
  const enriquecidos: PedidoLista[] = pedidos
    .map((p) => ({
      numeroPedido: p.numeroPedido,
      nomeCliente: p.nomeCliente,
      cidadeCliente: p.cidadeCliente,
      nomeRca: p.nomeRca,
      nomeSupervisor: p.nomeSupervisor,
      valorPedido: Math.round(p.valorPedido * 100) / 100,
      pesoPedido: Math.round(p.pesoPedido * 10) / 10,
      horasParado: Math.round(p.horasParado * 10) / 10,
      statusWinthor: p.statusWinthor,
      reentrega: p.reentrega,
      regiao: indice.buscar(p.cidadeCliente)?.regiaoOperacional ?? null,
    }))
    // Do mais antigo (mais tempo parado) ao mais recente.
    .sort((a, b) => b.horasParado - a.horasParado);

  // Horário desta leitura (o botão Atualizar dispara router.refresh() → nova leitura).
  const atualizadoEm = new Date().toLocaleTimeString("pt-BR");

  return <PedidosAFaturarView pedidos={enriquecidos} atualizadoEm={atualizadoEm} />;
}

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />;
}

export default function PedidosAFaturarPage() {
  return (
    <div>
      <PageHeader title="Pedidos a Faturar" />
      <Suspense fallback={<Skeleton />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
