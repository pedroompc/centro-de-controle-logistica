// Abas da página de Devoluções. Fica fora do componente cliente para a página
// (servidor) validar o `?aba=` da URL — ex.: o Dashboard abre direto em "retira".
export type Aba = "motoristas" | "retira" | "clientes" | "vendedores" | "supervisores" | "motivos" | "dias" | "mapa" | "bairros" | "retorno";

export const ABAS: readonly Aba[] = ["motoristas", "retira", "clientes", "vendedores", "supervisores", "motivos", "dias", "mapa", "bairros", "retorno"];

export const lerAba = (v: string | undefined): Aba | undefined => (ABAS as readonly string[]).includes(v ?? "") ? (v as Aba) : undefined;
