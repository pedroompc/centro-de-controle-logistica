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
import { useState } from "react";
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
import type { DescarregamentoTipo } from "@/domain/types";
import type { DetalheCusto, PessoaRecebimento } from "../../painel/painel-actions";
import {
  Quadro, Vazio, Bloco, Mini, useSub, ChipTV, Dica, BarrasTV, BarraComposicao,
  TabelaEquipe, ListaEquipamentos, SubFolha, CalendarioBI, semCentavos, type PapelBI,
} from "./bi-ui";

export type VisaoBI = "custo" | "descarrego" | "receita" | "eficiencia";

export const VISOES_BI: { id: VisaoBI; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo e equipe", contexto: "quem e o que compõe o custo — pessoas por função, salários e equipamentos" },
  { id: "descarrego", titulo: "Descarrego", contexto: "carros, fornecedores atendidos, tipos, peso e dia a dia · clique para filtrar" },
  { id: "receita", titulo: "Receita de descarrego", contexto: "de onde vem a receita e quanto dela o custo consome · clique para filtrar" },
  { id: "eficiencia", titulo: "Eficiência", contexto: "custo por tonelada, sobre o descarrego e sobre o faturamento" },
];

const inteiro = new Intl.NumberFormat("pt-BR");
const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fmtPeso = (kg: number) => formatKg(kg); // peso sempre em kg (pedido do gestor)
const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const TIPO_COR: Record<DescarregamentoTipo, string> = { batido: "#5b6fd6", paletizado: "#8b93e0", pal_rem: "#f5b301", volume: "#38bdf8" };
const PAPEL: Record<PessoaRecebimento["papel"], { rotulo: string; plural: string; cor: string }> = {
  ajudante: { rotulo: "Ajudante", plural: "Ajudantes", cor: "#5b6fd6" },
  conferente: { rotulo: "Conferente", plural: "Conferentes", cor: "#8b93e0" },
  empilhador: { rotulo: "Puxador", plural: "Puxador", cor: "#c2820a" },
  outros: { rotulo: "Outros", plural: "Outros", cor: "#64748b" },
};
const ORDEM_PAPEL = ["ajudante", "conferente", "empilhador", "outros"] as const;
const PAPEIS: PapelBI[] = ORDEM_PAPEL.map((id) => ({ id, ...PAPEL[id] }));

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


/** O topo do BI: 6 quadros (menu) + a barra de filtros ativos. */
export function MenuBI({ dados, visao, onVisao, filtro, onFiltro }: { dados: DadosBI; visao: VisaoBI | null; onVisao: (v: VisaoBI) => void } & Filtro) {
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
    .map((e) => `${e.quantidade} ${e.nome.toLowerCase()}`)
    .join(" · ");
  const q = (v: VisaoBI) => ({ ativo: visao === v, onClick: () => onVisao(v) });
  const usar = x.temFatos;
  const peso = usar ? sel.pesoKg : r.pesoKg;
  const receita = usar ? sel.receita : r.receitaDescarrego;
  const pessoas = dados.custo?.pessoas ?? [];
  const cont = (p: PessoaRecebimento["papel"]) => pessoas.filter((y) => y.papel === p).length;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Quadro
          {...q("custo")}
          rotulo="Custo e equipe"
          valor={formatBRL(x.custo)}
          sub={
            x.criterioCusto ??
            `${pessoas.length ? `${cont("ajudante")} aj · ${cont("conferente")} conf · ${cont("empilhador")} pux` : `${r.equipe.total} pessoas`}${resumoEquip ? ` · ${resumoEquip}` : ""}`
          }
        />
        <Quadro {...q("descarrego")} rotulo="Descarrego" valor={usar ? carrosOuNotas(x) : `${inteiro.format(r.carros)} carros`} sub={`${fmtPeso(peso)} · ${usar ? sel.dias : r.diasDescarrego} ${(usar ? sel.dias : r.diasDescarrego) === 1 ? "dia" : "dias"}${usar ? ` · ${sel.fornecedores} fornecedores` : ""}`} verde={verde("carrosPorDia")} />
        <Quadro {...q("receita")} rotulo="Receita" valor={formatBRL(receita)} sub={`custo consome ${receita > 0 ? formatPercent(x.custo / receita) : "—"}`} verde={verde("resultado")} />
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
    case "eficiencia":
      return <VisaoEficiencia {...p} />;
  }
}

type PropsVisao = { dados: DadosBI; x: Recorte } & Filtro;

// --- Peças --------------------------------------------------------------------








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

