import { getResumoFaturamento } from "./faturamento";
import { getNucleoDevolucao, getDevolucaoLogisticaPorFaturamento } from "./devolucoes";
import { lerViagensMes } from "./winthor-entregas";
import { FILIAL_LABEL } from "./filiais";
import { inicioFimDoMes, mesAnterior, primeiroDiaDoMes } from "@/domain/periodo";
import { fecharConferencia, type Conferencia, type ParConferencia } from "@/domain/conferencia";

// Os pares conferidos. Cada um foi medido no Oracle antes de entrar:
// - devolução: VIEW_DEVOL_RESUMO (página Devoluções) × VIEW_BI (Dashboard/111),
//   ≤ R$ 2/mês em jul–nov/2026 → tolerância R$ 5;
// - foto × ao vivo (mês fechado): a foto do Supabase alimenta Tendências;
// - notas expedidas: BI Motoristas × devolução por motorista — mesma regra
//   (notaExpedida + motoristaDeEntrega), 0 de diferença em ago–out/2026.

const TOL_DEVOLUCAO = 5;
const TOL_FOTO = 1;

/** Foto do mês no Supabase, com a chave de serviço (a rodada não tem sessão). */
async function lerFoto(mes: string): Promise<{ venda_liquida: number; valor_devolucao: number; emitidas: number } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  const q = `mes=eq.${mes}&filial=eq.${encodeURIComponent(FILIAL_LABEL)}&select=venda_liquida,valor_devolucao,emitidas`;
  const r = await fetch(`${url}/rest/v1/faturamento_mensal?${q}`, { headers: { apikey: chave, Authorization: `Bearer ${chave}` }, cache: "no-store" });
  if (!r.ok) return null;
  const [linha] = (await r.json()) as Record<string, unknown>[];
  return linha ? { venda_liquida: Number(linha.venda_liquida), valor_devolucao: Number(linha.valor_devolucao), emitidas: Number(linha.emitidas) } : null;
}

const ouNull = <T,>(p: Promise<T>) => p.catch((e) => {
  console.error("[conferencia] leitura falhou:", (e as Error).message);
  return null;
});

async function paresDoMes(mes: string, fechado: boolean): Promise<ParConferencia[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  // Em sequência: a VIEW_BI leva ~7 s e a rodada não deve tomar o pool das telas.
  const fat = await ouNull(getResumoFaturamento(inicio, fim));
  const nucleo = await ouNull(getNucleoDevolucao(inicio, fim));
  const viagens = await ouNull(lerViagensMes(mes));
  const devMot = await ouNull(getDevolucaoLogisticaPorFaturamento(inicio, fim));
  const foto = fechado ? await ouNull(lerFoto(mes)) : null;

  const pares: ParConferencia[] = [
    {
      chave: `devolucao·${mes}`, nome: "Devolução: página Devoluções × Dashboard", mes, unidade: "R$", tolerancia: TOL_DEVOLUCAO,
      a: { fonte: "VIEW_DEVOL_RESUMO_FATURAMENTO", valor: nucleo?.total ?? null },
      b: { fonte: "VIEW_BI_FATURAMENTO", valor: fat?.valorDevolucao ?? null },
    },
    {
      chave: `expedidas·${mes}`, nome: "Notas expedidas: BI Motoristas × devolução por motorista", mes, unidade: "notas", tolerancia: 0,
      a: { fonte: "BI Motoristas (viagens)", valor: viagens ? viagens.reduce((s, v) => s + v.notas, 0) : null },
      b: { fonte: "Devolução por motorista", valor: devMot ? devMot.reduce((s, d) => s + d.expedidas, 0) : null },
    },
  ];
  if (fechado) {
    pares.push(
      {
        chave: `foto-venda·${mes}`, nome: "Venda líquida: foto do mês × Winthor ao vivo", mes, unidade: "R$", tolerancia: TOL_FOTO,
        a: { fonte: "Foto (Supabase)", valor: foto?.venda_liquida ?? null },
        b: { fonte: "Winthor", valor: fat?.vendaLiquida ?? null },
      },
      {
        chave: `foto-emitidas·${mes}`, nome: "NFs emitidas: foto do mês × Winthor ao vivo", mes, unidade: "notas", tolerancia: 0,
        a: { fonte: "Foto (Supabase)", valor: foto?.emitidas ?? null },
        b: { fonte: "Winthor", valor: fat?.emitidas ?? null },
      },
    );
  }
  return pares;
}

/** Mês corrente + os 2 fechados anteriores. */
export async function rodarConferencia(agora: Date = new Date()): Promise<Conferencia> {
  const atual = primeiroDiaDoMes(agora.toLocaleDateString("sv-SE", { timeZone: "America/Recife" }));
  const meses = [mesAnterior(mesAnterior(atual)), mesAnterior(atual), atual];
  const pares: ParConferencia[] = [];
  for (const m of meses) pares.push(...(await paresDoMes(m, m < atual)));
  return fecharConferencia(pares);
}
