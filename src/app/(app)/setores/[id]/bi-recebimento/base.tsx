"use client";

import { formatKg } from "@/domain/format";
import { type Periodo, formatMesAno, mesesDoPeriodo } from "@/domain/periodo";
import { indicesMelhores, type IndicadoresRecebimento } from "@/domain/recebimento";
import { filtrarFatos, resumir, custoNoRecorte, type FatoDescarrego, type FiltroBI, type ResumoFatos } from "@/domain/bi-recebimento";
import type { DescarregamentoTipo } from "@/domain/types";
import type { DetalheCusto, PessoaRecebimento } from "../../../painel/painel-actions";
import { BarrasTV, CalendarioBI, semCentavos, type PapelBI } from "../bi-ui";

export type VisaoBI = "custo" | "descarrego" | "receita" | "eficiencia";

export const VISOES_BI: { id: VisaoBI; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo e equipe", contexto: "quem e o que compõe o custo — pessoas por função, salários e equipamentos" },
  { id: "descarrego", titulo: "Descarrego", contexto: "carros, fornecedores atendidos, tipos, peso e dia a dia · clique para filtrar" },
  { id: "receita", titulo: "Receita de descarrego", contexto: "de onde vem a receita e quanto dela o custo consome · clique para filtrar" },
  { id: "eficiencia", titulo: "Eficiência", contexto: "custo por tonelada, sobre o descarrego e sobre o faturamento" },
];

export const inteiro = new Intl.NumberFormat("pt-BR");

export const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export const fmtPeso = (kg: number) => formatKg(kg); // peso sempre em kg (pedido do gestor)

const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);

export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export const TIPO_COR: Record<DescarregamentoTipo, string> = { batido: "#5b6fd6", paletizado: "#8b93e0", pal_rem: "#f5b301", volume: "#38bdf8" };

export const PAPEL: Record<PessoaRecebimento["papel"], { rotulo: string; plural: string; cor: string }> = {
  ajudante: { rotulo: "Ajudante", plural: "Ajudantes", cor: "#5b6fd6" },
  conferente: { rotulo: "Conferente", plural: "Conferentes", cor: "#8b93e0" },
  empilhador: { rotulo: "Puxador", plural: "Puxador", cor: "#c2820a" },
  outros: { rotulo: "Outros", plural: "Outros", cor: "#64748b" },
};

export const ORDEM_PAPEL = ["ajudante", "conferente", "empilhador", "outros"] as const;

export const PAPEIS: PapelBI[] = ORDEM_PAPEL.map((id) => ({ id, ...PAPEL[id] }));

export interface DadosBI {
  periodo: Periodo; // recorte na tela
  mensal: boolean; // recorte = um mês inteiro
  /** Período: indicadores do recorte (fatos do período + custo proporcional). Mês: vem da série. */
  ref?: IndicadoresRecebimento;
  mes: string; // mês de referência "yyyy-mm-01" (último do recorte até o corrente)
  serie: IndicadoresRecebimento[]; // julho/2026 → mês corrente (o filtrado já com faturamento ao vivo)
  custo: DetalheCusto | null;
  fatos: FatoDescarrego[] | null; // descarrego do mês, dia × fornecedor × tipo
}

export interface Filtro {
  filtro: FiltroBI;
  onFiltro: (f: FiltroBI) => void;
}

// --- O recorte: tudo que os quadros e visuais mostram -----------------------

export interface Recorte {
  r: IndicadoresRecebimento; // o mês (série mensal)
  mes: ResumoFatos; // o mês inteiro, dos fatos
  sel: ResumoFatos; // o recorte filtrado
  custo: number;
  criterioCusto: string | null;
  porNotas: boolean; // filtro de fornecedor: "carros" viram notas
  temFatos: boolean;
}

