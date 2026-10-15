import type { Turno } from "./types";

/**
 * Turno nos BIs: o Harpia grava QUEM fez (usuário) e QUANDO, mas não o turno.
 * O turno vem do cadastro: usuário do Harpia → funcionário → `turno`. Assim se
 * mede a EQUIPE de cada turno (hora extra fora do horário conta pro turno da
 * pessoa). Registro de usuário sem funcionário ligado cai em "sem turno".
 */

type FuncTurno = { id: string; nome: string; turno: Turno };

// Palavras que o Harpia põe no nome do usuário e não são nome de gente.
const RUIDO = new Set(["CONF", "CONFERENTE", "NOITE", "TURNO", "MANHA", "TARDE", "DIA", "EXPEDICAO", "SEPARACAO", "ABASTECIMENTO"]);
const PARTICULA = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);

function tokens(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !RUIDO.has(t) && !PARTICULA.has(t));
}

/** `parte` aparece em `todo` na mesma ordem (não precisa ser contígua). */
function subsequencia(parte: string[], todo: string[]): boolean {
  let i = 0;
  for (const t of todo) if (t === parte[i]) i++;
  return i === parte.length;
}

/**
 * Funcionário cujo nome contém o nome do Harpia (mesmo primeiro nome, demais
 * nomes na ordem; vale também ao contrário). Só sugere com 2+ nomes e candidato único — nome solto tipo
 * "CONF DEYVSON NOITE" ou homônimo fica pra ligação manual.
 */
export function sugerirFuncionario(nomeHarpia: string | null, funcionarios: FuncTurno[]): string | null {
  if (!nomeHarpia) return null;
  const h = tokens(nomeHarpia);
  if (h.length < 2) return null;
  // Nos dois sentidos: ora o Harpia abrevia, ora o cadastro.
  const candidatos = funcionarios.filter((f) => {
    const t = tokens(f.nome);
    if (t[0] !== h[0]) return false;
    return subsequencia(h, t) || (t.length >= 2 && subsequencia(t, h));
  });
  return candidatos.length === 1 ? candidatos[0].id : null;
}

export interface Ligacao {
  funcionarioId: string;
  auto: boolean; // true = casada pelo nome, sem ninguém ter confirmado
}

/** Ligação usada no BI: a manual (tabela harpia_usuarios) vence; sem ela, a sugestão pelo nome. */
export function ligacoesEfetivas(
  usuarios: { usuario: number; nome: string | null }[],
  manuais: Record<number, string> | null,
  funcionarios: FuncTurno[],
): Record<number, Ligacao> {
  const r: Record<number, Ligacao> = {};
  for (const u of usuarios) {
    if (r[u.usuario]) continue;
    const manual = manuais?.[u.usuario];
    if (manual) {
      r[u.usuario] = { funcionarioId: manual, auto: false };
      continue;
    }
    const sugerido = sugerirFuncionario(u.nome, funcionarios);
    if (sugerido) r[u.usuario] = { funcionarioId: sugerido, auto: true };
  }
  return r;
}

/** Usuário do Harpia → turno do funcionário ligado. */
export function turnosDosUsuarios(ligacoes: Record<number, Ligacao>, funcionarios: FuncTurno[]): Map<number, Turno> {
  const turnoDe = new Map(funcionarios.map((f) => [f.id, f.turno]));
  const m = new Map<number, Turno>();
  for (const [u, l] of Object.entries(ligacoes)) {
    const t = turnoDe.get(l.funcionarioId);
    if (t) m.set(Number(u), t);
  }
  return m;
}

export interface ProducaoTurno {
  total: number;
  pessoas: number; // operadores distintos
  diasPessoa: number; // pares (operador, dia) com produção
  porPessoaDia: number | null; // total ÷ diasPessoa
}

export type ChaveTurno = Turno | "sem";

/** Soma a produção (linhas operador × dia) pelo turno de cada operador. */
export function resumoTurnosProducao(
  linhas: { usuario: number; dia: string; valor: number }[],
  turnos: Map<number, Turno>,
): Record<ChaveTurno, ProducaoTurno> {
  const acc = new Map<ChaveTurno, { total: number; pessoas: Set<number>; dias: Set<string> }>();
  for (const k of ["manha", "tarde", "noite", "sem"] as const) acc.set(k, { total: 0, pessoas: new Set(), dias: new Set() });
  for (const l of linhas) {
    const a = acc.get(turnos.get(l.usuario) ?? "sem")!;
    a.total += l.valor;
    a.pessoas.add(l.usuario);
    a.dias.add(`${l.usuario}|${l.dia}`);
  }
  const fim = (k: ChaveTurno): ProducaoTurno => {
    const a = acc.get(k)!;
    return { total: a.total, pessoas: a.pessoas.size, diasPessoa: a.dias.size, porPessoaDia: a.dias.size ? a.total / a.dias.size : null };
  };
  return { manha: fim("manha"), tarde: fim("tarde"), noite: fim("noite"), sem: fim("sem") };
}