type Medida = "carros" | "pesoKg" | "receita" | "caixas";
// Contagem inteira sem casas; média (fracionária) com 1 casa.
const contagem = (v: number) => (Number.isInteger(v) ? inteiro.format(v) : dec1(v));
const FMT_MEDIDA: Record<Medida, (v: number) => string> = { carros: contagem, pesoKg: fmtPeso, receita: semCentavos, caixas: contagem };
const valorMedida = (s: ResumoFatos, m: Medida, porNotas: boolean) => (m === "carros" && porNotas ? s.notas : s[m]);

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Dia a dia do mês como CALENDÁRIO (ignora o filtro de dia; o dia escolhido
 * fica em âmbar). Cor: um tom só, mais forte quanto maior o valor do dia;
 * dia sem descarrego fica apagado. Clique filtra o dia.
 */
function GraficoDias({ dados, x, filtro, onFiltro, medida }: PropsVisao & { medida: Medida; altura?: number }) {
  const fatos = filtrarFatos(dados.fatos ?? [], filtro, "dia");
  const porDia = new Map(agrupar(fatos, (f) => f.data).map((d) => [d.chave, valorMedida(d.resumo, medida, x.porNotas)]));
  return <Calendario mes={dados.mes} porDia={porDia} fmt={FMT_MEDIDA[medida]} filtro={filtro} onFiltro={onFiltro} />;
}

/**
 * Calendário do mês (Dom–Sáb) com um valor por dia. Cor: um tom só, mais forte
 * quanto maior o valor (ou quanto MENOR, em custo: `menorEhMelhor` inverte para
 * o dia bom ficar forte). Dia sem valor fica apagado. Clique filtra o dia.
 */
function Calendario({ mes, porDia, fmt, filtro, onFiltro, menorEhMelhor = false }: { mes: string; porDia: Map<string, number>; fmt: (v: number) => string; menorEhMelhor?: boolean } & Filtro) {
  return (
    <CalendarioBI
      mes={mes}
      porDia={porDia}
      fmt={fmt}
      menorEhMelhor={menorEhMelhor}
      selecionado={filtro.dia ?? null}
      onSelecionar={(dia) => onFiltro({ ...filtro, dia })}
      vazio="sem descarrego"
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
                        {s.pesoKg > 0 && ` · ${fmtPeso(s.pesoKg)}`}
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
          + {fmtPeso(semTipo.pesoKg)} e {semCentavos(semTipo.receita)} do total do dia digitado, sem quebra por tipo.
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
                  <td className="py-2 text-right tabular-nums text-white/70">{fmtPeso(f.resumo.pesoKg)}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{semCentavos(f.resumo.receita)}</td>
                  <td className="py-2 text-right tabular-nums text-white/50">{total > 0 ? formatPercent(f.resumo[ordem] / total, 0) : "—"}</td>
                </tr>
              );
            })}
            {semForn.receita > 0 && !filtro.fornecedor && (
              <tr className="border-t border-white/[0.06] text-white/45">
                <td className="py-2 italic">Total do dia (sem fornecedor)</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right tabular-nums">{fmtPeso(semForn.pesoKg)}</td>
                <td className="py-2 text-right tabular-nums">{semCentavos(semForn.receita)}</td>
                <td />
              </tr>
            )}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-white/40">Sem lançamentos por fornecedor no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- CUSTO --------------------------------------------------------------------

type SubCusto = "custo" | "equipe" | "folha" | "equipamentos" | "porCarro" | "porTonelada";
const TITULO_SUB_CUSTO: Record<SubCusto, string> = {
  custo: "Custo do mês",
  equipe: "Equipe",
  folha: "Folha",
  equipamentos: "Equipamentos",
  porCarro: "Custo por carro",
  porTonelada: "Custo por tonelada",
};

/**
 * Custo de cada dia de descarrego: o custo do mês ÷ dias de descarrego; com
 * filtro de fornecedor/tipo, rateado pelo peso do dia. Volta carros e peso do
 * dia para as razões (por carro, por tonelada).
 */
function custosPorDia(dados: DadosBI, x: Recorte, filtro: FiltroBI) {
  const todos = dados.fatos ?? [];
  const pesoTotalDia = new Map(agrupar(todos, (f) => f.data).map((d) => [d.chave, d.resumo.pesoKg]));
  const custoDia = x.mes.dias > 0 ? x.r.custoPeriodo / x.mes.dias : 0;
  const rateia = !!(filtro.fornecedor || filtro.tipo);
  return agrupar(filtrarFatos(todos, filtro, "dia"), (f) => f.data).map((d) => {
    const base = pesoTotalDia.get(d.chave) ?? 0;
    const custo = rateia ? (base > 0 ? (custoDia * d.resumo.pesoKg) / base : 0) : custoDia;
    return { data: d.chave, custo, carros: x.porNotas ? d.resumo.notas : d.resumo.carros, pesoKg: d.resumo.pesoKg };
  });
}