export function recortar(dados: DadosBI, filtro: FiltroBI): Recorte | null {
  const r = dados.ref ?? dados.serie.find((x) => x.mes === dados.mes);
  if (!r) return null;
  const fatos = dados.fatos ?? [];
  const mes = resumir(fatos);
  const sel = resumir(filtrarFatos(fatos, filtro));
  const pesoDoDia = filtro.dia ? resumir(filtrarFatos(fatos, { dia: filtro.dia })).pesoKg : 0;
  const { custo, criterio } = custoNoRecorte({ custoMes: r.custoPeriodo, diasMes: mes.dias, pesoMes: mes.pesoKg, pesoDoDia, pesoRecorte: sel.pesoKg, filtro });
  return { r, mes, sel, custo, criterioCusto: criterio, porNotas: !!filtro.fornecedor, temFatos: dados.fatos !== null };
}

export const carrosOuNotas = (x: Recorte, s: ResumoFatos = x.sel) => (x.porNotas ? `${inteiro.format(s.notas)} notas` : `${inteiro.format(s.carros)} carros`);

// --- Menu (topo) -------------------------------------------------------------

export type PropsVisao = { dados: DadosBI; x: Recorte } & Filtro;

// --- Peças --------------------------------------------------------------------

/** O mês está no recorte da tela (destaque nas barras mês a mês). */
export const noRecorte = (dados: DadosBI, mes: string) => mesesDoPeriodo(dados.periodo).includes(mes);

/** O mês filtrado e os 2 anteriores (a janela do "melhor do trimestre"). */
export function trimestre(serie: IndicadoresRecebimento[], mes: string) {
  const i = serie.findIndex((x) => x.mes === mes);
  return i < 0 ? [] : serie.slice(Math.max(0, i - 2), i + 1);
}

/** Barras de um indicador por mês, até o mês filtrado; verde = melhor do trimestre, âmbar = mês na tela. */
export function SerieMeses({ dados, valor, fmt, maiorEhBom, altura = 170 }: { dados: DadosBI; valor: (r: IndicadoresRecebimento) => number | null; fmt: (v: number) => string; maiorEhBom: boolean; altura?: number }) {
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
        cor: melhores.has(i) ? "#10b981" : noRecorte(dados, x.mes) ? "#c2820a" : "#5b6fd6",
        detalhe: `${formatMesAno(x.mes)}${x.fracaoMes < 1 ? " (em andamento)" : ""}`,
      }))}
    />
  );
}

// --- Visuais ligados (filtro cruzado) ------------------------------------------

export type Medida = "carros" | "pesoKg" | "receita" | "caixas";

// Contagem inteira sem casas; média (fracionária) com 1 casa.
export const contagem = (v: number) => (Number.isInteger(v) ? inteiro.format(v) : dec1(v));

export const FMT_MEDIDA: Record<Medida, (v: number) => string> = { carros: contagem, pesoKg: fmtPeso, receita: semCentavos, caixas: contagem };

export const valorMedida = (s: ResumoFatos, m: Medida, porNotas: boolean) => (m === "carros" && porNotas ? s.notas : s[m]);

export const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Calendário do mês (Dom–Sáb) com um valor por dia. Cor: um tom só, mais forte
 * quanto maior o valor (ou quanto MENOR, em custo: `menorEhMelhor` inverte para
 * o dia bom ficar forte). Dia sem valor fica apagado. Clique filtra o dia.
 */
export function Calendario({ mes, periodo, porDia, fmt, filtro, onFiltro, menorEhMelhor = false }: { mes: string; periodo?: Periodo; porDia: Map<string, number>; fmt: (v: number) => string; menorEhMelhor?: boolean } & Filtro) {
  return (
    <CalendarioBI
      mes={mes}
      periodo={periodo}
      porDia={porDia}
      fmt={fmt}
      menorEhMelhor={menorEhMelhor}
      selecionado={filtro.dia ?? null}
      onSelecionar={(dia) => onFiltro({ ...filtro, dia })}
      vazio="sem descarrego"
    />
  );
}
