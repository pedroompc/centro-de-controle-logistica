"use client";

/**
 * BI do Recebimento no Painel da Operação (tema escuro da TV).
 *
 * O topo é o MENU: cada quadro mostra o número do recorte e, ao clicar, abre a
 * visão no palco. FILTRO CRUZADO (estilo Power BI): clicar num dia, num
 * fornecedor ou num tipo de carga filtra TODOS os quadros e visuais; cada
 * visual ignora o filtro da própria dimensão e só destaca o item escolhido.
 *
 * Tudo em TOTAL do recorte (nada por pessoa). O custo é do mês: no recorte ele
 * é rateado (por dia de descarrego e pelo peso) — o critério aparece na tela.
 */
import { useState, type ReactNode } from "react";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import { ehMelhorDaJanela, indicesMelhores, type IndicadoresRecebimento, type IndicadorComparavel } from "@/domain/recebimento";
import {
  filtrarFatos,
  resumir,
  agrupar,
  custoNoRecorte,
  filtroAtivo,
  type FatoDescarrego,
  type FiltroBI,
  type ResumoFatos,
} from "@/domain/bi-recebimento";
import type { DescarregamentoTipo, TipoEquipamento } from "@/domain/types";
import type { DetalheCusto, PessoaRecebimento } from "./painel-actions";

export type VisaoBI = "custo" | "descarrego" | "receita" | "fornecedores" | "equipe" | "eficiencia";

export const VISOES_BI: { id: VisaoBI; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo do recebimento", contexto: "quem e o que compõe o custo — pessoas, salários e equipamentos" },
  { id: "descarrego", titulo: "Descarrego", contexto: "carros, tipos, peso, dia a dia e fornecedores · clique para filtrar" },
  { id: "receita", titulo: "Receita de descarrego", contexto: "de onde vem a receita e quanto dela o custo consome · clique para filtrar" },
  { id: "fornecedores", titulo: "Fornecedores", contexto: "quem mais descarrega e mais paga · clique para filtrar" },
  { id: "equipe", titulo: "Equipe", contexto: "ajudantes, conferentes e empilhador — totais do recorte" },
  { id: "eficiencia", titulo: "Eficiência", contexto: "custo por tonelada, sobre o descarrego e sobre o faturamento" },
];

const inteiro = new Intl.NumberFormat("pt-BR");
const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const ton = (kg: number) => `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: kg < 10_000 ? 1 : 0 })} t`;
const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const semCentavos = (v: number) => formatBRL(v).replace(",00", "");

const TIPO_COR: Record<DescarregamentoTipo, string> = { batido: "#5b6fd6", paletizado: "#8b93e0", pal_rem: "#f5b301", volume: "#38bdf8" };
const ROTULO_EQUIP: Record<TipoEquipamento, string> = { empilhadeira: "empilhadeira", patinha: "patinha", outro: "equipamento" };
const PAPEL: Record<PessoaRecebimento["papel"], { rotulo: string; plural: string; cor: string }> = {
  ajudante: { rotulo: "Ajudante", plural: "Ajudantes", cor: "#5b6fd6" },
  conferente: { rotulo: "Conferente", plural: "Conferentes", cor: "#8b93e0" },
  empilhador: { rotulo: "Empilhador", plural: "Empilhador", cor: "#c2820a" },
  outros: { rotulo: "Outros", plural: "Outros", cor: "#64748b" },
};
const ORDEM_PAPEL = ["ajudante", "conferente", "empilhador", "outros"] as const;

export interface DadosBI {
  mes: string; // mês filtrado "yyyy-mm-01"
  serie: IndicadoresRecebimento[]; // julho/2026 → mês corrente (o filtrado já com faturamento ao vivo)
  custo: DetalheCusto | null;
  fatos: FatoDescarrego[] | null; // descarrego do mês, dia × fornecedor × tipo
}

interface Filtro {
  filtro: FiltroBI;
  onFiltro: (f: FiltroBI) => void;
}

// --- O recorte: tudo que os quadros e visuais mostram -----------------------

interface Recorte {
  r: IndicadoresRecebimento; // o mês (série mensal)
  mes: ResumoFatos; // o mês inteiro, dos fatos
  sel: ResumoFatos; // o recorte filtrado
  custo: number;
  criterioCusto: string | null;
  porNotas: boolean; // filtro de fornecedor: "carros" viram notas
  temFatos: boolean;
}

