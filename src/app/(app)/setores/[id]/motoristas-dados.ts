import { listarEquipamentos } from "@/data/equipamentos";
import { getResumoFaturamentoDashboard, getResumoFaturamentoPeriodo, vendaLiquidaDasFotos } from "@/data/faturamento-mensal";
import { isAdmin } from "@/data/auth";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { lerViagensPeriodo, lerEntregasMeses, type EntregasDoMes } from "@/data/winthor-entregas";
import { getDevolucaoLogisticaPorFaturamento, getMotoristaCidades } from "@/data/devolucoes";
import { lerHodometroPeriodo } from "@/data/frota-km";
import { lerCadastroFrota } from "@/data/frota-custos";
import type { CadastroFrota } from "@/domain/frota-custo";
import { kmDasViagens, mapaKmDia, type LinhaHodometro } from "@/domain/frota";
import { INICIO_HISTORICO, type Periodo, mesProximo, mesesDoPeriodo, periodoAberto, periodoAnterior, primeiroDiaDoMes, tipoPeriodo } from "@/domain/periodo";
import { custoDoRecorte } from "@/domain/custo-periodo";
import { fracaoDoMes } from "@/domain/recebimento";
import { mesmoSetor, serieCustoSetor, type PontoCustoSetor } from "@/domain/separacao";
import { cidadesPorMotorista, papelMotoristas, porMotorista, resumoDevolucao, totaisEntregas, type CidadesDoMotorista, type DevolucaoMotDia, type ResumoMotorista, type ViagemEntrega } from "@/domain/motoristas";
import { sugerirFuncionario } from "@/domain/turno";
import type { Equipamento, Funcionario } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";
import { lembrar, ttlDoPeriodo } from "@/lib/cache-memoria";

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

export interface MotoristaBI extends ResumoMotorista {
  /** Funcionário do Efetivo casado pelo nome (só da casa); null = terceiro ou sem cadastro. */
  funcionarioId: string | null;
  custoPeriodo: number | null;
  custoPorEntrega: number | null;
  devolucao: { expedidas: number; devolvidas: number; taxa: number | null; valorDevolvido: number } | null;
  /** km das viagens dele pela telemetria (null = nenhum veículo dele rastreado). */
  km: number | null;
  kmPorEntrega: number | null;
  /** Cidades atendidas e clientes que devolveram (logística), pelo dia faturado; null = sem dado. */
  cidades: CidadesDoMotorista | null;
}

