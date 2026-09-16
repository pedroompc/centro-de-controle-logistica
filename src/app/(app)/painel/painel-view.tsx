"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatBRL, formatPercent, formatKg } from "@/domain/format";
import type {
  DevolucaoPorMotorista,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
} from "@/domain/devolucoes";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";
import { carregarClientes, carregarVendedores, carregarMotoristas, carregarMapa } from "../devolucoes/actions";
import {
  carregarResumoDevolucao,
  carregarAFaturar,
  carregarReceitas,
  carregarDescarregos,
  type ResumoDevolucao,
  type ResumoAFaturar,
  type ResumoReceitas,
  type ResumoDescarregos,
} from "./painel-actions";
import Mapa from "./mapa";
import {
  Kpi,
  SetorBar,
  SecaoMotoristas,
  SecaoClientesVendedores,
  SecaoMotivos,
  SecaoAFaturar,
  SecaoReceitas,
  SecaoDescarregos,
} from "./secoes";
import { IconeCaminhao, IconePredio, IconeUsuario, IconeEtiqueta } from "../devolucoes/icons";

// Cadência: o mapa fica mais no ar (leitura à distância). Refresh dos dados é
// RARO de propósito — cada busca abre conexão Oracle (sem pool), então o painel
// atualiza a cada 20 min, nunca a cada giro de slide.
const DWELL_PADRAO = 11_000;
const DWELL_MAPA = 42_000; // fica mais tempo: o card passa por várias cidades
const REFRESH_MS = 20 * 60_000; // 20 minutos

const NAVY = "linear-gradient(140deg,#0a1650 0%,#0d1550 45%,#151b57 100%)";

interface Dados {
  motoristas: DevolucaoPorMotorista[];
  clientes: DevolucaoPorCliente[];
  vendedores: DevolucaoPorVendedor[];
  cidades: CidadeDevolucao[];
  aFaturar: ResumoAFaturar | null;
  receitas: ResumoReceitas | null;
  descarregos: ResumoDescarregos | null;
}

interface Slide {
  id: string;
  titulo: string;
  contexto: string;
  icon: ReactNode;
  dwell: number;
  node: ReactNode;
}

/** Marca da empresa — mesma logo (sol) usada no menu e no login. */
function Marca() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/sol-dia.gif" alt="DIA" className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
  );
}

function construirSlides(d: Dados, dev: ResumoDevolucao, mesLabel: string): Slide[] {
  const s: Slide[] = [];
  if (d.cidades.length > 0)
    s.push({ id: "mapa", titulo: "Devoluções · Mapa de Pernambuco", contexto: "R$ devolvido por cidade", icon: <IconePredio className="h-6 w-6" />, dwell: DWELL_MAPA, node: <Mapa cidades={d.cidades} /> });
  if (d.motoristas.length > 0)
    s.push({ id: "motoristas", titulo: "Motoristas que mais voltam", contexto: "por R$ devolvido", icon: <IconeCaminhao className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoMotoristas motoristas={d.motoristas} /> });
  if (d.clientes.length > 0 || d.vendedores.length > 0)
    s.push({ id: "cli-ven", titulo: "Clientes e vendedores", contexto: "quem mais devolve", icon: <IconePredio className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoClientesVendedores clientes={d.clientes} vendedores={d.vendedores} /> });
  if (dev.porMotivo.length > 0)
    s.push({ id: "motivos", titulo: "Motivos de devolução", contexto: "por valor devolvido", icon: <IconeEtiqueta className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoMotivos porMotivo={dev.porMotivo} /> });
  if (d.aFaturar && d.aFaturar.disponivel)
    s.push({ id: "afaturar", titulo: "A faturar", contexto: "pedidos liberados/montados sem NF", icon: <IconeEtiqueta className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoAFaturar dados={d.aFaturar} /> });
  if (d.receitas)
    s.push({ id: "receitas", titulo: "Receitas", contexto: "descarrego, diários e diversas", icon: <IconeUsuario className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoReceitas dados={d.receitas} /> });
  if (d.descarregos)
    s.push({ id: "descarregos", titulo: "Descarrego", contexto: "por dia, semana e mês", icon: <IconeCaminhao className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoDescarregos dados={d.descarregos} mesLabel={mesLabel} /> });
  return s;
}

// Ícones dos controles.
const IcoPrev = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
);
const IcoNext = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
);
const IcoPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
);
const IcoPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M8 5v14l11-7z" /></svg>
);

