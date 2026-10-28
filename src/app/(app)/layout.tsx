import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/data/auth";
import { SidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { BarraNavegacao } from "@/components/barra-navegacao";
import { BotaoRecolher } from "./botao-recolher";
import { COOKIE_SIDEBAR } from "./sidebar-cookie";

function Marca({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sol-dia.gif"
        alt="DIA"
        className={`${compact ? "h-9 w-9" : "h-10 w-10"} rounded-xl object-cover ring-1 ring-white/10`}
      />
      <div className={`leading-tight ${compact ? "" : "group-data-[recolhida=true]/app:hidden"}`}>
        <div className="font-[family-name:var(--font-sora)] text-sm font-extrabold tracking-tight text-white">
          Centro de Controle
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/50">DIA Distribuição</div>
      </div>
    </div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const perfil = await getPerfil();
  const admin = perfil?.role === "admin";

  // Barra lateral recolhida? (escolha guardada por computador)
  const recolhida = (await cookies()).get(COOKIE_SIDEBAR)?.value === "recolhida";

  const navy = { background: "linear-gradient(180deg,#0a1650 0%,#0b1a58 100%)" };

  return (
    <div data-recolhida={String(recolhida)} className="group/app min-h-screen bg-[#f6f7fb]">
      {/* useSearchParams exige Suspense. */}
      <Suspense fallback={null}>
        <BarraNavegacao />
      </Suspense>
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between overflow-hidden px-4 py-6 transition-[width,padding] duration-200 group-data-[recolhida=true]/app:w-[72px] group-data-[recolhida=true]/app:px-3 md:flex" style={navy}>
        <div>
          <div className="px-2 group-data-[recolhida=true]/app:flex group-data-[recolhida=true]/app:justify-center group-data-[recolhida=true]/app:px-0">
            <Marca />
          </div>
          <div className="mt-8">
            <SidebarNav admin={admin} />
          </div>
        </div>
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 px-3 group-data-[recolhida=true]/app:justify-center group-data-[recolhida=true]/app:px-0">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                admin ? "bg-amber-400/90 text-[#141a4d]" : "bg-white/10 text-white/70"
              }`}
            >
              <span className="group-data-[recolhida=true]/app:hidden">{admin ? "Admin" : "Somente leitura"}</span>
              <span className="hidden group-data-[recolhida=true]/app:inline" title={admin ? "Admin" : "Somente leitura"}>●</span>
            </span>
          </div>
          <p className="mt-1.5 truncate px-3 text-xs text-white/50 group-data-[recolhida=true]/app:hidden" title={user.email ?? undefined}>
            {user.email}
          </p>
          <div className="mt-2">
            <BotaoRecolher />
          </div>
          <form action="/auth/signout" method="post">
            <button title="Sair" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white group-data-[recolhida=true]/app:justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5" />
                <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h6A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 9 18.5V17" />
              </svg>
              <span className="group-data-[recolhida=true]/app:hidden">Sair</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Cabeçalho compacto — mobile */}
      <header className="pt-safe sticky top-0 z-30 md:hidden" style={navy}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <Marca compact />
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              admin ? "bg-amber-400/90 text-[#141a4d]" : "bg-white/10 text-white/70"
            }`}
          >
            {admin ? "Admin" : "Leitura"}
          </span>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="transition-[padding] duration-200 md:pl-64 md:group-data-[recolhida=true]/app:pl-[72px]">
        <main className="mx-auto max-w-6xl px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-10 md:py-8">
          {children}
        </main>
      </div>

      {/* Navegação inferior — mobile */}
      <MobileNav userEmail={user.email} admin={admin} />
    </div>
  );
}
