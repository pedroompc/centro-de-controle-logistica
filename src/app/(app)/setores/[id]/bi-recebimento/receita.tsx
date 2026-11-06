"use client";

import { formatBRL, formatPercent } from "@/domain/format";
import { rotuloPeriodo } from "@/domain/periodo";
import { Vazio, Bloco, Mini, Dica, semCentavos } from "../bi-ui";
import { PropsVisao, SerieMeses, fmtPeso } from "./base";
import { GraficoDias, ListaTipos, TabelaFornecedores } from "./graficos";

export function VisaoReceita(p: PropsVisao) {
  const { x, dados } = p;
  const { sel } = x;
  if (!x.temFatos) return <Vazio>Carregando a receita do período…</Vazio>;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Mini rotulo="Receita de descarrego" valor={formatBRL(sel.receita)} sub={rotuloPeriodo(p.dados.periodo)} />
        <Mini rotulo="Custo do recebimento" valor={formatBRL(x.custo)} sub={x.criterioCusto ?? (p.dados.mensal ? "do mês" : "do período")} />
        <Mini rotulo="Sobra (receita − custo)" valor={formatBRL(sel.receita - x.custo)} />
        <Mini rotulo="Custo consome" valor={sel.receita > 0 ? formatPercent(x.custo / sel.receita) : "—"} sub="da receita" />
        <Mini rotulo="Receita por tonelada" valor={sel.pesoKg > 0 ? formatBRL(sel.receita / (sel.pesoKg / 1000)) : "—"} sub={fmtPeso(sel.pesoKg)} />
      </div>
      {/* Calendário | tipos + mês a mês | fornecedores — nada fica fora da tela. */}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
        <Bloco titulo="Receita por dia" direita={<Dica>clique para filtrar</Dica>}>
          <GraficoDias {...p} medida="receita" />
        </Bloco>
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <Bloco titulo="Receita por tipo" direita={<Dica>clique para filtrar</Dica>}>
            <ListaTipos {...p} medida="receita" />
          </Bloco>
          <Bloco titulo="Receita · mês a mês">
            <SerieMeses dados={dados} valor={(y) => y.receitaDescarrego} fmt={semCentavos} maiorEhBom altura={110} />
          </Bloco>
        </div>
        <Bloco titulo="Quem mais paga">
          <TabelaFornecedores {...p} ordemInicial="receita" />
        </Bloco>
      </div>
    </div>
  );
}

// --- EFICIÊNCIA ----------------------------------------------------------------

export function VisaoEficiencia({ dados, x }: PropsVisao) {
  const { r, sel } = x;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini rotulo="Custo por tonelada" valor={sel.pesoKg > 0 ? formatBRL(x.custo / (sel.pesoKg / 1000)) : "—"} sub={x.criterioCusto ?? "o número que mede a equipe"} />
        <Mini rotulo="Custo ÷ descarrego" valor={sel.receita > 0 ? formatPercent(x.custo / sel.receita) : "—"} />
        <Mini rotulo="Custo ÷ faturamento líquido" valor={r.custoSobreFaturamento === null ? "—" : formatPercent(r.custoSobreFaturamento, 2)} sub={dados.mensal ? "do mês" : "do período"} />
        <Mini rotulo="Faturamento líquido" valor={r.faturamentoLiquido === null ? "—" : formatBRL(r.faturamentoLiquido)} sub={rotuloPeriodo(dados.periodo)} />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-3">
        <Bloco titulo="Custo por tonelada · mês a mês">
          <SerieMeses dados={dados} valor={(y) => y.custoPorTonelada} fmt={formatBRL} maiorEhBom={false} altura={340} />
        </Bloco>
        <Bloco titulo="Custo ÷ descarrego · mês a mês">
          <SerieMeses dados={dados} valor={(y) => y.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} altura={340} />
        </Bloco>
        <Bloco titulo="Custo ÷ faturamento · mês a mês">
          <SerieMeses dados={dados} valor={(y) => y.custoSobreFaturamento} fmt={(v) => formatPercent(v, 2)} maiorEhBom={false} altura={340} />
        </Bloco>
      </div>
    </div>
  );
}
