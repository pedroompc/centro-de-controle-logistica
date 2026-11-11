// Retorno ao estoque das devoluções: o caminho físico de cada nota devolvida
// dentro do Harpia (WMS), depois que ela entrou no Winthor.
//
//   D1131 cria o PROTOCOLO (1 por nota de devolução)
//   B311  conferência por coletor — feita por AGRUPAMENTO (a devolução de um
//         motorista: vários protocolos numa planilha consolidada por mercadoria)
//   216   acondicionamento: crachá impresso = mercadoria no endereço
//   D1132 retorno ao ERP com o estado da mercadoria (avaria ou não) = finalizado
//
// Divergência (não conformidade + / −) só existe na planilha ENQUANTO o
// agrupamento está aberto: nos finalizados o Harpia deixa falta/sobra zeradas.
// O histórico de divergência dos finalizados está PENDENTE (ver docs/BACKLOG.md).

/** Um protocolo (nota de devolução) com as marcas de tempo de cada etapa. */
export interface ProtocoloDevolucao {
  protocolo: number;
  grupo: number | null; // agrupamento (planilha de conferência)
  rotulo: string | null; // nome do agrupamento no Harpia (em geral o motorista)
  notaDevolucao: number | null;
  valor: number;
  codcli: number | null;
  cliente: string | null;
  pedido: number | null; // pedido da venda de origem
  carga: number | null; // NUMCAR da venda de origem
  codMotorista: number | null;
  motorista: string | null;
  criado: string | null; // "yyyy-mm-dd hh:mi" (D1131)
  finalizado: boolean; // D1132 já devolveu ao ERP
  noPeriodo: boolean; // criado dentro do período escolhido
  horasAberto: number | null; // agora − criado
  horasAteConferir: number | null; // criado → 1º bipe na B311
  horasAteEndereco: number | null; // criado → 1º crachá/endereço na 216
  horasAteFinalizar: number | null; // criado → D1132
  itens: number;
  itensAvaria: number;
  qtdAvaria: number;
}

/** Estado atual da planilha de conferência de um agrupamento. */
export interface PlanilhaAgrupamento {
  grupo: number;
  itens: number;
  itensConferidos: number;
  itensDivergentes: number;
  itensFalta: number; // não conformidade para menos
  itensSobra: number; // não conformidade para mais
  qtdFalta: number;
  qtdSobra: number;
}

export type EtapaProtocolo =
  | "aguardando_conferencia"
  | "conferencia_parcial"
  | "com_divergencia"
  | "aguardando_endereco"
  | "no_endereco";

export const ETAPAS: { id: EtapaProtocolo; rotulo: string; dica: string }[] = [
  { id: "aguardando_conferencia", rotulo: "Aguardando conferência", dica: "Protocolo criado (D1131), ainda sem bipe na B311" },
  { id: "conferencia_parcial", rotulo: "Conferência parcial", dica: "Agrupamento com itens ainda não conferidos na B311" },
  { id: "com_divergencia", rotulo: "Com divergência", dica: "Conferido com não conformidade (+ sobra / − falta) na planilha" },
  { id: "aguardando_endereco", rotulo: "Conferido · sem endereço", dica: "Conferido, mas sem crachá/endereço na 216 — mercadoria fora do lugar" },
  { id: "no_endereco", rotulo: "No endereço · a finalizar", dica: "Mercadoria no endereço (216), falta o retorno ao ERP (D1132)" },
];

/** Aberto há mais que isso sai da lista do dia a dia (são restos antigos do sistema). */
export const HORAS_ANTIGO = 60 * 24;

export function etapaDo(p: ProtocoloDevolucao, plan: PlanilhaAgrupamento | undefined): EtapaProtocolo {
  if (plan && (plan.itensDivergentes > 0 || plan.itensFalta + plan.itensSobra > 0)) return "com_divergencia";
  if (p.horasAteEndereco != null) return "no_endereco";
  if (plan && plan.itensConferidos > 0 && plan.itensConferidos < plan.itens) return "conferencia_parcial";
  if (p.horasAteConferir != null || (plan && plan.itensConferidos > 0)) return "aguardando_endereco";
  return "aguardando_conferencia";
}

export interface ProtocoloAberto extends ProtocoloDevolucao {
  etapa: EtapaProtocolo;
  divergencia: PlanilhaAgrupamento | null; // planilha do agrupamento, se tem não conformidade
}

export interface ResumoEtapa {
  etapa: EtapaProtocolo;
  protocolos: number;
  valor: number;
}

export interface TemposProtocolo {
  finalizados: number; // criados no período e já finalizados
  medianaHorasFinalizar: number | null;
  mediaHorasFinalizar: number | null;
  medianaHorasConferir: number | null;
  medianaHorasEndereco: number | null;
  semEndereco: number; // finalizados sem crachá/endereço registrado na 216
  enderecoDepois: number; // finalizados cujo endereço só veio DEPOIS do D1132
}

export interface MotoristaProtocolos {
  chave: string;
  codMotorista: number | null;
  nome: string;
  protocolos: number; // criados no período
  abertos: number; // abertos agora (recentes)
  comDivergencia: number; // abertos agora em agrupamento com não conformidade
  itensFalta: number;
  itensSobra: number;
  itensAvaria: number; // período
  qtdAvaria: number; // período
  medianaHorasFinalizar: number | null;
}

export interface RelatorioProtocolos {
  abertos: ProtocoloAberto[]; // recentes, mais antigos primeiro
  porEtapa: ResumoEtapa[];
  agrupamentosAbertos: number;
  valorAberto: number;
  antigos: number; // abertos há mais de HORAS_ANTIGO
  valorAntigos: number;
  tempos: TemposProtocolo;
  avaria: { protocolos: number; itens: number; qtd: number }; // criados no período
  criadosNoPeriodo: number;
  motoristas: MotoristaProtocolos[];
}

