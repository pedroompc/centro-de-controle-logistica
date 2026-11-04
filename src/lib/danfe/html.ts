import { toSVG } from "bwip-js/node";
import type { DanfeData } from "@/domain/danfe/parse-nfe";
import type { DanfeWinthor } from "@/data/danfe";

// DANFE em HTML no mesmo layout da nota impressa pela empresa (Winthor):
// quadros de borda fina com cantos arredondados, rótulos pequenos em Courier e
// valores em Arial. Página autônoma (abre no modal da Consulta de Pedidos via
// iframe ou direto numa aba) e já pronta para "Imprimir / Salvar PDF" em A4.
// Layout portado do projeto do colega (app_cortes/Frontend: montarDanfe + danfe.css).

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const n2 = (v: string | number | null | undefined): string =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (v: string | null | undefined): string =>
  Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
// "2026-09-14T08:30:00-03:00" → "14/09/2026" (lê o texto do XML, sem fuso).
const data = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "";
const hora = (iso: string | null | undefined): string => (iso && iso.length >= 16 ? iso.slice(11, 16) : "");

function doc(v: string | null | undefined): string {
  const x = String(v ?? "").replace(/\D/g, "");
  if (x.length === 14) return x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (x.length === 11) return x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return x;
}

function fone(v: string | null | undefined): string {
  const x = String(v ?? "").replace(/\D/g, "");
  return x.length >= 10 ? `${x.slice(0, 2)} ${x.slice(2, x.length - 4)} ${x.slice(-4)}` : x;
}

const cep = (v: string | null | undefined): string => String(v ?? "").replace(/^(\d{5})(\d{3})$/, "$1-$2");

// Célula: rótulo pequeno em cima, valor embaixo. `valor` já vem escapado.
const cel = (rotulo: string, valor: string, estilo = "", classeValor = ""): string =>
  `<div class="dnf-c" style="${estilo}"><span class="dnf-r">${rotulo}</span><span class="dnf-v ${classeValor}">${valor}</span></div>`;

function codigoDeBarras(chave: string): string {
  if (!/^\d{44}$/.test(chave)) return "";
  try {
    // Code 128 (o bwip-js usa o subconjunto C sozinho para só dígitos, como pede o manual do DANFE).
    return toSVG({ bcid: "code128", text: chave, height: 12, includetext: false });
  } catch {
    return "";
  }
}

