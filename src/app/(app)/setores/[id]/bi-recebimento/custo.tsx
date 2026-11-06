"use client";

import { formatBRL, formatPercent } from "@/domain/format";
import { rotuloPeriodo } from "@/domain/periodo";
import { filtrarFatos, agrupar, type FiltroBI } from "@/domain/bi-recebimento";
import { Vazio, Bloco, Mini, useSub, Dica, BarraComposicao, TabelaEquipe, ListaEquipamentos, SubFolha, semCentavos } from "../bi-ui";
import { Calendario, DadosBI, ORDEM_PAPEL, PAPEIS, PAPEL, PropsVisao, Recorte, SerieMeses, ddmm, fmtPeso, inteiro } from "./base";

type SubCusto = "custo" | "equipe" | "folha" | "equipamentos" | "porCarro" | "porTonelada";

const TITULO_SUB_CUSTO: Record<SubCusto, string> = {
  custo: "Custo do mês",
  equipe: "Equipe",
  folha: "Folha",
  equipamentos: "Equipamentos",
  porCarro: "Custo por carro",
  porTonelada: "Custo por tonelada",
};

/**
 * Custo de cada dia de descarrego: o custo do mês ÷ dias de descarrego; com
 * filtro de fornecedor/tipo, rateado pelo peso do dia. Volta carros e peso do
 * dia para as razões (por carro, por tonelada).
 */
function custosPorDia(dados: DadosBI, x: Recorte, filtro: FiltroBI) {
  const todos = dados.fatos ?? [];
  const pesoTotalDia = new Map(agrupar(todos, (f) => f.data).map((d) => [d.chave, d.resumo.pesoKg]));
  const custoDia = x.mes.dias > 0 ? x.r.custoPeriodo / x.mes.dias : 0;
  const rateia = !!(filtro.fornecedor || filtro.tipo);
  return agrupar(filtrarFatos(todos, filtro, "dia"), (f) => f.data).map((d) => {
    const base = pesoTotalDia.get(d.chave) ?? 0;
    const custo = rateia ? (base > 0 ? (custoDia * d.resumo.pesoKg) / base : 0) : custoDia;
    return { data: d.chave, custo, carros: x.porNotas ? d.resumo.notas : d.resumo.carros, pesoKg: d.resumo.pesoKg };
  });
}

