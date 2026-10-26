"use client";

/**
 * BI da Separação em tela cheia. A produção vem do Harpia (WMS): linha física
 * do mapa, pedidos pelas guias, separador pela página, erro com a origem que o
 * próprio Harpia grava. O dia é o OPERACIONAL (vira às 07h). Fórmulas e
 * consultas de validação: docs/bi-separacao/indicadores.md. Clicar num dia
 * filtra Produção, Turnos, Qualidade e o custo; Esc limpa.
 */
import { useState } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { variacaoPercentual } from "@/domain/tendencias";
import {
  totaisProducao, custoDoPeriodo, custosUnitarios, custoSobreFaturamento, resumoErros, porMilLinhas, resumoPorTurno, rankingTurnos,
} from "@/domain/separacao";
import { BIShell, type HrefMes } from "./bi-shell";
import {
  Quadro, Vazio, Bloco, Mini, useSub, BarrasTV, BarraComposicao, TabelaEquipe, ListaEquipamentos, SubFolha, CalendarioBI, ChipTV, ddmm, semCentavos, type PapelBI,
} from "./bi-ui";
import { DUAS_COLUNAS, GRADE_CARDS, GRADE_MENU, VISAO, n0, n1, t1, brl, pct, sinalPct, varRel } from "./bi-separacao-comum";
import { VisaoTurnos } from "./bi-separacao-turnos";
import { VisaoOperadores } from "./bi-separacao-operadores";
import { VisaoQualidade, VisaoAuditoria } from "./bi-separacao-analises";
import type { DadosBISeparacao, ProducaoBI, PontoHistorico } from "./separacao-dados";

type VisaoSep = "custo" | "producao" | "turnos" | "operadores" | "qualidade" | "auditoria";

const VISOES: { id: VisaoSep; titulo: string; admin?: boolean }[] = [
  { id: "custo", titulo: "Custo e financeiro" },
  { id: "producao", titulo: "Produção" },
  { id: "turnos", titulo: "Turnos" },
  { id: "operadores", titulo: "Operadores", admin: true },
  { id: "qualidade", titulo: "Qualidade" },
  { id: "auditoria", titulo: "Auditoria dos dados" },
];

const PAPEIS: PapelBI[] = [
  { id: "separador", rotulo: "Separador", plural: "Separadores", cor: "#5b6fd6" },
  { id: "conferente", rotulo: "Conferente", plural: "Conferentes", cor: "#8b93e0" },
  { id: "maquina", rotulo: "Operador de máquina", plural: "Operadores de máquina", cor: "#c2820a" },
  { id: "lider", rotulo: "Líder", plural: "Liderança", cor: "#a78bfa" },
  { id: "outros", rotulo: "Outros", plural: "Outros", cor: "#64748b" },
];

const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);
const temProd = (p: DadosBISeparacao["producao"]): p is ProducaoBI => "linhas" in p;

/** Indicadores do recorte (mês ou 1 dia) — a MESMA conta alimenta cards, tabelas e gráficos. */
function indicadores(d: DadosBISeparacao, dia: string | null) {
  const p = temProd(d.producao) ? d.producao : null;
  const h = d.historico.find((x) => x.mes === d.mes) ?? null;
  const totMes = p ? totaisProducao(p.linhas, p.dias) : null;
  const tot = p ? totaisProducao(p.linhas, p.dias, dia) : null;
  const custo = custoDoPeriodo(h?.custo ?? null, d.fracaoMes, totMes?.dias ?? 0, !!dia);
  const unit = tot ? custosUnitarios(custo, tot) : custosUnitarios(null, { pedidos: 0, linhas: 0, kg: 0, caixas: 0 });
  const sobreFat = custoSobreFaturamento(h?.custoPeriodo ?? null, d.faturamentoLiquido);
  const erros = p ? resumoErros(p.erros, dia) : null;
  const folha = d.serie.find((x) => x.mes === d.mes)?.folha ?? null;
  const turnos = p
    ? resumoPorTurno({ linhas: p.linhas, erros: p.erros, equipe: p.equipe, custoFolhaPeriodo: custoDoPeriodo(folha, d.fracaoMes, totMes?.dias ?? 0, !!dia), dia })
    : [];
  return { p, h, tot, totMes, custo, unit, sobreFat, erros, turnos, taxaErro: erros && tot ? porMilLinhas(erros.separador.itens, tot.linhas) : null };
}

/** Mês anterior com dado de produção (para comparar taxas por dia, não totais de mês incompleto). */
function anteriorDe(d: DadosBISeparacao): PontoHistorico | null {
  const i = d.historico.findIndex((x) => x.mes === d.mes);
  return i > 0 ? d.historico[i - 1] : null;
}

