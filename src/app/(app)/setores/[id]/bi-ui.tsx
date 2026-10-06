"use client";

/**
 * Peças visuais comuns dos BIs de setor (tema escuro da TV): quadros do menu,
 * blocos, cards, barras e a parte de equipe/folha/equipamentos. Cada setor
 * (Recebimento, Separação…) monta os seus quadros em cima delas.
 */
import { Fragment, useState, type ReactNode } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { RUBRICAS_FOLHA, FATOR_ENCARGOS_SALARIO } from "@/domain/efetivo";
import type { Equipamento, Funcionario } from "@/domain/types";

export const semCentavos = (v: number) => formatBRL(v).replace(",00", "");

/** Função de uma pessoa no setor (ajudante, separador…) e como ela aparece. */
export interface PapelBI {
  id: string;
  rotulo: string;
  plural: string;
  cor: string;
}

/** Pessoa do setor no BI: custo do cadastro e a composição da folha. */
export interface PessoaBI {
  id: string;
  nome: string;
  cargo: string;
  papel: string;
  custo: number;
  outroSetor: boolean;
  rubricas: Pick<Funcionario, "salarioBase" | "passagem" | "alimentacao" | "planoSaude" | "ajudaCusto" | "premiacao" | "adicionalNoturno">;
}

const papelDe = (papeis: PapelBI[], id: string): PapelBI => papeis.find((p) => p.id === id) ?? { id, rotulo: id, plural: id, cor: "#64748b" };

