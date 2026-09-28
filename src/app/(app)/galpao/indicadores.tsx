import { getPainelWms, TETO_CARGA_MIN, TETO_COLETOR_MIN } from "@/data/wms";
import { getSerieTendencias } from "@/data/faturamento-mensal";
import { getResumoFaturamentoMesAtual } from "@/data/faturamento";
import {
  janelaMeses, movimentosPorTonelada, abastecimentosPorCarga, linhasPorHora, cargasPorViagem, porUnidade,
  type PontoWms,
} from "@/domain/wms";
import { variacaoPercentual } from "@/domain/tendencias";
import { formatKg, formatPercent } from "@/domain/format";
import { Card, SectionTitle, StatCard } from "@/components/ui";
import { CORES, KpiCard, type Delta } from "../tendencias/widgets";

const MESES_JANELA = 7; // 6 meses fechados + o corrente (parcial)

const MES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const rotuloMes = (mes: string) => {
  const [ano, m] = mes.split("-").map(Number);
  return `${MES_ABREV[m - 1]}/${String(ano).slice(2)}`;
};

// Zero aqui quase sempre é "sem dado" (fonte vazia ou denominador zero), não um
// zero real — mostrar "—" evita que o gestor leia 0,0 como resultado.
const inteiro = (v: number) => (v ? Math.round(v).toLocaleString("pt-BR") : "—");
const decimal = (v: number, casas = 1) =>
  v ? v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) : "—";
