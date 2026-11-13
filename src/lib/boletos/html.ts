import { toSVG } from "bwip-js/node";
import type { Boleto } from "@/domain/boletos";

// Boletos da NF de um pedido no layout que o Winthor imprime (modelo NF 2545688,
// Itaú 341-7): Comprovante de Entrega, aviso de golpe, Recibo do Pagador e Ficha
// de Compensação, uma parcela por folha A4. Página autônoma, como o DANFE: abre
// no modal da Consulta de Pedidos via iframe e sai pelo "Imprimir / Salvar PDF".
// Layout portado do app Flask do colega (app_cortes/Frontend: montarBoleto + boleto.css).

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const val = (n: number): string =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rótulo pequeno em cima, valor embaixo. `valor` já vem escapado.
const cel = (rotulo: string, valor: string, extra = ""): string =>
  `<span class="r">${rotulo}</span><span class="v ${extra}">${valor}</span>`;

/** Código de barras ITF (Interleaved 2 of 5) da ficha de compensação. */
function codigoDeBarras(barra: string): string {
  if (!/^\d{44}$/.test(barra)) return "";
  try {
    return toSVG({ bcid: "interleaved2of5", text: barra, height: 13, includetext: false }).replace(
      "<svg ",
      '<svg preserveAspectRatio="none" ',
    );
  } catch {
    return "";
  }
}

