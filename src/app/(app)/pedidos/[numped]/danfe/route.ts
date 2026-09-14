import { type NextRequest } from "next/server";
import { getXmlNfePorPedido } from "@/data/danfe";
import { parseNfe } from "@/domain/danfe/parse-nfe";
import { renderDanfePdf } from "@/lib/danfe/render";

// Node runtime: pdf-lib, bwip-js e oracledb precisam de APIs de Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /pedidos/:numped/danfe → devolve o DANFE em PDF (download).
// Protegido pelo proxy.ts (redireciona ao /login sem sessão).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ numped: string }> }) {
  const { numped } = await params;
  const n = Number(numped);
  if (!Number.isInteger(n) || n <= 0) {
    return new Response("Pedido inválido.", { status: 400 });
  }

  let nf;
  try {
    nf = await getXmlNfePorPedido(n);
  } catch (e) {
    return new Response(`Erro ao buscar a nota: ${(e as Error).message}`, { status: 502 });
  }
  if (!nf) {
    return new Response("Este pedido não tem NF-e com XML disponível no banco.", { status: 404 });
  }

  try {
    const pdf = await renderDanfePdf(parseNfe(nf.xml));
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="DANFE-${nf.numnota}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`Erro ao gerar o DANFE: ${(e as Error).message}`, { status: 500 });
  }
}
