import Link from "next/link";
import type { ReactNode } from "react";
import { getBaseEficiencia, getEstoqueGalpao, type EstoqueGalpao } from "@/data/wms-eficiencia";
import { TETO_CARGA_MIN } from "@/data/wms";
import {
  montarPainel, resumirOcupacao, TIPO_PICKING, TIPO_PULMAO,
  type FiltroEficiencia, type Fatia, type IdFaixa, type Ocupacao,
} from "@/domain/wms-eficiencia";
import { FAIXAS_TURNO } from "@/domain/wms-operacao";
import { formatMesAno } from "@/domain/periodo";
import { formatPercent } from "@/domain/format";
import { Card, SectionTitle } from "@/components/ui";
import { CORES } from "../tendencias/widgets";

/*
 * Painel único do galpão: eficiência por turno com drill-down. Cada clique
 * (turno, dia, operador) vira um filtro na URL e todos os blocos recalculam.
 * Regras e fontes: docs/superpowers/specs/2026-09-23-wms-eficiencia-galpao-design.md
 */

const COR_VERT = CORES.venda; // navy
const COR_HORIZ = CORES.peso; // âmbar — par validado (ΔE CVD 31,6)

const int = (v: number) => (v ? Math.round(v).toLocaleString("pt-BR") : "—");
const dec = (v: number, c = 1) =>
  v ? v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }) : "—";
