/**
 * Fornecedor duplicado: o mesmo fornecedor digitado de jeitos diferentes
 * ("BUNGE ALIMENTOS S/A." × "BUNGE ALIMENTOS S/A", "TIMBAÚBA S.A" × "TIMBAUBA S.A")
 * dividia os lançamentos em dois cadastros e o BI mostrava duas empresas.
 *
 * A chave ignora acento, pontuação, espaço e as palavras de razão social — a
 * mesma regra da consulta usada para limpar o cadastro em out/2026.
 */
import type { Fornecedor } from "./types";

const PALAVRAS_RAZAO_SOCIAL = new Set([
  "LTDA", "LTD", "SA", "ME", "EPP", "EIRELI", "MATRIZ", "FILIAL", "CIA",
  "IND", "INDL", "INDUSTRIA", "INDUSTRIAS", "INDUSTRIAL", "COM", "COMERCIO", "IMP", "EXP",
  "DE", "DA", "DO", "DOS", "DAS", "E",
]);

function semAcento(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

export function chaveFornecedor(nome: string): string {
  const palavras = semAcento(nome).replace(/[^A-Z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  // "S/A" e "S.A" viram "S A": junta antes de tirar as palavras de razão social.
  const juntas: string[] = [];
  for (let i = 0; i < palavras.length; i++) {
    if (palavras[i] === "S" && palavras[i + 1] === "A") {
      juntas.push("SA");
      i++;
    } else juntas.push(palavras[i]);
  }
  const chave = juntas.filter((p) => !PALAVRAS_RAZAO_SOCIAL.has(p)).join("");
  // Nome só com razão social ("IND COM LTDA"): compara o nome inteiro limpo.
  return chave || juntas.join("");
}

/**
 * Cadastro que já é o mesmo fornecedor (`ignorarId` = o próprio, ao renomear).
 * Prefere o ativo: depois da limpeza, o duplicado encerrado aponta para o ativo.
 */
export function acharDuplicado(nome: string, cadastro: Fornecedor[], ignorarId?: string): Fornecedor | null {
  const chave = chaveFornecedor(nome);
  if (!chave) return null;
  const iguais = cadastro.filter((f) => f.id !== ignorarId && chaveFornecedor(f.nome) === chave);
  return iguais.find((f) => f.ativo) ?? iguais[0] ?? null;
}
