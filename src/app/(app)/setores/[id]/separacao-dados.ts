import { listarEquipamentos } from "@/data/equipamentos";
import { lerSeparacaoHarpia, type DadosHarpiaSeparacao } from "@/data/harpia-separacao";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { INICIO_HISTORICO, mesProximo, primeiroDiaDoMes } from "@/domain/periodo";
import { mesmoSetor, papelSeparacao, serieCustoSetor, type PontoCustoSetor } from "@/domain/separacao";
import type { Equipamento, Funcionario } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";

export interface DadosBISeparacao {
  mes: string; // mês na tela "yyyy-mm-01"
  atual: string; // mês corrente
  setor: string;
  pessoas: PessoaBI[]; // cadastro ATUAL (não há histórico por pessoa)
  equipamentos: Equipamento[];
  serie: PontoCustoSetor[]; // julho/2026 → mês corrente
  /** Produção/conferência/erros do Harpia; `erro` = não conseguiu ler (permissão, rede…). */
  harpia: { dados: DadosHarpiaSeparacao } | { erro: string };
}

async function harpiaDoMes(mes: string): Promise<DadosBISeparacao["harpia"]> {
  try {
    return { dados: await lerSeparacaoHarpia(mes) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[harpia-separacao]", msg);
    return { erro: msg };
  }
}

/** Equipe, equipamentos e custo mês a mês do setor de Separação. */
export async function carregarBISeparacao(setor: { id: string; nome: string }, funcionarios: Funcionario[], mes: string): Promise<DadosBISeparacao> {
  const atual = primeiroDiaDoMes();
  const meses: string[] = [];
  for (let x = INICIO_HISTORICO; x <= atual; x = mesProximo(x)) meses.push(x);
  const [equipamentos, fotos, harpia] = await Promise.all([listarEquipamentos().catch(() => null), serieEfetivoSetorMensal(24), harpiaDoMes(mes)]);
  const ativos = funcionarios.filter((f) => f.setorId === setor.id && f.status === "ativo");
  const pessoas: PessoaBI[] = ativos.map((f) => ({
    id: f.id,
    nome: f.nome,
    cargo: f.cargo,
    papel: papelSeparacao(f.cargo),
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
    serie: serieCustoSetor(meses, fotosSetor, atual, { pessoas: pessoas.length, folha: pessoas.reduce((t, y) => t + y.custo, 0) }),
  };
}
