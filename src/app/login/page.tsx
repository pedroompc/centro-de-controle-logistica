"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sora } from "next/font/google";
import { createClient } from "@/lib/supabase/client";

const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-sora" });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className={`${sora.variable} flex min-h-screen flex-col md:flex-row`}>
      <style>{`
        @keyframes sol-glow { 0%,100% { opacity:.55; transform:scale(1) } 50% { opacity:.85; transform:scale(1.06) } }
        @keyframes surge { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        .sol-glow { animation: sol-glow 9s ease-in-out infinite }
        .surge { animation: surge .7s cubic-bezier(.2,.7,.2,1) both }
        .surge-2 { animation-delay:.08s } .surge-3 { animation-delay:.16s } .surge-4 { animation-delay:.24s }
        @media (prefers-reduced-motion: reduce) { .sol-glow, .surge { animation: none } }
      `}</style>

      {/* Marca — painel escuro */}
      <section
        className="relative flex flex-col justify-between overflow-hidden px-8 py-10 md:w-[56%] md:px-16 md:py-16"
        style={{ background: "linear-gradient(160deg,#071650 0%,#0c1a5e 60%,#142372 100%)" }}
      >
        {/* brilho do sol */}
        <div
          aria-hidden
          className="sol-glow pointer-events-none absolute -right-24 -top-24 h-[34rem] w-[34rem] rounded-full blur-[90px] md:-right-40"
          style={{ background: "radial-gradient(circle, rgba(246,176,20,.55) 0%, rgba(246,176,20,0) 65%)" }}
        />

        {/* topo: logo */}
        <div className="surge relative z-10 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sol-dia.gif"
            alt="Sol DIA"
            className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-black/30 ring-1 ring-white/10"
          />
          <div className="leading-none">
            <div className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight text-white">DIA</div>
            <div className="mt-1 text-[10px] font-medium tracking-[0.38em] text-white/60">DISTRIBUIÇÃO</div>
          </div>
        </div>

        {/* meio: título */}
        <div className="relative z-10 max-w-lg py-10">
          <p className="surge surge-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300/90">
            Centro de Controle
          </p>
          <h1 className="surge surge-3 mt-3 font-[family-name:var(--font-sora)] text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
            A logística da<br />DIA, sob controle.
          </h1>
          <p className="surge surge-4 mt-5 max-w-md text-base leading-relaxed text-white/70">
            Efetivo, custos e resultados da operação reunidos num só painel — do galpão à entrega.
          </p>
        </div>

        {/* rodapé */}
        <div className="relative z-10 text-xs text-white/45">
          © 2026 Dia Distribuição · Centro de Controle Logística
        </div>
      </section>

      {/* Formulário — painel claro */}
      <section className="flex flex-1 items-center justify-center bg-white px-6 py-14">
        <div className="w-full max-w-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Acesso restrito
          </span>

          <h2 className="mt-6 font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-[#171c52]">
            Bem-vindo de volta
          </h2>
          <p className="mt-2 text-sm text-slate-500">Entre com suas credenciais para acessar o painel.</p>

          <form onSubmit={entrar} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@diadistribuicao.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/60"
              />
            </div>

            <div>
              <label htmlFor="senha" className="mb-1.5 block text-sm font-medium text-slate-700">Senha</label>
              <div className="relative">
                <input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-12 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/60"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600"
                >
                  {mostrarSenha ? "ocultar" : "mostrar"}
                </button>
              </div>
            </div>

            {erro && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">{erro}</p>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#181d55] py-3 font-semibold text-white shadow-lg shadow-[#181d55]/20 transition hover:bg-[#10143f] disabled:opacity-60"
            >
              {carregando ? "Entrando..." : "Entrar no painel"}
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </form>

          <p className="mt-10 text-xs text-slate-400">© 2026 Dia Distribuição</p>
        </div>
      </section>
    </main>
  );
}
