import { carregarRelatorioCustos, type MesRelatorio } from "@/data/relatorio-custos";
import { GRUPOS, fracao, projetarMes, somarMeses, type GrupoCusto } from "@/domain/custo-grupos";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { PageHeader, Card, BackLink, StatCard, SectionTitle, BarList, HeroStat } from "@/components/ui";
import { CustoPorRegiao } from "./regioes";

const COR: Record<GrupoCusto, string> = {
  galpao: "bg-[#1b2168]",
  entrega: "bg-amber-400",
  administrativo: "bg-slate-400",
};

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

      {/* Totalizador: o custo do mês inteiro e quanto ele come do faturamento */}
      <HeroStat label={`Custo logístico · ${formatMesAno(custoMes.mes)}`} value={formatBRL(custoMes.total)}>
        <p className="mt-2 text-sm text-white/60">Tudo o que a logística custa no mês: folha, aluguel do galpão, equipamentos e frota · {pessoas} pessoas</p>
        <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          {GRUPOS.map(({ chave, label }) => (
            <Totalizador key={chave} rotulo={label} valor={formatBRL(custoMes.grupos[chave].total)} sub={`${pct(fracao(custoMes.grupos[chave].total, custoMes.total))} do custo`} cor={COR[chave]} />
          ))}
          <Totalizador
            rotulo="Faturamento até hoje"
            valor={brl(fatMes)}
            sub={fatMesProjetado === null ? "Winthor indisponível" : `no ritmo, fecha em ${formatBRL(fatMesProjetado)}`}
          />
          <Totalizador
            rotulo="Custo a cada R$ 100 faturados"
            valor={fatMesProjetado ? formatBRL((custoMes.total / fatMesProjetado) * 100) : "—"}
            sub={`${pct(fracao(custoMes.total, fatMesProjetado))} do faturamento, no ritmo do mês`}
          />
          <Totalizador
            rotulo={`Média · ${n} ${n === 1 ? "mês fechado" : "meses fechados"}`}
            valor={n ? formatBRL(acum.total / n) : "—"}
            sub={n ? `por mês · ${pct(fracao(acum.total, fatAcum))} do faturamento` : "sem mês fechado"}
          />
        </div>
      </HeroStat>

      {/* Os 4 números pedidos */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Galpão no custo"
          value={pct(fracao(custoMes.grupos.galpao.total, custoMes.total))}
          hint={`${formatBRL(custoMes.grupos.galpao.total)} · ${custoMes.grupos.galpao.pessoas} pessoas`}
          accent="navy"
          title="Folha de quem trabalha no galpão + aluguel do galpão + equipamentos + casa, sobre o custo total do mês"
        />
        <StatCard
          label="Entrega no custo"
          value={pct(fracao(entregaMes, custoMes.total))}
          hint={`${formatBRL(entregaMes)} · ${custoMes.grupos.entrega.pessoas} pessoas`}
          accent="gold"
          title="Motoristas + ajudantes de entrega + frota (diesel, desgaste e manutenção), sobre o custo total do mês"
        />
        <StatCard
          label="Custo ÷ faturamento no ano"
          value={pct(fracao(acum.total, fatAcum))}
          hint={n ? `${faixa} · média ${formatBRL(acum.total / n)}/mês` : "sem mês fechado"}
          accent="navy"
          title={
            n
              ? `Meses fechados com custo registrado (${faixa}). Custo ${formatBRL(acum.total)} ÷ faturamento ${formatBRL(fatAcum)}. Média mensal: custo ${formatBRL(acum.total / n)} × faturamento ${formatBRL(fatAcum / n)}.`
              : undefined
          }
        />
        <StatCard
          label={`Custo ÷ faturamento · ${formatMesAno(custoMes.mes)}`}
          value={pct(fracao(custoMes.total, fatMes))}
          hint={fatMesProjetado === null ? "faturamento indisponível" : `no ritmo do mês: ${pct(fracao(custoMes.total, fatMesProjetado))}`}
          accent="gold"
          title={
            fatMes === null
              ? undefined
              : `Custo do mês ${formatBRL(custoMes.total)} ÷ faturamento até hoje ${formatBRL(fatMes)}. No ritmo atual o mês fecha em ~${formatBRL(fatMesProjetado ?? 0)}.`
          }
        />
      </div>

      {/* Divisão do custo do mês */}
      <section className="mt-6">
        <SectionTitle>Divisão do custo · {formatMesAno(custoMes.mes)}</SectionTitle>
        <Explica>
          Galpão = quem separa, confere e carrega + aluguel, equipamentos e casa. Entrega = motoristas, ajudantes e frota (diesel, desgaste,
          manutenção). Galpão Administrativo = monitoramento e escritório.
        </Explica>
        <Card className="p-5">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
            {GRUPOS.map(({ chave, label }) => {
              const f = fracao(custoMes.grupos[chave].total, custoMes.total) ?? 0;
              return <div key={chave} className={`${COR[chave]} crescer-x h-full`} style={{ width: `${f * 100}%` }} title={`${label}: ${pct(f)}`} />;
            })}
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {GRUPOS.map(({ chave, label }) => {
              const g = custoMes.grupos[chave];
              return (
                <div key={chave} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${COR[chave]}`} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                  </div>
                  <p className="mt-1 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">{formatBRL(g.total)}</p>
                  <p className="text-sm text-slate-500">
                    {pct(fracao(g.total, custoMes.total))} do custo ·{" "}
                    <span title="Sobre o faturamento projetado do mês">{pct(fracao(g.total, fatMesProjetado), 2)} do faturamento</span>
                  </p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <Linha rotulo="Folha" valor={g.folha} />
                    <Linha rotulo="Fixos" valor={g.fixos} />
                    <Linha rotulo="Variáveis" valor={g.variaveis} />
                    {g.pessoas > 0 && <Linha rotulo="Custo médio por pessoa" valor={g.folha / g.pessoas} />}
                  </dl>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Indicadores de entrega */}
      <section className="mt-6">
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
            value={
              atual.atendimentos ? formatBRL(entregaMes / projetarMes(atual.atendimentos)) : "—"
            }
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
      <section className="mt-6">
        <SectionTitle>Mês a mês</SectionTitle>
        <Explica>Custo de cada mês e quanto ele representa do faturamento daquele mês.</Explica>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mês</th>
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
                      {GRUPOS.map(({ chave }) => (
                        <td key={chave} className="px-4 py-3 text-right">
                          {formatBRL(acum.grupos[chave].total)}
                          <span className="block text-xs font-normal text-slate-400">{pct(fracao(acum.grupos[chave].total, acum.total))}</span>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">{formatBRL(acum.total)}</td>
                      <td className="px-4 py-3 text-right">{formatBRL(fatAcum)}</td>
                      <td className="px-4 py-3 text-right">{pct(fracao(acum.total, fatAcum), 2)}</td>
                    </tr>
                    <tr className="bg-slate-50/60 text-slate-600">
                      <td className="px-4 py-3">Média mensal</td>
                      {GRUPOS.map(({ chave }) => (
                        <td key={chave} className="px-4 py-3 text-right">{formatBRL(acum.grupos[chave].total / n)}</td>
                      ))}
                      <td className="px-4 py-3 text-right">{formatBRL(acum.total / n)}</td>
                      <td className="px-4 py-3 text-right">{formatBRL(fatAcum / n)}</td>
                      <td className="px-4 py-3 text-right">{pct(fracao(acum.total, fatAcum), 2)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Folha por setor */}
      <section className="mt-6">
        <SectionTitle>Folha por setor · {formatMesAno(custoMes.mes)}</SectionTitle>
        <Explica>Salário + encargos de quem está ativo hoje, por setor (entre parênteses, nº de pessoas).</Explica>
        <div className="grid gap-4 lg:grid-cols-3">
          {GRUPOS.map(({ chave, label }) => {
            const itens = custoMes.setores.filter((s) => s.grupo === chave);
            return (
              <Card key={chave} className="p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <BarList
                  tone={chave === "entrega" ? "gold" : "navy"}
                  items={itens.map((s) => ({ label: `${s.setor} (${s.pessoas})`, value: s.folha, display: formatBRL(s.folha) }))}
                />
              </Card>
            );
          })}
        </div>
      </section>

      {rel.faturamentoMesAtualIndisponivel && (
        <p className="mt-4 text-xs text-amber-700">Winthor indisponível agora: o faturamento do mês corrente não carregou.</p>
      )}
    </div>
  );
}

function Explica({ children }: { children: React.ReactNode }) {
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

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="font-semibold tabular-nums text-[#141a4d]">{formatBRL(valor)}</dd>
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
      {GRUPOS.map(({ chave }) => (
        <td key={chave} className="px-4 py-3 text-right text-slate-600">
          {formatBRL(c.grupos[chave].total)}
          <span className="block text-xs text-slate-400">{pct(fracao(c.grupos[chave].total, c.total))}</span>
        </td>
      ))}
      <td className="px-4 py-3 text-right font-semibold text-[#141a4d]">{formatBRL(c.total)}</td>
      <td className="px-4 py-3 text-right text-slate-600" title={m.fechado ? undefined : "Até hoje"}>{brl(m.vendaLiquida)}</td>
      <td className="px-4 py-3 text-right font-semibold text-[#141a4d]" title={m.fechado ? undefined : "Sobre o faturamento até hoje"}>
        {pct(fracao(c.total, m.vendaLiquida), 2)}
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