function VisaoCusto(p: PropsVisao) {
  const { dados, x, filtro, onFiltro } = p;
  const { sub, abrir, fechar } = useSub<SubCusto>();
  const c = dados.custo;
  if (!c) return <Vazio>Carregando pessoas e equipamentos…</Vazio>;
  const { r, sel } = x;
  const folha = c.pessoas.reduce((t, y) => t + y.custo, 0);
  const custoEquip = c.equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const papeis = ORDEM_PAPEL.filter((pp) => c.pessoas.some((y) => y.papel === pp));
  const fatias = [
    ...papeis.map((pp) => ({ rotulo: PAPEL[pp].plural, valor: c.pessoas.filter((y) => y.papel === pp).reduce((t, y) => t + y.custo, 0), cor: PAPEL[pp].cor })),
    { rotulo: "Equipamentos", valor: custoEquip, cor: "#f5b301" },
  ].filter((f) => f.valor > 0);
  const carros = x.porNotas ? sel.notas : sel.carros;
  const un = x.porNotas ? "nota" : "carro";
  const card = (k: SubCusto) => ({ onClick: abrir(k), ativo: sub === k });
  const dias = custosPorDia(dados, x, filtro);
  const porCarroDia = new Map(dias.filter((d) => d.carros > 0).map((d) => [d.data, d.custo / d.carros]));
  const porTonDia = new Map(dias.filter((d) => d.pesoKg > 0).map((d) => [d.data, d.custo / (d.pesoKg / 1000)]));
  const resumoDias = (m: Map<string, number>, fmt: (v: number) => string) => {
    const v = [...m.entries()].sort((a, b) => a[1] - b[1]);
    if (!v.length) return null;
    return (
      <div className="grid grid-cols-3 gap-3">
        <Mini rotulo="Média dos dias" valor={fmt(v.reduce((t, e) => t + e[1], 0) / v.length)} sub="cada dia pesa igual" />
        <Mini rotulo="Melhor dia (mais barato)" valor={fmt(v[0][1])} sub={ddmm(v[0][0])} />
        <Mini rotulo="Pior dia (mais caro)" valor={fmt(v[v.length - 1][1])} sub={ddmm(v[v.length - 1][0])} />
      </div>
    );
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Mini {...card("custo")} rotulo={x.criterioCusto ? "Custo no filtro" : "Custo do mês"} valor={formatBRL(x.custo)} sub={x.criterioCusto ?? (r.fracaoMes < 1 ? "proporcional aos dias corridos" : formatMesAno(r.mes))} />
        <Mini
          {...card("equipe")}
          rotulo="Equipe"
          valor={`${c.pessoas.length} pessoas`}
          sub={papeis.map((pp) => `${c.pessoas.filter((y) => y.papel === pp).length} ${PAPEL[pp].rotulo.toLowerCase().slice(0, 4)}.`).join(" · ")}
        />
        <Mini {...card("folha")} rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub="por mês, com encargos" />
        <Mini {...card("equipamentos")} rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${c.equipamentos.reduce((t, e) => t + e.quantidade, 0)} unidades · por mês`} />
        <Mini {...card("porCarro")} rotulo={`Custo por ${un}`} valor={carros > 0 ? formatBRL(x.custo / carros) : "—"} sub={x.porNotas ? `${sel.notas} notas` : `${inteiro.format(sel.carros)} carros`} />
        <Mini {...card("porTonelada")} rotulo="Custo por tonelada" valor={sel.pesoKg > 0 ? formatBRL(x.custo / (sel.pesoKg / 1000)) : "—"} sub={fmtPeso(sel.pesoKg)} />
      </div>
      <div className="flex items-center gap-3 text-xs">
        {sub ? (
          <>
            <button type="button" onClick={fechar} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
              ◂ Voltar ao resumo
            </button>
            <span className="font-bold uppercase tracking-[0.16em] text-amber-300">Custo e equipe › {TITULO_SUB_CUSTO[sub]}</span>
          </>
        ) : (
          <span className="text-white/35">Clique num card para abrir o detalhe dele</span>
        )}
      </div>

      {sub === null && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TabelaEquipe pessoas={c.pessoas} papeis={PAPEIS} total={folha + custoEquip} />
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <ListaEquipamentos equipamentos={c.equipamentos} padrao={c.equipamentosPadrao} />
            <Bloco titulo="Do que é feito o custo">
              <BarraComposicao fatias={fatias} />
              <div className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Custo por mês</div>
              <SerieMeses dados={dados} valor={(y) => y.equipe.custo} fmt={semCentavos} maiorEhBom={false} altura={110} />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "custo" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Bloco titulo="Do que é feito o custo">
            <BarraComposicao fatias={fatias} />
            <ul className="mt-4 space-y-2">
              {fatias.map((f) => (
                <li key={f.rotulo} className="flex items-baseline justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-white">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />
                    {f.rotulo}
                  </span>
                  <span className="tabular-nums text-white">
                    {formatBRL(f.valor)} <span className="text-white/40">· {formatPercent(f.valor / (folha + custoEquip), 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Mini rotulo="Custo por dia de descarrego" valor={x.mes.dias > 0 ? formatBRL(r.custoPeriodo / x.mes.dias) : "—"} sub={`${x.mes.dias} dias`} />
              <Mini rotulo="Custo consome da receita" valor={r.receitaDescarrego > 0 ? formatPercent(r.custoPeriodo / r.receitaDescarrego) : "—"} sub="do descarrego do mês" />
            </div>
          </Bloco>
          <div className="grid min-h-0 grid-rows-2 gap-4">
            <Bloco titulo="Custo por mês">
              <SerieMeses dados={dados} valor={(y) => y.equipe.custo} fmt={semCentavos} maiorEhBom={false} altura={150} />
            </Bloco>
            <Bloco titulo="Quanto o custo consome da receita · mês a mês">
              <SerieMeses dados={dados} valor={(y) => y.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} altura={150} />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "equipe" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TabelaEquipe pessoas={c.pessoas} papeis={PAPEIS} total={folha + custoEquip} />
          <Bloco titulo="Por função">
            <ul className="space-y-4">
              {papeis.map((pp) => {
                const g = c.pessoas.filter((y) => y.papel === pp);
                const tot = g.reduce((t, y) => t + y.custo, 0);
                return (
                  <li key={pp}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-bold text-white">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PAPEL[pp].cor }} />
                        {PAPEL[pp].plural} · {g.length}
                      </span>
                      <span className="font-bold tabular-nums text-white">{formatBRL(tot)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${folha > 0 ? (tot / folha) * 100 : 0}%`, background: PAPEL[pp].cor }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-white/45">
                      <span>{formatPercent(folha > 0 ? tot / folha : 0, 0)} da folha</span>
                      <span>média {formatBRL(tot / g.length)} por pessoa</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Bloco>
        </div>
      )}

      {sub === "folha" && <SubFolha pessoas={c.pessoas} papeis={PAPEIS} />}

      {sub === "equipamentos" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <ListaEquipamentos equipamentos={c.equipamentos} padrao={c.equipamentosPadrao} grande />
          <div className="grid grid-cols-2 content-start gap-3">
            <Mini rotulo="% do custo do recebimento" valor={folha + custoEquip > 0 ? formatPercent(custoEquip / (folha + custoEquip), 0) : "—"} />
            <Mini rotulo={`Equipamentos por ${un}`} valor={carros > 0 ? formatBRL((custoEquip * (r.fracaoMes < 1 ? r.fracaoMes : 1)) / carros) : "—"} sub="custo dos equipamentos ÷ carros" />
            <Mini rotulo="Equipamentos por tonelada" valor={sel.pesoKg > 0 ? formatBRL((custoEquip * (r.fracaoMes < 1 ? r.fracaoMes : 1)) / (sel.pesoKg / 1000)) : "—"} />
            <Mini rotulo="Unidades" valor={inteiro.format(c.equipamentos.reduce((t, e) => t + e.quantidade, 0))} sub="cadastro em Custos › Equipamentos" />
          </div>
        </div>
      )}

      {sub === "porCarro" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Bloco titulo={`Custo por ${un} · dia a dia`} direita={<Dica>forte = dia mais barato · clique filtra</Dica>}>
            <Calendario mes={dados.mes} porDia={porCarroDia} fmt={semCentavos} filtro={filtro} onFiltro={onFiltro} menorEhMelhor />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            {resumoDias(porCarroDia, semCentavos)}
            <Bloco titulo={`Custo por ${un} · mês a mês`}>
              <SerieMeses dados={dados} valor={(y) => (y.carros > 0 ? y.custoPeriodo / y.carros : null)} fmt={semCentavos} maiorEhBom={false} altura={170} />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "porTonelada" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Bloco titulo="Custo por tonelada · dia a dia" direita={<Dica>forte = dia mais barato · clique filtra</Dica>}>
            <Calendario mes={dados.mes} porDia={porTonDia} fmt={semCentavos} filtro={filtro} onFiltro={onFiltro} menorEhMelhor />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            {resumoDias(porTonDia, semCentavos)}
            <Bloco titulo="Custo por tonelada · mês a mês">
              <SerieMeses dados={dados} valor={(y) => y.custoPorTonelada} fmt={formatBRL} maiorEhBom={false} altura={170} />
            </Bloco>
          </div>
        </div>
      )}
    </div>
  );
}





