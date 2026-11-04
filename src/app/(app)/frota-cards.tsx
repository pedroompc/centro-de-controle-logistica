import Link from "next/link";
import { carregarFrotaTV } from "./painel/painel-actions";
import { formatBRL, formatPercent } from "@/domain/format";
import { StatCard, Card } from "@/components/ui";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const km1 = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

// "+4,2% vs mês anterior" — vazio quando não há mês anterior para comparar.
function delta(atual: number | null, ant: number | null | undefined): string {
  if (atual === null || ant == null || ant === 0) return "";
  const f = atual / ant - 1;
  return `${f >= 0 ? "+" : "−"}${formatPercent(Math.abs(f))} vs mês anterior`;
}

function Heading({ href }: { href?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
        Frota · KM rodado
      </h2>
      {href && (
        <Link href={href} className="text-xs font-medium text-amber-600 hover:text-amber-700">
          ver no BI dos Motoristas →
        </Link>
      )}
    </div>
  );
}

/**
 * Telemetria da frota de entrega (Fulltrack) no mês — os mesmos números do slide
 * "Frota · KM rodado" do Painel TV. Assíncrono: fica dentro de um <Suspense>.
 * Custo estimado só aparece para admin (igual à TV).
 */
export async function FrotaCards({ mes, hrefBi }: { mes: string; hrefBi?: string }) {
  const d = await carregarFrotaTV(mes).catch(() => null);

  if (!d) {
    return (
      <div>
        <Heading href={hrefBi} />
        <Card className="p-6">
          <p className="text-sm text-slate-500">Sem telemetria da frota para este mês.</p>
        </Card>
      </div>
    );
  }

  const a = d.anterior;
  const kmDia = d.kmPorVeiculoDia === null ? null : Math.round(d.kmPorVeiculoDia);

  return (
    <div>
      <Heading href={hrefBi} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="KM rodado"
          value={`${inteiro.format(Math.round(d.km))} km`}
          hint={delta(d.km, a?.km) || `${d.rastreados} de ${d.veiculos} veículos rastreados`}
          accent="navy"
          href={hrefBi}
        />
        <StatCard
          label="KM por entrega"
          value={km1(d.kmPorEntrega)}
          hint={delta(d.kmPorEntrega, a?.kmPorEntrega) || "km rodado ÷ entregas"}
          accent="gold"
          href={hrefBi}
        />
        <StatCard
          label="KM por veículo/dia"
          value={kmDia === null ? "—" : inteiro.format(kmDia)}
          hint={delta(d.kmPorVeiculoDia, a?.kmPorVeiculoDia) || "média por carro, nos dias em que rodou"}
          accent="gold"
          href={hrefBi}
        />
        {d.custo ? (
          <StatCard
            label="Custo da frota · est."
            value={formatBRL(Math.round(d.custo.total)).replace(/,00$/, "")}
            hint={`${d.custo.porKm === null ? "—" : formatBRL(d.custo.porKm)}/km · ${d.custo.porEntrega === null ? "—" : formatBRL(d.custo.porEntrega)}/entrega`}
            accent="red"
            href="/custos/frota"
          />
        ) : (
          <StatCard
            label="Rastreados"
            value={`${d.rastreados} de ${d.veiculos}`}
            hint="veículos com viagem no mês"
            accent="navy"
            href={hrefBi}
          />
        )}
      </div>
    </div>
  );
}

export function FrotaSkeleton() {
  return (
    <div>
      <Heading />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[108px] animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
        ))}
      </div>
    </div>
  );
}
