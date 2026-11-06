"use client";

import { useState } from "react";
import { type Periodo, mesAnterior, mesProximo, primeiroDiaDoMes } from "@/domain/periodo";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Dias da grade (domingo a sábado) cobrindo o mês; `null` = célula vazia. */
function gradeDoMes(mes: string): (string | null)[] {
  const [a, m] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const cel: (string | null)[] = Array(inicio).fill(null);
  for (let d = 1; d <= dias; d++) cel.push(`${mes.slice(0, 8)}${String(d).padStart(2, "0")}`);
  while (cel.length % 7) cel.push(null);
  return cel;
}

/**
 * Calendário de dois cliques: o 1º marca o início, o 2º o fim e aplica. Dias
 * fora de [piso, hoje] ficam inertes. Mês/ano em listas para saltar longe
 * (ex.: 2025) sem dezenas de cliques.
 */
export function CalendarioPeriodo({
  periodo,
  piso,
  hoje,
  onEscolher,
}: {
  /** null = nada marcado (abre no mês de hoje). */
  periodo: Periodo | null;
  piso: string;
  hoje: string;
  onEscolher: (p: Periodo) => void;
}) {
  const [vista, setVista] = useState(primeiroDiaDoMes(!periodo || periodo.ate > hoje ? hoje : periodo.ate));
  const [inicio, setInicio] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const pisoMes = primeiroDiaDoMes(piso);
  const hojeMes = primeiroDiaDoMes(hoje);
  const anoPiso = Number(piso.slice(0, 4));
  const anoHoje = Number(hoje.slice(0, 4));
  const [anoV, mesV] = vista.split("-").map(Number);

  // Faixa destacada: seleção em andamento (início → dia sob o mouse) ou o período ativo.
  const faixa: Periodo | null = inicio
    ? { de: sobre && sobre < inicio ? sobre : inicio, ate: sobre && sobre > inicio ? sobre : inicio }
    : periodo;

  function clicar(dia: string) {
    if (!inicio) {
      setInicio(dia);
      return;
    }
    const p = dia < inicio ? { de: dia, ate: inicio } : { de: inicio, ate: dia };
    setInicio(null);
    onEscolher(p);
  }

  const irPara = (mes: string) => setVista(mes < pisoMes ? pisoMes : mes > hojeMes ? hojeMes : mes);
  const sel = "rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm text-slate-700 outline-none focus:border-amber-400";
  const anos: number[] = [];
  for (let y = anoHoje; y >= anoPiso; y--) anos.push(y);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => irPara(mesAnterior(vista))}
          disabled={vista <= pisoMes}
          aria-label="Mês anterior"
          className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100 disabled:text-slate-200"
        >
          ◀
        </button>
        <div className="flex gap-1">
          <select aria-label="Mês" value={mesV} onChange={(e) => irPara(`${anoV}-${String(e.target.value).padStart(2, "0")}-01`)} className={sel}>
            {MESES.map((nome, i) => (
              <option key={nome} value={i + 1}>{nome}</option>
            ))}
          </select>
          <select aria-label="Ano" value={anoV} onChange={(e) => irPara(`${e.target.value}-${String(mesV).padStart(2, "0")}-01`)} className={sel}>
            {anos.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => irPara(mesProximo(vista))}
          disabled={vista >= hojeMes}
          aria-label="Próximo mês"
          className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100 disabled:text-slate-200"
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {SEMANA.map((s, i) => (
          <span key={i} className="pb-1 font-semibold text-slate-400">{s}</span>
        ))}
        {gradeDoMes(vista).map((dia, i) => {
          if (!dia) return <span key={i} />;
          const fora = dia < piso || dia > hoje;
          const dentro = faixa && dia >= faixa.de && dia <= faixa.ate;
          const ponta = faixa && (dia === faixa.de || dia === faixa.ate);
          return (
            <button
              key={dia}
              type="button"
              disabled={fora}
              onClick={() => clicar(dia)}
              onMouseEnter={() => inicio && setSobre(dia)}
              className={`h-9 text-sm tabular-nums transition ${
                fora
                  ? "text-slate-200"
                  : ponta
                    ? "rounded-md bg-[#181d55] font-semibold text-white"
                    : dentro
                      ? "bg-amber-100 text-[#141a4d]"
                      : "rounded-md text-slate-600 hover:bg-slate-100"
              } ${dia === hoje && !ponta ? "font-bold text-amber-600" : ""}`}
            >
              {Number(dia.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="mt-3 h-4 text-xs text-slate-400">
        {inicio ? `Início ${inicio.slice(8)}/${inicio.slice(5, 7)} · escolha o fim (o mesmo dia = só ele)` : ""}
      </p>
    </div>
  );
}
