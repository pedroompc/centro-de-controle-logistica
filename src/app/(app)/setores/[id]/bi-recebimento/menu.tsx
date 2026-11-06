"use client";

import { formatBRL, formatPercent } from "@/domain/format";
import { rotuloPeriodo } from "@/domain/periodo";
import { ROTULO_TIPO } from "@/domain/descarregamento";
import { ehMelhorDaJanela, type IndicadorComparavel } from "@/domain/recebimento";
import { filtroAtivo, type FiltroBI } from "@/domain/bi-recebimento";
import type { PessoaRecebimento } from "../../../painel/painel-actions";
import { Quadro, Vazio, semCentavos } from "../bi-ui";
import { DadosBI, Filtro, VisaoBI, carrosOuNotas, ddmm, fmtPeso, inteiro, recortar, trimestre } from "./base";
import { VisaoCusto } from "./custo";
import { VisaoDescarrego } from "./descarrego";
import { VisaoEficiencia, VisaoReceita } from "./receita";

/** O topo do BI: 6 quadros (menu) + a barra de filtros ativos. */
export function MenuBI({ dados, visao, onVisao, filtro, onFiltro }: { dados: DadosBI; visao: VisaoBI | null; onVisao: (v: VisaoBI) => void } & Filtro) {
  const x = recortar(dados, filtro);
  if (!x) return null;
  const { r, sel } = x;
  const semFiltro = !filtroAtivo(filtro);
  // Verde = melhor mês do trimestre; só faz sentido no mês inteiro (sem filtro).
  const janela = dados.mensal ? trimestre(dados.serie, dados.mes) : [];
  const verde = (k: IndicadorComparavel) => semFiltro && ehMelhorDaJanela(janela, r.mes, k);
  const equip = dados.custo?.equipamentos ?? [];
  const resumoEquip = equip
    .filter((e) => e.quantidade > 0)
    .map((e) => `${e.quantidade} ${e.nome.toLowerCase()}`)
    .join(" · ");
  const q = (v: VisaoBI) => ({ ativo: visao === v, onClick: () => onVisao(v) });
  const usar = x.temFatos;
  const peso = usar ? sel.pesoKg : r.pesoKg;
  const receita = usar ? sel.receita : r.receitaDescarrego;
  const pessoas = dados.custo?.pessoas ?? [];
  const cont = (p: PessoaRecebimento["papel"]) => pessoas.filter((y) => y.papel === p).length;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Quadro
          {...q("custo")}
          rotulo="Custo e equipe"
          valor={formatBRL(x.custo)}
          sub={
            x.criterioCusto ??
            `${pessoas.length ? `${cont("ajudante")} aj · ${cont("conferente")} conf · ${cont("empilhador")} pux` : `${r.equipe.total} pessoas`}${resumoEquip ? ` · ${resumoEquip}` : ""}`
          }
        />
        <Quadro {...q("descarrego")} rotulo="Descarrego" valor={usar ? carrosOuNotas(x) : `${inteiro.format(r.carros)} carros`} sub={`${fmtPeso(peso)} · ${usar ? sel.dias : r.diasDescarrego} ${(usar ? sel.dias : r.diasDescarrego) === 1 ? "dia" : "dias"}${usar ? ` · ${sel.fornecedores} fornecedores` : ""}`} verde={verde("carrosPorDia")} />
        <Quadro {...q("receita")} rotulo="Receita" valor={formatBRL(receita)} sub={`custo consome ${receita > 0 ? formatPercent(x.custo / receita) : "—"}`} verde={verde("resultado")} />
        <Quadro
          {...q("eficiencia")}
          rotulo="Eficiência"
          valor={peso > 0 ? `${formatBRL(x.custo / (peso / 1000))}/t` : "—"}
          sub={peso > 0 && receita > 0 ? `receita ${semCentavos(receita / (peso / 1000))}/t` : "custo por tonelada"}
          verde={verde("custoPorTonelada")}
        />
      </div>
      <BarraFiltros filtro={filtro} onFiltro={onFiltro} />
    </div>
  );
}

function BarraFiltros({ filtro, onFiltro }: Filtro) {
  const chips: { k: keyof FiltroBI; rotulo: string }[] = [];
  if (filtro.dia) chips.push({ k: "dia", rotulo: `Dia ${ddmm(filtro.dia)}` });
  if (filtro.fornecedor) chips.push({ k: "fornecedor", rotulo: filtro.fornecedor });
  if (filtro.tipo) chips.push({ k: "tipo", rotulo: ROTULO_TIPO[filtro.tipo] });
  return (
    <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2 text-xs">
      <span className="font-bold uppercase tracking-[0.14em] text-white/35">Filtros</span>
      {chips.length === 0 && <span className="text-white/35">nenhum — clique num dia, fornecedor ou tipo de carga para filtrar tudo</span>}
      {chips.map((c) => (
        <button
          key={c.k}
          type="button"
          onClick={() => onFiltro({ ...filtro, [c.k]: null })}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 font-bold text-[#0a1650] hover:bg-amber-300"
          title="Tirar este filtro"
        >
          {c.rotulo} <span aria-hidden>✕</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={() => onFiltro({})} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
          Limpar tudo (Esc)
        </button>
      )}
    </div>
  );
}

// --- Palco ---------------------------------------------------------------------

export function PalcoBI({ dados, visao, filtro, onFiltro }: { dados: DadosBI; visao: VisaoBI } & Filtro) {
  const x = recortar(dados, filtro);
  if (!x) return <Vazio>Sem dados de recebimento para {rotuloPeriodo(dados.periodo)}.</Vazio>;
  const p = { dados, x, filtro, onFiltro };
  switch (visao) {
    case "custo":
      return <VisaoCusto {...p} />;
    case "descarrego":
      return <VisaoDescarrego {...p} />;
    case "receita":
      return <VisaoReceita {...p} />;
    case "eficiencia":
      return <VisaoEficiencia {...p} />;
  }
}
