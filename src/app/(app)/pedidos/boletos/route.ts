import { type NextRequest } from "next/server";
import { getParcelasBoletoPorPedidos } from "@/data/boletos";
import { lerListaPedidos } from "@/data/danfe";
import { montarBoleto, type Boleto } from "@/domain/boletos";
import { renderBoletosHtml } from "@/lib/boletos/html";

// Node runtime: bwip-js e oracledb precisam de APIs de Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTML = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
const MAXIMO = 60; // notas por vez, como a impressão dos DANFEs

function erro(status: number, msg: string): Response {
  const texto = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Boletos</title></head>` +
      `<body style="margin:0;font:14px system-ui,sans-serif;color:#9f1239;background:#fff1f2;padding:24px;text-align:center">${texto}</body></html>`,
    { status, headers: HTML },
  );
}

// GET /pedidos/boletos?p=123,456 → os boletos das NFs dos pedidos, um por folha A4,
// na ordem pedida (botão "PDF dos boletos" dos pedidos selecionados na consulta).
// Pedido sem boleto fica de fora e aparece num aviso na tela.
// Protegido pelo proxy.ts (redireciona ao /login sem sessão).
export async function GET(req: NextRequest) {
  const pedidos = lerListaPedidos(req.nextUrl.searchParams.get("p"));
  if (pedidos.length === 0) return erro(400, "Nenhum pedido informado.");
  if (pedidos.length > MAXIMO) return erro(400, `Selecione no máximo ${MAXIMO} notas por vez (vieram ${pedidos.length}).`);

  let porPedido;
  try {
    porPedido = await getParcelasBoletoPorPedidos(pedidos);
  } catch (e) {
    return erro(502, `Erro ao buscar os boletos: ${(e as Error).message}`);
  }

  const hoje = new Date();
  const boletos: Boleto[] = [];
  const avisos: string[] = [];
  for (const numped of pedidos) {
    const parcelas = porPedido.get(numped);
    if (!parcelas) {
      avisos.push(`Pedido ${numped}: nenhum boleto no Winthor.`);
      continue;
    }
    try {
      boletos.push(...parcelas.map((p) => montarBoleto(p, hoje)));
    } catch (e) {
      avisos.push(`Pedido ${numped}: ${(e as Error).message}`);
    }
  }
  if (boletos.length === 0) return erro(404, avisos.length === 1 ? avisos[0] : `Nenhum boleto encontrado para as notas selecionadas. ${avisos.join(" ")}`);
  try {
    return new Response(renderBoletosHtml(boletos, avisos), { status: 200, headers: HTML });
  } catch (e) {
    return erro(500, `Erro ao montar os boletos: ${(e as Error).message}`);
  }
}