export function BISeparacao({ dados, hrefMes, hrefSair }: { dados: DadosBISeparacao; hrefMes: HrefMes; hrefSair: string }) {
  const [visao, setVisao] = useState<VisaoSep | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const abrir = (v: VisaoSep) => setVisao((a) => (a === v ? null : v));
  const visoes = VISOES.filter((v) => !v.admin || (dados.admin && dados.individual));
  const titulo = visao ? visoes.find((v) => v.id === visao) ?? null : null;
  const q = (v: VisaoSep) => ({ ativo: visao === v, onClick: () => abrir(v) });

  const ind = indicadores(dados, dia);
  const { p, tot, unit } = ind;
  const ant = anteriorDe(dados);
  const h = ind.h;
  const linhasDiaVar = h?.linhas && h.dias && ant?.linhas && ant.dias ? varRel(h.linhas / h.dias, ant.linhas / ant.dias) : null;
  const custoLinhaAnt = ant?.custoPeriodo && ant.linhas ? ant.custoPeriodo / ant.linhas : null;
  const custoLinhaMes = h?.custoPeriodo && h.linhas ? h.custoPeriodo / h.linhas : null;
  const rk = rankingTurnos(ind.turnos);
  const melhorHora = rk.linhasPorHora ? ind.turnos.find((t) => t.turno === rk.linhasPorHora)! : null;
  const cobertura = tot && tot.linhas > 0 ? tot.linhasComSeparador / tot.linhas : null;
  const a = dados.auditoria;
  const pedW = a ? a.confronto.reduce((s, x) => s + x.pedidosWinthor, 0) : 0;
  const pedH = a ? a.confronto.reduce((s, x) => s + x.pedidosHarpia, 0) : 0;
  const semProd = p ? null : "sem acesso ao Harpia";

  const menu = (
    <div className={`mt-4 ${GRADE_MENU}`}>
      <Quadro
        {...q("custo")}
        rotulo={dia ? `Custo · ${ddmm(dia)}` : "Custo"}
        valor={ind.custo === null ? "—" : semCentavos(ind.custo)}
        sub={`${ind.sobreFat === null ? "—" : `${formatPercent(ind.sobreFat, 2)} do fat.`} · ${unit.porLinha === null ? "—" : formatBRL(unit.porLinha)}/linha${!dia && custoLinhaMes && custoLinhaAnt ? ` (${sinalPct(varRel(custoLinhaMes, custoLinhaAnt))})` : ""}`}
      />
      <Quadro
        {...q("producao")}
        rotulo={dia ? `Produção · ${ddmm(dia)}` : "Produção"}
        valor={tot ? `${n0(tot.linhas)} linhas` : "—"}
        sub={semProd ?? `${n0(tot!.pedidos)} pedidos · ${t1(tot!.kg)}${!dia && linhasDiaVar !== null ? ` · ${sinalPct(linhasDiaVar)}/dia` : ""}`}
      />
      <Quadro
        {...q("turnos")}
        rotulo="Turnos"
        valor={melhorHora ? `${melhorHora.rotulo} · ${n1(melhorHora.linhasPorHora!)}` : "—"}
        sub={semProd ?? (melhorHora ? "linhas/hora" : "sem comparação")}
      />
      {dados.admin && dados.individual && (
        <Quadro {...q("operadores")} rotulo="Operadores" valor={`${dados.individual.separadores.length} separadores`} sub={`${pct(cobertura, 0)} das linhas com registro`} />
      )}
      <Quadro
        {...q("qualidade")}
        rotulo={dia ? `Qualidade · ${ddmm(dia)}` : "Qualidade"}
        valor={ind.taxaErro === null ? "—" : `${n1(ind.taxaErro)} ‰`}
        sub={semProd ?? `${n0(ind.erros!.separador.itens)} itens com erro`}
      />
      <Quadro
        {...q("auditoria")}
        rotulo="Auditoria"
        valor={pedW > 0 ? `${sinalPct(varRel(pedH, pedW))} pedidos` : "—"}
        sub={a ? "Harpia × Winthor" : (semProd ?? "")}
      />
    </div>
  );

  return (
    <BIShell
      titulo={`BI da ${dados.setor.charAt(0)}${dados.setor.slice(1).toLowerCase()}`}
      mes={dados.mes}
      hrefMes={hrefMes}
      hrefSair={hrefSair}
      dicaTopo=""
      menu={
        <>
          {menu}
          {dia && (
            <div className="mt-2">
              <ChipTV ativo onClick={() => setDia(null)}>
                dia {ddmm(dia)} ✕
              </ChipTV>
            </div>
          )}
        </>
      }
      onEsc={() => setDia(null)}
      palco={
        visao && titulo
          ? {
              chave: visao,
              titulo: titulo.titulo,
              conteudo:
                visao === "custo" ? (
                  <VisaoCusto dados={dados} dia={dia} />
                ) : !p ? (
                  <SemHarpia erro={"erro" in dados.producao ? dados.producao.erro : ""} />
                ) : visao === "producao" ? (
                  <VisaoProducao dados={dados} p={p} dia={dia} onDia={setDia} />
                ) : visao === "turnos" ? (
                  <VisaoTurnos turnos={ind.turnos} ranking={rk} dia={dia} auditoria={dados.auditoria} />
                ) : visao === "operadores" && dados.individual ? (
                  <VisaoOperadores ind={dados.individual} mes={dados.mes} />
                ) : visao === "qualidade" ? (
                  <VisaoQualidade p={p} mes={dados.mes} dia={dia} onDia={setDia} linhas={tot?.linhas ?? 0} turnos={ind.turnos} />
                ) : dados.auditoria ? (
                  <VisaoAuditoria a={dados.auditoria} tot={ind.totMes!} totalMes={p.totalMes} />
                ) : null,
            }
          : null
      }
    />
  );
}

