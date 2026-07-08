import { revalidatePath } from "next/cache";

// Revalida todas as telas que dependem de funcionários/setores/faltas.
// Centralizado para que a cobertura não desalinhe entre as mutações.
export function revalidarEfetivo(): void {
  revalidatePath("/");
  revalidatePath("/setores");
  revalidatePath("/funcionarios");
  revalidatePath("/setores/[id]", "page");
  revalidatePath("/funcionarios/[id]", "page");
}
