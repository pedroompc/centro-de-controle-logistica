import { listarEquipamentos } from "@/data/equipamentos";
import { lerSeparacaoHarpia, lerIndividuaisHarpia, lerProducaoIndividualMes, lerMesesSeparacaoHarpia, type DadosHarpiaSeparacao, type ProdutoErro } from "@/data/harpia-separacao";
import { lerConfrontoWinthor, type DiaConfrontoWinthor } from "@/data/winthor-separacao";
import { listarUsuariosHarpia } from "@/data/harpia-usuarios";
import { getResumoFaturamentoDashboard, vendaLiquidaDasFotos } from "@/data/faturamento-mensal";
import { isAdmin } from "@/data/auth";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { INICIO_HISTORICO, mesAnterior, mesProximo, primeiroDiaDoMes } from "@/domain/periodo";
import { fracaoDoMes } from "@/domain/recebimento";
import {
  mesmoSetor, papelSeparacao, serieCustoSetor, resolverTurnos, skusPorTurnoDia, porSeparador, porConferente, linhasPorHoraDoGrupo, sinalOperador,
  type PontoCustoSetor, type SkusTurnoDia, type LinhaTurno, type ErroTurno, type DiaSep, type EquipeTurno, type ResumoSeparador, type ResumoConferente, type SinalOperador,
} from "@/domain/separacao";
import { turnosDivergentes, confrontoDiario, diasUteisSemProducao, linhasPorTipo, type ConfrontoDia, type LinhasPorTipo } from "@/domain/separacao-auditoria";
import { TURNOS_SEPARACAO, TURNOS_VALIDADOS_RH } from "@/domain/turnos-separacao";
import type { Equipamento, Funcionario, Turno } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";
import { montarNomesHarpia } from "./turno-dados";

/** Primeiro mês com o separador gravado por página no Harpia (06/08/2026). */
const INICIO_SEPARADOR = "2026-08-01";

export interface PontoHistorico {
  mes: string;
  custo: number | null; // folha da foto do mês + equipamentos de hoje (mês cheio)
  custoPeriodo: number | null; // custo × fração do mês (mês corrente proporcional)
  faturamentoLiquido: number | null;
  linhas: number | null;
  kg: number | null;
  pedidos: number | null;
  dias: number | null;
  parcial: boolean;
}

export interface ProducaoBI {
  linhas: LinhaTurno[]; // turno resolvido no servidor, sem separador nem mapa
  dias: DiaSep[];
  totalMes: DadosHarpiaSeparacao["totalMes"];
  erros: ErroTurno[];
  produtosComErro: ProdutoErro[];
  enderecos: DadosHarpiaSeparacao["enderecos"];
  skusTurno: SkusTurnoDia[];
  equipe: Record<Turno, EquipeTurno>;
}

export interface AuditoriaSep {
  porTipo: LinhasPorTipo[];
  separadoresRegistrados: number;
  semFuncionario: { separadores: number; linhas: number };
  divergenciasTurno: { quantidade: number; linhas: number; detalhes: { nome: string; cadastro: Turno; horario: Turno; horaMediana: number; linhas: number }[] | null }; // detalhes só p/ admin
  errosSeparador: { itens: number; atribuidos: number };
  confronto: ConfrontoDia[];
  filial11: { pedidos: number; kg: number };
  canceladosAposSeparar: number;
  diasSemProducao: string[];
  turnosValidados: boolean;
  winthorErro: string | null;
}

export interface SeparadorBI extends ResumoSeparador {
  nome: string;
  custoPeriodo: number | null; // custo do funcionário ligado × fração do mês
  custoPorLinha: number | null;
  anteriorLinhasPorHora: number | null;
  sinal: SinalOperador;
}

export interface ConferenteBI extends ResumoConferente {
  nome: string;
  turno: Turno | null;
}

/** SÓ existe para admin — montado no servidor; quem não é admin recebe null. */
export interface DadosIndividuais {
  separadores: SeparadorBI[];
  mediaGeral: number | null;
  mediaTurno: Record<Turno, number | null>;
  kgPorLinhaTurno: Record<Turno, number | null>;
  mesAnterior: string | null;
  conferentes: ConferenteBI[];
}

export interface DadosBISeparacao {
  mes: string; // mês na tela "yyyy-mm-01"
  atual: string; // mês corrente
  hoje: string; // "yyyy-mm-dd"
  setor: string;
  admin: boolean;
  pessoas: PessoaBI[]; // cadastro ATUAL (não há histórico por pessoa)
  equipamentos: Equipamento[];
  serie: PontoCustoSetor[];
  fracaoMes: number;
  faturamentoLiquido: number | null;
  historico: PontoHistorico[];
  producao: ProducaoBI | { erro: string };
  auditoria: AuditoriaSep | null;
  individual: DadosIndividuais | null;
}

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function tentar<T>(rotulo: string, f: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await f();
  } catch (e) {
    console.error(`[${rotulo}]`, erroMsg(e));
    return { erro: erroMsg(e) };
  }
}
const ok = <T extends object>(x: T | { erro: string }): x is T => !("erro" in x);

