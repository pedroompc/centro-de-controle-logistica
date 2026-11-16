import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { getResumoFaturamentoPeriodo } from "@/data/faturamento-mensal";
import { carregarResumoCasa } from "@/data/resumo-casa";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { mesAnterior, mesDoPeriodo, primeiroDiaDoMes, rotuloCurto, type Periodo, type PeriodoComparado } from "@/domain/periodo";
import { getSerieTendencias } from "@/data/faturamento-mensal";
import { serieCustosMensais } from "@/data/custos-mensais";
import { serieEfetivoMensal } from "@/data/efetivo-mensal";
import { montarEvolucaoCasa, montarPlacar, type PontoCasa } from "@/domain/bi-geral-graficos";
import { PainelEvolucao, Placar, type SerieEvolucao } from "./graficos";
import type { ResumoCasa } from "@/data/resumo-casa";
import { compararPct, compararTaxa, type Comparacao } from "@/domain/comparacao";
import {
  comNovaTentativa, criarFila, resumoAbastecimento, resumoMotoristas, resumoRecebimento, resumoSeparacao, variacao,
  type IndicadorGeral, type ResumoSetorGeral, type SetorGeral,
} from "@/domain/bi-geral";
import { ROTULO_ABA, hrefBI, pisoDaAba, type AbaBI } from "@/domain/bi-geral-rotas";
import type { Funcionario, Setor } from "@/domain/types";
import { BIShell, type HrefMes } from "../setores/[id]/bi-shell";
import { VariacaoTV } from "../setores/[id]/bi-ui";
import { carregarBISeparacao } from "../setores/[id]/separacao-dados";
import { carregarBIAbastecimento } from "../setores/[id]/abastecimento-dados";
import { carregarBIMotoristas } from "../setores/[id]/motoristas-dados";
import { carregarDadosRecebimento } from "../setores/[id]/conteudos-bi";

/** R$ sem centavos (número grande na tela). */
const reais = (v: number) => formatBRL(Math.round(v)).replace(",00", "");


type CargaSetor = ResumoSetorGeral | null | { erro: string };

/**
 * Cada carga roda UMA vez por tela (pela fila de 2) e é dividida entre quem
 * precisa dela: os cartões e o gráfico da casa; o bloco do setor e o placar.
 */
interface Cargas {
  casa: () => Promise<ResumoCasa>;
  casaBase: () => Promise<ResumoCasa | null>;
  setor: (s: SetorGeral) => Promise<CargaSetor>;
  setorBase: (s: SetorGeral) => Promise<ResumoSetorGeral | null>;
  /** Fotos mensais do faturamento: mês sem foto vai ao Winthor, então entra na fila também. */
  fechados: (qtd: number) => Promise<Awaited<ReturnType<typeof getSerieTendencias>>>;
}

/** Comparação antes do primeiro mês com dado do setor = sem base ("sem histórico"), nunca zero. */
function cmpDoSetor(s: SetorGeral, c: PeriodoComparado | null): PeriodoComparado | null {
  return c && c.periodo.de >= pisoDaAba(s as AbaBI) ? c : null;
}

function criarCargas(p: {
  periodo: Periodo; comparacao: PeriodoComparado | null; setores: Partial<Record<AbaBI, Setor>>; funcionarios: Funcionario[];
}): Cargas {
  const fila = criarFila(2);
  const memo = new Map<string, Promise<unknown>>();
  const uma = <T,>(k: string, f: () => Promise<T>): Promise<T> => {
    if (!memo.has(k)) memo.set(k, f());
    return memo.get(k) as Promise<T>;
  };
  return {
    fechados: (qtd) => uma("fechados", () => (qtd > 0 ? fila(() => getSerieTendencias(qtd)).catch(() => []) : Promise.resolve([]))),
    casa: () => uma("casa", () => fila(() => carregarResumoCasa(p.periodo))),
    casaBase: () => {
      const c = p.comparacao;
      return uma("casaBase", () => (c ? fila(() => carregarResumoCasa(c.periodo)).catch(() => null) : Promise.resolve(null)));
    },
    setor: (s) =>
      uma(`s:${s}`, () =>
        fila(() => resumoDoSetor(s, p.setores[s], p.funcionarios, p.periodo)).catch((e: unknown) => ({ erro: e instanceof Error ? e.message : String(e) })),
      ),
    setorBase: (s) => {
      const c = cmpDoSetor(s, p.comparacao);
      return uma(`b:${s}`, () => (c ? fila(() => resumoDoSetor(s, p.setores[s], p.funcionarios, c.periodo)).catch(() => null) : Promise.resolve(null)));
    },
  };
}

