// Salva o DANFE ou os boletos do pedido direto em PDF, em folhas A4 — o botão
// "PDF" do app Flask. O documento é a mesma página do modal (/pedidos/:numped/danfe
// ou /boletos), carregada num iframe escondido; o html2pdf.js (html2canvas + jsPDF,
// o mesmo do Flask) vem do cdnjs com hash de integridade, só quando o botão é
// usado — não é dependência do projeto (o deploy não roda npm install).

const HTML2PDF = {
  src: "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
  integrity: "sha384-Yv5O+t3uE3hunW8uyrbpPW3iw6/5/Y7HitWJBLgqfMoA36NogMmy+8wWZMpn3HWc",
};

// 740 px = largura útil do A4 com 7 mm de margem (196 mm a 96 dpi); 283 mm de altura útil.
const LARGURA = 740;
const ALTURA_FOLHA = Math.floor((LARGURA * 283) / 196) - 10;
const PROPORCAO_FOLHA = 283 / 196;

type Ctx = { prop: { canvas: HTMLCanvasElement; pdf?: { addPage(): void } } };
type Tarefa = {
  from(el: HTMLElement): Tarefa;
  toContainer(): Tarefa;
  toCanvas(): Tarefa;
  toPdf(): Tarefa;
  then(f: (this: Ctx) => void): Tarefa;
  outputPdf(tipo: "blob"): Promise<Blob>;
};
type Html2Pdf = () => { set(o: object): Tarefa };

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

function carregarIframe(url: string): Promise<HTMLIFrameElement> {
  return new Promise((ok, falha) => {
    const f = document.createElement("iframe");
    f.style.cssText = `position:fixed;left:-10000px;top:0;width:${LARGURA + 60}px;height:1400px;border:0;`;
    f.setAttribute("aria-hidden", "true");
    f.onload = () => ok(f);
    f.onerror = () => falha(new Error("Não foi possível abrir o documento."));
    f.src = url;
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

// DANFE numa folha só: a linha vazia do quadro de produtos encolhe o que passar da altura útil.
function encolherDanfe(folha: HTMLElement) {
  folha.style.padding = "0";
  const vazio = folha.querySelector<HTMLElement>("tr.dnf-vazio");
  const sobra = folha.offsetHeight - ALTURA_FOLHA;
  if (vazio && sobra > 0) {
    const atual = (vazio.firstElementChild as HTMLElement).getBoundingClientRect().height;
    vazio.style.setProperty("--h", `${Math.max(0, Math.floor(atual - sobra))}px`);
  }
}

/**
 * Gera o PDF das folhas (`seletor`) da página `url` — uma folha do documento por
 * página A4 — e baixa como `arquivo`. Se a página não tiver folhas, o texto dela
 * (a mensagem de erro da rota) vira o erro. Devolve os avisos da página (o que
 * ficou de fora), que não saem no PDF.
 */
async function salvarPdf({ url, seletor, arquivo, preparar }: {
  url: string; seletor: string; arquivo: string; preparar?: (folha: HTMLElement) => void;
}): Promise<string[]> {
  const iframe = await carregarIframe(url);
  try {
    const win = iframe.contentWindow as (Window & { html2pdf?: Html2Pdf }) | null;
    const doc = iframe.contentDocument;
    const folhas = doc ? [...doc.querySelectorAll<HTMLElement>(seletor)] : [];
    if (!win || !doc || folhas.length === 0) throw new Error(doc?.body?.innerText?.trim() || "Documento indisponível para este pedido.");

    await carregarScript(doc);
    if (!win.html2pdf) throw new Error("O gerador de PDF não carregou.");
    await doc.fonts?.ready;

    for (const folha of folhas) {
      folha.style.width = `${LARGURA}px`;
      folha.style.margin = "0";
      folha.style.boxShadow = "none";
      folha.style.boxSizing = "border-box";
      await svgsParaImagem(doc, folha);
      preparar?.(folha);
    }

    // Opções criadas DENTRO do iframe: o html2pdf testa `constructor === Array`, que
    // falha com um array da página principal (outra janela) — "Invalid margin array".
    const opcoes = (win as unknown as { JSON: JSON }).JSON.parse(
      JSON.stringify({
        margin: [7, 7, 7, 7],
        filename: arquivo,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: "#ffffff", logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: [] },
      }),
    );
    // Uma folha por vez no mesmo PDF: o toPdf reaproveita o PDF já criado (prop.pdf).
    let tarefa = win.html2pdf().set(opcoes);
    folhas.forEach((folha, i) => {
      tarefa = tarefa
        .from(folha)
        .toContainer()
        .toCanvas()
        .then(function () {
          // Mais alta que a folha: ganha faixas brancas nas laterais até a proporção do
          // A4, e o html2pdf reduz para caber numa página só (como no Flask).
          const original = this.prop.canvas;
          if (original.height > original.width * PROPORCAO_FOLHA) {
            const largura = Math.ceil(original.height / PROPORCAO_FOLHA) + 2;
            const ajustado = document.createElement("canvas");
            ajustado.width = largura;
            ajustado.height = original.height;
            const ctx = ajustado.getContext("2d")!;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, largura, original.height);
            ctx.drawImage(original, Math.floor((largura - original.width) / 2), 0);
            this.prop.canvas = ajustado;
          }
          if (i > 0) this.prop.pdf?.addPage();
        })
        .toPdf();
    });
    const pdf = await tarefa.outputPdf("blob");
    // Baixa pela página (o iframe some logo em seguida e levaria o download junto).
    const link = URL.createObjectURL(pdf);
    const a = document.createElement("a");
    a.href = link;
    a.download = arquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(link), 10_000);
    return [...doc.querySelectorAll(".avisos p")].map((p) => p.textContent?.trim() ?? "").filter(Boolean);
  } finally {
    iframe.remove();
  }
}

/** DANFE do pedido em NF-<número>.pdf, numa folha A4. */
export async function salvarDanfePdf(numped: number, notaFiscal: number): Promise<void> {
  await salvarPdf({ url: `/pedidos/${numped}/danfe`, seletor: ".dnf", arquivo: `NF-${notaFiscal}.pdf`, preparar: encolherDanfe });
}

/** Boletos da NF do pedido em Boletos-NF-<número>.pdf, uma parcela por folha A4. */
export async function salvarBoletosPdf(numped: number, notaFiscal: number): Promise<void> {
  await salvarPdf({ url: `/pedidos/${numped}/boletos`, seletor: ".bol", arquivo: `Boletos-NF-${notaFiscal}.pdf` });
}

/** Boletos das NFs de vários pedidos num PDF só, uma parcela por folha. Devolve o que ficou de fora. */
export function salvarBoletosPdfPedidos(pedidos: number[], arquivo: string): Promise<string[]> {
  return salvarPdf({ url: `/pedidos/boletos?p=${pedidos.join(",")}`, seletor: ".bol", arquivo });
}