export function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const media = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const num = (xs: (number | null)[]): number[] => xs.filter((x): x is number => x != null);

export function montarRelatorio(protocolos: ProtocoloDevolucao[], planilhas: PlanilhaAgrupamento[]): RelatorioProtocolos {
  const plan = new Map(planilhas.map((p) => [p.grupo, p]));
  const planDo = (p: ProtocoloDevolucao) => (p.grupo == null ? undefined : plan.get(p.grupo));

  const abertosTodos = protocolos.filter((p) => !p.finalizado);
  const antigos = abertosTodos.filter((p) => (p.horasAberto ?? 0) > HORAS_ANTIGO);
  const abertos: ProtocoloAberto[] = abertosTodos
    .filter((p) => (p.horasAberto ?? 0) <= HORAS_ANTIGO)
    .map((p) => {
      const pl = planDo(p);
      const etapa = etapaDo(p, pl);
      return { ...p, etapa, divergencia: etapa === "com_divergencia" && pl ? pl : null };
    })
    .sort((a, b) => (b.horasAberto ?? 0) - (a.horasAberto ?? 0));

  const porEtapa: ResumoEtapa[] = ETAPAS.map(({ id }) => {
    const da = abertos.filter((p) => p.etapa === id);
    return { etapa: id, protocolos: da.length, valor: da.reduce((t, p) => t + p.valor, 0) };
  });

  const doPeriodo = protocolos.filter((p) => p.noPeriodo);
  const fin = doPeriodo.filter((p) => p.finalizado);
  const tempos: TemposProtocolo = {
    finalizados: fin.length,
    medianaHorasFinalizar: mediana(num(fin.map((p) => p.horasAteFinalizar))),
    mediaHorasFinalizar: media(num(fin.map((p) => p.horasAteFinalizar))),
    medianaHorasConferir: mediana(num(fin.map((p) => p.horasAteConferir))),
    medianaHorasEndereco: mediana(num(fin.map((p) => p.horasAteEndereco))),
    semEndereco: fin.filter((p) => p.horasAteEndereco == null).length,
    enderecoDepois: fin.filter(
      (p) => p.horasAteEndereco != null && p.horasAteFinalizar != null && p.horasAteEndereco > p.horasAteFinalizar,
    ).length,
  };

  const comAvaria = doPeriodo.filter((p) => p.itensAvaria > 0);
  const avaria = {
    protocolos: comAvaria.length,
    itens: comAvaria.reduce((t, p) => t + p.itensAvaria, 0),
    qtd: comAvaria.reduce((t, p) => t + p.qtdAvaria, 0),
  };

  // Motorista: da carga da venda de origem (Winthor); sem venda (avulsa), o
  // nome do agrupamento no Harpia.
  const chaveDe = (p: ProtocoloDevolucao) =>
    p.codMotorista != null ? `m${p.codMotorista}` : `g${p.rotulo ?? "sem motorista"}`;
  const mot = new Map<string, MotoristaProtocolos & { _fin: number[] }>();
  const pegar = (p: ProtocoloDevolucao) => {
    const k = chaveDe(p);
    let m = mot.get(k);
    if (!m) {
      m = {
        chave: k,
        codMotorista: p.codMotorista,
        nome: p.motorista ?? p.rotulo ?? "Sem motorista",
        protocolos: 0, abertos: 0, comDivergencia: 0, itensFalta: 0, itensSobra: 0,
        itensAvaria: 0, qtdAvaria: 0, medianaHorasFinalizar: null, _fin: [],
      };
      mot.set(k, m);
    }
    return m;
  };
  for (const p of doPeriodo) {
    const m = pegar(p);
    m.protocolos++;
    m.itensAvaria += p.itensAvaria;
    m.qtdAvaria += p.qtdAvaria;
    if (p.finalizado && p.horasAteFinalizar != null) m._fin.push(p.horasAteFinalizar);
  }
  const gruposDiv = new Set<number>(); // a planilha é do agrupamento: conta 1 vez por motorista
  for (const p of abertos) {
    const m = pegar(p);
    m.abertos++;
    if (p.divergencia) {
      m.comDivergencia++;
      if (!gruposDiv.has(p.divergencia.grupo)) {
        gruposDiv.add(p.divergencia.grupo);
        m.itensFalta += p.divergencia.itensFalta;
        m.itensSobra += p.divergencia.itensSobra;
      }
    }
  }
  const motoristas = [...mot.values()]
    .map(({ _fin, ...m }) => ({ ...m, medianaHorasFinalizar: mediana(_fin) }))
    .sort((a, b) => b.comDivergencia - a.comDivergencia || b.itensAvaria - a.itensAvaria || b.abertos - a.abertos || b.protocolos - a.protocolos);

  return {
    abertos,
    porEtapa,
    agrupamentosAbertos: new Set(abertos.map((p) => p.grupo ?? -p.protocolo)).size,
    valorAberto: abertos.reduce((t, p) => t + p.valor, 0),
    antigos: antigos.length,
    valorAntigos: antigos.reduce((t, p) => t + p.valor, 0),
    tempos,
    avaria,
    criadosNoPeriodo: doPeriodo.length,
    motoristas,
  };
}

/** "3 d 4 h" / "5 h" / "40 min". */
export function formatHoras(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `${Math.round(h)} h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h - d * 24);
  return r ? `${d} d ${r} h` : `${d} d`;
}
