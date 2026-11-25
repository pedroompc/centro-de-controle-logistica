import type { ReactNode } from "react";
import { carregarRelatorioCustos, type MesRelatorio, type RelatorioCustos } from "@/data/relatorio-custos";
import { GRUPOS, fracao, juntarMeses, projetarMes, somarMeses, type CustoGruposMes, type GrupoCusto } from "@/domain/custo-grupos";
import { custoLiquido } from "@/domain/receitas-metrics";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno, lerPeriodo } from "@/domain/periodo";
import { PeriodoNav } from "@/components/periodo-nav";
import Link from "next/link";
import { PageHeader, Card, StatCard, SectionTitle, HeroStat } from "@/components/ui";
import { CustoPorRegiao } from "./regioes";

const COR: Record<GrupoCusto, string> = {
  galpao: "bg-[#1b2168]",
  entrega: "bg-amber-400",
  administrativo: "bg-slate-400",
};
const COR_ALUGUEL = "bg-sky-300";

const pct = (f: number | null, casas = 1) => (f === null ? "—" : formatPercent(f, casas));
const brl = (v: number | null) => (v === null ? "—" : formatBRL(v));

const hrefRelatorio = (p: Record<string, string>) => (Object.keys(p).length ? `/custos?${new URLSearchParams(p)}` : "/custos");

/** Soma uma coluna dos meses; `null` se algum mês não tem o dado. */
const somaOuNull = (ms: MesRelatorio[], f: (m: MesRelatorio) => number | null) =>
  ms.some((m) => f(m) === null) ? null : ms.reduce((t, m) => t + (f(m) ?? 0), 0);

