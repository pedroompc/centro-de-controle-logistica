"use client";

// secoes.tsx foi dividido em secoes/ (um módulo por grupo de slides/abas).
export { SETOR_COR, type KpiDelta, Kpi, SetorBar, type LinhaRanking, BigRanking, RankingDuasColunas, MiniBarras } from "./secoes/base";
export { SecaoClientesVendedores, SecaoMotoristas, SecaoMotivos } from "./secoes/devolucao";
export { SecaoAFaturar, SecaoTempoFaturar } from "./secoes/faturar";
export { SecaoReceitas } from "./secoes/receitas";
export { SecaoDescarregos } from "./secoes/descarrego";
export { SecaoFrota } from "./secoes/frota";
export { SecaoCortes } from "./secoes/cortes";
