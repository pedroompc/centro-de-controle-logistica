import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { renderDanfePdf } from "./render";
import { parseNfe } from "@/domain/danfe/parse-nfe";

// Monta um XML NF-e 4.00 com N itens para exercitar a paginação da tabela.
function xmlComItens(n: number): string {
  const dets = Array.from({ length: n }, (_, i) => `
    <det nItem="${i + 1}">
      <prod><cProd>${1000 + i}</cProd><xProd>PRODUTO DE TESTE NUMERO ${i + 1} COM NOME LONGO PARA CLIPAR</xProd>
        <NCM>10063021</NCM><CFOP>5102</CFOP><uCom>UN</uCom>
        <qCom>${(i + 1) * 2}.0000</qCom><vUnCom>10.0000000000</vUnCom><vProd>${((i + 1) * 20).toFixed(2)}</vProd></prod>
      <imposto><ICMS><ICMS00><CST>00</CST><vBC>${((i + 1) * 20).toFixed(2)}</vBC><pICMS>18.00</pICMS><vICMS>${((i + 1) * 3.6).toFixed(2)}</vICMS></ICMS00></ICMS></imposto>
    </det>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe Id="NFe26260912345678000199550030024958121136106610" versao="4.00">
<ide><cUF>26</cUF><natOp>VENDA DE MERCADORIA A VAREJO</natOp><serie>3</serie><nNF>2495812</nNF>
  <dhEmi>2026-09-14T08:30:00-03:00</dhEmi><dhSaiEnt>2026-09-14T09:00:00-03:00</dhSaiEnt><tpNF>1</tpNF><tpImp>1</tpImp></ide>
<emit><CNPJ>12345678000199</CNPJ><xNome>DISTRIBUIDORA EXEMPLO LTDA</xNome><xFant>EXEMPLO</xFant>
  <enderEmit><xLgr>RODOVIA BR 101 SUL</xLgr><nro>1000</nro><xBairro>DISTRITO INDUSTRIAL</xBairro>
    <xMun>JABOATAO DOS GUARARAPES</xMun><UF>PE</UF><CEP>54250610</CEP><fone>8130000000</fone></enderEmit><IE>1234567890</IE><CRT>3</CRT></emit>
<dest><CNPJ>11222333000199</CNPJ><xNome>MERCADINHO DO JOAO LTDA ME</xNome>
  <enderDest><xLgr>RUA DAS FLORES</xLgr><nro>45</nro><xBairro>CENTRO</xBairro><xMun>RECIFE</xMun><UF>PE</UF><CEP>50000000</CEP><fone>8199990000</fone></enderDest>
  <IE>9876543210</IE><email>joao@mercadinho.com</email></dest>
${dets}
<total><ICMSTot><vBC>1000.00</vBC><vICMS>180.00</vICMS><vBCST>0.00</vBCST><vST>0.00</vST><vProd>1000.00</vProd>
  <vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vOutro>0.00</vOutro><vNF>1000.00</vNF></ICMSTot></total>
<transp><modFrete>0</modFrete><transporta><CNPJ>55666777000188</CNPJ><xNome>TRANSPORTES RAPIDOS LTDA</xNome><IE>1112223330</IE><xMun>RECIFE</xMun><UF>PE</UF></transporta>
  <veicTransp><placa>ABC1D23</placa><UF>PE</UF></veicTransp><vol><qVol>40</qVol><esp>CAIXA</esp><pesoL>60.000</pesoL><pesoB>62.500</pesoB></vol></transp>
<cobr><dup><nDup>001</nDup><dVenc>2026-10-14</dVenc><vDup>1000.00</vDup></dup></cobr>
<infAdic><infCpl>Pedido 987654 - entregar no periodo da manha. Documento auxiliar sem valor fiscal - foto do DANFE para o vendedor em rota.</infCpl></infAdic>
</infNFe></NFe>
<protNFe versao="4.00"><infProt><chNFe>26260912345678000199550030024958121136106610</chNFe><nProt>126260000123456</nProt><dhRecbto>2026-09-14T08:31:00-03:00</dhRecbto></infProt></protNFe>
</nfeProc>`;
}

describe("renderDanfePdf", () => {
  it("gera um PDF válido a partir do XML", async () => {
    const bytes = await renderDanfePdf(parseNfe(xmlComItens(3)));
    expect(bytes.length).toBeGreaterThan(3000);
    // %PDF- no início
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    if (process.env.DANFE_OUT) writeFileSync(process.env.DANFE_OUT, Buffer.from(bytes));
  });

  it("pagina quando há muitos itens (não estoura nem trava)", async () => {
    const bytes = await renderDanfePdf(parseNfe(xmlComItens(120)));
    expect(bytes.length).toBeGreaterThan(5000);
    if (process.env.DANFE_OUT_BIG) writeFileSync(process.env.DANFE_OUT_BIG, Buffer.from(bytes));
  });
});
