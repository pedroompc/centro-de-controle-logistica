import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { listarSetores } from "@/data/setores";
import { serieEfetivoMensal, registrarFotoEfetivoSetor } from "@/data/efetivo-mensal";
import { fotoAtual, composicaoFolha, fotoSetorAtual } from "@/domain/efetivo";
import { absenteismoPorMes } from "@/domain/absenteismo-mensal";
import { custoDoSetor } from "@/domain/metrics";
import { variacaoPercentual } from "@/domain/tendencias";
import { formatBRL, formatPercent } from "@/domain/format";
import { primeiroDiaDoMes, mesAnterior, INICIO_HISTORICO } from "@/domain/periodo";
import { Card, SectionTitle } from "@/components/ui";
import { CORES, KpiCard, type Delta } from "../widgets";
import { EvolucaoChart, type SeriePainel } from "../evolucao-chart";
import { TendenciasTabs } from "../tabs";

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (mes: string) => {
  const [ano, m] = mes.split("-").map(Number);
  return `${MES_ABREV[m - 1]}/${String(ano).slice(2)}`;
};

const inteiro = new Intl.NumberFormat("pt-BR");
const pctComSinal = (frac: number) => `${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))}`;
const absComSinal = (n: number) => `${n >= 0 ? "+" : "−"}${inteiro.format(Math.abs(n))}`;

// Variação em CONTAGEM (nº de pessoas): mostra "+3"/"−2", não %.
const deltaAbs = (dif: number, subirEhBom: boolean): Delta => ({
  texto: absComSinal(dif),
  subindo: dif > 0,
  positivo: subirEhBom ? dif >= 0 : dif <= 0,
});
// Variação da folha (R$): custo subindo é ruim (rose); caindo é neutro.
const deltaCustoPct = (frac: number): Delta => ({
  texto: pctComSinal(frac),
  subindo: frac > 0,
  positivo: frac <= 0,
});

/** Meses da janela (mais antigo → mais novo), do histórico até o mês corrente. */
function janelaMeses(qtd: number): string[] {
  const arr: string[] = [];
  let m = primeiroDiaDoMes();
  for (let i = 0; i < qtd; i++) {
    if (m < INICIO_HISTORICO) break;
    arr.push(m);
    m = mesAnterior(m);
  }
  return arr.reverse();
}

const IcPessoas = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 20a5.2 5.2 0 0 0-3-4.7" /></svg>
);
const IcFolha = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" /></svg>
);
const IcAfastado = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.2" /><path d="M6 20a6 6 0 0 1 12 0" /><path d="m4 4 16 16" /></svg>
);
const IcFalta = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /><path d="m9.5 13.5 5 4M14.5 13.5l-5 4" /></svg>
);

