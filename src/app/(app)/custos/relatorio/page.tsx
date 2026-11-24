import { redirect } from "next/navigation";

/** O relatório virou a tela inicial de Custos (/custos); link antigo segue funcionando. */
export default async function RelatorioAntigo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  redirect(qs.size ? `/custos?${qs}` : "/custos");
}
