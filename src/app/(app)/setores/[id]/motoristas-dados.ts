import { listarEquipamentos } from "@/data/equipamentos";
import { getResumoFaturamentoDashboard, vendaLiquidaDasFotos } from "@/data/faturamento-mensal";
import { isAdmin } from "@/data/auth";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { lerViagensMes, lerEntregasMeses, type EntregasDoMes } from "@/data/winthor-entregas";
import { carregarMotoristas } from "../../devolucoes/actions";
import { INICIO_HISTORICO, mesProximo, primeiroDiaDoMes } from "@/domain/periodo";
import { fracaoDoMes } from "@/domain/recebimento";
import { mesmoSetor, serieCustoSetor, type PontoCustoSetor } from "@/domain/separacao";
import { papelMotoristas, porMotorista, type ResumoMotorista, type ViagemEntrega } from "@/domain/motoristas";
import { sugerirFuncionario } from "@/domain/turno";
import type { DevolucaoPorMotorista } from "@/domain/devolucoes";
import type { Equipamento, Funcionario } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";
import { lembrar, ttlDoMes } from "@/lib/cache-memoria";

export interface PontoHistoricoMot {
  mes: string;
  custo: number | null; // folha da foto do mês + equipamentos de hoje (mês cheio)
  custoPeriodo: number | null; // custo × fração do mês (mês corrente proporcional)
  faturamentoLiquido: number | null;
  viagens: number | null;
  entregas: number | null;
  kg: number | null;
  dias: number | null;
  parcial: boolean;
}

/** Devolução do mês por motorista: taxa só dos motivos da LOGÍSTICA (data da devolução). */
export interface DevolucaoMot {
  porMotorista: DevolucaoPorMotorista[];
  expedidas: number;
  devolvidas: number;
  valorExpedido: number;
  valorDevolvido: number;
}

export interface MotoristaBI extends ResumoMotorista {
  /** Funcionário do Efetivo casado pelo nome (só da casa); null = terceiro ou sem cadastro. */
  funcionarioId: string | null;
  custoPeriodo: number | null;
  custoPorEntrega: number | null;
  devolucao: { expedidas: number; devolvidas: number; taxa: number; valorDevolvido: number } | null;
}

