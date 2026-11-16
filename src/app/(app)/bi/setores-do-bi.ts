import { ehSetorRecebimento } from "@/domain/recebimento";
import { ehSetorSeparacao } from "@/domain/separacao";
import { ehSetorAbastecimento } from "@/domain/abastecimento";
import { ehSetorMotoristas } from "@/domain/motoristas";
import type { AbaBI } from "@/domain/bi-geral-rotas";
import type { Setor } from "@/domain/types";

/** Aba do BI Geral a que o setor pertence — mesma precedência da página do setor. */
function abaDoSetor(nome: string): AbaBI | null {
  if (ehSetorRecebimento(nome)) return "recebimento";
  if (ehSetorSeparacao(nome)) return "separacao";
  if (ehSetorAbastecimento(nome)) return "abastecimento";
  if (ehSetorMotoristas(nome)) return "motoristas";
  return null;
}

export function setoresDoBI(setores: Setor[]): Partial<Record<AbaBI, Setor>> {
  const r: Partial<Record<AbaBI, Setor>> = {};
  for (const s of setores) {
    const a = abaDoSetor(s.nome);
    if (a && !r[a]) r[a] = s;
  }
  return r;
}
