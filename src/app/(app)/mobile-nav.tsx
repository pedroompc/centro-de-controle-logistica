"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { items, comMes, isActive } from "./sidebar-nav";

/**
 * Navegação mobile no estilo aplicativo: barra inferior fixa com as 4 seções
 * primárias + botão "Mais", que abre uma folha (bottom sheet) com as seções
 * secundárias e a conta/sair. Só aparece no celular (`md:hidden`); no desktop a
 * `<SidebarNav>` lateral continua mandando.
 */
export function MobileNav({ userEmail, admin }: { userEmail?: string | null; admin: boolean }) {
  const pathname = usePathname();
  const mes = useSearchParams().get("mes");
  const [maisAberto, setMaisAberto] = useState(false);

  // Ordem escolhida para a barra inferior (independente da ordem da lateral).
  const ORDEM_BARRA = ["/", "/pedidos-a-faturar", "/devolucoes", "/receitas"];
  const primarios = items
    .filter((i) => i.primary)
    .sort((a, b) => ORDEM_BARRA.indexOf(a.href) - ORDEM_BARRA.indexOf(b.href));
  const secundarios = items.filter((i) => !i.primary);
  const maisAtivo = secundarios.some((i) => isActive(pathname, i.href));

  // Trava a rolagem do fundo enquanto a folha está aberta.
  useEffect(() => {
    if (!maisAberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [maisAberto]);

  return (
    <>
      {/* Folha "Mais" */}
      {maisAberto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mais seções">
          <button
            aria-label="Fechar"
            onClick={() => setMaisAberto(false)}
            className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="animate-sheet-up pb-safe absolute inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-2xl">
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="px-4 pt-4">
              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Mais seções</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {secundarios.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <Link
                      key={it.href}
                      href={comMes(it.href, mes)}
                      onClick={() => setMaisAberto(false)}
                      className={`flex min-h-[3.25rem] items-center gap-3 rounded-2xl border px-4 text-sm font-medium transition ${
                        active
                          ? "border-transparent bg-[#141a4d] text-white"
                          : "border-slate-200 bg-white text-slate-700 active:bg-slate-50"
                      }`}
                    >
                      <span className={active ? "text-amber-300" : "text-[#1b2168]"}>{it.icon}</span>
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Conta + sair */}
            <div className="mt-4 border-t border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      admin ? "bg-amber-400/90 text-[#141a4d]" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {admin ? "Admin" : "Somente leitura"}
                  </span>
                  <p className="mt-1 truncate text-xs text-slate-500" title={userEmail ?? undefined}>
                    {userEmail}
                  </p>
                </div>
                <form action="/auth/signout" method="post">
                  <button className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 active:bg-slate-50">
                    Sair
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior fixa */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {primarios.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={comMes(it.href, mes)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2.5 text-[10px] font-medium transition ${
                  active ? "text-[#1b2168]" : "text-slate-400 active:text-slate-600"
                }`}
              >
                {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-amber-400" />}
                {it.icon}
                <span className="leading-none">{it.short ?? it.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-expanded={maisAberto}
            className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2.5 text-[10px] font-medium transition ${
              maisAtivo ? "text-[#1b2168]" : "text-slate-400 active:text-slate-600"
            }`}
          >
            {maisAtivo && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-amber-400" />}
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            <span className="leading-none">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
