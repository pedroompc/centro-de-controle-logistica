import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex gap-4 text-sm font-medium text-slate-700">
          <Link href="/">Dashboard</Link>
          <Link href="/setores">Setores</Link>
          <Link href="/funcionarios">Funcionários</Link>
          <Link href="/custos">Custos</Link>
        </nav>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-slate-500 hover:text-slate-800">Sair</button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
