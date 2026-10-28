import { listarEquipamentos } from "@/data/equipamentos";
import { lerSeparacaoHarpia, lerIndividuaisHarpia, lerProducaoIndividualMes, lerMesesSeparacaoHarpia, type DadosHarpiaSeparacao, type ProdutoErro } from "@/data/harpia-separacao";
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
import { turnosDivergentes } from "@/domain/separacao-auditoria";
import { HORAS_NA_SEPARACAO, TURNOS_SEPARACAO, turnoSepDoCadastro, type TurnoSep } from "@/domain/turnos-separacao";
import type { Equipamento, Funcionario } from "@/domain/types";
import type { PessoaBI } from "./bi-ui";
import { montarNomesHarpia } from "./turno-dados";
import { lembrar, ttlDoMes } from "@/lib/cache-memoria";

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
  equipe: Record<TurnoSep, EquipeTurno>;
}

/** Separadores com horário no Harpia ≠ turno do cadastro (alerta da aba Turnos). */
export interface DivergenciasTurno {
  quantidade: number;
  linhas: number;
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
  turno: TurnoSep | null;
}

/** SÓ existe para admin — montado no servidor; quem não é admin recebe null. */
export interface DadosIndividuais {
  separadores: SeparadorBI[];
  mediaGeral: number | null;
  mediaTurno: Record<TurnoSep, number | null>;
  kgPorLinhaTurno: Record<TurnoSep, number | null>;
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
  divergenciasTurno: DivergenciasTurno | null;
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

/** Equipe, custo, produção (Harpia, peso do Winthor) e — só admin — o individual. */
export async function carregarBISeparacao(setor: { id: string; nome: string }, funcionarios: Funcionario[], mes: string): Promise<DadosBISeparacao> {
  const atual = primeiroDiaDoMes();
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const meses: string[] = [];
  for (let x = INICIO_HISTORICO; x <= atual; x = mesProximo(x)) meses.push(x);
  const fechados = meses.filter((m) => m < atual && m !== mes);

  const admin = await isAdmin();
  const mesAnt = mesAnterior(mes) >= INICIO_SEPARADOR ? mesAnterior(mes) : null;
  const ttl = ttlDoMes(mes);
  const [equipamentos, fotos, harpia, mesesH, ligacoes, fatMes, fatFotos, indiv, anterior] = await Promise.all([
    listarEquipamentos().catch(() => null),
    serieEfetivoSetorMensal(24),
    // Leituras do Oracle ficam em cache (5 min no mês corrente, 60 min fechado);
    // o que vem do Supabase segue por request (RLS depende de quem está logado).
    tentar("harpia-separacao", () => lembrar(`lerSeparacaoHarpia:${mes}`, ttl, () => lerSeparacaoHarpia(mes))),
    lembrar(`lerMesesSeparacaoHarpia:${mes}`, ttl, () => lerMesesSeparacaoHarpia(INICIO_HISTORICO, mes)).catch(() => null),
    listarUsuariosHarpia().catch(() => null),
    lembrar(`getResumoFaturamentoDashboard:${mes}`, ttl, () => getResumoFaturamentoDashboard(mes)).catch(() => null),
    vendaLiquidaDasFotos(fechados).catch(() => new Map<string, number>()),
    // Individual: as consultas nem rodam para quem não é admin.
    admin ? lembrar(`lerIndividuaisHarpia:${mes}`, ttl, () => lerIndividuaisHarpia(mes)).catch(() => null) : Promise.resolve(null),
    admin && mesAnt
      ? lembrar(`lerProducaoIndividualMes:${mesAnt}`, ttlDoMes(mesAnt), () => lerProducaoIndividualMes(mesAnt)).catch(() => null)
      : Promise.resolve(null),
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
  const turnoDoUsuario = new Map<number, TurnoSep>();
  for (const u of usuarios) {
    const f = funcDoUsuario(u.usuario);
    if (f) turnoDoUsuario.set(u.usuario, turnoSepDoCadastro(f.turno));
  }

  const equipe = Object.fromEntries(
    TURNOS_SEPARACAO.map((t) => {
      const g = pessoas.filter((y) => turnoSepDoCadastro(y.turno) === t.id);
      const sep = g.filter((y) => y.papel === "separador");
      return [
        t.id,
        {
          pessoas: g.length,
          separadores: sep.length,
          horasSeparadorDia: sep.reduce((s, y) => s + HORAS_NA_SEPARACAO[y.turno], 0),
          conferentes: g.filter((y) => y.papel === "conferente").length,
          custoMes: g.reduce((s, y) => s + y.custo, 0),
        },
      ];
    }),
  ) as Record<TurnoSep, EquipeTurno>;

  let producao: DadosBISeparacao["producao"] = { erro: ok(harpia) ? "" : harpia.erro };
  let divergenciasTurno: DivergenciasTurno | null = null;
  if (ok(harpia)) {
    const r = resolverTurnos(harpia.linhas, harpia.erros, harpia.mapas, turnoDoUsuario);
    producao = { linhas: r.linhas, dias: harpia.dias, totalMes: harpia.totalMes, erros: r.erros, produtosComErro: harpia.produtosComErro, enderecos: harpia.enderecos, skusTurno: skusPorTurnoDia(harpia.produtosTurno, turnoDoUsuario), equipe };

    const div = turnosDivergentes(harpia.linhas, turnoDoUsuario);
    divergenciasTurno = { quantidade: div.length, linhas: div.reduce((t, d) => t + d.linhas, 0) };
  }

  // Individual (admin): por separador no mês e no anterior; conferentes.
  let individual: DadosIndividuais | null = null;
  if (admin && ok(harpia) && indiv) {
    const atuais = porSeparador(harpia.linhas, indiv.paginas, harpia.erros, turnoDoUsuario);
    const antes = anterior ? new Map(porSeparador(anterior.linhas, anterior.paginas, anterior.erros, turnoDoUsuario).map((s) => [s.usuario, s])) : new Map<number, ResumoSeparador>();
    const mediaTurno = {} as Record<TurnoSep, number | null>;
    const kgPorLinhaTurno = {} as Record<TurnoSep, number | null>;
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
      // Login do Harpia ligado a um líder (encarregado/supervisor) não entra na
      // lista de conferentes, mesmo que ele bipe mapa.
      conferentes: porConferente(conferentesH.filter((c) => {
        const f = funcDoUsuario(c.usuario);
        return !f || papelSeparacao(f.cargo) !== "lider";
      })).map((c) => {
        const f = funcDoUsuario(c.usuario);
        return { ...c, nome: f?.nome ?? conferentesH.find((x) => x.usuario === c.usuario)?.nome ?? `Usuário ${c.usuario}`, turno: f ? turnoSepDoCadastro(f.turno) : null };
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
    divergenciasTurno,
    individual,
  };
}