const toneladas = (kg: number) => (kg ? `${decimal(kg / 1000)} t` : "—");
const duracao = (min: number) => {
  if (min <= 0) return "—";
  const total = Math.round(min); // arredonda antes de quebrar: evita "2h 60min"
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}min` : `${m} min`;
};

/** Delta vs mês anterior. `menorMelhor` = cair é bom; `neutro` = volume (sem juízo de valor). */
function delta(atual: number, anterior: number, modo: "menorMelhor" | "maiorMelhor" | "neutro"): Delta {
  // Sem dado num dos meses não há comparação: fica neutro (cinza), nunca vermelho.
  if (anterior === 0 || atual === 0) return { texto: "sem dado para comparar", subindo: false, positivo: true };
  const frac = variacaoPercentual(atual, anterior);
  const subindo = atual > anterior;
  const positivo = modo === "neutro" ? true : modo === "menorMelhor" ? !subindo : subindo;
  return { texto: `${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))}`, subindo, positivo };
}

const Ic = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={d} /></svg>
);
const IC_VERT = "M12 3v18M12 3l-4 4M12 3l4 4M8 21h8";
const IC_HORIZ = "M3 12h18M21 12l-4-4M21 12l-4 4M3 8v8";
const IC_PESO = "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z";
const IC_CARGA = "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-.01M17 19a1.5 1.5 0 1 0 0-.01";
const IC_RELOGIO = "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z";
const IC_RAZAO = "M5 19 19 5M7 7h.01M17 17h.01";
const IC_RAIO = "M13 2 4 14h7l-1 8 9-12h-7l1-8Z";

/** Aba "Indicadores": eficiência e volume, 6 meses fechados + o corrente. */
export async function Indicadores() {
  const meses = janelaMeses(new Date(), MESES_JANELA);
  const [wms, fatFechados, fatAtual] = await Promise.all([
    getPainelWms(meses),
    getSerieTendencias(MESES_JANELA - 1), // mesmos 6 meses fechados, via foto do Supabase
    getResumoFaturamentoMesAtual(),
  ]);
  const { estoque, indisponivel } = wms;

  // Peso faturado do WinThor (o mesmo número do dashboard) como denominador.
  const pesoPorMes = new Map(fatFechados.map((p) => [p.mes, p.pesoFaturado]));
  if (fatAtual) pesoPorMes.set(meses[meses.length - 1], fatAtual.pesoFaturado);
  const serie = wms.serie.map((p) => ({ ...p, pesoFaturadoKg: pesoPorMes.get(p.mes) ?? null }));

  if (indisponivel.length === 4) {
    return (
      <div>
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Sem conexão com o WMS. O banco só responde de dentro da rede da empresa, ou o usuário
            do app não tem leitura no schema HARPIAW2.
          </p>
        </Card>
      </div>
    );
  }

  const fechados = serie.slice(0, -1); // o último da série é o mês corrente, parcial
  const atual = fechados[fechados.length - 1];
  const ant = fechados[fechados.length - 2] ?? atual;
  const corrente = serie[serie.length - 1];
  const s = (fn: (p: PontoWms) => number) => fechados.map(fn);

  const tempoSep = (p: PontoWms) => p.cargas.separacao.medianaMin;

  return (
    <div>
      <p className="mb-6 text-sm text-slate-500">
        {rotuloMes(atual.mes)} (último mês fechado) vs {rotuloMes(ant.mes)}
      </p>

      {indisponivel.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">
            Parte dos dados não carregou ({indisponivel.join(", ")}). Os indicadores que dependem
            dessas fontes aparecem zerados — não são zero de verdade.
          </p>
        </Card>
      )}

      <SectionTitle>Eficiência — o que diz se o galpão melhorou</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icone={<Ic d={IC_RAZAO} />} nome="Movimentos por tonelada"
          valor={decimal(movimentosPorTonelada(atual), 2)}
          delta={delta(movimentosPorTonelada(atual), movimentosPorTonelada(ant), "menorMelhor")}
          valores={s(movimentosPorTonelada)} cor={CORES.venda} />
        <KpiCard icone={<Ic d={IC_VERT} />} nome="Abastecimentos por carga"
          valor={decimal(abastecimentosPorCarga(atual))}
          delta={delta(abastecimentosPorCarga(atual), abastecimentosPorCarga(ant), "menorMelhor")}
          valores={s(abastecimentosPorCarga)} cor={CORES.venda} />
        <KpiCard icone={<Ic d={IC_RELOGIO} />} nome="Separação por carga (mediana)"
          valor={duracao(tempoSep(atual))}
          delta={delta(tempoSep(atual), tempoSep(ant), "menorMelhor")}
          valores={s(tempoSep)} cor={CORES.venda} />
        <KpiCard icone={<Ic d={IC_RAIO} />} nome="Linhas por hora (coletor)"
          valor={decimal(linhasPorHora(atual.coletor))}
          delta={delta(linhasPorHora(atual.coletor), linhasPorHora(ant.coletor), "maiorMelhor")}
          valores={s((p) => linhasPorHora(p.coletor))} cor={CORES.venda} />
      </div>

      <div className="mt-8">
        <SectionTitle>Volume do mês</SectionTitle>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icone={<Ic d={IC_VERT} />} nome="Movimentos verticais"
          valor={inteiro(atual.mov.verticais)}
          delta={delta(atual.mov.verticais, ant.mov.verticais, "neutro")}
          valores={s((p) => p.mov.verticais)} cor={CORES.pdv} />
        <KpiCard icone={<Ic d={IC_HORIZ} />} nome="Movimentos horizontais"
          valor={inteiro(atual.mov.horizontais)}
          delta={delta(atual.mov.horizontais, ant.mov.horizontais, "neutro")}
          valores={s((p) => p.mov.horizontais)} cor={CORES.pdv} />
        <KpiCard icone={<Ic d={IC_PESO} />} nome="Peso faturado"
          valor={toneladas(atual.pesoFaturadoKg ?? 0)}
          delta={delta(atual.pesoFaturadoKg ?? 0, ant.pesoFaturadoKg ?? 0, "neutro")}
          valores={s((p) => p.pesoFaturadoKg ?? 0)} cor={CORES.pdv} />
        <KpiCard icone={<Ic d={IC_CARGA} />} nome="Cargas expedidas"
          valor={inteiro(atual.cargas.cargas)}
          delta={delta(atual.cargas.cargas, ant.cargas.cargas, "neutro")}
          valores={s((p) => p.cargas.cargas)} cor={CORES.pdv} />
      </div>

      <div className="mt-8">
        <SectionTitle>Estoque hoje</SectionTitle>
      </div>
      {estoque ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="SKUs com saldo" value={inteiro(estoque.skus)} />
          <StatCard label="SKUs sem saída há 90 dias" accent="gold"
            value={inteiro(estoque.skusSemSaida90d)}
            hint={`${formatPercent(porUnidade(estoque.skusSemSaida90d, estoque.skus))} dos SKUs com saldo`} />
          <StatCard label="Ocupação do pulmão"
            value={formatPercent(porUnidade(estoque.pulmaoOcupado, estoque.pulmaoUtil))}
            hint={`${inteiro(estoque.pulmaoOcupado)} de ${inteiro(estoque.pulmaoUtil)} posições`} />
        </div>
      ) : (
        <Card className="p-4"><p className="text-sm text-slate-500">Foto do estoque indisponível.</p></Card>
      )}

      <div className="mt-8">
        <SectionTitle>Mês a mês</SectionTitle>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-semibold">Indicador</th>
              {serie.map((p) => (
                <th key={p.mes} className="px-3 py-3 text-right font-semibold">
                  {rotuloMes(p.mes)}{p === corrente && <span className="block normal-case text-[10px] font-normal">parcial</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums text-[#141a4d]">
            {LINHAS.map(([rotulo, fmt]) => (
              <tr key={rotulo} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 text-slate-600">{rotulo}</td>
                {serie.map((p) => (
                  <td key={p.mes} className={`px-3 py-2.5 text-right ${p === corrente ? "text-slate-400" : ""}`}>{fmt(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6 p-5">
        <SectionTitle>Como ler</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li><b>Vertical</b>: origem ou destino acima do nível 01 (precisa de empilhadeira). <b>Horizontal</b>: tudo no chão. Só movimentos efetivados.</li>
          <li><b>Carga × viagem</b>: um caminhão sai com várias cargas. Carga é a unidade de separação; viagem é cada placa distinta num dia.</li>
          <li><b>Peso</b>: o peso faturado líquido do WinThor, o mesmo do dashboard. O peso das cargas no WMS vem vazio e fica só na tabela até ser validado.</li>
          <li><b>Movimentos por tonelada</b> e <b>abastecimentos por carga</b> separam eficiência de volume: se sobem com o volume estável, o manuseio piorou (slotting ou picking subdimensionado).</li>
          <li><b>Separação por carga</b>: do início da separação ao início da conferência. Mediana, não média: uma carga esquecida aberta não distorce o número. Acima de {TETO_CARGA_MIN / 60} h é descartada (contagem na tabela).</li>
          <li><b>Linhas por hora</b>: só separação por coletor, sobre o tempo em tarefa (não a hora paga). Tarefas acima de {TETO_COLETOR_MIN / 60} h são descartadas.</li>
          <li><b>SKUs sem saída</b>: com saldo e fora de qualquer carga nos últimos 90 dias. O mês corrente aparece em cinza porque ainda está em andamento.</li>
        </ul>
      </Card>
    </div>
  );
}

const LINHAS: [string, (p: PontoWms) => string][] = [
  ["Movimentos verticais", (p) => inteiro(p.mov.verticais)],
  ["Movimentos horizontais", (p) => inteiro(p.mov.horizontais)],
  ["· abastecimentos (pulmão → picking)", (p) => inteiro(p.mov.abastecimentos)],
  ["· armazenagens (recepção)", (p) => inteiro(p.mov.armazenagens)],
  ["· movimentações internas", (p) => inteiro(p.mov.internas)],
  ["· devoluções", (p) => inteiro(p.mov.devolucoes)],
  ["Peso movimentado (endereços)", (p) => formatKg(p.mov.pesoKg)],
  ["SKUs movimentados", (p) => inteiro(p.mov.skusMovimentados)],
  ["Cargas expedidas (WMS)", (p) => inteiro(p.cargas.cargas)],
  ["Viagens (placas distintas por dia)", (p) => inteiro(p.cargas.viagens)],
  ["Cargas por viagem", (p) => decimal(cargasPorViagem(p.cargas))],
  ["Peso faturado (WinThor)", (p) => toneladas(p.pesoFaturadoKg ?? 0)],
  ["Peso das cargas (WMS, a validar)", (p) => toneladas(p.cargas.pesoKg)],
  ["Movimentos por tonelada", (p) => decimal(movimentosPorTonelada(p), 2)],
  ["Abastecimentos por carga", (p) => decimal(abastecimentosPorCarga(p))],
  ["Separação por carga — mediana", (p) => duracao(p.cargas.separacao.medianaMin)],
  ["Separação por carga — P90", (p) => duracao(p.cargas.separacao.p90Min)],
  ["Ciclo da carga (separação → fechamento) — mediana", (p) => duracao(p.cargas.ciclo.medianaMin)],
  ["Cargas descartadas do tempo", (p) => inteiro(p.cargas.separacao.descartadas)],
  ["Tarefas no coletor", (p) => inteiro(p.coletor.tarefas)],
  ["Separadores ativos (coletor)", (p) => inteiro(p.coletor.separadores)],
  ["Linhas por hora (coletor)", (p) => decimal(linhasPorHora(p.coletor))],
];
