import { getSerieTendencias } from "@/data/faturamento-mensal";
import { taxaDevolucaoMensal } from "@/domain/tendencias";
import { formatBRL, formatPercent, formatKg } from "@/domain/format";
import { LineChart } from "@/components/line-chart";
import { PageHeader, Card } from "@/components/ui";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Rótulo compacto do eixo (ex.: "Mai/26"), derivado direto de "YYYY-MM-01".
const rotuloMes = (mes: string) => {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES_ABREV[m - 1]}/${String(ano).slice(2)}`;
};

export default async function TendenciasPage() {
  const serie = await getSerieTendencias(12);
  const rotulos = serie.map((p) => rotuloMes(p.mes));

  if (serie.length === 0) {
    return (
      <div>
        <PageHeader title="Tendências" subtitle="Evolução mês a mês · Winthor" />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Sem histórico disponível — sem conexão com o Winthor (o banco só responde de dentro
            da rede da empresa) ou ainda não há meses fechados.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Tendências" subtitle={`Últimos ${serie.length} meses fechados · filial 1`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <LineChart
          titulo="Taxa de devolução"
          valores={serie.map((p) => taxaDevolucaoMensal(p) * 100)}
          rotulos={rotulos}
          formato={(v) => formatPercent(v / 100)}
          cor="#e11d48"
        />
        <LineChart
          titulo="Venda líquida"
          valores={serie.map((p) => p.vendaLiquida)}
          rotulos={rotulos}
          formato={formatBRL}
        />
        <LineChart
          titulo="Valor devolução"
          valores={serie.map((p) => p.valorDevolucao)}
          rotulos={rotulos}
          formato={formatBRL}
          cor="#e11d48"
        />
        <LineChart
          titulo="Peso devolvido"
          valores={serie.map((p) => p.pesoDevolucao)}
          rotulos={rotulos}
          formato={formatKg}
          cor="#f59e0b"
        />
      </div>
    </div>
  );
}
