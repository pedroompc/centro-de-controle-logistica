"use client";

import { formatKg, formatPercent } from "@/domain/format";
import { rotuloPeriodo, somarDias } from "@/domain/periodo";
import { filtrarFatos, agrupar, filtroAtivo } from "@/domain/bi-recebimento";
import { Vazio, Bloco, Mini, useSub, Dica, semCentavos } from "../bi-ui";
import { Filtro, PropsVisao, contagem, ddmm, dec1, fmtPeso, inteiro, valorMedida } from "./base";
import { DiasDaSemana, GraficoDias, ListaTipos, RankingFornecedores, TabelaFornecedores } from "./graficos";

type SubDescarrego = "carros" | "fornecedores" | "peso" | "caixas" | "dias";

const TITULO_SUB: Record<SubDescarrego, string> = {
  carros: "Carros",
  fornecedores: "Fornecedores atendidos",
  peso: "Peso",
  caixas: "Caixas (volume)",
  dias: "Dias com descarrego",
};

export function VisaoDescarrego(p: PropsVisao) {
  const { x } = p;
  const { sel } = x;
  const { sub, abrir, fechar } = useSub<SubDescarrego>();
  if (!x.temFatos) return <Vazio>Carregando o descarrego do período…</Vazio>;
  const qtd = x.porNotas ? sel.notas : sel.carros;
  const ajudantes = x.r.equipe.ajudantes;
  const kgPorAjudante = ajudantes > 0 ? sel.pesoKg / ajudantes : null;
  const un = x.porNotas ? "nota" : "carro";
  const card = (k: SubDescarrego) => ({ onClick: abrir(k), ativo: sub === k });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      {/* Receita não entra aqui: tem o quadro próprio no topo. */}
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">
        <Mini {...card("carros")} rotulo={x.porNotas ? "Notas" : "Carros"} valor={inteiro.format(qtd)} sub={sel.dias > 0 ? `${dec1(qtd / sel.dias)} por dia` : undefined} />
        <Mini {...card("fornecedores")} rotulo="Fornecedores atendidos" valor={inteiro.format(sel.fornecedores)} sub={sel.notas > 0 ? `${inteiro.format(sel.notas)} notas descarregadas` : "com lançamento no mês"} />
        <Mini
          {...card("peso")}
          rotulo="Peso"
          valor={fmtPeso(sel.pesoKg)}
          sub={kgPorAjudante !== null ? `${formatKg(kgPorAjudante)} por ajudante` : qtd > 0 ? `${formatKg(sel.pesoKg / qtd)} por ${un}` : undefined}
        />
        <Mini {...card("caixas")} rotulo="Caixas (volume)" valor={inteiro.format(sel.caixas)} sub={`${inteiro.format(sel.descargasVolume)} descargas`} />
        <Mini {...card("dias")} rotulo="Dias com descarrego" valor={inteiro.format(sel.dias)} sub={rotuloPeriodo(p.dados.periodo)} />
      </div>
      <div className="flex items-center gap-3 text-xs">
        {sub ? (
          <>
            <button type="button" onClick={fechar} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
              ◂ Voltar ao resumo
            </button>
            <span className="font-bold uppercase tracking-[0.16em] text-amber-300">Descarrego › {TITULO_SUB[sub]}</span>
          </>
        ) : (
          <span className="text-white/35">Clique num card para abrir o detalhe dele · clique num dia, tipo ou fornecedor para filtrar tudo</span>
        )}
      </div>

      {sub === null && (
        // Fornecedores com a coluna inteira (é a lista mais longa); calendário e tipos dividem a outra.
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
            <Bloco titulo={x.porNotas ? "Notas por dia" : "Carros por dia"} direita={<Dica>clique num dia para filtrar</Dica>}>
              <GraficoDias {...p} medida="carros" />
            </Bloco>
            <Bloco titulo="Por tipo de carga" direita={<Dica>clique para filtrar</Dica>}>
              <ListaTipos {...p} medida="carros" />
            </Bloco>
          </div>
          <Bloco titulo="Fornecedores">
            <TabelaFornecedores {...p} />
          </Bloco>
        </div>
      )}

      {sub === "carros" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Bloco titulo={x.porNotas ? "Notas por dia" : "Carros por dia"} direita={<Dica>clique num dia para filtrar</Dica>}>
            <GraficoDias {...p} medida="carros" />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <Bloco titulo="Por tipo de carga" direita={<Dica>clique para filtrar</Dica>}>
              <ListaTipos {...p} medida="carros" />
            </Bloco>
            <Bloco titulo={`Média de ${x.porNotas ? "notas" : "carros"} por dia da semana`} direita={<Dica>verde = dia mais forte</Dica>}>
              <DiasDaSemana {...p} medida="carros" />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "fornecedores" && <SubFornecedores {...p} />}

      {sub === "peso" && (
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Mini rotulo={`Peso por ${un}`} valor={qtd > 0 ? formatKg(sel.pesoKg / qtd) : "—"} />
            <Mini rotulo="Peso por dia" valor={sel.dias > 0 ? formatKg(sel.pesoKg / sel.dias) : "—"} sub={`${sel.dias} dias com descarrego`} />
            <Mini rotulo="Descarregado por ajudante" valor={kgPorAjudante !== null ? formatKg(kgPorAjudante) : "—"} sub={`${ajudantes} ajudantes · média da equipe`} />
            <Mini rotulo="Por ajudante por dia" valor={kgPorAjudante !== null && sel.dias > 0 ? formatKg(kgPorAjudante / sel.dias) : "—"} />
          </div>
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Bloco titulo="Peso por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
              <GraficoDias {...p} medida="pesoKg" />
            </Bloco>
            <Bloco titulo="Peso por tipo de carga" direita={<Dica>clique para filtrar</Dica>}>
              <ListaTipos {...p} medida="pesoKg" />
            </Bloco>
            <Bloco titulo="Peso por fornecedor" direita={<Dica>clique para filtrar</Dica>}>
              <RankingFornecedores {...p} medida="pesoKg" />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "caixas" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Bloco titulo="Caixas por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
            <GraficoDias {...p} medida="caixas" />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Mini rotulo="Caixas por descarga" valor={sel.descargasVolume > 0 ? contagem(Math.round(sel.caixas / sel.descargasVolume)) : "—"} sub={`${inteiro.format(sel.descargasVolume)} descargas de volume`} />
              <Mini rotulo="Caixas por dia" valor={sel.dias > 0 ? contagem(Math.round(sel.caixas / sel.dias)) : "—"} />
            </div>
            <Bloco titulo="Caixas por fornecedor">
              <RankingFornecedores {...p} medida="caixas" />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "dias" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Bloco titulo={x.porNotas ? "Notas por dia" : "Carros por dia"} direita={<Dica>clique num dia para filtrar</Dica>}>
            <GraficoDias {...p} medida="carros" />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <DiasResumo {...p} />
            <Bloco titulo="Média por dia da semana" direita={<Dica>verde = dia mais forte</Dica>}>
              <DiasDaSemana {...p} medida="carros" />
            </Bloco>
          </div>
        </div>
      )}

    </div>
  );
}

