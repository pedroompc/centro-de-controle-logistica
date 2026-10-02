"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapFornecedor } from "./mappers";
import { assertAdmin } from "./auth";
import { acharDuplicado } from "@/domain/fornecedores";
import type { Fornecedor } from "@/domain/types";

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFornecedor);
}

/** Resposta para o formulário (useActionState): erro ou aviso na tela. */
export interface RespostaFornecedor {
  erro?: string;
  aviso?: string;
  nome?: string; // o que foi digitado, para não sumir do campo quando dá erro
}

/** Cadastro inteiro, inclusive os encerrados: o duplicado pode estar encerrado. */
async function cadastroCompleto(): Promise<Fornecedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fornecedores").select("id, nome, ativo");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFornecedor);
}

function revalidar() {
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}

/**
 * Não deixa cadastrar o mesmo fornecedor com outra grafia. Se o igual estiver
 * encerrado, reativa ele em vez de criar outro.
 */
export async function criarFornecedor(_anterior: RespostaFornecedor, formData: FormData): Promise<RespostaFornecedor> {
  await assertAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Digite o nome do fornecedor." };
  const igual = acharDuplicado(nome, await cadastroCompleto());
  const supabase = await createClient();
  if (igual?.ativo) return { erro: `Esse fornecedor já existe como "${igual.nome}".`, nome };
  if (igual) {
    const { error } = await supabase.from("fornecedores").update({ ativo: true }).eq("id", igual.id);
    if (error) throw new Error(error.message);
    revalidar();
    return { aviso: `"${igual.nome}" estava encerrado e foi reativado.` };
  }
  const { error } = await supabase.from("fornecedores").insert({ nome });
  if (error) throw new Error(error.message);
  revalidar();
  return {};
}

export async function editarFornecedor(_anterior: RespostaFornecedor, formData: FormData): Promise<RespostaFornecedor> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return { erro: "Digite o nome do fornecedor." };
  const igual = acharDuplicado(nome, await cadastroCompleto(), id);
  if (igual) return { erro: `Esse nome é de outro cadastro: "${igual.nome}"${igual.ativo ? "" : " (encerrado)"}.`, nome };
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ nome }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
  return {};
}

export async function encerrarFornecedor(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}
