"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, PanelHeader, StatCard } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import {
  ETAPAS,
  formatHoras,
  type EtapaProtocolo,
  type ProtocoloAberto,
  type RelatorioProtocolos,
} from "@/domain/devolucoes-protocolos";
import { carregarProtocolos } from "./actions";
import { IconeCaminhao, IconeEtiqueta } from "./icons";

const inteiro = new Intl.NumberFormat("pt-BR");
const LIMITE_LISTA = 200;

// Sem verde (verde é só receita): etapas em navy/âmbar/rose/cinza.
const COR_ETAPA: Record<EtapaProtocolo, { barra: string; pill: string }> = {
  aguardando_conferencia: { barra: "bg-slate-300", pill: "bg-slate-100 text-slate-600" },
  conferencia_parcial: { barra: "bg-amber-300", pill: "bg-amber-50 text-amber-700" },
  com_divergencia: { barra: "bg-rose-500", pill: "bg-rose-50 text-rose-700" },
  aguardando_endereco: { barra: "bg-amber-500", pill: "bg-amber-100 text-amber-800" },
  no_endereco: { barra: "bg-[#1b2168]", pill: "bg-[#eef0fb] text-[#1b2168]" },
};
const rotuloEtapa = (e: EtapaProtocolo) => ETAPAS.find((x) => x.id === e)?.rotulo ?? e;

