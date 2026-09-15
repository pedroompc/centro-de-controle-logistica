/**
 * Classifica um município de Pernambuco numa das 4 mesorregiões que o painel
 * usa: RMR (Região Metropolitana do Recife), Agreste, Sertão e Zona da Mata.
 * (O IBGE separa ainda o São Francisco; aqui ele entra em Sertão, como pediram.)
 *
 * O nome da cidade vem do Winthor (PCCLIENT.MUNICENT) e chega em CAIXA ALTA e às
 * vezes TRUNCADO (ex.: "JABOATAO DOS GU"). Por isso o casamento é por nome
 * normalizado + prefixo. A lista cobre as cidades de maior volume; o que não
 * casar cai em "Outras" — dá para estender esta lista quando aparecer cidade
 * nova relevante.
 */
export type RegiaoPE = "RMR" | "Agreste" | "Sertão" | "Zona da Mata" | "Outras";

/** Ordem fixa de exibição (Outras sempre por último). */
export const ORDEM_REGIAO: RegiaoPE[] = ["RMR", "Agreste", "Sertão", "Zona da Mata", "Outras"];

/** CAIXA ALTA, sem acento, sem "/UF", espaços colapsados. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\/.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Chaves já normalizadas (sem acento, caixa alta).
const CIDADES: Record<Exclude<RegiaoPE, "Outras">, string[]> = {
  RMR: [
    "RECIFE", "JABOATAO DOS GUARARAPES", "OLINDA", "PAULISTA", "CABO DE SANTO AGOSTINHO",
    "CAMARAGIBE", "SAO LOURENCO DA MATA", "ABREU E LIMA", "IGARASSU", "IPOJUCA",
    "MORENO", "ITAPISSUMA", "ARACOIABA", "ILHA DE ITAMARACA", "ITAMARACA", "FERNANDO DE NORONHA",
  ],
  "Zona da Mata": [
    "GOIANA", "VITORIA DE SANTO ANTAO", "CARPINA", "PAUDALHO", "NAZARE DA MATA", "TIMBAUBA",
    "PALMARES", "ESCADA", "RIBEIRAO", "GAMELEIRA", "CATENDE", "AGUA PRETA", "BARREIROS",
    "SAO JOSE DA COROA GRANDE", "MARAIAL", "JOAQUIM NABUCO", "SIRINHAEM", "AMARAJI", "PRIMAVERA",
    "CORTES", "GLORIA DO GOITA", "LAGOA DO CARRO", "LAGOA DE ITAENGA", "BUENOS AIRES", "MACHADOS",
    "VICENCIA", "TRACUNHAEM", "CONDADO", "ALIANCA", "ITAQUITINGA", "CHA DE ALEGRIA", "POMBOS",
    "CHA GRANDE", "XEXEU", "TAMANDARE", "FERREIROS", "CAMUTANGA",
  ],
  Agreste: [
    "CARUARU", "GARANHUNS", "SANTA CRUZ DO CAPIBARIBE", "BELO JARDIM", "GRAVATA", "BEZERROS",
    "SURUBIM", "TORITAMA", "PESQUEIRA", "SAO BENTO DO UNA", "BOM CONSELHO", "AGUAS BELAS",
    "SAO CAETANO", "TACAIMBO", "BREJO DA MADRE DE DEUS", "VERTENTES", "TAQUARITINGA DO NORTE",
    "RIACHO DAS ALMAS", "CUPIRA", "PANELAS", "AGRESTINA", "ALTINHO", "CANHOTINHO", "LAJEDO",
    "CACHOEIRINHA", "CAETES", "CAPOEIRAS", "SANHARO", "PEDRA", "VENTUROSA", "BOM JARDIM",
    "FEIRA NOVA", "JOAO ALFREDO", "OROBO", "PASSIRA", "SALGADINHO", "CUMARU", "FREI MIGUELINHO",
    "SANTA MARIA DO CAMBUCA", "SAO JOAQUIM DO MONTE", "JUREMA", "LAGOA DOS GATOS", "BONITO",
    "BARRA DE GUABIRABA", "CAMOCIM DE SAO FELIX", "SAIRE", "JUCATI", "JUPI", "LAGOA DO OURO",
    "PARANATAMA", "SALOA", "TEREZINHA", "CALCADO", "ANGELIM", "BREJAO", "CORRENTES", "IATI",
    "PALMEIRINA",
  ],
  Sertão: [
    "PETROLINA", "SERRA TALHADA", "SALGUEIRO", "ARARIPINA", "OURICURI", "AFOGADOS DA INGAZEIRA",
    "CUSTODIA", "PETROLANDIA", "FLORESTA", "ARCOVERDE", "SAO JOSE DO EGITO", "CARNAIBA", "TRIUNFO",
    "FLORES", "CABROBO", "TERRA NOVA", "OROCO", "LAGOA GRANDE", "SANTA MARIA DA BOA VISTA",
    "BELEM DO SAO FRANCISCO", "ITACURUBA", "INAJA", "TACARATU", "JATOBA", "BODOCO", "EXU",
    "GRANITO", "IPUBI", "MOREILANDIA", "PARNAMIRIM", "SANTA CRUZ", "SANTA FILOMENA", "TRINDADE",
    "BREJINHO", "IGUARACY", "INGAZEIRA", "ITAPETIM", "QUIXABA", "SANTA TEREZINHA",
    "SAO JOSE DO BELMONTE", "SERRITA", "VERDEJANTE", "MIRANDIBA", "CARNAUBEIRA DA PENHA",
    "BETANIA", "SERTANIA", "TUPANATINGA", "ITAIBA", "MANARI", "IBIMIRIM", "BUIQUE",
    "DORMENTES", "AFRANIO", "CEDRO", "TABIRA",
  ],
};

/** Índice normalizado → região (montado uma vez). */
const INDICE: { chave: string; regiao: RegiaoPE }[] = Object.entries(CIDADES).flatMap(
  ([regiao, cidades]) => cidades.map((chave) => ({ chave, regiao: regiao as RegiaoPE })),
);

/**
 * Região do município. `uf` diferente de PE → "Outras". Casa por nome exato,
 * por prefixo (chave começa com o nome truncado) ou pelo caminho inverso.
 */
export function classificarRegiao(cidade: string | null, uf: string | null): RegiaoPE {
  if (uf && normalizar(uf) !== "PE") return "Outras";
  const c = normalizar(cidade ?? "");
  if (!c) return "Outras";
  for (const { chave, regiao } of INDICE) {
    if (chave === c || (c.length >= 5 && chave.startsWith(c)) || (c.length >= 8 && c.startsWith(chave))) {
      return regiao;
    }
  }
  return "Outras";
}
