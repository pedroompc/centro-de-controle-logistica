"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, PanelHeader } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import type {
  DevolucaoPorMotivo,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorMotorista,
  SecaoRanking,
} from "@/domain/devolucoes";
import type { CidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";
import { setorPill } from "@/domain/devolucoes-ui";
import { carregarClientes, carregarVendedores, carregarSupervisores, carregarMotoristas, carregarMapa, carregarBairros, carregarDiaSemana } from "./actions";
import type { BaseDevolucao, DevolucaoDiaSemana } from "@/domain/devolucoes-dia-semana";
import PainelDiaSemana from "./painel-dia-semana";
import TabelaMotoristas from "./tabela-motoristas";
import PainelRanking, { type ItemRanking } from "./painel-ranking";
import TabelaBairrosRMR from "./tabela-bairros-rmr";
import MapaLazy from "./mapa-lazy";
import SecaoProtocolos from "./secao-protocolos";
import TabelaSupervisores from "./tabela-supervisores";
import { imprimirRelatorio } from "@/lib/imprimir-relatorio";
import type { RelatorioProtocolos } from "@/domain/devolucoes-protocolos";
import {
  documentoRelatorio,
  resumoDoPeriodo,
  relatorioMotoristas,
  relatorioRanking,
  relatorioSupervisores,
  relatorioMotivos,
  relatorioDiaSemana,
  relatorioCidades,
  relatorioBairros,
  relatorioProtocolos,
} from "@/domain/devolucoes-relatorio";
import type { PastaDevolucao } from "@/domain/devolucoes-supervisor";
import { IconeCaminhao, IconePredio, IconeUsuario, IconeEtiqueta } from "./icons";

type Aba = "motoristas" | "clientes" | "vendedores" | "supervisores" | "motivos" | "dias" | "mapa" | "bairros" | "retorno";

/** Cache client-side das abas já carregadas (some ao trocar mês/filtro via `key`). */
interface Cache {
  clientes?: SecaoRanking<DevolucaoPorCliente>;
  vendedores?: SecaoRanking<DevolucaoPorVendedor>;
  supervisores?: PastaDevolucao[];
  motoristas?: SecaoRanking<DevolucaoPorMotorista>;
  dias?: DevolucaoDiaSemana[];
  mapa?: CidadeDevolucao[];
  bairros?: BairroDevolucao[];
}

function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <Card className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
      {texto}
    </Card>
  );
}