function recortar(dados: DadosBI, filtro: FiltroBI): Recorte | null {
  const r = dados.serie.find((x) => x.mes === dados.mes);
  if (!r) return null;
  const fatos = dados.fatos ?? [];
  const mes = resumir(fatos);
  const sel = resumir(filtrarFatos(fatos, filtro));
  const pesoDoDia = filtro.dia ? resumir(filtrarFatos(fatos, { dia: filtro.dia })).pesoKg : 0;
  const { custo, criterio } = custoNoRecorte({ custoMes: r.custoPeriodo, diasMes: mes.dias, pesoMes: mes.pesoKg, pesoDoDia, pesoRecorte: sel.pesoKg, filtro });
  return { r, mes, sel, custo, criterioCusto: criterio, porNotas: !!filtro.fornecedor, temFatos: dados.fatos !== null };
}

const carrosOuNotas = (x: Recorte, s: ResumoFatos = x.sel) => (x.porNotas ? `${inteiro.format(s.notas)} notas` : `${inteiro.format(s.carros)} carros`);

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

/** O topo do BI: 6 quadros (menu) + a barra de filtros ativos. */
export function MenuBI({ dados, visao, onVisao, filtro, onFiltro }: { dados: DadosBI; visao: VisaoBI; onVisao: (v: VisaoBI) => void } & Filtro) {
  const x = recortar(dados, filtro);
  if (!x) return null;
  const { r, sel } = x;
  const semFiltro = !filtroAtivo(filtro);
  // Verde = melhor mês do trimestre; só faz sentido no mês inteiro (sem filtro).
  const janela = trimestre(dados.serie, dados.mes);
  const verde = (k: IndicadorComparavel) => semFiltro && ehMelhorDaJanela(janela, r.mes, k);
  const equip = dados.custo?.equipamentos ?? [];
  const resumoEquip = equip
    .filter((e) => e.quantidade > 0)
    .map((e) => `${e.quantidade} ${ROTULO_EQUIP[e.tipo]}${e.quantidade > 1 ? "s" : ""}`)
    .join(" · ");
  const q = (v: VisaoBI) => ({ ativo: visao === v, onClick: () => onVisao(v) });
  const usar = x.temFatos;
  const peso = usar ? sel.pesoKg : r.pesoKg;
  const receita = usar ? sel.receita : r.receitaDescarrego;
  const topForn = usar ? agrupar(filtrarFatos(dados.fatos!, filtro, "fornecedor"), (f) => f.fornecedor).sort((a, b) => b.resumo.pesoKg - a.resumo.pesoKg) : [];
  const pessoas = dados.custo?.pessoas ?? [];
  const cont = (p: PessoaRecebimento["papel"]) => pessoas.filter((y) => y.papel === p).length;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Quadro {...q("custo")} rotulo="Custo" valor={formatBRL(x.custo)} sub={x.criterioCusto ?? `${r.equipe.total} pessoas${resumoEquip ? ` · ${resumoEquip}` : ""}`} />
        <Quadro {...q("descarrego")} rotulo="Descarrego" valor={usar ? carrosOuNotas(x) : `${inteiro.format(r.carros)} carros`} sub={`${ton(peso)} · ${usar ? sel.dias : r.diasDescarrego} ${(usar ? sel.dias : r.diasDescarrego) === 1 ? "dia" : "dias"}`} verde={verde("carrosPorDia")} />
        <Quadro {...q("receita")} rotulo="Receita" valor={formatBRL(receita)} sub={`custo consome ${receita > 0 ? formatPercent(x.custo / receita) : "—"}`} verde={verde("resultado")} />
        <Quadro
          {...q("fornecedores")}
          rotulo="Fornecedores"
          valor={usar ? inteiro.format(filtro.fornecedor ? 1 : topForn.length) : "—"}
          sub={filtro.fornecedor ?? (topForn[0] ? `maior: ${topForn[0].chave}` : "com lançamento")}
        />
        <Quadro
          {...q("equipe")}
          rotulo="Equipe"
          valor={`${r.equipe.total} pessoas`}
          sub={pessoas.length ? `${cont("ajudante")} aj · ${cont("conferente")} conf · ${cont("empilhador")} emp` : `${r.equipe.ajudantes} aj · ${r.equipe.conferentes} conf`}
        />
        <Quadro
          {...q("eficiencia")}
          rotulo="Eficiência"
          valor={peso > 0 ? `${formatBRL(x.custo / (peso / 1000))}/t` : "—"}
          sub={peso > 0 && receita > 0 ? `receita ${semCentavos(receita / (peso / 1000))}/t` : "custo por tonelada"}
          verde={verde("custoPorTonelada")}
        />
      </div>
      <BarraFiltros filtro={filtro} onFiltro={onFiltro} />
    </div>
  );
}

