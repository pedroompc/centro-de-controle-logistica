// Saúde do coletor da telemetria (scripts/coletor-frota). Ele grava as posições
// a cada 10 min em frota_hodometro_diario; se a última gravação fica velha, o
// coletor parou (serviço caiu, servidor reiniciou, API da Fulltrack fora) e o
// KM rodado passa a sair menor sem ninguém perceber.

export type EstadoColetor = "ok" | "atrasado" | "parado" | "sem-dados";

export interface SaudeTelemetria {
  estado: EstadoColetor;
  /** Minutos desde a última gravação do coletor; null = nenhuma gravação recente. */
  minutos: number | null;
  /** Veículos (placas) com leitura nas últimas 24h. */
  comunicando: number;
}

const ATRASO_MIN = 30; // 3 ciclos perdidos
const PARADO_MIN = 120;

export function saudeColetor(
  ultimaGravacao: Date | null,
  leituras: { ultimaLeitura: Date | null }[],
  agora: Date = new Date(),
): SaudeTelemetria {
  const limite24h = agora.getTime() - 24 * 3600_000;
  const comunicando = leituras.filter((l) => l.ultimaLeitura && l.ultimaLeitura.getTime() >= limite24h).length;
  if (!ultimaGravacao) return { estado: "sem-dados", minutos: null, comunicando };
  const minutos = Math.max(0, Math.floor((agora.getTime() - ultimaGravacao.getTime()) / 60_000));
  const estado: EstadoColetor = minutos <= ATRASO_MIN ? "ok" : minutos <= PARADO_MIN ? "atrasado" : "parado";
  return { estado, minutos, comunicando };
}

/** "agora", "há 25 min", "há 3 h", "há 2 dias". */
export function haQuanto(minutos: number): string {
  if (minutos < 2) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const h = Math.floor(minutos / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dias`;
}
