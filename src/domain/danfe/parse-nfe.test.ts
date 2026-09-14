import { describe, it, expect } from "vitest";
import { parseNfe } from "./parse-nfe";

// NF-e 4.00 mínima mas realista: emitente, destinatário, 2 itens, ICMS/IPI,
// totais, transporte com volume, uma duplicata, infAdic e protocolo de autorização.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe26260912345678000199550030024958121136106610" versao="4.00">
      <ide>
        <cUF>26</cUF><natOp>VENDA DE MERCADORIA</natOp><serie>3</serie><nNF>2495812</nNF>
        <dhEmi>2026-09-14T08:30:00-03:00</dhEmi><dhSaiEnt>2026-09-14T09:00:00-03:00</dhSaiEnt>
        <tpNF>1</tpNF><tpImp>1</tpImp>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ><xNome>DISTRIBUIDORA EXEMPLO LTDA</xNome><xFant>EXEMPLO</xFant>
        <enderEmit><xLgr>ROD BR 101</xLgr><nro>1000</nro><xBairro>DISTRITO INDUSTRIAL</xBairro>
          <xMun>JABOATAO DOS GUARARAPES</xMun><UF>PE</UF><CEP>54250610</CEP><fone>8130000000</fone></enderEmit>
        <IE>1234567890</IE><CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>11222333000199</CNPJ><xNome>MERCADINHO DO JOAO LTDA</xNome>
        <enderDest><xLgr>RUA DAS FLORES</xLgr><nro>45</nro><xBairro>CENTRO</xBairro>
          <xMun>RECIFE</xMun><UF>PE</UF><CEP>50000000</CEP><fone>8199990000</fone></enderDest>
        <IE>9876543210</IE><email>joao@mercadinho.com</email>
      </dest>
      <det nItem="1">
        <prod><cProd>101</cProd><xProd>ARROZ TIPO 1 5KG</xProd><NCM>10063021</NCM><CFOP>5102</CFOP>
          <uCom>FD</uCom><qCom>10.0000</qCom><vUnCom>25.0000000000</vUnCom><vProd>250.00</vProd></prod>
        <imposto><ICMS><ICMS00><CST>00</CST><vBC>250.00</vBC><pICMS>18.00</pICMS><vICMS>45.00</vICMS></ICMS00></ICMS>
          <IPI><IPITrib><pIPI>5.00</pIPI><vIPI>12.50</vIPI></IPITrib></IPI></imposto>
      </det>
      <det nItem="2">
        <prod><cProd>202</cProd><xProd>FEIJAO CARIOCA 1KG</xProd><NCM>07133399</NCM><CFOP>5102</CFOP>
          <uCom>UN</uCom><qCom>30.0000</qCom><vUnCom>8.0000000000</vUnCom><vProd>240.00</vProd></prod>
        <imposto><ICMS><ICMS00><CST>00</CST><vBC>240.00</vBC><pICMS>18.00</pICMS><vICMS>43.20</vICMS></ICMS00></ICMS></imposto>
      </det>
      <total><ICMSTot>
        <vBC>490.00</vBC><vICMS>88.20</vICMS><vBCST>0.00</vBCST><vST>0.00</vST>
        <vProd>490.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc>
        <vIPI>12.50</vIPI><vOutro>0.00</vOutro><vNF>502.50</vNF>
      </ICMSTot></total>
      <transp><modFrete>0</modFrete>
        <transporta><CNPJ>55666777000188</CNPJ><xNome>TRANSPORTES RAPIDOS</xNome><IE>1112223330</IE>
          <xEnder>AV BRASIL 200</xEnder><xMun>RECIFE</xMun><UF>PE</UF></transporta>
        <veicTransp><placa>ABC1D23</placa><UF>PE</UF></veicTransp>
        <vol><qVol>40</qVol><esp>CAIXA</esp><pesoL>60.000</pesoL><pesoB>62.500</pesoB></vol>
      </transp>
      <cobr><dup><nDup>001</nDup><dVenc>2026-10-14</dVenc><vDup>502.50</vDup></dup></cobr>
      <infAdic><infCpl>Pedido 987654. Entregar no periodo da manha.</infCpl></infAdic>
    </infNFe>
  </NFe>
  <protNFe versao="4.00"><infProt><chNFe>26260912345678000199550030024958121136106610</chNFe>
    <nProt>126260000123456</nProt><dhRecbto>2026-09-14T08:31:00-03:00</dhRecbto></infProt></protNFe>
</nfeProc>`;

describe("parseNfe", () => {
  const d = parseNfe(XML);

  it("extrai chave, protocolo e identificação", () => {
    expect(d.chave).toBe("26260912345678000199550030024958121136106610");
    expect(d.chave).toHaveLength(44);
    expect(d.protocolo).toBe("126260000123456");
    expect(d.ide.numero).toBe("2495812");
    expect(d.ide.serie).toBe("3");
    expect(d.ide.tipo).toBe("1");
    expect(d.ide.naturezaOperacao).toBe("VENDA DE MERCADORIA");
  });

  it("extrai emitente e destinatário com endereço", () => {
    expect(d.emitente.nome).toBe("DISTRIBUIDORA EXEMPLO LTDA");
    expect(d.emitente.documento).toBe("12345678000199");
    expect(d.emitente.endereco.municipio).toBe("JABOATAO DOS GUARARAPES");
    expect(d.destinatario.nome).toBe("MERCADINHO DO JOAO LTDA");
    expect(d.destinatario.documento).toBe("11222333000199");
    expect(d.destinatario.endereco.uf).toBe("PE");
  });

  it("extrai os itens com impostos", () => {
    expect(d.itens).toHaveLength(2);
    expect(d.itens[0]).toMatchObject({
      codigo: "101", descricao: "ARROZ TIPO 1 5KG", cfop: "5102",
      quantidade: "10.0000", valorTotal: "250.00", aliqIcms: "18.00", valorIpi: "12.50",
    });
    expect(d.itens[1].codigo).toBe("202");
    expect(d.itens[1].valorIpi).toBeNull();
  });

  it("extrai totais, transporte, duplicata e infAdic", () => {
    expect(d.totais.valorNota).toBe("502.50");
    expect(d.totais.valorProdutos).toBe("490.00");
    expect(d.transporte.transportadora?.nome).toBe("TRANSPORTES RAPIDOS");
    expect(d.transporte.veiculo?.placa).toBe("ABC1D23");
    expect(d.transporte.volumes?.pesoBruto).toBe("62.500");
    expect(d.duplicatas).toHaveLength(1);
    expect(d.duplicatas[0]).toMatchObject({ numero: "001", valor: "502.50" });
    expect(d.informacoesComplementares).toContain("Pedido 987654");
  });

  it("aceita <NFe> puro (sem nfeProc/protocolo)", () => {
    const semProc = XML.replace(/<nfeProc[^>]*>/, "").replace("</nfeProc>", "")
      .replace(/<protNFe[\s\S]*<\/protNFe>/, "");
    const p = parseNfe(semProc);
    expect(p.chave).toHaveLength(44);
    expect(p.protocolo).toBeNull();
    expect(p.itens).toHaveLength(2);
  });
});
