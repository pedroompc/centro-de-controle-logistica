import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirAdminPagina } from "@/data/auth";
import { PageHeader, Card, Pill } from "@/components/ui";
import { camposAlterados, rotuloRegistro, NOME_TABELA, NOME_OPERACAO, type RegistroAuditoria } from "@/domain/auditoria";

const LIMITE = 200;
const TOM = { INSERT: "navy", UPDATE: "gold", DELETE: "red" } as const;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Auditoria: quem incluiu, alterou ou excluiu cadastros e custos (trigger da
 * migration 0030). Só admin — a tabela também só abre para admin no banco.
 */
export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ tabela?: string }> }) {
  await exigirAdminPagina();
  const { tabela } = await searchParams;
  const filtro = tabela && tabela in NOME_TABELA ? tabela : null;

  const supabase = await createClient();
  let q = supabase.from("audit_log").select("id, em, tabela, operacao, registro, email, antes, depois").order("em", { ascending: false }).limit(LIMITE);
  if (filtro) q = q.eq("tabela", filtro);
  const { data, error } = await q;
  const registros = (data ?? []) as RegistroAuditoria[];
  const tabelas = Object.keys(NOME_TABELA).sort((a, b) => NOME_TABELA[a].localeCompare(NOME_TABELA[b], "pt-BR"));

  return (
    <div>
      <PageHeader title="Auditoria" subtitle={`Últimas ${LIMITE} alterações${filtro ? ` · ${NOME_TABELA[filtro]}` : ""}`} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/auditoria" className={chip(!filtro)}>Tudo</Link>
        {tabelas.map((t) => (
          <Link key={t} href={`/auditoria?tabela=${t}`} className={chip(filtro === t)}>
            {NOME_TABELA[t]}
          </Link>
        ))}
      </div>

      {error ? (
        <Card className="p-6 text-sm text-slate-500">
          {error.code === "42P01" || error.code === "PGRST205" ? "Falta aplicar a migration 0030 no Supabase." : "Supabase indisponível agora."}
        </Card>
      ) : registros.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">Nenhuma alteração registrada ainda.</Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {registros.map((r) => {
            const mudancas = camposAlterados(r.antes, r.depois);
            const visiveis = mudancas.slice(0, 4);
            const resto = mudancas.slice(4);
            return (
              <div key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="tabular-nums text-slate-400">{quando(r.em)}</span>
                  <Pill tone={TOM[r.operacao]}>{NOME_OPERACAO[r.operacao]}</Pill>
                  <span className="font-semibold text-[#141a4d]">{NOME_TABELA[r.tabela] ?? r.tabela}</span>
                  <span className="min-w-0 truncate text-slate-600" title={r.registro ?? undefined}>{rotuloRegistro(r)}</span>
                  <span className="ml-auto text-xs text-slate-400">{r.email ?? "SQL direto"}</span>
                </div>
                {visiveis.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {visiveis.map((m) => (
                      <li key={m.campo} className="truncate">
                        <span className="font-medium text-slate-600">{m.campo}</span>:{" "}
                        {r.operacao === "UPDATE" ? `${m.antes} → ${m.depois}` : r.operacao === "INSERT" ? m.depois : m.antes}
                      </li>
                    ))}
                    {resto.length > 0 && (
                      <li className="text-slate-400" title={resto.map((m) => `${m.campo}: ${m.antes} → ${m.depois}`).join("\n")}>
                        + {resto.length} campo{resto.length > 1 ? "s" : ""}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function chip(ativo: boolean) {
  return `rounded-full px-3 py-1 text-xs font-medium transition ${
    ativo ? "bg-[#1b2168] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
  }`;
}
