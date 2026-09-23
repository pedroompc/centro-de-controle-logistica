import Link from "next/link";
import { primeiroDiaDoMes, mesAnterior, limitarAoHistorico } from "@/domain/periodo";
import { PageHeader } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";
import { Indicadores } from "./indicadores";
import { Operacao } from "./operacao";

type Aba = "indicadores" | "operacao";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "indicadores", rotulo: "Indicadores" },
  { id: "operacao", rotulo: "Operação" },
];

export default async function GalpaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const aba: Aba = sp.aba === "operacao" ? "operacao" : "indicadores";
  // Operação abre no último mês FECHADO: o corrente ainda não tem todos os dias.
  const mes = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : mesAnterior(primeiroDiaDoMes()));
  const hrefMes = (m: string) => `/galpao?aba=operacao&mes=${m}`;

  return (
    <div>
      <PageHeader title="Galpão" subtitle="Eficiência do armazém · WMS Harpia">
        {aba === "operacao" && <MesNav mes={mes} hrefFor={hrefMes} />}
      </PageHeader>

      <nav className="mb-6 flex gap-1 border-b border-slate-200" aria-label="Abas do galpão">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={a.id === "operacao" ? hrefMes(mes) : "/galpao"}
            aria-current={a.id === aba ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              a.id === aba
                ? "border-[#3d47a8] text-[#141a4d]"
                : "border-transparent text-slate-500 hover:text-[#141a4d]"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      {aba === "operacao" ? <Operacao mes={mes} /> : <Indicadores />}
    </div>
  );
}