export interface DadosBIMotoristas {
  mes: string;
  atual: string;
  setor: string;
  admin: boolean;
  pessoas: PessoaBI[];
  equipamentos: Equipamento[];
  serie: PontoCustoSetor[];
  fracaoMes: number;
  faturamentoLiquido: number | null;
  historico: PontoHistoricoMot[];
  /** Viagens do mês no Winthor; `erro` = não conseguiu ler. */
  entregas: { viagens: ViagemEntrega[] } | { erro: string };
  devolucao: DevolucaoMot | null;
  /** Individual por motorista — SÓ admin (quem não é admin recebe null). */
  motoristas: MotoristaBI[] | null;
}

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function carregarBIMotoristas(setor: { id: string; nome: string }, funcionarios: Funcionario[], mes: string): Promise<DadosBIMotoristas> {
  const atual = primeiroDiaDoMes();
  const hoje = new Date();
  const meses: string[] = [];
  for (let x = INICIO_HISTORICO; x <= atual; x = mesProximo(x)) meses.push(x);
  const fechados = meses.filter((m) => m < atual && m !== mes);
  const ttl = ttlDoMes(mes);

  const [admin, equipamentos, fotos, viagens, mesesW, fatMes, fatFotos, devol] = await Promise.all([
    isAdmin(),
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    lembrar(`lerViagensMes:${mes}`, ttl, () => lerViagensMes(mes)).then(
      (v) => ({ viagens: v }),
      (e) => {
        console.error("[winthor-entregas]", erroMsg(e));
        return { erro: erroMsg(e) };
      },
    ),
    lembrar(`lerEntregasMeses:${mes}`, ttl, () => lerEntregasMeses(INICIO_HISTORICO, mes)).catch(() => null as EntregasDoMes[] | null),
    lembrar(`getResumoFaturamentoDashboard:${mes}`, ttl, () => getResumoFaturamentoDashboard(mes)).catch(() => null),
    vendaLiquidaDasFotos(fechados).catch(() => new Map<string, number>()),
    lembrar(`devolucaoMotoristasLogistica:${mes}`, ttl, () => carregarMotoristas(mes, undefined, "Logística")).catch(() => null),
  ]);

  const ativos = funcionarios.filter((f) => f.setorId === setor.id && f.status === "ativo");
  const pessoas: PessoaBI[] = ativos.map((f) => ({
    id: f.id,
    nome: f.nome,
    cargo: f.cargo,
    papel: papelMotoristas(f.cargo),
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
  const equip = (equipamentos ?? []).filter((e) => mesmoSetor(e.setor, setor.nome));
  const custoEquip = equip.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const serie = serieCustoSetor(meses, fotos.filter((f) => mesmoSetor(f.setor, setor.nome)), atual, { pessoas: pessoas.length, folha: pessoas.reduce((t, y) => t + y.custo, 0) });
  const fracaoMes = fracaoDoMes(mes, hoje);

  const porMes = new Map((mesesW ?? []).map((m) => [m.mes, m]));
  const historico: PontoHistoricoMot[] = serie
    .filter((p) => p.mes <= mes)
    .map((p) => {
      const custo = p.folha === null ? null : p.folha + custoEquip;
      const w = porMes.get(p.mes);
      return {
        mes: p.mes,
        custo,
        custoPeriodo: custo === null ? null : custo * fracaoDoMes(p.mes, hoje),
        faturamentoLiquido: p.mes === mes ? (fatMes?.vendaLiquida ?? null) : (fatFotos.get(p.mes) ?? null),
        viagens: w?.viagens ?? null,
        entregas: w?.entregas ?? null,
        kg: w?.kg ?? null,
        dias: w?.dias ?? null,
        parcial: p.mes === atual,
      };
    });

  const listaDev = devol?.itens ?? [];
  const devolucao: DevolucaoMot | null = devol
    ? {
        porMotorista: listaDev,
        expedidas: listaDev.reduce((t, m) => t + m.expedidas, 0),
        devolvidas: listaDev.reduce((t, m) => t + m.devolvidas, 0),
        valorExpedido: listaDev.reduce((t, m) => t + m.valorExpedido, 0),
        valorDevolvido: listaDev.reduce((t, m) => t + m.valorDevolvido, 0),
      }
    : null;

  // Individual (admin): motorista do Winthor → funcionário do Efetivo pelo nome
  // (casamento automático, mesmo critério do Harpia; só gente do setor).
  let motoristas: MotoristaBI[] | null = null;
  if (admin && "viagens" in viagens) {
    const candidatos = ativos.map((f) => ({ id: f.id, nome: f.nome, turno: f.turno }));
    const funcPorId = new Map(ativos.map((f) => [f.id, f]));
    const devPorMot = new Map(listaDev.map((m) => [m.codMotorista, m]));
    motoristas = porMotorista(viagens.viagens).map((m) => {
      const fid = m.tipo === "T" ? null : sugerirFuncionario(m.nome, candidatos);
      const f = fid ? funcPorId.get(fid) ?? null : null;
      const custo = f ? f.custoMensal * fracaoMes : null;
      const d = devPorMot.get(m.motorista);
      return {
        ...m,
        funcionarioId: fid,
        custoPeriodo: custo,
        custoPorEntrega: custo !== null && m.entregas > 0 ? custo / m.entregas : null,
        devolucao: d ? { expedidas: d.expedidas, devolvidas: d.devolvidas, taxa: d.taxa, valorDevolvido: d.valorDevolvido } : null,
      };
    });
  }

  return {
    mes,
    atual,
    setor: setor.nome,
    admin,
    pessoas,
    equipamentos: equip,
    serie,
    fracaoMes,
    faturamentoLiquido: fatMes?.vendaLiquida ?? null,
    historico,
    entregas: viagens,
    devolucao,
    motoristas,
  };
}
