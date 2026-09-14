import { XMLParser } from "fast-xml-parser";

// Parser do XML da NF-e (layout nacional 4.00) para os dados que o DANFE precisa.
// Aceita tanto o XML autorizado completo (<nfeProc> com protocolo) quanto o
// <NFe> puro. Tudo é lido como string — a formatação (R$, datas) fica no render.

export interface DanfeEndereco {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  fone: string | null;
}

export interface DanfeItem {
  numero: string;
  codigo: string;
  descricao: string;
  ncm: string | null;
  cst: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: string | null;
  valorUnitario: string | null;
  valorTotal: string | null;
  baseIcms: string | null;
  valorIcms: string | null;
  aliqIcms: string | null;
  valorIpi: string | null;
  aliqIpi: string | null;
}

export interface DanfeDuplicata {
  numero: string | null;
  vencimento: string | null;
  valor: string | null;
}

export interface DanfeData {
  chave: string;
  versao: string | null;
  protocolo: string | null;
  dataAutorizacao: string | null;
  ide: {
    numero: string | null;
    serie: string | null;
    naturezaOperacao: string | null;
    dataEmissao: string | null;
    dataSaida: string | null;
    tipo: string | null; // "0" entrada, "1" saída
    tipoImpressao: string | null;
  };
  emitente: {
    documento: string | null;
    nome: string | null;
    fantasia: string | null;
    ie: string | null;
    endereco: DanfeEndereco;
  };
  destinatario: {
    documento: string | null;
    nome: string | null;
    ie: string | null;
    email: string | null;
    endereco: DanfeEndereco;
  };
  itens: DanfeItem[];
  totais: {
    baseIcms: string | null;
    valorIcms: string | null;
    baseIcmsSt: string | null;
    valorIcmsSt: string | null;
    valorProdutos: string | null;
    valorFrete: string | null;
    valorSeguro: string | null;
    desconto: string | null;
    outras: string | null;
    valorIpi: string | null;
    valorNota: string | null;
  };
  transporte: {
    modalidade: string | null; // 0..9 (0 = por conta do emitente, etc.)
    transportadora: { nome: string | null; documento: string | null; ie: string | null; endereco: string | null; municipio: string | null; uf: string | null } | null;
    veiculo: { placa: string | null; uf: string | null; rntc: string | null } | null;
    volumes: { quantidade: string | null; especie: string | null; marca: string | null; pesoLiquido: string | null; pesoBruto: string | null } | null;
  };
  duplicatas: DanfeDuplicata[];
  informacoesComplementares: string | null;
  informacoesFisco: string | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false, // mantém tudo string (não converte "0" em número, nem perde zeros à esquerda)
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ["det", "dup", "vol", "detPag"].includes(name),
});

// Navega um caminho "a.b.c" com segurança. Retorna undefined se algo faltar.
function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Valor de tag/atributo como string limpa, ou null.
function s(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") return null; // tag com filhos, não folha
  const t = String(v).trim();
  return t === "" ? null : t;
}

function endereco(node: unknown): DanfeEndereco {
  return {
    logradouro: s(get(node, "xLgr")),
    numero: s(get(node, "nro")),
    complemento: s(get(node, "xCpl")),
    bairro: s(get(node, "xBairro")),
    municipio: s(get(node, "xMun")),
    uf: s(get(node, "UF")),
    cep: s(get(node, "CEP")),
    fone: s(get(node, "fone")),
  };
}

function documento(node: unknown): string | null {
  return s(get(node, "CNPJ")) ?? s(get(node, "CPF")) ?? s(get(node, "idEstrangeiro"));
}

