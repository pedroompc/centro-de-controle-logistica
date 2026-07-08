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
