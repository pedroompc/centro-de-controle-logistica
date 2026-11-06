import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, faltasNoPeriodo, resumoPorTurno, ROTULO_TURNO } from "@/domain/metrics";
import { formatBRL, formatPercent } from "@/domain/format";
import {
  primeiroDiaDoMes,
  mesAnterior,
  formatMesAno,
  lerPeriodo,
  mesDoPeriodo,
  mesesDoPeriodo,
  periodoAnterior,
  lerComparacao,
  periodoAberto,
  paramsDoPeriodo,
  rotuloPeriodo,
  rotuloCurto,
  temHistoricoSupabase,
  INICIO_HISTORICO,
  PISO_WINTHOR,
  type Periodo,
} from "@/domain/periodo";
import { hojeISO } from "@/domain/fechamento";
import { PeriodoNav } from "@/components/periodo-nav";
import { ComparaPeriodos } from "@/components/compara-periodos";
import { custoBrutoDoPeriodo, somaNosMeses } from "@/domain/custo-periodo";
import { listarLancamentosDoMes, serieCustosMensais } from "@/data/custos-mensais";
import { serieEfetivoSetorMensal, registrarFotoEfetivoSetor } from "@/data/efetivo-mensal";
import { receitaTotalDoPeriodo } from "@/data/receitas";
import { totalDoMes, somaLancamentos } from "@/domain/custos-metrics";
import { custoLiquido } from "@/domain/receitas-metrics";
import { fotoSetorAtual, totaisEfetivoPorMes } from "@/domain/efetivo";
import { compararSerie, type PontoValor } from "@/domain/comparativo-mensal";
import { PageHeader, StatCard, Card, SectionTitle } from "@/components/ui";
import { SeloVivo } from "@/components/movimento";
import { Suspense } from "react";
import {
  FaturamentoCards,
  FaturamentoSkeleton,
  FaturamentoDetalhe,
  FaturamentoDetalheSkeleton,
} from "./faturamento-cards";
import { FrotaCards, FrotaSkeleton } from "./frota-cards";
import { ehSetorMotoristas } from "@/domain/motoristas";
import { compararPct, compararAbs } from "@/domain/comparacao";
import { ListaComparativa, type LinhaComparativa, type SerieMes } from "./dashboard-comparativos";

