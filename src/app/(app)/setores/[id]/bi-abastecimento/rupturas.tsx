"use client";

import { formatPercent } from "@/domain/format";
import { type Periodo, rotuloPeriodo } from "@/domain/periodo";
import { Vazio, Bloco, Mini, Dica } from "../bi-ui";
import { resumoVolume } from "@/domain/abastecimento";
import type { DadosHarpiaAbastecimento } from "@/data/harpia-abastecimento";
import { n0 } from "./base";

export function VisaoRupturas({ h, periodo }: { h: DadosHarpiaAbastecimento; mes: string; periodo: Periodo }) {
  const totalAbast = resumoVolume(h.dias).abastecimentos;
  const preventivos = Math.max(0, totalAbast - h.abastecimentosReativos);
  const pctPreventivo = totalAbast > 0 ? preventivos / totalAbast : null;
  if (h.rupturas.length === 0) {
    return (
      <Vazio>
        <div>
          Nenhuma ruptura de picking em {rotuloPeriodo(periodo)}.
          {totalAbast > 0 && <p className="mt-2 text-sm text-white/40">{n0(totalAbast)} abastecimentos no período, 100% preventivos.</p>}
        </div>
      </Vazio>
    );
  }
  const caixas = h.rupturas.reduce((t, r) => t + r.caixas, 0);
  const unidades = h.rupturas.reduce((t, r) => t + r.unidades, 0);
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">
        <Mini rotulo="Rupturas" valor={n0(h.rupturas.length)} sub={rotuloPeriodo(periodo)} />
        <Mini rotulo="Caixas faltantes" valor={n0(caixas)} />
        <Mini rotulo="Unidades faltantes" valor={n0(unidades)} />
        <Mini rotulo="Abastecimento preventivo" valor={pctPreventivo !== null ? formatPercent(pctPreventivo, 1) : "—"} sub={`${n0(preventivos)} de ${n0(totalAbast)} abastecimentos`} />
        <Mini rotulo="Abastecimento reativo" valor={n0(h.abastecimentosReativos)} sub="feito por causa de uma ruptura" />
      </div>
      <Bloco titulo="Eventos de ruptura" direita={<Dica>estoque negativo no endereço de picking, já resolvido pelo abastecimento que o registrou</Dica>}>
        <div className="h-full overflow-auto pr-1">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
              <tr>
                <th className="py-2 font-semibold">Quando</th>
                <th className="py-2 font-semibold">Produto</th>
                <th className="py-2 text-right font-semibold">Caixas</th>
                <th className="py-2 text-right font-semibold">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {h.rupturas.map((r, i) => (
                <tr key={i} className="border-t border-white/[0.06]">
                  <td className="py-2 tabular-nums text-white/70">{r.data}</td>
                  <td className="py-2 text-white">
                    <span className="text-white/45">{r.produto}</span> {r.descricao ?? ""}
                  </td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n0(r.caixas)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n0(r.unidades)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </div>
  );
}
