export function inicioFimMesAtual(hoje = new Date()): { inicio: string; fim: string } {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(primeiro), fim: iso(ultimo) };
}

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function primeiroDiaDoMes(base: string | Date = new Date()): string {
  if (typeof base === "string") return base.slice(0, 7) + "-01";
  const ano = base.getFullYear();
  const mes = String(base.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

export function mesAnterior(mesISO: string): string {
  let [ano, mes] = mesISO.split("-").map(Number);
  mes -= 1;
  if (mes === 0) { mes = 12; ano -= 1; }
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

export function mesProximo(mesISO: string): string {
  let [ano, mes] = mesISO.split("-").map(Number);
  mes += 1;
  if (mes === 13) { mes = 1; ano += 1; }
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

export function formatMesAno(mesISO: string): string {
  const [ano, mes] = mesISO.split("-").map(Number);
  return `${MESES_PT[mes - 1]}/${ano}`;
}

export function inicioFimDoMes(mesISO: string): { inicio: string; fim: string } {
  const [ano, mes] = mesISO.split("-").map(Number);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(new Date(ano, mes - 1, 1)), fim: iso(new Date(ano, mes, 0)) };
}

/**
 * Primeiro mês com histórico consolidado no dashboard. Antes de julho/2026 os
 * dados por mês não foram fechados, então a navegação para no piso.
 */
export const INICIO_HISTORICO = "2026-07-01";

/** Restringe um mês ISO à janela navegável [INICIO_HISTORICO, mês atual]. */
export function limitarAoHistorico(mesISO: string, hoje = new Date()): string {
  const atual = primeiroDiaDoMes(hoje);
  if (mesISO < INICIO_HISTORICO) return INICIO_HISTORICO;
  if (mesISO > atual) return atual;
  return mesISO;
}

// ─── Período livre ───────────────────────────────────────────────────────────
// Um intervalo de datas [de, ate] (ISO, inclusivo). `?mes=` continua valendo e
// vira um período de mês inteiro; `?de=&ate=` vence `mes`.

export interface Periodo {
  de: string;
  ate: string;
}

export type TipoPeriodo = "mes" | "trimestre" | "ano" | "livre";

/**
 * Piso das telas que leem do Winthor (notas de saída desde jan/2015 nas
 * filiais 1 e 11 — levantado no Oracle em 06/11/2026).
 */
export const PISO_WINTHOR = "2015-01-01";

/**
 * Piso dos BIs que leem do Harpia (separação desde 16/09/2025, abastecimento
 * desde 15/08/2025): primeiro mês inteiro com as duas fontes.
 */
export const PISO_HARPIA = "2025-10-01";

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;

const isoUTC = (d: Date) => d.toISOString().slice(0, 10);
const paraUTC = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
/** Soma `n` dias a uma data ISO. */
export function somarDias(iso: string, n: number): string {
  return isoUTC(new Date(paraUTC(iso).getTime() + n * MS_DIA));
}
const ultimoDia = (ano: number, mes1: number) => new Date(Date.UTC(ano, mes1, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, "0");
const diaISO = (ano: number, mes1: number, dia: number) => `${ano}-${pad(mes1)}-${pad(dia)}`;
const fimDoMesISO = (ano: number, mes1: number) => diaISO(ano, mes1, ultimoDia(ano, mes1));

function hojeLocal(hoje: Date): string {
  return `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
}

function valida(iso: string | undefined): iso is string {
  if (!iso || !RE_DIA.test(iso)) return false;
  const [a, m, d] = iso.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= ultimoDia(a, m);
}

export function periodoDoMes(mesISO: string): Periodo {
  const [ano, mes] = mesISO.split("-").map(Number);
  return { de: diaISO(ano, mes, 1), ate: fimDoMesISO(ano, mes) };
}

function periodoDoTrimestre(ano: number, tri: number): Periodo {
  const m0 = (tri - 1) * 3 + 1;
  return { de: diaISO(ano, m0, 1), ate: fimDoMesISO(ano, m0 + 2) };
}

const periodoDoAno = (ano: number): Periodo => ({ de: `${ano}-01-01`, ate: `${ano}-12-31` });

export function tipoPeriodo(p: Periodo): TipoPeriodo {
  const [a1, m1, d1] = p.de.split("-").map(Number);
  const [a2, m2] = p.ate.split("-").map(Number);
  if (d1 !== 1 || a1 !== a2 || p.ate !== fimDoMesISO(a2, m2)) return "livre";
  if (m1 === m2) return "mes";
  if (m1 === 1 && m2 === 12) return "ano";
  if ((m1 - 1) % 3 === 0 && m2 === m1 + 2) return "trimestre";
  return "livre";
}

/** "yyyy-mm-01" quando o período é exatamente um mês inteiro; senão null. */
export function mesDoPeriodo(p: Periodo): string | null {
  return tipoPeriodo(p) === "mes" ? p.de.slice(0, 7) + "-01" : null;
}

export function diasNoPeriodo(p: Periodo): number {
  return Math.round((paraUTC(p.ate).getTime() - paraUTC(p.de).getTime()) / MS_DIA) + 1;
}

/** Meses ("yyyy-mm-01") que o período toca, em ordem. */
export function mesesDoPeriodo(p: Periodo): string[] {
  const fim = primeiroDiaDoMes(p.ate);
  const out: string[] = [];
  for (let m = primeiroDiaDoMes(p.de); m <= fim; m = mesProximo(m)) out.push(m);
  return out;
}

/** Até ~2 meses o gráfico fica por dia; acima disso, por mês. */
export function eixoDoPeriodo(p: Periodo): "dia" | "mes" {
  return diasNoPeriodo(p) <= 62 ? "dia" : "mes";
}

export function incluiHoje(p: Periodo, hoje: Date = new Date()): boolean {
  const h = hojeLocal(hoje);
  return p.de <= h && h <= p.ate;
}

/** O período ainda não terminou (inclui hoje ou é futuro). */
export function periodoAberto(p: Periodo, hoje: Date = new Date()): boolean {
  return p.ate >= hojeLocal(hoje);
}

/**
 * Lê o período da URL. `de/ate` vence `mes`; nada → mês atual. Datas fora de
 * [piso, fim do ano corrente] são presas; inválidas caem no mês atual.
 */
export function lerPeriodo(
  sp: { mes?: string; de?: string; ate?: string },
  { piso = INICIO_HISTORICO, hoje = new Date() }: { piso?: string; hoje?: Date } = {},
): Periodo {
  const mesAtual = periodoDoMes(primeiroDiaDoMes(hoje));
  const teto = `${hoje.getFullYear()}-12-31`;
  if (valida(sp.de)) {
    let de = sp.de;
    let ate = valida(sp.ate) ? sp.ate : sp.de;
    if (de > ate) [de, ate] = [ate, de];
    if (de < piso) de = piso;
    if (ate > teto) ate = teto;
    return de <= ate ? { de, ate } : mesAtual;
  }
  if (sp.mes && /^\d{4}-\d{2}/.test(sp.mes)) {
    const m = primeiroDiaDoMes(sp.mes);
    const pisoMes = primeiroDiaDoMes(piso);
    if (m < pisoMes) return periodoDoMes(pisoMes);
    if (m > mesAtual.de) return mesAtual;
    return periodoDoMes(m);
  }
  return mesAtual;
}

/**
 * Parâmetros de URL do período: mês atual = nada; mês = `mes`; resto =
 * `de/ate`. `explicito` escreve o mês atual também (telas cujo padrão não é o
 * mês, como o Fechamento, que abre no dia).
 */
export function paramsDoPeriodo(p: Periodo, hoje: Date = new Date(), explicito = false): Record<string, string> {
  const mes = mesDoPeriodo(p);
  if (mes) return mes === primeiroDiaDoMes(hoje) && !explicito ? {} : { mes };
  return { de: p.de, ate: p.ate };
}

/** Período corrente: corta o comparado no mesmo nº de dias já decorridos. */
function truncar(comp: Periodo, p: Periodo, hoje: Date): Periodo {
  if (!incluiHoje(p, hoje)) return comp;
  const decorridos = diasNoPeriodo({ de: p.de, ate: hojeLocal(hoje) });
  const ate = somarDias(comp.de, decorridos - 1);
  return { de: comp.de, ate: ate < comp.ate ? ate : comp.ate };
}

function calendarioAnterior(p: Periodo): Periodo {
  const [ano, mes] = p.de.split("-").map(Number);
  switch (tipoPeriodo(p)) {
    case "mes":
      return periodoDoMes(mesAnterior(p.de));
    case "trimestre": {
      const tri = Math.floor((mes - 1) / 3) + 1;
      return tri === 1 ? periodoDoTrimestre(ano - 1, 4) : periodoDoTrimestre(ano, tri - 1);
    }
    case "ano":
      return periodoDoAno(ano - 1);
    default: {
      const n = diasNoPeriodo(p);
      return { de: somarDias(p.de, -n), ate: somarDias(p.de, -1) };
    }
  }
}

/**
 * Período anterior de mesmo tamanho: mês/trimestre/ano calendário anterior,
 * ou os N dias imediatamente antes. Período corrente compara o trecho
 * equivalente (mesmo nº de dias decorridos).
 */
export function periodoAnterior(p: Periodo, hoje: Date = new Date()): Periodo {
  return truncar(calendarioAnterior(p), p, hoje);
}

/** Mesmo período do ano passado (29/02 → 28/02); corrente = trecho equivalente. */
export function periodoAnoPassado(p: Periodo, hoje: Date = new Date()): Periodo {
  const [a1, m1] = p.de.split("-").map(Number);
  const tipo = tipoPeriodo(p);
  let comp: Periodo;
  if (tipo === "mes") comp = periodoDoMes(diaISO(a1 - 1, m1, 1));
  else if (tipo === "trimestre") comp = periodoDoTrimestre(a1 - 1, Math.floor((m1 - 1) / 3) + 1);
  else if (tipo === "ano") comp = periodoDoAno(a1 - 1);
  else {
    const menosUm = (iso: string) => {
      const [a, m, d] = iso.split("-").map(Number);
      return diaISO(a - 1, m, Math.min(d, ultimoDia(a - 1, m)));
    };
    comp = { de: menosUm(p.de), ate: menosUm(p.ate) };
  }
  return truncar(comp, p, hoje);
}

/** Anda o período inteiro para trás/frente pelo seu tamanho. */
export function deslocarPeriodo(p: Periodo, dir: -1 | 1): Periodo {
  const [ano, mes] = p.de.split("-").map(Number);
  switch (tipoPeriodo(p)) {
    case "mes":
      return periodoDoMes(dir < 0 ? mesAnterior(p.de) : mesProximo(p.de));
    case "trimestre": {
      const idx = ano * 4 + Math.floor((mes - 1) / 3) + dir;
      return periodoDoTrimestre(Math.floor(idx / 4), (idx % 4) + 1);
    }
    case "ano":
      return periodoDoAno(ano + dir);
    default: {
      const n = diasNoPeriodo(p) * dir;
      return { de: somarDias(p.de, n), ate: somarDias(p.ate, n) };
    }
  }
}

const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Novembro/2026" · "3º tri/2026" · "2026" · "Jul–Set/2026" · "01/08 – 15/09/2026". */
export function rotuloPeriodo(p: Periodo): string {
  const [a1, m1] = p.de.split("-").map(Number);
  const [a2, m2] = p.ate.split("-").map(Number);
  switch (tipoPeriodo(p)) {
    case "mes":
      return formatMesAno(p.de);
    case "trimestre":
      return `${Math.floor((m1 - 1) / 3) + 1}º tri/${a1}`;
    case "ano":
      return String(a1);
  }
  const fimMes = p.ate === fimDoMesISO(a2, m2);
  if (p.de.endsWith("-01") && fimMes) {
    return a1 === a2
      ? `${MES_CURTO[m1 - 1]}–${MES_CURTO[m2 - 1]}/${a1}`
      : `${MES_CURTO[m1 - 1]}/${a1} – ${MES_CURTO[m2 - 1]}/${a2}`;
  }
  if (p.de === p.ate) return `${dm(p.de)}/${a1}`;
  return a1 === a2 ? `${dm(p.de)} – ${dm(p.ate)}/${a2}` : `${dm(p.de)}/${a1} – ${dm(p.ate)}/${a2}`;
}

/** Rótulo curto para "vs …": "Out/26" · "2º tri/26" · "2025" · "16/06–31/07". */
export function rotuloCurto(p: Periodo): string {
  const [a1, m1] = p.de.split("-").map(Number);
  const aa = String(a1).slice(2);
  switch (tipoPeriodo(p)) {
    case "mes":
      return `${MES_CURTO[m1 - 1]}/${aa}`;
    case "trimestre":
      return `${Math.floor((m1 - 1) / 3) + 1}º tri/${aa}`;
    case "ano":
      return String(a1);
  }
  const anoFim = p.ate.slice(2, 4);
  return a1 === Number(p.ate.slice(0, 4)) ? `${dm(p.de)}–${dm(p.ate)}/${anoFim}` : `${dm(p.de)}/${aa}–${dm(p.ate)}/${anoFim}`;
}

export interface AtalhoPeriodo {
  chave: string;
  rotulo: string;
  periodo: Periodo;
}

export function atalhosPeriodo(hoje: Date = new Date()): AtalhoPeriodo[] {
  const ano = hoje.getFullYear();
  const mesAtual = primeiroDiaDoMes(hoje);
  const tri = Math.floor(hoje.getMonth() / 3) + 1;
  const triAtual = periodoDoTrimestre(ano, tri);
  let inicio12 = mesAtual;
  for (let i = 0; i < 11; i++) inicio12 = mesAnterior(inicio12);
  return [
    { chave: "mes", rotulo: "Este mês", periodo: periodoDoMes(mesAtual) },
    { chave: "mes-passado", rotulo: "Mês passado", periodo: periodoDoMes(mesAnterior(mesAtual)) },
    { chave: "tri", rotulo: "Este trimestre", periodo: triAtual },
    { chave: "tri-passado", rotulo: "Trimestre passado", periodo: calendarioAnterior(triAtual) },
    { chave: "ano", rotulo: "Este ano", periodo: periodoDoAno(ano) },
    { chave: "ano-passado", rotulo: "Ano passado", periodo: periodoDoAno(ano - 1) },
    { chave: "12m", rotulo: "Últimos 12 meses", periodo: { de: inicio12, ate: hojeLocal(hoje) } },
  ];
}

/** O período cai (ao menos em parte) dentro do histórico do Supabase. */
export function temHistoricoSupabase(p: Periodo): boolean {
  return p.ate >= INICIO_HISTORICO;
}

/** Igualdade de períodos. */
export const mesmoPeriodo = (a: Periodo, b: Periodo) => a.de === b.de && a.ate === b.ate;
