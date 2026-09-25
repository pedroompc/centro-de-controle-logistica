import type { PontoDescarregoMensal } from "@/domain/descarregamento-tendencia";
import { mixFracao } from "@/domain/descarregamento-tendencia";
import { TIPOS_CARRO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { DescarregamentoTipo } from "@/domain/types";

/**
 * Cores por tipo de descarrego. Categóricas e distinguíveis, respeitando a
 * identidade do site: verde nunca (é reservado a receita) e rose fica de fora
 * (é a cor de "variação ruim" nos KPIs). Navy → índigo → âmbar → violeta.
 */
const TIPO_COR: Record<DescarregamentoTipo, string> = {
  batido: "#3d47a8",
  paletizado: "#5b6fd6",
  pal_rem: "#c2820a",
  volume: "#8b5cf6",
};

const inteiro = new Intl.NumberFormat("pt-BR");
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

/**
 * Composição do descarrego por tipo, mês a mês. Cada barra é normalizada a 100%
 * do mês (carros com tipo conhecido), então a leitura é "qual tipo predomino e
 * como o mix muda no tempo" — não o volume absoluto (esse está nos KPIs e no
 * gráfico de evolução). Total de carros detalhados à direita como contexto.
 */
export function MixTipoChart({ pontos, rotulo }: { pontos: PontoDescarregoMensal[]; rotulo: (mes: string) => string }) {
  const comMix = pontos.filter((p) => p.carrosDetalhados > 0);

  if (comMix.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Sem quebra por tipo no período — os lançamentos ainda não detalham batido/paletizado/pal-rem/volume.
      </p>
    );
  }

  return (
    <div>
      {/* Legenda */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {TIPOS_CARRO.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: TIPO_COR[t] }} />
            {ROTULO_TIPO[t]}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {comMix.map((p) => {
          const mix = mixFracao(p);
          return (
            <div key={p.mes} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs font-medium text-slate-500">{rotulo(p.mes)}</span>
              <div className="flex h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                {TIPOS_CARRO.map((t) =>
                  mix[t] > 0 ? (
                    <div
                      key={t}
                      className="h-full"
                      style={{ width: `${mix[t] * 100}%`, backgroundColor: TIPO_COR[t] }}
                      title={`${rotulo(p.mes)} · ${ROTULO_TIPO[t]}: ${inteiro.format(p.porTipo[t])} carros (${pct(mix[t])})`}
                    />
                  ) : null,
                )}
              </div>
              <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-[#141a4d]">
                {inteiro.format(p.carrosDetalhados)} carros
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
