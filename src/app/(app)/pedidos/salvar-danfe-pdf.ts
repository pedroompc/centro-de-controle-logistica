// Salva o DANFE do pedido direto em PDF (NF-<número>.pdf), numa folha A4 — o
// botão "PDF" do app Flask. O DANFE é a mesma página do modal (/pedidos/:numped/danfe),
// carregada num iframe escondido; o html2pdf.js (html2canvas + jsPDF, o mesmo do
// Flask) vem do cdnjs com hash de integridade, só quando o botão é usado — não é
// dependência do projeto (o deploy não roda npm install).

const HTML2PDF = {
  src: "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
  integrity: "sha384-Yv5O+t3uE3hunW8uyrbpPW3iw6/5/Y7HitWJBLgqfMoA36NogMmy+8wWZMpn3HWc",
};

// 740 px = largura útil do A4 com 7 mm de margem (196 mm a 96 dpi); 283 mm de altura útil.
const LARGURA = 740;
const ALTURA_FOLHA = Math.floor((LARGURA * 283) / 196) - 10;

type Tarefa = {
  toCanvas(): Tarefa;
  then(f: (this: { prop: { canvas: HTMLCanvasElement } }) => void): Tarefa;
  outputPdf(tipo: "blob"): Promise<Blob>;
};
type Html2Pdf = () => { set(o: object): { from(el: HTMLElement): Tarefa } };

function carregarScript(doc: Document): Promise<void> {
  return new Promise((ok, falha) => {
    const s = doc.createElement("script");
    s.src = HTML2PDF.src;
    s.integrity = HTML2PDF.integrity;
    s.crossOrigin = "anonymous";
    s.onload = () => ok();
    s.onerror = () => falha(new Error("O gerador de PDF não carregou (verifique a internet e tente de novo)."));
    doc.head.appendChild(s);
  });
}

function carregarIframe(numped: number): Promise<HTMLIFrameElement> {
  return new Promise((ok, falha) => {
    const f = document.createElement("iframe");
    f.style.cssText = `position:fixed;left:-10000px;top:0;width:${LARGURA + 60}px;height:1400px;border:0;`;
    f.setAttribute("aria-hidden", "true");
    f.onload = () => ok(f);
    f.onerror = () => falha(new Error("Não foi possível abrir o DANFE."));
    f.src = `/pedidos/${numped}/danfe`;
    document.body.appendChild(f);
  });
}

// O html2canvas não desenha bem <svg>: o código de barras vira <img> antes da captura.
async function svgsParaImagem(doc: Document, raiz: HTMLElement) {
  await Promise.all(
    [...raiz.querySelectorAll("svg")].map((svg) => {
      const { width, height } = svg.getBoundingClientRect();
      const img = doc.createElement("img");
      img.style.cssText = `width:${width}px;height:${height}px;display:block;`;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      svg.replaceWith(img);
      return img.decode().catch(() => undefined);
    }),
  );
}

export async function salvarDanfePdf(numped: number, notaFiscal: number): Promise<void> {
  const iframe = await carregarIframe(numped);
  try {
    const win = iframe.contentWindow as (Window & { html2pdf?: Html2Pdf }) | null;
    const doc = iframe.contentDocument;
    const raiz = doc?.querySelector<HTMLElement>(".dnf");
    if (!win || !doc || !raiz) throw new Error(doc?.body?.innerText?.trim() || "Este pedido não tem DANFE disponível.");

    await carregarScript(doc);
    if (!win.html2pdf) throw new Error("O gerador de PDF não carregou.");
    await doc.fonts?.ready;

    raiz.style.cssText = `width:${LARGURA}px;padding:0;margin:0;box-shadow:none;box-sizing:border-box;`;
    await svgsParaImagem(doc, raiz);
    // Tudo numa folha: a linha vazia do quadro de produtos encolhe o que passar da altura útil.
    const vazio = raiz.querySelector<HTMLElement>("tr.dnf-vazio");
    const sobra = raiz.offsetHeight - ALTURA_FOLHA;
    if (vazio && sobra > 0) {
      const atual = (vazio.firstElementChild as HTMLElement).getBoundingClientRect().height;
      vazio.style.setProperty("--h", `${Math.max(0, Math.floor(atual - sobra))}px`);
    }

    const pdf = await win
      .html2pdf()
      // Opções criadas DENTRO do iframe: o html2pdf testa `constructor === Array`, que
      // falha com um array da página principal (outra janela) — "Invalid margin array".
      .set(
        (win as unknown as { JSON: JSON }).JSON.parse(
          JSON.stringify({
            margin: [7, 7, 7, 7],
            filename: `NF-${notaFiscal}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: "#ffffff", logging: false },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: [] },
          }),
        ),
      )
      .from(raiz)
      .toCanvas()
      .then(function () {
        // Mais alta que a folha: ganha faixas brancas nas laterais até a proporção do A4,
        // e o html2pdf reduz para caber numa folha só (como no Flask).
        const original = this.prop.canvas;
        const proporcao = 283 / 196;
        if (original.height <= original.width * proporcao) return;
        const largura = Math.ceil(original.height / proporcao) + 2;
        const ajustado = document.createElement("canvas");
        ajustado.width = largura;
        ajustado.height = original.height;
        const ctx = ajustado.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, largura, original.height);
        ctx.drawImage(original, Math.floor((largura - original.width) / 2), 0);
        this.prop.canvas = ajustado;
      })
      .outputPdf("blob");
    // Baixa pela página (o iframe some logo em seguida e levaria o download junto).
    const url = URL.createObjectURL(pdf);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NF-${notaFiscal}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } finally {
    iframe.remove();
  }
}
