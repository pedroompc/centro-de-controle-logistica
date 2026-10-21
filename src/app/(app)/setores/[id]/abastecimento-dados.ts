import { listarEquipamentos } from "@/data/equipamentos";
import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { fracaoDoMes } from "@/domain/recebimento";
import { lerAbastecimentoHarpia, type DadosHarpiaAbastecimento } from "@/data/harpia-abastecimento";
import { isAdmin } from "@/data/auth";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { INICIO_HISTORICO, mesProximo, primeiroDiaDoMes } from "@/domain/periodo";
import { mesmoSetor, serieCustoSetor, type PontoCustoSetor } from "@/domain/separacao";
import { papelAbastecimento } from "@/domain/abastecimento";
import type { Equipamento, Funcionario } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";
import { listarUsuariosHarpia } from "@/data/harpia-usuarios";
import { montarNomesHarpia, type NomesHarpia } from "./turno-dados";

export interface DadosBIAbastecimento {
  mes: string; // mês na tela "yyyy-mm-01"
  atual: string; // mês corrente
  setor: string;
  pessoas: PessoaBI[]; // cadastro ATUAL do setor (não há histórico por pessoa)
  equipamentos: Equipamento[];
  serie: PontoCustoSetor[]; // julho/2026 → mês corrente
  /** Abastecimento do Harpia; `erro` = não conseguiu ler (permissão, rede…). */
  harpia: { dados: DadosHarpiaAbastecimento } | { erro: string };
  /** Usuário do Harpia → funcionário (e turno); opções do seletor de ligação. */
  nomes: NomesHarpia;
  admin: boolean;
  /** Venda líquida do mês (Winthor ao vivo, como o card do dashboard); null = indisponível. */
  faturamentoLiquido: number | null;
  /** Quanto do mês já correu (1 = fechado) — o custo entra proporcional. */
  fracaoMes: number;
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
  const [equipamentos, fotos, harpia, ligacoes, admin, faturamento] = await Promise.all([
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    harpiaDoMes(mes),
    listarUsuariosHarpia().catch(() => null),
    isAdmin(),
    getResumoFaturamentoDashboard(mes).catch(() => null),
  ]);
  const h = "dados" in harpia ? harpia.dados : null;
  const usuarios = h
    ? [
        ...h.movimentoPiso.porPessoaDia,
        ...h.convocacoes.flatMap((c) => (c.usuario === null ? [] : [{ usuario: c.usuario, nome: c.nome }])),
      ]
    : [];
  const ativos = funcionarios.filter((f) => f.setorId === setor.id && f.status === "ativo");
  const pessoas: PessoaBI[] = ativos.map((f) => ({
    id: f.id,
    nome: f.nome,
    cargo: f.cargo,
    papel: papelAbastecimento(f.cargo),
    custo: f.custoMensal,
    outroSetor: false,
    turno: f.turno,
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
    nomes: montarNomesHarpia(usuarios, ligacoes, funcionarios, setor.id, admin),
    admin,
    faturamentoLiquido: faturamento?.vendaLiquida ?? null,
    fracaoMes: fracaoDoMes(mes),
    serie: serieCustoSetor(meses, fotosSetor, atual, { pessoas: pessoas.length, folha: pessoas.reduce((t, y) => t + y.custo, 0) }),
  };
}
