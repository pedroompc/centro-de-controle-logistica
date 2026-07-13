import { pontosLinha } from "@/domain/tendencias";
import { Card } from "@/components/ui";

export interface LineChartProps {
  titulo: string;
  valores: number[];
  rotulos: string[]; // mesmo tamanho de `valores` (ex.: "Mai/26")
  formato: (v: number) => string;
  cor?: string; // cor da linha; default azul-marinho DIA
}

const W = 320;
const H = 120;

export function LineChart({ titulo, valores, rotulos, formato, cor = "#1b2168" }: LineChartProps) {
  const temDados = valores.length > 0;
  const { pontos, marcadores } = pontosLinha(valores, W, H, 8);
  const ultimo = marcadores[marcadores.length - 1];

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-500">{titulo}</h3>
        {temDados && (
          <span className="text-lg font-semibold tabular-nums text-[#141a4d]">
            {formato(valores[valores.length - 1])}
          </span>
        )}
      </div>
      {temDados ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={titulo}>
          <polyline points={pontos} fill="none" stroke={cor} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
          {ultimo && <circle cx={ultimo.x} cy={ultimo.y} r="3.5" fill={cor} />}
        </svg>
      ) : (
        <p className="py-6 text-center text-sm text-slate-400">Sem dados no período.</p>
      )}
      {temDados && (
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{rotulos[0]}</span>
          <span>{rotulos[rotulos.length - 1]}</span>
        </div>
      )}
    </Card>
  );
}
