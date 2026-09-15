"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatBRL, formatPercent } from "@/domain/format";
import type {
  DevolucaoPorMotorista,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorSetor,
  DevolucaoPorMotivo,
  SetorDevolucao,
} from "@/domain/devolucoes";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";
import { carregarClientes, carregarVendedores, carregarMotoristas, carregarMapa } from "../actions";
import { carregarResumoTv, type ResumoTv } from "./tv-actions";
import TvMapa from "./tv-mapa";
import { IconeCaminhao, IconePredio, IconeUsuario, IconeEtiqueta } from "../icons";

// Cadência: quanto cada slide fica no ar. O mapa fica mais tempo (leitura à
// distância). Refresh dos dados é RARO de propósito — cada busca abre conexão
// Oracle (sem pool), então a TV atualiza a cada poucos minutos, não a cada giro.
const DWELL_PADRAO = 11_000;
const DWELL_MAPA = 15_000;
const REFRESH_MS = 5 * 60_000; // recarrega os dados a cada 5 min

const NAVY = "linear-gradient(140deg,#0a1650 0%,#0d1550 45%,#151b57 100%)";

// Chips de setor na paleta escura (o `setorPill` claro não contrasta no navy).
const SETOR_COR: Record<SetorDevolucao, { barra: string; chip: string }> = {
  "Logística": { barra: "#4b57c4", chip: "bg-[#2a327f] text-indigo-100" },
  "Comercial": { barra: "#f5b301", chip: "bg-amber-400/20 text-amber-200" },
  "Faturamento": { barra: "#fb7185", chip: "bg-rose-400/20 text-rose-200" },
  "Não classificado": { barra: "#64748b", chip: "bg-slate-400/20 text-slate-200" },
};

interface Dados {
  motoristas: DevolucaoPorMotorista[];
  clientes: DevolucaoPorCliente[];
  vendedores: DevolucaoPorVendedor[];
  cidades: CidadeDevolucao[];
}

// ---------------------------------------------------------------------------

/** Cartão de indicador do placar (topo, sempre visível). */
function Kpi({
  label,
  value,
  hint,
  tone = "white",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "white" | "rose" | "amber" | "emerald";
}) {
  const cor = {
    white: "text-white",
    rose: "text-rose-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
  }[tone];
  return (
    <div className="rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className={`mt-1 font-[family-name:var(--font-sora)] text-3xl font-extrabold leading-none tabular-nums xl:text-4xl ${cor}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-white/40">{hint}</div>}
    </div>
  );
}

