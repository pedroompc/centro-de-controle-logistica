"use client";

/**
 * BI do Recebimento no Painel da Operação (tema escuro da TV).
 *
 * O topo é o MENU: cada quadro mostra o número do recorte e, ao clicar, abre a
 * visão no palco. FILTRO CRUZADO (estilo Power BI): clicar num dia, num
 * fornecedor ou num tipo de carga filtra TODOS os quadros e visuais; cada
 * visual ignora o filtro da própria dimensão e só destaca o item escolhido.
 *
 * Tudo em TOTAL do recorte (nada por pessoa). O custo é do mês: no recorte ele
 * é rateado (por dia de descarrego e pelo peso) — o critério aparece na tela.
 */
// bi-recebimento.tsx foi dividido em bi-recebimento/ (um módulo por grupo de slides/abas).
export { type VisaoBI, VISOES_BI, type DadosBI } from "./bi-recebimento/base";
export { MenuBI, PalcoBI } from "./bi-recebimento/menu";
