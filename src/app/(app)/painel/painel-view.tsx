"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatBRL, formatPercent, formatKg } from "@/domain/format";
import { mesAnterior, formatMesAno, primeiroDiaDoMes } from "@/domain/periodo";
import type {
  DevolucaoPorMotorista,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  MotivoDetalhe,
} from "@/domain/devolucoes";
import type { CidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";
import type { PontoDescarregoMensal } from "@/domain/descarregamento-tendencia";
import { carregarClientes, carregarVendedores, carregarMotoristas, carregarMapa } from "../devolucoes/actions";
import {
  carregarResumoDevolucao,
  carregarDevBairrosRMR,
  carregarAFaturar,
  carregarReceitas,
  carregarReceitasDrivers,
  carregarDescarregos,
  carregarSerieDescarrego,
  type ResumoDevolucao,
  type ResumoAFaturar,
  type ResumoReceitas,
  type ResumoDescarregos,
  type MesReceitaDetalhe,
} from "./painel-actions";
import Mapa from "./mapa";
import MapaRMR from "./mapa-rmr";
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
const REFRESH_MS = 10 * 60_000; // 10 minutos (ou no botão de atualizar)

const NAVY = "linear-gradient(140deg,#0a1650 0%,#0d1550 45%,#151b57 100%)";

// Contagens (positivados, entregas, pedidos) com separador de milhar pt-BR.
const inteiro = new Intl.NumberFormat("pt-BR");

// Variação vs mês anterior para o rodapé dos KPIs do cabeçalho. `maiorEhBom`
// decide a cor (regra do site: bom = neutro, ruim = rose).
function deltaPct(atual: number, ant: number | undefined, maiorEhBom: boolean, prevLabel: string) {
  if (ant === undefined || ant <= 0) return undefined;
  const frac = (atual - ant) / ant;
  return {
    texto: `${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))} vs ${prevLabel}`,
    subindo: frac >= 0,
    positivo: maiorEhBom ? frac >= 0 : frac <= 0,
  };
}
// Para uma TAXA, "p.p." confunde na TV. Mostramos o valor do mês passado direto
// ("vs Ago 3,9%"); a seta e a cor dão a direção. `maiorEhBom=false` na devolução.
function deltaTaxa(atualFrac: number, antFrac: number | undefined, maiorEhBom: boolean, prevLabel: string) {
  if (antFrac === undefined) return undefined;
  const subiu = atualFrac > antFrac;
  return {
    texto: `vs ${prevLabel} ${formatPercent(antFrac)}`,
    subindo: subiu,
    positivo: maiorEhBom ? subiu : !subiu,
  };
}

interface Dados {
  motoristas: DevolucaoPorMotorista[];
  clientes: DevolucaoPorCliente[];
  vendedores: DevolucaoPorVendedor[];
  clientesMotivos: Record<number, MotivoDetalhe[]>;
  vendedoresMotivos: Record<number, MotivoDetalhe[]>;
  cidades: CidadeDevolucao[];
  bairrosRMR: BairroDevolucao[];
  aFaturar: ResumoAFaturar | null;
  receitas: ResumoReceitas | null;
  receitasDrivers: MesReceitaDetalhe[];
  descarregos: ResumoDescarregos | null;
  serieDescarrego: PontoDescarregoMensal[];
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
    s.push({ id: "mapa", titulo: "Devoluções · Mapa de Pernambuco", contexto: "participação no faturamento e taxa de devolução por cidade", icon: <IconePredio className="h-6 w-6" />, dwell: DWELL_MAPA, node: <Mapa cidades={d.cidades} faturamentoGeral={dev.vendaFaturada} /> });
  if (d.motoristas.length > 0)
    s.push({ id: "motoristas", titulo: "Motoristas que mais voltam", contexto: "top 10 por taxa de nota e por valor", icon: <IconeCaminhao className="h-6 w-6" />, dwell: 16_000, node: <SecaoMotoristas motoristas={d.motoristas} /> });
  if (d.clientes.length > 0 || d.vendedores.length > 0)
    s.push({ id: "cli-ven", titulo: "Clientes e vendedores", contexto: "participação no total devolvido, comercial ou logístico e o motivo predominante", icon: <IconePredio className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoClientesVendedores clientes={d.clientes} vendedores={d.vendedores} totalDevolvido={dev.total} clientesMotivos={d.clientesMotivos} vendedoresMotivos={d.vendedoresMotivos} /> });
  if (dev.porMotivo.length > 0)
    s.push({ id: "motivos", titulo: "Motivos de devolução", contexto: "participação de cada motivo no total devolvido", icon: <IconeEtiqueta className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoMotivos porMotivo={dev.porMotivo} /> });
  if (d.bairrosRMR.length > 0)
    s.push({ id: "bairros-rmr", titulo: "Devolução · Mapa da RMR por bairro", contexto: "notas entregues / devolvidas e motivo predominante, bairro a bairro", icon: <IconePredio className="h-6 w-6" />, dwell: DWELL_MAPA, node: <MapaRMR cidades={d.cidades} bairros={d.bairrosRMR} /> });
  if (d.aFaturar && d.aFaturar.disponivel)
    s.push({ id: "afaturar", titulo: "A faturar", contexto: "pedidos liberados/montados sem NF", icon: <IconeEtiqueta className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoAFaturar dados={d.aFaturar} /> });
  if (d.receitas)
    s.push({ id: "receitas", titulo: "Receitas", contexto: "por que um mês rendeu mais: carros, peso e diversas", icon: <IconeUsuario className="h-6 w-6" />, dwell: DWELL_MAPA, node: <SecaoReceitas dados={d.receitas} detalhe={d.receitasDrivers} /> });
  if (d.descarregos)
    s.push({ id: "descarregos", titulo: "Descarrego", contexto: "comparação com o mês anterior e o dia a dia do mês", icon: <IconeCaminhao className="h-6 w-6" />, dwell: DWELL_PADRAO, node: <SecaoDescarregos dados={d.descarregos} serie={d.serieDescarrego} mesLabel={mesLabel} /> });
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
const IcoRefresh = ({ spin = false }: { spin?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" className={`h-5 w-5 ${spin ? "animate-spin" : ""}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" />
  </svg>
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
  const [devAnt, setDevAnt] = useState<ResumoDevolucao | null>(null);
  const [dados, setDados] = useState<Dados>({
    motoristas: [], clientes: [], vendedores: [], clientesMotivos: {}, vendedoresMotivos: {}, cidades: [], bairrosRMR: [], aFaturar: null, receitas: null, receitasDrivers: [], descarregos: null, serieDescarrego: [],
  });
  const [idx, setIdx] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [relogio, setRelogio] = useState("");
  const [atualizando, setAtualizando] = useState(false);
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
    await passo(async () => { const v = await carregarClientes(mes); setDados((d) => ({ ...d, clientes: v.itens, clientesMotivos: v.motivos })); });
    await passo(async () => { const v = await carregarVendedores(mes); setDados((d) => ({ ...d, vendedores: v.itens, vendedoresMotivos: v.motivos })); });
    await passo(async () => { const v = await carregarDevBairrosRMR(mes); setDados((d) => ({ ...d, bairrosRMR: v })); });
    await passo(async () => { const v = await carregarAFaturar(); setDados((d) => ({ ...d, aFaturar: v })); });
    await passo(async () => { const v = await carregarReceitas(mes); setDados((d) => ({ ...d, receitas: v })); });
    await passo(async () => { const v = await carregarReceitasDrivers(); setDados((d) => ({ ...d, receitasDrivers: v })); });
    await passo(async () => { const v = await carregarDescarregos(mes); setDados((d) => ({ ...d, descarregos: v })); });
    await passo(async () => { const v = await carregarSerieDescarrego(); setDados((d) => ({ ...d, serieDescarrego: v })); });
    // Mês anterior (placar de comparação do cabeçalho) — sempre buscado (não vem do SSR).
    await passo(async () => { const v = await carregarResumoDevolucao(mesAnterior(mes || primeiroDiaDoMes())); setDevAnt(v); });
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

  // Comparação com o mês passado no cabeçalho (▲/▼ vs Ago).
  const mesRef = mes || primeiroDiaDoMes();
  const prevLabel = formatMesAno(mesAnterior(mesRef)).slice(0, 3);
  const antOk = devAnt?.disponivel ? devAnt : undefined;
  const receitaAnt = dados.receitas?.serie.find((p) => p.mes === mesAnterior(mesRef))?.valor;

  const irPara = useCallback((n: number) => setIdx(((n % nSlides) + nSlides) % nSlides), [nSlides]);
  const proximo = useCallback(() => setIdx((i) => i + 1), []);
  const anterior = useCallback(() => setIdx((i) => i - 1), []);
  const telaCheia = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  // Atualização manual (o botão) — reusa o mesmo aquecimento sequencial.
  const atualizar = useCallback(async () => {
    if (atualizando) return;
    setAtualizando(true);
    try {
      await aquecer();
    } finally {
      setAtualizando(false);
    }
  }, [aquecer, atualizando]);

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
            <BotaoCtrl onClick={atualizar} title="Atualizar agora"><IcoRefresh spin={atualizando} /></BotaoCtrl>
            <button onClick={telaCheia} className="ml-1 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15">
              Tela cheia
            </button>
            <Link href={`/devolucoes${mes ? `?mes=${mes}` : ""}`} className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15">
              Sair
            </Link>
          </div>
        </div>

        {/* KPIs sempre visíveis — foco operacional (logística): sem faturamento
            em R$; entram positivados e entregas. Só a Receita do mês fica em R$. */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Clientes positivados" value={dev.disponivel ? inteiro.format(dev.positivados) : "—"} delta={dev.disponivel ? deltaPct(dev.positivados, antOk?.positivados, true, prevLabel) : undefined} />
          <Kpi label="Entregas realizadas" value={dev.disponivel ? inteiro.format(dev.atendimentos) : "—"} delta={dev.disponivel ? deltaPct(dev.atendimentos, antOk?.atendimentos, true, prevLabel) : undefined} />
          <Kpi label="Peso faturado" value={dev.disponivel ? formatKg(dev.pesoFaturado) : "—"} delta={dev.disponivel ? deltaPct(dev.pesoFaturado, antOk?.pesoFaturado, true, prevLabel) : undefined} />
          <Kpi label="Taxa de devolução" value={dev.disponivel ? formatPercent(dev.taxaValor) : "—"} delta={dev.disponivel ? deltaTaxa(dev.taxaValor, antOk?.taxaValor, false, prevLabel) : undefined} tone="rose" />
          <Kpi label="Carteira (a faturar)" value={dados.aFaturar?.disponivel ? inteiro.format(dados.aFaturar.totalPedidos) : "—"} hint="pedidos a faturar" tone="amber" />
          <Kpi label="Receita do mês" value={dados.receitas ? formatBRL(dados.receitas.totalMes) : "—"} hint="descarrego + diversas" delta={dados.receitas ? deltaPct(dados.receitas.totalMes, receitaAnt, true, prevLabel) : undefined} tone="emerald" />
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
