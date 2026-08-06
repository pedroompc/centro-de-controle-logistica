import { Suspense } from "react";
import { PageHeader, Card } from "@/components/ui";
import { getPedidosPendentes } from "@/data/pedidos-a-faturar";
import { PedidosAFaturarView } from "./pedidos-a-faturar-view";

export const dynamic = "force-dynamic"; // lista ao vivo do Winthor, nunca cacheada

async function Conteudo() {
  const pedidos = await getPedidosPendentes();

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

  // Do mais antigo (mais tempo parado) ao mais recente.
  const ordenados = [...pedidos].sort((a, b) => b.horasParado - a.horasParado);
  const resumo = {
    total: ordenados.length,
    valorTotal: ordenados.reduce((s, p) => s + p.valorPedido, 0),
    pesoTotal: ordenados.reduce((s, p) => s + p.pesoPedido, 0),
  };

  return <PedidosAFaturarView pedidos={ordenados} resumo={resumo} />;
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
