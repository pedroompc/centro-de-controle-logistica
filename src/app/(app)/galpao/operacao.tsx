import { getOperacaoWms } from "@/data/wms-operacao";
import { resumirTurnos, horaDePico, medianaEquipe, FAIXAS_TURNO } from "@/domain/wms-operacao";
import { porUnidade } from "@/domain/wms";
import { formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { Card, SectionTitle } from "@/components/ui";
import { CORES } from "../tendencias/widgets";

const MIN_DIAS = 3; // abaixo disso o ritmo do operador não é comparável
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const COR = CORES.venda; // série única, navy validado (ver widgets.tsx)

const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const dec = (v: number, c = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const hh = (h: number) => `${String(h).padStart(2, "0")}h`;

/** Aba "Operação": turnos, horário de pico e produtividade por operador num mês. */
export async function Operacao({ mes }: { mes: string }) {
  const op = await getOperacaoWms(mes);

  if (op.indisponivel.length === 3) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">
          Sem conexão com o WMS. O banco só responde de dentro da rede da empresa.
        </p>
      </Card>
    );
  }

  const dias = op.diasComMovimento;
  const turnos = resumirTurnos(op.porHora, dias);
  const pico = horaDePico(op.porHora);
  const turnoLider = [...turnos].sort((a, b) => b.porHora - a.porHora)[0];
  const mediaHora = op.porHora.map((v) => porUnidade(v, dias));
  const mediana = medianaEquipe(op.ranking, MIN_DIAS);

  return (
    <div>
      {op.indisponivel.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">
            Parte dos dados não carregou ({op.indisponivel.join(", ")}).
          </p>
        </Card>
      )}

      <p className="mb-6 text-sm text-slate-500">
        {formatMesAno(mes)} · {int(op.total)} movimentos efetivados em {dias} dias
        {op.semHora > 0 && ` · ${int(op.semHora)} sem hora registrada ficam fora dos gráficos por hora`}
      </p>

      <SectionTitle>Turnos — média por hora de relógio, por dia</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {turnos.map((t) => {
          const lider = t === turnoLider && t.movimentos > 0;
          return (
            <Card key={t.faixa.id} className={`p-5 ${lider ? "ring-2 ring-[#3d47a8]/40" : ""}`}>
              <p className="text-sm font-medium text-slate-500">{t.faixa.rotulo}</p>
              <p className="mt-2 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">
                {t.movimentos ? dec(t.porHora) : "—"}
                <span className="ml-1 text-sm font-semibold text-slate-400">mov/h</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                {int(t.movimentos)} movimentos · {formatPercent(t.participacao)} do mês
                {lider && <span className="ml-1 font-semibold text-[#3d47a8]">· turno mais intenso</span>}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="mt-8">
        <SectionTitle>Movimentos por hora do dia — média por dia</SectionTitle>
      </div>
      <Card className="p-5">
        {pico === null ? (
          <p className="text-sm text-slate-500">Sem movimentos com hora registrada no mês.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Pico às <b className="text-[#141a4d]">{hh(pico)}</b>: {dec(mediaHora[pico])} movimentos por dia
              ({dec(porUnidade(op.porHoraVert[pico], dias))} verticais).
            </p>
            <GraficoHoras valores={mediaHora} verticais={op.porHoraVert.map((v) => porUnidade(v, dias))} pico={pico} />
          </>
        )}
      </Card>

      <div className="mt-8">
        <SectionTitle>Dia da semana × hora — onde o pico se repete</SectionTitle>
      </div>
      <Card className="overflow-x-auto p-5">
        <MapaSemanaHora grade={op.grade} diasPorSemana={op.diasPorSemana} />
      </Card>

      <div className="mt-8">
        <SectionTitle>Produtividade por operador</SectionTitle>
      </div>
      <Card className="overflow-x-auto">
        <TabelaOperadores ranking={op.ranking} mediana={mediana} />
      </Card>

      <Card className="mt-6 p-5">
        <SectionTitle>Como ler</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li><b>Turnos</b>: Manhã 07h–17h, Tarde 13h–22h, Noite 22h–07h. Das 13h às 17h os dois turnos estão juntos no galpão, e pelo horário não dá para saber quem fez o movimento — por isso essa janela aparece separada.</li>
          <li><b>mov/h</b> divide pelo tamanho da faixa e pelos dias do mês, então faixas de durações diferentes são comparáveis.</li>
          <li><b>Hora</b> = momento em que o movimento foi efetivado no WMS. Movimentos sem hora registrada ficam fora dos gráficos por hora (a contagem aparece no topo).</li>
          <li><b>Operador</b> = usuário que efetivou o movimento. Ranking por <b>movimentos por dia trabalhado</b>, não pelo total — quem trabalhou menos dias não é penalizado. Com menos de {MIN_DIAS} dias no mês, o operador fica no fim e em cinza.</li>
          <li>Login compartilhado ou usuário de sistema (integração, recepção automática) aparecem como um operador só — trate essas linhas à parte.</li>
        </ul>
      </Card>
    </div>
  );
}

/** Barras por hora (série única). Faixas de turno no rodapé; pico em destaque. */
function GraficoHoras({ valores, verticais, pico }: { valores: number[]; verticais: number[]; pico: number }) {
  const W = 720, H = 200, topo = 16, base = 160, esq = 4;
  const larg = (W - esq) / 24;
  const max = Math.max(...valores) || 1;
  const y = (v: number) => base - (v / max) * (base - topo);
  const faixasX = FAIXAS_TURNO.flatMap((f) => {
    // a Noite atravessa a meia-noite: desenha em dois pedaços contíguos
    const grupos: number[][] = [];
    for (const h of [...f.horas].sort((a, b) => a - b)) {
      const g = grupos[grupos.length - 1];
      if (g && h === g[g.length - 1] + 1) g.push(h); else grupos.push([h]);
    }
    return grupos.map((g) => ({ f, de: g[0], ate: g[g.length - 1] + 1 }));
  });
  const tons = { manha: "#eef0fb", sobreposicao: "#dfe3f7", tarde: "#eef0fb", noite: "#f1f5f9" } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img"
      aria-label={`Movimentos por hora do dia; pico às ${hh(pico)}`}>
      {/* linha de base e grade recessiva */}
      {[0.5, 1].map((k) => (
        <line key={k} x1={esq} x2={W} y1={y(max * k)} y2={y(max * k)} stroke="#e2e8f0" strokeDasharray="3 3" />
      ))}
      <line x1={esq} x2={W} y1={base} y2={base} stroke="#cbd5e1" />
      {valores.map((v, h) => {
        const x = esq + h * larg + 3;
        const w = larg - 6;
        const topoBarra = y(v);
        const r = Math.min(4, (base - topoBarra) / 2, w / 2); // barra baixa: raio não passa da altura
        return (
          <g key={h}>
            <title>{`${hh(h)}–${hh(h + 1)}: ${dec(v)} mov/dia (${dec(verticais[h])} verticais)`}</title>
            {/* alvo de hover maior que a barra */}
            <rect x={esq + h * larg} y={topo} width={larg} height={base - topo} fill="transparent" />
            {v > 0 && (
              <path
                d={`M${x},${base} V${topoBarra + r} Q${x},${topoBarra} ${x + r},${topoBarra} H${x + w - r} Q${x + w},${topoBarra} ${x + w},${topoBarra + r} V${base} Z`}
                fill={COR} fillOpacity={h === pico ? 1 : 0.45}
              />
            )}
            {h === pico && (
              <text x={x + w / 2} y={topoBarra - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#141a4d">
                {dec(v, 0)}
              </text>
            )}
            {h % 2 === 0 && (
              <text x={esq + h * larg + larg / 2} y={base + 14} textAnchor="middle" fontSize="10" fill="#64748b">{hh(h)}</text>
            )}
          </g>
        );
      })}
      {faixasX.map(({ f, de, ate }) => (
        <g key={`${f.id}-${de}`}>
          <rect x={esq + de * larg + 1} y={base + 22} width={(ate - de) * larg - 2} height={16} rx="4" fill={tons[f.id]} />
          {ate - de >= 3 && (
            <text x={esq + ((de + ate) / 2) * larg} y={base + 33} textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569">
              {f.id === "sobreposicao" ? "Manhã+Tarde" : f.rotulo.split(" ")[0]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Mapa de calor (sequencial, um tom): média de movimentos por dia em cada dia da semana × hora. */
function MapaSemanaHora({ grade, diasPorSemana }: { grade: number[][]; diasPorSemana: number[] }) {
  const medias = grade.map((linha, d) => linha.map((v) => porUnidade(v, diasPorSemana[d])));
  const max = Math.max(0, ...medias.flat()) || 1;
  return (
    <div className="min-w-[640px]">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: "40px repeat(24, minmax(0, 1fr))" }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[10px] text-slate-400">{h % 3 === 0 ? hh(h) : ""}</span>
        ))}
        {medias.map((linha, d) => (
          <FragmentoLinha key={d} rotulo={DIAS_SEMANA[d]} linha={linha} max={max} dias={diasPorSemana[d]} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
        <span>menos</span>
        <span className="h-2.5 w-32 rounded" style={{ background: `linear-gradient(to right, ${COR}10, ${COR})` }} />
        <span>mais movimentos (média por dia)</span>
      </div>
    </div>
  );
}

function FragmentoLinha({ rotulo, linha, max, dias }: { rotulo: string; linha: number[]; max: number; dias: number }) {
  return (
    <>
      <span className="self-center text-xs font-medium text-slate-500">{rotulo}</span>
      {linha.map((v, h) => (
        <span
          key={h}
          title={`${rotulo} ${hh(h)}: ${dec(v)} mov/dia (${dias} ${dias === 1 ? "dia" : "dias"})`}
          className="h-6 rounded-[3px]"
          style={{ backgroundColor: v > 0 ? COR : "#f1f5f9", opacity: v > 0 ? 0.12 + 0.88 * (v / max) : 1 }}
        />
      ))}
    </>
  );
}

function TabelaOperadores({ ranking, mediana }: { ranking: Awaited<ReturnType<typeof getOperacaoWms>>["ranking"]; mediana: number }) {
  if (!ranking.length) {
    return <p className="p-5 text-sm text-slate-500">Nenhum movimento efetivado no mês.</p>;
  }
  const max = Math.max(...ranking.map((l) => l.porDia), mediana) || 1;
  return (
    <table className="w-full min-w-[820px] text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
          <th className="px-4 py-3 font-semibold">#</th>
          <th className="px-3 py-3 font-semibold">Operador</th>
          <th className="px-3 py-3 font-semibold">Movimentos por dia trabalhado</th>
          <th className="px-3 py-3 text-right font-semibold">vs mês ant.</th>
          <th className="px-3 py-3 text-right font-semibold">Dias</th>
          <th className="px-3 py-3 text-right font-semibold">Total</th>
          <th className="px-3 py-3 text-right font-semibold">% vertical</th>
          <th className="px-3 py-3 text-right font-semibold">% do mês</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-[#141a4d]">
        {ranking.map((l, i) => {
          const pouco = l.dias < MIN_DIAS;
          const caiu = l.variacao !== null && l.variacao < 0;
          return (
            <tr key={l.usuario} className={`border-b border-slate-50 last:border-0 ${pouco ? "text-slate-400" : ""}`}>
              <td className="px-4 py-2.5 text-slate-400">{pouco ? "–" : i + 1}</td>
              <td className="max-w-[220px] truncate px-3 py-2.5 font-medium" title={`Usuário ${l.usuario}`}>{l.nome}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative h-4 w-44 shrink-0 rounded bg-slate-100">
                    <div className="h-full rounded" style={{ width: `${(l.porDia / max) * 100}%`, backgroundColor: COR, opacity: pouco ? 0.3 : 0.85 }} />
                    {mediana > 0 && (
                      <div className="absolute -top-0.5 h-5 w-0.5 bg-slate-500" style={{ left: `${(mediana / max) * 100}%` }}
                        title={`Mediana da equipe: ${dec(mediana)}/dia`} />
                    )}
                  </div>
                  <span className="font-semibold">{dec(l.porDia)}</span>
                </div>
              </td>
              <td className={`px-3 py-2.5 text-right text-xs font-semibold ${caiu && !pouco ? "text-rose-600" : "text-slate-500"}`}>
                {l.variacao === null ? "novo" : `${l.variacao >= 0 ? "↑ +" : "↓ −"}${formatPercent(Math.abs(l.variacao))}`}
              </td>
              <td className="px-3 py-2.5 text-right">{l.dias}</td>
              <td className="px-3 py-2.5 text-right">{int(l.movimentos)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(porUnidade(l.verticais, l.movimentos), 0)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(l.participacao)}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={8} className="px-4 py-3 text-xs text-slate-500">
            <span className="mr-1 inline-block h-3 w-0.5 translate-y-0.5 bg-slate-500" /> linha = mediana da equipe ({dec(mediana)} mov/dia)
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
