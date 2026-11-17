// Abre o diálogo de impressão do navegador com um documento HTML pronto (A4):
// dali se imprime direto ou se escolhe "Salvar como PDF". O documento roda num
// iframe escondido (sem pop-up, que o navegador bloquearia) e o <title> vira o
// nome sugerido do arquivo PDF.
export function imprimirRelatorio(html: string): void {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  f.setAttribute("aria-hidden", "true");
  let removido = false;
  const remover = () => {
    if (removido) return;
    removido = true;
    f.remove();
  };
  f.onload = () => {
    const w = f.contentWindow;
    if (!w) return remover();
    // O título da página principal é o que alguns navegadores usam no nome do PDF.
    const tituloOriginal = document.title;
    document.title = w.document.title || tituloOriginal;
    w.addEventListener("afterprint", () => {
      document.title = tituloOriginal;
      setTimeout(remover, 500);
    });
    w.focus();
    w.print();
    // Rede de segurança: navegadores que não disparam afterprint.
    setTimeout(() => {
      document.title = tituloOriginal;
      remover();
    }, 120_000);
  };
  f.srcdoc = html;
  document.body.appendChild(f);
}