function BarraFiltros({ filtro, onFiltro }: Filtro) {
  const chips: { k: keyof FiltroBI; rotulo: string }[] = [];
  if (filtro.dia) chips.push({ k: "dia", rotulo: `Dia ${ddmm(filtro.dia)}` });
  if (filtro.fornecedor) chips.push({ k: "fornecedor", rotulo: filtro.fornecedor });
  if (filtro.tipo) chips.push({ k: "tipo", rotulo: ROTULO_TIPO[filtro.tipo] });
  return (
    <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2 text-xs">
      <span className="font-bold uppercase tracking-[0.14em] text-white/35">Filtros</span>
      {chips.length === 0 && <span className="text-white/35">nenhum — clique num dia, fornecedor ou tipo de carga para filtrar tudo</span>}
      {chips.map((c) => (
        <button
          key={c.k}
          type="button"
          onClick={() => onFiltro({ ...filtro, [c.k]: null })}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 font-bold text-[#0a1650] hover:bg-amber-300"
          title="Tirar este filtro"
        >
          {c.rotulo} <span aria-hidden>✕</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={() => onFiltro({})} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
          Limpar tudo (Esc)
        </button>
      )}
    </div>
  );
}

// --- Palco ---------------------------------------------------------------------

export function PalcoBI({ dados, visao, filtro, onFiltro }: { dados: DadosBI; visao: VisaoBI } & Filtro) {
  const x = recortar(dados, filtro);
  if (!x) return <Vazio>Sem dados de recebimento para {formatMesAno(dados.mes)}.</Vazio>;
  const p = { dados, x, filtro, onFiltro };
  switch (visao) {
    case "custo":
      return <VisaoCusto {...p} />;
    case "descarrego":
      return <VisaoDescarrego {...p} />;
    case "receita":
      return <VisaoReceita {...p} />;
    case "fornecedores":
      return <VisaoFornecedores {...p} />;
    case "equipe":
      return <VisaoEquipe {...p} />;
    case "eficiencia":
      return <VisaoEficiencia {...p} />;
  }
}

type PropsVisao = { dados: DadosBI; x: Recorte } & Filtro;

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

const Dica = ({ children }: { children: ReactNode }) => <span className="text-[0.65rem] text-white/35">{children}</span>;

/** Barras verticais no escuro: tooltip no hover, clique opcional, item selecionado em âmbar. */
function BarrasTV({
  itens,
  fmt,
  altura = 180,
  referencia,
  onClick,
}: {
  itens: { chave: string; rotulo: string; valor: number | null; cor?: string; detalhe?: string; selecionado?: boolean }[];
  fmt: (v: number) => string;
  altura?: number;
  referencia?: { valor: number; rotulo: string };
  onClick?: (chave: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1e-9, ...itens.map((i) => Math.abs(i.valor ?? 0)), referencia?.valor ?? 0) * 1.1;
  const denso = itens.length > 14;
  const algumSel = itens.some((i) => i.selecionado);
  if (itens.length === 0) return <p className="py-8 text-center text-sm text-white/40">Sem lançamentos.</p>;
  return (
    <div className="relative" style={{ height: altura }} onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs text-[#0a1650] shadow-lg"
          style={{ left: `${Math.min(90, Math.max(10, ((hover + 0.5) / itens.length) * 100))}%` }}
        >
          <span className="font-bold">{itens[hover].detalhe ?? itens[hover].rotulo}</span> · {itens[hover].valor === null ? "sem dado" : fmt(itens[hover].valor!)}
          {onClick && <span className="text-slate-400"> · clique para {itens[hover].selecionado ? "tirar o filtro" : "filtrar"}</span>}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-5 top-0">
        {referencia && referencia.valor > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-white/30" style={{ bottom: `${(referencia.valor / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 text-[0.65rem] font-semibold text-white/50">
              {referencia.rotulo} {fmt(referencia.valor)}
            </span>
          </div>
        )}
        <div className={`flex h-full items-end ${denso ? "gap-[3px]" : "gap-2"}`}>
          {itens.map((it, i) => (
            <div
              key={it.chave}
              className={`flex h-full flex-1 flex-col items-center justify-end ${onClick ? "cursor-pointer" : ""}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => onClick?.(it.chave)}
            >
              {!denso && it.valor !== null && <span className={`mb-1 text-xs font-bold tabular-nums ${it.selecionado ? "text-amber-300" : "text-white/85"}`}>{fmt(it.valor)}</span>}
              <div
                className={`w-full rounded-t-md transition ${hover === i ? "brightness-125" : ""}`}
                style={{
                  height: `${Math.max(2, (Math.abs(it.valor ?? 0) / max) * 100)}%`,
                  background: it.selecionado ? "#f5b301" : (it.cor ?? "#5b6fd6"),
                  opacity: algumSel && !it.selecionado ? 0.35 : 1,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={`absolute inset-x-0 bottom-0 flex h-4 ${denso ? "gap-[3px]" : "gap-2"}`}>
        {itens.map((it, i) => (
          <span key={it.chave} className={`flex-1 whitespace-nowrap text-center text-[0.65rem] font-semibold ${it.selecionado ? "text-amber-300" : "text-white/45"}`}>
            {denso && i % Math.ceil(itens.length / 12) !== 0 && !it.selecionado ? "" : it.rotulo}
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

/** Barras de um indicador por mês, até o mês filtrado; verde = melhor do trimestre, âmbar = mês na tela. */
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
        cor: melhores.has(i) ? "#10b981" : x.mes === dados.mes ? "#c2820a" : "#5b6fd6",
        detalhe: `${formatMesAno(x.mes)}${x.fracaoMes < 1 ? " (em andamento)" : ""}`,
      }))}
    />
  );
}

// --- Visuais ligados (filtro cruzado) ------------------------------------------

type Medida = "carros" | "pesoKg" | "receita";
// Contagem inteira sem casas; média (fracionária) com 1 casa.
const FMT_MEDIDA: Record<Medida, (v: number) => string> = { carros: (v) => (Number.isInteger(v) ? inteiro.format(v) : dec1(v)), pesoKg: ton, receita: semCentavos };
const valorMedida = (s: ResumoFatos, m: Medida, porNotas: boolean) => (m === "carros" && porNotas ? s.notas : s[m]);

/** Dia a dia do mês (ignora o filtro de dia; o dia escolhido fica em âmbar). Clique filtra o dia. */
function GraficoDias({ dados, x, filtro, onFiltro, medida, altura = 150 }: PropsVisao & { medida: Medida; altura?: number }) {
  const fatos = filtrarFatos(dados.fatos ?? [], filtro, "dia");
  const dias = agrupar(fatos, (f) => f.data).sort((a, b) => a.chave.localeCompare(b.chave));
  const vals = dias.map((d) => valorMedida(d.resumo, medida, x.porNotas));
  const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  return (
    <BarrasTV
      altura={altura}
      fmt={FMT_MEDIDA[medida]}
      referencia={{ valor: media, rotulo: "média" }}
      onClick={(d) => onFiltro({ ...filtro, dia: filtro.dia === d ? null : d })}
      itens={dias.map((d, i) => ({ chave: d.chave, rotulo: d.chave.slice(8, 10), valor: vals[i], detalhe: ddmm(d.chave), selecionado: filtro.dia === d.chave }))}
    />
  );
}

/** Por tipo de carga (ignora o filtro de tipo; o tipo escolhido fica em âmbar). Clique filtra o tipo. */
function ListaTipos({ dados, x, filtro, onFiltro, medida }: PropsVisao & { medida: Medida }) {
  const fatos = filtrarFatos(dados.fatos ?? [], filtro, "tipo");
  const grupos = new Map(agrupar(fatos, (f) => f.tipo).map((g) => [g.chave, g.resumo]));
  const semTipo = resumir(fatos.filter((f) => f.tipo === null));
  const val = (t: DescarregamentoTipo) => {
    const s = grupos.get(t);
    if (!s) return 0;
    return t === "volume" && medida === "carros" ? s.descargasVolume : valorMedida(s, medida, x.porNotas);
  };
  const max = Math.max(1e-9, ...TIPOS_DESCARREGAMENTO.map(val));
  return (
    <div>
      <ul className="space-y-2.5">
        {TIPOS_DESCARREGAMENTO.map((t) => {
          const s = grupos.get(t);
          const sel = filtro.tipo === t;
          const apagado = !!filtro.tipo && !sel;
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => onFiltro({ ...filtro, tipo: sel ? null : t })}
                className={`w-full rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.06] ${sel ? "bg-amber-400/10 ring-1 ring-amber-400" : ""} ${apagado ? "opacity-40" : ""}`}
              >
                <div className="flex items-baseline justify-between text-sm">
                  <span className="inline-flex items-center gap-2 font-semibold text-white">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIPO_COR[t] }} />
                    {ROTULO_TIPO[t]}
                  </span>
                  <span className="tabular-nums text-white/70">
                    {s ? (
                      <>
                        <strong className="text-white">{t === "volume" ? `${inteiro.format(s.descargasVolume)} descargas` : x.porNotas ? `${s.notas} notas` : `${inteiro.format(s.carros)} carros`}</strong>
                        {s.pesoKg > 0 && ` · ${ton(s.pesoKg)}`}
                        {s.receita > 0 && ` · ${semCentavos(s.receita)}`}
                        {t === "volume" && s.caixas > 0 && ` · ${inteiro.format(s.caixas)} cx`}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${(val(t) / max) * 100}%`, background: sel ? "#f5b301" : TIPO_COR[t] }} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {(semTipo.pesoKg > 0 || semTipo.receita > 0) && (
        <p className="mt-2 text-xs text-white/35">
          + {ton(semTipo.pesoKg)} e {semCentavos(semTipo.receita)} do total do dia digitado, sem quebra por tipo.
        </p>
      )}
    </div>
  );
}

type OrdemForn = "pesoKg" | "receita" | "notas";

/** Fornecedores (ignora o filtro de fornecedor; o escolhido fica em âmbar). Clique filtra o fornecedor. */
function TabelaFornecedores({ dados, filtro, onFiltro, ordemInicial = "pesoKg" }: PropsVisao & { ordemInicial?: OrdemForn }) {
  const [ordem, setOrdem] = useState<OrdemForn>(ordemInicial);
  const fatos = filtrarFatos(dados.fatos ?? [], filtro, "fornecedor");
  const lista = agrupar(fatos, (f) => f.fornecedor).sort((a, b) => b.resumo[ordem] - a.resumo[ordem]);
  const semForn = resumir(fatos.filter((f) => f.fornecedor === null && !f.ajuste));
  const total = lista.reduce((t, f) => t + f.resumo[ordem], 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ChipTV ativo={ordem === "pesoKg"} onClick={() => setOrdem("pesoKg")}>por peso</ChipTV>
        <ChipTV ativo={ordem === "receita"} onClick={() => setOrdem("receita")}>por receita</ChipTV>
        <ChipTV ativo={ordem === "notas"} onClick={() => setOrdem("notas")}>por notas</ChipTV>
        <span className="ml-auto"><Dica>clique para filtrar</Dica></span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
            <tr>
              <th className="py-2 font-semibold">Fornecedor</th>
              <th className="py-2 text-right font-semibold">Notas</th>
              <th className="py-2 text-right font-semibold">Peso</th>
              <th className="py-2 text-right font-semibold">Receita</th>
              <th className="w-14 py-2 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => {
              const sel = filtro.fornecedor === f.chave;
              return (
                <tr
                  key={f.chave}
                  onClick={() => onFiltro({ ...filtro, fornecedor: sel ? null : f.chave })}
                  className={`cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.06] ${sel ? "bg-amber-400/15" : ""} ${filtro.fornecedor && !sel ? "opacity-40" : ""}`}
                >
                  <td className="max-w-0 py-2">
                    <div className={`truncate font-semibold ${sel ? "text-amber-300" : "text-white"}`} title={f.chave}>{f.chave}</div>
                    <div className="mt-1 h-1 rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${sel ? "bg-amber-400" : "bg-[#5b6fd6]"}`} style={{ width: `${total > 0 ? (f.resumo[ordem] / total) * 100 : 0}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums text-white/70">{f.resumo.notas}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{ton(f.resumo.pesoKg)}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{semCentavos(f.resumo.receita)}</td>
                  <td className="py-2 text-right tabular-nums text-white/50">{total > 0 ? formatPercent(f.resumo[ordem] / total, 0) : "—"}</td>
                </tr>
              );
            })}
            {semForn.receita > 0 && !filtro.fornecedor && (
              <tr className="border-t border-white/[0.06] text-white/45">
                <td className="py-2 italic">Total do dia (sem fornecedor)</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right tabular-nums">{ton(semForn.pesoKg)}</td>
                <td className="py-2 text-right tabular-nums">{semCentavos(semForn.receita)}</td>
                <td />
              </tr>
            )}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-white/40">Sem lançamentos por fornecedor no recorte.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- CUSTO --------------------------------------------------------------------

function VisaoCusto({ dados, x }: PropsVisao) {
  const [papel, setPapel] = useState<PessoaRecebimento["papel"] | "todos">("todos");
  const c = dados.custo;
  if (!c) return <Vazio>Carregando pessoas e equipamentos…</Vazio>;
  const { r, sel } = x;
  const folha = c.pessoas.reduce((t, p) => t + p.custo, 0);
  const custoEquip = c.equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const totalCad = folha + custoEquip;
  const papeis = ORDEM_PAPEL.filter((p) => c.pessoas.some((y) => y.papel === p));
  const lista = c.pessoas.filter((p) => papel === "todos" || p.papel === papel).sort((a, b) => ORDEM_PAPEL.indexOf(a.papel) - ORDEM_PAPEL.indexOf(b.papel) || b.custo - a.custo);
  const fatias = [
    ...papeis.map((p) => ({ rotulo: PAPEL[p].plural, valor: c.pessoas.filter((y) => y.papel === p).reduce((t, y) => t + y.custo, 0), cor: PAPEL[p].cor })),
    { rotulo: "Equipamentos", valor: custoEquip, cor: "#f5b301" },
  ].filter((f) => f.valor > 0);
  const carros = x.porNotas ? sel.notas : sel.carros;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Mini rotulo={x.criterioCusto ? "Custo no recorte" : "Custo do mês"} valor={formatBRL(x.custo)} sub={x.criterioCusto ?? (r.fracaoMes < 1 ? "proporcional aos dias corridos" : formatMesAno(r.mes))} />
        <Mini rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub={`${c.pessoas.length} pessoas · por mês`} />
        <Mini rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${c.equipamentos.reduce((t, e) => t + e.quantidade, 0)} unidades · por mês`} />
        <Mini rotulo={x.porNotas ? "Custo por nota" : "Custo por carro"} valor={carros > 0 ? formatBRL(x.custo / carros) : "—"} sub={x.porNotas ? `${sel.notas} notas` : `${inteiro.format(sel.carros)} carros`} />
        <Mini rotulo="Custo por tonelada" valor={sel.pesoKg > 0 ? formatBRL(x.custo / (sel.pesoKg / 1000)) : "—"} sub={ton(sel.pesoKg)} />
      </div>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Bloco
          titulo="Pessoas e salários"
          direita={
            <div className="flex flex-wrap gap-1.5">
              <ChipTV ativo={papel === "todos"} onClick={() => setPapel("todos")}>Todos {c.pessoas.length}</ChipTV>
              {papeis.map((p) => (
                <ChipTV key={p} ativo={papel === p} onClick={() => setPapel(p)}>
                  {PAPEL[p].rotulo} {c.pessoas.filter((y) => y.papel === p).length}
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
                    <td className="py-2 text-right tabular-nums text-white/50">{totalCad > 0 ? formatPercent(p.custo / totalCad) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-white/35">Cadastro atual (custo mensal com encargos). Salário é do mês; os filtros de dia/fornecedor/tipo ratiam o custo, não mudam a lista.</p>
          </div>
        </Bloco>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Bloco titulo="Equipamentos" direita={c.equipamentosPadrao ? <span className="text-xs text-amber-300">padrão — rode a migração 0023</span> : <Dica>Custos › Equipamentos</Dica>}>
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
            <SerieMeses dados={dados} valor={(y) => y.equipe.custo} fmt={semCentavos} maiorEhBom={false} altura={110} />
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
            {f.rotulo} {formatPercent(f.valor / total, 0)} · {semCentavos(f.valor)}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- DESCARREGO ---------------------------------------------------------------

function VisaoDescarrego(p: PropsVisao) {
  const { x } = p;
  const { sel } = x;
  if (!x.temFatos) return <Vazio>Carregando o descarrego do mês…</Vazio>;
  const qtd = x.porNotas ? sel.notas : sel.carros;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Mini rotulo={x.porNotas ? "Notas" : "Carros"} valor={inteiro.format(qtd)} sub={sel.dias > 0 ? `${dec1(qtd / sel.dias)} por dia` : undefined} />
        <Mini rotulo="Peso" valor={ton(sel.pesoKg)} sub={qtd > 0 ? `${formatKg(sel.pesoKg / qtd)} por ${x.porNotas ? "nota" : "carro"}` : undefined} />
        <Mini rotulo="Caixas (volume)" valor={inteiro.format(sel.caixas)} sub={`${inteiro.format(sel.descargasVolume)} descargas`} />
        <Mini rotulo="Dias com descarrego" valor={inteiro.format(sel.dias)} sub={formatMesAno(x.r.mes)} />
        <Mini rotulo="Receita" valor={formatBRL(sel.receita)} sub={qtd > 0 ? `${semCentavos(sel.receita / qtd)} por ${x.porNotas ? "nota" : "carro"}` : undefined} />
        <Mini rotulo="Fornecedores" valor={inteiro.format(sel.fornecedores)} sub="no recorte" />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Bloco titulo={x.porNotas ? "Notas por dia" : "Carros por dia"} direita={<Dica>clique num dia para filtrar</Dica>}>
            <GraficoDias {...p} medida="carros" />
          </Bloco>
          <Bloco titulo="Por tipo de carga" direita={<Dica>clique para filtrar</Dica>}>
            <ListaTipos {...p} medida="carros" />
          </Bloco>
        </div>
        <Bloco titulo="Fornecedores">
          <TabelaFornecedores {...p} />
        </Bloco>
      </div>
    </div>
  );
}

// --- RECEITA ------------------------------------------------------------------

function VisaoReceita(p: PropsVisao) {
  const { x, dados } = p;
  const { sel } = x;
  if (!x.temFatos) return <Vazio>Carregando a receita do mês…</Vazio>;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Mini rotulo="Receita de descarrego" valor={formatBRL(sel.receita)} sub={formatMesAno(x.r.mes)} />
        <Mini rotulo="Custo do recebimento" valor={formatBRL(x.custo)} sub={x.criterioCusto ?? "do mês"} />
        <Mini rotulo="Sobra (receita − custo)" valor={formatBRL(sel.receita - x.custo)} />
        <Mini rotulo="Custo consome" valor={sel.receita > 0 ? formatPercent(x.custo / sel.receita) : "—"} sub="da receita" />
        <Mini rotulo="Receita por tonelada" valor={sel.pesoKg > 0 ? formatBRL(sel.receita / (sel.pesoKg / 1000)) : "—"} sub={ton(sel.pesoKg)} />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Bloco titulo="Receita por dia" direita={<Dica>clique para filtrar</Dica>}>
            <GraficoDias {...p} medida="receita" altura={130} />
          </Bloco>
          <Bloco titulo="Receita por tipo" direita={<Dica>clique para filtrar</Dica>}>
            <ListaTipos {...p} medida="receita" />
          </Bloco>
        </div>
        <Bloco titulo="Receita e custo · mês a mês">
          <SerieMeses dados={dados} valor={(y) => y.receitaDescarrego} fmt={semCentavos} maiorEhBom altura={150} />
          <div className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Quanto o custo consome da receita</div>
          <SerieMeses dados={dados} valor={(y) => y.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} altura={120} />
        </Bloco>
        <Bloco titulo="Quem mais paga">
          <TabelaFornecedores {...p} ordemInicial="receita" />
        </Bloco>
      </div>
    </div>
  );
}

// --- FORNECEDORES -------------------------------------------------------------

function VisaoFornecedores(p: PropsVisao) {
  const { x } = p;
  if (!x.temFatos) return <Vazio>Carregando os fornecedores do mês…</Vazio>;
  const medida: Medida = "pesoKg";
  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Bloco titulo={`Fornecedores · ${formatMesAno(x.r.mes)}`}>
        <TabelaFornecedores {...p} />
      </Bloco>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <Bloco titulo="Peso por dia" direita={<Dica>clique para filtrar</Dica>}>
          <GraficoDias {...p} medida={medida} altura={140} />
        </Bloco>
        <Bloco titulo="Por tipo de carga" direita={<Dica>clique para filtrar</Dica>}>
          <ListaTipos {...p} medida="pesoKg" />
        </Bloco>
      </div>
    </div>
  );
}

// --- EQUIPE -------------------------------------------------------------------

function VisaoEquipe({ dados, x }: PropsVisao) {
  const c = dados.custo;
  const { r, sel } = x;
  const pessoas = c?.pessoas ?? [];
  const folha = pessoas.reduce((t, p) => t + p.custo, 0);
  const custoEquip = (c?.equipamentos ?? []).reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Mini rotulo="Pessoas" valor={inteiro.format(r.equipe.total)} sub={r.equipeEstimada ? "equipe de hoje (estimativa)" : formatMesAno(r.mes)} />
        <Mini rotulo="Folha total" valor={formatBRL(folha)} sub="por mês" />
        <Mini rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub="por mês" />
        <Mini rotulo="Peso descarregado" valor={ton(sel.pesoKg)} sub="pela equipe, no recorte" />
        <Mini rotulo={x.porNotas ? "Notas" : "Carros"} valor={inteiro.format(x.porNotas ? sel.notas : sel.carros)} sub="descarregados e conferidos" />
        <Mini rotulo="Dias trabalhados" valor={inteiro.format(sel.dias)} sub="com descarrego" />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Bloco titulo="Quem é quem">
          <div className="h-full space-y-4 overflow-auto pr-1">
            {ORDEM_PAPEL.filter((pp) => pessoas.some((y) => y.papel === pp)).map((pp) => {
              const grupo = pessoas.filter((y) => y.papel === pp);
              return (
                <div key={pp}>
                  <div className="mb-1.5 flex items-baseline justify-between border-b border-white/10 pb-1">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PAPEL[pp].cor }} />
                      {PAPEL[pp].plural} · {grupo.length}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-white">{formatBRL(grupo.reduce((t, y) => t + y.custo, 0))}</span>
                  </div>
                  <ul className="space-y-1">
                    {grupo.map((y) => (
                      <li key={y.id} className="flex justify-between text-sm">
                        <span className="text-white/80">{y.nome}</span>
                        <span className="tabular-nums text-white/50">{formatBRL(y.custo)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {pessoas.length === 0 && <p className="text-sm text-white/40">Carregando a equipe…</p>}
          </div>
        </Bloco>
        <div className="grid min-h-0 grid-rows-2 gap-4">
          <Bloco titulo="Peso descarregado pela equipe · mês a mês">
            <SerieMeses dados={dados} valor={(y) => y.pesoKg} fmt={ton} maiorEhBom altura={190} />
          </Bloco>
          <Bloco titulo="Carros descarregados pela equipe · mês a mês">
            <SerieMeses dados={dados} valor={(y) => y.carros} fmt={(v) => inteiro.format(v)} maiorEhBom altura={190} />
          </Bloco>
        </div>
      </div>
    </div>
  );
}

// --- EFICIÊNCIA ----------------------------------------------------------------

function VisaoEficiencia({ dados, x }: PropsVisao) {
  const { r, sel } = x;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini rotulo="Custo por tonelada" valor={sel.pesoKg > 0 ? formatBRL(x.custo / (sel.pesoKg / 1000)) : "—"} sub={x.criterioCusto ?? "o número que mede a equipe"} />
        <Mini rotulo="Custo ÷ descarrego" valor={sel.receita > 0 ? formatPercent(x.custo / sel.receita) : "—"} />
        <Mini rotulo="Custo ÷ faturamento líquido" valor={r.custoSobreFaturamento === null ? "—" : formatPercent(r.custoSobreFaturamento, 2)} sub="do mês" />
        <Mini rotulo="Faturamento líquido" valor={r.faturamentoLiquido === null ? "—" : formatBRL(r.faturamentoLiquido)} sub={formatMesAno(r.mes)} />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-3">
        <Bloco titulo="Custo por tonelada · mês a mês">
          <SerieMeses dados={dados} valor={(y) => y.custoPorTonelada} fmt={formatBRL} maiorEhBom={false} altura={340} />
        </Bloco>
        <Bloco titulo="Custo ÷ descarrego · mês a mês">
          <SerieMeses dados={dados} valor={(y) => y.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} altura={340} />
        </Bloco>
        <Bloco titulo="Custo ÷ faturamento · mês a mês">
          <SerieMeses dados={dados} valor={(y) => y.custoSobreFaturamento} fmt={(v) => formatPercent(v, 2)} maiorEhBom={false} altura={340} />
        </Bloco>
      </div>
    </div>
  );
}
