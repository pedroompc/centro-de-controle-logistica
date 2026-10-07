import { listarEquipamentos } from "@/data/equipamentos";
import { lerAbastecimentoHarpia, type DadosHarpiaAbastecimento } from "@/data/harpia-abastecimento";
import { isAdmin } from "@/data/auth";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { INICIO_HISTORICO, mesProximo, primeiroDiaDoMes } from "@/domain/periodo";
import { mesmoSetor, serieCustoSetor, type PontoCustoSetor } from "@/domain/separacao";
import { papelAbastecimento } from "@/domain/abastecimento";
import type { Equipamento, Funcionario } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";

export interface DadosBIAbastecimento {
  mes: string; // mês na tela "yyyy-mm-01"
  atual: string; // mês corrente
  setor: string;
  pessoas: PessoaBI[]; // cadastro ATUAL do setor (não há histórico por pessoa)
  equipamentos: Equipamento[];
  serie: PontoCustoSetor[]; // julho/2026 → mês corrente
  /** Abastecimento do Harpia; `erro` = não conseguiu ler (permissão, rede…). */
  harpia: { dados: DadosHarpiaAbastecimento } | { erro: string };
  admin: boolean;
}

async function harpiaDoMes(mes: string): Promise<DadosBIAbastecimento["harpia"]> {
  try {
    return { dados: await lerAbastecimentoHarpia(mes) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[harpia-abastecimento]", msg);
    return { erro: msg };
  }
}

/** Equipe, equipamentos e custo mês a mês do setor de Abastecimento. */
export async function carregarBIAbastecimento(setor: { id: string; nome: string }, funcionarios: Funcionario[], mes: string): Promise<DadosBIAbastecimento> {
  const atual = primeiroDiaDoMes();
  const meses: string[] = [];
  for (let x = INICIO_HISTORICO; x <= atual; x = mesProximo(x)) meses.push(x);
  const [equipamentos, fotos, harpia, admin] = await Promise.all([
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    harpiaDoMes(mes),
    isAdmin(),
  ]);
  const ativos = funcionarios.filter((f) => f.setorId === setor.id && f.status === "ativo");
  const pessoas: PessoaBI[] = ativos.map((f) => ({
    id: f.id,
    nome: f.nome,
    cargo: f.cargo,
    papel: papelAbastecimento(f.cargo),
    custo: f.custoMensal,
    outroSetor: false,
    rubricas: {
      salarioBase: f.salarioBase,
      passagem: f.passagem,
      alimentacao: f.alimentacao,
      planoSaude: f.planoSaude,
      ajudaCusto: f.ajudaCusto,
      premiacao: f.premiacao,
      adicionalNoturno: f.adicionalNoturno,
    },
  }));
  const fotosSetor = fotos.filter((f) => mesmoSetor(f.setor, setor.nome));
  return {
    mes,
    atual,
    setor: setor.nome,
    pessoas,
    equipamentos: (equipamentos ?? []).filter((e) => mesmoSetor(e.setor, setor.nome)),
    harpia,
    admin,
    serie: serieCustoSetor(meses, fotosSetor, atual, { pessoas: pessoas.length, folha: pessoas.reduce((t, y) => t + y.custo, 0) }),
  };
}