function Cabecalho() {
  return (
    <div className="space-y-4">
      <TendenciasTabs />
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-[#141a4d]">
          Efetivos · pessoas e folha
        </h1>
        <p className="mt-1 text-sm text-slate-500">Efetivo, folha e absenteísmo — foto do mês e evolução</p>
      </div>
    </div>
  );
}

export default async function EfetivosTendenciaPage() {
  const [funcionarios, faltas, setores] = await Promise.all([
    listarFuncionarios(),
    listarFaltas(),
    listarSetores(),
  ]);

  const foto = fotoAtual(funcionarios);

  // Congela a foto do mês corrente por setor (best-effort) antes de ler a série,
  // para o mês atual já entrar na curva.
  await registrarFotoEfetivoSetor(fotoSetorAtual(funcionarios, setores));
  const snapshots = await serieEfetivoMensal(12);

  // Absenteísmo mês a mês (comparativo real — faltas têm data).
  const meses = janelaMeses(12);
  const absent = absenteismoPorMes(faltas, meses);
  const rotulosAbs = meses.map(rotuloMes);
  const vAbs = absent.map((p) => p.total);
  const absAtual = absent[absent.length - 1];
  const absAnt = absent[absent.length - 2];
  const dAbs = deltaAbs(absAtual && absAnt ? absAtual.total - absAnt.total : 0, false);

  // Deltas do efetivo/folha a partir das fotos (quando já há duas).
  const snapAtual = snapshots[snapshots.length - 1];
  const snapAnt = snapshots[snapshots.length - 2];
  const temSnapHist = Boolean(snapAtual && snapAnt);

  const dAtivos = deltaAbs(temSnapHist ? snapAtual.ativos - snapAnt.ativos : 0, true);
  const dAfast = deltaAbs(temSnapHist ? snapAtual.afastados - snapAnt.afastados : 0, false);
  const dFolha = deltaCustoPct(temSnapHist ? variacaoPercentual(snapAtual.folhaTotal, snapAnt.folhaTotal) : 0);

  // Sparklines: usa o histórico de fotos; se ainda não há, o ponto de hoje.
  const vAtivos = snapshots.length ? snapshots.map((s) => s.ativos) : [foto.ativos];
  const vFolha = snapshots.length ? snapshots.map((s) => s.folhaTotal) : [foto.folhaTotal];
  const vAfast = snapshots.length ? snapshots.map((s) => s.afastados) : [foto.afastados];

  // Efetivo por setor (foto do agora): headcount ativo + folha, maior folha 1º.
  const porSetor = setores
    .map((s) => ({
      nome: s.nome,
      ativos: funcionarios.filter((f) => f.setorId === s.id && f.status === "ativo").length,
      folha: custoDoSetor(funcionarios, s.id),
    }))
    .filter((s) => s.ativos > 0 || s.folha > 0)
    .sort((a, b) => b.folha - a.folha);
  const maxFolhaSetor = Math.max(1, ...porSetor.map((s) => s.folha));

  const composicao = composicaoFolha(funcionarios);
  const somaComposicao = composicao.reduce((t, i) => t + i.valor, 0);

  const temTrilhaSnap = snapshots.length >= 2;
  const seriesEvolucao: SeriePainel[] = [
    { nome: "Efetivo ativo", cor: CORES.pdv, valores: snapshots.map((s) => s.ativos), abs: snapshots.map((s) => inteiro.format(s.ativos)) },
    { nome: "Folha (ativos)", cor: CORES.venda, valores: snapshots.map((s) => s.folhaTotal), abs: snapshots.map((s) => formatBRL(s.folhaTotal)) },
  ];
  const rotulosSnap = snapshots.map((s) => rotuloMes(s.mes));

  return (
    <div className="space-y-8">
      <Cabecalho />

      {/* KPIs — foto do mês corrente */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icone={IcPessoas} nome="Efetivo ativo" valor={inteiro.format(foto.ativos)} delta={dAtivos} valores={vAtivos} cor={CORES.pdv} />
        <KpiCard icone={IcFolha} nome="Folha (ativos)" valor={formatBRL(foto.folhaTotal)} delta={dFolha} valores={vFolha} cor={CORES.venda} />
        <KpiCard icone={IcAfastado} nome="Afastados" valor={inteiro.format(foto.afastados)} delta={dAfast} valores={vAfast} cor="#8b5cf6" />
        <KpiCard icone={IcFalta} nome="Absenteísmo do mês" valor={inteiro.format(absAtual?.total ?? 0)} delta={dAbs} valores={vAbs} cor="#c2820a" />
      </div>

      {/* Absenteísmo mês a mês — o comparativo real */}
      <Card className="p-6">
        <div className="mb-4">
          <SectionTitle>Absenteísmo mês a mês</SectionTitle>
          <p className="text-xs text-slate-400">
            Ausências reais (injustificada + justificada + atestado) por mês. Folga e férias ficam fora.
          </p>
        </div>
        <EvolucaoChart
          rotulos={rotulosAbs}
          series={[{ nome: "Ausências no mês", cor: "#c2820a", valores: vAbs, abs: vAbs.map((v) => inteiro.format(v)) }]}
        />
        {absAtual && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
            <span>Detalhe de {rotulosAbs[rotulosAbs.length - 1]}:</span>
            <span>Injustificada <b className="tabular-nums text-[#141a4d]">{absAtual.porTipo.injustificada}</b></span>
            <span>Justificada <b className="tabular-nums text-[#141a4d]">{absAtual.porTipo.justificada}</b></span>
            <span>Atestado <b className="tabular-nums text-[#141a4d]">{absAtual.porTipo.atestado}</b></span>
            <span>Folga <b className="tabular-nums text-[#141a4d]">{absAtual.porTipo.folga}</b></span>
            <span>Férias <b className="tabular-nums text-[#141a4d]">{absAtual.porTipo.ferias}</b></span>
          </div>
        )}
      </Card>

      {/* Evolução do efetivo/folha (fotos mensais) */}
      <Card className="p-6">
        <div className="mb-4">
          <SectionTitle>Evolução do efetivo e da folha</SectionTitle>
          <p className="text-xs text-slate-400">
            {temTrilhaSnap
              ? `Fotos mensais, ${rotulosSnap[0]} a ${rotulosSnap[rotulosSnap.length - 1]}.`
              : "A curva começa a acumular a partir de agora — cada mês registra uma foto do efetivo."}
          </p>
        </div>
        {temTrilhaSnap ? (
          <EvolucaoChart rotulos={rotulosSnap} series={seriesEvolucao} />
        ) : (
          <p className="text-sm text-slate-600">
            Hoje: <b className="tabular-nums text-[#141a4d]">{inteiro.format(foto.ativos)}</b> ativos e{" "}
            <b className="tabular-nums text-[#141a4d]">{formatBRL(foto.folhaTotal)}</b> de folha. A comparação
            mês a mês aparece assim que houver ao menos duas fotos mensais.
          </p>
        )}
      </Card>

      {/* Efetivo por setor + Composição da folha */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Efetivo por setor</SectionTitle>
          <div className="mt-3 space-y-3">
            {porSetor.length === 0 && <p className="text-sm text-slate-500">Sem efetivo ativo cadastrado.</p>}
            {porSetor.map((s) => (
              <div key={s.nome} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm text-slate-600" title={s.nome}>{s.nome}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                  <div className="h-full rounded-md" style={{ width: `${Math.max(6, (s.folha / maxFolhaSetor) * 100)}%`, backgroundColor: CORES.venda }} />
                </div>
                <span className="w-14 shrink-0 text-right text-xs font-medium tabular-nums text-slate-500">{s.ativos} pes.</span>
                <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums text-[#141a4d]">{formatBRL(s.folha)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle>Composição da folha</SectionTitle>
          <p className="text-xs text-slate-400">Rubricas informadas dos ativos.</p>
          <dl className="mt-2 divide-y divide-slate-100">
            {composicao.length === 0 && <p className="py-3 text-sm text-slate-500">Sem detalhamento de rubricas importado.</p>}
            {composicao.map((i) => (
              <div key={i.chave} className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-500">{i.label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(i.valor)}</dd>
              </div>
            ))}
          </dl>
          {composicao.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Soma das rubricas informadas: <b className="tabular-nums text-slate-600">{formatBRL(somaComposicao)}</b>.
              Pode não bater com a folha total — parte do efetivo não tem o detalhamento gravado.
            </p>
          )}
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Fonte: cadastro de funcionários e faltas. O histórico de efetivo/folha é uma foto mensal registrada a
        partir de agora (o cadastro não guarda data de desligamento, então o passado não é reconstruível).
      </p>
    </div>
  );
}