function SemHarpia({ erro }: { erro: string }) {
  const permissao = /ORA-00942|ORA-01031|insufficient|does not exist/i.test(erro);
  return (
    <Vazio>
      <div className="max-w-2xl space-y-3">
        <p className="text-xl font-semibold text-white/70">Não consegui ler o Harpia</p>
        <p className="text-base text-white/50">
          {permissao
            ? "O usuário de banco do app não tem leitura nas tabelas do Harpia (esquema HARPIAW2): PLAN_SEP_MAPA_AVERIG_1197, _MERC_1196, _PAGINA_OS_1236, _GUIAS_1198, _1195 e _MERC_ERRO_1199."
            : "A consulta ao Oracle falhou. Confira se o banco está acessível de onde o app roda."}
        </p>
        {erro && <p className="font-mono text-xs text-white/35">{erro}</p>}
      </div>
    </Vazio>
  );
}

// --- CUSTO E FINANCEIRO -------------------------------------------------------

type SubCusto = "equipe" | "folha" | "equipamentos";
type MedidaCusto = "custo" | "fat" | "linha" | "tonelada";
const MEDIDA_CUSTO: Record<MedidaCusto, { rotulo: string; valor: (x: PontoHistorico) => number | null; fmt: (v: number) => string }> = {
  custo: { rotulo: "Custo", valor: (x) => x.custo, fmt: semCentavos },
  fat: { rotulo: "% do faturamento", valor: (x) => custoSobreFaturamento(x.custoPeriodo, x.faturamentoLiquido), fmt: (v) => formatPercent(v, 2) },
  linha: { rotulo: "R$ por linha", valor: (x) => (x.custoPeriodo !== null && x.linhas ? x.custoPeriodo / x.linhas : null), fmt: (v) => formatBRL(v) },
  tonelada: { rotulo: "R$ por tonelada", valor: (x) => (x.custoPeriodo !== null && x.kg ? x.custoPeriodo / (x.kg / 1000) : null), fmt: semCentavos },
};

