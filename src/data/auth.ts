import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/domain/types";

export interface Perfil {
  id: string;
  email: string | null;
  role: UserRole;
}

/**
 * Perfil do usuário logado (id, e-mail, papel). Memoizado por requisição.
 * Retorna null se não houver sessão. Papel padrão = "viewer" se o perfil
 * ainda não existir (ex: antes da migration rodar).
 */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (data?.role as UserRole) ?? "viewer",
  };
});

/** True se o usuário logado for admin. Usado para liberar/esconder edição. */
export async function isAdmin(): Promise<boolean> {
  return (await getPerfil())?.role === "admin";
}

/**
 * Barra escrita para quem não é admin. Chamado no topo de toda Server Action
 * de mutação (defesa em profundidade; a barreira real é o RLS no banco).
 */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Ação restrita a administradores.");
  }
}