const kg = (v: number) => (v ? `${Math.round(v).toLocaleString("pt-BR")} kg` : "—");
const duracao = (min: number) => {
  if (min <= 0) return "—";
  const total = Math.round(min); // arredonda antes de quebrar: 179,6 min vira 3h 00min, não 2h 60min
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}min` : `${m} min`;
};
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const DSEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const diaSemana = (iso: string) => DSEM[new Date(`${iso}T12:00:00Z`).getUTCDay()];

export interface ParamsPainel {
  mes: string;
  turno?: IdFaixa;
  dia?: string;
  op?: number;
}

/** URL do painel com os filtros dados (undefined = remove o filtro). */
export function hrefPainel(p: ParamsPainel): string {
  const q = new URLSearchParams({ mes: p.mes });
  if (p.turno) q.set("turno", p.turno);
  if (p.dia) q.set("dia", p.dia);
  if (p.op !== undefined) q.set("op", String(p.op));
  return `/galpao?${q}`;
}

export async function PainelGalpao(p: ParamsPainel) {
  const [base, estoque] = await Promise.all([getBaseEficiencia(p.mes), getEstoqueGalpao()]);

  if (base.indisponivel.length === 2 && estoque.indisponivel.length === 3) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">
          Sem conexão com o WMS. O banco só responde de dentro da rede da empresa.
        </p>
      </Card>
    );
  }

  const filtro: FiltroEficiencia = { faixa: p.turno, dia: p.dia, usuario: p.op };
  const painel = montarPainel(p.mes, base.movs, base.cargas, filtro, TETO_CARGA_MIN);
  const g = painel.geral;
  const turnoSel = FAIXAS_TURNO.find((f) => f.id === p.turno);
  const opSel = painel.operadores.find((o) => o.usuario === p.op);
  const ir = (mudar: Partial<ParamsPainel>) => hrefPainel({ ...p, ...mudar });
  const filtrado = !!turnoSel || !!p.dia || p.op !== undefined;
  const falhas = [...base.indisponivel, ...estoque.indisponivel];

  return (
    <div>
      {falhas.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">Parte dos dados não carregou ({falhas.join(", ")}).</p>
        </Card>
      )}

      {/* Trilha do drill-down: cada filtro ativo vira um chip removível */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href={hrefPainel({ mes: p.mes })}
          className={`rounded-full px-3 py-1 font-semibold ${filtrado ? "text-[#3d47a8] hover:underline" : "bg-[#141a4d] text-white"}`}>
          Operação geral · {formatMesAno(p.mes)}
        </Link>
        {turnoSel && <Chip rotulo={`Turno: ${turnoSel.rotulo}`} href={ir({ turno: undefined })} />}
        {p.dia && <Chip rotulo={`Dia: ${diaSemana(p.dia)} ${diaCurto(p.dia)}`} href={ir({ dia: undefined })} />}
        {p.op !== undefined && <Chip rotulo={`Operador: ${opSel?.nome ?? p.op}`} href={ir({ op: undefined })} />}
        {!filtrado && (
          <span className="text-xs text-slate-400">Todos os turnos. Clique num turno, dia ou operador para aprofundar.</span>
        )}
      </div>

      <SectionTitle>{filtrado ? "Recorte selecionado" : "Operação do mês — todos os turnos"}</SectionTitle>
      <Kpis fatia={g} filtrado={filtrado} filtroOperador={p.op !== undefined} />

      <div className="mt-8">
        <SectionTitle>Estoque — foto de agora (não muda com mês nem filtros)</SectionTitle>
      </div>
      <PainelEstoque estoque={estoque} />

      <div className="mt-8">
        <SectionTitle>Por turno — clique para filtrar</SectionTitle>
      </div>
      <Card className="overflow-x-auto">
        <TabelaTurnos linhas={painel.porFaixa} selecionado={p.turno}
          href={(id) => ir({ turno: id === p.turno ? undefined : id })} />
      </Card>

      <div className="mt-8">
        <SectionTitle>Por dia{turnoSel ? ` — ${turnoSel.rotulo}` : ""} — clique para filtrar</SectionTitle>
      </div>
      <Card className="overflow-x-auto p-5">
        <GraficoDias dias={painel.porDia} selecionado={p.dia}
          href={(d) => ir({ dia: d === p.dia ? undefined : d })} />
      </Card>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div>
          <SectionTitle>Operadores — movimentos por turno trabalhado</SectionTitle>
          <Card className="overflow-x-auto">
            <TabelaOperadores linhas={painel.operadores} selecionado={p.op}
              href={(u) => ir({ op: u === p.op ? undefined : u })} />
          </Card>
        </div>
        <div>
          <SectionTitle>Cargas separadas — mais lentas primeiro</SectionTitle>
          <Card className="overflow-x-auto">
            <TabelaCargas cargas={painel.cargas} />
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-5">
        <SectionTitle>Como ler</SectionTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li><b>Turno</b> pelo horário: Manhã 07h–13h, Manhã+Tarde 13h–17h (os dois turnos no galpão; pelo horário não dá para separar), Tarde 17h–22h, Noite 22h–07h. A madrugada conta para a Noite do dia anterior.</li>
          <li>Sem filtro, os números são da <b>operação inteira</b> do mês. <b>Por dia</b> e <b>por turno</b> dividem pelo que teve atividade (turno = faixa × dia), para comparar meses e turnos de tamanhos diferentes.</li>
          <li><b>Estoque</b>: foto de agora do WMS (não há histórico). Utilizada = posições ocupadas ÷ posições não bloqueadas. Picking = endereços tipo &apos;{TIPO_PICKING}&apos;, pulmão = tipo &apos;{TIPO_PULMAO}&apos;.</li>
          <li><b>Vertical</b> = origem ou destino acima do nível 01 (empilhadeira). <b>Horizontal</b> = origem e destino no chão.</li>
          <li><b>Separação</b>: tempo do início da separação ao início da conferência, pela hora de início. Mediana é o número principal; média e P90 ao lado. Acima de {TETO_CARGA_MIN / 60} h é descartado como carga esquecida aberta.</li>
          <li>O filtro de operador não recorta a separação: a carga não registra quem separou.</li>
          {(painel.movSemHora > 0 || painel.cargasSemHora > 0) && (
            <li>Fora do painel por não terem hora (sem turno): {int(painel.movSemHora)} movimentos e {int(painel.cargasSemHora)} cargas.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function Chip({ rotulo, href }: { rotulo: string; href: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef0fb] py-1 pl-3 pr-1 font-medium text-[#1b2168]">
      <span className="text-slate-400">›</span> {rotulo}
      <Link href={href} aria-label={`Remover filtro ${rotulo}`}
        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-rose-600">×</Link>
    </span>
  );
}

const plural = (v: number, um: string, varios: string) => `${int(v)} ${v === 1 ? um : varios}`;

function Kpis({ fatia, filtrado, filtroOperador }: { fatia: Fatia; filtrado: boolean; filtroOperador: boolean }) {
  const m = fatia.movimento;
  const s = fatia.separacao;
  const onde = filtrado ? "no recorte" : "no mês";
  const ritmo = (porDia: number, porTurno: number) =>
    `${dec(porDia)} por dia · ${dec(porTurno)} por turno · ${plural(m.dias, "dia", "dias")}, ${plural(m.turnos, "turno", "turnos")} com atividade`;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Kpi cor={COR_VERT} titulo="Movimentações verticais" valor={int(m.verticais)} unidade={onde}
        rodape={ritmo(m.verticaisPorDia, m.verticaisPorTurno)} />
      <Kpi cor={COR_HORIZ} titulo="Movimentações horizontais" valor={int(m.horizontais)} unidade={onde}
        rodape={ritmo(m.horizontaisPorDia, m.horizontaisPorTurno)} />
      <Card className="p-5">
        <p className="text-sm font-medium text-slate-500">Separação de carga</p>
        <p className="mt-2 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">
          {duracao(s.tempo.medianaMin)}
          <span className="ml-1 text-sm font-semibold text-slate-400">mediana por carga</span>
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
          <div><dt className="text-slate-400">Média</dt><dd className="font-semibold tabular-nums text-[#141a4d]">{duracao(s.tempo.mediaMin)}</dd></div>
          <div><dt className="text-slate-400">SKU médio</dt><dd className="font-semibold tabular-nums text-[#141a4d]">{dec(s.mediaSkus)}</dd></div>
          <div><dt className="text-slate-400">Peso médio</dt><dd className="font-semibold tabular-nums text-[#141a4d]">{kg(s.mediaPesoKg)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          {plural(s.cargas, "carga", "cargas")} ({kg(s.pesoTotalKg)}) · {dec(s.cargasPorTurno)} por turno · P90 {duracao(s.tempo.p90Min)}
          {s.tempo.descartadas > 0 && ` · ${s.tempo.descartadas} sem tempo válido`}
          {filtroOperador && " · sem filtro de operador"}
        </p>
      </Card>
      <p className="text-xs text-slate-500 md:col-span-3">
        {plural(m.operadores, "pessoa efetivou", "pessoas efetivaram")} movimentos {onde}.
      </p>
    </div>
  );
}

function Kpi({ cor, titulo, valor, unidade, rodape }: { cor: string; titulo: string; valor: string; unidade: string; rodape: string }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: cor }} />
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      <p className="mt-2 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">
        {valor}<span className="ml-1 text-sm font-semibold text-slate-400">{unidade}</span>
      </p>
      <p className="mt-1.5 text-xs text-slate-500">{rodape}</p>
    </Card>
  );
}

// Ocupação: acima de 90% o armazém perde flexibilidade (sem posição livre para receber).
const ALERTA_OCUPACAO = 0.9;

function PainelEstoque({ estoque }: { estoque: EstoqueGalpao }) {
  const oc = resumirOcupacao(estoque.enderecos);
  const semEnderecos = estoque.enderecos.length === 0;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500">SKUs cadastrados</p>
          <p className="mt-2 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">
            {estoque.skusCadastrados === null ? "—" : int(estoque.skusCadastrados)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {estoque.skusComSaldo === null ? "saldo indisponível" : (
              <>
                {int(estoque.skusComSaldo)} com saldo
                {estoque.skusCadastrados ? ` (${formatPercent(estoque.skusComSaldo / estoque.skusCadastrados)})` : ""}
                {estoque.skusSemSaida90d !== null && ` · ${int(estoque.skusSemSaida90d)} sem saída há 90 dias`}
              </>
            )}
          </p>
        </Card>
        <Medidor titulo="% utilizada do estoque" oc={semEnderecos ? null : oc.estoque} ausente="endereços indisponíveis" />
        <Medidor titulo="% utilizada do picking" oc={oc.picking} ausente={`sem endereços do tipo '${TIPO_PICKING}'`} />
        <Medidor titulo="% utilizada do pulmão" oc={oc.pulmao} ausente={`sem endereços do tipo '${TIPO_PULMAO}'`} />
      </div>
      {oc.outros.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Outros tipos de endereço (entram no total do estoque):{" "}
          {oc.outros.map((o) => `${o.rotulo} ${formatPercent(o.taxa)} (${int(o.ocupados)}/${int(o.uteis)})`).join(" · ")}
        </p>
      )}
    </>
  );
}

function Medidor({ titulo, oc, ausente }: { titulo: string; oc: Ocupacao | null; ausente: string }) {
  const alto = !!oc && oc.taxa >= ALERTA_OCUPACAO;
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      <p className="mt-2 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">
        {oc && oc.uteis ? formatPercent(oc.taxa) : "—"}
        {alto && <span className="ml-2 align-middle text-xs font-semibold text-rose-600">▲ acima de {formatPercent(ALERTA_OCUPACAO, 0)}</span>}
      </p>
      <div className="mt-2 h-2 rounded bg-slate-100" role="img" aria-label={oc ? `${formatPercent(oc.taxa)} ocupado` : ausente}>
        {oc && <div className="h-full rounded" style={{ width: `${Math.min(1, oc.taxa) * 100}%`, backgroundColor: alto ? "#e11d48" : COR_VERT }} />}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {oc ? `${int(oc.ocupados)} de ${int(oc.uteis)} posições · ${int(oc.bloqueados)} bloqueadas` : ausente}
      </p>
    </Card>
  );
}

function Barra({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  return (
    <div className="h-2 w-24 shrink-0 rounded bg-slate-100">
      <div className="h-full rounded" style={{ width: `${max ? (valor / max) * 100 : 0}%`, backgroundColor: cor }} />
    </div>
  );
}

const th = "px-3 py-3 font-semibold";

/** Célula inteira clicável (a linha toda filtra). Sem href vira célula comum. */
function Cel({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  const cls = `block px-3 ${className}`;
  return (
    <td className="p-0">
      {href ? <Link href={href} className={cls}>{children}</Link> : <span className={cls}>{children}</span>}
    </td>
  );
}

function TabelaTurnos({ linhas, selecionado, href }: {
  linhas: { faixa: (typeof FAIXAS_TURNO)[number]; fatia: Fatia }[];
  selecionado?: IdFaixa;
  href: (id: IdFaixa) => string;
}) {
  const maxV = Math.max(0, ...linhas.map((l) => l.fatia.movimento.verticaisPorTurno));
  const maxH = Math.max(0, ...linhas.map((l) => l.fatia.movimento.horizontaisPorTurno));
  return (
    <table className="w-full min-w-[860px] text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
          <th className={`${th} pl-5`}>Turno</th>
          <th className={th}>Verticais / turno</th>
          <th className={th}>Horizontais / turno</th>
          <th className={`${th} text-right`}>Cargas / turno</th>
          <th className={`${th} text-right`}>Tempo mediano</th>
          <th className={`${th} text-right`}>P90</th>
          <th className={`${th} text-right`}>SKU médio</th>
          <th className={`${th} pr-5 text-right`}>Peso médio</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-[#141a4d]">
        {linhas.map(({ faixa, fatia }) => {
          const m = fatia.movimento;
          const s = fatia.separacao;
          const sel = faixa.id === selecionado;
          const apagado = selecionado && !sel;
          const h = href(faixa.id);
          return (
            <tr key={faixa.id}
              className={`border-b border-slate-50 transition last:border-0 hover:bg-slate-50 ${sel ? "bg-[#eef0fb]" : ""} ${apagado ? "text-slate-400" : ""}`}>
              <Cel href={h} className="py-3 pl-5 font-semibold">{faixa.rotulo}</Cel>
              <Cel href={h} className="py-3"><span className="flex items-center gap-2"><Barra valor={m.verticaisPorTurno} max={maxV} cor={COR_VERT} />{dec(m.verticaisPorTurno)}</span></Cel>
              <Cel href={h} className="py-3"><span className="flex items-center gap-2"><Barra valor={m.horizontaisPorTurno} max={maxH} cor={COR_HORIZ} />{dec(m.horizontaisPorTurno)}</span></Cel>
              <Cel href={h} className="py-3 text-right">{dec(s.cargasPorTurno)}</Cel>
              <Cel href={h} className="py-3 text-right font-semibold">{duracao(s.tempo.medianaMin)}</Cel>
              <Cel href={h} className="py-3 text-right text-slate-500">{duracao(s.tempo.p90Min)}</Cel>
              <Cel href={h} className="py-3 text-right">{dec(s.mediaSkus)}</Cel>
              <Cel href={h} className="py-3 pr-5 text-right">{kg(s.mediaPesoKg)}</Cel>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Colunas por dia: vertical e horizontal lado a lado (mesma escala, uma só). Cada dia é um link. */
function GraficoDias({ dias, selecionado, href }: {
  dias: { dia: string; fatia: Fatia }[];
  selecionado?: string;
  href: (dia: string) => string;
}) {
  if (!dias.length) return <p className="text-sm text-slate-500">Sem atividade no recorte.</p>;
  const max = Math.max(1, ...dias.flatMap((d) => [d.fatia.movimento.verticais, d.fatia.movimento.horizontais]));
  return (
    <div className="min-w-[640px]">
      <div className="mb-3 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_VERT }} />Verticais</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_HORIZ }} />Horizontais</span>
      </div>
      <div className="flex h-44 items-end gap-1 border-b border-slate-300">
        {dias.map(({ dia, fatia }) => {
          const m = fatia.movimento;
          const s = fatia.separacao;
          const sel = dia === selecionado;
          const op = selecionado && !sel ? 0.3 : 1;
          return (
            <Link key={dia} href={href(dia)}
              title={`${diaSemana(dia)} ${diaCurto(dia)} — ${int(m.verticais)} verticais · ${int(m.horizontais)} horizontais · ${int(s.cargas)} cargas (mediana ${duracao(s.tempo.medianaMin)})`}
              className={`flex h-full flex-1 items-end justify-center gap-[2px] rounded-t px-[1px] hover:bg-slate-50 ${sel ? "bg-[#eef0fb]" : ""}`}>
              <span className="w-1/2 max-w-3 rounded-t-[3px]" style={{ height: `${(m.verticais / max) * 100}%`, backgroundColor: COR_VERT, opacity: op }} />
              <span className="w-1/2 max-w-3 rounded-t-[3px]" style={{ height: `${(m.horizontais / max) * 100}%`, backgroundColor: COR_HORIZ, opacity: op }} />
            </Link>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {dias.map(({ dia }) => (
          <span key={dia} className={`flex-1 text-center text-[10px] ${dia === selecionado ? "font-bold text-[#141a4d]" : "text-slate-400"}`}>
            {dia.slice(8, 10)}
          </span>
        ))}
      </div>
    </div>
  );
}

function TabelaOperadores({ linhas, selecionado, href }: {
  linhas: { usuario: number | null; nome: string; verticais: number; horizontais: number; turnos: number; porTurno: number }[];
  selecionado?: number;
  href: (u: number) => string;
}) {
  if (!linhas.length) return <p className="p-5 text-sm text-slate-500">Nenhum movimento no recorte.</p>;
  return (
    <table className="w-full min-w-[520px] text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
          <th className={`${th} pl-5`}>Operador</th>
          <th className={`${th} text-right`}>Vert.</th>
          <th className={`${th} text-right`}>Horiz.</th>
          <th className={`${th} text-right`}>Turnos</th>
          <th className={`${th} pr-5 text-right`}>Mov / turno</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-[#141a4d]">
        {linhas.map((o) => {
          const sel = o.usuario === selecionado;
          const h = o.usuario === null ? null : href(o.usuario);
          return (
            <tr key={String(o.usuario)} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 ${sel ? "bg-[#eef0fb]" : ""}`}>
              <Cel href={h} className="max-w-[200px] truncate py-2.5 pl-5 font-medium">{o.nome}</Cel>
              <Cel href={h} className="py-2.5 text-right">{int(o.verticais)}</Cel>
              <Cel href={h} className="py-2.5 text-right">{int(o.horizontais)}</Cel>
              <Cel href={h} className="py-2.5 text-right">{o.turnos}</Cel>
              <Cel href={h} className="py-2.5 pr-5 text-right font-semibold">{dec(o.porTurno)}</Cel>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const MAX_CARGAS = 20;