function montarBoleto(b: Boleto): string {
  const e = esc;
  const ben = b.beneficiario;
  const pag = b.pagador;
  const agConta = `${e(b.agencia)} / ${e(b.conta)}`;
  const nossoNum = `${e(b.carteira)} / ${e(b.nossoNumero)}`;
  const cabecalho = (direita: string, classe = ""): string => `
    <div class="bol-cab">
      <div class="bol-logo"><span class="marca b${e(b.banco)}">${b.banco === "341" ? "Itaú" : "Brad."}</span><span class="nome">${e(b.nomeBanco)}</span></div>
      <div class="bol-cod">${e(b.banco)}-${e(b.bancoDv)}</div>
      <div class="bol-dir ${classe}">${direita}</div>
    </div>`;
  const pagadorBloco = `
    <span class="r">Pagador</span>
    <div class="pag-l"><span class="a" style="padding-left:0">${e(pag.nome)}</span><span class="b">${e(pag.codcli)}</span></div>
    <div class="pag-l"><span class="a">${e(pag.endereco)} &nbsp;&nbsp; Nº ${e(pag.numero)}</span><span class="b">${e(pag.cnpj)}</span></div>
    <div class="pag-l"><span class="a">${e(pag.bairro)} &nbsp;&nbsp;&nbsp; ${e(pag.cidade)} &nbsp;&nbsp;&nbsp; ${e(pag.uf)}</span><span class="b">CEP : ${e(pag.cep)}</span></div>`;
  const instrucoes = `
    <span class="r">Instruções (Instruções de responsabilidade do beneficiário. Qualquer dúvida sobre este boleto, contate o beneficiário)</span>
    <p class="forte">NÃO É PERMITIDO PAGAMENTO AO VENDEDOR</p>
    <p>APÓS VENCIMENTO COBRAR MORA DIÁRIA DE R$ ${val(b.moraDiaria)}</p>
    <p>MULTA POR ATRASO ${String(b.percMulta).replace(".", ",")}%</p>
    ${b.taxaBoleto > 0 ? "<p>INCLUSO TAXA BANCÁRIA</p>" : "<p>&nbsp;</p>"}
    <p class="meio">ENVIAR PARA CARTORIO/SERASA 10 DIAS APOS O VENCIMENTO</p>
    <p>NUM. N.FISCAL: ${e(b.numNf)} &nbsp;&nbsp;&nbsp;&nbsp; VENDEDOR: ${e(b.vendedor)}</p>
    <p>${e(b.agencia)} &nbsp; ${e(b.conta)} &nbsp; ${e(b.nossoNumero)}</p>`;
  // Recibo do Pagador e Ficha de Compensação têm a mesma grade.
  const via = (aceite: string, rodape: string): string => `
    <table>
      <colgroup><col><col><col><col><col><col><col><col class="dir-col"></colgroup>
      <tr><td colspan="7">${cel("Local de pagamento", e(b.localPagamento))}</td><td>${cel("Vencimento", e(b.vencimento), "num")}</td></tr>
      <tr><td colspan="7"><span class="r">Beneficiário</span>
          <span class="v">${e(ben.nome)} <span style="float:right">CNPJ: ${e(ben.cnpj)}</span></span>
          <span class="v" style="padding-left:10px">${e(ben.endereco)} &nbsp;&nbsp;&nbsp; ${e(ben.bairro)} <span style="float:right">${e(ben.uf)}</span></span></td>
        <td>${cel("Agência/Código beneficiário", agConta, "num")}</td></tr>
      <tr><td>${cel("Data documento", e(b.dataDocumento))}</td><td colspan="2">${cel("Número documento", e(b.numeroDocumento), "cen")}</td>
        <td>${cel("Esp. doc", "DP", "cen")}</td><td>${cel("Aceite", aceite, "cen")}</td>
        <td colspan="2">${cel("Data processamento", e(b.dataProcessamento), "cen")}</td><td>${cel("Nosso número", nossoNum, "num")}</td></tr>
      <tr><td>${cel("Uso do banco", "")}</td><td>${cel("CIP", "000", "cen")}</td><td>${cel("Carteira", e(b.carteira), "cen")}</td>
        <td>${cel("Especie moeda", "R$", "cen")}</td><td>${cel("Quantidade", "")}</td><td colspan="2">${cel("Valor", "")}</td>
        <td>${cel("( = ) Valor do documento", val(b.valorDocumento), "num")}</td></tr>
      <tr><td colspan="7" rowspan="5" class="instr">${instrucoes}</td><td class="lado">${cel("( - ) Desconto/adiantamento", "")}</td></tr>
      <tr><td class="lado">${cel("( - ) Outras deduções", "")}</td></tr>
      <tr><td class="lado">${cel("( + ) Mora/multa", "")}</td></tr>
      <tr><td class="lado">${cel("( + ) Acréscimo", "")}</td></tr>
      <tr><td class="lado">${cel("( = ) Valor cobrado", "")}</td></tr>
      <tr><td colspan="8" class="pagador">${pagadorBloco}</td></tr>
    </table>
    <div class="aval"><span class="r" style="display:inline">Pagador / Avalista</span> ${e(ben.nome)}</div>
    ${rodape}`;

  return `
  <div class="bol-pagina">
    ${b.pagoEm ? `<div class="bol-pago">PAGO EM ${e(b.pagoEm)}</div>` : ""}
    ${cabecalho("Comprovante de Entrega")}
    <table>
      <colgroup><col style="width:21%"><col style="width:17%"><col style="width:22%"><col style="width:20%"><col style="width:20%"></colgroup>
      <tr><td colspan="2">${cel("Beneficiário", e(ben.nome))}</td><td>${cel("Agência/Código beneficiário", agConta, "cen")}</td>
        <td colspan="2" rowspan="3" class="motivos"><span class="r">Motivos de não entrega (para uso da empresa entregadora)</span>
          <div><span>[__] Mudou-se</span><span>[__] Ausente</span><span>[__] Não existe no indicado</span>
               <span>[__] Recusado</span><span>[__] Não procurado</span><span>[__] Falecido</span>
               <span>[__] Desconhecido</span><span>[__] Endereço insuficiente</span><span>[__] Outros (anotar no verso)</span></div></td></tr>
      <tr><td colspan="2">${cel("Sacado", e(pag.nome))}</td><td>${cel("Nosso número", e(b.nossoNumero), "num")}</td></tr>
      <tr><td>${cel("Vencimento", e(b.vencimento), "cen")}</td><td>${cel("Nº do documento", e(b.numeroDocumento), "cen")}</td><td>${cel("Valor do documento", val(b.valorDocumento), "num")}</td></tr>
      <tr><td style="height:30px"><span class="v" style="white-space:normal;font-size:9px">Recebi(emos) o bloquete de característica acima</span></td>
        <td>${cel("Data", "")}</td><td>${cel("Assinatura", "")}</td><td>${cel("Data", "")}</td><td>${cel("Entregador", "")}</td></tr>
      <tr><td colspan="3" class="pagador" style="border-bottom:1px solid #000">
          <span class="r" style="display:inline">Pagador</span> ${e(pag.nome)}
          <div class="pag-l"><span class="a" style="width:auto;flex:1">${e(pag.endereco)}</span><span class="b" style="flex:0 0 90px">Nº ${e(pag.numero)}</span></div>
          <div class="pag-l"><span class="a" style="width:auto;flex:1">${e(pag.cidade)}</span><span class="b" style="flex:0 0 90px">${e(pag.uf)}</span></div></td>
        <td colspan="2" class="pagador" style="border-bottom:1px solid #000">
          <span class="r" style="display:inline">Código</span> ${e(pag.codcli)}
          <div>${e(pag.cnpj)}</div><div>CEP :${e(pag.cep)}</div></td></tr>
    </table>
    <div class="bol-destacar">DESTACAR ABAIXO</div>
    <div class="bol-corte"></div>
    <div class="bol-aviso">Nossos boletos são anexados às Notas Fiscais e nosso e-mail possui a extensão<br>@diadistribuicao.com.br. Caso receba qualquer outro tipo de cobrança ou<br>solicitação de substituição de boleto, favor contatar-nos imediatamente.</div>
    <div class="bol-whats">WHATSAPP:(81) 99177-1348 &nbsp; (81) 99190-5058</div>
    <div class="bol-corte"></div>
    ${cabecalho("Recibo do Pagador")}
    ${via("S", '<div class="autent">Autenticação Mecanica</div>')}
    <div class="bol-corte"></div>
    ${cabecalho(e(b.linhaDigitavel), "linha")}
    ${via("N", `<div class="bol-barras"><span class="barras">${codigoDeBarras(b.codigoBarras)}</span><span class="autent">Autenticação Mecanica - Ficha de Compensação</span></div>`)}
  </div>`;
}

