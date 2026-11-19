// Baixa o XML das NF-e dos pedidos (/pedidos/notas/xml): um pedido → o .xml;
// vários → um .zip. Vai por fetch para mostrar o erro da rota num alerta em vez
// de abrir uma página de erro.

/** Até quantas notas o botão aceita por vez (mesmo limite da rota). */
export const MAX_XML = 200;

export async function baixarXmls(pedidos: number[]): Promise<void> {
  const resp = await fetch(`/pedidos/notas/xml?p=${pedidos.join(",")}`, { cache: "no-store" });
  const disposicao = resp.headers.get("Content-Disposition") ?? "";
  if (!resp.ok || !disposicao.includes("attachment")) {
    // Sem anexo e 200 = o proxy mandou para o login (sessão expirou).
    const texto = resp.ok ? "Sua sessão expirou. Entre de novo e tente outra vez." : (await resp.text()).trim();
    throw new Error(texto || "Não foi possível baixar o XML.");
  }
  const arquivo = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? "notas.xml";
  const link = URL.createObjectURL(await resp.blob());
  const a = document.createElement("a");
  a.href = link;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(link), 10_000);
}