// --- DESCARREGO ---------------------------------------------------------------

/** Média por dia da semana (dias com descarrego do mês; ignora o filtro de dia). */
function DiasDaSemana({ dados, x, filtro, medida, altura = 150 }: PropsVisao & { medida: Medida; altura?: number }) {
  const dias = agrupar(filtrarFatos(dados.fatos ?? [], filtro, "dia"), (f) => f.data);
  const soma = Array(7).fill(0);
  const qtd = Array(7).fill(0);
  for (const d of dias) {
    const [a, m, dd] = d.chave.split("-").map(Number);
    const w = new Date(a, m - 1, dd).getDay();
    soma[w] += valorMedida(d.resumo, medida, x.porNotas);
    qtd[w] += 1;
  }
  const medias = soma.map((v, w) => (qtd[w] ? v / qtd[w] : null));
  const melhor = Math.max(...medias.map((v) => v ?? 0));
  return (
    <BarrasTV
      altura={altura}
      fmt={FMT_MEDIDA[medida]}
      itens={SEMANA.map((d, w) => ({
        chave: d,
        rotulo: d,
        valor: medias[w],
        cor: medias[w] !== null && medias[w] === melhor ? "#10b981" : "#5b6fd6",
        detalhe: `${d} · ${qtd[w]} ${qtd[w] === 1 ? "dia" : "dias"} com descarrego`,
      }))}
    />
  );
}

