import type { DiaSemana, PedidoClassificado, PedidoPendente, Rota } from "./tipos";

// SEGUNDA=0 ... DOMINGO=6 (convenção do Python .weekday()).
const DIAS: Record<string, number> = {
  SEGUNDA: 0, TERCA: 1, QUARTA: 2, QUINTA: 3, SEXTA: 4, SABADO: 5, DOMINGO: 6,
};

/** weekday() estilo Python: segunda=0 ... domingo=6 (JS getDay: domingo=0). */
function weekdayPy(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ddmmaaaa(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Data (meia-noite local) a partir de "YYYY-MM-DD". */
function dataDeISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Próxima ocorrência de `dia` estritamente após `referencia` (delta 0 → +7). */
export function proximoDiaSemanaFuturo(referencia: Date, dia: DiaSemana): Date {
  const alvo = DIAS[dia];
  let delta = (alvo - weekdayPy(referencia) + 7) % 7;
  if (delta === 0) delta = 7;
  return addDias(referencia, delta);
}

function dataPrevistaSemanal(dataLiberacao: Date, diasSaida: string[]): Date | null {
  const candidatos = diasSaida
    .filter((d): d is DiaSemana => d in DIAS)
    .map((d) => proximoDiaSemanaFuturo(dataLiberacao, d).getTime());
  return candidatos.length ? new Date(Math.min(...candidatos)) : null;
}

function camposRota(rota: Rota, dataPrevista: Date | null) {
  return {
    rota: rota.rota,
    grupoRota: rota.grupoRota,
    regiaoOperacional: rota.regiaoOperacional,
    diaSaidaRota: rota.diaSaidaRota.length ? rota.diaSaidaRota : null,
    diaLimitePedido: rota.diaLimitePedido,
    janelaEntrega: rota.janelaEntrega.length ? rota.janelaEntrega : null,
    dataPrevistaFaturamento: dataPrevista ? isoDate(dataPrevista) : null,
    observacaoRota: rota.observacao,
  };
}

export function classificarPedido(
  pedido: PedidoPendente,
  rota: Rota | null,
  hoje: Date,
): PedidoClassificado {
  const base = { ...pedido };
  const h = pedido.horasParado;

  // 1. Sem calendário
  if (rota === null) {
    const critico = h >= 72;
    return {
      ...base,
      rota: null, grupoRota: null, regiaoOperacional: null, diaSaidaRota: null,
      diaLimitePedido: null, janelaEntrega: null, dataPrevistaFaturamento: null,
      situacaoRota: "SEM_CALENDARIO_USANDO_72H",
      observacaoRota: "Cidade não encontrada no calendário de rotas.",
      prioridade: critico ? "AJUSTAR_CALENDARIO" : "BAIXA",
      motivoPrioridade: critico
        ? `Cidade '${pedido.cidadeCliente}' fora do calendário e ${h.toFixed(0)}h parado (acima de 72h).`
        : `Cidade '${pedido.cidadeCliente}' fora do calendário, dentro das 72h (${h.toFixed(0)}h).`,
    };
  }

  const regiao = (rota.regiaoOperacional ?? "").toUpperCase();
  const liberacao = dataDeISO(pedido.dataLiberacao);

  // 2. METROPOLITANA — por horas
  if (regiao === "METROPOLITANA") {
    const prevista = addDias(liberacao, 3);
    const campos = camposRota(rota, prevista);
    if (h >= 72) {
      return { ...base, ...campos, situacaoRota: "ATRASADO_PARA_FATURAMENTO",
        prioridade: "CRITICA", motivoPrioridade: `Metropolitana: ${h.toFixed(0)}h parado — acima de 72h.` };
    }
    if (h >= 48) {
      return { ...base, ...campos, situacaoRota: "SAIDA_HOJE",
        prioridade: "ALTA", motivoPrioridade: `Metropolitana: ${h.toFixed(0)}h parado — entre 48h e 72h, faturar hoje.` };
    }
    return { ...base, ...campos, situacaoRota: "AGUARDANDO_DIA_DE_FATURAMENTO",
      prioridade: "BAIXA", motivoPrioridade: `Metropolitana: ${h.toFixed(0)}h parado — dentro das 48h.` };
  }

  // 3. FORA_PE / ESPECIAL — tolerância 72h, sem rota operacional
  if (regiao === "FORA_PE" || regiao === "ESPECIAL") {
    const campos = camposRota(rota, null);
    const critico = h >= 72;
    return { ...base, ...campos, situacaoRota: "SEM_CALENDARIO_USANDO_72H",
      prioridade: critico ? "AJUSTAR_CALENDARIO" : "BAIXA",
      motivoPrioridade: `${regiao}: ${h.toFixed(0)}h parado — ${critico ? "acima de 72h" : "dentro de 72h"}, sem rota operacional padrão.` };
  }

  // 4. Rota semanal (inclui SERTAO e demais regiões)
  const prevista = dataPrevistaSemanal(liberacao, rota.diaSaidaRota);
  const campos = camposRota(rota, prevista);
  if (prevista === null) {
    return { ...base, ...campos, situacaoRota: "SEM_CALENDARIO_USANDO_72H",
      prioridade: "AJUSTAR_CALENDARIO",
      motivoPrioridade: "Dias de saída configurados na rota não foram reconhecidos." };
  }
  const hojeMid = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const amanha = addDias(hojeMid, 1);
  const fmt = ddmmaaaa(prevista);
  if (prevista.getTime() < hojeMid.getTime()) {
    return { ...base, ...campos, situacaoRota: "ATRASADO_PARA_FATURAMENTO",
      prioridade: "CRITICA", motivoPrioridade: `Data prevista (${fmt}) já passou. Pedido atrasado — rota ${rota.rota}.` };
  }
  if (prevista.getTime() === hojeMid.getTime()) {
    return { ...base, ...campos, situacaoRota: "SAIDA_HOJE",
      prioridade: "ALTA", motivoPrioridade: `Rota ${rota.rota} tem saída hoje (${fmt}). Faturar com urgência.` };
  }
  if (prevista.getTime() === amanha.getTime()) {
    return { ...base, ...campos, situacaoRota: "AGUARDANDO_DIA_DE_FATURAMENTO",
      prioridade: "MEDIA", motivoPrioridade: `Rota ${rota.rota} sai amanhã (${fmt}). Faturar hoje.` };
  }
  return { ...base, ...campos, situacaoRota: "AGUARDANDO_DIA_DE_FATURAMENTO",
    prioridade: "BAIXA", motivoPrioridade: `Rota ${rota.rota} sai em ${fmt}. Dentro do prazo.` };
}
