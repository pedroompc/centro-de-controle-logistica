"use client";

/**
 * BI do Recebimento no Painel da Operação (tema escuro da TV).
 *
 * O topo é o MENU: cada quadro mostra o número do mês filtrado e, ao clicar,
 * abre o detalhe dele no palco (Custo, Descarrego, Receita, Ajudantes,
 * Conferentes, Eficiência). Verde = melhor mês do trimestre (só fechados).
 */
import { useState, type ReactNode } from "react";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import { ehMelhorDaJanela, indicesMelhores, type IndicadoresRecebimento, type IndicadorComparavel } from "@/domain/recebimento";
import type { PontoDescarregoMensal } from "@/domain/descarregamento-tendencia";
import type { DescarregamentoTipo, TipoEquipamento } from "@/domain/types";
import type { DetalheCusto, DetalheDescarrego, PessoaRecebimento, ResumoDescarregos } from "./painel-actions";

export type VisaoBI = "custo" | "descarrego" | "receita" | "ajudantes" | "conferentes" | "eficiencia";

export const VISOES_BI: { id: VisaoBI; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo do recebimento", contexto: "quem e o que compõe o custo — pessoas, salários e equipamentos" },
  { id: "descarrego", titulo: "Descarrego", contexto: "carros, tipos, peso, dia a dia e fornecedores do mês" },
  { id: "receita", titulo: "Receita de descarrego", contexto: "de onde vem a receita e quanto dela a equipe consome" },
  { id: "ajudantes", titulo: "Ajudantes", contexto: "quanto peso cada ajudante descarrega, em média" },
  { id: "conferentes", titulo: "Conferentes", contexto: "quantos carros e quanto peso cada conferente confere, em média" },
  { id: "eficiencia", titulo: "Eficiência", contexto: "custo por tonelada, sobre o descarrego e sobre o faturamento" },
];

const inteiro = new Intl.NumberFormat("pt-BR");
const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const ton = (kg: number) => `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} t`;
const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);

const TIPO_COR: Record<DescarregamentoTipo, string> = { batido: "#5b6fd6", paletizado: "#8b93e0", pal_rem: "#f5b301", volume: "#38bdf8" };
const ROTULO_EQUIP: Record<TipoEquipamento, string> = { empilhadeira: "empilhadeira", patinha: "patinha", outro: "equipamento" };
const PAPEL: Record<PessoaRecebimento["papel"], { rotulo: string; cor: string }> = {
  ajudante: { rotulo: "Ajudante", cor: "#5b6fd6" },
  conferente: { rotulo: "Conferente", cor: "#8b93e0" },
  empilhador: { rotulo: "Empilhador", cor: "#c2820a" },
  outros: { rotulo: "Outros", cor: "#64748b" },
};

export interface DadosBI {
  mes: string; // mês filtrado "yyyy-mm-01"
  serie: IndicadoresRecebimento[]; // julho/2026 → mês corrente (o filtrado já com faturamento ao vivo)
  custo: DetalheCusto | null;
  descarrego: DetalheDescarrego | null;
  dias: ResumoDescarregos | null; // dia a dia do mês filtrado
  pontos: PontoDescarregoMensal[]; // descarrego por mês (tipos, peso)
}

// --- Menu (topo) -------------------------------------------------------------

