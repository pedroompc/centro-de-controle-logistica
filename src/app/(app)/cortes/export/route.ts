import { type NextRequest } from "next/server";
import { lerCortes } from "@/data/cortes";
import { cortesParaCsv, filtrarCortes, DIMENSOES_CORTE, type FiltrosCorte } from "@/domain/cortes";
import { primeiroDiaDoMes, limitarAoHistorico, inicioFimDoMes } from "@/domain/periodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /cortes/export?mes=…&motivo=…&fornecedor=… → planilha (CSV) do mês com os
// mesmos filtros da página. Protegido pelo proxy.ts (sem sessão vai ao /login).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mes = limitarAoHistorico(sp.get("mes") ? primeiroDiaDoMes(sp.get("mes")!) : primeiroDiaDoMes());
  const filtros: FiltrosCorte = {};
  for (const d of DIMENSOES_CORTE) {
    const v = sp.get(d);
    if (v) filtros[d] = v;
  }
  const { inicio, fim } = inicioFimDoMes(mes);
  let linhas;
  try {
    linhas = filtrarCortes(await lerCortes(inicio, fim), filtros);
  } catch (e) {
    return new Response(`Sem acesso ao Winthor agora: ${(e as Error).message}`, { status: 502 });
  }
  return new Response(cortesParaCsv(linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cortes-${mes.slice(0, 7)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
