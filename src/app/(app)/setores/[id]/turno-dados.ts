import { ligacoesEfetivas, type Ligacao } from "@/domain/turno";
import type { Funcionario, Turno } from "@/domain/types";

export interface FuncionarioLigavel {
  id: string;
  nome: string;
  cargo: string;
  doSetor: boolean;
  turno: Turno;
}

/** O que o BI precisa pra dar nome e turno a um usuário do Harpia. */
export interface NomesHarpia {
  /** Usuário do Harpia → funcionário (manual vence; senão, casado pelo nome). */
  ligacoes: Record<number, Ligacao>;
  /** false = tabela harpia_usuarios (0025) ausente: só vale a ligação automática. */
  podeLigar: boolean;
  /** Ativos, os do setor primeiro — opções do seletor e base do turno. */
  funcionarios: FuncionarioLigavel[];
  admin: boolean;
}

export function montarNomesHarpia(
  usuarios: { usuario: number; nome: string | null }[],
  manuais: Map<number, string> | null,
  funcionarios: Funcionario[],
  setorId: string,
  admin: boolean,
): NomesHarpia {
  const ativos = funcionarios
    .filter((f) => f.status === "ativo")
    .map((f) => ({ id: f.id, nome: f.nome, cargo: f.cargo, doSetor: f.setorId === setorId, turno: f.turno }))
    .sort((a, b) => Number(b.doSetor) - Number(a.doSetor) || a.nome.localeCompare(b.nome));
  return {
    ligacoes: ligacoesEfetivas(usuarios, manuais ? Object.fromEntries(manuais) : null, ativos),
    podeLigar: manuais !== null,
    funcionarios: ativos,
    admin,
  };
}
