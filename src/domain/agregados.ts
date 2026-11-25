/**
 * Agregados — vale a pena continuar com cada um? Junta o que pagamos (contas a
 * pagar do Winthor, por fornecedor/MEI) com o que ele rodou (cargas: dias,
 * entregas, faturado, devolução) e compara com a equipe da casa (CLT).
 *
 * O Winthor não liga o fornecedor (PCFORNEC) à pessoa da carga (PCEMPR), então
 * casamos pelo CPF que vem no nome do fornecedor ("FULANO 12345678901") ou pelo
 * nome (o do fornecedor vem com a raiz do CNPJ na frente: "12.345.678 FULANO").
 * Uma pessoa pode ter mais de um CNPJ (troca de MEI) e mais de uma matrícula.
 */

export type Papel = "motorista" | "ajudante";

/** Pagamentos do período por fornecedor (conta 13, data do lançamento). */
export interface PagamentoFornecedor {
  codFornec: number;
  nome: string;
  cgc: string | null;
  custo: number;
  lotes: number; // dias de lançamento distintos (≈ semanas pagas)
  ultimo: string | null; // "yyyy-mm-dd" do último lançamento
}

/** O que uma matrícula rodou no período num papel. */
export interface OperacaoPessoa {
  matricula: number;
  papel: Papel;
  nome: string | null;
  cpf: string | null;
  dias: number;
  viagens: number;
  notas: number;
  entregas: number;
  kg: number;
  faturado: number;
  notasDevolvidas: number;
  devolvido: number;
}

export interface Numeros {
  dias: number;
  viagens: number;
  notas: number;
  entregas: number;
  kg: number;
  faturado: number;
  notasDevolvidas: number;
  devolvido: number;
}

export interface LinhaAgregado extends Numeros {
  chave: string;
  nome: string;
  papel: Papel | null; // null = não achamos carga dele no período
  fornecedores: number[];
  matriculas: number[];
  custo: number;
  lotes: number;
  ultimoPagamento: string | null;
}

export interface Casa extends Numeros {
  papel: Papel;
  pessoas: number;
  custo: number; // folha do setor no período
}

export interface RelatorioAgregados {
  agregados: LinhaAgregado[];
  casa: Partial<Record<Papel, Casa>>;
  /** Quem rodou carga sem ser agregado nem da casa (ex.: DIA LOG, cadastro faltando). */
  outros: { matricula: number; nome: string | null; papel: string; dias: number }[];
}

const DIG = /\D/g;
export const normNome = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

/** Nome do fornecedor sem a raiz do CNPJ na frente nem o CPF no fim. */
export function nomeDoFornecedor(nome: string): string {
  return normNome(nome.replace(/^\s*[\d.]+\s+/, "").replace(/\s+\d{11}\s*$/, ""));
}

/** CPF que o fornecedor carrega: no fim do nome ou no CGC quando ele é CPF. */
export function cpfDoFornecedor(nome: string, cgc: string | null): string | null {
  const noNome = nome.match(/(\d{11})\s*$/)?.[1];
  if (noNome) return noNome;
  const d = (cgc ?? "").replace(DIG, "");
  return d.length === 11 ? d : null;
}

function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** O Winthor corta o nome da pessoa em 40 letras. */
const corte = (s: string) => s.slice(0, 40).trim();

/**
 * Matrículas da pessoa: CPF igual; senão nome igual (até 40 letras); senão nome
 * com até 2 letras de diferença e mesmo primeiro nome, se der UMA pessoa só.
 */
export function casarMatriculas(nome: string, cpf: string | null, pessoas: { matricula: number; nome: string | null; cpf: string | null }[]): number[] {
  if (cpf) {
    const porCpf = pessoas.filter((p) => (p.cpf ?? "").replace(DIG, "") === cpf);
    if (porCpf.length) return [...new Set(porCpf.map((p) => p.matricula))];
  }
  const alvo = corte(nome);
  if (alvo.split(" ").length < 2) return [];
  const exato = pessoas.filter((p) => p.nome && corte(normNome(p.nome)) === alvo);
  if (exato.length) return [...new Set(exato.map((p) => p.matricula))];
  // Um nome é o começo do outro ("JANIO PEDROSA" × "JANIO PEDROSA REGIS FILHO").
  const prefixo = pessoas.filter((p) => {
    if (!p.nome) return false;
    const n = corte(normNome(p.nome));
    return n.startsWith(alvo + " ") || alvo.startsWith(n + " ");
  });
  if (new Set(prefixo.map((p) => corte(normNome(p.nome!)))).size === 1) return [...new Set(prefixo.map((p) => p.matricula))];
  // Digitação: primeiro nome com até 1 letra de diferença (OZEAS × OZEIAS) e o
  // nome todo com até 2 (3 se for comprido).
  const primeiro = alvo.split(" ")[0];
  const perto = pessoas.filter((p) => {
    if (!p.nome) return false;
    const n = corte(normNome(p.nome));
    return lev(n.split(" ")[0], primeiro) <= 1 && lev(n, alvo) <= (alvo.length > 20 ? 3 : 2);
  });
  const nomes = new Set(perto.map((p) => corte(normNome(p.nome!))));
  if (nomes.size === 1) return [...new Set(perto.map((p) => p.matricula))];
  if (nomes.size > 1) return [];
  // Palavra a palavra ("EUGENIO CORREIA MESQUITA" × "EUGENIO CORREA DE MESQUITA"):
  // mesmo primeiro e último nome, e todo sobrenome do mais curto aparece no outro
  // com até 1 letra de diferença ("de/da/dos" não contam).
  const sig = (s: string) => s.split(" ").filter((w) => w.length > 2);
  const a = sig(alvo);
  const porPalavra = pessoas.filter((p) => {
    if (!p.nome) return false;
    const b = sig(corte(normNome(p.nome)));
    if (lev(b[0], a[0]) > 1 || b[b.length - 1] !== a[a.length - 1]) return false;
    const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
    return curto.every((w) => longo.some((x) => lev(w, x) <= 1));
  });
  const nomes2 = new Set(porPalavra.map((p) => corte(normNome(p.nome!))));
  return nomes2.size === 1 ? [...new Set(porPalavra.map((p) => p.matricula))] : [];
}