export interface DadosBIMotoristas {
  periodo: Periodo; // recorte na tela
  mensal: boolean; // recorte = um mês inteiro
  meses: string[]; // meses do recorte até o corrente (destaque nas barras)
  mes: string; // mês de referência = último mês do recorte (até o corrente)
  atual: string;
  setor: string;
  admin: boolean;
  pessoas: PessoaBI[];
  equipamentos: Equipamento[];
  serie: PontoCustoSetor[];
  fracaoMes: number;
  faturamentoLiquido: number | null;
  historico: PontoHistoricoMot[];
  ref: PontoHistoricoMot | null; // o recorte: custo = custo médio por mês (custo × fracaoMes = custo do recorte)
  refAnterior: PontoHistoricoMot | null; // recorte de comparação
  rotuloAnterior: string;
  custoCompleto: boolean;
  /** Viagens do recorte no Winthor; `erro` = não conseguiu ler. */
  entregas: { viagens: ViagemEntrega[] } | { erro: string };
  /**
   * Devolução POR PERÍODO DE FATURAMENTO, motorista × dia: das notas saídas no
   * dia, quantas voltaram por motivo da LOGÍSTICA (em qualquer data depois).
   */
  devolucao: DevolucaoMotDia[] | null;
  /** Hodômetro diário da frota no mês (telemetria Fulltrack); null = sem telemetria. */
  hodometro: LinhaHodometro[] | null;
  /** Cadastro do custo estimado da frota (Custos › Frota); null = não migrado. */
  cadastroFrota: CadastroFrota | null;
  /** Individual por motorista — SÓ admin (quem não é admin recebe null). */
  motoristas: MotoristaBI[] | null;
}

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function carregarBIMotoristas(setor: { id: string; nome: string }, funcionarios: Funcionario[], periodo: Periodo): Promise<DadosBIMotoristas> {
  const atual = primeiroDiaDoMes();
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const mensal = tipoPeriodo(periodo) === "mes";
  const mes = primeiroDiaDoMes(periodo.ate < hojeISO ? periodo.ate : hojeISO);
  const mesesRecorte = mesesDoPeriodo(periodo).filter((m) => m <= atual);
  const inicioSerie = mesesRecorte[0] && mesesRecorte[0] < INICIO_HISTORICO ? mesesRecorte[0] : INICIO_HISTORICO;
  const meses: string[] = [];
  for (let x = inicioSerie; x <= atual; x = mesProximo(x)) meses.push(x);
  const fechados = meses.filter((m) => m < atual && (!mensal || m !== mes));
  const { de, ate } = periodo;
  const chave = `${de}|${ate}`;
  const ttl = ttlDoPeriodo(periodo);
  const pAnt = periodoAnterior(periodo, hoje);

  const [admin, equipamentos, fotos, viagens, mesesW, fatMes, fatFotos, devol, hodometro, cadastroFrota, cidadesMot, viagensAnt] = await Promise.all([
    isAdmin(),
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    lembrar(`lerViagensPeriodo:${chave}`, ttl, () => lerViagensPeriodo(de, ate)).then(
      (v) => ({ viagens: v }),
      (e) => {
        console.error("[winthor-entregas]", erroMsg(e));
        return { erro: erroMsg(e) };
      },
    ),
    lembrar(`lerEntregasMeses:${inicioSerie}|${mes}`, ttl, () => lerEntregasMeses(inicioSerie, mes)).catch(() => null as EntregasDoMes[] | null),
    (mensal
      ? lembrar(`getResumoFaturamentoDashboard:${mes}`, ttl, () => getResumoFaturamentoDashboard(mes))
      : lembrar(`getResumoFaturamentoPeriodo:${chave}`, ttl, () => getResumoFaturamentoPeriodo(de, ate))
    ).catch(() => null),
    vendaLiquidaDasFotos(fechados).catch(() => new Map<string, number>()),
    lembrar(`devolucaoLogisticaPorFaturamentoDia:${chave}`, ttl, () => getDevolucaoLogisticaPorFaturamento(de, ate)).catch(() => null),
    lerHodometroPeriodo(de, ate).catch(() => null), // Supabase: sem cache
    lerCadastroFrota().catch(() => null),
    lembrar(`motoristaCidades:${chave}`, ttl, () => getMotoristaCidades(de, ate)).catch(() => null),
    // Período: viagens do período anterior para comparar entregas por dia.
    mensal ? Promise.resolve(null) : lembrar(`lerViagensPeriodo:${pAnt.de}|${pAnt.ate}`, ttlDoPeriodo(pAnt), () => lerViagensPeriodo(pAnt.de, pAnt.ate)).catch(() => null),
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
  const custoPorMes = new Map(serie.map((p) => [p.mes, p.folha === null ? null : p.folha + custoEquip]));
  const recorte = custoDoRecorte(periodo, custoPorMes, hoje);
  const fracaoMes = mensal ? fracaoDoMes(mes, hoje) : recorte.fracao;

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
        faturamentoLiquido: mensal && p.mes === mes ? (fatMes?.vendaLiquida ?? null) : (fatFotos.get(p.mes) ?? null),
        viagens: w?.viagens ?? null,
        entregas: w?.entregas ?? null,
        kg: w?.kg ?? null,
        dias: w?.dias ?? null,
        parcial: p.mes === atual,
      };
    });

  // O recorte e a comparação (mês: ponto do histórico e mês anterior, como sempre foi).
  const media = (r: ReturnType<typeof custoDoRecorte>) => (r.total === null || r.fracao <= 0 ? null : r.total / r.fracao);
  const pontoDe = (vs: ViagemEntrega[] | null, r: ReturnType<typeof custoDoRecorte>, m: string, fat: number | null, parcial: boolean): PontoHistoricoMot => {
    const t = vs ? totaisEntregas(vs) : null;
    return {
      mes: m,
      custo: media(r),
      custoPeriodo: r.completo ? r.total : null,
      faturamentoLiquido: fat,
      viagens: t?.viagens ?? null,
      entregas: t?.entregas ?? null,
      kg: t?.kg ?? null,
      dias: vs ? new Set(vs.map((v) => v.dia)).size : null,
      parcial,
    };
  };
  let ref: PontoHistoricoMot | null;
  let refAnterior: PontoHistoricoMot | null;
  if (mensal) {
    const i = historico.findIndex((x) => x.mes === mes);
    ref = i >= 0 ? historico[i] : null;
    refAnterior = i > 0 ? historico[i - 1] : null;
  } else {
    ref = pontoDe("viagens" in viagens ? viagens.viagens : null, recorte, mes, fatMes?.vendaLiquida ?? null, periodoAberto(periodo, hoje));
    refAnterior = pontoDe(viagensAnt, custoDoRecorte(pAnt, custoPorMes, hoje), primeiroDiaDoMes(pAnt.ate), null, false);
  }

  const listaDev = devol ? resumoDevolucao(devol).porMotorista : [];

  // Individual (admin): motorista do Winthor → funcionário do Efetivo pelo nome
  // (casamento automático, mesmo critério do Harpia; só gente do setor).
  let motoristas: MotoristaBI[] | null = null;
  if (admin && "viagens" in viagens) {
    const candidatos = ativos.map((f) => ({ id: f.id, nome: f.nome, turno: f.turno }));
    const funcPorId = new Map(ativos.map((f) => [f.id, f]));
    const devPorMot = new Map(listaDev.map((m) => [m.codMotorista, m]));
    const cidadesPorMot = cidadesMot ? cidadesPorMotorista(cidadesMot) : null;
    // km de cada viagem pela telemetria, somado por motorista (entregas só das viagens com km).
    const kmMot = new Map<number, { km: number; entregas: number }>();
    if (hodometro) {
      const kms = kmDasViagens(viagens.viagens, mapaKmDia(hodometro));
      viagens.viagens.forEach((v, i) => {
        const km = kms[i];
        if (km === null) return;
        const t = kmMot.get(v.motorista) ?? { km: 0, entregas: 0 };
        t.km += km;
        t.entregas += v.entregas;
        kmMot.set(v.motorista, t);
      });
    }
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
        km: kmMot.get(m.motorista)?.km ?? null,
        cidades: cidadesPorMot?.get(m.motorista) ?? null,
        kmPorEntrega: (() => {
          const t = kmMot.get(m.motorista);
          return t && t.entregas > 0 ? t.km / t.entregas : null;
        })(),
      };
    });
  }

  return {
    periodo,
    mensal,
    meses: mesesRecorte,
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
    ref,
    refAnterior,
    rotuloAnterior: mensal ? "mês anterior" : "período anterior",
    custoCompleto: mensal ? ref?.custo != null : recorte.completo,
    entregas: viagens,
    devolucao: devol,
    hodometro,
    cadastroFrota,
    motoristas,
  };
}