function VisaoCusto({ dados, dia }: { dados: DadosBISeparacao; dia: string | null }) {
  const { sub, abrir, fechar } = useSub<SubCusto>();
  const [medida, setMedida] = useState<MedidaCusto>("fat");
  const { pessoas, equipamentos } = dados;
  const ind = indicadores(dados, dia);
  if (pessoas.length === 0 && equipamentos.length === 0) return <Vazio>Nenhum funcionário ativo neste setor.</Vazio>;
  const folha = pessoas.reduce((t, y) => t + y.custo, 0);
  const custoEquip = equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const total = folha + custoEquip;
  const presentes = PAPEIS.filter((pp) => pessoas.some((y) => y.papel === pp.id));
  const fatias = [
    ...presentes.map((pp) => ({ rotulo: pp.plural, valor: pessoas.filter((y) => y.papel === pp.id).reduce((t, y) => t + y.custo, 0), cor: pp.cor })),
    { rotulo: "Equipamentos", valor: custoEquip, cor: "#f5b301" },
  ].filter((f) => f.valor > 0);
  const card = (k: SubCusto) => ({ onClick: abrir(k), ativo: sub === k });
  const m = MEDIDA_CUSTO[medida];
  const hist = dados.historico;
  const ant = anteriorDe(dados);
  const deltaCusto = ind.h?.custo != null && ant?.custo ? variacaoPercentual(ind.h.custo, ant.custo) : null;
  const t = ind.tot;

  return (
    <div className={`${VISAO} xl:grid-rows-[auto_auto_minmax(20rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini
          rotulo={dia ? `Custo ${ddmm(dia)}` : "Custo"}
          valor={brl(ind.custo)}
          sub={ind.h?.custo == null ? "sem foto do efetivo" : dados.fracaoMes < 1 && !dia ? `${formatPercent(dados.fracaoMes, 0)} de ${semCentavos(ind.h.custo)}` : dia ? undefined : deltaCusto !== null ? `${sinalPct(deltaCusto)} vs anterior` : undefined}
        />
        <Mini rotulo="% do faturamento" valor={ind.sobreFat === null ? "—" : formatPercent(ind.sobreFat, 2)} sub={dados.faturamentoLiquido === null ? "sem faturamento" : `fat. ${semCentavos(dados.faturamentoLiquido)}`} />
        <Mini rotulo="Custo/linha" valor={brl(ind.unit.porLinha)} sub={t ? `${n0(t.linhas)} linhas` : undefined} />
        <Mini rotulo="Custo/pedido" valor={brl(ind.unit.porPedido)} sub={t ? `${n0(t.pedidos)} pedidos` : undefined} />
        <Mini rotulo="Custo/tonelada" valor={ind.unit.porTonelada === null ? "—" : semCentavos(ind.unit.porTonelada)} sub={t ? t1(t.kg) : undefined} />
        <Mini rotulo="Custo/pessoa" valor={pessoas.length ? formatBRL(total / pessoas.length) : "—"} />
      </div>
      <div className={`${GRADE_CARDS} items-center text-xs`}>
        <Mini rotulo="Equipe" valor={`${pessoas.length} pessoas`} {...card("equipe")} sub={presentes.map((pp) => `${pessoas.filter((y) => y.papel === pp.id).length} ${pp.rotulo.toLowerCase().slice(0, 4)}.`).join(" · ")} />
        <Mini rotulo="Folha" valor={formatBRL(folha)} {...card("folha")} />
        <Mini rotulo="Equipamentos" valor={formatBRL(custoEquip)} {...card("equipamentos")} sub={`${equipamentos.reduce((s, e) => s + e.quantidade, 0)} unidades`} />
        {sub && (
          <button type="button" onClick={fechar} className="justify-self-start rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
            ◂ Voltar
          </button>
        )}
      </div>

      {sub === null && (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]`}>
          <Bloco
            titulo={`${m.rotulo} · mês a mês`}
            direita={
              <div className="flex flex-wrap justify-end gap-1.5">
                {(Object.keys(MEDIDA_CUSTO) as MedidaCusto[]).map((k) => (
                  <ChipTV key={k} ativo={medida === k} onClick={() => setMedida(k)}>
                    {MEDIDA_CUSTO[k].rotulo}
                  </ChipTV>
                ))}
              </div>
            }
          >
            <BarrasTV
              altura={220}
              fmt={m.fmt}
              itens={hist.map((x) => ({
                chave: x.mes,
                rotulo: mesCurto(x.mes) + (x.parcial ? "*" : ""),
                valor: m.valor(x),
                cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6",
                detalhe: `${formatMesAno(x.mes)}${x.custo === null ? " (sem foto do efetivo)" : ""}${x.parcial ? " · em andamento (proporcional)" : ""}${medida === "fat" && x.faturamentoLiquido === null ? " · sem faturamento" : ""}`,
              }))}
            />
          </Bloco>
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
                    {formatBRL(f.valor)} <span className="text-white/40">· {formatPercent(f.valor / total, 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
        </div>
      )}
      {sub === "equipe" && <TabelaEquipe pessoas={pessoas} papeis={PAPEIS} total={total} />}
      {sub === "folha" && <SubFolha pessoas={pessoas} papeis={PAPEIS} />}
      {sub === "equipamentos" && <ListaEquipamentos equipamentos={equipamentos} grande />}
    </div>
  );
}

// --- PRODUÇÃO -----------------------------------------------------------------

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
type MedidaProd = "linhas" | "pedidos" | "kg";
const ROT_PROD: Record<MedidaProd, string> = { linhas: "Linhas", pedidos: "Pedidos", kg: "Toneladas" };