export function Quadro({ ativo, onClick, rotulo, valor, sub, verde }: { ativo: boolean; onClick: () => void; rotulo: string; valor: string; sub: ReactNode; verde?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`@container rounded-2xl px-5 py-4 text-left ring-1 transition ${
        ativo ? "bg-amber-400/15 ring-2 ring-amber-400" : "bg-white/[0.06] ring-white/10 hover:bg-white/[0.1]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/50">{rotulo}</span>
        <span className={`text-xs ${ativo ? "text-amber-300" : "text-white/25"}`}>{ativo ? "▾" : "›"}</span>
      </div>
      <div className={`mt-1 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1.25rem,10cqi,2rem)] font-extrabold leading-none tabular-nums ${verde ? "text-emerald-300" : "text-white"}`}>
        {valor}
      </div>
      <div className="mt-2 truncate text-xs text-white/45">{sub}</div>
    </button>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center text-center text-lg text-white/40">{children}</div>;
}

export function Bloco({ titulo, direita, children, className = "" }: { titulo: string; direita?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-0 flex-col rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{titulo}</span>
        {direita}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** Card de número. Com `onClick` vira SUBSEÇÃO: clicar abre o detalhe dele (de novo, fecha). */
export function Mini({ rotulo, valor, sub, onClick, ativo = false }: { rotulo: string; valor: string; sub?: string; onClick?: () => void; ativo?: boolean }) {
  const corpo = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">{rotulo}</span>
        {onClick && <span className={`text-xs ${ativo ? "text-amber-300" : "text-white/25"}`}>{ativo ? "▾" : "›"}</span>}
      </div>
      <div className="mt-1 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1rem,9cqi,1.5rem)] font-extrabold tabular-nums text-white">{valor}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-white/40">{sub}</div>}
    </>
  );
  if (!onClick) return <div className="@container rounded-xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10">{corpo}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`@container rounded-xl px-4 py-3 text-left ring-1 transition ${ativo ? "bg-amber-400/15 ring-2 ring-amber-400" : "bg-white/[0.05] ring-white/10 hover:bg-white/[0.09]"}`}
    >
      {corpo}
    </button>
  );
}

/** Estado da subseção aberta dentro de uma visão (clicar de novo fecha). */
export function useSub<T extends string>() {
  const [sub, setSub] = useState<T | null>(null);
  const abrir = (k: T) => () => setSub((atual) => (atual === k ? null : k));
  return { sub, abrir, fechar: () => setSub(null) };
}

export function ChipTV({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${ativo ? "bg-amber-400 text-[#0a1650]" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
    >
      {children}
    </button>
  );
}

export const Dica = ({ children }: { children: ReactNode }) => <span className="text-[0.65rem] text-white/35">{children}</span>;

/** Barras verticais no escuro: tooltip no hover, clique opcional, item selecionado em âmbar. */
export function BarrasTV({
  itens,
  fmt,
  altura = 180,
  referencia,
  onClick,
}: {
  itens: { chave: string; rotulo: string; valor: number | null; cor?: string; detalhe?: string; selecionado?: boolean }[];
  fmt: (v: number) => string;
  altura?: number;
  referencia?: { valor: number; rotulo: string };
  onClick?: (chave: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1e-9, ...itens.map((i) => Math.abs(i.valor ?? 0)), referencia?.valor ?? 0) * 1.1;
  const denso = itens.length > 14;
  const algumSel = itens.some((i) => i.selecionado);
  if (itens.length === 0) return <p className="py-8 text-center text-sm text-white/40">Sem lançamentos.</p>;
  return (
    <div className="relative" style={{ height: altura }} onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs text-[#0a1650] shadow-lg"
          style={{ left: `${Math.min(90, Math.max(10, ((hover + 0.5) / itens.length) * 100))}%` }}
        >
          <span className="font-bold">{itens[hover].detalhe ?? itens[hover].rotulo}</span> · {itens[hover].valor === null ? "sem dado" : fmt(itens[hover].valor!)}
          {onClick && <span className="text-slate-400"> · clique para {itens[hover].selecionado ? "tirar o filtro" : "filtrar"}</span>}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-5 top-0">
        {referencia && referencia.valor > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-white/30" style={{ bottom: `${(referencia.valor / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 text-[0.65rem] font-semibold text-white/50">
              {referencia.rotulo} {fmt(referencia.valor)}
            </span>
          </div>
        )}
        <div className={`flex h-full items-end ${denso ? "gap-[3px]" : "gap-2"}`}>
          {itens.map((it, i) => (
            <div
              key={it.chave}
              className={`flex h-full flex-1 flex-col items-center justify-end ${onClick ? "cursor-pointer" : ""}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => onClick?.(it.chave)}
            >
              {!denso && it.valor !== null && <span className={`mb-1 text-xs font-bold tabular-nums ${it.selecionado ? "text-amber-300" : "text-white/85"}`}>{fmt(it.valor)}</span>}
              <div
                className={`w-full rounded-t-md transition ${hover === i ? "brightness-125" : ""}`}
                style={{
                  height: `${Math.max(2, (Math.abs(it.valor ?? 0) / max) * 100)}%`,
                  background: it.selecionado ? "#f5b301" : (it.cor ?? "#5b6fd6"),
                  opacity: algumSel && !it.selecionado ? 0.35 : 1,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={`absolute inset-x-0 bottom-0 flex h-4 ${denso ? "gap-[3px]" : "gap-2"}`}>
        {itens.map((it, i) => (
          <span key={it.chave} className={`flex-1 whitespace-nowrap text-center text-[0.65rem] font-semibold ${it.selecionado ? "text-amber-300" : "text-white/45"}`}>
            {denso && i % Math.ceil(itens.length / 12) !== 0 && !it.selecionado ? "" : it.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarraComposicao({ fatias }: { fatias: { rotulo: string; valor: number; cor: string }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  if (total === 0) return null;
  return (
    <div onMouseLeave={() => setHover(null)}>
      <div className="flex h-4 overflow-hidden rounded-full">
        {fatias.map((f) => (
          <div
            key={f.rotulo}
            onMouseEnter={() => setHover(f.rotulo)}
            className="h-full border-r-2 border-[#0d1550] last:border-0"
            style={{ width: `${(f.valor / total) * 100}%`, background: f.cor, opacity: hover && hover !== f.rotulo ? 0.35 : 1 }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {fatias.map((f) => (
          <span key={f.rotulo} onMouseEnter={() => setHover(f.rotulo)} className={`inline-flex items-center gap-1.5 text-xs ${hover === f.rotulo ? "text-white" : "text-white/60"}`}>
            <span className="h-2 w-2 rounded-sm" style={{ background: f.cor }} />
            {f.rotulo} {formatPercent(f.valor / total, 0)} · {semCentavos(f.valor)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Equipe agrupada por função, com subtotal e % do custo, e filtro por função. */
export function TabelaEquipe({ pessoas, papeis, total }: { pessoas: PessoaBI[]; papeis: PapelBI[]; total: number }) {
  const [papel, setPapel] = useState<string>("todos");
  const ordem = papeis.map((p) => p.id);
  const presentes = papeis.filter((pp) => pessoas.some((y) => y.papel === pp.id));
  const pos = (id: string) => (ordem.indexOf(id) < 0 ? ordem.length : ordem.indexOf(id));
  const lista = pessoas.filter((y) => papel === "todos" || y.papel === papel).sort((a, b) => pos(a.papel) - pos(b.papel) || b.custo - a.custo);
  const subtotal = (pp: string) => lista.filter((y) => y.papel === pp).reduce((t, y) => t + y.custo, 0);
  // Salário base (sem encargos nem benefícios). Sem rubrica cadastrada, não entra na soma.
  const salarios = (pp: string) => lista.filter((y) => y.papel === pp).reduce((t, y) => t + (y.rubricas.salarioBase ?? 0), 0);
  return (
    <Bloco
      titulo="Equipe e salários"
      direita={
        <div className="flex flex-wrap gap-1.5">
          <ChipTV ativo={papel === "todos"} onClick={() => setPapel("todos")}>Todos {pessoas.length}</ChipTV>
          {presentes.map((pp) => (
            <ChipTV key={pp.id} ativo={papel === pp.id} onClick={() => setPapel(pp.id)}>
              {pp.rotulo} {pessoas.filter((y) => y.papel === pp.id).length}
            </ChipTV>
          ))}
        </div>
      }
    >
      <div className="h-full overflow-auto pr-1">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
            <tr>
              <th className="py-2 font-semibold">Nome</th>
              <th className="py-2 font-semibold">Cargo</th>
              <th className="py-2 pr-6 text-right font-semibold">Salário</th>
              <th className="py-2 text-right font-semibold">Custo / mês</th>
              <th className="w-24 py-2 text-right font-semibold">% do custo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((y, i) => (
              <Fragment key={y.id}>
                {(i === 0 || lista[i - 1].papel !== y.papel) && (
                  <tr className="border-t border-white/10">
                    <td colSpan={2} className="pb-1 pt-3 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: papelDe(papeis, y.papel).cor }}>
                      {papelDe(papeis, y.papel).plural} · {lista.filter((z) => z.papel === y.papel).length}
                    </td>
                    <td className="pb-1 pr-6 pt-3 text-right text-xs tabular-nums text-white/50">{salarios(y.papel) > 0 ? formatBRL(salarios(y.papel)) : ""}</td>
                    <td className="pb-1 pt-3 text-right text-xs font-bold tabular-nums text-white/70">{formatBRL(subtotal(y.papel))}</td>
                    <td className="pb-1 pt-3 text-right text-xs tabular-nums text-white/40">{total > 0 ? formatPercent(subtotal(y.papel) / total) : ""}</td>
                  </tr>
                )}
                <tr className="border-t border-white/[0.06] hover:bg-white/[0.04]">
                  <td className="py-2 font-semibold text-white">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: papelDe(papeis, y.papel).cor }} />
                    {y.nome}
                  </td>
                  <td className="py-2 text-white/60">
                    {y.cargo}
                    {y.outroSetor && <span className="ml-1 text-xs text-amber-300">(outro setor)</span>}
                  </td>
                  <td className="py-2 pr-6 text-right tabular-nums text-white/70">{y.rubricas.salarioBase === null ? "—" : formatBRL(y.rubricas.salarioBase)}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{formatBRL(y.custo)}</td>
                  <td className="py-2 text-right tabular-nums text-white/50">{total > 0 ? formatPercent(y.custo / total) : "—"}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-white/35">Cadastro atual. Salário = salário base, sem encargos nem benefícios (— = não cadastrado); custo/mês = com encargos e benefícios. Os filtros de dia/fornecedor/tipo dividem o custo, não mudam a lista.</p>
      </div>
    </Bloco>
  );
}

export function ListaEquipamentos({ equipamentos, padrao = false, grande = false }: { equipamentos: Equipamento[]; padrao?: boolean; grande?: boolean }) {
  return (
    <Bloco titulo="Equipamentos" direita={padrao ? <span className="text-xs text-amber-300">padrão — rode a migração 0023</span> : <Dica>Custos › Equipamentos</Dica>}>
      <ul className={grande ? "space-y-3" : "space-y-2"}>
        {equipamentos.map((e) => (
          <li key={e.id} className={`flex items-baseline justify-between gap-3 ${grande ? "text-base" : "text-sm"}`}>
            <span className="text-white">
              {e.nome} <span className="text-white/45">· {e.quantidade} × {formatBRL(e.custoUnitario)}</span>
            </span>
            <span className="font-bold tabular-nums text-white">{formatBRL(e.quantidade * e.custoUnitario)}</span>
          </li>
        ))}
        {equipamentos.length === 0 && <li className="text-sm text-white/40">Nenhum equipamento cadastrado.</li>}
      </ul>
    </Bloco>
  );
}

/** Folha por rubrica (salário com encargos, benefícios…) e por pessoa. */
export function SubFolha({ pessoas, papeis }: { pessoas: PessoaBI[]; papeis: PapelBI[] }) {
  const temComposicao = (y: PessoaBI) => RUBRICAS_FOLHA.some(([k]) => y.rubricas[k] !== null);
  const com = pessoas.filter(temComposicao);
  const sem = pessoas.filter((y) => !temComposicao(y));
  const rubricas = RUBRICAS_FOLHA.map(([k, rotulo]) => ({
    rotulo: k === "salarioBase" ? `${rotulo} + encargos (×${FATOR_ENCARGOS_SALARIO.toLocaleString("pt-BR")})` : rotulo,
    valor: com.reduce((t, y) => t + (y.rubricas[k] ?? 0) * (k === "salarioBase" ? FATOR_ENCARGOS_SALARIO : 1), 0),
  }));
  if (sem.length) rubricas.push({ rotulo: `Sem composição cadastrada (${sem.length})`, valor: sem.reduce((t, y) => t + y.custo, 0) });
  // O custo do cadastro é a verdade (é ele que entra no custo do setor):
  // se não fecha com as rubricas (custo digitado à mão), a diferença aparece.
  const pelasRubricas = com.reduce((t, y) => t + RUBRICAS_FOLHA.reduce((u, [k]) => u + (y.rubricas[k] ?? 0) * (k === "salarioBase" ? FATOR_ENCARGOS_SALARIO : 1), 0), 0);
  const dif = com.reduce((t, y) => t + y.custo, 0) - pelasRubricas;
  if (Math.abs(dif) >= 1) rubricas.push({ rotulo: "Ajuste: custo digitado ≠ rubricas", valor: dif });
  const vis = rubricas.filter((x) => x.valor !== 0);
  const total = vis.reduce((t, x) => t + x.valor, 0);
  const max = Math.max(1e-9, ...vis.map((x) => Math.abs(x.valor)));
  const beneficios = (y: PessoaBI) => RUBRICAS_FOLHA.filter(([k]) => k !== "salarioBase").reduce((t, [k]) => t + (y.rubricas[k] ?? 0), 0);
  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <Bloco titulo="Folha por rubrica" direita={<span className="text-sm font-bold tabular-nums text-white">{formatBRL(total)}</span>}>
        <ul className="space-y-3">
          {vis.map((x) => (
            <li key={x.rotulo}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-white">{x.rotulo}</span>
                <span className="shrink-0 tabular-nums text-white">
                  {formatBRL(x.valor)} <span className="text-white/40">· {formatPercent(x.valor / total, 0)}</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/10">
                <div className={`h-full rounded-full ${x.valor < 0 ? "bg-white/30" : "bg-[#5b6fd6]"}`} style={{ width: `${(Math.abs(x.valor) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco titulo="Por pessoa">
        <div className="h-full overflow-auto pr-1">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
              <tr>
                <th className="py-2 font-semibold">Nome</th>
                <th className="py-2 text-right font-semibold">Salário base</th>
                <th className="py-2 text-right font-semibold">Benefícios</th>
                <th className="py-2 text-right font-semibold">Custo / mês</th>
              </tr>
            </thead>
            <tbody>
              {[...pessoas].sort((a, b) => b.custo - a.custo).map((y) => (
                <tr key={y.id} className="border-t border-white/[0.06]">
                  <td className="py-2">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: papelDe(papeis, y.papel).cor }} />
                    <span className="font-semibold text-white">{y.nome}</span>
                    <span className="ml-1 text-xs text-white/40">{papelDe(papeis, y.papel).rotulo}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-white/70">{y.rubricas.salarioBase === null ? "—" : formatBRL(y.rubricas.salarioBase)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{temComposicao(y) ? formatBRL(beneficios(y)) : "—"}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{formatBRL(y.custo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-white/35">
            Custo = salário base × {FATOR_ENCARGOS_SALARIO.toLocaleString("pt-BR")} (encargos) + benefícios. Traço = rubrica não cadastrada; o custo dessa pessoa é o digitado no cadastro.
          </p>
        </div>
      </Bloco>
    </div>
  );
}

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Calendário do mês: intensidade = valor do dia; clique seleciona (de novo, tira). */
export function CalendarioBI({
  mes: mesISO,
  porDia,
  fmt,
  selecionado,
  onSelecionar,
  vazio = "sem movimento",
  menorEhMelhor = false,
}: {
  mes: string;
  porDia: Map<string, number>;
  fmt: (v: number) => string;
  selecionado: string | null;
  onSelecionar: (dia: string | null) => void;
  vazio?: string;
  menorEhMelhor?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [ano, mes] = mesISO.split("-").map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDow = new Date(ano, mes - 1, 1).getDay(); // 0 = domingo
  const vals = [...porDia.values()].filter((v) => v > 0);
  const max = Math.max(1e-9, ...vals);
  const min = vals.length ? Math.min(...vals) : 0;
  const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const forca = (v: number) => (menorEhMelhor ? (max > min ? (max - v) / (max - min) : 1) : v / max);
  const celulas: (string | null)[] = [...Array(primeiroDow).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${mesISO.slice(0, 8)}${String(i + 1).padStart(2, "0")}`)];
  while (celulas.length % 7) celulas.push(null);
  const hv = hover ? porDia.get(hover) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-1 flex items-center justify-between text-xs text-white/45">
        <span>
          {hover ? (
            <>
              <strong className="text-white">{ddmm(hover)}</strong> · {hv ? fmt(hv) : vazio}
              {hv ? ` · ${hv >= media ? "acima" : "abaixo"} da média` : ""}
            </>
          ) : (
            <>média {fmt(media)} por dia com movimento</>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {menorEhMelhor ? "pior" : "menos"}
          {[0.15, 0.4, 0.7, 1].map((o) => (
            <span key={o} className="h-2.5 w-2.5 rounded-sm" style={{ background: "#5b6fd6", opacity: o }} />
          ))}
          {menorEhMelhor ? "melhor" : "mais"}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-white/35">
        {SEMANA.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {/* Linhas de mesma altura que se ajustam ao espaço do bloco (sem cortar a última semana). */}
      <div className="mt-1 grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
        {celulas.map((dia, i) => {
          if (!dia) return <span key={`v${i}`} />;
          const v = porDia.get(dia) ?? 0;
          const sel = selecionado === dia;
          const fim = new Date(ano, mes - 1, Number(dia.slice(8, 10))).getDay() % 6 === 0;
          return (
            <button
              key={dia}
              type="button"
              disabled={v === 0}
              onMouseEnter={() => setHover(dia)}
              onClick={() => onSelecionar(sel ? null : dia)}
              title={`${ddmm(dia)} · ${v ? fmt(v) : vazio}`}
              className={`relative flex min-h-[2.25rem] flex-col justify-between rounded-md px-1.5 py-1 text-left transition ${v ? "cursor-pointer hover:ring-2 hover:ring-white/50" : "cursor-default"} ${sel ? "ring-2 ring-amber-300" : ""} ${selecionado && !sel ? "opacity-45" : ""}`}
              style={{
                background: sel ? "#f5b301" : v ? `rgba(91,111,214,${0.18 + 0.82 * forca(v)})` : fim ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
              }}
            >
              <span className={`text-[0.65rem] font-bold leading-none ${sel ? "text-[#0a1650]" : v ? "text-white/70" : "text-white/25"}`}>{Number(dia.slice(8, 10))}</span>
              {v > 0 && <span className={`self-end text-xs font-extrabold leading-none tabular-nums ${sel ? "text-[#0a1650]" : "text-white"}`}>{fmt(v)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