/** Lista "Por motivo" — já vem do núcleo (SSR), então a aba Motivos é instantânea. */
function PainelMotivos({ motivos }: { motivos: DevolucaoPorMotivo[] }) {
  const max = Math.max(1, ...motivos.map((m) => m.valor));
  return (
    <div className="max-h-[30rem] divide-y divide-slate-100 overflow-y-auto">
      {motivos.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Sem devoluções no período.</p>
      ) : (
        motivos.map((m) => {
          const pct = Math.max(2, Math.round((m.valor / max) * 100));
          return (
            <div key={`${m.motivo}-${m.setor}`} className="px-5 py-2.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-[#141a4d]" title={m.motivo}>{m.motivo}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${setorPill(m.setor)}`}>{m.setor}</span>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(m.valor)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#1b2168]" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-slate-400">{m.notas} notas</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function SecoesDevolucao({
  de,
  ate,
  motivo,
  setor,
  ibge,
  cidadeNome,
  base,
  porMotivo,
  periodoLabel,
}: {
  de: string;
  ate: string;
  motivo?: string;
  setor?: string;
  ibge?: string;
  cidadeNome?: string;
  base: BaseDevolucao;
  porMotivo: DevolucaoPorMotivo[];
  periodoLabel: string;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("motoristas");
  const [cache, setCache] = useState<Cache>({});
  const [carregando, setCarregando] = useState<Aba | null>(null);
  const [erro, setErro] = useState<Partial<Record<Aba, boolean>>>({});
  // Retorno ao estoque busca os próprios dados; depois de aberto fica montado
  // (só escondido) para não reler o Harpia a cada troca de aba.
  const [retornoAberto, setRetornoAberto] = useState(false);
  const [protocolos, setProtocolos] = useState<RelatorioProtocolos | null>(null);

  // Busca os dados de uma aba (se ainda não estão em cache). Motivos usa o núcleo
  // (já veio do SSR) e o mapa/rankings vêm por Server Action, guardados no cache.
  const garantir = useCallback(async (alvo: Aba) => {
    if (alvo === "motivos") return;
    if (alvo === "retorno") {
      setRetornoAberto(true);
      return;
    }
    if (cache[alvo] !== undefined) return; // já carregado — usa o cache
    setCarregando(alvo);
    setErro((e) => ({ ...e, [alvo]: false }));
    const ctx = { de, ate, motivo, setor, ibge, base };
    try {
      if (alvo === "clientes") {
        const d = await carregarClientes(ctx);
        setCache((c) => ({ ...c, clientes: d }));
      } else if (alvo === "vendedores") {
        const d = await carregarVendedores(ctx);
        setCache((c) => ({ ...c, vendedores: d }));
      } else if (alvo === "supervisores") {
        const d = await carregarSupervisores(ctx);
        setCache((c) => ({ ...c, supervisores: d }));
      } else if (alvo === "motoristas") {
        const d = await carregarMotoristas(ctx);
        setCache((c) => ({ ...c, motoristas: d }));
      } else if (alvo === "dias") {
        const d = await carregarDiaSemana(ctx);
        setCache((c) => ({ ...c, dias: d }));
      } else if (alvo === "mapa") {
        const d = await carregarMapa(ctx);
        setCache((c) => ({ ...c, mapa: d }));
      } else if (alvo === "bairros") {
        const d = await carregarBairros(ctx);
        setCache((c) => ({ ...c, bairros: d }));
      }
    } catch {
      setErro((e) => ({ ...e, [alvo]: true }));
    } finally {
      setCarregando((atual) => (atual === alvo ? null : atual));
    }
  }, [cache, de, ate, motivo, setor, ibge, base]);

  // Carrega a aba ativa quando ela muda (inclui a aba inicial ao montar). É uma
  // busca sob demanda: o setState (spinner) faz parte do fluxo, por isso a regra
  // de "setState no efeito" é dispensada aqui de propósito.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void garantir(aba);
  }, [aba, garantir]);

  const clientesItens: ItemRanking[] = (cache.clientes?.itens ?? []).map((c) => ({ cod: c.codcli, nome: c.nome, notas: c.notas, valor: c.valor }));
  const vendedoresItens: ItemRanking[] = (cache.vendedores?.itens ?? []).map((v) => ({ cod: v.codVendedor, nome: v.nome, notas: v.notas, valor: v.valor }));

  const abas: { id: Aba; label: string; icon: React.ReactNode }[] = [
    { id: "motoristas", label: "Motoristas", icon: <IconeCaminhao className="h-4 w-4" /> },
    { id: "clientes", label: "Clientes", icon: <IconePredio className="h-4 w-4" /> },
    { id: "vendedores", label: "Vendedores", icon: <IconeUsuario className="h-4 w-4" /> },
    { id: "supervisores", label: "Supervisores", icon: <IconeUsuario className="h-4 w-4" /> },
    { id: "motivos", label: "Motivos", icon: <IconeEtiqueta className="h-4 w-4" /> },
    { id: "dias", label: "Dia da semana", icon: <IconeEtiqueta className="h-4 w-4" /> },
    { id: "mapa", label: "Mapa PE", icon: <IconePredio className="h-4 w-4" /> },
    { id: "bairros", label: ibge ? "Bairros" : "RMR/Bairros", icon: <IconePredio className="h-4 w-4" /> },
    { id: "retorno", label: "Retorno ao estoque", icon: <IconeCaminhao className="h-4 w-4" /> },
  ];

  // Clique numa cidade do mapa → a página inteira passa a mostrar só ela (?cidade=IBGE).
  const abrirCidade = (c: CidadeDevolucao) => {
    const p = new URLSearchParams(window.location.search);
    p.set("cidade", c.ibge);
    router.push(`/devolucoes?${p.toString()}`);
  };
  // Desmarcar a cidade filtrada no mapa → volta aos dados gerais (sem ?cidade).
  const limparCidade = () => {
    const p = new URLSearchParams(window.location.search);
    p.delete("cidade");
    const q = p.toString();
    router.push(q ? `/devolucoes?${q}` : "/devolucoes");
  };

  // Relatório da aba em PDF (diálogo de impressão: imprimir ou "Salvar como PDF").
  // `so` = só um motorista (botão dentro da ficha dele).
  const exportar = (alvo: Aba, so?: number) => {
    const ctx = { periodo: periodoLabel, base, motivo, setor, cidade: cidadeNome, geradoEm: new Date() };
    const resumo = resumoDoPeriodo(porMotivo);
    let secao = "";
    let corpo = "";
    let comResumo = true;
    if (alvo === "motoristas" && cache.motoristas) {
      const nome = so != null ? cache.motoristas.itens.find((m) => m.codMotorista === so)?.nome : undefined;
      secao = nome ? `Motorista ${nome}` : "Motoristas";
      corpo = relatorioMotoristas(cache.motoristas.itens, cache.motoristas.motivos, so);
      comResumo = so == null;
    } else if (alvo === "clientes" && cache.clientes) {
      secao = "Clientes";
      corpo = relatorioRanking("Cliente", clientesItens, cache.clientes.motivos);
    } else if (alvo === "vendedores" && cache.vendedores) {
      secao = "Vendedores";
      corpo = relatorioRanking("Vendedor", vendedoresItens, cache.vendedores.motivos, 1000);
    } else if (alvo === "supervisores" && cache.supervisores) {
      secao = "Supervisores";
      corpo = relatorioSupervisores(cache.supervisores);
      comResumo = false;
    } else if (alvo === "motivos") {
      secao = "Motivos";
      corpo = relatorioMotivos(porMotivo);
    } else if (alvo === "dias" && cache.dias) {
      secao = "Dia da semana";
      corpo = relatorioDiaSemana(cache.dias);
    } else if (alvo === "mapa" && cache.mapa) {
      secao = "Cidades de PE";
      corpo = relatorioCidades(cache.mapa);
    } else if (alvo === "bairros" && cache.bairros) {
      secao = cidadeNome ? `Bairros de ${cidadeNome}` : "Bairros da RMR";
      corpo = relatorioBairros(cache.bairros);
    } else if (alvo === "retorno" && protocolos) {
      secao = "Retorno ao estoque";
      corpo = relatorioProtocolos(protocolos);
      comResumo = false;
    } else return;
    imprimirRelatorio(documentoRelatorio(secao, ctx, corpo, comResumo ? resumo : ""));
  };
  const podeExportar = aba === "motivos" || (aba === "retorno" ? protocolos !== null : cache[aba as keyof Cache] !== undefined);

  const estaCarregando = aba !== "retorno" && carregando === aba && cache[aba as keyof Cache] === undefined;
  const falhou = erro[aba];

  return (
    <div>
      <div className="mb-4 flex items-start gap-2">
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Seções de devolução">
        {abas.map((t) => {
          const ativo = aba === t.id;
          const lido = t.id === "motivos" || (t.id === "retorno" ? retornoAberto : cache[t.id as keyof Cache] !== undefined);
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={ativo}
              onClick={() => setAba(t.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                ativo
                  ? "border-[#181d55] bg-[#181d55] text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
              title={
                t.id === "retorno"
                  ? "Protocolos do Harpia (D1131 → B311 → 216 → D1132) — só o período vale; motivo, setor e cidade não se aplicam"
                  : lido ? "Já carregado (em cache)" : "Carrega ao abrir"
              }
            >
              <span className={ativo ? "text-white" : "text-slate-400"}>{t.icon}</span>
              {t.label}
              {/* Pontinho = seção já carregada nesta sessão (cache quente). */}
              {lido && !ativo && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />}
            </button>
          );
        })}
      </div>
        <button
          type="button"
          onClick={() => exportar(aba)}
          disabled={!podeExportar}
          title="Imprimir ou salvar esta seção em PDF"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#181d55] hover:text-[#181d55] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
            <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />
          </svg>
          <span className="hidden sm:inline">Exportar PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {retornoAberto && (
        <div className={aba === "retorno" ? "" : "hidden"}>
          <SecaoProtocolos de={de} ate={ate} onCarregado={setProtocolos} />
        </div>
      )}

      {aba === "retorno" ? null : estaCarregando ? (
        <Carregando texto={`Carregando ${aba}…`} />
      ) : falhou ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-sm text-slate-500">
          Não foi possível carregar esta seção.
          <button
            onClick={() => garantir(aba)}
            className="rounded-lg bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
          >
            Tentar de novo
          </button>
        </Card>
      ) : (
        <>
          {aba === "motoristas" && (
            <TabelaMotoristas
              motoristas={cache.motoristas?.itens ?? []}
              motivos={cache.motoristas?.motivos ?? {}}
              onPdf={(cod) => exportar("motoristas", cod)}
            />
          )}

          {aba === "clientes" && (
            <PainelRanking
              icon={<IconePredio />}
              title="Clientes que mais devolvem"
              unidade="cliente"
              unidadePlural="clientes"
              buscaPlaceholder="Buscar cliente…"
              itens={clientesItens}
              motivos={cache.clientes?.motivos ?? {}}
            />
          )}

          {aba === "vendedores" && (
            <PainelRanking
              icon={<IconeUsuario />}
              tone="gold"
              title="Vendedores com mais devolução"
              unidade="vendedor"
              unidadePlural="vendedores"
              buscaPlaceholder="Buscar vendedor…"
              itens={vendedoresItens}
              motivos={cache.vendedores?.motivos ?? {}}
            />
          )}

          {aba === "supervisores" && <TabelaSupervisores pastas={cache.supervisores ?? []} base={base} />}

          {aba === "motivos" && (
            <Card className="overflow-hidden">
              <PanelHeader icon={<IconeEtiqueta />} tone="gold" title="Por motivo" context={`${porMotivo.length} motivos · por valor`} />
              <PainelMotivos motivos={porMotivo} />
            </Card>
          )}

          {aba === "mapa" && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-[#141a4d]">Mapa de devolução por cidade · Pernambuco</h3>
              {(cache.mapa?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-400">Mapa indisponível — sem dado de cidade no período.</p>
              ) : (
                <MapaLazy cidades={cache.mapa ?? []} cidadeAtual={ibge} onAbrirCidade={abrirCidade} onLimparCidade={limparCidade} />
              )}
            </Card>
          )}

          {aba === "dias" && <PainelDiaSemana dias={cache.dias ?? []} base={base} />}

          {aba === "bairros" && (
            <TabelaBairrosRMR
              bairros={cache.bairros ?? []}
              titulo={cidadeNome ? `Devolução por bairro · ${cidadeNome}` : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
