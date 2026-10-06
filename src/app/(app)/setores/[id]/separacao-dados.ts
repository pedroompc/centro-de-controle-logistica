import { listarEquipamentos } from "@/data/equipamentos";
import { lerSeparacaoHarpia, type DadosHarpiaSeparacao } from "@/data/harpia-separacao";
import { listarUsuariosHarpia } from "@/data/harpia-usuarios";
import { lerProducaoSeparacao, lerMesesSeparacao, lerHorasSeparacao, type DiaProducaoSep, type MesSeparacao } from "@/data/winthor-separacao";
import { isAdmin } from "@/data/auth";
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
  /** Pedidos separados por dia (Winthor, PCPEDC.DTFINALSEP). */
  producao: { dias: DiaProducaoSep[]; meses: MesSeparacao[]; horas: { hora: number; pedidos: number }[] } | { erro: string };
  /** Usuário do Harpia → id do funcionário. `null` = tabela 0025 ausente. */
  ligacoes: Record<number, string> | null;
  /** Funcionários ativos para ligar aos usuários (o do setor primeiro). */
  funcionarios: { id: string; nome: string; cargo: string; doSetor: boolean }[];
  admin: boolean;
}

async function producaoDoMes(mes: string): Promise<DadosBISeparacao["producao"]> {
  try {
    const [dias, meses, horas] = await Promise.all([lerProducaoSeparacao(mes), lerMesesSeparacao(INICIO_HISTORICO, mes), lerHorasSeparacao(mes)]);
    return { dias, meses, horas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[winthor-separacao]", msg);
    return { erro: msg };
  }
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
  const [equipamentos, fotos, harpia, producao, ligacoes, admin] = await Promise.all([
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    harpiaDoMes(mes),
    producaoDoMes(mes),
    listarUsuariosHarpia().catch(() => null),
    isAdmin(),
  ]);
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
    producao,
    ligacoes: ligacoes ? Object.fromEntries(ligacoes) : null,
    funcionarios: funcionarios
      .filter((f) => f.status === "ativo")
      .map((f) => ({ id: f.id, nome: f.nome, cargo: f.cargo, doSetor: f.setorId === setor.id }))
      .sort((a, b) => Number(b.doSetor) - Number(a.doSetor) || a.nome.localeCompare(b.nome)),
    admin,
    serie: serieCustoSetor(meses, fotosSetor, atual, { pessoas: pessoas.length, folha: pessoas.reduce((t, y) => t + y.custo, 0) }),
  };
}
