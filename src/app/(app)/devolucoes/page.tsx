import Link from "next/link";
import { getNucleoDevolucao, getResumoCoorteFaturamento, listarMotivosDoMes, nomeCidadePE } from "@/data/devolucoes";
import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { taxaDevolucao, taxaDevolucaoNotas } from "@/domain/faturamento";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { baseDevolucao } from "@/domain/devolucoes-dia-semana";
import { primeiroDiaDoMes, formatMesAno, inicioFimDoMes, limitarAoHistorico } from "@/domain/periodo";
import type { SetorDevolucao } from "@/domain/devolucoes";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";
import SecoesDevolucao from "./secoes-devolucao";

const SETORES: SetorDevolucao[] = ["Logística", "Comercial", "Faturamento", "Não classificado"];

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

// Cor da barra/etiqueta por setor responsável.
const CORES: Record<SetorDevolucao, { barra: string; pill: string }> = {
  "Logística": { barra: "bg-[#1b2168]", pill: "bg-[#eef0fb] text-[#1b2168]" },
  "Comercial": { barra: "bg-amber-400", pill: "bg-amber-50 text-amber-700" },
  "Faturamento": { barra: "bg-rose-400", pill: "bg-rose-50 text-rose-700" },
  "Não classificado": { barra: "bg-slate-300", pill: "bg-slate-100 text-slate-500" },
};