function VisaoProducao({ dados, p, dia, onDia }: { dados: DadosBISeparacao; p: ProducaoBI; dia: string | null; onDia: (d: string | null) => void }) {
  const [medida, setMedida] = useState<MedidaProd>("linhas");
  const r = totaisProducao(p.linhas, p.dias, dia);
  if (p.dias.length === 0) return <Vazio>Nenhum mapa conferido neste mês.</Vazio>;
  const porDia = new Map<string, { linhas: number; kg: number; pedidos: number }>();
  for (const l of p.linhas) {
    const x = porDia.get(l.dia) ?? { linhas: 0, kg: 0, pedidos: 0 };
    x.linhas += l.linhas;
    x.kg += l.kg;
    porDia.set(l.dia, x);
  }
  for (const d of p.dias) {
    const x = porDia.get(d.dia) ?? { linhas: 0, kg: 0, pedidos: 0 };
    x.pedidos = d.pedidos;
    porDia.set(d.dia, x);
  }
  const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
  const valorDe = (x: { linhas: number; kg: number; pedidos: number }) => (medida === "kg" ? x.kg / 1000 : x[medida]);
  const fmtM = medida === "kg" ? (v: number) => `${n1(v)} t` : n0;
  // Dia da semana pelo dia OPERACIONAL: a noite de sexta fica na sexta.
  const soma = Array(7).fill(0);
  const qtd = Array(7).fill(0);
  for (const [d, x] of dias) {
    const [a, m, dd] = d.split("-").map(Number);
    const w = new Date(a, m - 1, dd).getDay();
    soma[w] += valorDe(x);
    qtd[w] += 1;
  }
  const hist = dados.historico.filter((x) => x.linhas !== null);
  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(28rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Linhas" valor={n0(r.linhas)} sub={r.dias ? `${n0(r.linhas / r.dias)}/dia` : undefined} />
        <Mini rotulo="Pedidos" valor={n0(r.pedidos)} sub={r.pedidos ? `${n1(r.linhas / r.pedidos)} linhas/pedido` : undefined} />
        <Mini rotulo="Peso" valor={t1(r.kg)} sub={r.pedidos ? `${n0(r.kg / r.pedidos)} kg/pedido` : undefined} />
        <Mini rotulo="Caixas" valor={n0(r.caixas)} />
        <Mini rotulo="Unidades" valor={n0(r.unidades)} />
        <Mini rotulo="Cargas" valor={n0(r.cargas)} />
        <Mini rotulo="Clientes" valor={dia ? n0(r.clientesDia) : n0(p.totalMes.clientes)} sub={dia ? undefined : `${n0(r.clientesDia)} PDV-dia`} />
        <Mini rotulo="SKUs" valor={dia ? "—" : n0(p.totalMes.skus)} />
      </div>
      <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}>
        <Bloco
          className="min-h-[22rem] xl:min-h-0"
          titulo={`${ROT_PROD[medida]} por dia`}
          direita={
            <div className="flex flex-wrap justify-end gap-1.5">
              {(Object.keys(ROT_PROD) as MedidaProd[]).map((k) => (
                <ChipTV key={k} ativo={medida === k} onClick={() => setMedida(k)}>
                  {ROT_PROD[k]}
                </ChipTV>
              ))}
            </div>
          }
        >
          <CalendarioBI mes={dados.mes} porDia={new Map(dias.map(([d, x]) => [d, valorDe(x)]))} fmt={fmtM} selecionado={dia} onSelecionar={onDia} vazio="sem mapa" />
        </Bloco>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0 xl:grid-rows-2">
          <Bloco titulo={`Média por dia da semana · ${ROT_PROD[medida].toLowerCase()}`}>
            <BarrasTV altura={140} fmt={fmtM} itens={SEMANA.map((rot, w) => ({ chave: rot, rotulo: rot, valor: qtd[w] ? soma[w] / qtd[w] : null, detalhe: `${rot} · ${qtd[w]} dias` }))} />
          </Bloco>
          <Bloco titulo="Linhas por dia · mês a mês">
            <BarrasTV
              altura={140}
              fmt={n0}
              itens={hist.map((x) => ({
                chave: x.mes,
                rotulo: mesCurto(x.mes) + (x.parcial ? "*" : ""),
                valor: x.dias ? x.linhas! / x.dias : null,
                cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6",
                detalhe: `${formatMesAno(x.mes)} · ${x.dias} dias · ${n0(x.linhas!)} linhas`,
              }))}
            />
          </Bloco>
        </div>
      </div>
    </div>
  );
}

