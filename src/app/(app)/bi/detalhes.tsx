// Visões que os cartões da aba Geral abrem no palco (`?ver=`). Cada uma usa a
// MESMA regra do cartão que a abriu: o total aqui bate com o número lá em cima.
import type { ReactNode } from "react";
import { getFaturamentoPorDia } from "@/data/faturamento";
import { listarLancamentosDoMes, listarLancamentosDosMeses } from "@/data/custos-mensais";
import { serieEfetivoMensal } from "@/data/efetivo-mensal";
import { composicaoCusto, efetivoPorSetor, totalFaturamentoDias } from "@/domain/bi-geral-interativo";
import type { PontoCasa } from "@/domain/bi-geral-graficos";
import { formatBRL, formatPercent } from "@/domain/format";
import { mesDoPeriodo, mesesDoPeriodo, temHistoricoSupabase, type Periodo } from "@/domain/periodo";
import type { Funcionario, Setor } from "@/domain/types";
import { EfetivoLista, type GrupoTela } from "./detalhes-cliente";

const reais = (v: number) => formatBRL(Math.round(v)).replace(",00", "");
const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (mes: string) => `${MES_ABREV[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${DIAS_SEMANA[new Date(`${iso}T12:00:00`).getDay()]}`;
const TURNO: Record<string, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

function Caixa({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`entrar rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 ${className}`}>{children}</div>;
}

function Aviso({ children }: { children: ReactNode }) {
  return <Caixa><p className="text-sm text-white/50">{children}</p></Caixa>;
}

const TH = "pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/35";

export function DetalheCarregando() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((k) => <div key={k} className="h-9 animate-pulse rounded-lg bg-white/[0.05]" />)}
    </div>
  );
}

// --- Efetivo -----------------------------------------------------------------------

/** Custo por pessoa só sai do servidor para admin (a conta de leitura nem recebe o dado). */
export function DetalheEfetivo({ funcionarios, setores, admin }: { funcionarios: Funcionario[]; setores: Setor[]; admin: boolean }) {
  const grupos: GrupoTela[] = efetivoPorSetor(funcionarios, setores).map((g) => ({
    setor: g.setor,
    custo: admin ? reais(g.custo) : null,
    pessoas: g.pessoas.map((f) => ({
      id: f.id,
      nome: f.nome,
      cargo: f.cargo,
      turno: TURNO[f.turno] ?? f.turno,
      admissao: f.dataAdmissao ? f.dataAdmissao.split("-").reverse().join("/") : "—",
      custo: admin ? reais(f.custoMensal) : null,
    })),
  }));
  if (grupos.length === 0) return <Aviso>Nenhum funcionário ativo.</Aviso>;
  return <EfetivoLista grupos={grupos} />;
}

// --- Faturamento dia a dia ------------------------------------------------------------

