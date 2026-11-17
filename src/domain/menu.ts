// Ordem e grupos do menu lateral (um lugar só: barra lateral e folha "Mais" do
// celular seguem esta ordem). Gestão fica por último, com Custos e Receitas
// primeiro. Painel (TV) e Auditoria não são telas do dia a dia: vão para o
// rodapé da barra, junto do selo do perfil.

export interface GrupoMenu {
  titulo: string;
  hrefs: string[];
}

export const GRUPOS_MENU: GrupoMenu[] = [
  { titulo: "Visão geral", hrefs: ["/", "/bi"] },
  { titulo: "Operação", hrefs: ["/setores", "/funcionarios", "/pedidos", "/pedidos-a-faturar", "/devolucoes", "/cortes", "/frota"] },
  { titulo: "Gestão", hrefs: ["/custos", "/receitas", "/tendencias", "/estoque", "/fechamento"] },
];

export const RODAPE_MENU = ["/painel", "/auditoria"];

/** Tela atual é a do item (ou uma subtela dele): "/pedidos" não acende em "/pedidos-a-faturar". */
export function itemAtivo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Itens agrupados na ordem do menu (só os presentes em `itens`; grupo vazio some). */
export function agruparMenu<T extends { href: string }>(itens: T[]): { titulo: string; itens: T[] }[] {
  const porHref = new Map(itens.map((i) => [i.href, i]));
  return GRUPOS_MENU.map((g) => ({ titulo: g.titulo, itens: g.hrefs.flatMap((h) => porHref.get(h) ?? []) })).filter((g) => g.itens.length > 0);
}

/** Itens do rodapé, na ordem. */
export function rodapeMenu<T extends { href: string }>(itens: T[]): T[] {
  const porHref = new Map(itens.map((i) => [i.href, i]));
  return RODAPE_MENU.flatMap((h) => porHref.get(h) ?? []);
}

/** Lista plana na ordem do menu: grupos e depois rodapé; item fora do mapa vai ao fim do último grupo. */
export function ordenarMenu<T extends { href: string }>(itens: T[]): T[] {
  const conhecidos = new Set([...GRUPOS_MENU.flatMap((g) => g.hrefs), ...RODAPE_MENU]);
  return [...agruparMenu(itens).flatMap((g) => g.itens), ...itens.filter((i) => !conhecidos.has(i.href)), ...rodapeMenu(itens)];
}