/** Card de destaque com a lista de quem compõe o número (clique no nome filtra). */
function CardQuem({
  titulo,
  valor,
  explicacao,
  itens,
  filtro,
  onFiltro,
}: {
  titulo: string;
  valor: string;
  explicacao: string;
  itens: { rotulo: string; fornecedor?: string; principal: string; detalhe: string }[]; // `fornecedor` = linha clicável (filtra)
} & Filtro) {
  return (
    <div className="flex min-h-0 flex-col rounded-xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">{titulo}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-white">{valor}</span>
        <span className="text-xs text-white/40">{explicacao}</span>
      </div>
      <ol className="mt-2 min-h-0 flex-1 space-y-1 overflow-auto">
        {itens.map((it, i) => {
          const sel = !!it.fornecedor && filtro.fornecedor === it.fornecedor;
          const conteudo = (
            <>
              {it.fornecedor && <span className="w-4 shrink-0 text-xs font-bold text-amber-300">{i + 1}º</span>}
              <span title={it.rotulo} className={`min-w-0 flex-1 truncate ${it.fornecedor ? "font-semibold" : ""} ${sel ? "text-amber-300" : it.fornecedor ? "text-white" : "text-white/55"}`}>{it.rotulo}</span>
              <span className="shrink-0 font-bold tabular-nums text-white">{it.principal}</span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-white/45">{it.detalhe}</span>
            </>
          );
          return (
            <li key={`${it.rotulo}-${i}`}>
              {it.fornecedor ? (
                <button
                  type="button"
                  onClick={() => onFiltro({ ...filtro, fornecedor: sel ? null : it.fornecedor })}
                  className={`flex w-full items-baseline gap-2 rounded-md px-1.5 py-0.5 text-left text-sm transition hover:bg-white/[0.07] ${sel ? "bg-amber-400/15" : ""}`}
                  title="Clique para filtrar este fornecedor"
                >
                  {conteudo}
                </button>
              ) : (
                <div className="flex items-baseline gap-2 px-1.5 py-0.5 text-sm">{conteudo}</div>
              )}
            </li>
          );
        })}
        {itens.length === 0 && <li className="text-sm text-white/40">Sem lançamentos por fornecedor.</li>}
      </ol>
    </div>
  );
}

