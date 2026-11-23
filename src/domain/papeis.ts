import type { UserRole } from "./types";

// Papel "equipe": quem monitora as entregas. Enxerga Consulta de Pedidos,
// Pedidos a Faturar, Devoluções (todas as abas e PDFs), Cortes e Telemetria &
// Frota (sem os custos, que são só de admin). O resto do app redireciona para
// a Consulta de Pedidos (proxy) e some do menu.

/** Telas (e subtelas) liberadas para a equipe. */
export const ROTAS_EQUIPE = ["/pedidos", "/pedidos-a-faturar", "/devolucoes", "/cortes", "/frota"] as const;

/** Para onde a equipe cai ao entrar ou ao tentar abrir uma tela fora do alcance. */
export const INICIO_EQUIPE = "/pedidos";

/** Caminho liberado para a equipe? "/pedidos" não libera "/pedidos-a-faturar". */
export function rotaLiberadaParaEquipe(pathname: string): boolean {
  if (pathname.startsWith("/auth/")) return true; // sair
  return ROTAS_EQUIPE.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Papel válido a partir de um valor solto (ex.: app_metadata do Supabase). */
export function lerPapel(valor: unknown): UserRole | null {
  return valor === "admin" || valor === "viewer" || valor === "equipe" || valor === "rh" ? valor : null;
}

/** Rótulo do selo do perfil na barra lateral. */
export function rotuloPapel(papel: UserRole | null | undefined, curto = false): string {
  if (papel === "admin") return "Admin";
  if (papel === "equipe") return "Equipe";
  return curto ? "Leitura" : "Somente leitura";
}
