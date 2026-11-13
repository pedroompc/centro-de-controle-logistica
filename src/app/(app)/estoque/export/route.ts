import { type NextRequest } from "next/server";
import { lerProdutosEstoque } from "@/data/estoque";
import { linhasTabela, tabelaParaCsv, type TipoTabela } from "@/domain/estoque";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARQUIVO: Record<TipoTabela, string> = { excesso: "Excesso_Estoque", obsoletos: "ISV", ruptura: "Ruptura" };

// GET /estoque/export?tipo=excesso|obsoletos|ruptura&comprador=… → planilha (CSV)
// com o filtro de comprador da tela. Protegido pelo proxy.ts (sem sessão vai ao /login).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tipo = (["excesso", "obsoletos", "ruptura"] as const).find((t) => t === sp.get("tipo"));
  if (!tipo) return new Response("Tipo de planilha inválido.", { status: 400 });
  const comprador = sp.get("comprador");
  const cod = comprador && /^\d+$/.test(comprador) ? Number(comprador) : null;
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Recife" });
  let produtos;
  try {
    produtos = await lerProdutosEstoque();
  } catch (e) {
    return new Response(`Sem acesso ao Winthor agora: ${(e as Error).message}`, { status: 502 });
  }
  if (cod !== null) produtos = produtos.filter((p) => p.codcomprador === cod);
  return new Response(tabelaParaCsv(linhasTabela(produtos, tipo, hoje), tipo), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ARQUIVO[tipo]}-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