export async function DetalheFaturamento({ periodo }: { periodo: Periodo }) {
  const linhas = await getFaturamentoPorDia(periodo.de, periodo.ate);
  if (linhas === null) return <Aviso>Winthor indisponível agora — tente de novo em instantes.</Aviso>;
  if (linhas.length === 0) return <Aviso>Sem faturamento no período.</Aviso>;
  const { dias, total } = totalFaturamentoDias(linhas);
  const max = Math.max(1, ...dias.map((d) => d.liquido));
  const melhor = dias.reduce((a, b) => (b.liquido > a.liquido ? b : a));
  return (
    <Caixa>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/55">
        <span>{dias.length} dias faturados</span>
        <span>média <b className="tabular-nums text-white">{reais(total.liquido / dias.length)}</b>/dia</span>
        <span>maior dia <b className="tabular-nums text-white">{diaCurto(melhor.dia)}</b> · {reais(melhor.liquido)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left">
              <th className={TH}>Dia</th>
              <th className={`${TH} w-[40%]`}>Líquido</th>
              <th className={`${TH} text-right`}>Venda</th>
              <th className={`${TH} text-right`}>Devolução</th>
              <th className={`${TH} text-right`}>Avulsa</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.dia} className="border-t border-white/[0.06] text-white/75" title={`${diaCurto(d.dia)}: líquido ${formatBRL(d.liquido)}`}>
                <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-white/60">{diaCurto(d.dia)}</td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 rounded" style={{ width: `${Math.max(1, (Math.max(0, d.liquido) / max) * 100)}%`, background: "#c2820a" }} />
                    <span className="whitespace-nowrap tabular-nums text-white">{reais(d.liquido)}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right tabular-nums">{reais(d.venda)}</td>
                <td className="py-1.5 text-right tabular-nums text-white/55">{d.devolucao ? reais(d.devolucao) : "—"}</td>
                <td className="py-1.5 text-right tabular-nums text-white/55">{d.avulsa ? reais(d.avulsa) : "—"}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-white/15 font-semibold text-white">
              <td className="pt-2">Total</td>
              <td className="pt-2 tabular-nums">{reais(total.liquido)}</td>
              <td className="pt-2 text-right tabular-nums">{reais(total.venda)}</td>
              <td className="pt-2 text-right tabular-nums">{reais(total.devolucao)}</td>
              <td className="pt-2 text-right tabular-nums">{reais(total.avulsa)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Caixa>
  );
}

// --- Custo logístico -----------------------------------------------------------------

/** Mesma regra do cartão (custoLogisticoDoPeriodo): mês inteiro = lançamentos + folha atual. */
export async function DetalheCusto({ periodo, funcionarios }: { periodo: Periodo; funcionarios: Funcionario[] }) {
  if (!temHistoricoSupabase(periodo)) return <Aviso>Sem histórico de custos antes de jul/2026.</Aviso>;
  const mes = mesDoPeriodo(periodo);
  const meses = mesesDoPeriodo(periodo);
  let folha: number;
  let lancamentos;
  if (mes) {
    lancamentos = await listarLancamentosDoMes(mes);
    folha = funcionarios.filter((f) => f.status === "ativo").reduce((t, f) => t + f.custoMensal, 0);
  } else {
    const [l, ef] = await Promise.all([listarLancamentosDosMeses(meses), serieEfetivoMensal(24)]);
    lancamentos = l;
    const porMes = new Map(ef.map((e) => [e.mes, e.folhaTotal]));
    folha = meses.reduce((t, m) => t + (porMes.get(m) ?? 0), 0);
  }
  const c = composicaoCusto({ folha, lancamentos, top: 12 });
  const partes = [
    { rotulo: mes ? "Folha (efetivo de hoje)" : "Folha", valor: c.folha },
    { rotulo: "Custos fixos", valor: c.fixos },
    { rotulo: "Custos variáveis", valor: c.variaveis },
  ];
  const maxL = Math.max(1, ...c.maiores.map((l) => l.valor));
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Caixa>
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Composição</span>
          <span className="font-[family-name:var(--font-sora)] text-xl font-extrabold tabular-nums text-white">{reais(c.total)}</span>
        </div>
        <div className="space-y-3">
          {partes.map((p) => (
            <div key={p.rotulo} title={`${p.rotulo}: ${formatBRL(p.valor)}`}>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{p.rotulo}</span>
                <span className="tabular-nums text-white">
                  {reais(p.valor)} <span className="text-white/40">· {c.total > 0 ? formatPercent(p.valor / c.total, 0) : "—"}</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded bg-white/[0.06]">
                <div className="h-full rounded" style={{ width: `${c.total > 0 ? (p.valor / c.total) * 100 : 0}%`, background: "#c2820a" }} />
              </div>
            </div>
          ))}
        </div>
      </Caixa>
      <Caixa>
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Maiores lançamentos</span>
        {c.maiores.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">Nenhum lançamento no período.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {c.maiores.map((l) => (
                <tr key={`${l.tipo}|${l.nome}`} className="border-t border-white/[0.06] first:border-t-0">
                  <td className="py-1.5 pr-3 text-white/75">
                    {l.nome} <span className="text-xs text-white/35">{l.tipo === "fixo" ? "fixo" : "variável"}</span>
                  </td>
                  <td className="w-[35%] py-1.5 pr-3">
                    <div className="h-2.5 rounded" style={{ width: `${Math.max(2, (l.valor / maxL) * 100)}%`, background: "#c2820a" }} />
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-white">{reais(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Caixa>
    </div>
  );
}

// --- Custo ÷ faturamento mês a mês -----------------------------------------------------------

export async function DetalheCustoSobreFat({ pontos }: { pontos: Promise<PontoCasa[]> }) {
  const ps = (await pontos).filter((p) => p.custo !== null || p.faturamento !== null).reverse();
  if (ps.length === 0) return <Aviso>Sem meses com faturamento e custo.</Aviso>;
  return (
    <Caixa>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left">
              <th className={TH}>Mês</th>
              <th className={`${TH} text-right`}>Faturamento líquido</th>
              <th className={`${TH} text-right`}>Custo logístico</th>
              <th className={`${TH} text-right`}>Custo ÷ faturamento</th>
            </tr>
          </thead>
          <tbody>
            {ps.map((p) => (
              <tr key={p.mes} className="border-t border-white/[0.06] text-white/75">
                <td className="py-1.5">
                  {rotuloMes(p.mes)} {p.parcial && <span className="text-xs text-white/40">parcial</span>}
                </td>
                <td className="py-1.5 text-right tabular-nums">{p.faturamento === null ? "—" : reais(p.faturamento)}</td>
                <td className="py-1.5 text-right tabular-nums">{p.custo === null ? "—" : reais(p.custo)}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-white">{p.custoSobreFat === null ? "—" : formatPercent(p.custoSobreFat, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Caixa>
  );
}
