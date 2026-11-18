import { type NextRequest } from "next/server";
import { lerCortes } from "@/data/cortes";
import { lerFaltasDigitacao } from "@/data/falta-digitacao";
import { faltasParaCsv, filtrarFaltas } from "@/domain/falta-digitacao";
import { cortesParaCsv, filtrarCortes, DIMENSOES_CORTE, type FiltrosCorte } from "@/domain/cortes";
import { lerPeriodo, mesDoPeriodo } from "@/domain/periodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /cortes/export?mes=… (ou de=…&ate=…)&dia=…&motivo=…&fornecedor=… → planilha (CSV) do mês com os
// mesmos filtros da página. Com tipo=faltas, a planilha da falta na digitação (PCFALTA).
// Protegido pelo proxy.ts (sem sessão vai ao /login).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const periodo = lerPeriodo({ mes: sp.get("mes") ?? undefined, de: sp.get("de") ?? undefined, ate: sp.get("ate") ?? undefined });
  const filtros: FiltrosCorte = {};
  for (const d of DIMENSOES_CORTE) {
    const v = sp.get(d);
    if (v) filtros[d] = v;
  }
  const { de: inicio, ate: fim } = periodo;
  const mes = mesDoPeriodo(periodo);
  // Dia escolhido no gráfico da página (só vale dentro do período).
  const diaParam = sp.get("dia");
  const dia = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) && diaParam >= inicio && diaParam <= fim ? diaParam : null;
  const sufixo = mes ? mes.slice(0, 7) : `${inicio}_a_${fim}`;
  if (sp.get("tipo") === "faltas") {
    let faltas;
    try {
      faltas = filtrarFaltas(await lerFaltasDigitacao(inicio, fim), filtros);
    } catch (e) {
      return new Response(`Sem acesso ao Winthor agora: ${(e as Error).message}`, { status: 502 });
    }
    return new Response(faltasParaCsv(faltas), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="faltas-digitacao-${sufixo}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  let linhas;
  try {
    linhas = filtrarCortes(await lerCortes(inicio, fim), filtros);
    if (dia) linhas = linhas.filter((l) => l.dia === dia);
  } catch (e) {
    return new Response(`Sem acesso ao Winthor agora: ${(e as Error).message}`, { status: 502 });
  }
  return new Response(cortesParaCsv(linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cortes-${sufixo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
