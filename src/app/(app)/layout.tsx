import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "./sidebar-nav";

function Marca({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sol-dia.gif"
        alt="DIA"
        className={`${compact ? "h-9 w-9" : "h-10 w-10"} rounded-xl object-cover ring-1 ring-white/10`}
      />
      <div className="leading-tight">
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

  const navy = { background: "linear-gradient(180deg,#0a1650 0%,#0b1a58 100%)" };

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between px-4 py-6 md:flex" style={navy}>
        <div>
          <div className="px-2">
            <Marca />
          </div>
          <div className="mt-8">
            <SidebarNav />
          </div>
        </div>
        <div className="border-t border-white/10 pt-4">
          <p className="truncate px-3 text-xs text-white/50" title={user.email ?? undefined}>
            {user.email}
          </p>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5" />
                <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h6A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 9 18.5V17" />
              </svg>
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Topbar — mobile */}
      <header className="sticky top-0 z-30 flex flex-col gap-3 px-4 py-3 md:hidden" style={navy}>
        <div className="flex items-center justify-between">
          <Marca compact />
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white">
              Sair
            </button>
          </form>
        </div>
        <SidebarNav variant="top" />
      </header>

      {/* Conteúdo */}
      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl px-5 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
