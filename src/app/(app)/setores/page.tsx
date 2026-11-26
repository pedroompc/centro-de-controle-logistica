import Link from "next/link";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { custoMensalDoSetor, composicaoDoCusto, setorNoPeriodo } from "@/domain/custo-setor";
import { efetivoSetorNoMes } from "@/domain/efetivo";
import { listarEquipamentos } from "@/data/equipamentos";
import { formatBRL } from "@/domain/format";
import {
  formatMesAno, lerPeriodo, mesDoPeriodo, mesesDoPeriodo, paramsDoPeriodo, primeiroDiaDoMes, rotuloPeriodo, INICIO_HISTORICO,
} from "@/domain/periodo";
import { hojeISO } from "@/domain/fechamento";
import { PageHeader, Pill } from "@/components/ui";
import { PeriodoNav } from "@/components/periodo-nav";
import { isAdmin } from "@/data/auth";
import { SetorForm } from "./setor-form";

export default async function SetoresPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; de?: string; ate?: string }>;
}) {
  const sp = await searchParams;
  const [setores, funcionarios, faltas, admin, equipamentos] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
    isAdmin(),
    listarEquipamentos().catch(() => null),
  ]);

  // Mês atual = cadastro de hoje (como sempre). Outro mês ou período = efetivo
  // reconstruído pelas datas de admissão/desligamento, mês a mês.
  const periodo = lerPeriodo(sp, { piso: INICIO_HISTORICO });
  const mesUnico = mesDoPeriodo(periodo);
  const hoje = hojeISO();
  const ehMesAtual = mesUnico === primeiroDiaDoMes();
  const meses = mesesDoPeriodo(periodo).filter((m) => m <= hoje);
  const linhasPorMes = ehMesAtual ? [] : meses.map((m) => efetivoSetorNoMes(funcionarios, setores, m, hoje));
  const ateFaltas = periodo.ate < hoje ? periodo.ate : hoje;
  const rotulo = mesUnico ? formatMesAno(mesUnico) : rotuloPeriodo(periodo);
  const qs = new URLSearchParams(paramsDoPeriodo(periodo)).toString();

  return (
    <div>
      <PageHeader title="Setores" subtitle={`${setores.length} setores na operação · ${rotulo}`}>
        <PeriodoNav periodo={periodo} hrefFor={(p) => (Object.keys(p).length ? `/setores?${new URLSearchParams(p)}` : "/setores")} />
        {admin && <SetorForm />}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {setores.map((setor) => {
          const ids = funcionarios.filter((f) => f.setorId === setor.id).map((f) => f.id);
          const totalFaltas = faltasNoPeriodo(faltas, ids, periodo.de, ateFaltas);
          const custoHoje = custoMensalDoSetor(setor, funcionarios, setores, equipamentos);
          const visao = ehMesAtual
            ? (() => {
                const head = headcountPorStatus(funcionarios, setor.id);
                return { custo: custoHoje, ativos: head.ativo, afastados: head.afastado };
              })()
            : setorNoPeriodo(setor.nome, linhasPorMes, custoHoje);
          return (
            <Link
              key={setor.id}
              href={`/setores/${setor.id}${qs ? `?${qs}` : ""}`}
              className="group @container rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-[family-name:var(--font-sora)] font-bold text-[#141a4d]">{setor.nome}</h2>
                <span className="text-slate-300 transition group-hover:text-amber-500">→</span>
              </div>
              <p className="mt-3 font-[family-name:var(--font-sora)] text-[clamp(1rem,10cqi,1.5rem)] font-extrabold tracking-tight tabular-nums whitespace-nowrap text-[#141a4d]">
                {formatBRL(visao.custo.total)}
              </p>
              <p className="text-xs text-slate-400">{composicaoDoCusto(visao.custo)}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Pill tone="green">{visao.ativos} ativos</Pill>
                {visao.afastados > 0 && <Pill tone="gold">{visao.afastados} afastados</Pill>}
                <Pill tone={totalFaltas > 0 ? "red" : "slate"}>{totalFaltas} {mesUnico ? "faltas/mês" : "faltas"}</Pill>
              </div>
            </Link>
          );
        })}
        {setores.length === 0 && <p className="text-slate-500">Nenhum setor cadastrado ainda.</p>}
      </div>
    </div>
  );
}