export default async function DevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; motivo?: string; setor?: string; cidade?: string; base?: string }>;
}) {
  const sp = await searchParams;
  const mesSel = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mesSel < primeiroDiaDoMes();
  // Intervalo do mês inteiro; no mês corrente não há devolução datada no futuro,
  // então o `fim` no fim do mês equivale a "1º → hoje".
  const { inicio, fim } = inicioFimDoMes(mesSel);
  const motivo = sp.motivo || undefined;
  const setor = sp.setor || undefined;
  // Cidade escolhida no mapa (IBGE de 7 dígitos de PE) e base de data da análise.
  const cidadeNome = sp.cidade && /^\d{7}$/.test(sp.cidade) ? nomeCidadePE(sp.cidade) : undefined;
  const ibge = cidadeNome ? sp.cidade : undefined;
  const base = baseDevolucao(sp.base);
  const temFiltro = Boolean(motivo || setor || ibge);

  // SSR busca só o NÚCLEO (leve): total, por setor e a lista de motivos. As abas
  // pesadas (clientes/vendedores/motoristas/mapa) carregam sob demanda no cliente.
  const porFaturamento = base === "faturamento";
  const [r, fat, motivosDisponiveis, coorte] = await Promise.all([
    getNucleoDevolucao(inicio, fim, motivo, setor, ibge, base),
    getResumoFaturamentoDashboard(mesSel),
    listarMotivosDoMes(inicio, fim, ibge, base),
    porFaturamento ? getResumoCoorteFaturamento(inicio, fim) : Promise.resolve(null),
  ]);
  const mesLabel = `${formatMesAno(mesSel)}${mesFechado ? " · mês fechado" : " · em andamento"}`;

  // Monta URL preservando mês e filtro vigentes; `over` sobrescreve/limpa chaves.
  const url = (over: Record<string, string | undefined> = {}) => {
    const atual: Record<string, string | undefined> = {
      mes: mesFechado ? mesSel : undefined, // mês corrente = URL limpa
      motivo, setor, cidade: ibge, base: base === "faturamento" ? base : undefined, ...over,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/devolucoes?${qs}` : "/devolucoes";
  };

  if (!r) {
    return (
      <div>
        <PageHeader title="Devoluções" subtitle={`${mesLabel} · Winthor`}>
          <MesNav mes={mesSel} hrefFor={(m) => url({ mes: m })} />
        </PageHeader>
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Devoluções indisponíveis para {formatMesAno(mesSel)} — sem conexão com o Winthor (o
            banco só responde de dentro da rede da empresa; meses passados não têm foto
            congelada).
          </p>
        </Card>
      </div>
    );
  }

  const totalSetor = Math.max(1, r.porSetor.reduce((t, s) => t + s.valor, 0));

  return (
    <div>
      <PageHeader title="Devoluções" subtitle={`${mesLabel} · filiais 1 e 11`}>
        <Link
          href={mesFechado ? `/painel?mes=${mesSel}` : "/painel"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          title="Painel em tela cheia — roda o mapa, rankings, a faturar, receitas e descarregos"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="4" width="19" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          Modo TV
        </Link>
        <MesNav mes={mesSel} hrefFor={(m) => url({ mes: m })} />
      </PageHeader>

      {/* Âncora do mês: NÃO reage a motivo/setor/cidade, só à base de data.
          "Data da devolução" = números oficiais da rotina 111; "Dia faturado" =
          das notas saídas no mês, o que voltou até hoje (denominadores = venda
          faturada e NFs emitidas do mesmo mês). A avulsa não tem venda de origem,
          então não tem dia faturado. */}
      {porFaturamento ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Valor devolução"
            value={coorte ? formatBRL(coorte.valor) : "—"}
            hint={mesFechado ? "notas faturadas no mês · devolvidas até hoje" : "notas faturadas no mês · ainda sobe"}
            accent="red"
          />
          <StatCard label="Devolução avulsa" value="—" hint="sem venda de origem · só na data da devolução" accent="navy" />
          <StatCard
            label="Taxa de devolução (valor)"
            value={fat && coorte ? formatPercent(taxaDevolucao({ valorDevolucao: coorte.valor, vendaFaturada: fat.vendaFaturada })) : "—"}
            hint="R$ devolvido / venda faturada do mês"
            accent="gold"
          />
          <StatCard
            label="Taxa de devolução (notas)"
            value={fat && coorte ? formatPercent(taxaDevolucaoNotas({ devolvidas: coorte.notas, emitidas: fat.emitidas })) : "—"}
            hint={fat && coorte ? `${coorte.notas} de ${fat.emitidas} NFs emitidas` : "—"}
            accent="gold"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Valor devolução" value={formatBRL(fat?.valorDevolucao ?? r.total)} hint="rotina 111 · pela data da devolução" accent="red" />
          <StatCard
            label="Devolução avulsa"
            value={fat ? formatBRL(fat.valorDevolucaoAvulsa) : "—"}
            hint={fat ? `${fat.devolvidasAvulsas} NFs · sem venda de origem` : "—"}
            accent="navy"
          />
          <StatCard
            label="Taxa de devolução (valor)"
            value={fat ? formatPercent(taxaDevolucao(fat)) : "—"}
            hint="R$ devolvido / venda faturada"
            accent="gold"
          />
          <StatCard
            label="Taxa de devolução (notas)"
            value={fat ? formatPercent(taxaDevolucaoNotas(fat)) : "—"}
            hint={fat ? `${fat.devolvidas} de ${fat.emitidas} NFs emitidas` : "—"}
            accent="gold"
          />
        </div>
      )}

      <div className="mt-8 mb-4 flex items-baseline gap-3">
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
          Análise · de onde vêm
        </h2>
        {temFiltro && (
          <Link href={url({ motivo: undefined, setor: undefined, cidade: undefined })} className="text-xs font-medium text-amber-600 hover:text-amber-700">limpar filtros</Link>
        )}
        <div
          className="ml-auto inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold"
          role="group"
          aria-label="Base de data da análise"
        >
          <Link
            href={url({ base: undefined })}
            title="Devoluções que entraram no mês (rotina 111)"
            className={`rounded-md px-3 py-1.5 transition ${base === "devolucao" ? "bg-[#181d55] text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            Data da devolução
          </Link>
          <Link
            href={url({ base: "faturamento" })}
            title="Das notas faturadas no mês, as que voltaram até hoje — o mês recente ainda sobe"
            className={`rounded-md px-3 py-1.5 transition ${base === "faturamento" ? "bg-[#181d55] text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            Dia faturado
          </Link>
        </div>
      </div>

      {cidadeNome && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eef0fb] py-1 pl-3 pr-1 text-sm font-semibold text-[#1b2168]">
            Cidade: {cidadeNome}
            <Link
              href={url({ cidade: undefined })}
              aria-label="Remover filtro de cidade"
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#1b2168] transition hover:bg-white"
            >
              ✕
            </Link>
          </span>
        </div>
      )}

      {/* Filtro: motivo/setor vão no SQL e estreitam as três seções. */}
      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap gap-2">
          {/* Preserva o mês selecionado ao submeter o filtro (GET só envia os campos do form). */}
          {mesFechado && <input type="hidden" name="mes" value={mesSel} />}
          <select name="motivo" defaultValue={motivo ?? ""} className={`${inputCls} min-w-[12rem] flex-1`}>
            <option value="">Todos os motivos</option>
            {motivosDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select name="setor" defaultValue={setor ?? ""} className={inputCls}>
            <option value="">Todos os setores</option>
            {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            Filtrar
          </button>
        </form>
      </Card>

      {/* Responsabilidade por setor: barra empilhada + cards clicáveis (filtram). */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#141a4d]">Responsabilidade por setor</h3>
          <span className="text-xs tabular-nums text-slate-500">
            {formatBRL(r.total)} · {formatKg(r.peso)} · {r.porSetor.reduce((t, s) => t + s.notas, 0)} notas
          </span>
        </div>
        <div className="mb-4 flex h-3 overflow-hidden rounded-full">
          {r.porSetor.map((s) => (
            <div
              key={s.setor}
              className={CORES[s.setor].barra}
              style={{ width: `${(s.valor / totalSetor) * 100}%` }}
              title={`${s.setor}: ${((s.valor / totalSetor) * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {r.porSetor.map((s) => {
            const pct = (s.valor / totalSetor) * 100;
            const ativo = setor === s.setor;
            return (
              <Link
                key={s.setor}
                href={url({ setor: ativo ? undefined : s.setor })}
                className={`rounded-lg border p-3 transition hover:shadow-sm ${ativo ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-200"}`}
              >
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CORES[s.setor].pill}`}>
                  {s.setor}
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold leading-none tabular-nums text-[#141a4d]">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">do valor</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{s.notas} notas · {formatBRL(s.valor)}</div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Detalhe em ABAS que carregam SOB DEMANDA (cache por sessão). A `key`
          zera o cache do cliente quando muda o mês ou o filtro. */}
      <SecoesDevolucao
        key={`${mesSel}|${motivo ?? ""}|${setor ?? ""}|${ibge ?? ""}|${base}`}
        mes={mesSel}
        motivo={motivo}
        setor={setor}
        ibge={ibge}
        cidadeNome={cidadeNome}
        base={base}
        porMotivo={r.porMotivo}
      />

      <p className="mt-4 text-xs text-slate-400">
        Os indicadores no topo são sempre o total do mês pela rotina 111 (não reagem a filtro nem
        à base). Motivo, setor, cidade e a base (data da devolução ou dia faturado) estreitam
        todas as abas; no mapa, escolha uma cidade para ver só ela.
      </p>
    </div>
  );
}