const zero = (): Numeros => ({ dias: 0, viagens: 0, notas: 0, entregas: 0, kg: 0, faturado: 0, notasDevolvidas: 0, devolvido: 0 });
function somar(a: Numeros, b: Numeros): void {
  a.dias += b.dias;
  a.viagens += b.viagens;
  a.notas += b.notas;
  a.entregas += b.entregas;
  a.kg += b.kg;
  a.faturado += b.faturado;
  a.notasDevolvidas += b.notasDevolvidas;
  a.devolvido += b.devolvido;
}

/**
 * Uma linha por agregado (fornecedores de mesmo nome/CPF viram uma pessoa).
 * Papel = onde ele mais rodou; os números são os desse papel (o motorista que
 * um dia foi de ajudante não soma a mesma nota duas vezes).
 */
export function montarAgregados(pagamentos: PagamentoFornecedor[], operacao: OperacaoPessoa[]): LinhaAgregado[] {
  const pessoas = [...new Map(operacao.map((o) => [o.matricula, { matricula: o.matricula, nome: o.nome, cpf: o.cpf }])).values()];
  const grupos = new Map<string, { nome: string; cpf: string | null; pags: PagamentoFornecedor[] }>();
  for (const p of pagamentos) {
    const nome = nomeDoFornecedor(p.nome);
    const cpf = cpfDoFornecedor(p.nome, p.cgc);
    const chave = nome || `F${p.codFornec}`;
    const g = grupos.get(chave) ?? { nome, cpf, pags: [] };
    g.cpf ??= cpf;
    g.pags.push(p);
    grupos.set(chave, g);
  }
  return [...grupos.entries()]
    .map(([chave, g]) => {
      const matriculas = casarMatriculas(g.nome, g.cpf, pessoas);
      const ops = operacao.filter((o) => matriculas.includes(o.matricula));
      const diasPor = (papel: Papel) => ops.filter((o) => o.papel === papel).reduce((t, o) => t + o.dias, 0);
      const papel: Papel | null = ops.length ? (diasPor("motorista") >= diasPor("ajudante") ? "motorista" : "ajudante") : null;
      const n = zero();
      for (const o of ops) if (o.papel === papel) somar(n, o);
      const ultimos = g.pags.map((p) => p.ultimo).filter((d): d is string => !!d).sort();
      return {
        chave,
        nome: g.nome || g.pags[0].nome,
        papel,
        fornecedores: g.pags.map((p) => p.codFornec),
        matriculas,
        custo: g.pags.reduce((t, p) => t + p.custo, 0),
        lotes: g.pags.reduce((t, p) => t + p.lotes, 0),
        ultimoPagamento: ultimos.length ? ultimos[ultimos.length - 1] : null,
        ...n,
      };
    })
    .sort((a, b) => b.custo - a.custo);
}

/** Totais da casa num papel: matrículas da equipe CLT (fora os agregados). */
export function totaisCasa(papel: Papel, operacao: OperacaoPessoa[], matriculasCasa: Set<number>, custo: number): Casa {
  const n = zero();
  const pessoas = new Set<number>();
  for (const o of operacao) {
    if (o.papel !== papel || !matriculasCasa.has(o.matricula)) continue;
    somar(n, o);
    pessoas.add(o.matricula);
  }
  return { papel, pessoas: pessoas.size, custo, ...n };
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export interface Indicadores {
  custoPorDia: number | null;
  custoPorEntrega: number | null;
  custoSobreFaturado: number | null; // custo ÷ (faturado − devolvido)
  devolucao: number | null; // devolvido ÷ faturado (valor)
  faturadoPorDia: number | null;
  entregasPorDia: number | null;
}

export function indicadores(x: { custo: number } & Numeros): Indicadores {
  const liquido = x.faturado - x.devolvido;
  return {
    custoPorDia: div(x.custo, x.dias),
    custoPorEntrega: div(x.custo, x.entregas),
    custoSobreFaturado: div(x.custo, liquido),
    devolucao: div(x.devolvido, x.faturado),
    faturadoPorDia: div(x.faturado, x.dias),
    entregasPorDia: div(x.entregas, x.dias),
  };
}

/**
 * Quanto o agregado custou A MAIS (positivo) ou A MENOS (negativo) do que a
 * casa gastaria pelos mesmos dias rodados no mesmo papel.
 */
export function diferencaVsCasa(a: LinhaAgregado, casa: Casa | undefined): number | null {
  const porDia = casa ? div(casa.custo, casa.dias) : null;
  if (porDia === null || a.dias === 0) return null;
  return a.custo - porDia * a.dias;
}
