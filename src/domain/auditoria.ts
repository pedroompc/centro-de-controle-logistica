// Leitura da trilha de auditoria (audit_log, migration 0030): o que mudou em
// cada registro, em linguagem de gente.

export type Linha = Record<string, unknown>;

export interface RegistroAuditoria {
  id: number;
  em: string; // ISO
  tabela: string;
  operacao: "INSERT" | "UPDATE" | "DELETE";
  registro: string | null;
  email: string | null;
  antes: Linha | null;
  depois: Linha | null;
}

export interface Mudanca {
  campo: string;
  antes: string;
  depois: string;
}

/** Nome legível das tabelas auditadas. */
export const NOME_TABELA: Record<string, string> = {
  profiles: "Perfis de acesso",
  setores: "Setores",
  funcionarios: "Funcionários",
  faltas: "Faltas",
  custos_fixos: "Custos fixos",
  custos_mensais: "Custos do mês",
  fornecedores: "Fornecedores",
  precos_descarregamento: "Preços de descarrego",
  config_descarregamento: "Configuração de descarrego",
  receitas_descarregamento: "Descarregos",
  receitas_descarregamento_diario: "Descarregos (diário)",
  receitas_diversas: "Receitas diversas",
  descarregos_carros_dia: "Carros descarregados",
  efetivo_mensal_setor: "Efetivo por setor",
  efetivo_mensal_cargo: "Efetivo por cargo",
  equipamentos: "Equipamentos",
  harpia_usuarios: "Usuários do Harpia",
  calendario_rotas: "Calendário de rotas",
  frota_consumo_modelos: "Consumo por modelo",
  frota_veiculos: "Veículos da frota",
  frota_parametros: "Parâmetros da frota",
};

export const NOME_OPERACAO: Record<RegistroAuditoria["operacao"], string> = {
  INSERT: "Incluiu",
  UPDATE: "Alterou",
  DELETE: "Excluiu",
};

// Carimbos que mudam a cada gravação e não dizem nada a quem lê.
const IGNORAR = new Set(["created_at", "updated_at", "atualizado_em", "criado_em"]);

function texto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Campos que mudaram. Inclusão lista os campos preenchidos; exclusão, os que
 * existiam; alteração, só os diferentes. Ignora carimbos de data de gravação.
 */
export function camposAlterados(antes: Linha | null, depois: Linha | null): Mudanca[] {
  const chaves = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  const out: Mudanca[] = [];
  for (const campo of chaves) {
    if (IGNORAR.has(campo) || campo === "id") continue;
    const a = antes?.[campo];
    const d = depois?.[campo];
    if (antes && depois && JSON.stringify(a) === JSON.stringify(d)) continue;
    if (!antes && (d === null || d === undefined || d === "")) continue;
    if (!depois && (a === null || a === undefined || a === "")) continue;
    out.push({ campo, antes: antes ? texto(a) : "—", depois: depois ? texto(d) : "—" });
  }
  return out;
}

/** Como chamar o registro na tela: nome/descrição se houver, senão a chave. */
export function rotuloRegistro(r: Pick<RegistroAuditoria, "antes" | "depois" | "registro">): string {
  const l = r.depois ?? r.antes ?? {};
  for (const k of ["nome", "descricao", "fornecedor", "email", "placa", "modelo", "tipo", "categoria"]) {
    const v = l[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return r.registro ?? "—";
}