export function VisaoCusto(p: PropsVisao) {
  const { dados, x, filtro, onFiltro } = p;
  const { sub, abrir, fechar } = useSub<SubCusto>();
  const c = dados.custo;
  if (!c) return <Vazio>Carregando pessoas e equipamentos…</Vazio>;
  const { r, sel } = x;
  const folha = c.pessoas.reduce((t, y) => t + y.custo, 0);
  const custoEquip = c.equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const papeis = ORDEM_PAPEL.filter((pp) => c.pessoas.some((y) => y.papel === pp));
  const fatias = [
    ...papeis.map((pp) => ({ rotulo: PAPEL[pp].plural, valor: c.pessoas.filter((y) => y.papel === pp).reduce((t, y) => t + y.custo, 0), cor: PAPEL[pp].cor })),
    { rotulo: "Equipamentos", valor: custoEquip, cor: "#f5b301" },
  ].filter((f) => f.valor > 0);
  const carros = x.porNotas ? sel.notas : sel.carros;
  const un = x.porNotas ? "nota" : "carro";
  const card = (k: SubCusto) => ({ onClick: abrir(k), ativo: sub === k });
  const dias = custosPorDia(dados, x, filtro);
  const porCarroDia = new Map(dias.filter((d) => d.carros > 0).map((d) => [d.data, d.custo / d.carros]));
  const porTonDia = new Map(dias.filter((d) => d.pesoKg > 0).map((d) => [d.data, d.custo / (d.pesoKg / 1000)]));
  const resumoDias = (m: Map<string, number>, fmt: (v: number) => string) => {
    const v = [...m.entries()].sort((a, b) => a[1] - b[1]);
    if (!v.length) return null;
    return (
      <div className="grid grid-cols-3 gap-3">
        <Mini rotulo="Média dos dias" valor={fmt(v.reduce((t, e) => t + e[1], 0) / v.length)} sub="cada dia pesa igual" />
        <Mini rotulo="Melhor dia (mais barato)" valor={fmt(v[0][1])} sub={ddmm(v[0][0])} />
        <Mini rotulo="Pior dia (mais caro)" valor={fmt(v[v.length - 1][1])} sub={ddmm(v[v.length - 1][0])} />
      </div>
    );
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Mini {...card("custo")} rotulo={x.criterioCusto ? "Custo no filtro" : p.dados.mensal ? "Custo do mês" : "Custo do período"} valor={formatBRL(x.custo)} sub={x.criterioCusto ?? (r.fracaoMes % 1 !== 0 ? "proporcional aos dias corridos" : rotuloPeriodo(p.dados.periodo))} />
        <Mini
          {...card("equipe")}
          rotulo="Equipe"
          valor={`${c.pessoas.length} pessoas`}
          sub={papeis.map((pp) => `${c.pessoas.filter((y) => y.papel === pp).length} ${PAPEL[pp].rotulo.toLowerCase().slice(0, 4)}.`).join(" · ")}
        />
        <Mini {...card("folha")} rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub="por mês, com encargos" />
        <Mini {...card("equipamentos")} rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${c.equipamentos.reduce((t, e) => t + e.quantidade, 0)} unidades · por mês`} />
        <Mini {...card("porCarro")} rotulo={`Custo por ${un}`} valor={carros > 0 ? formatBRL(x.custo / carros) : "—"} sub={x.porNotas ? `${sel.notas} notas` : `${inteiro.format(sel.carros)} carros`} />
        <Mini {...card("porTonelada")} rotulo="Custo por tonelada" valor={sel.pesoKg > 0 ? formatBRL(x.custo / (sel.pesoKg / 1000)) : "—"} sub={fmtPeso(sel.pesoKg)} />
      </div>
      <div className="flex items-center gap-3 text-xs">
        {sub ? (
          <>
            <button type="button" onClick={fechar} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
              ◂ Voltar ao resumo
            </button>
            <span className="font-bold uppercase tracking-[0.16em] text-amber-300">Custo e equipe › {TITULO_SUB_CUSTO[sub]}</span>
          </>
        ) : (
          <span className="text-white/35">Clique num card para abrir o detalhe dele</span>
        )}
      </div>

      {sub === null && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TabelaEquipe pessoas={c.pessoas} papeis={PAPEIS} total={folha + custoEquip} />
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <ListaEquipamentos equipamentos={c.equipamentos} padrao={c.equipamentosPadrao} />
            <Bloco titulo="Do que é feito o custo">
              <BarraComposicao fatias={fatias} />
              <div className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Custo por mês</div>
              <SerieMeses dados={dados} valor={(y) => y.equipe.custo} fmt={semCentavos} maiorEhBom={false} altura={110} />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "custo" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Bloco titulo="Do que é feito o custo">
            <BarraComposicao fatias={fatias} />
            <ul className="mt-4 space-y-2">
              {fatias.map((f) => (
                <li key={f.rotulo} className="flex items-baseline justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-white">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />
                    {f.rotulo}
                  </span>
                  <span className="tabular-nums text-white">
                    {formatBRL(f.valor)} <span className="text-white/40">· {formatPercent(f.valor / (folha + custoEquip), 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Mini rotulo="Custo por dia de descarrego" valor={x.mes.dias > 0 ? formatBRL(r.custoPeriodo / x.mes.dias) : "—"} sub={`${x.mes.dias} dias`} />
              <Mini rotulo="Custo consome da receita" valor={r.receitaDescarrego > 0 ? formatPercent(r.custoPeriodo / r.receitaDescarrego) : "—"} sub="do descarrego do mês" />
            </div>
          </Bloco>
          <div className="grid min-h-0 grid-rows-2 gap-4">
            <Bloco titulo="Custo por mês">
              <SerieMeses dados={dados} valor={(y) => y.equipe.custo} fmt={semCentavos} maiorEhBom={false} altura={150} />
            </Bloco>
            <Bloco titulo="Quanto o custo consome da receita · mês a mês">
              <SerieMeses dados={dados} valor={(y) => y.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} altura={150} />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "equipe" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TabelaEquipe pessoas={c.pessoas} papeis={PAPEIS} total={folha + custoEquip} />
          <Bloco titulo="Por função">
            <ul className="space-y-4">
              {papeis.map((pp) => {
                const g = c.pessoas.filter((y) => y.papel === pp);
                const tot = g.reduce((t, y) => t + y.custo, 0);
                return (
                  <li key={pp}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-bold text-white">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PAPEL[pp].cor }} />
                        {PAPEL[pp].plural} · {g.length}
                      </span>
                      <span className="font-bold tabular-nums text-white">{formatBRL(tot)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${folha > 0 ? (tot / folha) * 100 : 0}%`, background: PAPEL[pp].cor }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-white/45">
                      <span>{formatPercent(folha > 0 ? tot / folha : 0, 0)} da folha</span>
                      <span>média {formatBRL(tot / g.length)} por pessoa</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Bloco>
        </div>
      )}

      {sub === "folha" && <SubFolha pessoas={c.pessoas} papeis={PAPEIS} />}

      {sub === "equipamentos" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <ListaEquipamentos equipamentos={c.equipamentos} padrao={c.equipamentosPadrao} grande />
          <div className="grid grid-cols-2 content-start gap-3">
            <Mini rotulo="% do custo do recebimento" valor={folha + custoEquip > 0 ? formatPercent(custoEquip / (folha + custoEquip), 0) : "—"} />
            <Mini rotulo={`Equipamentos por ${un}`} valor={carros > 0 ? formatBRL((custoEquip * (r.fracaoMes < 1 ? r.fracaoMes : 1)) / carros) : "—"} sub="custo dos equipamentos ÷ carros" />
            <Mini rotulo="Equipamentos por tonelada" valor={sel.pesoKg > 0 ? formatBRL((custoEquip * (r.fracaoMes < 1 ? r.fracaoMes : 1)) / (sel.pesoKg / 1000)) : "—"} />
            <Mini rotulo="Unidades" valor={inteiro.format(c.equipamentos.reduce((t, e) => t + e.quantidade, 0))} sub="cadastro em Custos › Equipamentos" />
          </div>
        </div>
      )}

      {sub === "porCarro" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Bloco titulo={`Custo por ${un} · dia a dia`} direita={<Dica>forte = dia mais barato · clique filtra</Dica>}>
            <Calendario mes={dados.mes} periodo={dados.periodo} porDia={porCarroDia} fmt={semCentavos} filtro={filtro} onFiltro={onFiltro} menorEhMelhor />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            {resumoDias(porCarroDia, semCentavos)}
            <Bloco titulo={`Custo por ${un} · mês a mês`}>
              <SerieMeses dados={dados} valor={(y) => (y.carros > 0 ? y.custoPeriodo / y.carros : null)} fmt={semCentavos} maiorEhBom={false} altura={170} />
            </Bloco>
          </div>
        </div>
      )}

      {sub === "porTonelada" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Bloco titulo="Custo por tonelada · dia a dia" direita={<Dica>forte = dia mais barato · clique filtra</Dica>}>
            <Calendario mes={dados.mes} periodo={dados.periodo} porDia={porTonDia} fmt={semCentavos} filtro={filtro} onFiltro={onFiltro} menorEhMelhor />
          </Bloco>
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            {resumoDias(porTonDia, semCentavos)}
            <Bloco titulo="Custo por tonelada · mês a mês">
              <SerieMeses dados={dados} valor={(y) => y.custoPorTonelada} fmt={formatBRL} maiorEhBom={false} altura={170} />
            </Bloco>
          </div>
        </div>
      )}
    </div>
  );
}





// --- DESCARREGO ---------------------------------------------------------------
