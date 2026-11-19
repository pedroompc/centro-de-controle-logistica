import { type NextRequest } from "next/server";
import { getXmlsNfePorPedidos, lerListaPedidos } from "@/data/danfe";
import { parseNfe, type DanfeData } from "@/domain/danfe/parse-nfe";
import type { DanfeWinthor } from "@/data/danfe";
import { renderDanfesHtml } from "@/lib/danfe/html";

// Node runtime: bwip-js e oracledb precisam de APIs de Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTML = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
const MAXIMO = 60; // notas por impressão

function erro(status: number, msg: string): Response {
  const texto = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>DANFEs</title></head>` +
      `<body style="margin:0;font:14px system-ui,sans-serif;color:#9f1239;background:#fff1f2;padding:24px;text-align:center">${texto}</body></html>`,
    { status, headers: HTML },
  );
}

// GET /pedidos/notas?p=123,456[&imprimir=1] → os DANFEs dos pedidos, um por folha A4,
// na ordem pedida (botão "Imprimir notas" dos pedidos selecionados na consulta).
// Pedido sem NF-e ou com erro fica de fora e aparece num aviso na tela.
// Protegido pelo proxy.ts (redireciona ao /login sem sessão).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pedidos = lerListaPedidos(sp.get("p"));
  if (pedidos.length === 0) return erro(400, "Nenhum pedido informado.");
  if (pedidos.length > MAXIMO) return erro(400, `Selecione no máximo ${MAXIMO} notas por impressão (vieram ${pedidos.length}).`);

  const notas: { d: DanfeData; wt: DanfeWinthor }[] = [];
  const avisos: string[] = [];
  for (const r of await getXmlsNfePorPedidos(pedidos)) {
    if ("erro" in r) avisos.push(`Pedido ${r.numped}: ${r.erro}`);
    else if (!r.nf) avisos.push(`Pedido ${r.numped}: sem NF-e com XML no banco.`);
    else {
      try {
        notas.push({ d: parseNfe(r.nf.xml), wt: r.nf.winthor });
      } catch (e) {
        avisos.push(`Pedido ${r.numped}: ${(e as Error).message}`);
      }
    }
  }
  if (notas.length === 0) return erro(404, avisos.join(" "));
  try {
    return new Response(renderDanfesHtml(notas, avisos, sp.get("imprimir") === "1"), { status: 200, headers: HTML });
  } catch (e) {
    return erro(500, `Erro ao montar os DANFEs: ${(e as Error).message}`);
  }
}
