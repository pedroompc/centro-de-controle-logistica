import type { ReactNode } from "react";
import { carregarRelatorioCustos, type MesRelatorio, type RelatorioCustos } from "@/data/relatorio-custos";
import { GRUPOS, fracao, projetarMes, somarMeses, type CustoGruposMes, type GrupoCusto } from "@/domain/custo-grupos";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { PageHeader, Card, BackLink, StatCard, SectionTitle, HeroStat } from "@/components/ui";
import { CustoPorRegiao } from "./regioes";

const COR: Record<GrupoCusto, string> = {
  galpao: "bg-[#1b2168]",
  entrega: "bg-amber-400",
  administrativo: "bg-slate-400",
};
const COR_ALUGUEL = "bg-sky-300";

const pct = (f: number | null, casas = 1) => (f === null ? "—" : formatPercent(f, casas));
const brl = (v: number | null) => (v === null ? "—" : formatBRL(v));

export default async function RelatorioCustosPage() {
  const rel = await carregarRelatorioCustos();
  const atual = rel.meses[rel.meses.length - 1];
  const fechados = rel.meses.filter((m) => m.fechado && m.vendaLiquida !== null);
  const acum = somarMeses(fechados.map((m) => m.custo));
  const fatAcum = fechados.reduce((t, m) => t + (m.vendaLiquida ?? 0), 0);
  const n = fechados.length;
  const faixa = n ? `${formatMesAno(fechados[0].custo.mes)} a ${formatMesAno(fechados[n - 1].custo.mes)}` : "—";

  const fatMes = atual.vendaLiquida;
  const fatMesProjetado = fatMes === null ? null : projetarMes(fatMes);
  const custoMes = atual.custo;
  const entregaMes = custoMes.grupos.entrega.total;
  const custoRegioes = rel.meses.find((m) => m.custo.mes === rel.regioes.mes)?.custo ?? null;
  const pessoas = GRUPOS.reduce((t, { chave }) => t + custoMes.grupos[chave].pessoas, 0);

  return (
    <div>
      <BackLink href="/custos">Custos</BackLink>
      <PageHeader title="Relatório geral" subtitle={`Custo logístico × faturamento · ${rel.ano}`} />

      {/* Totalizador: tudo o que a logística custa no mês */}
      <HeroStat label={`Custo logístico · ${formatMesAno(custoMes.mes)}`} value={formatBRL(custoMes.totalComAluguel)}>
        <p className="mt-2 text-sm text-white/60">Aluguel do galpão + folha + equipamentos + frota · {pessoas} pessoas</p>
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
            rotulo="Faturamento até hoje"
            valor={brl(fatMes)}
            sub={fatMesProjetado === null ? "Winthor indisponível" : `no ritmo, o mês fecha em ${formatBRL(fatMesProjetado)}`}
          />
          <Totalizador
            rotulo="Custo logístico"
            valor={pct(fracao(custoMes.totalComAluguel, fatMesProjetado), 2)}
            sub={fatMesProjetado ? `do faturamento · custo do mês ÷ ${formatBRL(fatMesProjetado)} (fechamento no ritmo)` : "Winthor indisponível"}
          />
          <Totalizador
            rotulo={`Média · ${n} ${n === 1 ? "mês fechado" : "meses fechados"}`}
            valor={n ? formatBRL(acum.totalComAluguel / n) : "—"}
            sub={n ? `por mês · ${pct(fracao(acum.totalComAluguel, fatAcum))} do faturamento (${faixa})` : "sem mês fechado"}
          />
        </div>
      </HeroStat>

      <Divisao custo={custoMes} fatProjetado={fatMesProjetado} pessoasPorSetor={rel.pessoasPorSetor} />

      {/* Indicadores de entrega */}
      <section className="mt-8">
        <SectionTitle>Entrega · {formatMesAno(custoMes.mes)}</SectionTitle>
        <Explica>Quanto custa levar a mercadoria até o cliente, comparado com o que foi vendido em entrega (sem a retira no balcão).</Explica>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Custo de entrega ÷ venda entregue"
            value={pct(fracao(entregaMes, rel.vendaEntregaMesAtual === null ? null : projetarMes(rel.vendaEntregaMesAtual)))}
            hint={rel.vendaEntregaMesAtual === null ? "Winthor indisponível" : `venda entregue até hoje ${formatBRL(rel.vendaEntregaMesAtual)}`}
            accent="gold"
            title="Custo do grupo Entrega sobre a venda líquida que saiu em carga com motorista (sem retira), no ritmo do mês"
          />
          <StatCard
            label="Custo por PDV atendido"
            value={atual.atendimentos ? formatBRL(entregaMes / projetarMes(atual.atendimentos)) : "—"}
            hint={atual.atendimentos ? `${atual.atendimentos.toLocaleString("pt-BR")} PDVs atendidos até hoje` : "sem dado"}
            accent="navy"
            title="Custo do grupo Entrega ÷ PDVs atendidos (cliente distinto por dia), no ritmo do mês"
          />
          <StatCard
            label="Custo por PDV · média do ano"
            value={mediaPorPdv(fechados)}
            hint={n ? faixa : "sem mês fechado"}
            accent="navy"
            title="Custo do grupo Entrega ÷ PDVs atendidos, somando os meses fechados"
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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mês</th>
                  <th className="px-4 py-3 text-right font-semibold">Aluguel</th>
                  <th className="px-4 py-3 text-right font-semibold">Galpão</th>
                  <th className="px-4 py-3 text-right font-semibold">Entrega</th>
                  <th className="px-4 py-3 text-right font-semibold">Galpão Adm.</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo total</th>
                  <th className="px-4 py-3 text-right font-semibold">Faturamento</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo ÷ fat.</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rel.meses.map((m) => (
                  <LinhaMes key={m.custo.mes} m={m} />
                ))}
                {n > 0 && (
                  <>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold text-[#141a4d]">
                      <td className="px-4 py-3" title={faixa}>Acumulado ({n} {n === 1 ? "mês fechado" : "meses fechados"})</td>
                      <td className="px-4 py-3 text-right">{formatBRL(acum.aluguel)}</td>
                      {GRUPOS.map(({ chave }) => (
                        <td key={chave} className="px-4 py-3 text-right">{formatBRL(acum.grupos[chave].total)}</td>
                      ))}
                      <td className="px-4 py-3 text-right">{formatBRL(acum.totalComAluguel)}</td>
                      <td className="px-4 py-3 text-right">{formatBRL(fatAcum)}</td>
                      <td className="px-4 py-3 text-right">{pct(fracao(acum.totalComAluguel, fatAcum), 2)}</td>
                    </tr>
                    <tr className="bg-slate-50/60 text-slate-600">
                      <td className="px-4 py-3">Média mensal</td>
                      <td className="px-4 py-3 text-right">{formatBRL(acum.aluguel / n)}</td>
                      {GRUPOS.map(({ chave }) => (
                        <td key={chave} className="px-4 py-3 text-right">{formatBRL(acum.grupos[chave].total / n)}</td>
                      ))}
                      <td className="px-4 py-3 text-right">{formatBRL(acum.totalComAluguel / n)}</td>
                      <td className="px-4 py-3 text-right">{formatBRL(fatAcum / n)}</td>
                      <td className="px-4 py-3 text-right">{pct(fracao(acum.totalComAluguel, fatAcum), 2)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
  fatProjetado,
  pessoasPorSetor,
}: {
  custo: CustoGruposMes;
  fatProjetado: number | null;
  pessoasPorSetor: RelatorioCustos["pessoasPorSetor"];
}) {
  return (
    <section className="mt-8">
      <SectionTitle>Divisão do custo · {formatMesAno(custo.mes)}</SectionTitle>
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
                  <span title="Sobre o faturamento projetado do mês">{pct(fracao(g.total, fatProjetado), 2)} do faturamento</span>
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

function Totalizador({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub: string; cor?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
        {cor && <span className={`h-2 w-2 shrink-0 rounded-full ${cor} ring-1 ring-white/40`} />}
        <span className="truncate" title={rotulo}>{rotulo}</span>
      </p>
      <p className="mt-1 font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums whitespace-nowrap text-white">{valor}</p>
      <p className="text-xs text-white/50">{sub}</p>
    </div>
  );
}

function LinhaMes({ m }: { m: MesRelatorio }) {
  const c = m.custo;
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-4 py-3 font-medium text-[#141a4d]">
        {formatMesAno(c.mes)}
        {!m.fechado && <span className="ml-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">em aberto</span>}
      </td>
      <td className="px-4 py-3 text-right text-slate-600">{c.aluguel > 0 ? formatBRL(c.aluguel) : "—"}</td>
      {GRUPOS.map(({ chave }) => (
        <td key={chave} className="px-4 py-3 text-right text-slate-600">{formatBRL(c.grupos[chave].total)}</td>
      ))}
      <td className="px-4 py-3 text-right font-semibold text-[#141a4d]">{formatBRL(c.totalComAluguel)}</td>
      <td className="px-4 py-3 text-right text-slate-600" title={m.fechado ? undefined : "Até hoje"}>{brl(m.vendaLiquida)}</td>
      <td className="px-4 py-3 text-right font-semibold text-[#141a4d]" title={m.fechado ? undefined : "Sobre o faturamento até hoje"}>
        {pct(fracao(c.totalComAluguel, m.vendaLiquida), 2)}
      </td>
    </tr>
  );
}

function mediaPorPdv(fechados: MesRelatorio[]): string {
  const comPdv = fechados.filter((m) => (m.atendimentos ?? 0) > 0);
  const pdvs = comPdv.reduce((t, m) => t + (m.atendimentos ?? 0), 0);
  if (pdvs === 0) return "—";
  const custo = comPdv.reduce((t, m) => t + m.custo.grupos.entrega.total, 0);
  return formatBRL(custo / pdvs);
}
