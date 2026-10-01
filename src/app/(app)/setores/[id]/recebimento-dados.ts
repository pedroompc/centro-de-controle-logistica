import { carregarRecebimento } from "../../painel/painel-actions";
import { listarDiariosDescarrego } from "@/data/descarregamento-mensal";
import { inicioFimDoMes, primeiroDiaDoMes, INICIO_HISTORICO } from "@/domain/periodo";
import { linhasEquipePorCargo, empilhadorDoCadastro, type LinhaEquipeCargo, type EmpilhadorCadastro, type IndicadoresRecebimento } from "@/domain/recebimento";
import { carrosPorDia, perfilDiario, type PerfilDiario } from "@/domain/recebimento-projecao";
import type { Funcionario, Setor } from "@/domain/types";

export interface AnaliseRecebimento {
  serie: IndicadoresRecebimento[]; // julho/2026 → mês corrente
  dias: { data: string; carros: number }[];
  perfil: PerfilDiario; // só meses fechados (o corrente puxaria a média para baixo)
  linhas: LinhaEquipeCargo[]; // equipe de hoje por cargo
  empilhador: EmpilhadorCadastro;
  custoMedio: { ajudante: number; conferente: number };
}

/** Tudo que as abas Desempenho e Projeções do setor Recebimento usam. */
export async function carregarAnaliseRecebimento(funcionarios: Funcionario[], setores: Setor[]): Promise<AnaliseRecebimento> {
  const atual = primeiroDiaDoMes();
  const [serie, diarios] = await Promise.all([
    carregarRecebimento(),
    listarDiariosDescarrego(INICIO_HISTORICO, inicioFimDoMes(atual).fim).catch(() => []),
  ]);
  const dias = carrosPorDia(diarios);
  const { linhas } = linhasEquipePorCargo(funcionarios, setores);
  const medio = (g: LinhaEquipeCargo["grupo"]) => {
    const l = linhas.find((x) => x.grupo === g);
    return l && l.ativos > 0 ? l.custoAtivos / l.ativos : 0;
  };
  return {
    serie,
    dias,
    perfil: perfilDiario(dias.filter((d) => d.data < atual)),
    linhas,
    empilhador: empilhadorDoCadastro(funcionarios, setores),
    custoMedio: { ajudante: medio("ajudante"), conferente: medio("conferente") },
  };
}
