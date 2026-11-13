import type { ReactNode } from "react";
import { isAdmin } from "@/data/auth";
import { getPositivados } from "@/data/faturamento";
import { lerCadastroFrota } from "@/data/frota-custos";
import { lerHodometroPeriodo, lerSaudeTelemetria } from "@/data/frota-km";
import { lerDiaSemanaFrota, lerRotas, lerTotaisEntrega } from "@/data/telemetria";
import { lerViagensPeriodo } from "@/data/winthor-entregas";
import { mesesEquivalentes } from "@/domain/custo-periodo";
import { comTaxa } from "@/domain/devolucoes-mapa";
import { mapaKmDia, resumoKm } from "@/domain/frota";
import { custoFrota } from "@/domain/frota-custo";
import { haQuanto } from "@/domain/frota-saude";
import { formatBRL, formatPercent } from "@/domain/format";
import { lerPeriodo, paramsDoPeriodo, rotuloPeriodo } from "@/domain/periodo";
import { fracaoMesDoMotorista, kmDoMotorista, motoristasDasRotas, porCidade, rotasComDevolucao, veiculoDias } from "@/domain/telemetria";
import { PageHeader, Card, BarList } from "@/components/ui";
import MapaFrota from "./mapa-frota";
import GraficoSemana from "./grafico-semana";
import TabelaRotas from "./tabela-rotas";

// Telemetria & Frota — aba portada do app Flask do colega (app_cortes,
// "Telemetria & Frota"), no mesmo desenho: filtro de período e motorista, KPIs de
// entrega e devolução, custo estimado da frota, devolução por dia da semana, km
// por veículo, diesel por tipo, mapa por cidade e a tabela de rotas. Entregas e
// devoluções das filiais 1 e 11 (Winthor); km da telemetria Fulltrack; custo da
// frota pelo cadastro em Custos › Frota (só administradores, como no Dashboard).

export const dynamic = "force-dynamic";

const inteiro = new Intl.NumberFormat("pt-BR");
const brl0 = (v: number) => formatBRL(Math.round(v)).replace(/,00$/, "");
const fracao = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (v: number | null, casas = 1) => (v === null ? "—" : formatPercent(v, casas));

const tituloCard = "mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500";
const campo =
  "w-full rounded-lg border border-slate-300 bg-[#F4F7FA] p-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/50";

type Params = { mes?: string; de?: string; ate?: string; motorista?: string };

