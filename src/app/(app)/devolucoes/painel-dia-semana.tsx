"use client";

import { useState } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import type { BaseDevolucao, DevolucaoDiaSemana } from "@/domain/devolucoes-dia-semana";
import { IconeEtiqueta } from "./icons";

type Medida = "valor" | "peso";
type Modo = "num" | "pct";

function Segmento<T extends string>({
  opcoes, valor, onChange, rotulo,
}: {
  opcoes: { id: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={valor === o.id}
          className={`rounded-md px-3 py-1.5 transition ${valor === o.id ? "bg-[#181d55] text-white" : "text-slate-500 hover:text-slate-700"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Devolução por dia da semana (seg → dom), em R$ ou kg, número absoluto ou participação. */
export default function PainelDiaSemana({ dias, base }: { dias: DevolucaoDiaSemana[]; base: BaseDevolucao }) {
  const [medida, setMedida] = useState<Medida>("valor");
  const [modo, setModo] = useState<Modo>("num");

  const bruto = (d: DevolucaoDiaSemana) => (medida === "valor" ? d.valor : d.peso);
  const pct = (d: DevolucaoDiaSemana) => (medida === "valor" ? d.pctValor : d.pctPeso);
  const rotulo = (d: DevolucaoDiaSemana) =>
    modo === "pct" ? formatPercent(pct(d)) : medida === "valor" ? formatBRL(bruto(d)) : formatKg(bruto(d));
  const max = Math.max(1, ...dias.map(bruto));
  const vazio = dias.every((d) => bruto(d) === 0);

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeEtiqueta />}
        tone="gold"
        title="Por dia da semana"
        context={base === "faturamento" ? "dia em que a nota saiu" : "dia em que a devolução entrou"}
        right={
          <div className="flex flex-wrap gap-2">
            <Segmento rotulo="Medida" valor={medida} onChange={setMedida} opcoes={[{ id: "valor", label: "Valor R$" }, { id: "peso", label: "Peso kg" }]} />
            <Segmento rotulo="Formato" valor={modo} onChange={setModo} opcoes={[{ id: "num", label: "Numérico" }, { id: "pct", label: "%" }]} />
          </div>
        }
      />
      {vazio ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Sem devoluções no período.</p>
      ) : (
        <div className="grid grid-cols-7 items-end gap-2 px-4 pb-4 pt-6 sm:gap-4 sm:px-6">
          {dias.map((d) => {
            const altura = bruto(d) > 0 ? Math.max(3, Math.round((bruto(d) / max) * 100)) : 0;
            return (
              <div
                key={d.dia}
                className="flex min-w-0 flex-col items-center gap-1.5"
                title={`${d.rotulo}: ${formatBRL(d.valor)} · ${formatKg(d.peso)} · ${d.notas} notas`}
              >
                <span className="w-full truncate text-center text-[10px] font-semibold tabular-nums text-[#141a4d] sm:text-xs">
                  {rotulo(d)}
                </span>
                <div className="flex h-40 w-full items-end justify-center rounded-md bg-slate-50">
                  <div className="w-full max-w-12 rounded-t-md bg-[#1b2168] transition-all" style={{ height: `${altura}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-500">{d.rotulo}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