const SETORES: SetorGeral[] = ["separacao", "recebimento", "abastecimento", "motoristas"];

const fmt = (i: IndicadorGeral): string => {
  const v = i.valor;
  if (v === null) return "—";
  switch (i.formato) {
    case "int": return Math.round(v).toLocaleString("pt-BR");
    case "kg": return formatKg(v);
    case "brl": return reais(v);
    case "brlPorCx": return `${formatBRL(v)}/cx`;
    case "brlPorT": return `${formatBRL(v)}/t`;
    case "pct": return formatPercent(v, 2);
    case "permil": return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ‰`;
    case "km": return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
  }
};

// --- Números da casa (topo) -----------------------------------------------------

function CartaoCasa({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: ReactNode }) {
  return (
    <div className="entrar rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/50">{rotulo}</span>
      <div className="mt-1 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1.25rem,2.4vw,2rem)] font-extrabold leading-none tabular-nums text-white">{valor}</div>
      <div className="mt-2 min-h-4 text-xs">{sub}</div>
    </div>
  );
}

const GRADE_CASA = "mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4";

async function NumerosCasa({ comparacao, cargas }: { comparacao: PeriodoComparado | null; cargas: Cargas }) {
  const [a, b] = await Promise.all([cargas.casa(), cargas.casaBase()]);
  const falhou = !!comparacao && (b === null || !!b.erro);
  const v = (c: Comparacao | null) => (comparacao ? <VariacaoTV c={c} rotulo={`vs ${rotuloCurto(comparacao.periodo)}`} falhou={falhou} /> : undefined);
  const pct = (k: "faturamentoLiquido" | "custoLogistico", bom: boolean) => v(a[k] === null || !b ? null : compararPct(a[k], b[k], bom));
  const brl = (n: number | null) => (n === null ? "—" : reais(n));
  return (
    <div className={GRADE_CASA}>
      <CartaoCasa
        rotulo="Efetivo"
        valor={a.efetivo === null ? "—" : `${a.efetivo} pessoas`}
        sub={a.erro ? <span className="text-amber-200/80" title={a.erro}>indisponível agora</span> : <span className="text-white/35">ativos hoje</span>}
      />
      <CartaoCasa rotulo="Faturamento líquido" valor={brl(a.faturamentoLiquido)} sub={pct("faturamentoLiquido", true)} />
      <CartaoCasa rotulo="Custo logístico" valor={brl(a.custoLogistico)} sub={pct("custoLogistico", false)} />
      <CartaoCasa
        rotulo="Custo ÷ faturamento"
        valor={a.custoSobreFat === null ? "—" : formatPercent(a.custoSobreFat, 2)}
        sub={v(compararTaxa(a.custoSobreFat, b?.custoSobreFat, false, { casas: 2 }))}
      />
    </div>
  );
}

function CasaCarregando() {
  return (
    <div className={GRADE_CASA}>
      {["Efetivo", "Faturamento líquido", "Custo logístico", "Custo ÷ faturamento"].map((r) => (
        <CartaoCasa key={r} rotulo={r} valor="…" />
      ))}
    </div>
  );
}


// --- Evolução mês a mês da casa ------------------------------------------------------

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (mes: string) => `${MES_ABREV[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const MESES_EVOLUCAO = 12;
const GRADE_EVOLUCAO = "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4";

// Sem "vs mês anterior" no gráfico: a comparação fica nos cartões (Comparar), com
// a regra de custo do Início; o histórico usa a folha da foto de cada mês.
function serie(nome: string, pontos: PontoCasa[], valor: (p: PontoCasa) => number | null, texto: (v: number) => string): SerieEvolucao {
  const ps = pontos.filter((p) => valor(p) !== null);
  const vs = ps.map((p) => valor(p)!);
  return { nome, rotulos: ps.map((p) => rotuloMes(p.mes)), valores: vs, textos: vs.map(texto), parcial: ps.map((p) => p.parcial) };
}

async function EvolucaoCasa({ periodo, cargas }: { periodo: Periodo; cargas: Cargas }) {
  const hojeMes = primeiroDiaDoMes();
  const ateMes = primeiroDiaDoMes(periodo.ate) > hojeMes ? hojeMes : primeiroDiaDoMes(periodo.ate);
  let inicio = ateMes;
  for (let i = 1; i < MESES_EVOLUCAO; i++) inicio = mesAnterior(inicio);
  // Quantos meses fechados (contando de hoje para trás) cobrem a janela.
  let qtd = 0;
  for (let m = mesAnterior(hojeMes); m >= inicio; m = mesAnterior(m)) qtd++;
  const [a, fechados, custos, efetivo] = await Promise.all([
    cargas.casa(),
    cargas.fechados(qtd),
    serieCustosMensais(qtd + 1).catch(() => []),
    serieEfetivoMensal(qtd + 1).catch(() => []),
  ]);
  const mes = mesDoPeriodo(periodo);
  const pontos = montarEvolucaoCasa({
    ateMes,
    qtd: MESES_EVOLUCAO,
    hojeMes,
    fechados,
    folhaPorMes: new Map(efetivo.map((e) => [e.mes, e.folhaTotal])),
    custosPorMes: new Map(custos.map((c) => [c.mes, c])),
    atual: mes && !a.erro ? { mes, faturamento: a.faturamentoLiquido, custo: a.custoLogistico, clientes: a.clientesAtendidos } : null,
  });
  const series = [
    serie("Custo ÷ faturamento", pontos, (p) => p.custoSobreFat, (v) => formatPercent(v, 2)),
    serie("Faturamento líquido", pontos, (p) => p.faturamento, reais),
    serie("Custo logístico", pontos, (p) => p.custo, reais),
    serie("Clientes atendidos", pontos, (p) => p.clientes, (v) => Math.round(v).toLocaleString("pt-BR")),
  ];
  return (
    <div className={GRADE_EVOLUCAO}>
      {series.map((s) => <PainelEvolucao key={s.nome} s={s} />)}
    </div>
  );
}

function EvolucaoCarregando() {
  return (
    <div className={GRADE_EVOLUCAO}>
      {[0, 1, 2, 3].map((k) => <div key={k} className="h-[11.5rem] animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/10" />)}
    </div>
  );
}

// --- Placar dos setores (com Comparar) --------------------------------------------------

async function PlacarSetores({ cargas, comparacao }: { cargas: Cargas; comparacao: PeriodoComparado }) {
  const dados = await Promise.all(
    SETORES.map(async (s) => {
      const [r, base] = await Promise.all([cargas.setor(s), cargas.setorBase(s)]);
      const atuais = r && "indicadores" in r && !r.erro ? r.indicadores : [];
      return { setor: s, atuais, base: base && !base.erro ? base.indicadores : null };
    }),
  );
  const linhas = montarPlacar(dados).map((l) => ({ ...l, grupo: ROTULO_ABA[l.setor] }));
  if (linhas.length === 0) return null;
  return <Placar linhas={linhas} rotuloBase={`vs ${rotuloCurto(comparacao.periodo)}`} />;
}

// --- Um bloco por setor ------------------------------------------------------------

async function resumoDoSetor(s: SetorGeral, setor: Setor | undefined, funcionarios: Funcionario[], p: Periodo): Promise<ResumoSetorGeral | null> {
  if (s !== "recebimento" && !setor) return null;
  return comNovaTentativa(async () => (await lerSetor(s, setor, funcionarios, p))!);
}

async function lerSetor(s: SetorGeral, setor: Setor | undefined, funcionarios: Funcionario[], p: Periodo): Promise<ResumoSetorGeral | null> {
  if (s === "recebimento") return resumoRecebimento(await carregarDadosRecebimento(p));
  if (!setor) return null;
  if (s === "separacao") return resumoSeparacao(await carregarBISeparacao(setor, funcionarios, p));
  if (s === "abastecimento") return resumoAbastecimento(await carregarBIAbastecimento(setor, funcionarios, p));
  const [d, fat] = await Promise.all([
    carregarBIMotoristas(setor, funcionarios, p),
    getResumoFaturamentoPeriodo(p.de, p.ate).catch(() => null),
  ]);
  return resumoMotoristas(d, fat?.atendimentos ?? null);
}

function Moldura({ s, href, children }: { s: SetorGeral; href: string; children: ReactNode }) {
  return (
    <Link href={href} className="entrar levantar group flex flex-col rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{ROTULO_ABA[s]}</span>
        <span className="text-xs text-white/30 transition group-hover:text-amber-300">abrir BI ›</span>
      </div>
      {children}
    </Link>
  );
}

async function BlocoSetor(p: { cargas: Cargas; s: SetorGeral; comparacao: PeriodoComparado | null; href: string }) {
  const cmpValido = cmpDoSetor(p.s, p.comparacao);
  const [r, base] = await Promise.all([p.cargas.setor(p.s), p.cargas.setorBase(p.s)]);
  if (r === null) {
    return <Moldura s={p.s} href={p.href}><p className="text-sm text-white/40">setor não cadastrado em Setores</p></Moldura>;
  }
  if (!("indicadores" in r)) {
    return <Moldura s={p.s} href={p.href}><p className="text-sm text-amber-200/80" title={r.erro}>indisponível agora</p></Moldura>;
  }
  return (
    <Moldura s={p.s} href={p.href}>
      {r.erro && <p className="mb-2 text-xs text-amber-200/80" title={r.erro}>fonte do setor indisponível agora</p>}
      <dl className="space-y-3">
        {r.indicadores.map((i) => (
          <div key={i.chave} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
            <dt className="text-sm text-white/55">{i.rotulo}</dt>
            <dd className="text-right">
              <span className="font-[family-name:var(--font-sora)] text-xl font-extrabold tabular-nums text-white">{fmt(i)}</span>
              {p.comparacao && (
                <span className="block">
                  <VariacaoTV
                    c={variacao(i, base?.indicadores.find((x) => x.chave === i.chave))}
                    rotulo={`vs ${rotuloCurto(p.comparacao.periodo)}`}
                    falhou={!!cmpValido && (base === null || !!base.erro)}
                  />
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Moldura>
  );
}

function SetorCarregando({ s }: { s: SetorGeral }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
      <span className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-amber-300/60">{ROTULO_ABA[s]}</span>
      <div className="space-y-3">
        {[0, 1, 2].map((k) => <div key={k} className="h-7 animate-pulse rounded-lg bg-white/[0.06]" />)}
      </div>
    </div>
  );
}

// --- A aba -------------------------------------------------------------------------

export function AbaGeral({
  periodo, comparacao, setores, funcionarios, hrefMes, abas, q, faltando,
}: {
  periodo: Periodo;
  comparacao: PeriodoComparado | null;
  setores: Partial<Record<AbaBI, Setor>>;
  funcionarios: Funcionario[];
  hrefMes: HrefMes;
  abas: ReactNode;
  q: Record<string, string>;
  /** Aba de setor pedida, mas o setor não está cadastrado. */
  faltando?: AbaBI;
}) {
  // No máximo 2 cargas pesadas ao mesmo tempo, na ordem da tela; cada uma roda uma vez só.
  const cargas = criarCargas({ periodo, comparacao, setores, funcionarios });
  const chave = `${periodo.de}|${periodo.ate}|${comparacao ? `${comparacao.periodo.de}|${comparacao.periodo.ate}` : ""}`;
  const blocos = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {SETORES.map((s) => (
          <Suspense key={`${s}|${chave}`} fallback={<SetorCarregando s={s} />}>
            <BlocoSetor cargas={cargas} s={s} comparacao={comparacao} href={hrefBI(s, q)} />
          </Suspense>
        ))}
      </div>
      {comparacao && (
        <Suspense key={`placar|${chave}`} fallback={null}>
          <PlacarSetores cargas={cargas} comparacao={comparacao} />
        </Suspense>
      )}
    </div>
  );
  return (
    <BIShell
      titulo="BI Geral"
      periodo={periodo}
      hrefMes={hrefMes}
      hrefSair="/"
      abas={abas}
      dicaTopo={faltando ? `${ROTULO_ABA[faltando]}: setor não cadastrado em Setores` : ""}
      menu={
        <>
          <Suspense key={`casa|${chave}`} fallback={<CasaCarregando />}>
            <NumerosCasa comparacao={comparacao} cargas={cargas} />
          </Suspense>
          <Suspense key={`evolucao|${chave}`} fallback={<EvolucaoCarregando />}>
            <EvolucaoCasa periodo={periodo} cargas={cargas} />
          </Suspense>
        </>
      }
      palco={{ chave: "setores", titulo: "Setores", conteudo: blocos }}
    />
  );
}
