import { type NextRequest } from "next/server";
import { lerCortes } from "@/data/cortes";
import { cortesParaCsv, filtrarCortes, DIMENSOES_CORTE, type FiltrosCorte } from "@/domain/cortes";
import { lerPeriodo, mesDoPeriodo } from "@/domain/periodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /cortes/export?mes=… (ou de=…&ate=…)&dia=…&motivo=…&fornecedor=… → planilha (CSV) do mês com os
// mesmos filtros da página. Protegido pelo proxy.ts (sem sessão vai ao /login).
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
      "Content-Disposition": `attachment; filename="cortes-${mes ? mes.slice(0, 7) : `${inicio}_a_${fim}`}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
