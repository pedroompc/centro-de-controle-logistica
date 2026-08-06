import { Suspense } from "react";
import { PageHeader, Card } from "@/components/ui";
import { getPedidosPendentes } from "@/data/pedidos-a-faturar";
import { getRotas } from "@/data/calendario-rotas";
import { criarIndiceCalendario } from "@/domain/pedidos-a-faturar/calendario";
import { montarRelatorio } from "@/domain/pedidos-a-faturar/montar-relatorio";
import { PedidosAFaturarView } from "./pedidos-a-faturar-view";

export const dynamic = "force-dynamic"; // relatório ao vivo, nunca cacheado

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

  const indice = criarIndiceCalendario(rotas);
  const rel = montarRelatorio(pedidos, indice, new Date());
  return <PedidosAFaturarView rel={rel} />;
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
