import Link from "next/link";
import { primeiroDiaDoMes, mesAnterior, limitarAoHistorico } from "@/domain/periodo";
import { PageHeader } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";
import { Indicadores } from "./indicadores";
import { Operacao } from "./operacao";
import { Gestao, NavMesGestao, mesGestao } from "./gestao";

type Aba = "indicadores" | "operacao" | "gestao";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "indicadores", rotulo: "Indicadores" },
  { id: "operacao", rotulo: "Operação" },
  { id: "gestao", rotulo: "Gestão" },
];

export default async function GalpaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; mes?: string; evolucao?: string }>;
}) {
  const sp = await searchParams;
  const aba: Aba = sp.aba === "operacao" || sp.aba === "gestao" ? sp.aba : "indicadores";
  // Operação abre no último mês FECHADO: o corrente ainda não tem todos os dias.
  const mes = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : mesAnterior(primeiroDiaDoMes()));
  const hrefMes = (m: string) => `/galpao?aba=operacao&mes=${m}`;
  // Gestão tem navegação própria: compara com o ano anterior, então vai além do piso global.
  const mesG = mesGestao(sp.mes);
  const hrefAba = (a: Aba) =>
    a === "operacao" ? hrefMes(mes) : a === "gestao" ? `/galpao?aba=gestao&mes=${mesG}` : "/galpao";

  return (
    <div>
      <PageHeader title="Galpão" subtitle="Eficiência do armazém · WMS Harpia">
        {aba === "operacao" && <MesNav mes={mes} hrefFor={hrefMes} />}
        {aba === "gestao" && <NavMesGestao mes={mesG} />}
      </PageHeader>

      <nav className="mb-6 flex gap-1 border-b border-slate-200" aria-label="Abas do galpão">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={hrefAba(a.id)}
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

      {aba === "operacao" && <Operacao mes={mes} />}
      {aba === "gestao" && <Gestao mes={mesG} evolucao={sp.evolucao === "1"} />}
      {aba === "indicadores" && <Indicadores />}
    </div>
  );
}