function BotaoCtrl({ onClick, title, children, ativo = false }: { onClick: () => void; title: string; children: ReactNode; ativo?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-white/15 transition ${
        ativo ? "bg-amber-400 text-[#0a1650]" : "bg-white/10 text-white/80 hover:bg-white/15"
      }`}
    >
      {children}
    </button>
  );
}

export default function PainelView({
  mes,
  mesLabel,
  devInicial,
}: {
  mes: string;
  mesLabel: string;
  devInicial: ResumoDevolucao;
}) {
  const [dev, setDev] = useState<ResumoDevolucao>(devInicial);
  const [dados, setDados] = useState<Dados>({
    motoristas: [], clientes: [], vendedores: [], cidades: [], aFaturar: null, receitas: null, descarregos: null,
  });
  const [idx, setIdx] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [relogio, setRelogio] = useState("");
  const primeira = useRef(true);

  // Aquece os dados SEQUENCIALMENTE (um await por vez) — nunca uma rajada de
  // conexões Oracle. Cada bloco é isolado: se um falhar, o slide só não entra.
  const aquecer = useCallback(async () => {
    const passo = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch {
        /* mantém o dado anterior; o slide simplesmente não aparece */
      }
    };
    await passo(async () => { const v = await carregarMapa(mes); setDados((d) => ({ ...d, cidades: v })); });
    await passo(async () => { const v = await carregarMotoristas(mes); setDados((d) => ({ ...d, motoristas: v.itens })); });
    await passo(async () => { const v = await carregarClientes(mes); setDados((d) => ({ ...d, clientes: v.itens })); });
    await passo(async () => { const v = await carregarVendedores(mes); setDados((d) => ({ ...d, vendedores: v.itens })); });
    await passo(async () => { const v = await carregarAFaturar(); setDados((d) => ({ ...d, aFaturar: v })); });
    await passo(async () => { const v = await carregarReceitas(mes); setDados((d) => ({ ...d, receitas: v })); });
    await passo(async () => { const v = await carregarDescarregos(mes); setDados((d) => ({ ...d, descarregos: v })); });
    // O placar de devolução da 1ª carga já veio do SSR — só refaz no refresh.
    if (primeira.current) primeira.current = false;
    else await passo(async () => { const v = await carregarResumoDevolucao(mes); setDev(v); });
    setRelogio(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }, [mes]);

  useEffect(() => {
    // aquecer() só chama setState DEPOIS de um await (busca no servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void aquecer();
    const t = setInterval(() => void aquecer(), REFRESH_MS);
    return () => clearInterval(t);
  }, [aquecer]);

  const slides = construirSlides(dados, dev, mesLabel);
  const nSlides = slides.length;
  const posicao = nSlides > 0 ? idx % nSlides : 0;
  const atual = nSlides > 0 ? slides[posicao] : null;

  const irPara = useCallback((n: number) => setIdx(((n % nSlides) + nSlides) % nSlides), [nSlides]);
  const proximo = useCallback(() => setIdx((i) => i + 1), []);
  const anterior = useCallback(() => setIdx((i) => i - 1), []);
  const telaCheia = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  // Auto-avanço — pausa quando travado.
  useEffect(() => {
    if (pausado || nSlides === 0) return;
    const t = setTimeout(() => setIdx((i) => i + 1), atual?.dwell ?? DWELL_PADRAO);
    return () => clearTimeout(t);
  }, [idx, pausado, nSlides, atual?.dwell]);

  // Atalhos: ← → passam; espaço trava/destrava; F tela cheia.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") proximo();
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === " ") { e.preventDefault(); setPausado((p) => !p); }
      else if (e.key.toLowerCase() === "f") telaCheia();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proximo, anterior, telaCheia]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden text-white" style={{ background: NAVY }}>
      {/* Cabeçalho / placar */}
      <header className="shrink-0 px-6 pt-5 pb-4 xl:px-10 xl:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Marca />
            <div>
              <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight xl:text-3xl">
                Painel da Operação
              </h1>
              <p className="text-sm text-white/50">
                {mesLabel} · filiais 1 e 11{relogio && ` · atualizado ${relogio}`}
                {pausado && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-200">travado</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BotaoCtrl onClick={anterior} title="Página anterior (←)"><IcoPrev /></BotaoCtrl>
            <BotaoCtrl onClick={() => setPausado((p) => !p)} title={pausado ? "Retomar (espaço)" : "Travar nesta página (espaço)"} ativo={pausado}>
              {pausado ? <IcoPlay /> : <IcoPause />}
            </BotaoCtrl>
            <BotaoCtrl onClick={proximo} title="Próxima página (→)"><IcoNext /></BotaoCtrl>
            <button onClick={telaCheia} className="ml-1 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15">
              Tela cheia
            </button>
            <Link href={`/devolucoes${mes ? `?mes=${mes}` : ""}`} className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15">
              Sair
            </Link>
          </div>
        </div>

        {/* KPIs sempre visíveis — inclui o FATURAMENTO LÍQUIDO. */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Faturamento líquido" value={dev.disponivel ? formatBRL(dev.vendaLiquida) : "—"} hint="faturado − devoluções" tone="emerald" />
          <Kpi label="Peso faturado" value={dev.disponivel ? formatKg(dev.pesoFaturado) : "—"} hint="líquido (venda − devolução)" />
          <Kpi label="Taxa de devolução" value={dev.disponivel ? formatPercent(dev.taxaValor) : "—"} hint={dev.disponivel ? formatBRL(dev.total) : undefined} tone="rose" />
          <Kpi label="Carteira (a faturar)" value={dados.aFaturar?.disponivel ? formatBRL(dados.aFaturar.valorTotal) : "—"} hint={dados.aFaturar?.disponivel ? `${dados.aFaturar.totalPedidos} pedidos` : undefined} tone="amber" />
          <Kpi label="Receita do mês" value={dados.receitas ? formatBRL(dados.receitas.totalMes) : "—"} hint="descarrego + diversas" tone="emerald" />
        </div>

        {dev.porSetor.length > 0 && (
          <div className="mt-4">
            <SetorBar porSetor={dev.porSetor} />
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
                  <h2 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight xl:text-3xl">{atual.titulo}</h2>
                  <p className="text-sm text-white/45">{atual.contexto}</p>
                </div>
              </div>
              <div key={atual.id} className="tv-fade min-h-0 flex-1 overflow-hidden">
                {atual.node}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-lg text-white/40">
              {dev.disponivel ? "Carregando dados…" : "Sem conexão com o Winthor — painel indisponível."}
            </div>
          )}
        </div>

        {/* Indicadores de página (clicáveis) */}
        {nSlides > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => irPara(i)}
                aria-label={`Ir para ${s.titulo}`}
                className={`h-1.5 rounded-full transition-all ${i === posicao ? "w-10 bg-amber-400" : "w-4 bg-white/20 hover:bg-white/40"}`}
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
