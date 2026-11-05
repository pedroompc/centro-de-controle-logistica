"use client";

/**
 * BI do Abastecimento em tela cheia — mesma moldura e peças do BI da
 * Separação. Custo e equipe vêm do cadastro. O resto vem do Harpia (WMS), de
 * DUAS fontes diferentes:
 *  - Volume/Antecedência/Giro: `PREPARA_ABAST_*` — o FATURAMENTO preparando
 *    carga/guia pra separação. Quem gera ali NÃO é quem executa no piso, por
 *    isso essa parte nunca rankeia por usuário.
 *  - Movimentação: `MOVIMENT_END_502` (reserva → picking) — a equipe REAL de
 *    piso (depto Logística). Aqui sim o ranking por pessoa é legítimo.
 * `dia` é um filtro CRUZADO: clicar num dia em Volume, Antecedência ou
 * Movimentação filtra as três. Esc limpa. Pessoa (Movimentação) e produto
 * (Giro) abrem histórico diário ao clicar — clique de novo fecha.
 */
// bi-abastecimento.tsx foi dividido em bi-abastecimento/ (um módulo por grupo de slides/abas).
export { BIAbastecimento } from "./bi-abastecimento/principal";
