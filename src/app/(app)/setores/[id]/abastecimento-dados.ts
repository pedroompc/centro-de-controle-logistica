import { listarEquipamentos } from "@/data/equipamentos";
import { getResumoFaturamentoDashboard, getResumoFaturamentoPeriodo } from "@/data/faturamento-mensal";
import { fracaoDoMes } from "@/domain/recebimento";
import { lerAbastecimentoHarpia, type DadosHarpiaAbastecimento } from "@/data/harpia-abastecimento";
import { isAdmin } from "@/data/auth";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { INICIO_HISTORICO, type Periodo, mesProximo, mesesDoPeriodo, periodoAnterior, primeiroDiaDoMes, tipoPeriodo } from "@/domain/periodo";
import { custoDoRecorte } from "@/domain/custo-periodo";
import { mesmoSetor, serieCustoSetor, type PontoCustoSetor } from "@/domain/separacao";
import { papelAbastecimento } from "@/domain/abastecimento";
import type { Equipamento, Funcionario } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";
import { listarUsuariosHarpia } from "@/data/harpia-usuarios";
import { montarNomesHarpia, type NomesHarpia } from "./turno-dados";
import { lembrar, ttlDoPeriodo } from "@/lib/cache-memoria";

export interface DadosBIAbastecimento {
  periodo: Periodo; // recorte na tela
  mensal: boolean; // recorte = um mês inteiro
  meses: string[]; // meses do recorte até o corrente (destaque nas barras)
  mes: string; // mês de referência = último mês do recorte (até o corrente)
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
  /** Meses equivalentes do recorte já decorridos (mês fechado = 1) — o custo entra proporcional. */
  fracaoMes: number;
  /** Custo do card: mês = custo do mês cheio; período = soma proporcional dos meses. */
  custoRecorte: number | null;
  /** Custo proporcional ao que já correu (base do custo ÷ faturamento); null se faltar foto em algum mês. */
  custoPeriodo: number | null;
  /** Custo médio por mês do recorte e do recorte anterior (variação). */
  custoMedio: number | null;
  custoMedioAnterior: number | null;
  rotuloAnterior: string;
  custoCompleto: boolean;
}

async function harpiaDoPeriodo(p: Periodo): Promise<DadosBIAbastecimento["harpia"]> {
  try {
    return { dados: await lembrar(`lerAbastecimentoHarpia:${p.de}|${p.ate}`, ttlDoPeriodo(p), () => lerAbastecimentoHarpia(p.de, p.ate)) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[harpia-abastecimento]", msg);
    return { erro: msg };
  }
}

/** Equipe, equipamentos e custo mês a mês do setor de Abastecimento. */
export async function carregarBIAbastecimento(setor: { id: string; nome: string }, funcionarios: Funcionario[], periodo: Periodo): Promise<DadosBIAbastecimento> {
  const atual = primeiroDiaDoMes();
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const mensal = tipoPeriodo(periodo) === "mes";
  const mes = primeiroDiaDoMes(periodo.ate < hojeISO ? periodo.ate : hojeISO);
  const mesesRecorte = mesesDoPeriodo(periodo).filter((m) => m <= atual);
  const inicioSerie = mesesRecorte[0] && mesesRecorte[0] < INICIO_HISTORICO ? mesesRecorte[0] : INICIO_HISTORICO;
  const meses: string[] = [];
  for (let x = inicioSerie; x <= atual; x = mesProximo(x)) meses.push(x);
  const ttl = ttlDoPeriodo(periodo);
  const [equipamentos, fotos, harpia, ligacoes, admin, faturamento] = await Promise.all([
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    harpiaDoPeriodo(periodo),
    listarUsuariosHarpia().catch(() => null),
    isAdmin(),
    (mensal
      ? lembrar(`getResumoFaturamentoDashboard:${mes}`, ttl, () => getResumoFaturamentoDashboard(mes))
      : lembrar(`getResumoFaturamentoPeriodo:${periodo.de}|${periodo.ate}`, ttl, () => getResumoFaturamentoPeriodo(periodo.de, periodo.ate))
    ).catch(() => null),
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
  const equip = (equipamentos ?? []).filter((e) => mesmoSetor(e.setor, setor.nome));
  const custoEquip = equip.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const serie = serieCustoSetor(meses, fotosSetor, atual, { pessoas: pessoas.length, folha: pessoas.reduce((t, y) => t + y.custo, 0) });
  // Custo do mês = folha (foto do mês; no corrente, o cadastro) + equipamentos de hoje.
  const custoPorMes = new Map(serie.map((p) => [p.mes, p.folha === null ? null : p.folha + custoEquip]));
  const rec = custoDoRecorte(periodo, custoPorMes, hoje);
  const recAnt = custoDoRecorte(periodoAnterior(periodo, hoje), custoPorMes, hoje);
  const media = (r: typeof rec) => (r.total === null || r.fracao <= 0 ? null : r.total / r.fracao);
  // Recorte mensal segue como sempre foi: custo do mês cheio, comparado ao mês anterior cheio.
  const custoMes = custoPorMes.get(mes) ?? null;
  const custoMesAnt = custoPorMes.get(meses[meses.indexOf(mes) - 1] ?? "") ?? null;
  return {
    periodo,
    mensal,
    meses: mesesRecorte,
    mes,
    atual,
    setor: setor.nome,
    pessoas,
    equipamentos: equip,
    harpia,
    nomes: montarNomesHarpia(usuarios, ligacoes, funcionarios, setor.id, admin),
    admin,
    faturamentoLiquido: faturamento?.vendaLiquida ?? null,
    fracaoMes: mensal ? fracaoDoMes(mes, hoje) : rec.fracao,
    serie,
    custoRecorte: mensal ? custoMes : rec.total,
    custoPeriodo: mensal ? (custoMes === null ? null : custoMes * fracaoDoMes(mes, hoje)) : rec.completo ? rec.total : null,
    custoMedio: mensal ? custoMes : media(rec),
    custoMedioAnterior: mensal ? custoMesAnt : media(recAnt),
    rotuloAnterior: mensal ? "mês anterior" : "período anterior",
    custoCompleto: mensal ? custoMes !== null : rec.completo,
  };
}