/** Barra empilhada de responsabilidade por setor. */
function SetorBar({ porSetor }: { porSetor: DevolucaoPorSetor[] }) {
  const total = Math.max(1, porSetor.reduce((t, s) => t + s.valor, 0));
  if (porSetor.length === 0) return null;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {porSetor.map((s) => (
          <div key={s.setor} style={{ width: `${(s.valor / total) * 100}%`, background: SETOR_COR[s.setor].barra }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {porSetor.map((s) => (
          <span key={s.setor} className="inline-flex items-center gap-2 text-sm text-white/70">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SETOR_COR[s.setor].chip}`}>{s.setor}</span>
            <span className="font-semibold tabular-nums text-white">{((s.valor / total) * 100).toFixed(1)}%</span>
            <span className="tabular-nums text-white/40">{formatBRL(s.valor)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface LinhaRanking {
  chave: string | number;
  nome: string;
  principal: string; // valor grande à direita (R$)
  secundario?: string; // texto pequeno sob o principal
  selo?: ReactNode; // etiqueta ao lado do nome (setor / vínculo)
}

/** Lista grande e legível — a mesma forma para motoristas, clientes, vendedores e motivos. */
function BigRanking({ linhas }: { linhas: LinhaRanking[] }) {
  return (
    <ul className="divide-y divide-white/10">
      {linhas.map((l, i) => (
        <li key={l.chave} className="flex items-center gap-4 py-3 xl:py-3.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sora)] text-base font-bold tabular-nums xl:h-10 xl:w-10 ${
              i === 0 ? "bg-amber-400 text-[#0a1650]" : "bg-white/10 text-white/55"
            }`}
          >
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="truncate text-xl font-semibold text-white xl:text-2xl" title={l.nome}>
              {l.nome}
            </span>
            {l.selo}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-[family-name:var(--font-sora)] text-xl font-bold tabular-nums text-rose-300 xl:text-2xl">
              {l.principal}
            </div>
            {l.secundario && <div className="text-sm tabular-nums text-white/40">{l.secundario}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SeloSetor({ setor }: { setor: SetorDevolucao }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${SETOR_COR[setor].chip}`}>{setor}</span>;
}

// ---------------------------------------------------------------------------

interface Slide {
  id: string;
  titulo: string;
  contexto: string;
  icon: ReactNode;
  dwell: number;
  node: ReactNode;
}

function construirSlides(dados: Dados, resumo: ResumoTv): Slide[] {
  const slides: Slide[] = [];

  if (dados.cidades.length > 0) {
    slides.push({
      id: "mapa",
      titulo: "Mapa de devolução · Pernambuco",
      contexto: "R$ devolvido por cidade",
      icon: <IconePredio className="h-6 w-6" />,
      dwell: DWELL_MAPA,
      node: <TvMapa cidades={dados.cidades} />,
    });
  }

  if (dados.motoristas.length > 0) {
    const top = [...dados.motoristas].sort((a, b) => b.valorDevolvido - a.valorDevolvido).slice(0, 9);
    slides.push({
      id: "motoristas",
      titulo: "Motoristas que mais voltam",
      contexto: "por R$ devolvido no período",
      icon: <IconeCaminhao className="h-6 w-6" />,
      dwell: DWELL_PADRAO,
      node: (
        <BigRanking
          linhas={top.map((m) => ({
            chave: m.codMotorista,
            nome: m.nome,
            principal: formatBRL(m.valorDevolvido),
            secundario: `${m.devolvidas} de ${m.expedidas} entregas · taxa ${formatPercent(m.taxa / 100)}`,
            selo:
              m.tipo === "F" ? (
                <span className="shrink-0 rounded-full bg-[#2a327f] px-2 py-0.5 text-xs font-semibold text-indigo-100">Da casa</span>
              ) : m.tipo === "T" ? (
                <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-200">Terceirizado</span>
              ) : null,
          }))}
        />
      ),
    });
  }

  if (dados.clientes.length > 0) {
    const top = dados.clientes.slice(0, 9); // já ordenado por nº de notas desc
    slides.push({
      id: "clientes",
      titulo: "Clientes que mais devolvem",
      contexto: "por nº de notas devolvidas",
      icon: <IconePredio className="h-6 w-6" />,
      dwell: DWELL_PADRAO,
      node: (
        <BigRanking
          linhas={top.map((c) => ({
            chave: c.codcli,
            nome: c.nome,
            principal: formatBRL(c.valor),
            secundario: `${c.notas} notas`,
          }))}
        />
      ),
    });
  }

  if (dados.vendedores.length > 0) {
    const top = dados.vendedores.slice(0, 9);
    slides.push({
      id: "vendedores",
      titulo: "Vendedores com mais devolução",
      contexto: "por nº de notas devolvidas",
      icon: <IconeUsuario className="h-6 w-6" />,
      dwell: DWELL_PADRAO,
      node: (
        <BigRanking
          linhas={top.map((v) => ({
            chave: v.codVendedor,
            nome: v.nome,
            principal: formatBRL(v.valor),
            secundario: `${v.notas} notas`,
          }))}
        />
      ),
    });
  }

  if (resumo.porMotivo.length > 0) {
    const top = [...resumo.porMotivo].sort((a, b) => b.valor - a.valor).slice(0, 9);
    slides.push({
      id: "motivos",
      titulo: "Motivos de devolução",
      contexto: "por valor devolvido",
      icon: <IconeEtiqueta className="h-6 w-6" />,
      dwell: DWELL_PADRAO,
      node: (
        <BigRanking
          linhas={top.map((m: DevolucaoPorMotivo) => ({
            chave: `${m.motivo}-${m.setor}`,
            nome: m.motivo,
            principal: formatBRL(m.valor),
            secundario: `${m.notas} notas`,
            selo: <SeloSetor setor={m.setor} />,
          }))}
        />
      ),
    });
  }

  return slides;
}

// ---------------------------------------------------------------------------

export default function TvView({
  mes,
  mesLabel,
  resumoInicial,
}: {
  mes: string;
  mesLabel: string;
  resumoInicial: ResumoTv;
}) {
  const [resumo, setResumo] = useState<ResumoTv>(resumoInicial);
  const [dados, setDados] = useState<Dados>({ motoristas: [], clientes: [], vendedores: [], cidades: [] });
  const [idx, setIdx] = useState(0);
  const [relogio, setRelogio] = useState(""); // hora da última atualização
  const primeira = useRef(true); // o placar da 1ª carga já veio do servidor

  // Aquece os dados SEQUENCIALMENTE (um await de cada vez) para nunca abrir uma
  // rajada de conexões Oracle. As tabelas aparecem conforme chegam; nas próximas
  // rodadas os dados só se atualizam.
  const aquecer = useCallback(async () => {
    // Na 1ª passada o placar já veio do SSR (resumoInicial) — não refaz a busca.
    if (primeira.current) {
      primeira.current = false;
    } else {
      try {
        const r = await carregarResumoTv(mes);
        setResumo(r);
      } catch {
        /* mantém o placar anterior */
      }
    }
    // O mapa é o primeiro slide — busca ele primeiro para já entrar no ar e não
    // reordenar a rotação enquanto o resto aquece.
    try {
      const ci = await carregarMapa(mes);
      setDados((d) => ({ ...d, cidades: ci }));
    } catch {
      /* ignora — o slide simplesmente não entra na rotação */
    }
    try {
      const m = await carregarMotoristas(mes);
      setDados((d) => ({ ...d, motoristas: m.itens }));
    } catch {
      /* ignora */
    }
    try {
      const c = await carregarClientes(mes);
      setDados((d) => ({ ...d, clientes: c.itens }));
    } catch {
      /* ignora */
    }
    try {
      const v = await carregarVendedores(mes);
      setDados((d) => ({ ...d, vendedores: v.itens }));
    } catch {
      /* ignora */
    }
    setRelogio(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }, [mes]);

  useEffect(() => {
    // aquecer() só chama setState DEPOIS de um await (busca no servidor), nunca
    // de forma síncrona — então a regra não se aplica aqui.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void aquecer();
    const t = setInterval(() => void aquecer(), REFRESH_MS);
    return () => clearInterval(t);
  }, [aquecer]);

  const slides = construirSlides(dados, resumo);
  const nSlides = slides.length;
  const atual = nSlides > 0 ? slides[idx % nSlides] : null;

  // Avança para o próximo slide após o tempo de permanência do slide atual.
  useEffect(() => {
    if (nSlides === 0) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % nSlides), atual?.dwell ?? DWELL_PADRAO);
    return () => clearTimeout(t);
  }, [idx, nSlides, atual?.dwell]);

  const telaCheia = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden text-white" style={{ background: NAVY }}>
      {/* Cabeçalho / placar */}
      <header className="shrink-0 px-6 pt-5 pb-4 xl:px-10 xl:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="#0a1650" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M5 19V11M12 19V5M19 19v-6" />
                </svg>
              </span>
              <div>
                <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight xl:text-3xl">
                  Devoluções · Painel
                </h1>
                <p className="text-sm text-white/50">
                  {mesLabel} · filiais 1 e 11{relogio && ` · atualizado ${relogio}`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={telaCheia}
              className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15"
            >
              Tela cheia
            </button>
            <Link
              href={`/devolucoes${mes ? `?mes=${mes}` : ""}`}
              className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15"
            >
              Sair
            </Link>
          </div>
        </div>

        {/* KPIs — inclui o FATURAMENTO LÍQUIDO como contrapeso da devolução. */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Faturamento líquido" value={resumo.disponivel ? formatBRL(resumo.vendaLiquida) : "—"} hint="faturado − devoluções" tone="emerald" />
          <Kpi label="Valor devolução" value={resumo.disponivel ? formatBRL(resumo.total) : "—"} hint="rotina 111" tone="rose" />
          <Kpi label="Taxa (valor)" value={resumo.disponivel ? formatPercent(resumo.taxaValor) : "—"} hint="devolvido / faturado" tone="amber" />
          <Kpi label="Taxa (notas)" value={resumo.disponivel ? formatPercent(resumo.taxaNotas) : "—"} hint={resumo.disponivel ? `${resumo.devolvidas} de ${resumo.emitidas} NFs` : undefined} tone="amber" />
          <Kpi label="Devolução avulsa" value={resumo.disponivel ? formatBRL(resumo.valorDevolucaoAvulsa) : "—"} hint={resumo.disponivel ? `${resumo.devolvidasAvulsas} NFs` : undefined} />
        </div>

        {resumo.porSetor.length > 0 && (
          <div className="mt-4">
            <SetorBar porSetor={resumo.porSetor} />
          </div>
        )}
      </header>

      {/* Palco rotativo */}
      <main className="relative min-h-0 flex-1 px-6 pb-6 xl:px-10 xl:pb-8">
        <div className="flex h-full flex-col rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 xl:p-8">
          {atual ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-amber-300">{atual.icon}</span>
                <div>
                  <h2 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight xl:text-3xl">
                    {atual.titulo}
                  </h2>
                  <p className="text-sm text-white/45">{atual.contexto}</p>
                </div>
              </div>
              {/* key força a re-montagem: a animação de entrada roda a cada slide */}
              <div key={atual.id} className="tv-fade min-h-0 flex-1 overflow-hidden">
                {atual.node}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-lg text-white/40">
              {resumo.disponivel ? "Carregando dados…" : "Sem conexão com o Winthor — painel indisponível."}
            </div>
          )}
        </div>

        {/* Indicadores de progresso dos slides */}
        {nSlides > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {slides.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${i === idx % nSlides ? "w-10 bg-amber-400" : "w-4 bg-white/20"}`}
              />
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes tvFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .tv-fade { animation: tvFade 0.5s ease-out both; }
      `}</style>
    </div>
  );
}