function Quadro({ ativo, onClick, rotulo, valor, sub, verde }: { ativo: boolean; onClick: () => void; rotulo: string; valor: string; sub: ReactNode; verde?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`@container rounded-2xl px-5 py-4 text-left ring-1 transition ${
        ativo ? "bg-amber-400/15 ring-2 ring-amber-400" : "bg-white/[0.06] ring-white/10 hover:bg-white/[0.1]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/50">{rotulo}</span>
        <span className={`text-xs ${ativo ? "text-amber-300" : "text-white/25"}`}>{ativo ? "▾" : "›"}</span>
      </div>
      <div className={`mt-1 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1.25rem,10cqi,2rem)] font-extrabold leading-none tabular-nums ${verde ? "text-emerald-300" : "text-white"}`}>
        {valor}
      </div>
      <div className="mt-2 truncate text-xs text-white/45">{sub}</div>
    </button>
  );
}

/** O topo do BI: 6 quadros que funcionam como menu. */
export function MenuBI({ dados, visao, onVisao }: { dados: DadosBI; visao: VisaoBI; onVisao: (v: VisaoBI) => void }) {
  const r = dados.serie.find((x) => x.mes === dados.mes);
  if (!r) return null;
  const janela = trimestre(dados.serie, dados.mes);
  const verde = (k: IndicadorComparavel) => ehMelhorDaJanela(janela, r.mes, k);
  const equip = dados.custo?.equipamentos ?? [];
  const resumoEquip = equip
    .filter((e) => e.quantidade > 0)
    .map((e) => `${e.quantidade} ${ROTULO_EQUIP[e.tipo]}${e.quantidade > 1 ? "s" : ""}`)
    .join(" · ");
  const q = (v: VisaoBI) => ({ ativo: visao === v, onClick: () => onVisao(v) });
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Quadro {...q("custo")} rotulo="Custo" valor={formatBRL(r.equipe.custo)} sub={`${r.equipe.total} pessoas${resumoEquip ? ` · ${resumoEquip}` : ""}`} />
      <Quadro {...q("descarrego")} rotulo="Descarrego" valor={`${inteiro.format(r.carros)} carros`} sub={`${ton(r.pesoKg)} · ${r.diasDescarrego} dias`} />
      <Quadro {...q("receita")} rotulo="Receita" valor={formatBRL(r.receitaDescarrego)} sub={`custo consome ${r.custoSobreDescarrego === null ? "—" : formatPercent(r.custoSobreDescarrego)}`} verde={verde("receitaPorTonelada")} />
      <Quadro
        {...q("ajudantes")}
        rotulo="Ajudantes"
        valor={r.kgPorAjudanteDia === null ? "—" : `${formatKg(r.kgPorAjudanteDia)}/dia`}
        sub={`${r.equipe.ajudantes} ajudantes · ${r.kgPorAjudante === null ? "—" : ton(r.kgPorAjudante)} cada no mês`}
        verde={verde("kgPorAjudanteDia")}
      />
      <Quadro
        {...q("conferentes")}
        rotulo="Conferentes"
        valor={r.carrosPorConferente === null ? "—" : `${inteiro.format(Math.round(r.carrosPorConferente))} carros`}
        sub={`${r.equipe.conferentes} conferentes · ${r.kgPorConferente === null ? "—" : ton(r.kgPorConferente)} cada`}
        verde={verde("carrosPorConferente")}
      />
      <Quadro
        {...q("eficiencia")}
        rotulo="Eficiência"
        valor={r.custoPorTonelada === null ? "—" : `${formatBRL(r.custoPorTonelada)}/t`}
        sub={`custo ÷ faturamento ${r.custoSobreFaturamento === null ? "—" : formatPercent(r.custoSobreFaturamento, 2)}`}
        verde={verde("custoPorTonelada")}
      />
    </div>
  );
}

// --- Palco: a visão aberta ----------------------------------------------------

export function PalcoBI({ dados, visao }: { dados: DadosBI; visao: VisaoBI }) {
  const r = dados.serie.find((x) => x.mes === dados.mes);
  if (!r) return <Vazio>Sem dados de recebimento para {formatMesAno(dados.mes)}.</Vazio>;
  switch (visao) {
    case "custo":
      return <VisaoCusto dados={dados} r={r} />;
    case "descarrego":
      return <VisaoDescarrego dados={dados} r={r} />;
    case "receita":
      return <VisaoReceita dados={dados} r={r} />;
    case "ajudantes":
      return <VisaoPessoas dados={dados} r={r} papel="ajudantes" />;
    case "conferentes":
      return <VisaoPessoas dados={dados} r={r} papel="conferentes" />;
    case "eficiencia":
      return <VisaoEficiencia dados={dados} r={r} />;
  }
}

// --- Peças --------------------------------------------------------------------

function Vazio({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center text-center text-lg text-white/40">{children}</div>;
}

function Bloco({ titulo, direita, children, className = "" }: { titulo: string; direita?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-0 flex-col rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{titulo}</span>
        {direita}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Mini({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="@container rounded-xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10">
      <div className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">{rotulo}</div>
      <div className="mt-1 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1rem,9cqi,1.5rem)] font-extrabold tabular-nums text-white">{valor}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-white/40">{sub}</div>}
    </div>
  );
}

function ChipTV({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${ativo ? "bg-amber-400 text-[#0a1650]" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
    >
      {children}
    </button>
  );
}

/** Barras verticais no escuro, com tooltip no hover e destaque (verde/âmbar). */
function BarrasTV({
  itens,
  fmt,
  altura = 180,
  referencia,
}: {
  itens: { chave: string; rotulo: string; valor: number | null; cor?: string; detalhe?: string; ativo?: boolean }[];
  fmt: (v: number) => string;
  altura?: number;
  referencia?: { valor: number; rotulo: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1e-9, ...itens.map((i) => Math.abs(i.valor ?? 0)), referencia?.valor ?? 0) * 1.1;
  const denso = itens.length > 14;
  if (itens.length === 0) return <p className="py-8 text-center text-sm text-white/40">Sem lançamentos.</p>;
  return (
    <div className="relative" style={{ height: altura }} onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs text-[#0a1650] shadow-lg"
          style={{ left: `${Math.min(90, Math.max(10, ((hover + 0.5) / itens.length) * 100))}%` }}
        >
          <span className="font-bold">{itens[hover].rotulo}</span> · {itens[hover].valor === null ? "sem dado" : fmt(itens[hover].valor!)}
          {itens[hover].detalhe && <span className="text-slate-500"> · {itens[hover].detalhe}</span>}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-5 top-0">
        {referencia && referencia.valor > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-amber-400/70" style={{ bottom: `${(referencia.valor / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 text-[0.65rem] font-semibold text-amber-300">
              {referencia.rotulo} {fmt(referencia.valor)}
            </span>
          </div>
        )}
        <div className={`flex h-full items-end ${denso ? "gap-[3px]" : "gap-2"}`}>
          {itens.map((it, i) => (
            <div key={it.chave} className="flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)}>
              {!denso && it.valor !== null && <span className="mb-1 text-xs font-bold tabular-nums text-white/85">{fmt(it.valor)}</span>}
              <div
                className={`w-full rounded-t-md transition ${hover === i ? "brightness-125" : ""} ${it.ativo ? "ring-2 ring-amber-400" : ""}`}
                style={{ height: `${Math.max(2, (Math.abs(it.valor ?? 0) / max) * 100)}%`, background: it.cor ?? "#5b6fd6" }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={`absolute inset-x-0 bottom-0 flex h-4 ${denso ? "gap-[3px]" : "gap-2"}`}>
        {itens.map((it, i) => (
          <span key={it.chave} className="flex-1 whitespace-nowrap text-center text-[0.65rem] font-semibold text-white/45">
            {denso && i % Math.ceil(itens.length / 12) !== 0 ? "" : it.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

/** O mês filtrado e os 2 anteriores (a janela do "melhor do trimestre"). */
function trimestre(serie: IndicadoresRecebimento[], mes: string) {
  const i = serie.findIndex((x) => x.mes === mes);
  return i < 0 ? [] : serie.slice(Math.max(0, i - 2), i + 1);
}

/** Barras de um indicador por mês, até o mês filtrado; melhor do trimestre em verde. */
function SerieMeses({ dados, valor, fmt, maiorEhBom, altura = 170 }: { dados: DadosBI; valor: (r: IndicadoresRecebimento) => number | null; fmt: (v: number) => string; maiorEhBom: boolean; altura?: number }) {
  const ate = dados.serie.filter((x) => x.mes <= dados.mes);
  const melhores = indicesMelhores(ate.map((x) => ({ valor: valor(x), fechado: x.fracaoMes >= 1 })), maiorEhBom);
  return (
    <BarrasTV
      altura={altura}
      fmt={fmt}
      itens={ate.map((x, i) => ({
        chave: x.mes,
        rotulo: mesCurto(x.mes) + (x.fracaoMes < 1 ? "*" : ""),
        valor: valor(x),
        cor: melhores.has(i) ? "#10b981" : x.mes === dados.mes ? "#f5b301" : "#5b6fd6",
        detalhe: x.fracaoMes < 1 ? "mês em andamento" : undefined,
      }))}
    />
  );
}

// --- CUSTO --------------------------------------------------------------------

function VisaoCusto({ dados, r }: { dados: DadosBI; r: IndicadoresRecebimento }) {
  const [filtro, setFiltro] = useState<PessoaRecebimento["papel"] | "todos">("todos");
  const c = dados.custo;
  if (!c) return <Vazio>Carregando pessoas e equipamentos…</Vazio>;
  const folha = c.pessoas.reduce((t, p) => t + p.custo, 0);
  const custoEquip = c.equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const total = folha + custoEquip;
  const papeis = (["ajudante", "conferente", "empilhador", "outros"] as const).filter((p) => c.pessoas.some((x) => x.papel === p));
  const lista = c.pessoas.filter((p) => filtro === "todos" || p.papel === filtro).sort((a, b) => a.papel.localeCompare(b.papel) || b.custo - a.custo);
  const fatias = [
    ...papeis.map((p) => ({ rotulo: PAPEL[p].rotulo, valor: c.pessoas.filter((x) => x.papel === p).reduce((t, x) => t + x.custo, 0), cor: PAPEL[p].cor })),
    { rotulo: "Equipamentos", valor: custoEquip, cor: "#f5b301" },
  ].filter((f) => f.valor > 0);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {/* Mesmo número do quadro do topo (custo do mês); folha e equipamentos são do cadastro atual. */}
        <Mini rotulo="Custo mensal" valor={formatBRL(r.equipe.custo)} sub={r.fracaoMes < 1 ? `${formatBRL(r.custoPeriodo)} até hoje` : formatMesAno(r.mes)} />
        <Mini rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub={`${c.pessoas.length} pessoas`} />
        <Mini rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${c.equipamentos.reduce((t, e) => t + e.quantidade, 0)} unidades`} />
        <Mini rotulo="Custo por carro" valor={r.carros > 0 ? formatBRL(r.custoPeriodo / r.carros) : "—"} sub={`${inteiro.format(r.carros)} carros no mês`} />
        <Mini rotulo="Custo por tonelada" valor={r.custoPorTonelada === null ? "—" : formatBRL(r.custoPorTonelada)} sub={ton(r.pesoKg)} />
      </div>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Bloco
          titulo="Pessoas e salários"
          direita={
            <div className="flex flex-wrap gap-1.5">
              <ChipTV ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos {c.pessoas.length}</ChipTV>
              {papeis.map((p) => (
                <ChipTV key={p} ativo={filtro === p} onClick={() => setFiltro(p)}>
                  {PAPEL[p].rotulo} {c.pessoas.filter((x) => x.papel === p).length}
                </ChipTV>
              ))}
            </div>
          }
        >
          <div className="h-full overflow-auto pr-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
                <tr>
                  <th className="py-2 font-semibold">Nome</th>
                  <th className="py-2 font-semibold">Cargo</th>
                  <th className="py-2 text-right font-semibold">Custo / mês</th>
                  <th className="w-24 py-2 text-right font-semibold">% do custo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="border-t border-white/[0.06] hover:bg-white/[0.04]">
                    <td className="py-2 font-semibold text-white">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: PAPEL[p.papel].cor }} />
                      {p.nome}
                    </td>
                    <td className="py-2 text-white/60">
                      {p.cargo}
                      {p.outroSetor && <span className="ml-1 text-xs text-amber-300">(outro setor)</span>}
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums text-white">{formatBRL(p.custo)}</td>
                    <td className="py-2 text-right tabular-nums text-white/50">{total > 0 ? formatPercent(p.custo / total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-white/35">Cadastro atual de funcionários (custo mensal com encargos). O cadastro não guarda quem estava em meses passados.</p>
          </div>
        </Bloco>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Bloco titulo="Equipamentos" direita={c.equipamentosPadrao ? <span className="text-xs text-amber-300">padrão — rode a migração 0023</span> : <span className="text-xs text-white/40">Custos › Equipamentos</span>}>
            <ul className="space-y-2">
              {c.equipamentos.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-white">
                    {e.nome} <span className="text-white/45">· {e.quantidade} × {formatBRL(e.custoUnitario)}</span>
                  </span>
                  <span className="font-bold tabular-nums text-white">{formatBRL(e.quantidade * e.custoUnitario)}</span>
                </li>
              ))}
              {c.equipamentos.length === 0 && <li className="text-sm text-white/40">Nenhum equipamento cadastrado.</li>}
            </ul>
          </Bloco>
          <Bloco titulo="Do que é feito o custo">
            <BarraComposicao fatias={fatias} />
            <div className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Custo por mês</div>
            <SerieMeses dados={dados} valor={(x) => x.equipe.custo} fmt={(v) => formatBRL(v).replace(",00", "")} maiorEhBom={false} altura={110} />
          </Bloco>
        </div>
      </div>
    </div>
  );
}

function BarraComposicao({ fatias }: { fatias: { rotulo: string; valor: number; cor: string }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  if (total === 0) return null;
  return (
    <div onMouseLeave={() => setHover(null)}>
      <div className="flex h-4 overflow-hidden rounded-full">
        {fatias.map((f) => (
          <div
            key={f.rotulo}
            onMouseEnter={() => setHover(f.rotulo)}
            className="h-full border-r-2 border-[#0d1550] last:border-0"
            style={{ width: `${(f.valor / total) * 100}%`, background: f.cor, opacity: hover && hover !== f.rotulo ? 0.35 : 1 }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {fatias.map((f) => (
          <span key={f.rotulo} onMouseEnter={() => setHover(f.rotulo)} className={`inline-flex items-center gap-1.5 text-xs ${hover === f.rotulo ? "text-white" : "text-white/60"}`}>
            <span className="h-2 w-2 rounded-sm" style={{ background: f.cor }} />
            {f.rotulo} {formatPercent(f.valor / total, 0)}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- DESCARREGO ---------------------------------------------------------------

type OrdemForn = "pesoKg" | "receita" | "notas";

function TabelaFornecedores({ d, ordemInicial = "pesoKg" }: { d: DetalheDescarrego; ordemInicial?: OrdemForn }) {
  const [ordem, setOrdem] = useState<OrdemForn>(ordemInicial);
  const lista = [...d.porFornecedor].sort((a, b) => b[ordem] - a[ordem]);
  const total = lista.reduce((t, f) => t + f[ordem], 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex gap-1.5">
        <ChipTV ativo={ordem === "pesoKg"} onClick={() => setOrdem("pesoKg")}>por peso</ChipTV>
        <ChipTV ativo={ordem === "receita"} onClick={() => setOrdem("receita")}>por receita</ChipTV>
        <ChipTV ativo={ordem === "notas"} onClick={() => setOrdem("notas")}>por notas</ChipTV>
      </div>
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
            <tr>
              <th className="py-2 font-semibold">Fornecedor</th>
              <th className="py-2 text-right font-semibold">Notas</th>
              <th className="py-2 text-right font-semibold">Peso</th>
              <th className="py-2 text-right font-semibold">Receita</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.nome} className="border-t border-white/[0.06] hover:bg-white/[0.04]">
                <td className="max-w-0 py-2">
                  <div className="truncate font-semibold text-white" title={f.nome}>{f.nome}</div>
                  <div className="mt-1 h-1 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${total > 0 ? (f[ordem] / total) * 100 : 0}%` }} />
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums text-white/70">{f.notas}</td>
                <td className="py-2 text-right tabular-nums text-white/70">{formatKg(f.pesoKg)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-white">{formatBRL(f.receita)}</td>
              </tr>
            ))}
            {d.semFornecedor.receita > 0 && (
              <tr className="border-t border-white/[0.06] text-white/50">
                <td className="py-2 italic">Total do dia (sem fornecedor)</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right tabular-nums">{formatKg(d.semFornecedor.pesoKg)}</td>
                <td className="py-2 text-right tabular-nums">{formatBRL(d.semFornecedor.receita)}</td>
              </tr>
            )}
            {lista.length === 0 && d.semFornecedor.receita === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-white/40">Sem lançamentos no mês.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VisaoDescarrego({ dados, r }: { dados: DadosBI; r: IndicadoresRecebimento }) {
  const p = dados.pontos.find((x) => x.mes === dados.mes);
  const porDia = dados.dias?.porDia ?? [];
  const mediaDia = porDia.length ? porDia.reduce((t, d) => t + d.descarregos, 0) / porDia.length : 0;
  const maxTipo = Math.max(1, ...TIPOS_DESCARREGAMENTO.map((t) => (t === "volume" ? (p?.descargasVolume ?? 0) : (p?.porTipo[t] ?? 0))));
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Mini rotulo="Carros" valor={inteiro.format(r.carros)} sub={`${dec1(r.carrosPorDia ?? 0)} por dia`} />
        <Mini rotulo="Peso" valor={ton(r.pesoKg)} sub={r.kgPorCarro === null ? undefined : `${formatKg(r.kgPorCarro)} por carro`} />
        <Mini rotulo="Caixas (volume)" valor={inteiro.format(p?.caixas ?? 0)} sub={`${inteiro.format(p?.descargasVolume ?? 0)} descargas`} />
        <Mini rotulo="Dias de descarrego" valor={inteiro.format(r.diasDescarrego)} sub={formatMesAno(r.mes)} />
        <Mini rotulo="Receita" valor={formatBRL(r.receitaDescarrego)} sub={r.carros > 0 ? `${formatBRL(r.receitaDescarrego / r.carros)} por carro` : undefined} />
        <Mini rotulo="Fornecedores" valor={inteiro.format(dados.descarrego?.porFornecedor.length ?? 0)} sub="com lançamento no mês" />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Bloco titulo="Carros por dia" direita={<span className="text-xs text-white/40">média {dec1(mediaDia)}</span>}>
            <BarrasTV
              altura={150}
              fmt={dec1}
              referencia={{ valor: mediaDia, rotulo: "média" }}
              itens={porDia.map((d) => ({ chave: d.data, rotulo: d.data.slice(8, 10), valor: d.descarregos, cor: d.descarregos >= mediaDia * 1.25 ? "#f5b301" : "#5b6fd6", detalhe: `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}` }))}
            />
          </Bloco>
          <Bloco titulo="Por tipo de carga">
            <ul className="space-y-3">
              {TIPOS_DESCARREGAMENTO.map((t) => {
                const qtd = t === "volume" ? (p?.descargasVolume ?? 0) : (p?.porTipo[t] ?? 0);
                const peso = p?.pesoPorTipo[t] ?? 0;
                return (
                  <li key={t}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-semibold text-white">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIPO_COR[t] }} />
                        {ROTULO_TIPO[t]}
                      </span>
                      <span className="tabular-nums text-white/70">
                        <strong className="text-white">{inteiro.format(qtd)}</strong> {t === "volume" ? "descargas" : "carros"}
                        {peso > 0 && ` · ${formatKg(peso)}`}
                        {dados.descarrego && dados.descarrego.receitaPorTipo[t] > 0 && ` · ${formatBRL(dados.descarrego.receitaPorTipo[t])}`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${(qtd / maxTipo) * 100}%`, background: TIPO_COR[t] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Bloco>
        </div>
        <Bloco titulo="Fornecedores do mês">{dados.descarrego ? <TabelaFornecedores d={dados.descarrego} /> : <Vazio>Carregando…</Vazio>}</Bloco>
      </div>
    </div>
  );
}

// --- RECEITA ------------------------------------------------------------------

function VisaoReceita({ dados, r }: { dados: DadosBI; r: IndicadoresRecebimento }) {
  const d = dados.descarrego;
  const totalTipo = d ? TIPOS_DESCARREGAMENTO.reduce((t, x) => t + d.receitaPorTipo[x], 0) + d.semFornecedor.receita : 0;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Mini rotulo="Receita de descarrego" valor={formatBRL(r.receitaDescarrego)} sub={formatMesAno(r.mes)} />
        <Mini rotulo="Custo do recebimento" valor={formatBRL(r.custoPeriodo)} sub={r.fracaoMes < 1 ? "proporcional aos dias" : "no mês"} />
        <Mini rotulo="Sobra (receita − custo)" valor={formatBRL(r.resultado)} />
        <Mini rotulo="Custo consome" valor={r.custoSobreDescarrego === null ? "—" : formatPercent(r.custoSobreDescarrego)} sub="da receita de descarrego" />
        <Mini rotulo="Receita por tonelada" valor={r.receitaPorTonelada === null ? "—" : formatBRL(r.receitaPorTonelada)} sub={r.carros > 0 ? `${formatBRL(r.receitaDescarrego / r.carros)} por carro` : undefined} />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <Bloco titulo="Receita por tipo">
          {d ? (
            <ul className="space-y-3">
              {[...TIPOS_DESCARREGAMENTO.map((t) => ({ k: t as string, rotulo: ROTULO_TIPO[t], v: d.receitaPorTipo[t], cor: TIPO_COR[t] })), { k: "dia", rotulo: "Total do dia", v: d.semFornecedor.receita, cor: "#64748b" }]
                .filter((x) => x.v > 0)
                .map((x) => (
                  <li key={x.k}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-white">{x.rotulo}</span>
                      <span className="tabular-nums text-white">
                        {formatBRL(x.v)} <span className="text-white/40">· {totalTipo > 0 ? formatPercent(x.v / totalTipo, 0) : "—"}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${totalTipo > 0 ? (x.v / totalTipo) * 100 : 0}%`, background: x.cor }} />
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <Vazio>Carregando…</Vazio>
          )}
        </Bloco>
        <Bloco titulo="Receita × custo por mês">
          <SerieMeses dados={dados} valor={(x) => x.receitaDescarrego} fmt={(v) => formatBRL(v).replace(",00", "")} maiorEhBom altura={150} />
          <div className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Quanto o custo consome da receita</div>
          <SerieMeses dados={dados} valor={(x) => x.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} altura={120} />
        </Bloco>
        <Bloco titulo="Fornecedores que mais pagam">{d ? <TabelaFornecedores d={d} ordemInicial="receita" /> : <Vazio>Carregando…</Vazio>}</Bloco>
      </div>
    </div>
  );
}

// --- AJUDANTES / CONFERENTES ---------------------------------------------------

function VisaoPessoas({ dados, r, papel }: { dados: DadosBI; r: IndicadoresRecebimento; papel: "ajudantes" | "conferentes" }) {
  const aj = papel === "ajudantes";
  const nomes = (dados.custo?.pessoas ?? []).filter((p) => p.papel === (aj ? "ajudante" : "conferente"));
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {aj ? (
          <>
            <Mini rotulo="Ajudantes" valor={inteiro.format(r.equipe.ajudantes)} sub={r.equipeEstimada ? "equipe de hoje (estimativa)" : formatMesAno(r.mes)} />
            <Mini rotulo="Kg por ajudante no mês" valor={r.kgPorAjudante === null ? "—" : formatKg(r.kgPorAjudante)} />
            <Mini rotulo="Kg por ajudante por dia" valor={r.kgPorAjudanteDia === null ? "—" : formatKg(r.kgPorAjudanteDia)} sub={`${r.diasDescarrego} dias de descarrego`} />
            <Mini rotulo="Carros por ajudante" valor={r.equipe.ajudantes > 0 ? dec1(r.carros / r.equipe.ajudantes) : "—"} sub="no mês" />
            <Mini rotulo="Custo por ajudante" valor={nomes.length ? formatBRL(nomes.reduce((t, p) => t + p.custo, 0) / nomes.length) : "—"} sub="média do cadastro" />
          </>
        ) : (
          <>
            <Mini rotulo="Conferentes" valor={inteiro.format(r.equipe.conferentes)} sub={r.equipeEstimada ? "equipe de hoje (estimativa)" : formatMesAno(r.mes)} />
            <Mini rotulo="Carros por conferente" valor={r.carrosPorConferente === null ? "—" : inteiro.format(Math.round(r.carrosPorConferente))} sub="no mês" />
            <Mini rotulo="Kg por conferente" valor={r.kgPorConferente === null ? "—" : formatKg(r.kgPorConferente)} sub="no mês" />
            <Mini rotulo="Carros por conferente / dia" valor={r.carrosPorConferente !== null && r.diasDescarrego > 0 ? dec1(r.carrosPorConferente / r.diasDescarrego) : "—"} />
            <Mini rotulo="Custo por conferente" valor={nomes.length ? formatBRL(nomes.reduce((t, p) => t + p.custo, 0) / nomes.length) : "—"} sub="média do cadastro" />
          </>
        )}
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Bloco titulo={aj ? "Kg por ajudante por dia · mês a mês" : "Carros por conferente · mês a mês"}>
          <SerieMeses
            dados={dados}
            valor={(x) => (aj ? x.kgPorAjudanteDia : x.carrosPorConferente)}
            fmt={(v) => (aj ? formatKg(v) : inteiro.format(Math.round(v)))}
            maiorEhBom
            altura={360}
          />
          <p className="mt-3 text-xs text-white/40">
            Média da equipe (peso do mês ÷ {aj ? "ajudantes" : "conferentes"}), não por pessoa: o lançamento não registra quem descarregou ou conferiu cada carro.
            Verde = melhor mês do trimestre; âmbar = mês filtrado.
          </p>
        </Bloco>
        <Bloco titulo={aj ? "Quem são" : "Quem são"}>
          <ul className="space-y-2 overflow-auto">
            {nomes.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between text-sm">
                <span className="text-white">{p.nome}</span>
                <span className="text-white/50">{p.cargo}</span>
              </li>
            ))}
            {nomes.length === 0 && <li className="text-sm text-white/40">Ninguém com esse cargo no setor Recebimento.</li>}
          </ul>
        </Bloco>
      </div>
    </div>
  );
}

// --- EFICIÊNCIA ----------------------------------------------------------------

function VisaoEficiencia({ dados, r }: { dados: DadosBI; r: IndicadoresRecebimento }) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini rotulo="Custo por tonelada" valor={r.custoPorTonelada === null ? "—" : formatBRL(r.custoPorTonelada)} sub="o número que mede a equipe" />
        <Mini rotulo="Custo ÷ descarrego" valor={r.custoSobreDescarrego === null ? "—" : formatPercent(r.custoSobreDescarrego)} />
        <Mini rotulo="Custo ÷ faturamento líquido" valor={r.custoSobreFaturamento === null ? "—" : formatPercent(r.custoSobreFaturamento, 2)} />
        <Mini rotulo="Faturamento líquido" valor={r.faturamentoLiquido === null ? "—" : formatBRL(r.faturamentoLiquido)} sub={formatMesAno(r.mes)} />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-3">
        <Bloco titulo="Custo por tonelada">
          <SerieMeses dados={dados} valor={(x) => x.custoPorTonelada} fmt={formatBRL} maiorEhBom={false} altura={340} />
        </Bloco>
        <Bloco titulo="Custo ÷ descarrego">
          <SerieMeses dados={dados} valor={(x) => x.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} altura={340} />
        </Bloco>
        <Bloco titulo="Custo ÷ faturamento líquido">
          <SerieMeses dados={dados} valor={(x) => x.custoSobreFaturamento} fmt={(v) => formatPercent(v, 2)} maiorEhBom={false} altura={340} />
        </Bloco>
      </div>
    </div>
  );
}