export function renderDanfeHtml(d: DanfeData, wt: DanfeWinthor): string {
  const emit = d.emitente;
  const dest = d.destinatario;
  const tot = d.totais;
  const tr = d.transporte;
  const transp = tr.transportadora;
  const vol = tr.volumes;

  const numero = !emit.endereco.numero || emit.endereco.numero === "0" ? "S/N" : esc(emit.endereco.numero);
  const chaveFmt = d.chave.replace(/(\d{4})(?=\d)/g, "$1 ");
  const placa = tr.veiculo?.placa || wt.placa || "";
  const ufPlaca = tr.veiculo?.uf || wt.ufPlaca || "";
  const saidaVeiculo = wt.dtSaidaVeiculo ? wt.dtSaidaVeiculo.toLocaleDateString("pt-BR") : "";
  const dataSaida = d.ide.dataSaida;

  // Informações complementares: o XML separa as linhas com "//" e às vezes repete a linha do RCA.
  const linhasInf = [
    ...new Set(
      String(d.informacoesComplementares ?? "")
        .split("//")
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ];

  const linhasItens = d.itens
    .map(
      (i) => `
        <tr>
          <td>${esc(i.codigo)}</td>
          <td title="${esc(i.descricao)}">${esc(i.descricao)}</td>
          <td>${esc(i.ncm)}</td>
          <td>${esc(i.cst)}</td>
          <td>${esc(i.cfop)}</td>
          <td>${esc(i.unidade)}</td>
          <td class="dnf-num">${qtd(i.quantidade)}</td>
          <td class="dnf-num">${n2(i.valorUnitario)}</td>
          <td class="dnf-num">${n2(i.valorTotal)}</td>
          <td class="dnf-num">${n2(i.valorIcms)}</td>
          <td class="dnf-num">${n2(i.valorIcmsSt)}</td>
          <td class="dnf-num">${n2(i.aliqIcms)}</td>
          <td class="dnf-num">${n2(i.aliqIpi)}</td>
        </tr>`,
    )
    .join("");
  // Linha vazia que estica as colunas até o fim do quadro, como no formulário impresso.
  const alturaVazia = Math.max(0, 400 - d.itens.length * 14);
  const enchimento = alturaVazia
    ? `<tr class="dnf-vazio" style="--h:${alturaVazia}px">${"<td></td>".repeat(13)}</tr>`
    : "";

  const duplicatas = d.duplicatas
    .map((p) => {
      const [a, m, dia] = String(p.vencimento ?? "").split("-");
      const venc = dia ? `${dia}/${m}/${a.slice(2)}` : "";
      return `<div class="dnf-dup"><div><span class="r">Venc.</span>${venc}</div><div><span class="r">VALOR</span>${n2(p.valor)}</div></div>`;
    })
    .join("");

  const titulo = `DANFE NF-e ${d.ide.numero ?? ""}`;

  const corpo = `
  <div class="dnf" id="danfe-impressao">
    <div class="dnf-canhoto">
      <div class="dnf-canhoto-esq">
        <div>RECEBEMOS DE <b>${esc(emit.nome)}</b><br>OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</div>
        <div class="dnf-l" style="border-top:1px solid #000">
          ${cel("Data de recebimento", "", "width:110px")}
          ${cel("Identificação e assinatura do recebedor da razao&nbsp; " + esc(dest.nome), "", "flex:1")}
        </div>
      </div>
      <div class="dnf-canhoto-ref">
        <div>NUMCAR: <b>${esc(wt.numcar)}</b></div>
        <div>NUMTRANS: <b>${esc(wt.numtrans)}</b></div>
        <div>CODCLI: <b>${esc(wt.codcli)}</b></div>
        <div>RCA: <b>${esc(wt.rca)}</b></div>
      </div>
      <div class="dnf-canhoto-nf">NF-e<br><small>Nº.</small> <b style="font-size:13px">${esc(d.ide.numero)}</b><br>SÉRIE ${esc(d.ide.serie)}</div>
    </div>
    <div class="dnf-corte"></div>

    <div class="dnf-cab">
      <div class="dnf-emit">
        <div class="dnf-logo" role="img" aria-label="DIA Distribuição"></div>
        <div class="dnf-emit-txt">
          <b class="titulo">Identificação do Emitente</b>
          ${esc(emit.nome)}<br>
          ${esc(emit.endereco.logradouro)} - ${numero} - ${esc(emit.endereco.bairro)} - ${esc(emit.endereco.municipio)} - ${esc(emit.endereco.uf)} - ${esc(cep(emit.endereco.cep))}
          <div class="fone"><b>Telefone:</b> ${esc(emit.endereco.fone)}</div>
          <div><b>E-mail:</b> <a>dia@diadistribuicao.com.br</a></div>
        </div>
      </div>
      <div class="dnf-danfe">
        <div class="nome">DANF-e</div>
        <div class="sub">Documento Auxíliar da<br>Nota Fiscal</div>
        <div class="tipo"><div>0 - ENTRADA<br>1 - SAÍDA</div><div class="caixa">${esc(d.ide.tipo)}</div></div>
        <div style="margin-top:4px">Nº. <b style="font-family:Arial">${esc(d.ide.numero)}</b></div>
        <div>SÉRIE <b style="font-family:Arial">${esc(d.ide.serie)}</b> <span class="fl">FL 1 of 1</span></div>
      </div>
      <div class="dnf-chave">
        <div class="barras">${codigoDeBarras(d.chave)}</div>
        <div class="chave"><span class="dnf-r">Chave de acesso</span><span class="dnf-v">${chaveFmt}</span></div>
        <div class="consulta">Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal</div>
      </div>
    </div>

    <div class="dnf-q">
      <div class="dnf-l">${cel("Natureza de operação", esc(d.ide.naturezaOperacao), "flex:1")}</div>
      <div class="dnf-l">
        ${cel("Inscrição estadual", esc(emit.ie), "width:150px")}
        ${cel("Insc. est. do subst. tributario", esc(emit.iest), "width:180px")}
        ${cel("CNPJ", doc(emit.documento), "width:170px")}
        ${cel("Protocolo de Autorização(Data e Hora)", `${esc(d.protocolo)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${data(d.dataAutorizacao)} ${esc((d.dataAutorizacao ?? "").slice(11, 19))}`, "flex:1")}
      </div>
    </div>

    <div class="dnf-tit"><span>DESTINATÁRIO/REMETENTE</span></div>
    <div class="dnf-q">
      <div class="dnf-l">
        ${cel("Nome/Razão social", esc(dest.nome), "flex:1")}
        ${cel("CNPJ/CPF", doc(dest.documento), "width:160px")}
        ${cel("Data da emissão", data(d.ide.dataEmissao), "width:110px")}
      </div>
      <div class="dnf-l">
        ${cel("Logradouro", esc(dest.endereco.logradouro), "flex:1")}
        ${cel("Número", esc(dest.endereco.numero), "width:60px")}
        ${cel("Complemento", esc(dest.endereco.complemento), "width:110px")}
        ${cel("Bairro/Distrito", esc(dest.endereco.bairro), "width:150px")}
        ${cel("Data da entrada/saída", data(dataSaida), "width:110px")}
      </div>
      <div class="dnf-l">
        ${cel("CEP", esc(dest.endereco.cep), "width:80px")}
        ${cel("Município", esc(dest.endereco.municipio), "flex:1")}
        ${cel("Telefone/Fax", fone(dest.endereco.fone), "width:110px")}
        ${cel("UF", esc(dest.endereco.uf), "width:40px")}
        ${cel("Inscrição estadual", esc(dest.ie), "width:120px")}
        ${cel("Hora de saída", hora(dataSaida || d.ide.dataEmissao), "width:110px")}
      </div>
    </div>

    <div class="dnf-tit"><span>FATURA</span></div>
    <div class="dnf-q">
      <div class="dnf-fatura">${duplicatas}</div>
    </div>

    <div class="dnf-tit"><span>CÁLCULO DO IMPOSTO</span></div>
    <div class="dnf-q">
      <div class="dnf-l">
        ${cel("Base de cálculo de ICMS", n2(tot.baseIcms), "flex:1", "dnf-num")}
        ${cel("Valor do ICMS", n2(tot.valorIcms), "flex:1", "dnf-num")}
        ${cel("Base de cálculo do ICMS ST.", n2(tot.baseIcmsSt), "flex:1", "dnf-num")}
        ${cel("Valor do ICMS substituição", n2(tot.valorIcmsSt), "flex:1", "dnf-num")}
        ${cel("Valor total dos produtos", n2(tot.valorProdutos), "flex:1", "dnf-num")}
      </div>
      <div class="dnf-l">
        ${cel("Valor do frete", n2(tot.valorFrete), "flex:1", "dnf-num")}
        ${cel("Valor do seguro", "R$ " + n2(tot.valorSeguro), "flex:1", "dnf-num")}
        ${cel("Valor do desconto", n2(tot.desconto), "flex:1", "dnf-num")}
        ${cel("Outras despesas acessórias", n2(tot.outras), "flex:1", "dnf-num")}
        ${cel("Valor do IPI", n2(tot.valorIpi), "flex:.8", "dnf-num")}
        ${cel("Valor total da nota", n2(tot.valorNota), "flex:1", "dnf-num")}
      </div>
    </div>

    <div class="dnf-tit"><span>TRANSPORTADOR/VOLUMES TRANSPORTADOS</span><span class="data">${esc(saidaVeiculo)}</span></div>
    <div class="dnf-q">
      <div class="dnf-l">
        ${cel("Razão social", esc(transp?.nome), "flex:1")}
        <div class="dnf-c" style="width:120px;display:flex;gap:6px;align-items:center">
          <span class="dnf-r" style="line-height:1.3">Frete por conta<br>0 - emitente<br>1 - destinatário</span>
          <span style="border:1px solid #000;padding:0 3px">${esc(tr.modalidade)}</span>
        </div>
        ${cel("Código ANTT", esc(tr.veiculo?.rntc), "width:90px")}
        ${cel("Placa do veículo", esc(placa), "width:100px")}
        ${cel("UF", esc(ufPlaca), "width:40px")}
        ${cel("CNPJ/CPF", doc(transp?.documento), "width:130px")}
      </div>
      <div class="dnf-l">
        ${cel("Logradouro", esc(transp?.endereco), "flex:1")}
        ${cel("Município", esc(transp?.municipio), "width:200px")}
        ${cel("UF", esc(transp?.uf), "width:40px")}
        ${cel("Inscrição estadual", esc(transp?.ie), "width:130px")}
      </div>
      <div class="dnf-l">
        ${cel("Quantidade", esc(vol?.quantidade), "width:80px")}
        ${cel("Volumes", esc(wt.volumes), "width:80px")}
        ${cel("Espécie", esc(vol?.especie), "flex:1")}
        ${cel("Marca", esc(vol?.marca), "flex:1")}
        ${cel("Numeração", "", "width:110px")}
        ${cel("Peso bruto", n2(vol?.pesoBruto), "width:110px")}
        ${cel("Peso líquido", n2(vol?.pesoLiquido), "width:110px")}
      </div>
    </div>

    <div class="dnf-tit"><span>DADOS DO PRODUTO/SERVIÇOS</span></div>
    <div class="dnf-prod">
      <table>
        <colgroup>
          <col style="width:40px"><col><col style="width:54px"><col style="width:26px"><col style="width:32px"><col style="width:28px">
          <col style="width:40px"><col style="width:48px"><col style="width:56px"><col style="width:46px"><col style="width:42px"><col style="width:36px"><col style="width:30px">
        </colgroup>
        <thead><tr>
          <th>Código</th><th>DESCRIÇÃO DO PRODUTO/SERVIÇO</th><th>NCM/SH</th><th>CST</th><th>CFOP</th><th>UND</th>
          <th>QTD</th><th>V. UN.</th><th>V. TOTAL</th><th>V. ICMS</th><th>V.ICMS ST</th><th>ALIQ. ICMS</th><th>ALIQ. IPI</th>
        </tr></thead>
        <tbody>${linhasItens}${enchimento}</tbody>
      </table>
    </div>

    <div class="dnf-fim"><span class="tit">CÁLCULO DO ISSQN</span><span class="grande">FIM DOS PRODUTOS</span></div>
    <div class="dnf-q" style="margin-top:0">
      <div class="dnf-l">
        ${cel("Inscrição municipal", "", "width:180px")}
        ${cel("Valor total dos serviços", "", "flex:1")}
        ${cel("Base de cálculo de ISSQN", "", "flex:1")}
        ${cel("Valor do ISSQN", "", "width:200px")}
      </div>
    </div>

    <div class="dnf-tit"><span>DADOS ADICIONAIS</span></div>
    <div class="dnf-adic">
      <div class="info">
        <span class="dnf-r">Informações complementares</span>
        ${linhasInf.map((l) => `<p>${esc(l)}</p>`).join("")}
        <p class="aviso">Nossos boletos são anexados às notas fiscais, e nosso e-mail possui a extensão @diadistribuicao.com.br.<br>Caso receba qualquer outro tipo de cobrança ou solicitação de substituição de boleto, favor contatar-nos imediatamente.</p>
      </div>
      <div class="fisco"><span class="dnf-r">Reservado ao fisco</span>${d.informacoesFisco ? `<p>${esc(d.informacoesFisco)}</p>` : ""}</div>
    </div>
  </div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="barra" id="barra">
  <span>${esc(titulo)} · Série ${esc(d.ide.serie)}</span>
  <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
</div>
<div class="folha">${corpo}</div>
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

.dnf { width: 780px; margin: 0 auto; padding: 14px 16px; background: #fff; color: #000;
  font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.2; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.dnf * { box-sizing: border-box; }

/* Quadro: grupo de linhas com borda e cantos arredondados */
.dnf-q { border: 1px solid #000; border-radius: 6px; overflow: hidden; margin-top: 3px; }
.dnf-l { display: flex; }
.dnf-l + .dnf-l { border-top: 1px solid #000; }
.dnf-c { padding: 1px 4px 2px; min-height: 22px; overflow: hidden; }
.dnf-c + .dnf-c { border-left: 1px solid #000; }
.dnf-r { display: block; font-family: 'Courier New', Courier, monospace; font-size: 7px; text-transform: uppercase; white-space: nowrap; }
.dnf-v { display: block; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 13px; }
.dnf-num { text-align: right; }
.dnf-tit { font-family: 'Courier New', Courier, monospace; font-weight: bold; font-size: 10px; margin-top: 6px; display: flex; justify-content: space-between; }
.dnf-tit .data { font-weight: normal; font-family: Arial, sans-serif; font-size: 8px; margin-right: 40%; }

/* Canhoto */
.dnf-canhoto { display: flex; border: 1px solid #000; border-radius: 6px; overflow: hidden; }
.dnf-canhoto-esq { flex: 1; display: flex; flex-direction: column; }
.dnf-canhoto-esq > div:first-child { padding: 2px 4px; font-size: 11px; flex: 1; }
.dnf-canhoto-ref { width: 150px; padding: 2px 6px; font-size: 10px; line-height: 1.35; }
.dnf-canhoto-ref div { display: flex; justify-content: flex-end; gap: 4px; }
.dnf-canhoto-ref b { min-width: 64px; }
.dnf-canhoto-nf { width: 110px; border-left: 1px solid #000; padding: 4px 8px; font-size: 15px; }
.dnf-canhoto-nf small { font-size: 11px; }
.dnf-corte { border-top: 2px dotted #000; margin: 6px 0 4px; }

/* Cabeçalho */
.dnf-cab { display: flex; border: 1px solid #000; border-radius: 6px; overflow: hidden; min-height: 120px; }
.dnf-emit { width: 320px; display: flex; gap: 6px; padding: 4px; border-right: 1px solid #000; }
.dnf-logo { width: 96px; height: 100px; border-radius: 4px; background: #33305f url('/logo-dia-danfe.png') no-repeat center; background-size: 90px auto; flex: none;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.dnf-emit-txt { font-size: 9px; line-height: 1.3; }
.dnf-emit-txt b.titulo { display: block; text-align: center; font-family: 'Courier New', monospace; font-size: 10px; }
.dnf-emit-txt .fone { margin-top: 10px; font-size: 11px; }
.dnf-emit-txt .fone b { font-size: 11px; }
.dnf-emit-txt a { color: #00f; text-decoration: underline; }
.dnf-danfe { width: 150px; border-right: 1px solid #000; padding: 4px 6px; font-family: 'Courier New', monospace; font-size: 9px; }
.dnf-danfe .nome { font-size: 17px; font-weight: bold; text-align: center; }
.dnf-danfe .sub { text-align: center; font-weight: bold; margin-bottom: 6px; }
.dnf-danfe .tipo { display: flex; align-items: center; gap: 8px; font-weight: bold; }
.dnf-danfe .tipo .caixa { border: 1px solid #000; width: 22px; height: 20px; display: flex; align-items: center; justify-content: center; font-family: Arial; font-size: 12px; }
.dnf-danfe .fl { font-family: Arial; font-size: 16px; font-weight: bold; white-space: nowrap; }
.dnf-chave { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.dnf-chave .barras { height: 52px; display: flex; align-items: center; justify-content: center; padding: 4px 6px; border-bottom: 1px solid #000; }
.dnf-chave .barras svg { width: 100%; height: 44px; }
.dnf-chave .chave { padding: 1px 4px 3px; border-bottom: 1px solid #000; }
.dnf-chave .consulta { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-family: 'Courier New', monospace; font-size: 11px; padding: 4px; }

/* Fatura */
.dnf-fatura { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 18px; padding: 2px 8px 6px; min-height: 34px; }
.dnf-dup { display: flex; gap: 22px; }
.dnf-dup .r { font-size: 6px; display: block; }

/* Produtos */
.dnf-prod { border: 1px solid #000; border-radius: 6px; overflow: hidden; margin-top: 3px; }
.dnf-prod table { width: 100%; border-collapse: collapse; border-spacing: 0; table-layout: fixed; }
.dnf-prod thead th { font-family: 'Courier New', monospace; font-size: 7px; font-weight: normal; color: #000; text-align: left;
  line-height: 1.15; vertical-align: top; padding: 2px 3px; background: #fff; border-bottom: 1px solid #000; }
.dnf-prod tbody td { font-size: 9.5px; color: #000; padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: top; }
.dnf-prod tbody tr.dnf-vazio td { height: var(--h); }
.dnf-prod th + th, .dnf-prod td + td { border-left: 1px solid #000; }
.dnf-fim { display: flex; align-items: flex-end; margin-top: 8px; }
.dnf-fim .tit { width: 230px; font-family: 'Courier New', monospace; font-weight: bold; font-size: 10px; }
.dnf-fim .grande { font-size: 22px; font-weight: bold; }

/* Dados adicionais */
.dnf-adic { display: flex; gap: 3px; margin-top: 2px; }
.dnf-adic > div { border: 1px solid #000; border-radius: 10px; padding: 2px 6px 6px; min-height: 120px; }
.dnf-adic .info { flex: 1; font-family: 'Courier New', monospace; font-size: 8px; text-transform: uppercase; }
.dnf-adic p { margin: 0; }
.dnf-adic .info .aviso { font-family: Arial, sans-serif; font-weight: bold; font-size: 10px; text-transform: none; margin-top: 10px; }
.dnf-adic .fisco { width: 270px; font-size: 8px; }

/* Impressão: só o documento, numa folha A4 (a área vazia dos produtos encolhe para caber) */
@page { size: A4 portrait; margin: 7mm; }
@media print {
  html, body { background: #fff; }
  .barra { display: none !important; }
  .folha { padding: 0; overflow: visible; }
  .dnf { padding: 0; zoom: 0.95; box-shadow: none; }
  .dnf-prod tbody tr.dnf-vazio td { height: max(0px, calc(var(--h) - 230px)); }
}
`;
