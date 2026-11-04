import { type NextRequest } from "next/server";
import { getXmlNfePorPedido } from "@/data/danfe";
import { parseNfe } from "@/domain/danfe/parse-nfe";
import { renderDanfeHtml } from "@/lib/danfe/html";

// Node runtime: bwip-js e oracledb precisam de APIs de Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTML = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

// Mensagem de erro como página simples — aparece dentro do modal (iframe).
function erro(status: number, msg: string): Response {
  const texto = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>DANFE</title></head>` +
      `<body style="margin:0;font:14px system-ui,sans-serif;color:#9f1239;background:#fff1f2;padding:24px;text-align:center">${texto}</body></html>`,
    { status, headers: HTML },
  );
}

// GET /pedidos/:numped/danfe → DANFE em HTML no layout da nota impressa (Winthor),
// pronto para imprimir / salvar PDF pelo navegador.
// Protegido pelo proxy.ts (redireciona ao /login sem sessão).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ numped: string }> }) {
  const { numped } = await params;
  const n = Number(numped);
  if (!Number.isInteger(n) || n <= 0) return erro(400, "Pedido inválido.");

  let nf;
  try {
    nf = await getXmlNfePorPedido(n);
  } catch (e) {
    return erro(502, `Erro ao buscar a nota: ${(e as Error).message}`);
  }
  if (!nf) return erro(404, "Este pedido não tem NF-e com XML disponível no banco.");

  try {
    return new Response(renderDanfeHtml(parseNfe(nf.xml), nf.winthor), { status: 200, headers: HTML });
  } catch (e) {
    return erro(500, `Erro ao montar o DANFE: ${(e as Error).message}`);
  }
}