export function parseNfe(xml: string): DanfeData {
  const raiz = parser.parse(xml) as Record<string, unknown>;
  // Aceita <nfeProc><NFe>… ou <NFe>… direto.
  const nfe = get(raiz, "nfeProc.NFe") ?? get(raiz, "NFe");
  const infNFe = get(nfe, "infNFe");
  if (!infNFe) throw new Error("XML sem infNFe — não parece uma NF-e válida.");

  const idAttr = s(get(infNFe, "@_Id")) ?? "";
  const chave = idAttr.replace(/^NFe/i, "").replace(/\D/g, "");

  const ide = get(infNFe, "ide");
  const emit = get(infNFe, "emit");
  const dest = get(infNFe, "dest");
  const total = get(infNFe, "total.ICMSTot");
  const transp = get(infNFe, "transp");
  const infProt = get(raiz, "nfeProc.protNFe.infProt");

  const dets = (get(infNFe, "det") as unknown[] | undefined) ?? [];
  const itens: DanfeItem[] = dets.map((d) => {
    const prod = get(d, "prod");
    const icms = get(d, "imposto.ICMS");
    const ipi = get(d, "imposto.IPI");
    // ICMS/IPI têm um sub-nó variável (ICMS00, ICMS20, IPITrib…); pega o primeiro objeto filho.
    const icmsGrp = icms && typeof icms === "object" ? Object.values(icms as Record<string, unknown>)[0] : undefined;
    const ipiTrib = get(ipi, "IPITrib");
    return {
      numero: s(get(d, "@_nItem")) ?? "",
      codigo: s(get(prod, "cProd")) ?? "",
      descricao: s(get(prod, "xProd")) ?? "",
      ncm: s(get(prod, "NCM")),
      cst: s(get(icmsGrp, "CST")) ?? s(get(icmsGrp, "CSOSN")),
      cfop: s(get(prod, "CFOP")),
      unidade: s(get(prod, "uCom")),
      quantidade: s(get(prod, "qCom")),
      valorUnitario: s(get(prod, "vUnCom")),
      valorTotal: s(get(prod, "vProd")),
      baseIcms: s(get(icmsGrp, "vBC")),
      valorIcms: s(get(icmsGrp, "vICMS")),
      aliqIcms: s(get(icmsGrp, "pICMS")),
      valorIpi: s(get(ipiTrib, "vIPI")),
      aliqIpi: s(get(ipiTrib, "pIPI")),
    };
  });

  const dups = (get(infNFe, "cobr.dup") as unknown[] | undefined) ?? [];
  const duplicatas: DanfeDuplicata[] = dups.map((d) => ({
    numero: s(get(d, "nDup")),
    vencimento: s(get(d, "dVenc")),
    valor: s(get(d, "vDup")),
  }));

  const transportadora = get(transp, "transporta");
  const veic = get(transp, "veicTransp");
  const vols = (get(transp, "vol") as unknown[] | undefined) ?? [];
  const vol = vols[0];

  return {
    chave,
    versao: s(get(infNFe, "@_versao")),
    protocolo: s(get(infProt, "nProt")),
    dataAutorizacao: s(get(infProt, "dhRecbto")),
    ide: {
      numero: s(get(ide, "nNF")),
      serie: s(get(ide, "serie")),
      naturezaOperacao: s(get(ide, "natOp")),
      dataEmissao: s(get(ide, "dhEmi")) ?? s(get(ide, "dEmi")),
      dataSaida: s(get(ide, "dhSaiEnt")) ?? s(get(ide, "dSaiEnt")),
      tipo: s(get(ide, "tpNF")),
      tipoImpressao: s(get(ide, "tpImp")),
    },
    emitente: {
      documento: documento(emit),
      nome: s(get(emit, "xNome")),
      fantasia: s(get(emit, "xFant")),
      ie: s(get(emit, "IE")),
      endereco: endereco(get(emit, "enderEmit")),
    },
    destinatario: {
      documento: documento(dest),
      nome: s(get(dest, "xNome")),
      ie: s(get(dest, "IE")),
      email: s(get(dest, "email")),
      endereco: endereco(get(dest, "enderDest")),
    },
    itens,
    totais: {
      baseIcms: s(get(total, "vBC")),
      valorIcms: s(get(total, "vICMS")),
      baseIcmsSt: s(get(total, "vBCST")),
      valorIcmsSt: s(get(total, "vST")),
      valorProdutos: s(get(total, "vProd")),
      valorFrete: s(get(total, "vFrete")),
      valorSeguro: s(get(total, "vSeg")),
      desconto: s(get(total, "vDesc")),
      outras: s(get(total, "vOutro")),
      valorIpi: s(get(total, "vIPI")),
      valorNota: s(get(total, "vNF")),
    },
    transporte: {
      modalidade: s(get(transp, "modFrete")),
      transportadora: transportadora
        ? {
            nome: s(get(transportadora, "xNome")),
            documento: documento(transportadora),
            ie: s(get(transportadora, "IE")),
            endereco: s(get(transportadora, "xEnder")),
            municipio: s(get(transportadora, "xMun")),
            uf: s(get(transportadora, "UF")),
          }
        : null,
      veiculo: veic
        ? { placa: s(get(veic, "placa")), uf: s(get(veic, "UF")), rntc: s(get(veic, "RNTC")) }
        : null,
      volumes: vol
        ? {
            quantidade: s(get(vol, "qVol")),
            especie: s(get(vol, "esp")),
            marca: s(get(vol, "marca")),
            pesoLiquido: s(get(vol, "pesoL")),
            pesoBruto: s(get(vol, "pesoB")),
          }
        : null,
    },
    duplicatas,
    informacoesComplementares: s(get(infNFe, "infAdic.infCpl")),
    informacoesFisco: s(get(infNFe, "infAdic.infAdFisco")),
  };
}
