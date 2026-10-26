"use client";

import { formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { porMilLinhas, resumoErros, type ResumoTurno } from "@/domain/separacao";
import { Bloco, CalendarioBI, Mini, ddmm } from "./bi-ui";
import { COR_TURNO, DUAS_COLUNAS, GRADE_CARDS, VISAO, n0, n1, ou } from "./bi-separacao-comum";
import type { ProducaoBI } from "./separacao-dados";

// --- QUALIDADE ----------------------------------------------------------------

export function VisaoQualidade({ p, mes, dia, onDia, linhas, turnos }: { p: ProducaoBI; mes: string; dia: string | null; onDia: (d: string | null) => void; linhas: number; turnos: ResumoTurno[] }) {
  const r = resumoErros(p.erros, dia);
  const s = r.separador;
  const taxa = porMilLinhas(s.itens, linhas);
  const atribuidos = p.erros.filter((e) => e.origem === "separador" && e.atribuido && (!dia || e.dia === dia)).reduce((t, e) => t + e.itens, 0);
  const porDia = new Map<string, number>();
  for (const e of p.erros) if (e.origem === "separador") porDia.set(e.dia, (porDia.get(e.dia) ?? 0) + e.itens);
  const maxP = Math.max(1, ...p.produtosComErro.map((x) => x.itens));
  const maxT = Math.max(1e-9, ...turnos.map((t) => t.errosPorMil ?? 0));
  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(26rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Do separador" valor={n0(s.itens)} sub={dia ? ddmm(dia) : formatMesAno(mes)} />
        <Mini rotulo="Por mil endereços" valor={ou(taxa, n1)} sub={`${n0(linhas)} endereços`} />
        <Mini rotulo="Ocorrências" valor={n0(s.ocorrencias)} />
        <Mini rotulo="Unid. divergentes" valor={n0(s.unidades)} />
        <Mini rotulo="Falta × sobra" valor={`${n0(s.falta)} × ${n0(s.sobra)}`} />
        <Mini rotulo="Do conferente" valor={n0(r.conferente.itens)} sub={r.sem_origem.itens ? `${n0(r.sem_origem.itens)} sem origem` : undefined} />
        <Mini rotulo="Atribuídos" valor={s.itens ? formatPercent(atribuidos / s.itens, 0) : "—"} />
      </div>
      <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}>
        <Bloco className="min-h-[22rem] xl:min-h-0" titulo="Itens com erro do separador por dia">
          <CalendarioBI mes={mes} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem erro" menorEhMelhor />
        </Bloco>
        <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-auto xl:pr-1 [&>*]:shrink-0">
          <Bloco titulo="Por turno · erros a cada 1.000 endereços">
            <ul className="space-y-2">
              {turnos.map((t) => (
                <li key={t.turno}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-white">{t.rotulo}</span>
                    <span className="tabular-nums text-white">
                      {ou(t.errosPorMil, n1)} <span className="text-white/40">· {n0(t.errosSeparador)} / {n0(t.linhas)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${((t.errosPorMil ?? 0) / maxT) * 100}%`, background: COR_TURNO[t.turno] }} />
                  </div>
                </li>
              ))}
            </ul>
          </Bloco>
          <Bloco titulo="Produtos com mais erro do separador">
            {p.produtosComErro.length === 0 ? (
              <p className="py-4 text-center text-sm text-white/40">Nenhum erro do separador no mês.</p>
            ) : (
              <ul className="space-y-2">
                {p.produtosComErro.map((x) => (
                  <li key={x.produto}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-white" title={x.descricao ?? undefined}>
                        <span className="text-white/45">{x.produto}</span> {x.descricao ?? ""}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-white">
                        {x.itens} <span className="font-normal text-white/45">itens · {x.ocorrencias} bloq. · {n0(x.unidades)} un</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${(x.itens / maxP) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      </div>
    </div>
  );
}
