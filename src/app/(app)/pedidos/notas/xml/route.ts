import { type NextRequest } from "next/server";
import { getXmlsNfePorPedidos, lerListaPedidos } from "@/data/danfe";
import { criarZip, type ArquivoZip } from "@/lib/zip";

// Node runtime: oracledb e node:zlib.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMO = 200; // notas por exportação

// Erro em texto puro: o botão baixa por fetch e mostra a mensagem num alerta.
function erro(status: number, msg: string): Response {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

function anexo(corpo: BodyInit, tipo: string, arquivo: string): Response {
  return new Response(corpo, {
    status: 200,
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}

// GET /pedidos/notas/xml?p=123,456 → XML autorizado (nfeProc, com o protocolo da
// SEFAZ, como está no PCDOCELETRONICO) das NF-e dos pedidos.
// Uma nota → NF-<número>.xml. Várias → XML-<qtd>-notas.zip com um NF-<número>.xml
// por nota e, se algum pedido ficou de fora, um AVISOS.txt dizendo qual e por quê.
// Protegido pelo proxy.ts (redireciona ao /login sem sessão).
export async function GET(req: NextRequest) {
  const pedidos = lerListaPedidos(req.nextUrl.searchParams.get("p"));
  if (pedidos.length === 0) return erro(400, "Nenhum pedido informado.");
  if (pedidos.length > MAXIMO) return erro(400, `Selecione no máximo ${MAXIMO} notas por exportação (vieram ${pedidos.length}).`);

  const arquivos: ArquivoZip[] = [];
  const nomes = new Set<string>();
  const avisos: string[] = [];
  for (const r of await getXmlsNfePorPedidos(pedidos)) {
    if ("erro" in r) avisos.push(`Pedido ${r.numped}: ${r.erro}`);
    else if (!r.nf) avisos.push(`Pedido ${r.numped}: sem NF-e com XML no banco.`);
    else {
      const nome = `NF-${r.nf.numnota}.xml`;
      if (nomes.has(nome)) continue; // mesma NF em dois pedidos
      nomes.add(nome);
      arquivos.push({ nome, dados: r.nf.xml });
    }
  }
  if (arquivos.length === 0) return erro(404, avisos.join("\n") || "Nenhuma nota com XML.");

  if (pedidos.length === 1) {
    const [a] = arquivos;
    return anexo(a.dados as string, "application/xml; charset=utf-8", a.nome);
  }
  if (avisos.length) arquivos.push({ nome: "AVISOS.txt", dados: `Notas que ficaram de fora:\r\n${avisos.join("\r\n")}\r\n` });
  const zip = criarZip(arquivos);
  const qtd = arquivos.length - (avisos.length ? 1 : 0);
  return anexo(new Uint8Array(zip), "application/zip", `XML-${qtd}-notas.zip`);
}