function TabelaCargas({ cargas }: { cargas: { carga: string; dia: string; hora: number | null; minutos: number | null; skus: number; pesoKg: number }[] }) {
  if (!cargas.length) return <p className="p-5 text-sm text-slate-500">Nenhuma carga no recorte.</p>;
  return (
    <table className="w-full min-w-[480px] text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
          <th className={`${th} pl-5`}>Carga</th>
          <th className={th}>Início</th>
          <th className={`${th} text-right`}>Tempo</th>
          <th className={`${th} text-right`}>SKUs</th>
          <th className={`${th} pr-5 text-right`}>Peso</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-[#141a4d]">
        {cargas.slice(0, MAX_CARGAS).map((c) => {
          const fora = c.minutos === null || c.minutos < 0 || c.minutos > TETO_CARGA_MIN;
          return (
            <tr key={`${c.carga}-${c.dia}`} className="border-b border-slate-50 last:border-0">
              <td className="py-2.5 pl-5 pr-3 font-medium">{c.carga}</td>
              <td className="px-3 py-2.5 text-slate-500">{diaCurto(c.dia)} {String(c.hora).padStart(2, "0")}h</td>
              <td className={`px-3 py-2.5 text-right font-semibold ${fora ? "text-slate-400" : ""}`}
                title={fora ? "Fora das médias: sem conferência ou acima do teto" : undefined}>
                {c.minutos === null ? "sem conf." : duracao(c.minutos)}{fora && c.minutos !== null ? " *" : ""}
              </td>
              <td className="px-3 py-2.5 text-right">{int(c.skus)}</td>
              <td className="py-2.5 pl-3 pr-5 text-right">{kg(c.pesoKg)}</td>
            </tr>
          );
        })}
      </tbody>
      {cargas.length > MAX_CARGAS && (
        <tfoot>
          <tr><td colSpan={5} className="px-5 py-3 text-xs text-slate-500">Mostrando as {MAX_CARGAS} mais lentas de {cargas.length}. * = fora das médias.</td></tr>
        </tfoot>
      )}
    </table>
  );
}
