import { type NextRequest } from "next/server";
import { getXmlNfePorPedido } from "@/data/danfe";
import { parseNfe, type DanfeData } from "@/domain/danfe/parse-nfe";
import type { DanfeWinthor } from "@/data/danfe";
import { renderDanfesHtml } from "@/lib/danfe/html";

// Node runtime: bwip-js e oracledb precisam de APIs de Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HTML = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
const MAXIMO = 60; // notas por impressão
const SIMULTANEAS = 4; // consultas ao Oracle ao mesmo tempo

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
  const pedidos = [...new Set((sp.get("p") ?? "").split(",").map((v) => Number(v.trim())))].filter((n) => Number.isInteger(n) && n > 0);
  if (pedidos.length === 0) return erro(400, "Nenhum pedido informado.");
  if (pedidos.length > MAXIMO) return erro(400, `Selecione no máximo ${MAXIMO} notas por impressão (vieram ${pedidos.length}).`);

  type Resultado = { ok: true; nota: { d: DanfeData; wt: DanfeWinthor } } | { ok: false; aviso: string };
  const resultados: Resultado[] = new Array(pedidos.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < pedidos.length) {
      const i = proximo++;
      const numped = pedidos[i];
      try {
        const nf = await getXmlNfePorPedido(numped);
        resultados[i] = nf
          ? { ok: true, nota: { d: parseNfe(nf.xml), wt: nf.winthor } }
          : { ok: false, aviso: `Pedido ${numped}: sem NF-e com XML no banco.` };
      } catch (e) {
        resultados[i] = { ok: false, aviso: `Pedido ${numped}: ${(e as Error).message}` };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SIMULTANEAS, pedidos.length) }, trabalhador));

  const notas = resultados.flatMap((r) => (r.ok ? [r.nota] : []));
  const avisos = resultados.flatMap((r) => (r.ok ? [] : [r.aviso]));
  if (notas.length === 0) return erro(404, avisos.join(" "));
  try {
    return new Response(renderDanfesHtml(notas, avisos, sp.get("imprimir") === "1"), { status: 200, headers: HTML });
  } catch (e) {
    return erro(500, `Erro ao montar os DANFEs: ${(e as Error).message}`);
  }
}
