// Sem "use server" de propósito: só é chamado de dentro de ações que já
// passaram pelo assertAdmin (não vira endpoint).
import { createClient } from "@/lib/supabase/server";
import { linhasDeEquipamento, PREFIXO_EQUIPAMENTO } from "@/domain/equipamentos-custo";
import { primeiroDiaDoMes } from "@/domain/periodo";

type Cliente = Awaited<ReturnType<typeof createClient>>;

/**
 * Regrava os fixos de equipamento de um mês a partir do cadastro de
 * equipamentos (apaga as linhas "Equipamento · …" do mês e insere as atuais).
 * Mês sem cadastro (tabela ausente) fica como está.
 */
export async function sincronizarEquipamentosDoMes(supabase: Cliente, mes: string): Promise<void> {
  const { data, error } = await supabase
    .from("equipamentos")
    .select("id, nome, setor, quantidade, custo_unitario")
    .eq("ativo", true);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return;
    throw new Error(error.message);
  }
  const linhas = linhasDeEquipamento(
    (data ?? []).map((r) => ({
      id: String(r.id),
      nome: String(r.nome),
      setor: String(r.setor ?? "Recebimento"),
      quantidade: Number(r.quantidade) || 0,
      custoUnitario: Number(r.custo_unitario) || 0,
    })),
  );
  const { error: eDel } = await supabase
    .from("custos_mensais")
    .delete()
    .eq("mes", mes)
    .eq("tipo", "fixo")
    .like("nome", `${PREFIXO_EQUIPAMENTO}%`);
  if (eDel) throw new Error(eDel.message);
  if (linhas.length === 0) return;
  const { error: eIns } = await supabase
    .from("custos_mensais")
    .insert(linhas.map((l) => ({ mes, nome: l.nome, tipo: "fixo" as const, valor: l.valor })));
  if (eIns) throw new Error(eIns.message);
}

/** Depois de mexer no cadastro: reflete nos meses já abertos a partir do atual (passado fica intacto). */
export async function sincronizarEquipamentosAbertos(supabase: Cliente): Promise<void> {
  const { data, error } = await supabase.from("custos_mensais").select("mes").eq("tipo", "fixo").gte("mes", primeiroDiaDoMes());
  if (error) throw new Error(error.message);
  for (const mes of new Set((data ?? []).map((r) => String(r.mes)))) await sincronizarEquipamentosDoMes(supabase, mes);
}
