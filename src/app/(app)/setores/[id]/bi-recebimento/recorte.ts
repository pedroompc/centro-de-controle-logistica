// O recorte do BI do Recebimento — o que os quadros e visuais mostram. Sem
// "use client": roda também no servidor (comparação das abas do BI Geral).
import { filtrarFatos, resumir, custoNoRecorte, type FiltroBI, type ResumoFatos } from "@/domain/bi-recebimento";
import type { IndicadoresRecebimento } from "@/domain/recebimento";
import type { DadosBI } from "./base";

export interface Recorte {
  r: IndicadoresRecebimento; // o mês (série mensal)
  mes: ResumoFatos; // o mês inteiro, dos fatos
  sel: ResumoFatos; // o recorte filtrado
  custo: number;
  criterioCusto: string | null;
  porNotas: boolean; // filtro de fornecedor: "carros" viram notas
  temFatos: boolean;
}

export function recortar(dados: DadosBI, filtro: FiltroBI): Recorte | null {
  const r = dados.ref ?? dados.serie.find((x) => x.mes === dados.mes);
  if (!r) return null;
  const fatos = dados.fatos ?? [];
  const mes = resumir(fatos);
  const sel = resumir(filtrarFatos(fatos, filtro));
  const pesoDoDia = filtro.dia ? resumir(filtrarFatos(fatos, { dia: filtro.dia })).pesoKg : 0;
  const { custo, criterio } = custoNoRecorte({ custoMes: r.custoPeriodo, diasMes: mes.dias, pesoMes: mes.pesoKg, pesoDoDia, pesoRecorte: sel.pesoKg, filtro });
  return { r, mes, sel, custo, criterioCusto: criterio, porNotas: !!filtro.fornecedor, temFatos: dados.fatos !== null };
}