/** Ranking de fornecedores por uma medida (barra + valor); clique filtra. */
function RankingFornecedores({ dados, filtro, onFiltro, medida, limite = 12 }: PropsVisao & { medida: Medida; limite?: number }) {
  const lista = agrupar(filtrarFatos(dados.fatos ?? [], filtro, "fornecedor"), (f) => f.fornecedor)
    .map((g) => ({ nome: g.chave, v: g.resumo[medida === "carros" ? "notas" : medida] }))
    .filter((g) => g.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = lista.reduce((t, g) => t + g.v, 0);
  if (lista.length === 0) return <p className="py-6 text-center text-sm text-white/40">Sem lançamentos por fornecedor.</p>;
  return (
    <ul className="h-full space-y-2 overflow-auto pr-1">
      {lista.slice(0, limite).map((g) => {
        const sel = filtro.fornecedor === g.nome;
        return (
          <li key={g.nome}>
            <button
              type="button"
              onClick={() => onFiltro({ ...filtro, fornecedor: sel ? null : g.nome })}
              className={`w-full rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.06] ${sel ? "bg-amber-400/10 ring-1 ring-amber-400" : ""} ${filtro.fornecedor && !sel ? "opacity-40" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={`truncate font-semibold ${sel ? "text-amber-300" : "text-white"}`}>{g.nome}</span>
                <span className="shrink-0 tabular-nums text-white">
                  {FMT_MEDIDA[medida](g.v)} <span className="text-white/40">· {formatPercent(g.v / total, 0)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10">
                <div className={`h-full rounded-full ${sel ? "bg-amber-400" : "bg-[#5b6fd6]"}`} style={{ width: `${(g.v / lista[0].v) * 100}%` }} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type SubDescarrego = "carros" | "fornecedores" | "peso" | "caixas" | "dias";
const TITULO_SUB: Record<SubDescarrego, string> = {
  carros: "Carros",
  fornecedores: "Fornecedores atendidos",
  peso: "Peso",
  caixas: "Caixas (volume)",
  dias: "Dias com descarrego",
};

function VisaoDescarrego(p: PropsVisao) {
  const { x } = p;
  const { sel } = x;
  const { sub, abrir, fechar } = useSub<SubDescarrego>();
  if (!x.temFatos) return <Vazio>Carregando o descarrego do mês…</Vazio>;
  const qtd = x.porNotas ? sel.notas : sel.carros;
  const ajudantes = x.r.equipe.ajudantes;
  const kgPorAjudante = ajudantes > 0 ? sel.pesoKg / ajudantes : null;
  const un = x.porNotas ? "nota" : "carro";
  const card = (k: SubDescarrego) => ({ onClick: abrir(k), ativo: sub === k });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      {/* Receita não entra aqui: tem o quadro próprio no topo. */}
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">
        <Mini {...card("carros")} rotulo={x.porNotas ? "Notas" : "Carros"} valor={inteiro.format(qtd)} sub={sel.dias > 0 ? `${dec1(qtd / sel.dias)} por dia` : undefined} />
        <Mini {...card("fornecedores")} rotulo="Fornecedores atendidos" valor={inteiro.format(sel.fornecedores)} sub={sel.notas > 0 ? `${inteiro.format(sel.notas)} notas descarregadas` : "com lançamento no mês"} />
        <Mini
          {...card("peso")}
          rotulo="Peso"
          valor={fmtPeso(sel.pesoKg)}
          sub={kgPorAjudante !== null ? `${formatKg(kgPorAjudante)} por ajudante` : qtd > 0 ? `${formatKg(sel.pesoKg / qtd)} por ${un}` : undefined}
        />
        <Mini {...card("caixas")} rotulo="Caixas (volume)" valor={inteiro.format(sel.caixas)} sub={`${inteiro.format(sel.descargasVolume)} descargas`} />
        <Mini {...card("dias")} rotulo="Dias com descarrego" valor={inteiro.format(sel.dias)} sub={formatMesAno(x.r.mes)} />
      </div>
      <div className="flex items-center gap-3 text-xs">
        {sub ? (
          <>
            <button type="button" onClick={fechar} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
              ◂ Voltar ao resumo
            </button>
            <span className="font-bold uppercase tracking-[0.16em] text-amber-300">Descarrego › {TITULO_SUB[sub]}</span>
          </>
        ) : (
          <span className="text-white/35">Clique num card para abrir o detalhe dele · clique num dia, tipo ou fornecedor para filtrar tudo</span>
        )}
      </div>

      {sub === null && (
        // Fornecedores com a coluna inteira (é a lista mais longa); calendário e tipos dividem a outra.
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
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
      )}

      {sub === "carros" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Bloco titulo={x.porNotas ? "Notas por dia" : "Carros por dia"} direita={<Dica>clique num dia para filtrar</Dica>}>
            <GraficoDias {...p} medida="carros" />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <Bloco titulo="Por tipo de carga" direita={<Dica>clique para filtrar</Dica>}>
              <ListaTipos {...p} medida="carros" />
            </Bloco>
            <Bloco titulo={`Média de ${x.porNotas ? "notas" : "carros"} por dia da semana`} direita={<Dica>verde = dia mais forte</Dica>}>
              <DiasDaSemana {...p} medida="carros" />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "fornecedores" && <SubFornecedores {...p} />}

      {sub === "peso" && (
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Mini rotulo={`Peso por ${un}`} valor={qtd > 0 ? formatKg(sel.pesoKg / qtd) : "—"} />
            <Mini rotulo="Peso por dia" valor={sel.dias > 0 ? formatKg(sel.pesoKg / sel.dias) : "—"} sub={`${sel.dias} dias com descarrego`} />
            <Mini rotulo="Descarregado por ajudante" valor={kgPorAjudante !== null ? formatKg(kgPorAjudante) : "—"} sub={`${ajudantes} ajudantes · média da equipe`} />
            <Mini rotulo="Por ajudante por dia" valor={kgPorAjudante !== null && sel.dias > 0 ? formatKg(kgPorAjudante / sel.dias) : "—"} />
          </div>
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Bloco titulo="Peso por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
              <GraficoDias {...p} medida="pesoKg" />
            </Bloco>
            <Bloco titulo="Peso por tipo de carga" direita={<Dica>clique para filtrar</Dica>}>
              <ListaTipos {...p} medida="pesoKg" />
            </Bloco>
            <Bloco titulo="Peso por fornecedor" direita={<Dica>clique para filtrar</Dica>}>
              <RankingFornecedores {...p} medida="pesoKg" />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "caixas" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Bloco titulo="Caixas por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
            <GraficoDias {...p} medida="caixas" />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Mini rotulo="Caixas por descarga" valor={sel.descargasVolume > 0 ? contagem(Math.round(sel.caixas / sel.descargasVolume)) : "—"} sub={`${inteiro.format(sel.descargasVolume)} descargas de volume`} />
              <Mini rotulo="Caixas por dia" valor={sel.dias > 0 ? contagem(Math.round(sel.caixas / sel.dias)) : "—"} />
            </div>
            <Bloco titulo="Caixas por fornecedor">
              <RankingFornecedores {...p} medida="caixas" />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "dias" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Bloco titulo={x.porNotas ? "Notas por dia" : "Carros por dia"} direita={<Dica>clique num dia para filtrar</Dica>}>
            <GraficoDias {...p} medida="carros" />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <DiasResumo {...p} />
            <Bloco titulo="Média por dia da semana" direita={<Dica>verde = dia mais forte</Dica>}>
              <DiasDaSemana {...p} medida="carros" />
            </Bloco>
          </div>
        </div>
      )}

    </div>
  );
}

/** Card de destaque com a lista de quem compõe o número (clique no nome filtra). */
function CardQuem({
  titulo,
  valor,
  explicacao,
  itens,
  filtro,
  onFiltro,
}: {
  titulo: string;
  valor: string;
  explicacao: string;
  itens: { rotulo: string; fornecedor?: string; principal: string; detalhe: string }[]; // `fornecedor` = linha clicável (filtra)
} & Filtro) {
  return (
    <div className="flex min-h-0 flex-col rounded-xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">{titulo}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-white">{valor}</span>
        <span className="text-xs text-white/40">{explicacao}</span>
      </div>
      <ol className="mt-2 min-h-0 flex-1 space-y-1 overflow-auto">
        {itens.map((it, i) => {
          const sel = !!it.fornecedor && filtro.fornecedor === it.fornecedor;
          const conteudo = (
            <>
              {it.fornecedor && <span className="w-4 shrink-0 text-xs font-bold text-amber-300">{i + 1}º</span>}
              <span title={it.rotulo} className={`min-w-0 flex-1 truncate ${it.fornecedor ? "font-semibold" : ""} ${sel ? "text-amber-300" : it.fornecedor ? "text-white" : "text-white/55"}`}>{it.rotulo}</span>
              <span className="shrink-0 font-bold tabular-nums text-white">{it.principal}</span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-white/45">{it.detalhe}</span>
            </>
          );
          return (
            <li key={`${it.rotulo}-${i}`}>
              {it.fornecedor ? (
                <button
                  type="button"
                  onClick={() => onFiltro({ ...filtro, fornecedor: sel ? null : it.fornecedor })}
                  className={`flex w-full items-baseline gap-2 rounded-md px-1.5 py-0.5 text-left text-sm transition hover:bg-white/[0.07] ${sel ? "bg-amber-400/15" : ""}`}
                  title="Clique para filtrar este fornecedor"
                >
                  {conteudo}
                </button>
              ) : (
                <div className="flex items-baseline gap-2 px-1.5 py-0.5 text-sm">{conteudo}</div>
              )}
            </li>
          );
        })}
        {itens.length === 0 && <li className="text-sm text-white/40">Sem lançamentos por fornecedor.</li>}
      </ol>
    </div>
  );
}

/** Fornecedores: tabela + dependência dos maiores (com nomes e números de cada um). */
function SubFornecedores(p: PropsVisao) {
  const lista = agrupar(filtrarFatos(p.dados.fatos ?? [], p.filtro, "fornecedor"), (f) => f.fornecedor);
  const totP = lista.reduce((t, g) => t + g.resumo.pesoKg, 0);
  const totR = lista.reduce((t, g) => t + g.resumo.receita, 0);
  const totN = lista.reduce((t, g) => t + g.resumo.notas, 0);
  const pct = (v: number, tot: number) => (tot > 0 ? formatPercent(v / tot, 0) : "—");
  const porPeso = [...lista].sort((a, b) => b.resumo.pesoKg - a.resumo.pesoKg);
  const porReceita = [...lista].sort((a, b) => b.resumo.receita - a.resumo.receita);
  const porNotas = [...lista].sort((a, b) => b.resumo.notas - a.resumo.notas);
  const top3P = porPeso.slice(0, 3);
  const top3R = porReceita.slice(0, 3);
  const maior = porPeso[0];
  const doQue = filtroAtivo(p.filtro) ? "do filtro" : "do mês";
  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Bloco titulo="Fornecedores atendidos">
        <TabelaFornecedores {...p} />
      </Bloco>
      <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-3">
        <CardQuem
          {...p}
          titulo="Peso que vem dos 3 maiores"
          valor={pct(top3P.reduce((t, g) => t + g.resumo.pesoKg, 0), totP)}
          explicacao={`do peso ${doQue}`}
          itens={top3P.map((g) => ({ rotulo: g.chave, fornecedor: g.chave, principal: fmtPeso(g.resumo.pesoKg), detalhe: `${pct(g.resumo.pesoKg, totP)} do peso` }))}
        />
        <CardQuem
          {...p}
          titulo="Receita que vem dos 3 maiores"
          valor={pct(top3R.reduce((t, g) => t + g.resumo.receita, 0), totR)}
          explicacao={`da receita ${doQue}`}
          itens={top3R.map((g) => ({ rotulo: g.chave, fornecedor: g.chave, principal: semCentavos(g.resumo.receita), detalhe: `${pct(g.resumo.receita, totR)} da receita` }))}
        />
        <CardQuem
          {...p}
          titulo="Maior fornecedor · % do peso"
          valor={maior ? pct(maior.resumo.pesoKg, totP) : "—"}
          explicacao={maior ? maior.chave : ""}
          itens={
            maior
              ? [
                  { rotulo: maior.chave, fornecedor: maior.chave, principal: fmtPeso(maior.resumo.pesoKg), detalhe: "de peso" },
                  { rotulo: "Receita", principal: semCentavos(maior.resumo.receita), detalhe: `${pct(maior.resumo.receita, totR)} da receita` },
                  { rotulo: "Notas", principal: `${maior.resumo.notas}`, detalhe: `em ${maior.resumo.dias} dias` },
                ]
              : []
          }
        />
        <CardQuem
          {...p}
          titulo="Média de notas por fornecedor"
          valor={lista.length ? dec1(totN / lista.length) : "—"}
          explicacao={`${totN} notas · ${lista.length} fornecedores`}
          itens={porNotas.slice(0, 3).map((g) => ({ rotulo: g.chave, fornecedor: g.chave, principal: `${g.resumo.notas} notas`, detalhe: `${dec1(g.resumo.notas / Math.max(1, g.resumo.dias))} por dia` }))}
        />
      </div>
    </div>
  );
}

/** Números dos dias: média, maior, menor e dias úteis sem descarrego. */
function DiasResumo({ dados, x, filtro }: PropsVisao) {
  const dias = agrupar(filtrarFatos(dados.fatos ?? [], filtro, "dia"), (f) => f.data).map((d) => ({ d: d.chave, v: valorMedida(d.resumo, "carros", x.porNotas) }));
  const com = dias.filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
  const [ano, mes] = dados.mes.split("-").map(Number);
  const ultimo = x.r.fracaoMes < 1 ? new Date().getDate() : new Date(ano, mes, 0).getDate();
  let uteis = 0;
  for (let d = 1; d <= ultimo; d++) if (new Date(ano, mes - 1, d).getDay() % 6 !== 0) uteis += 1;
  const semDescarrego = Math.max(0, uteis - com.filter((c) => new Date(ano, mes - 1, Number(c.d.slice(8, 10))).getDay() % 6 !== 0).length);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Mini rotulo="Média por dia" valor={com.length ? dec1(com.reduce((t, c) => t + c.v, 0) / com.length) : "—"} sub={x.porNotas ? "notas" : "carros"} />
      <Mini rotulo="Maior dia" valor={com[0] ? contagem(com[0].v) : "—"} sub={com[0] ? ddmm(com[0].d) : undefined} />
      <Mini rotulo="Menor dia" valor={com.length ? contagem(com[com.length - 1].v) : "—"} sub={com.length ? ddmm(com[com.length - 1].d) : undefined} />
      <Mini rotulo="Dias úteis sem descarrego" valor={inteiro.format(semDescarrego)} sub={`de ${uteis} dias úteis (seg–sex)`} />
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
        <Mini rotulo="Receita por tonelada" valor={sel.pesoKg > 0 ? formatBRL(sel.receita / (sel.pesoKg / 1000)) : "—"} sub={fmtPeso(sel.pesoKg)} />
      </div>
      {/* Calendário | tipos + mês a mês | fornecedores — nada fica fora da tela. */}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
        <Bloco titulo="Receita por dia" direita={<Dica>clique para filtrar</Dica>}>
          <GraficoDias {...p} medida="receita" />
        </Bloco>
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Bloco titulo="Receita por tipo" direita={<Dica>clique para filtrar</Dica>}>
            <ListaTipos {...p} medida="receita" />
          </Bloco>
          <Bloco titulo="Receita · mês a mês">
            <SerieMeses dados={dados} valor={(y) => y.receitaDescarrego} fmt={semCentavos} maiorEhBom altura={110} />
          </Bloco>
        </div>
        <Bloco titulo="Quem mais paga">
          <TabelaFornecedores {...p} ordemInicial="receita" />
        </Bloco>
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