function Pill({ etapa }: { etapa: EtapaProtocolo }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR_ETAPA[etapa].pill}`}
      title={ETAPAS.find((x) => x.id === etapa)?.dica}
    >
      {rotuloEtapa(etapa)}
    </span>
  );
}

function Divergencia({ p }: { p: ProtocoloAberto }) {
  if (!p.divergencia) return <span className="text-slate-300">—</span>;
  const d = p.divergencia;
  return (
    <span
      className="whitespace-nowrap text-xs font-semibold tabular-nums"
      title={`Planilha do agrupamento: ${d.itensFalta} itens com falta (${d.qtdFalta} un.) · ${d.itensSobra} com sobra (${d.qtdSobra} un.)`}
    >
      {d.itensFalta > 0 && <span className="text-rose-600">−{d.itensFalta}</span>}
      {d.itensFalta > 0 && d.itensSobra > 0 && " "}
      {d.itensSobra > 0 && <span className="text-amber-600">+{d.itensSobra}</span>}
      {d.itensFalta + d.itensSobra === 0 && <span className="text-rose-600">!</span>}
    </span>
  );
}

function ListaAbertos({ abertos }: { abertos: ProtocoloAberto[] }) {
  const [etapa, setEtapa] = useState<EtapaProtocolo | "">("");
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return abertos.filter(
      (p) =>
        (!etapa || p.etapa === etapa) &&
        (!q ||
          [p.motorista, p.rotulo, p.cliente, p.protocolo, p.carga, p.pedido, p.notaDevolucao]
            .some((v) => v != null && String(v).toLowerCase().includes(q))),
    );
  }, [abertos, etapa, busca]);
  const mostrados = filtrados.slice(0, LIMITE_LISTA);

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeEtiqueta />}
        tone="gold"
        title="Protocolos em aberto"
        context={`${inteiro.format(filtrados.length)} protocolos · ${formatBRL(filtrados.reduce((t, p) => t + p.valor, 0))} · mais antigos primeiro`}
        right={
          <div className="flex flex-wrap gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Motorista, cliente, carga, pedido…"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-base outline-none focus:border-amber-400 sm:w-56 sm:text-sm"
            />
            <select
              value={etapa}
              onChange={(e) => setEtapa(e.target.value as EtapaProtocolo | "")}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-base sm:text-sm"
            >
              <option value="">Todas as etapas</option>
              {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
            </select>
          </div>
        }
      />
      {mostrados.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Nenhum protocolo em aberto.</p>
      ) : (
        <>
          <div className="hidden max-h-[32rem] overflow-auto md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-semibold">Protocolo</th>
                  <th className="px-3 py-2 font-semibold">Motorista</th>
                  <th className="px-3 py-2 font-semibold">Carga</th>
                  <th className="px-3 py-2 font-semibold">Pedido</th>
                  <th className="px-3 py-2 font-semibold">NF dev.</th>
                  <th className="px-3 py-2 font-semibold">Cliente</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                  <th className="px-3 py-2 text-right font-semibold">Aberto há</th>
                  <th className="px-3 py-2 font-semibold">Etapa</th>
                  <th className="px-4 py-2 text-right font-semibold" title="Não conformidade da planilha do agrupamento: − falta · + sobra (itens)">Diverg.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mostrados.map((p) => (
                  <tr key={p.protocolo} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-medium tabular-nums text-[#141a4d]" title={p.criado ? `Criado em ${p.criado}` : undefined}>{p.protocolo}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-slate-600" title={p.rotulo ? `Agrupamento ${p.grupo} · ${p.rotulo}` : undefined}>{p.motorista ?? p.rotulo ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">{p.carga ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">{p.pedido ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">{p.notaDevolucao ?? "—"}</td>
                    <td className="max-w-[14rem] truncate px-3 py-2 text-slate-600" title={p.cliente ?? undefined}>{p.cliente ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#141a4d]">{formatBRL(p.valor)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatHoras(p.horasAberto)}</td>
                    <td className="px-3 py-2"><Pill etapa={p.etapa} /></td>
                    <td className="px-4 py-2 text-right"><Divergencia p={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {mostrados.map((p) => (
              <div key={p.protocolo} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#141a4d]">{p.motorista ?? p.rotulo ?? "—"}</div>
                    <div className="truncate text-xs text-slate-500">{p.cliente ?? "—"}</div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(p.valor)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-slate-500">
                  <Pill etapa={p.etapa} />
                  <span>há {formatHoras(p.horasAberto)}</span>
                  <span>prot. {p.protocolo}</span>
                  {p.carga != null && <span>carga {p.carga}</span>}
                  {p.pedido != null && <span>ped. {p.pedido}</span>}
                  <Divergencia p={p} />
                </div>
              </div>
            ))}
          </div>
          {filtrados.length > LIMITE_LISTA && (
            <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
              Mostrando {LIMITE_LISTA} de {inteiro.format(filtrados.length)} — use a busca ou a etapa para achar o resto.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function TabelaMotoristasProtocolos({ r }: { r: RelatorioProtocolos }) {
  const linhas = r.motoristas.filter((m) => m.protocolos + m.abertos > 0);
  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeCaminhao />}
        title="Motoristas · retorno ao estoque"
        context="divergência = agrupamentos abertos agora · avaria e tempo = protocolos do período"
        right={
          <span
            className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
            title="O Harpia zera falta/sobra quando o protocolo é finalizado. O histórico de não conformidade dos finalizados está pendente: por enquanto a coluna mostra só os agrupamentos ainda abertos."
          >
            Divergência: só abertos (pendente)
          </span>
        }
      />
      {linhas.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Sem protocolos no período.</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Motorista</th>
                <th className="px-3 py-2 text-right font-semibold" title="Protocolos criados no período">Protocolos</th>
                <th className="px-3 py-2 text-right font-semibold" title="Protocolos abertos agora">Abertos</th>
                <th className="px-3 py-2 text-right font-semibold" title="Abertos em agrupamento com não conformidade · itens − falta / + sobra">Com diverg.</th>
                <th className="px-3 py-2 text-right font-semibold" title="Itens avariados (unidades) nos protocolos do período">Avaria</th>
                <th className="px-4 py-2 text-right font-semibold" title="Mediana do tempo entre o protocolo (D1131) e a finalização (D1132)">Até finalizar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((m) => (
                <tr key={m.chave} className="hover:bg-slate-50/60">
                  <td className="max-w-[16rem] truncate px-4 py-2 font-medium text-[#141a4d]" title={m.codMotorista != null ? `Matrícula ${m.codMotorista}` : "Sem venda de origem — nome do agrupamento no Harpia"}>{m.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{m.protocolos || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{m.abertos || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.comDivergencia ? (
                      <span className="font-semibold text-rose-600">
                        {m.comDivergencia}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          {m.itensFalta > 0 && `−${m.itensFalta}`}{m.itensFalta > 0 && m.itensSobra > 0 && " "}{m.itensSobra > 0 && `+${m.itensSobra}`}
                        </span>
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                    {m.itensAvaria ? <>{m.itensAvaria} <span className="text-xs text-slate-400">({inteiro.format(m.qtdAvaria)} un.)</span></> : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{formatHoras(m.medianaHorasFinalizar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function SecaoProtocolos({ de, ate }: { de: string; ate: string }) {
  const [r, setR] = useState<RelatorioProtocolos | null>(null);
  const [erro, setErro] = useState(false);
  const [aba, setAba] = useState<"abertos" | "motoristas">("abertos");

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      setR(await carregarProtocolos({ de, ate }));
    } catch {
      setErro(true);
    }
  }, [de, ate]);

  // Busca sob demanda ao montar (mesmo padrão das abas acima): o setState faz
  // parte do fluxo, por isso a regra de "setState no efeito" é dispensada.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const t = r?.tempos;
  const semEndereco = r?.porEtapa.find((e) => e.etapa === "aguardando_endereco");
  const totalAbertos = Math.max(1, r?.abertos.length ?? 0);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline gap-3">
        <h2
          className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]"
          title="Protocolos de devolução no Harpia: D1131 cria → B311 confere → 216 endereça (crachá) → D1132 finaliza. Em aberto = agora; tempos e avaria = protocolos criados no período."
        >
          Retorno ao estoque
        </h2>
        <span className="text-xs text-slate-400">protocolos Harpia</span>
      </div>

      {erro ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-sm text-slate-500">
          Não foi possível ler os protocolos do Harpia.
          <button onClick={carregar} className="rounded-lg bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            Tentar de novo
          </button>
        </Card>
      ) : !r ? (
        <Card className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
          Carregando protocolos…
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Em aberto"
              value={inteiro.format(r.abertos.length)}
              hint={`${formatBRL(r.valorAberto)} · ${inteiro.format(r.agrupamentosAbertos)} agrupamentos`}
              accent="navy"
              title={r.antigos ? `Fora da conta: ${inteiro.format(r.antigos)} protocolos abertos há mais de 60 dias (${formatBRL(r.valorAntigos)})` : undefined}
            />
            <StatCard
              label="Conferido · sem endereço"
              value={inteiro.format(semEndereco?.protocolos ?? 0)}
              hint={`${formatBRL(semEndereco?.valor ?? 0)} fora do lugar`}
              accent="red"
              title="Já bipado na B311, sem crachá/endereço na 216"
            />
            <StatCard
              label="Tempo até finalizar"
              value={formatHoras(t?.medianaHorasFinalizar ?? null)}
              hint={`mediana · média ${formatHoras(t?.mediaHorasFinalizar ?? null)} · ${inteiro.format(t?.finalizados ?? 0)} finalizados`}
              accent="gold"
              title={`Até conferir: ${formatHoras(t?.medianaHorasConferir ?? null)} · até o endereço: ${formatHoras(t?.medianaHorasEndereco ?? null)} (medianas, protocolos criados no período)`}
            />
            <StatCard
              label="Finalizado sem endereço"
              value={inteiro.format(t?.semEndereco ?? 0)}
              hint={`de ${inteiro.format(t?.finalizados ?? 0)} · ${inteiro.format(t?.enderecoDepois ?? 0)} endereçados só depois`}
              accent="red"
              hintRuim={(t?.semEndereco ?? 0) > 0}
              title="Finalizado (D1132) sem crachá/endereço na 216 = sem prova de que voltou ao lugar. 'Só depois' = endereço registrado após a finalização."
            />
          </div>

          <Card className="mt-4 p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#141a4d]">Onde estão os protocolos abertos</h3>
              <span
                className="text-xs tabular-nums text-slate-500"
                title="Itens com quantidade avariada gravada na 216, nos protocolos criados no período"
              >
                avaria no período: {inteiro.format(r.avaria.itens)} itens · {inteiro.format(r.avaria.qtd)} un. · {inteiro.format(r.avaria.protocolos)} protocolos
              </span>
            </div>
            <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
              {r.porEtapa.map((e) => (
                <div
                  key={e.etapa}
                  className={`crescer-x ${COR_ETAPA[e.etapa].barra}`}
                  style={{ width: `${(e.protocolos / totalAbertos) * 100}%` }}
                  title={`${rotuloEtapa(e.etapa)}: ${e.protocolos}`}
                />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {r.porEtapa.map((e) => (
                <div key={e.etapa} className="rounded-lg border border-slate-200 p-3" title={ETAPAS.find((x) => x.id === e.etapa)?.dica}>
                  <Pill etapa={e.etapa} />
                  <div className="mt-2 font-[family-name:var(--font-sora)] text-lg font-extrabold leading-none tabular-nums text-[#141a4d]">
                    {inteiro.format(e.protocolos)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{formatBRL(e.valor)}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="mb-4 mt-6 flex gap-1.5" role="tablist" aria-label="Retorno ao estoque">
            {([["abertos", "Em aberto"], ["motoristas", "Motoristas"]] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                  aba === id ? "border-[#181d55] bg-[#181d55] text-white" : "border-slate-200 bg-white text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {aba === "abertos" ? <ListaAbertos abertos={r.abertos} /> : <TabelaMotoristasProtocolos r={r} />}
        </>
      )}
    </section>
  );
}