/** Fornecedores: tabela + dependência dos maiores (com nomes e números de cada um). */
function SubFornecedores(p: PropsVisao) {
  const lista = agrupar(filtrarFatos(p.dados.fatos ?? [], p.filtro, "fornecedor"), (f) => f.fornecedor);
  const totP = lista.reduce((t, g) => t + g.resumo.pesoKg, 0);
  const totR = lista.reduce((t, g) => t + g.resumo.receita, 0);
  const totN = lista.reduce((t, g) => t + g.resumo.notas, 0);
  const pct = (v: number, tot: number) => (tot > 0 ? formatPercent(v / tot, 0) : "—");
  const porPeso = [...lista].sort((a, b) => b.resumo.pesoKg - a.resumo.pesoKg);
  const porReceita = [...lista].sort((a, b) => b.resumo.receita - a.resumo.receita);
  const porNotas = [...lista].sort((a, b) => b.resumo.notas - a.resumo.notas);
  const top3P = porPeso.slice(0, 3);
  const top3R = porReceita.slice(0, 3);
  const maior = porPeso[0];
  const doQue = filtroAtivo(p.filtro) ? "do filtro" : p.dados.mensal ? "do mês" : "do período";
  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Bloco titulo="Fornecedores atendidos">
        <TabelaFornecedores {...p} />
      </Bloco>
      <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-3">
        <CardQuem
          {...p}
          titulo="Peso que vem dos 3 maiores"
          valor={pct(top3P.reduce((t, g) => t + g.resumo.pesoKg, 0), totP)}
          explicacao={`do peso ${doQue}`}
          itens={top3P.map((g) => ({ rotulo: g.chave, fornecedor: g.chave, principal: fmtPeso(g.resumo.pesoKg), detalhe: `${pct(g.resumo.pesoKg, totP)} do peso` }))}
        />
        <CardQuem
          {...p}
          titulo="Receita que vem dos 3 maiores"
          valor={pct(top3R.reduce((t, g) => t + g.resumo.receita, 0), totR)}
          explicacao={`da receita ${doQue}`}
          itens={top3R.map((g) => ({ rotulo: g.chave, fornecedor: g.chave, principal: semCentavos(g.resumo.receita), detalhe: `${pct(g.resumo.receita, totR)} da receita` }))}
        />
        <CardQuem
          {...p}
          titulo="Maior fornecedor · % do peso"
          valor={maior ? pct(maior.resumo.pesoKg, totP) : "—"}
          explicacao={maior ? maior.chave : ""}
          itens={
            maior
              ? [
                  { rotulo: maior.chave, fornecedor: maior.chave, principal: fmtPeso(maior.resumo.pesoKg), detalhe: "de peso" },
                  { rotulo: "Receita", principal: semCentavos(maior.resumo.receita), detalhe: `${pct(maior.resumo.receita, totR)} da receita` },
                  { rotulo: "Notas", principal: `${maior.resumo.notas}`, detalhe: `em ${maior.resumo.dias} dias` },
                ]
              : []
          }
        />
        <CardQuem
          {...p}
          titulo="Média de notas por fornecedor"
          valor={lista.length ? dec1(totN / lista.length) : "—"}
          explicacao={`${totN} notas · ${lista.length} fornecedores`}
          itens={porNotas.slice(0, 3).map((g) => ({ rotulo: g.chave, fornecedor: g.chave, principal: `${g.resumo.notas} notas`, detalhe: `${dec1(g.resumo.notas / Math.max(1, g.resumo.dias))} por dia` }))}
        />
      </div>
    </div>
  );
}

/** Números dos dias: média, maior, menor e dias úteis sem descarrego. */
function DiasResumo({ dados, x, filtro }: PropsVisao) {
  const dias = agrupar(filtrarFatos(dados.fatos ?? [], filtro, "dia"), (f) => f.data).map((d) => ({ d: d.chave, v: valorMedida(d.resumo, "carros", x.porNotas) }));
  const com = dias.filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
  // Dias úteis do recorte até hoje (fim de semana não conta).
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const fim = dados.periodo.ate < hojeISO ? dados.periodo.ate : hojeISO;
  const util = (iso: string) => new Date(`${iso}T12:00:00`).getDay() % 6 !== 0;
  let uteis = 0;
  for (let d = dados.periodo.de; d <= fim; d = somarDias(d, 1)) if (util(d)) uteis += 1;
  const semDescarrego = Math.max(0, uteis - com.filter((c) => util(c.d)).length);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Mini rotulo="Média por dia" valor={com.length ? dec1(com.reduce((t, c) => t + c.v, 0) / com.length) : "—"} sub={x.porNotas ? "notas" : "carros"} />
      <Mini rotulo="Maior dia" valor={com[0] ? contagem(com[0].v) : "—"} sub={com[0] ? ddmm(com[0].d) : undefined} />
      <Mini rotulo="Menor dia" valor={com.length ? contagem(com[com.length - 1].v) : "—"} sub={com.length ? ddmm(com[com.length - 1].d) : undefined} />
      <Mini rotulo="Dias úteis sem descarrego" valor={inteiro.format(semDescarrego)} sub={`de ${uteis} dias úteis (seg–sex)`} />
    </div>
  );
}

// --- RECEITA ------------------------------------------------------------------
