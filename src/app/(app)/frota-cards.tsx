import Link from "next/link";
import { carregarFrotaTV } from "./painel/painel-actions";
import { carregarFrotaPeriodo } from "@/data/frota-periodo";
import { rotuloCurto, type Periodo } from "@/domain/periodo";
import { formatBRL, formatPercent } from "@/domain/format";
import { StatCard, Card } from "@/components/ui";
import { lerSaudeTelemetria } from "@/data/frota-km";
import { haQuanto, type SaudeTelemetria } from "@/domain/frota-saude";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const km1 = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

// "+4,2% vs mês anterior" — vazio quando não há mês anterior para comparar.
function delta(atual: number | null, ant: number | null | undefined, ref = "mês anterior"): string {
  if (atual === null || ant == null || ant === 0) return "";
  const f = atual / ant - 1;
  return `${f >= 0 ? "+" : "−"}${formatPercent(Math.abs(f))} vs ${ref}`;
}

// Selo de saúde do coletor (Fulltrack → Supabase a cada 10 min). Sem verde:
// verde é só receita. Atrasado/parado = o KM do mês está saindo incompleto.
const COR_SAUDE = {
  ok: "bg-[#1b2168]",
  atrasado: "bg-amber-500",
  parado: "bg-rose-500",
  "sem-dados": "bg-rose-500",
} as const;

function SeloColetor({ s }: { s: SaudeTelemetria }) {
  const texto =
    s.estado === "sem-dados"
      ? "coletor sem leitura recente"
      : `${s.estado === "parado" ? "coletor parado · " : ""}última leitura ${haQuanto(s.minutos ?? 0)} · ${s.comunicando} veículos comunicando`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${s.estado === "ok" ? "text-slate-400" : s.estado === "atrasado" ? "font-medium text-amber-700" : "font-semibold text-rose-600"}`}
      title="Coletor da telemetria (Fulltrack) — grava as posições a cada 10 min"
    >
      <span className={`h-2 w-2 rounded-full ${COR_SAUDE[s.estado]}`} />
      {texto}
    </span>
  );
}

function Heading({ href, saude }: { href?: string; saude?: SaudeTelemetria | null }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
          Frota · KM rodado
        </h2>
        {saude && <SeloColetor s={saude} />}
      </div>
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
export async function FrotaCards({
  mes,
  periodo,
  periodoAnt,
  hrefBi,
}: {
  mes: string;
  /** Período que não é um mês inteiro: lê o intervalo e compara com `periodoAnt`. */
  periodo?: Periodo;
  periodoAnt?: Periodo;
  hrefBi?: string;
}) {
  const leitura = periodo ? carregarFrotaPeriodo(periodo, periodoAnt ?? null) : carregarFrotaTV(mes);
  const [d, saude] = await Promise.all([leitura.catch(() => null), lerSaudeTelemetria().catch(() => null)]);

  if (!d) {
    return (
      <div>
        <Heading href={hrefBi} saude={saude} />
        <Card className="p-6">
          <p className="text-sm text-slate-500">Sem telemetria da frota para este período.</p>
        </Card>
      </div>
    );
  }

  const a = d.anterior;
  const ref = periodo && periodoAnt ? rotuloCurto(periodoAnt) : undefined;
  const kmDia = d.kmPorVeiculoDia === null ? null : Math.round(d.kmPorVeiculoDia);

  return (
    <div>
      <Heading href={hrefBi} saude={saude} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="KM rodado"
          value={`${inteiro.format(Math.round(d.km))} km`}
          hint={delta(d.km, a?.km, ref) || `${d.rastreados} de ${d.veiculos} veículos rastreados`}
          accent="navy"
          href={hrefBi}
        />
        <StatCard
          label="KM por entrega"
          value={km1(d.kmPorEntrega)}
          hint={delta(d.kmPorEntrega, a?.kmPorEntrega, ref) || "km rodado ÷ entregas"}
          accent="gold"
          href={hrefBi}
        />
        <StatCard
          label="KM por veículo/dia"
          value={kmDia === null ? "—" : inteiro.format(kmDia)}
          hint={delta(d.kmPorVeiculoDia, a?.kmPorVeiculoDia, ref) || "média por carro, nos dias em que rodou"}
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
            hint="veículos com viagem no período"
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
