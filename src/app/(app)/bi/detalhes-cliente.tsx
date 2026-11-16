"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** Esc fecha a visão aberta da aba Geral (volta o palco aos Setores). */
export function EscVolta({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) router.push(href, { scroll: false });
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [href, router]);
  return null;
}

export interface PessoaTela {
  id: string;
  nome: string;
  cargo: string;
  turno: string;
  admissao: string; // dd/mm/aaaa
  custo: string | null; // só admin recebe o valor
}

export interface GrupoTela {
  setor: string;
  pessoas: PessoaTela[];
  custo: string | null;
}

/** Efetivo por setor com busca por nome ou cargo. */
export function EfetivoLista({ grupos }: { grupos: GrupoTela[] }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const filtrados = useMemo(() => {
    const b = busca.trim().toLocaleLowerCase("pt-BR");
    if (!b) return grupos;
    return grupos
      .map((g) => ({ ...g, pessoas: g.pessoas.filter((p) => `${p.nome} ${p.cargo}`.toLocaleLowerCase("pt-BR").includes(b)) }))
      .filter((g) => g.pessoas.length > 0);
  }, [busca, grupos]);
  const temCusto = grupos.some((g) => g.custo !== null);

  return (
    <div className="space-y-3">
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou cargo"
        className="w-full max-w-sm rounded-xl bg-white/10 px-3.5 py-2 text-sm text-white placeholder:text-white/40 ring-1 ring-white/15 outline-none focus:ring-amber-400"
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {filtrados.map((g) => {
          const expandido = busca.trim() !== "" || aberto === g.setor;
          return (
            <div key={g.setor} className="entrar rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => setAberto((a) => (a === g.setor ? null : g.setor))}
                className="flex w-full items-baseline justify-between gap-3 text-left"
                aria-expanded={expandido}
              >
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{g.setor}</span>
                <span className="text-sm tabular-nums text-white/70">
                  <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold text-white">{g.pessoas.length}</span> pessoas
                  {g.custo && <span className="ml-2 text-white/45">{g.custo}/mês</span>}
                  <span className="ml-2 text-white/35">{expandido ? "▴" : "▾"}</span>
                </span>
              </button>
              {expandido && (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-[0.65rem] uppercase tracking-[0.12em] text-white/35">
                      <th className="pb-1 font-semibold">Nome</th>
                      <th className="pb-1 font-semibold">Cargo</th>
                      <th className="hidden pb-1 font-semibold sm:table-cell">Turno</th>
                      <th className="hidden pb-1 font-semibold sm:table-cell">Admissão</th>
                      {temCusto && <th className="pb-1 text-right font-semibold">Custo</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {g.pessoas.map((p) => (
                      <tr key={p.id} className="border-t border-white/[0.06] text-white/75">
                        <td className="py-1.5 pr-2">{p.nome}</td>
                        <td className="py-1.5 pr-2 text-white/55">{p.cargo}</td>
                        <td className="hidden py-1.5 pr-2 text-white/55 sm:table-cell">{p.turno}</td>
                        <td className="hidden py-1.5 pr-2 tabular-nums text-white/55 sm:table-cell">{p.admissao}</td>
                        {temCusto && <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">{p.custo}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
        {filtrados.length === 0 && <p className="text-sm text-white/40">Ninguém encontrado.</p>}
      </div>
    </div>
  );
}
