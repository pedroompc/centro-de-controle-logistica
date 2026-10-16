/**
 * Abastecimento — regras do BI do setor. Quem prepara o abastecimento no
 * Harpia (`PREP_USU_FK_809`) é o FATURAMENTO gerando a ordem, não quem
 * executa no piso — por isso aqui nunca se rankeia por usuário do Harpia;
 * rendimento é sempre da EQUIPE cadastrada no setor (headcount do app).
 */
import { normalizarTexto } from "./recebimento";

export type PapelAbastecimento = "lider" | "operador";

export function ehSetorAbastecimento(nome: string): boolean {
  return normalizarTexto(nome).includes("abastec");
}

export function papelAbastecimento(cargo: string): PapelAbastecimento {
  const c = normalizarTexto(cargo);
  if (c.includes("lider") || c.includes("encarreg") || c.includes("supervis") || c.includes("coorden")) return "lider";
  return "operador";
}

export interface ResumoVolumeAbast {
  abastecimentos: number;
  caixas: number;
  unidades: number;
  dias: number; // dias do recorte com abastecimento
  skusMedioDia: number | null; // média de SKUs distintos abastecidos por dia (não soma — o mesmo SKU se repete em vários dias)
}

export function resumoVolume(dias: { abastecimentos: number; caixas: number; unidades: number; skus: number }[]): ResumoVolumeAbast {
  const r = { abastecimentos: 0, caixas: 0, unidades: 0, dias: 0 };
  let somaSkus = 0;
  for (const d of dias) {
    r.abastecimentos += d.abastecimentos;
    r.caixas += d.caixas;
    r.unidades += d.unidades;
    if (d.abastecimentos > 0) {
      r.dias += 1;
      somaSkus += d.skus;
    }
  }
  return { ...r, skusMedioDia: r.dias > 0 ? somaSkus / r.dias : null };
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/** Faixas de folga entre o abastecimento e o fim da separação da carga. */
export const FAIXAS_ANTECEDENCIA: { chave: string; rotulo: string; teste: (h: number) => boolean }[] = [
  { chave: "depois", rotulo: "depois/junto", teste: (h) => h <= 0 },
  { chave: "0-1h", rotulo: "até 1h", teste: (h) => h > 0 && h <= 1 },
  { chave: "1-6h", rotulo: "1-6h", teste: (h) => h > 1 && h <= 6 },
  { chave: "6-24h", rotulo: "6-24h", teste: (h) => h > 6 && h <= 24 },
  { chave: "24-72h", rotulo: "24-72h", teste: (h) => h > 24 && h <= 72 },
  { chave: "72h+", rotulo: "72h+", teste: (h) => h > 72 },
];

export interface ResumoAntecedencia {
  total: number; // cargas com abastecimento no recorte
  semSeparacao: number; // carga ainda sem DTFINALSEP no recorte
  antes: number; // abastecido com folga positiva
  depoisOuJunto: number;
  medianaHoras: number | null;
  faixas: { chave: string; rotulo: string; qtd: number }[];
}

/** `horasFolga` = horas entre o 1º abastecimento e o fim da separação da carga; `null` = carga sem separação ainda. */
export function resumoAntecedencia(cargas: { horasFolga: number | null }[]): ResumoAntecedencia {
  const comDado = cargas.filter((c): c is { horasFolga: number } => c.horasFolga !== null);
  return {
    total: cargas.length,
    semSeparacao: cargas.length - comDado.length,
    antes: comDado.filter((c) => c.horasFolga > 0).length,
    depoisOuJunto: comDado.filter((c) => c.horasFolga <= 0).length,
    medianaHoras: mediana(comDado.map((c) => c.horasFolga)),
    faixas: FAIXAS_ANTECEDENCIA.map((f) => ({ chave: f.chave, rotulo: f.rotulo, qtd: comDado.filter((c) => f.teste(c.horasFolga)).length })),
  };
}

// --- Movimentação de piso: agregação por dia/pessoa/produto (filtro cruzado) --

export interface PessoaMovimento {
  usuario: number;
  nome: string | null;
  departamento: string | null;
  total: number;
  descendente: number;
  ascendente: number;
  horizontal: number;
}

/** Agrega movimentação por pessoa; `dia` filtra pra um dia específico (`null` = mês inteiro). */
export function pessoasMovimento(linhas: { dia: string; usuario: number; nome: string | null; departamento: string | null; total: number; descendente: number; ascendente: number }[], dia: string | null): PessoaMovimento[] {
  const m = new Map<number, Omit<PessoaMovimento, "horizontal">>();
  for (const l of linhas) {
    if (dia && l.dia !== dia) continue;
    const r = m.get(l.usuario) ?? { usuario: l.usuario, nome: l.nome, departamento: l.departamento, total: 0, descendente: 0, ascendente: 0 };
    r.total += l.total;
    r.descendente += l.descendente;
    r.ascendente += l.ascendente;
    m.set(l.usuario, r);
  }
  return [...m.values()].map((r) => ({ ...r, horizontal: r.total - r.descendente - r.ascendente })).sort((a, b) => b.total - a.total);
}

/** Movimentações por hora do dia; `dia` filtra pra um dia específico (`null` = mês inteiro). */
export function horaMovimento(linhas: { dia: string; hora: number; total: number }[], dia: string | null): { hora: number; total: number }[] {
  const m = new Map<number, number>();
  for (const l of linhas) {
    if (dia && l.dia !== dia) continue;
    m.set(l.hora, (m.get(l.hora) ?? 0) + l.total);
  }
  return [...m.entries()].map(([hora, total]) => ({ hora, total })).sort((a, b) => a.hora - b.hora);
}

/** Histórico diário de uma pessoa (drill-down ao clicar na linha dela). */
export function historicoPessoa(linhas: { dia: string; usuario: number; total: number }[], usuario: number): { dia: string; total: number }[] {
  return linhas
    .filter((l) => l.usuario === usuario)
    .map((l) => ({ dia: l.dia, total: l.total }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

/** Histórico diário de um produto do top 20 (drill-down ao clicar no produto, no Giro). */
export function historicoProduto(linhas: { produto: number; dia: string; abastecimentos: number }[], produto: number): { dia: string; abastecimentos: number }[] {
  return linhas.filter((l) => l.produto === produto).sort((a, b) => a.dia.localeCompare(b.dia));
}

// --- Convocação Ativa: tempo de resposta e execução (ligada em 2026-10-13) ----

interface LinhaConvocacao {
  dia: string;
  operador: number;
  nome: string | null;
  minutosResposta: number | null; // aceite − solicitação
  minutosExecucao: number | null; // finalização − aceite
  finalizada: boolean;
  rejeitada: boolean;
}

export interface ResumoConvocacoes {
  total: number;
  finalizadas: number;
  rejeitadas: number;
  medianaRespostaMin: number | null;
  medianaExecucaoMin: number | null;
}

/** Mediana (não média) — um teste isolado pode levar dias pra ser aceito e distorce a média. `dia` filtra (`null` = mês inteiro). */
export function resumoConvocacoes(linhas: LinhaConvocacao[], dia: string | null): ResumoConvocacoes {
  const sel = dia ? linhas.filter((l) => l.dia === dia) : linhas;
  const respostas = sel.filter((l) => l.minutosResposta !== null && l.minutosResposta >= 0).map((l) => l.minutosResposta!);
  const execucoes = sel.filter((l) => l.finalizada && l.minutosExecucao !== null && l.minutosExecucao >= 0).map((l) => l.minutosExecucao!);
  return {
    total: sel.length,
    finalizadas: sel.filter((l) => l.finalizada).length,
    rejeitadas: sel.filter((l) => l.rejeitada).length,
    medianaRespostaMin: mediana(respostas),
    medianaExecucaoMin: mediana(execucoes),
  };
}

export interface OperadorConvocacoes {
  operador: number;
  nome: string | null;
  total: number;
  finalizadas: number;
  medianaRespostaMin: number | null;
  medianaExecucaoMin: number | null;
}

/** Agrega convocações por operador; `dia` filtra (`null` = mês inteiro). */
export function porOperadorConvocacoes(linhas: LinhaConvocacao[], dia: string | null): OperadorConvocacoes[] {
  const sel = dia ? linhas.filter((l) => l.dia === dia) : linhas;
  const m = new Map<number, LinhaConvocacao[]>();
  for (const l of sel) m.set(l.operador, [...(m.get(l.operador) ?? []), l]);
  return [...m.entries()]
    .map(([operador, ls]) => {
      const r = resumoConvocacoes(ls, null);
      return { operador, nome: ls[0].nome, total: r.total, finalizadas: r.finalizadas, medianaRespostaMin: r.medianaRespostaMin, medianaExecucaoMin: r.medianaExecucaoMin };
    })
    .sort((a, b) => b.total - a.total);
}