/** Equipe, custo, produção (Harpia), confronto (Winthor) e — só admin — o individual. */
export async function carregarBISeparacao(setor: { id: string; nome: string }, funcionarios: Funcionario[], mes: string): Promise<DadosBISeparacao> {
  const atual = primeiroDiaDoMes();
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const meses: string[] = [];
  for (let x = INICIO_HISTORICO; x <= atual; x = mesProximo(x)) meses.push(x);
  const fechados = meses.filter((m) => m < atual && m !== mes);

  const admin = await isAdmin();
  const mesAnt = mesAnterior(mes) >= INICIO_SEPARADOR ? mesAnterior(mes) : null;
  const [equipamentos, fotos, harpia, winthor, mesesH, ligacoes, fatMes, fatFotos, indiv, anterior] = await Promise.all([
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    tentar("harpia-separacao", () => lerSeparacaoHarpia(mes)),
    tentar("winthor-separacao", () => lerConfrontoWinthor(mes)),
    lerMesesSeparacaoHarpia(INICIO_HISTORICO, mes).catch(() => null),
    listarUsuariosHarpia().catch(() => null),
    getResumoFaturamentoDashboard(mes).catch(() => null),
    vendaLiquidaDasFotos(fechados).catch(() => new Map<string, number>()),
    // Individual: as consultas nem rodam para quem não é admin.
    admin ? lerIndividuaisHarpia(mes).catch(() => null) : Promise.resolve(null),
    admin && mesAnt ? lerProducaoIndividualMes(mesAnt).catch(() => null) : Promise.resolve(null),
  ]);

  const ativos = funcionarios.filter((f) => f.setorId === setor.id && f.status === "ativo");
  const pessoas: PessoaBI[] = ativos.map((f) => ({
    id: f.id,
    nome: f.nome,
    cargo: f.cargo,
    papel: papelSeparacao(f.cargo),
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

  // Usuário do Harpia → funcionário → turno do cadastro (ligação manual vence; senão pelo nome).
  const usuarios = ok(harpia) ? harpia.usuarios : [];
  const conferentesH = indiv?.conferentes ?? [];
  const nomes = montarNomesHarpia([...usuarios, ...conferentesH.map((c) => ({ usuario: c.usuario, nome: c.nome }))], ligacoes, funcionarios, setor.id, admin);
  const funcPorId = new Map(funcionarios.map((f) => [f.id, f]));
  const funcDoUsuario = (u: number) => {
    const l = nomes.ligacoes[u];
    return l ? (funcPorId.get(l.funcionarioId) ?? null) : null;
  };
  const turnoDoUsuario = new Map<number, Turno>();
  for (const u of usuarios) {
    const f = funcDoUsuario(u.usuario);
    if (f) turnoDoUsuario.set(u.usuario, f.turno);
  }

  const equipe = Object.fromEntries(
    TURNOS_SEPARACAO.map((t) => {
      const g = pessoas.filter((y) => y.turno === t.id);
      return [t.id, { pessoas: g.length, separadores: g.filter((y) => y.papel === "separador").length, conferentes: g.filter((y) => y.papel === "conferente").length, custoMes: g.reduce((s, y) => s + y.custo, 0) }];
    }),
  ) as Record<Turno, EquipeTurno>;

  let producao: DadosBISeparacao["producao"] = { erro: ok(harpia) ? "" : harpia.erro };
  let auditoria: AuditoriaSep | null = null;
  if (ok(harpia)) {
    const r = resolverTurnos(harpia.linhas, harpia.erros, harpia.mapas, turnoDoUsuario);
    producao = { linhas: r.linhas, dias: harpia.dias, totalMes: harpia.totalMes, erros: r.erros, produtosComErro: harpia.produtosComErro, enderecos: harpia.enderecos, skusTurno: skusPorTurnoDia(harpia.produtosTurno, turnoDoUsuario), equipe };

    const kgPorDia = new Map<string, number>();
    for (const l of harpia.linhas) kgPorDia.set(l.dia, (kgPorDia.get(l.dia) ?? 0) + l.kg);
    const w: DiaConfrontoWinthor[] = ok(winthor) ? winthor : [];
    const div = turnosDivergentes(harpia.linhas, turnoDoUsuario);
    const semFunc = usuarios.filter((u) => !turnoDoUsuario.has(u.usuario));
    const semFuncSet = new Set(semFunc.map((u) => u.usuario));
    const errosS = harpia.erros.filter((e) => e.origem === "separador");
    const nomeDe = (u: number) => funcDoUsuario(u)?.nome ?? usuarios.find((x) => x.usuario === u)?.nome ?? `Usuário ${u}`;
    auditoria = {
      porTipo: linhasPorTipo(harpia.linhas, harpia.mapas),
      separadoresRegistrados: usuarios.length,
      semFuncionario: { separadores: semFunc.length, linhas: harpia.linhas.filter((l) => l.usuario !== null && semFuncSet.has(l.usuario)).reduce((t, l) => t + l.linhas, 0) },
      divergenciasTurno: {
        quantidade: div.length,
        linhas: div.reduce((t, d) => t + d.linhas, 0),
        detalhes: admin ? div.map((d) => ({ nome: nomeDe(d.usuario), cadastro: d.cadastro, horario: d.horario, horaMediana: d.horaMediana, linhas: d.linhas })) : null,
      },
      errosSeparador: { itens: errosS.reduce((t, e) => t + e.itens, 0), atribuidos: errosS.filter((e) => e.usuario !== null).reduce((t, e) => t + e.itens, 0) },
      confronto: confrontoDiario(harpia.dias, kgPorDia, w),
      filial11: w.filter((x) => x.filial === "11").reduce((a, x) => ({ pedidos: a.pedidos + x.pedidos, kg: a.kg + x.kg }), { pedidos: 0, kg: 0 }),
      canceladosAposSeparar: w.reduce((t, x) => t + x.cancelados, 0),
      diasSemProducao: diasUteisSemProducao(mes, harpia.dias, hojeISO),
      turnosValidados: TURNOS_VALIDADOS_RH,
      winthorErro: ok(winthor) ? null : winthor.erro,
    };
  }

  // Individual (admin): por separador no mês e no anterior; conferentes.
  let individual: DadosIndividuais | null = null;
  if (admin && ok(harpia) && indiv) {
    const atuais = porSeparador(harpia.linhas, indiv.paginas, harpia.erros, turnoDoUsuario);
    const antes = anterior ? new Map(porSeparador(anterior.linhas, anterior.paginas, anterior.erros, turnoDoUsuario).map((s) => [s.usuario, s])) : new Map<number, ResumoSeparador>();
    const mediaTurno = {} as Record<Turno, number | null>;
    const kgPorLinhaTurno = {} as Record<Turno, number | null>;
    for (const t of TURNOS_SEPARACAO) {
      const g = atuais.filter((s) => s.turno === t.id);
      mediaTurno[t.id] = linhasPorHoraDoGrupo(g);
      const lin = g.reduce((s, x) => s + x.linhas, 0);
      kgPorLinhaTurno[t.id] = lin > 0 ? g.reduce((s, x) => s + x.kg, 0) / lin : null;
    }
    individual = {
      separadores: atuais.map((s) => {
        const f = funcDoUsuario(s.usuario);
        const custo = f ? f.custoMensal * fracaoMes : null;
        const ant = antes.get(s.usuario) ?? null;
        return {
          ...s,
          nome: f?.nome ?? usuarios.find((u) => u.usuario === s.usuario)?.nome ?? `Usuário ${s.usuario}`,
          custoPeriodo: custo,
          custoPorLinha: custo !== null && s.linhas > 0 ? custo / s.linhas : null,
          anteriorLinhasPorHora: ant?.amostraSuficiente ? ant.linhasPorHora : null,
          sinal: sinalOperador(s, ant, s.turno ? mediaTurno[s.turno] : null, s.turno ? kgPorLinhaTurno[s.turno] : null),
        };
      }),
      mediaGeral: linhasPorHoraDoGrupo(atuais),
      mediaTurno,
      kgPorLinhaTurno,
      mesAnterior: mesAnt,
      conferentes: porConferente(conferentesH).map((c) => {
        const f = funcDoUsuario(c.usuario);
        return { ...c, nome: f?.nome ?? conferentesH.find((x) => x.usuario === c.usuario)?.nome ?? `Usuário ${c.usuario}`, turno: f?.turno ?? null };
      }),
    };
  }

  const prodMes = new Map((mesesH ?? []).map((m) => [m.mes, m]));
  const historico: PontoHistorico[] = serie
    .filter((p) => p.mes <= mes)
    .map((p) => {
      const custo = p.folha === null ? null : p.folha + custoEquip;
      const fr = fracaoDoMes(p.mes, hoje);
      const pm = prodMes.get(p.mes);
      return {
        mes: p.mes,
        custo,
        custoPeriodo: custo === null ? null : custo * fr,
        faturamentoLiquido: p.mes === mes ? (fatMes?.vendaLiquida ?? null) : (fatFotos.get(p.mes) ?? null),
        linhas: pm?.linhas ?? null,
        kg: pm?.kg ?? null,
        pedidos: pm?.pedidos ?? null,
        dias: pm?.dias ?? null,
        parcial: p.mes === atual,
      };
    });

  return {
    mes,
    atual,
    hoje: hojeISO,
    setor: setor.nome,
    admin,
    pessoas,
    equipamentos: equip,
    serie,
    fracaoMes,
    faturamentoLiquido: fatMes?.vendaLiquida ?? null,
    historico,
    producao,
    auditoria,
    individual,
  };
}