/** Página com um boleto por parcela, pronta para imprimir / salvar PDF em A4. */
export function renderBoletosHtml(boletos: Boleto[]): string {
  const nf = boletos[0]?.numNf ?? "";
  const titulo = `Boletos · NF ${nf}`;
  const qtd = `${boletos.length} ${boletos.length === 1 ? "parcela" : "parcelas"}`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(`Boletos-NF-${nf}`)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="barra" id="barra">
  <span>${esc(titulo)} · ${qtd}</span>
  <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
</div>
<div class="folha">${boletos.map((b) => `<div class="bol">${montarBoleto(b)}</div>`).join("")}</div>
<script>
  // Dentro do modal (iframe) quem imprime é o botão do modal; a barra só aparece com a página aberta direto.
  if (window.self !== window.top) document.getElementById("barra").style.display = "none";
</script>
</body>
</html>`;
}

const CSS = `
html, body { margin: 0; background: #f1f5f9; }
.barra { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; font: 600 14px system-ui, sans-serif; color: #1e293b; }
.barra button { background: #181d55; color: #fff; border: 0; border-radius: 8px; padding: 7px 14px; font: 600 12px system-ui, sans-serif; cursor: pointer; }
.barra button:hover { background: #10143f; }
.folha { overflow-x: auto; padding: 12px 0; }

/* 740 px = largura útil do A4 com margem de 7 mm (196 mm a 96 dpi) */
.bol { width: 740px; margin: 0 auto 12px; box-sizing: border-box; background: #fff; color: #000;
  font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.15; padding: 4px 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.bol * { box-sizing: border-box; }

/* Cabeçalho de cada via: marca do banco | código do banco | título ou linha digitável */
.bol-cab { display: flex; align-items: flex-end; border-bottom: 2px solid #000; margin-top: 6px; }
.bol-logo { display: flex; align-items: flex-end; gap: 6px; width: 200px; padding-bottom: 2px; }
.bol-logo .marca { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 30px;
  padding: 0 4px; border-radius: 6px; font-weight: 900; font-size: 13px; color: #fff; }
.bol-logo .marca.b341 { background: #003399; color: #ffcc00; }
.bol-logo .marca.b237 { background: #cc092f; color: #fff; }
.bol-logo .nome { font-weight: bold; font-size: 12px; }
.bol-cod { font-size: 20px; font-weight: bold; padding: 0 10px 1px; border-left: 2px solid #000; border-right: 2px solid #000; }
.bol-dir { flex: 1; text-align: right; padding-bottom: 3px; font-weight: bold; font-size: 13px; }
.bol-dir.linha { font-size: 15px; font-weight: normal; letter-spacing: 0.3px; }

/* Grade de campos */
.bol table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.bol td { border-bottom: 1px solid #000; border-left: 1px solid #000; vertical-align: top; padding: 1px 4px 2px; height: 24px; color: #000; font-size: 11px; }
.bol td:first-child { border-left: 0; }
.bol .r { display: block; font-size: 6.5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; }
.bol .v { display: block; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 13px; }
.bol .num { text-align: right; }
.bol .cen { text-align: center; }
.bol .dir-col { width: 170px; }
.bol td.instr { height: auto; border-bottom: 1px solid #000; }
.bol .instr p { margin: 0; font-size: 10.5px; }
.bol .instr .forte { font-size: 15px; font-weight: bold; margin-top: 2px; }
.bol .instr .meio { font-size: 11px; font-weight: bold; padding-left: 40px; }
.bol td.lado { height: 21px; }
.bol td.pagador { height: auto; border-bottom: 0; padding-top: 2px; }
.bol .pag-l { display: flex; font-size: 10.5px; }
.bol .pag-l .a { width: 62%; padding-left: 22px; }
.bol .pag-l .b { flex: 1; }
.bol .aval { font-size: 10px; border-bottom: 1px solid #000; padding: 1px 4px 3px; }
.bol .autent { text-align: right; font-size: 7px; padding: 3px 40px 0 0; }

/* Comprovante de entrega: motivos de não entrega */
.bol td.motivos { font-size: 8.5px; }
.bol .motivos div { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 6px 4px; margin-top: 4px; }

/* Aviso entre o comprovante e o recibo */
.bol-destacar { font-size: 6.5px; margin-top: 10px; }
.bol-aviso { text-align: center; font-weight: bold; font-size: 15px; line-height: 1.25; margin: 10px 0 8px; }
.bol-whats { text-align: right; font-weight: bold; font-size: 15px; margin-bottom: 8px; padding-right: 10px; }
.bol-corte { border-top: 1px dotted #000; margin: 8px 0 4px; }

/* Código de barras ITF: 390 px de 740 px ≈ 103 mm no A4, o tamanho padrão FEBRABAN */
.bol-barras { display: flex; align-items: flex-start; justify-content: space-between; padding: 6px 0 0 4px; }
.bol-barras .barras svg { display: block; width: 390px; height: 50px; }
.bol-barras .autent { padding-top: 6px; }

.bol-pagina { position: relative; }
.bol-pago { position: absolute; top: 300px; left: 0; right: 0; text-align: center; font-size: 60px; font-weight: 900;
  color: rgba(0, 0, 0, 0.14); transform: rotate(-18deg); pointer-events: none; }

/* Impressão: só os boletos, uma parcela por folha A4 */
@page { size: A4 portrait; margin: 7mm; }
@media print {
  html, body { background: #fff; }
  .barra { display: none !important; }
  .folha { padding: 0; overflow: visible; }
  .bol { margin: 0; box-shadow: none; break-after: page; zoom: 0.93; }
  .bol:last-child { break-after: auto; }
}
`;
