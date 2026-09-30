"use server";

import { createClient } from "@/lib/supabase/server";
import { mapFuncionario } from "./mappers";
import { revalidarEfetivo } from "./revalidate";
import { assertAdmin } from "./auth";
import { custoMensalDaComposicao } from "@/domain/efetivo";
import type { Funcionario } from "@/domain/types";

// Literal único (não concatenar): o Supabase infere as colunas a partir do tipo
// literal da string; um `string` genérico degrada a inferência.
const COLUNAS = "id, nome, cargo, setor_id, custo_mensal, data_admissao, status, salario_base, passagem, alimentacao, plano_saude, ajuda_custo, premiacao, adicional_noturno";

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("funcionarios").select(COLUNAS).order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFuncionario);
}

export async function buscarFuncionario(id: string): Promise<Funcionario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionarios")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapFuncionario(data) : null;
}

/** Rubrica do formulário: vazio = não informada (null), não zero. */
function rubrica(formData: FormData, campo: string): number | null {
  const bruto = String(formData.get(campo) ?? "").trim();
  if (bruto === "") return null;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Devolve `{ erro }` em vez de lançar: em produção o Next troca a mensagem de
 * um erro lançado por uma genérica, e quem salva precisa ver o motivo real.
 */
export async function salvarFuncionario(formData: FormData): Promise<{ erro: string } | undefined> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const composicao = {
    salarioBase: rubrica(formData, "salario_base"),
    passagem: rubrica(formData, "passagem"),
    alimentacao: rubrica(formData, "alimentacao"),
    planoSaude: rubrica(formData, "plano_saude"),
    ajudaCusto: rubrica(formData, "ajuda_custo"),
    premiacao: rubrica(formData, "premiacao"),
    adicionalNoturno: rubrica(formData, "adicional_noturno"),
  };
  // Com rubricas, o custo é calculado aqui (salário × 1,85 + demais) — o valor
  // vindo do navegador é só prévia. Sem nenhuma, vale o custo digitado.
  const calculado = custoMensalDaComposicao(composicao);
  const registro = {
    nome: String(formData.get("nome") ?? "").trim(),
    cargo: String(formData.get("cargo") ?? "").trim(),
    setor_id: String(formData.get("setor_id") ?? ""),
    custo_mensal: calculado ?? Number(formData.get("custo_mensal") ?? 0),
    data_admissao: String(formData.get("data_admissao") ?? ""),
    status: String(formData.get("status") ?? "ativo"),
    salario_base: composicao.salarioBase,
    passagem: composicao.passagem,
    alimentacao: composicao.alimentacao,
    plano_saude: composicao.planoSaude,
    ajuda_custo: composicao.ajudaCusto,
    premiacao: composicao.premiacao,
    adicional_noturno: composicao.adicionalNoturno,
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("funcionarios").update(registro).eq("id", id)
    : supabase.from("funcionarios").insert(registro);
  const { error } = await query;
  if (error) return { erro: error.message };
  revalidarEfetivo();
}

export async function excluirFuncionario(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("funcionarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarEfetivo();
}