export default async function RelatorioCustosPage({ searchParams }: { searchParams: Promise<{ mes?: string; de?: string; ate?: string }> }) {
  const periodo = lerPeriodo(await searchParams);
  const rel = await carregarRelatorioCustos(periodo);
  const doPeriodo = rel.meses.filter((m) => rel.mesesPeriodo.includes(m.custo.mes));
  const ultimo = doPeriodo[doPeriodo.length - 1];
  const temAberto = doPeriodo.some((m) => !m.fechado);
  const rotulo =
    doPeriodo.length > 1 ? `${formatMesAno(doPeriodo[0].custo.mes)} a ${formatMesAno(ultimo.custo.mes)}` : formatMesAno(ultimo.custo.mes);

  // Acumulado do ano: meses fechados do ano do fim do período, até ele.
  const fechados = rel.meses.filter((m) => m.fechado && m.vendaLiquida !== null && m.custo.mes >= `${rel.ano}-01-01`);
  const acum = somarMeses(fechados.map((m) => m.custo));
  const fatAcum = fechados.reduce((t, m) => t + (m.vendaLiquida ?? 0), 0);
  const n = fechados.length;
  const faixa = n ? `${formatMesAno(fechados[0].custo.mes)} a ${formatMesAno(fechados[n - 1].custo.mes)}` : "—";

  const fatMes = somaOuNull(doPeriodo, (m) => m.vendaLiquida);
  const receitaMes = somaOuNull(doPeriodo, (m) => m.receita);
  // Receita dos meses fechados (mesma janela do acumulado); null se algum mês não carregou.
  const receitaAcum = fechados.some((m) => m.receita === null) ? null : fechados.reduce((t, m) => t + (m.receita ?? 0), 0);
  const custoMes = juntarMeses(doPeriodo.map((m) => m.custo));
  const entregaMes = custoMes.grupos.entrega.total;
  // Mês em aberto: custo é o mês cheio, então as entregas dele vão ao ritmo do mês.
  const entregasRitmo = somaOuNull(doPeriodo, (m) => (m.entregas === null ? null : m.fechado ? m.entregas : projetarMes(m.entregas)));
  const entregasAteHoje = somaOuNull(doPeriodo, (m) => m.entregas);
  const custoRegioes = rel.meses.find((m) => m.custo.mes === rel.regioes.mes)?.custo ?? null;
  const pessoas = GRUPOS.reduce((t, { chave }) => t + custoMes.grupos[chave].pessoas, 0);

  // Tabela: meses da tabela, com Acumulado/Média só dos fechados dela.
  const mesesTabela = rel.meses.filter((m) => rel.mesesTabela.includes(m.custo.mes));
  const fechTab = mesesTabela.filter((m) => m.fechado && m.vendaLiquida !== null);
  const acumTab = somarMeses(fechTab.map((m) => m.custo));
  const fatAcumTab = fechTab.reduce((t, m) => t + (m.vendaLiquida ?? 0), 0);
  const faixaTab = fechTab.length ? `${formatMesAno(fechTab[0].custo.mes)} a ${formatMesAno(fechTab[fechTab.length - 1].custo.mes)}` : "—";

  return (
    <div>
      <PageHeader title="Custos" subtitle={`Custo logístico × faturamento · ${rotulo}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/custos/lancamentos"
            title="Lançar custo fixo, variável, equipamentos e frota"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50"
          >
            + Lançamento
          </Link>
          <Link
            href="/custos/agregados"
            title="Custo, faturado e devolução de cada agregado, comparado com a casa"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50"
          >
            Agregados
          </Link>
          <PeriodoNav periodo={periodo} hrefFor={hrefRelatorio} />
        </div>
      </PageHeader>

      {/* Totalizador: tudo o que a logística custa no mês */}
      <HeroStat label={`Custo logístico · ${rotulo}`} value={formatBRL(custoMes.totalComAluguel)}>
        <p className="mt-2 text-sm text-white/60">
          Aluguel do galpão + folha + equipamentos + frota · {pessoas} pessoas{doPeriodo.length > 1 ? ` em ${formatMesAno(ultimo.custo.mes)}` : ""}
        </p>
        <p className="mt-1.5 text-base text-white/70">
          Sem o aluguel: <span className="font-[family-name:var(--font-sora)] font-bold tabular-nums text-white">{formatBRL(custoMes.total)}</span>
          {receitaMes !== null && (
            <>
              <span className="mx-3 text-white/25">·</span>
              <span title="Recebido + abonado (FOB) ao preço praticado">Receita:</span> <span className="font-[family-name:var(--font-sora)] font-bold tabular-nums text-emerald-400">{formatBRL(receitaMes)}</span>
            </>
          )}
        </p>
        <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <Totalizador rotulo="Aluguel do galpão" valor={formatBRL(custoMes.aluguel)} sub="estrutura, à parte das equipes" cor={COR_ALUGUEL} />
          {GRUPOS.map(({ chave, label }) => (
            <Totalizador
              key={chave}
              rotulo={label}
              valor={formatBRL(custoMes.grupos[chave].total)}
              sub={`${custoMes.grupos[chave].pessoas} pessoas`}
              cor={COR[chave]}
            />
          ))}
        </div>
        <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-white/10 pt-5 sm:grid-cols-3">
          <Totalizador
            rotulo={temAberto ? "Faturamento até hoje" : "Faturamento"}
            valor={brl(fatMes)}
            sub={fatMes === null ? "Winthor indisponível" : temAberto ? "venda líquida, puxada agora do Winthor" : "venda líquida do período"}
          />
          <Totalizador
            rotulo="Custo logístico"
            valor={pct(fracao(custoMes.totalComAluguel, fatMes), 2)}
            sub={fatMes ? undefined : "Winthor indisponível"}
            extra={
              fatMes
                ? [
                    `Sem o aluguel: ${pct(fracao(custoMes.total, fatMes), 2)}`,
                    ...(receitaMes === null ? [] : [`Sem o aluguel, com a receita: ${pct(fracao(custoLiquido(custoMes.total, receitaMes), fatMes), 2)}`]),
                  ]
                : undefined
            }
          />
          <Totalizador
            rotulo={`Custo logístico · acumulado do ano`}
            valor={n ? pct(fracao(acum.totalComAluguel, fatAcum), 2) : "—"}
            sub={n ? undefined : "sem mês fechado"}
            titulo={n ? `Média ${formatBRL(acum.totalComAluguel / n)} de custo ÷ ${formatBRL(fatAcum / n)} faturados por mês · ${faixa}` : undefined}
            extra={
              n
                ? [
                    `Sem o aluguel: ${pct(fracao(acum.total, fatAcum), 2)}`,
                    ...(receitaAcum === null ? [] : [`Sem o aluguel, com a receita: ${pct(fracao(custoLiquido(acum.total, receitaAcum), fatAcum), 2)}`]),
                  ]
                : undefined
            }
          />
        </div>
      </HeroStat>

      <Divisao custo={custoMes} rotulo={rotulo} fatMes={fatMes} pessoasPorSetor={rel.pessoasPorSetor} />

      {/* Indicadores de entrega */}
      <section className="mt-8">
        <SectionTitle>Entrega · {rotulo}</SectionTitle>
        <Explica>Quanto custa levar a mercadoria até o cliente, comparado com o que foi vendido em entrega (sem a retira no balcão).</Explica>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Custo de entrega ÷ venda entregue"
            value={pct(fracao(entregaMes, rel.vendaEntregaPeriodo))}
            hint={rel.vendaEntregaPeriodo === null ? "Winthor indisponível" : `venda entregue${temAberto ? " até hoje" : ""} ${formatBRL(rel.vendaEntregaPeriodo)}`}
            accent="gold"
            title="Custo do grupo Entrega sobre a venda líquida que saiu em carga com motorista (sem retira), até agora"
          />
          <StatCard
            label="Custo por entrega"
            value={entregasRitmo ? formatBRL(entregaMes / entregasRitmo) : "—"}
            hint={entregasAteHoje ? `${entregasAteHoje.toLocaleString("pt-BR")} entregas${temAberto ? " até hoje" : ""}` : "Winthor indisponível"}
            accent="navy"
            title="Custo da Logística Entrega (mês cheio) ÷ entregas do mês no ritmo de hoje. Entrega = cliente distinto por viagem (veículo + motorista + dia), sem a retira no balcão — mesma conta do BI Motoristas"
          />
          <StatCard
            label="Ticket médio por entrega"
            value={rel.vendaEntregaPeriodo !== null && entregasAteHoje ? formatBRL(rel.vendaEntregaPeriodo / entregasAteHoje) : "—"}
            hint={rel.vendaEntregaPeriodo === null || !entregasAteHoje ? "Winthor indisponível" : `venda entregue ÷ ${entregasAteHoje.toLocaleString("pt-BR")} entregas`}
            accent="navy"
            title="Venda líquida que saiu em carga com motorista (sem retira) ÷ entregas, na mesma janela (até hoje no mês aberto)"
          />
          <StatCard
            label="Custo por entrega · média do ano"
            value={mediaPorEntrega(fechados)}
            hint={n ? faixa : "sem mês fechado"}
            accent="navy"
            title="Custo da Logística Entrega ÷ entregas, somando os meses fechados"
          />
        </div>
      </section>

      {custoRegioes && (
        <CustoPorRegiao
          mes={rel.regioes.mes}
          base={rel.regioes.base}
          custoEntrega={custoRegioes.grupos.entrega.total}
          custoGalpao={custoRegioes.grupos.galpao.total + custoRegioes.grupos.administrativo.total}
        />
      )}

      {/* Mês a mês */}
      <section className="mt-8">
        <SectionTitle>Mês a mês</SectionTitle>
        <Explica>Custo de cada mês e quanto ele representa do faturamento daquele mês.</Explica>
        <TabelaMesAMes meses={mesesTabela} acum={acumTab} fatAcum={fatAcumTab} n={fechTab.length} faixa={faixaTab} />
      </section>

      {rel.faturamentoMesAtualIndisponivel && (
        <p className="mt-4 text-xs text-amber-700">Winthor indisponível agora: o faturamento do mês corrente não carregou.</p>
      )}
    </div>
  );
}

/** Divisão do custo das equipes (sem o aluguel), com folha/fixos/variáveis abrindo em detalhe. */
function Divisao({
  custo,
  rotulo,
  fatMes,
  pessoasPorSetor,
}: {
  custo: CustoGruposMes;
  rotulo: string;
  fatMes: number | null;
  pessoasPorSetor: RelatorioCustos["pessoasPorSetor"];
}) {
  return (
    <section className="mt-8">
      <SectionTitle>Divisão do custo · {rotulo}</SectionTitle>
      <Explica>
        Sem o aluguel do galpão (está à parte, no topo). Clique em Folha, Fixos ou Variáveis para abrir o detalhe; na folha, clique no setor
        para ver as pessoas.
      </Explica>
      <Card className="p-5">
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
          {GRUPOS.map(({ chave, label }) => {
            const f = fracao(custo.grupos[chave].total, custo.total) ?? 0;
            return <div key={chave} className={`${COR[chave]} crescer-x h-full`} style={{ width: `${f * 100}%` }} title={`${label}: ${pct(f)}`} />;
          })}
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          {GRUPOS.map(({ chave, label }) => {
            const g = custo.grupos[chave];
            const setores = custo.setores.filter((s) => s.grupo === chave);
            const fixos = custo.lancamentos.filter((l) => l.grupo === chave && l.tipo === "fixo");
            const variaveis = custo.lancamentos.filter((l) => l.grupo === chave && l.tipo === "variavel");
            return (
              <div key={chave} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${COR[chave]}`} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                </div>
                <p className="mt-1 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">{formatBRL(g.total)}</p>
                <p className="text-sm text-slate-500">
                  {pct(fracao(g.total, custo.total))} das equipes ·{" "}
                  <span title="Sobre o faturamento do mês até agora">{pct(fracao(g.total, fatMes), 2)} do faturamento</span>
                </p>

                <div className="mt-3 divide-y divide-slate-100 border-y border-slate-100 text-sm">
                  <Abre rotulo="Folha" valor={g.folha} vazio={setores.length === 0}>
                    {setores.map((s) => (
                      <Abre key={s.setor} rotulo={`${s.setor} (${s.pessoas})`} valor={s.folha} nivel={1} vazio={!pessoasPorSetor[s.setor]?.length}>
                        {(pessoasPorSetor[s.setor] ?? []).map((p, i) => (
                          <Item key={`${p.nome}-${i}`} rotulo={p.nome} sub={p.cargo} valor={p.custo} />
                        ))}
                      </Abre>
                    ))}
                  </Abre>
                  <Abre rotulo="Fixos" valor={g.fixos} vazio={fixos.length === 0}>
                    {fixos.map((l) => (
                      <Item key={l.nome} rotulo={l.nome} valor={l.valor} />
                    ))}
                  </Abre>
                  <Abre rotulo="Variáveis" valor={g.variaveis} vazio={variaveis.length === 0}>
                    {variaveis.map((l) => (
                      <Item key={l.nome} rotulo={l.nome} valor={l.valor} />
                    ))}
                  </Abre>
                </div>
                {g.pessoas > 0 && (
                  <p className="mt-2 flex justify-between text-sm text-slate-500">
                    <span>Custo médio por pessoa</span>
                    <span className="font-semibold tabular-nums text-[#141a4d]">{formatBRL(g.folha / g.pessoas)}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

/** Linha que abre (details nativo, sem JS). `vazio` = sem detalhe, vira linha simples. */
function Abre({
  rotulo,
  valor,
  children,
  nivel = 0,
  vazio = false,
}: {
  rotulo: string;
  valor: number;
  children?: ReactNode;
  nivel?: 0 | 1;
  vazio?: boolean;
}) {
  const recuo = nivel ? "pl-5" : "";
  const texto = (
    <span className={`min-w-0 truncate ${nivel ? "text-slate-600" : "text-slate-700"}`} title={rotulo}>
      {rotulo}
    </span>
  );
  const total = <span className="shrink-0 font-semibold tabular-nums text-[#141a4d]">{formatBRL(valor)}</span>;
  if (vazio) {
    return (
      <div className={`flex items-center justify-between gap-3 py-2 ${recuo}`}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="w-3.5 shrink-0" />
          {texto}
        </span>
        {total}
      </div>
    );
  }
  return (
    <details className="group">
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded py-2 hover:bg-slate-50 [&::-webkit-details-marker]:hidden ${recuo}`}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="w-3.5 shrink-0 text-[10px] text-slate-400 transition-transform group-open:rotate-90">▶</span>
          {texto}
        </span>
        {total}
      </summary>
      <div className={`mb-2 rounded-lg bg-slate-50/80 py-1 ${nivel ? "ml-5" : ""}`}>{children}</div>
    </details>
  );
}

function Item({ rotulo, sub, valor }: { rotulo: string; sub?: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1 text-[13px]">
      <span className="min-w-0 truncate text-slate-600" title={sub ? `${rotulo} · ${sub}` : rotulo}>
        {rotulo}
        {sub && <span className="ml-1.5 text-xs text-slate-400">{sub}</span>}
      </span>
      <span className="shrink-0 tabular-nums text-slate-700">{formatBRL(valor)}</span>
    </div>
  );
}

function Explica({ children }: { children: ReactNode }) {
  return <p className="-mt-1 mb-4 max-w-4xl text-sm text-slate-500">{children}</p>;
}

function Totalizador({ rotulo, valor, sub, cor, extra, titulo }: { rotulo: string; valor: string; sub?: string; cor?: string; extra?: string | string[]; titulo?: string }) {
  const extras = extra === undefined ? [] : Array.isArray(extra) ? extra : [extra];
  return (
    <div className="min-w-0" title={titulo}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
        {cor && <span className={`h-2 w-2 shrink-0 rounded-full ${cor} ring-1 ring-white/40`} />}
        <span className="truncate" title={rotulo}>{rotulo}</span>
      </p>
      <p className="mt-1 font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums whitespace-nowrap text-white">{valor}</p>
      {sub && <p className="text-xs text-white/50">{sub}</p>}
      {extras.map((e) => (
        <p key={e} className="mt-1.5 text-sm font-semibold text-white/80">{e}</p>
      ))}
    </div>
  );
}

/**
 * Mês a mês no formato que a diretoria lê: meses nas COLUNAS, indicadores nas
 * LINHAS, fechando com Acumulado (meses fechados) e Média mensal.
 */
function TabelaMesAMes({ meses, acum, fatAcum, n, faixa }: { meses: MesRelatorio[]; acum: Pick<CustoGruposMes, "grupos" | "aluguel" | "totalComAluguel">; fatAcum: number; n: number; faixa: string }) {
  const pessoasDe = (c: CustoGruposMes) => GRUPOS.reduce((t, { chave }) => t + c.grupos[chave].pessoas, 0);
  const fechados = meses.filter((m) => m.fechado);
  const mediaPessoas = n ? fechados.reduce((t, m) => t + pessoasDe(m.custo), 0) / n : 0;
  type Linha = { rotulo: string; mes: (m: MesRelatorio) => string; acum: string; media: string; forte?: boolean; titulo?: (m: MesRelatorio) => string | undefined };
  const linhas: Linha[] = [
    { rotulo: "Funcionários", mes: (m) => pessoasDe(m.custo).toLocaleString("pt-BR"), acum: "—", media: n ? Math.round(mediaPessoas).toLocaleString("pt-BR") : "—" },
    { rotulo: "Aluguel do galpão", mes: (m) => (m.custo.aluguel > 0 ? formatBRL(m.custo.aluguel) : "—"), acum: formatBRL(acum.aluguel), media: formatBRL(acum.aluguel / (n || 1)) },
    ...GRUPOS.map(({ chave, label }) => ({
      rotulo: label,
      mes: (m: MesRelatorio) => formatBRL(m.custo.grupos[chave].total),
      acum: formatBRL(acum.grupos[chave].total),
      media: formatBRL(acum.grupos[chave].total / (n || 1)),
    })),
    { rotulo: "Custo total", forte: true, mes: (m) => formatBRL(m.custo.totalComAluguel), acum: formatBRL(acum.totalComAluguel), media: formatBRL(acum.totalComAluguel / (n || 1)) },
    { rotulo: "Faturamento", mes: (m) => brl(m.vendaLiquida), titulo: (m) => (m.fechado ? undefined : "Até hoje"), acum: formatBRL(fatAcum), media: formatBRL(fatAcum / (n || 1)) },
    {
      rotulo: "Custo logístico %",
      forte: true,
      mes: (m) => pct(fracao(m.custo.totalComAluguel, m.vendaLiquida), 2),
      titulo: (m) => (m.fechado ? undefined : "Sobre o faturamento até hoje"),
      acum: pct(fracao(acum.totalComAluguel, fatAcum), 2),
      media: pct(fracao(acum.totalComAluguel, fatAcum), 2),
    },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-3 font-semibold" />
              {meses.map((m) => (
                <th key={m.custo.mes} className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                  {formatMesAno(m.custo.mes)}
                  {!m.fechado && <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">em aberto</span>}
                </th>
              ))}
              {n > 0 && (
                <>
                  <th className="whitespace-nowrap border-l-2 border-slate-200 px-4 py-3 text-right font-semibold text-[#141a4d]" title={faixa}>
                    Acumulado ({n} {n === 1 ? "mês" : "meses"})
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Média mensal</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {linhas.map((l) => (
              <tr key={l.rotulo} className={`border-b border-slate-50 last:border-0 ${l.forte ? "font-semibold text-[#141a4d]" : "text-slate-600"}`}>
                <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-3 font-medium text-[#141a4d]">{l.rotulo}</td>
                {meses.map((m) => (
                  <td key={m.custo.mes} className="whitespace-nowrap px-4 py-3 text-right" title={l.titulo?.(m)}>
                    {l.mes(m)}
                  </td>
                ))}
                {n > 0 && (
                  <>
                    <td className="whitespace-nowrap border-l-2 border-slate-200 bg-slate-50/60 px-4 py-3 text-right font-semibold text-[#141a4d]">{l.acum}</td>
                    <td className="whitespace-nowrap bg-slate-50/60 px-4 py-3 text-right">{l.media}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function mediaPorEntrega(fechados: MesRelatorio[]): string {
  const comEntrega = fechados.filter((m) => (m.entregas ?? 0) > 0);
  const entregas = comEntrega.reduce((t, m) => t + (m.entregas ?? 0), 0);
  if (entregas === 0) return "—";
  const custo = comEntrega.reduce((t, m) => t + m.custo.grupos.entrega.total, 0);
  return formatBRL(custo / entregas);
}