const inteiro = new Intl.NumberFormat("pt-BR");
const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (mes: string) => `${MES_ABREV[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

interface DeltaProps {
  deltaTexto: string | null;
  deltaSubindo: boolean;
  deltaPositivo: boolean;
}

/** Variação de um valor vs o mês anterior (regra única de `@/domain/comparacao`); base zero cai para a diferença em R$. */
function fmtDelta(atual: number, anterior: number | null, maiorEhBom: boolean): DeltaProps {
  const c = compararPct(atual, anterior, maiorEhBom) ?? compararAbs(atual, anterior, maiorEhBom, formatBRL);
  return { deltaTexto: c?.texto ?? null, deltaSubindo: c?.subindo ?? false, deltaPositivo: c?.positivo ?? true };
}

/** Série mês a mês (drill-down), com a variação de cada mês vs o anterior. */
function serieMeses(
  pontos: PontoValor[],
  maiorEhBom: boolean,
  subPorMes?: Map<string, string>,
): SerieMes[] {
  return compararSerie(pontos).map((p) => ({
    rotulo: rotuloMes(p.mes),
    display: formatBRL(p.valor),
    sub: subPorMes?.get(p.mes),
    ...fmtDelta(p.valor, p.deltaAbs === null ? null : p.valor - p.deltaAbs, maiorEhBom),
  }));
}

/** Receita de um período, ou null quando ele cai antes do histórico do Supabase. */
const receitaOuNull = (p: Periodo) => (temHistoricoSupabase(p) ? receitaTotalDoPeriodo(p.de, p.ate).catch(() => null) : Promise.resolve(null));

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; de?: string; ate?: string; cmp?: string }>;
}) {
  const sp = await searchParams;
  // Default = mês atual. Mês inteiro segue o fluxo de sempre; período livre
  // (trimestre, ano, intervalo) soma os meses que toca nos custos.
  const periodo = lerPeriodo(sp, { piso: PISO_WINTHOR });
  const mesUnico = mesDoPeriodo(periodo);
  const mesAtual = mesUnico ?? primeiroDiaDoMes(periodo.ate); // mês de referência
  const mesFechado = !periodoAberto(periodo);
  const mesAnt = mesAnterior(mesAtual);
  const pAnt = periodoAnterior(periodo); // Δ das listas de setor/composição
  // Comparação dos cards: desligada por padrão; o usuário escolhe contra o quê.
  const comparacao = lerComparacao(sp.cmp, periodo);
  const pCmp = comparacao?.periodo ?? null;
  const comHistorico = temHistoricoSupabase(periodo);
  const meses = mesesDoPeriodo(periodo);
  const [funcionarios, setores, faltas, lancamentosMes, receitasMes, receitasCmp] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarFaltas(),
    mesUnico ? listarLancamentosDoMes(mesUnico) : Promise.resolve([]),
    receitaOuNull(periodo),
    pCmp ? receitaOuNull(pCmp) : Promise.resolve(null),
  ]);

  const ativos = funcionarios.filter((f) => f.status === "ativo");
  const custoEfetivo = ativos.reduce((t, f) => t + f.custoMensal, 0);
  const idsFunc = funcionarios.map((f) => f.id);
  const faltasEm = (p: Periodo) => (temHistoricoSupabase(p) ? faltasNoPeriodo(faltas, idsFunc, p.de, p.ate) : null);
  const faltasMes = faltasEm(periodo);
  const fixos = somaLancamentos(lancamentosMes, "fixo");
  const variaveis = somaLancamentos(lancamentosMes, "variavel");

  // Congela a foto do mês corrente por setor (best-effort) e lê o histórico —
  // fonte do comparativo mês a mês. Registrar ANTES de ler p/ o mês entrar já.
  await registrarFotoEfetivoSetor(fotoSetorAtual(funcionarios, setores));
  // Janela da série: tudo desde o início do histórico (≥ 12 meses).
  const qtdSerie = Math.max(12, mesesDoPeriodo({ de: INICIO_HISTORICO, ate: hojeISO() }).length);
  const [serieSetor, serieCustos] = await Promise.all([
    serieEfetivoSetorMensal(qtdSerie),
    serieCustosMensais(qtdSerie),
  ]);

  // Índices por mês para lookups do comparativo.
  const efTotais = totaisEfetivoPorMes(serieSetor);
  const efTotalPorMes = new Map(efTotais.map((t) => [t.mes, t]));
  const custosPorMes = new Map(serieCustos.map((c) => [c.mes, c]));
  // setor (nome) → mês → { custo, ativos }
  const setorPorMes = new Map<string, Map<string, { custo: number; ativos: number }>>();
  for (const r of serieSetor) {
    const m = setorPorMes.get(r.setor) ?? new Map<string, { custo: number; ativos: number }>();
    m.set(r.mes, { custo: r.custoAtivos, ativos: r.ativos });
    setorPorMes.set(r.setor, m);
  }

  // Custo do período: mês inteiro = lançamentos do mês + folha atual (como
  // sempre); período livre = soma dos meses que toca (foto da folha + custos).
  const folhaPorMes = new Map(efTotais.map((t) => [t.mes, t.folhaTotal]));
  const custoDe = (p: Periodo) => custoBrutoDoPeriodo(mesesDoPeriodo(p), folhaPorMes, custosPorMes);
  const custoTotalMes: number | null = !comHistorico ? null : mesUnico ? totalDoMes(lancamentosMes, custoEfetivo) : custoDe(periodo);
  const liquidoDe = (c: number | null, r: number | null) => (c === null || r === null ? null : custoLiquido(c, r));
  const custoLiquidoMes = liquidoDe(custoTotalMes, receitasMes);
  const custoCmp = pCmp ? custoDe(pCmp) : null;
  const chips = (atual: number | null, base: number | null, maiorEhBom: boolean) =>
    atual === null || !pCmp ? undefined : (
      <ComparaPeriodos itens={[{ c: compararPct(atual, base, maiorEhBom), referencia: `vs ${rotuloCurto(pCmp)}` }]} />
    );

  // Custo + efetivo por setor numa leitura só: barra pelo custo, nº de pessoas ao lado.
  const mesesAnt = mesesDoPeriodo(pAnt);
  const custoSetorNos = (nome: string, ms: string[]) => {
    const m = setorPorMes.get(nome);
    return m ? somaNosMeses(new Map([...m].map(([k, v]) => [k, v.custo])), ms) : null;
  };
  const setorPorCusto = setores
    .map((s) => {
      if (mesUnico) {
        const custo = custoDoSetor(funcionarios, s.id);
        const efetivo = ativos.filter((f) => f.setorId === s.id).length;
        return { nome: s.nome, custo, efetivo };
      }
      // Período: custo somado nos meses; pessoas = último mês do período com foto.
      const m = setorPorMes.get(s.nome);
      const ultimo = m ? [...meses].reverse().find((x) => m.has(x)) : undefined;
      return { nome: s.nome, custo: custoSetorNos(s.nome, meses) ?? 0, efetivo: ultimo ? m!.get(ultimo)!.ativos : 0 };
    })
    .filter((i) => i.custo > 0 || i.efetivo > 0)
    .sort((a, b) => b.custo - a.custo)
    .slice(0, 8);
  const maxCustoSetor = Math.max(1, ...setorPorCusto.map((s) => s.custo));

  // Linhas comparativas: setores (barra âmbar, chip de pessoas, drill-down por mês).
  const linhasSetor: LinhaComparativa[] = setorPorCusto.map((s) => {
    const porMes = setorPorMes.get(s.nome) ?? new Map<string, { custo: number; ativos: number }>();
    const custoAnt = mesUnico ? (porMes.get(mesAnt)?.custo ?? null) : custoSetorNos(s.nome, mesesAnt);
    const pontos: PontoValor[] = efTotais
      .map((t) => t.mes)
      .filter((m) => porMes.has(m) && (mesUnico ? true : meses.includes(m)))
      .map((m) => ({ mes: m, valor: porMes.get(m)!.custo }));
    const subPorMes = new Map([...porMes].map(([m, v]) => [m, `${inteiro.format(v.ativos)} pes.`]));
    return {
      chave: `setor:${s.nome}`,
      label: s.nome,
      valorDisplay: formatBRL(s.custo),
      sub: `${s.efetivo}`,
      barra: s.custo / maxCustoSetor,
      ...fmtDelta(s.custo, custoAnt, false),
      serie: serieMeses(pontos, false, subPorMes),
    };
  });

  // Composição do mês: Salário (foto de efetivo), Fixos e Variáveis (histórico
  // real de custos_mensais), com Total no fim.
  // Período livre: soma dos meses do período; Δ vs os meses do período anterior.
  const fixosPorMes = new Map(serieCustos.map((c) => [c.mes, c.fixos]));
  const varPorMes = new Map(serieCustos.map((c) => [c.mes, c.variaveis]));
  const salarioP = mesUnico ? custoEfetivo : (somaNosMeses(folhaPorMes, meses) ?? 0);
  const fixosP = mesUnico ? fixos : (somaNosMeses(fixosPorMes, meses) ?? 0);
  const variaveisP = mesUnico ? variaveis : (somaNosMeses(varPorMes, meses) ?? 0);
  const salarioAnt = mesUnico ? (efTotalPorMes.get(mesAnt)?.folhaTotal ?? null) : somaNosMeses(folhaPorMes, mesesAnt);
  const fixosAnt = mesUnico ? (custosPorMes.get(mesAnt)?.fixos ?? null) : somaNosMeses(fixosPorMes, mesesAnt);
  const variaveisAnt = mesUnico ? (custosPorMes.get(mesAnt)?.variaveis ?? null) : somaNosMeses(varPorMes, mesesAnt);
  const totalAnt =
    salarioAnt !== null && fixosAnt !== null && variaveisAnt !== null
      ? salarioAnt + fixosAnt + variaveisAnt
      : null;
  const maxComp = Math.max(1, salarioP, fixosP, variaveisP);

  const noPeriodo = (m: string) => mesUnico !== null || meses.includes(m);
  const pontosSalario: PontoValor[] = efTotais.filter((t) => noPeriodo(t.mes)).map((t) => ({ mes: t.mes, valor: t.folhaTotal }));
  const pontosFixos: PontoValor[] = serieCustos.filter((c) => noPeriodo(c.mes)).map((c) => ({ mes: c.mes, valor: c.fixos }));
  const pontosVar: PontoValor[] = serieCustos.filter((c) => noPeriodo(c.mes)).map((c) => ({ mes: c.mes, valor: c.variaveis }));
  const pontosTotal: PontoValor[] = efTotais
    .filter((t) => custosPorMes.has(t.mes) && noPeriodo(t.mes))
    .map((t) => {
      const c = custosPorMes.get(t.mes)!;
      return { mes: t.mes, valor: t.folhaTotal + c.fixos + c.variaveis };
    });

  const linhasComposicao: LinhaComparativa[] = [
    {
      chave: "salario", label: "Salário (efetivo)", valorDisplay: formatBRL(salarioP),
      barra: salarioP / maxComp, ...fmtDelta(salarioP, salarioAnt, false), serie: serieMeses(pontosSalario, false),
    },
    {
      chave: "fixos", label: "Custos fixos", valorDisplay: formatBRL(fixosP),
      barra: fixosP / maxComp, ...fmtDelta(fixosP, fixosAnt, false), serie: serieMeses(pontosFixos, false),
    },
    {
      chave: "variaveis", label: "Custos variáveis", valorDisplay: formatBRL(variaveisP),
      barra: variaveisP / maxComp, ...fmtDelta(variaveisP, variaveisAnt, false), serie: serieMeses(pontosVar, false),
    },
    {
      chave: "total", label: mesUnico ? "Total do mês" : "Total do período", valorDisplay: formatBRL(custoTotalMes ?? 0),
      destaque: true, ...fmtDelta(custoTotalMes ?? 0, totalAnt, false), serie: serieMeses(pontosTotal, false),
    },
  ];

  // Efetivo por turno (cadastro atual — turno não tem foto mensal).
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));
  const porTurno = resumoPorTurno(funcionarios).map((t) => {
    const contagem = new Map<string, number>();
    for (const f of ativos) if (f.turno === t.turno) contagem.set(f.setorId, (contagem.get(f.setorId) ?? 0) + 1);
    const setoresTurno = [...contagem]
      .map(([id, n]) => ({ nome: nomeSetor.get(id) ?? "—", n }))
      .sort((a, b) => b.n - a.n);
    return { ...t, setores: setoresTurno };
  });

  // BI dos Motoristas (visão de KM) — destino dos cards da frota.
  const setorMotoristas = setores.find((s) => ehSetorMotoristas(s.nome));
  const qsPeriodo = new URLSearchParams(paramsDoPeriodo(periodo)).toString();
  const hrefBiMotoristas = setorMotoristas ? `/setores/${setorMotoristas.id}?aba=bi${qsPeriodo ? `&${qsPeriodo}` : ""}` : undefined;
  const hrefPeriodo = (base: string) => (qsPeriodo ? `${base}?${qsPeriodo}` : base);
  const semDado = "sem dado";

  return (
    <div>
      <PageHeader
        title="Visão geral"
        subtitle={`Operação de logística · ${mesUnico ? formatMesAno(mesUnico) : rotuloPeriodo(periodo)}${mesFechado ? (mesUnico ? " · mês fechado" : " · fechado") : " · em andamento"}`}
      >
        {/* Dashboard não se atualiza sozinho: o selo diz de quando são os números. */}
        <SeloVivo
          relogio={new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" })}
          pulsando={false}
          className="text-slate-400"
        />
        <Link
          href="/fechamento"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
            <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
          </svg>
          Compartilhar fechamento
        </Link>
        <PeriodoNav periodo={periodo} piso={PISO_WINTHOR} comparacao={comparacao} hrefFor={(p) => (Object.keys(p).length ? `/?${new URLSearchParams(p)}` : "/")} />
      </PageHeader>

      <Suspense fallback={<FaturamentoSkeleton />}>
        <FaturamentoCards periodo={periodo} custoTotal={custoTotalMes} comparar={pCmp} />
      </Suspense>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Funcionários ativos" value={`${ativos.length}`} hint={`${funcionarios.length} no efetivo`} accent="navy" href="/funcionarios" />
        <StatCard
          label={mesUnico ? "Custo bruto do mês" : "Custo bruto do período"}
          value={custoTotalMes === null ? semDado : formatBRL(custoTotalMes)}
          accent="gold"
          href={hrefPeriodo("/custos")}
          title={mesUnico ? undefined : "Custos são mensais: soma dos meses que o período toca"}
          extra={chips(custoTotalMes, custoCmp, false)}
        />
        <StatCard
          label={mesUnico ? "Custo líquido do mês" : "Custo líquido do período"}
          value={custoLiquidoMes === null ? semDado : formatBRL(custoLiquidoMes)}
          hint={receitasMes === null ? undefined : `Receitas: ${formatBRL(receitasMes)}`}
          accent="green"
          href={hrefPeriodo("/receitas")}
          extra={chips(custoLiquidoMes, liquidoDe(custoCmp, receitasCmp), false)}
        />
        <StatCard
          label={mesUnico ? "Faltas no mês" : "Faltas no período"}
          value={faltasMes === null ? semDado : `${faltasMes}`}
          accent="red"
          href={hrefPeriodo("/faltas")}
          extra={chips(faltasMes, pCmp && faltasEm(pCmp), false)}
        />
      </div>

      <div className="mt-8">
        <Suspense fallback={<FrotaSkeleton />}>
          <FrotaCards mes={mesAtual} periodo={periodo} mesUnico={mesUnico !== null} comparar={pCmp} hrefBi={hrefBiMotoristas} />
        </Suspense>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Custo e efetivo por setor</SectionTitle>
            <span className="text-xs text-slate-400">Δ vs {mesUnico ? formatMesAno(mesAnt) : rotuloCurto(pAnt)} · clique para ver mês a mês</span>
          </div>
          <ListaComparativa linhas={linhasSetor} tone="gold" />
        </Card>

        <Card className="p-6">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>{mesUnico ? "Composição do mês" : "Composição do período"}</SectionTitle>
            <span className="text-xs text-slate-400">Δ vs {mesUnico ? formatMesAno(mesAnt) : rotuloCurto(pAnt)}</span>
          </div>
          <ListaComparativa linhas={linhasComposicao} tone="navy" />
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Efetivo por turno</SectionTitle>
          <span className="text-xs text-slate-400">cadastro atual · produção por turno fica no BI de cada setor</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {porTurno.map((t) => (
            <Link
              key={t.turno}
              href={`/funcionarios?turno=${t.turno}&status=ativo`}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-amber-300 hover:bg-white"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{ROTULO_TURNO[t.turno]}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#141a4d]">
                {t.ativos} <span className="text-sm font-medium text-slate-500">ativos</span>
              </p>
              <p className="text-sm tabular-nums text-slate-600">
                {formatBRL(t.custo)}
                {custoEfetivo > 0 && <span className="text-slate-400"> · {formatPercent(t.custo / custoEfetivo)} da folha</span>}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                {t.setores.slice(0, 5).map((s) => (
                  <li key={s.nome} className="flex justify-between gap-2">
                    <span className="truncate">{s.nome}</span>
                    <span className="tabular-nums">{s.n}</span>
                  </li>
                ))}
                {t.setores.length > 5 && <li className="text-slate-400">+{t.setores.length - 5} setores</li>}
              </ul>
            </Link>
          ))}
        </div>
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Custos fixos/variáveis comparam com o histórico real de lançamentos. Salário e efetivo por
        setor usam a foto mensal do efetivo (julho e agosto semeados; daqui pra frente, capturada a cada mês).
      </p>

      <div className="mt-6">
        <Suspense fallback={<FaturamentoDetalheSkeleton />}>
          <FaturamentoDetalhe periodo={periodo} />
        </Suspense>
      </div>
    </div>
  );
}
