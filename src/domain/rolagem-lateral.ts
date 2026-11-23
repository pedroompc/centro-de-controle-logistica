// Regras da rolagem lateral das tabelas largas (botões ◀ ▶). Puro, para testar.

export interface MedidaRolagem {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export interface EstadoRolagem {
  /** A tabela é mais larga que a área visível? */
  transborda: boolean;
  podeEsquerda: boolean;
  podeDireita: boolean;
}

/** Folga de 1px: zoom e telas de alta densidade deixam frações no scrollLeft. */
export function estadoRolagem({ scrollLeft, scrollWidth, clientWidth }: MedidaRolagem): EstadoRolagem {
  const transborda = scrollWidth - clientWidth > 1;
  return {
    transborda,
    podeEsquerda: transborda && scrollLeft > 1,
    podeDireita: transborda && scrollLeft + clientWidth < scrollWidth - 1,
  };
}

/**
 * Quanto anda um clique: ~80% da parte que rola (área visível menos as colunas
 * fixas à esquerda), para sobrar um pedaço da tela anterior como referência.
 */
export function passoRolagem(clientWidth: number, larguraFixa = 0): number {
  return Math.max(160, Math.round((clientWidth - larguraFixa) * 0.8));
}