export default async function FrotaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const periodo = lerPeriodo(sp);
  const { de, ate } = periodo;
  const codMot = sp.motorista && /^\d+$/.test(sp.motorista) ? Number(sp.motorista) : null;

  let dados;
  try {
    dados = await Promise.all([
      lerRotas(de, ate),
      lerTotaisEntrega(de, ate, codMot),
      lerDiaSemanaFrota(de, ate, codMot),
      codMot === null ? getPositivados(de, ate) : Promise.resolve(null),
      lerViagensPeriodo(de, ate),
      lerHodometroPeriodo(de, ate).catch(() => null),
      lerSaudeTelemetria().catch(() => null),
      isAdmin(),
    ]);
  } catch (e) {
    console.error("[frota]", e);
    return (
      <div>
        <PageHeader title="Telemetria & Frota" subtitle={`${rotuloPeriodo(periodo)} · Winthor`} />
        <Card className="p-6 text-sm text-slate-500">Sem acesso ao Winthor agora — tente de novo em instantes.</Card>
      </div>
    );
  }
  const [todasRotas, tot, semana, positivados, todasViagens, hodometro, saude, admin] = dados;

  const motoristas = motoristasDasRotas(todasRotas);
  const nomeMot = motoristas.find((m) => m.cod === codMot)?.nome;
  const rotas = codMot === null ? todasRotas : todasRotas.filter((r) => r.codMotorista === codMot);
  const viagens = codMot === null ? todasViagens : todasViagens.filter((v) => v.motorista === codMot);

  // KM: frota inteira no período; com motorista, só os dias em que o carro saiu com carga dele.
  const mapaTodo = hodometro ? mapaKmDia(hodometro) : null;
  const mapa = mapaTodo && codMot !== null ? kmDoMotorista(viagens, mapaTodo) : mapaTodo;
  const km = mapa ? resumoKm(viagens, mapa, null) : null;
  const temKm = !!km && km.rastreados > 0;
  const cadastro = admin && temKm ? await lerCadastroFrota().catch(() => null) : null;
  const fracaoMes = codMot === null ? mesesEquivalentes(periodo) : fracaoMesDoMotorista(veiculoDias(viagens), cadastro?.veiculos.length ?? 0);
  const custo = cadastro && km ? custoFrota(km, cadastro, fracaoMes) : null;

  const cidades = comTaxa(
    porCidade(rotas).map((c) => ({
      ibge: c.ibge, cidade: c.cidade, faturado: c.faturado, devolvido: c.devolvido,
      notasEntregues: c.entregas, notasDevolvidas: c.entregasDev, motivo: "—", motivoValor: 0,
    })),
  );
  const statusColetor = saude?.minutos != null
    ? `Telemetria Fulltrack · última leitura ${haQuanto(saude.minutos)}${saude.estado === "parado" || saude.estado === "atrasado" ? " (coletor " + saude.estado + ")" : ""} · ${saude.comunicando} veículos comunicando`
    : "Telemetria Fulltrack sem leitura recente";
  const kmVeiculos = (km?.porVeiculo ?? []).filter((v) => v.km !== null && v.km > 0).sort((a, b) => b.km! - a.km!).slice(0, 20);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Telemetria & Frota" subtitle={`${rotuloPeriodo(periodo)} · filiais 1 e 11${nomeMot ? ` · ${nomeMot}` : ""}`} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-lg font-bold text-slate-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-slate-400" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 10h4M14 13h3" />
          </svg>
          Filtros de análise do motorista
        </div>
        <form action="/frota" className="mt-4 grid w-full grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <label className="flex min-w-0 flex-col gap-1 sm:w-44">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">De</span>
            <input type="date" name="de" defaultValue={de} className={campo} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 sm:w-44">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Até</span>
            <input type="date" name="ate" defaultValue={ate} className={campo} />
          </label>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:min-w-[240px] sm:flex-1 sm:max-w-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Motorista</span>
            <select name="motorista" defaultValue={codMot === null ? "" : String(codMot)} className={campo}>
              <option value="">Visão geral (todos)</option>
              {motoristas.map((m) => <option key={m.cod} value={m.cod}>{m.nome}</option>)}
            </select>
          </label>
          <button type="submit" className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#141a4d] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1b2168] sm:ml-auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            Analisar
          </button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Kpi titulo="Entregas realizadas" valor={inteiro.format(tot.entregas)} sub={`${pct(fracao(tot.entregas - tot.entregasDev, tot.entregas))} sem devolução`}
          dica="Cliente × dia com nota entregue (notas expedidas em carga, filiais 1 e 11)" />
        <Kpi titulo="Devoluções (qtd)" valor={inteiro.format(tot.entregasDev)} sub={`${pct(fracao(tot.entregasDev, tot.entregas))} das entregas`} cor="text-rose-600"
          dica="Entregas (cliente × dia) com alguma devolução, de qualquer motivo" />
        <Kpi titulo="Clientes positivados" valor={inteiro.format(positivados ?? tot.clientes)}
          sub={positivados !== null ? "mesma regra da rotina 111" : "clientes com entrega do motorista"}
          dica={positivados !== null ? "Clientes distintos com nota de venda (VP/VV) no período, filiais 1 e 11, sem canceladas" : "Clientes distintos com nota entregue pelo motorista no período"} />
        <Kpi titulo="Clientes que devolveram" valor={inteiro.format(tot.clientesDev)} sub={`${pct(fracao(tot.clientesDev, tot.clientes))} dos clientes`} cor="text-rose-600"
          dica="Clientes distintos com alguma devolução das notas entregues no período" />
        <Kpi titulo="KM rodados" valor={temKm ? `${inteiro.format(Math.round(km!.km))} km` : "—"} sub={temKm ? `${km!.rastreados} de ${km!.veiculos} veículos com telemetria` : "sem telemetria no período"}
          dica={statusColetor} />
      </section>

      {custo && (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Kpi titulo="Gasto diesel (estimado)" valor={brl0(custo.diesel)} sub={`${pct(fracao(custo.diesel, tot.valor), 2)} do faturamento`} cor="text-amber-600"
            dica={`KM da telemetria ÷ km/L do modelo × ${formatBRL(custo.precoDiesel)} o litro (cadastro em Custos › Frota)`} />
          <Kpi titulo="Desgaste dos veículos" valor={brl0(custo.desgaste)} sub="pneu, óleo, filtro e bateria"
            dica="Média mensal do relatório da oficina, rateada pela fração do mês (com motorista: por caminhão-dia)" />
          <Kpi titulo="Gastos de manutenção" valor={brl0(custo.manutencao)} sub="peças e mão de obra"
            dica="Média mensal do relatório da oficina, rateada pela fração do mês (com motorista: por caminhão-dia)" />
          <Kpi titulo="Gasto geral da frota" valor={brl0(custo.total)} sub={`${pct(fracao(custo.total, tot.valor), 2)} do faturamento`} cor="text-rose-600"
            dica="Diesel estimado + desgaste + manutenção no período" />
        </section>
      )}

      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <GraficoSemana dias={semana} medida="valor" />
        <GraficoSemana dias={semana} medida="peso" />
      </section>

      <Painel titulo="Frota (Fulltrack) · km rodados por veículo" status={statusColetor}>
        {kmVeiculos.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum veículo com km na telemetria para este filtro.</p>
        ) : (
          <BarList tone="navy" items={kmVeiculos.map((v) => ({ label: v.descricao ? `${v.placa} · ${v.descricao}` : v.placa, value: v.km!, display: `${inteiro.format(Math.round(v.km!))} km` }))} />
        )}
      </Painel>

      {custo && (
        <Painel titulo="Gasto de diesel por tipo de veículo (estimado)"
          status={custo.semCadastro.length ? `${custo.semCadastro.length} placas com km e sem cadastro de consumo ficam de fora: ${custo.semCadastro.slice(0, 6).join(", ")}${custo.semCadastro.length > 6 ? "…" : ""}` : undefined}>
          {custo.porTipo.length === 0 ? (
            <p className="text-sm text-slate-400">Sem gasto estimado para este filtro.</p>
          ) : (
            <BarList items={custo.porTipo.map((t) => ({ label: `${t.tipo} (${t.veiculos})`, value: t.diesel, display: brl0(t.diesel) }))} />
          )}
        </Painel>
      )}

      <Painel titulo="Mapa de devolução por cidade" status="clique numa cidade para ver as devoluções dela">
        <MapaFrota cidades={cidades} periodo={paramsDoPeriodo(periodo)} />
      </Painel>

      <TabelaRotas linhas={rotasComDevolucao(rotas)} />
    </div>
  );
}

function Kpi({ titulo, valor, sub, dica, cor = "text-[#141a4d]" }: { titulo: string; valor: string; sub: string; dica: string; cor?: string }) {
  return (
    <div title={dica} className="entrar flex min-h-[104px] min-w-0 flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</span>
      <div className="flex flex-col gap-0.5">
        <div className={`truncate text-xl font-black tabular-nums tracking-tight sm:text-2xl ${cor}`}>{valor}</div>
        <div className="truncate text-[11px] font-medium text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

function Painel({ titulo, status, children }: { titulo: string; status?: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col p-4 sm:p-5">
      <h3 className={tituloCard}>{titulo}</h3>
      {status && <p className="-mt-2 mb-3 text-[11px] text-slate-500">{status}</p>}
      {children}
    </Card>
  );
}
