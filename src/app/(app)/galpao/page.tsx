import Link from "next/link";
import { primeiroDiaDoMes, mesAnterior, limitarAoHistorico } from "@/domain/periodo";
import { PageHeader } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";
import { Indicadores } from "./indicadores";
import { Operacao } from "./operacao";
import { Gestao, NavMesGestao, mesGestao } from "./gestao";
import { PainelGalpao, hrefPainel } from "./painel";
import { FAIXAS_TURNO } from "@/domain/wms-operacao";

// O painel de eficiência por turno é a tela do galpão. As visões anteriores
// continuam em ?aba= (link discreto no rodapé) até decidirmos se saem.
type Aba = "painel" | "indicadores" | "operacao" | "gestao";

const VISOES_ANTIGAS: { id: Exclude<Aba, "painel">; rotulo: string }[] = [
  { id: "indicadores", rotulo: "Indicadores mensais" },
  { id: "operacao", rotulo: "Operação por hora" },
  { id: "gestao", rotulo: "Gestão" },
];

export default async function GalpaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; mes?: string; evolucao?: string; turno?: string; dia?: string; op?: string }>;
}) {
  const sp = await searchParams;
  const aba: Aba = sp.aba === "operacao" || sp.aba === "gestao" || sp.aba === "indicadores" ? sp.aba : "painel";
  // Painel: mês corrente por padrão (acompanhar o dia); filtros de drill-down validados.
  const mesP = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const turno = FAIXAS_TURNO.find((f) => f.id === sp.turno)?.id;
  const dia = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : undefined;
  const op = sp.op !== undefined && /^\d+$/.test(sp.op) ? Number(sp.op) : undefined;
  // Operação abre no último mês FECHADO: o corrente ainda não tem todos os dias.
  const mes = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : mesAnterior(primeiroDiaDoMes()));
  const hrefMes = (m: string) => `/galpao?aba=operacao&mes=${m}`;
  // Gestão tem navegação própria: compara com o ano anterior, então vai além do piso global.
  const mesG = mesGestao(sp.mes);
  const hrefAba = (a: Aba) =>
    a === "operacao" ? hrefMes(mes) : a === "gestao" ? `/galpao?aba=gestao&mes=${mesG}` : a === "indicadores" ? "/galpao?aba=indicadores" : "/galpao";

  return (
    <div>
      <PageHeader title="Galpão" subtitle="Eficiência por turno · WMS Harpia">
        {/* trocar de mês limpa o dia (pertence ao mês), mantém turno e operador */}
        {aba === "painel" && <MesNav mes={mesP} hrefFor={(m) => hrefPainel({ mes: m, turno, op })} />}
        {aba === "operacao" && <MesNav mes={mes} hrefFor={hrefMes} />}
        {aba === "gestao" && <NavMesGestao mes={mesG} />}
      </PageHeader>

      {aba !== "painel" && (
        <Link href={hrefAba("painel")} className="mb-4 inline-flex text-sm text-slate-500 hover:text-[#141a4d]">
          ← Painel por turno
        </Link>
      )}

      {aba === "painel" && <PainelGalpao mes={mesP} turno={turno} dia={dia?.slice(0, 7) === mesP.slice(0, 7) ? dia : undefined} op={op} />}
      {aba === "operacao" && <Operacao mes={mes} />}
      {aba === "gestao" && <Gestao mes={mesG} evolucao={sp.evolucao === "1"} />}
      {aba === "indicadores" && <Indicadores />}

      <nav className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-4 text-xs text-slate-400" aria-label="Outras visões do galpão">
        <span>Outras visões:</span>
        {VISOES_ANTIGAS.filter((v) => v.id !== aba).map((v) => (
          <Link key={v.id} href={hrefAba(v.id)} className="hover:text-[#141a4d] hover:underline">{v.rotulo}</Link>
        ))}
      </nav>
    </div>
  );
}
