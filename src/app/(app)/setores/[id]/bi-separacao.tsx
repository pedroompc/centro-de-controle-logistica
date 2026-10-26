"use client";

/**
 * BI da Separação em tela cheia. A produção vem do Harpia (WMS): endereço
 * visitado (linha do mapa), pedidos pelas guias, separador pela página, erro com a origem que o
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
  Quadro, Vazio, Bloco, Mini, useSub, Dica, BarrasTV, BarraComposicao, TabelaEquipe, ListaEquipamentos, SubFolha, CalendarioBI, ChipTV, ddmm, semCentavos, type PapelBI,
} from "./bi-ui";
import { DUAS_COLUNAS, GRADE_CARDS, GRADE_MENU, VISAO, Tabela, n0, n1, t1, brl, pct, sinalPct, varRel } from "./bi-separacao-comum";
import { VisaoTurnos } from "./bi-separacao-turnos";
import { VisaoOperadores } from "./bi-separacao-operadores";
import { VisaoQualidade } from "./bi-separacao-analises";
import type { DadosBISeparacao, ProducaoBI, PontoHistorico } from "./separacao-dados";
import type { EnderecoVisitado } from "@/data/harpia-separacao";

type VisaoSep = "custo" | "producao" | "turnos" | "operadores" | "qualidade";

const VISOES: { id: VisaoSep; titulo: string; admin?: boolean }[] = [
  { id: "custo", titulo: "Custo e equipe" },
  { id: "producao", titulo: "Produção" },
  { id: "turnos", titulo: "Dia × Noite" },
  { id: "operadores", titulo: "Operadores", admin: true },
  { id: "qualidade", titulo: "Qualidade" },
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
    ? resumoPorTurno({ linhas: p.linhas, erros: p.erros, equipe: p.equipe, custoFolhaPeriodo: custoDoPeriodo(folha, d.fracaoMes, totMes?.dias ?? 0, !!dia), skus: p.skusTurno, dia })
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
  const { p, tot } = ind;
  const ant = anteriorDe(dados);
  const h = ind.h;
  const linhasDiaVar = h?.linhas && h.dias && ant?.linhas && ant.dias ? varRel(h.linhas / h.dias, ant.linhas / ant.dias) : null;
  const deltaCusto = h?.custo != null && ant?.custo ? variacaoPercentual(h.custo, ant.custo) : null;
  const rk = rankingTurnos(ind.turnos);
  const cobertura = tot && tot.linhas > 0 ? tot.linhasComSeparador / tot.linhas : null;
  const semProd = p ? null : "sem acesso ao Harpia";

  const menu = (
    <div className={`mt-4 ${GRADE_MENU}`}>
      <Quadro
        {...q("custo")}
        rotulo={dia ? `Custo e equipe · ${ddmm(dia)}` : "Custo e equipe"}
        valor={ind.custo === null ? "—" : semCentavos(ind.custo)}
        sub={`${ind.sobreFat !== null ? `${formatPercent(ind.sobreFat, 2)} do fat. líquido · ` : ""}${dados.pessoas.length} pessoas · ${dados.pessoas.filter((y) => y.papel === "lider").length} líder(es)${deltaCusto !== null ? ` · ${sinalPct(deltaCusto)} vs mês anterior` : ""}`}
      />
      <Quadro
        {...q("producao")}
        rotulo={dia ? `Produção · ${ddmm(dia)}` : "Produção"}
        valor={tot ? n0(tot.linhas) : "—"}
        sub={semProd ?? `endereços · ${n0(tot!.pedidos)} pedidos · ${t1(tot!.kg)}${!dia && linhasDiaVar !== null ? ` · ${sinalPct(linhasDiaVar)}/dia` : ""}`}
      />
      <Quadro
        {...q("turnos")}
        rotulo={dia ? `Dia × Noite · ${ddmm(dia)}` : "Dia × Noite"}
        valor={tot ? `${n0(ind.turnos.reduce((x, t) => x + Math.round(t.kg), 0))} kg` : "—"}
        sub={semProd ?? ind.turnos.map((t) => `${t.rotulo} ${n0(t.kg)} kg`).join(" + ")}
      />
      {dados.admin && dados.individual && (
        <Quadro {...q("operadores")} rotulo="Operadores" valor={`${dados.individual.separadores.length} separadores`} sub={`${pct(cobertura, 0)} dos endereços com registro`} />
      )}
      <Quadro
        {...q("qualidade")}
        rotulo={dia ? `Qualidade · ${ddmm(dia)}` : "Qualidade"}
        valor={ind.taxaErro === null ? "—" : `${n1(ind.taxaErro)} ‰`}
        sub={semProd ?? `${n0(ind.erros!.separador.itens)} itens com erro`}
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
                  <VisaoTurnos p={p} turnos={ind.turnos} ranking={rk} dia={dia} onDia={setDia} divergencias={dados.divergenciasTurno} />
                ) : visao === "operadores" && dados.individual ? (
                  <VisaoOperadores ind={dados.individual} mes={dados.mes} />
                ) : visao === "qualidade" ? (
                  <VisaoQualidade p={p} mes={dados.mes} dia={dia} onDia={setDia} linhas={tot?.linhas ?? 0} turnos={ind.turnos} />
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

// --- CUSTO E EQUIPE (mesmo modelo dos BIs do Abastecimento e do Recebimento) ---

type SubCusto = "custo" | "equipe" | "folha" | "equipamentos" | "linha" | "fat";
const TITULO_SUB: Record<SubCusto, string> = {
  custo: "Custo do mês", equipe: "Equipe", folha: "Folha", equipamentos: "Equipamentos", linha: "Custo por endereço", fat: "Custo ÷ faturamento líquido",
};

type MedidaCusto = "custo" | "fat" | "linha" | "tonelada";
const MEDIDA_CUSTO: Record<MedidaCusto, { rotulo: string; valor: (x: PontoHistorico) => number | null; fmt: (v: number) => string }> = {
  custo: { rotulo: "Custo", valor: (x) => x.custo, fmt: semCentavos },
  fat: { rotulo: "% do faturamento", valor: (x) => custoSobreFaturamento(x.custoPeriodo, x.faturamentoLiquido), fmt: (v) => formatPercent(v, 2) },
  linha: { rotulo: "R$ por endereço", valor: (x) => (x.custoPeriodo !== null && x.linhas ? x.custoPeriodo / x.linhas : null), fmt: (v) => formatBRL(v) },
  tonelada: { rotulo: "R$ por tonelada", valor: (x) => (x.custoPeriodo !== null && x.kg ? x.custoPeriodo / (x.kg / 1000) : null), fmt: semCentavos },
};

function VisaoCusto({ dados, dia }: { dados: DadosBISeparacao; dia: string | null }) {
  const { sub, abrir, fechar } = useSub<SubCusto>();
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
  const hist = dados.historico.filter((x) => x.mes <= dados.mes);
  const serie = (m: MedidaCusto, altura: number) => (
    <BarrasTV
      altura={altura}
      fmt={MEDIDA_CUSTO[m].fmt}
      itens={hist.map((x) => ({
        chave: x.mes,
        rotulo: mesCurto(x.mes) + (x.mes === dados.atual ? "*" : ""),
        valor: MEDIDA_CUSTO[m].valor(x),
        cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6",
        detalhe: `${formatMesAno(x.mes)}${x.custo === null ? " (sem foto do mês)" : x.mes === dados.atual ? " (cadastro atual)" : ""}`,
      }))}
    />
  );
  const t = ind.tot;

  return (
    <div className={`${VISAO} xl:grid-rows-[auto_auto_minmax(20rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini {...card("custo")} rotulo={dia ? `Custo do dia ${ddmm(dia)}` : "Custo do mês"} valor={brl(ind.custo)} sub={ind.h?.custo == null ? "mês sem foto do efetivo" : dia ? "custo do mês ÷ dias com separação" : dados.fracaoMes < 1 ? "proporcional aos dias corridos" : formatMesAno(dados.mes)} />
        <Mini {...card("equipe")} rotulo="Equipe" valor={`${pessoas.length} pessoas`} sub={presentes.map((pp) => `${pessoas.filter((y) => y.papel === pp.id).length} ${pp.rotulo.toLowerCase().slice(0, 4)}.`).join(" · ")} />
        <Mini {...card("folha")} rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub="por mês, com encargos" />
        <Mini {...card("equipamentos")} rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${equipamentos.reduce((s, e) => s + e.quantidade, 0)} unidades · por mês`} />
        <Mini {...card("linha")} rotulo="Custo por endereço" valor={brl(ind.unit.porLinha)} sub={t ? `${n0(t.linhas)} endereços` : undefined} />
        <Mini
          {...card("fat")}
          rotulo="Custo ÷ faturamento líquido"
          valor={ind.sobreFat === null ? "—" : formatPercent(ind.sobreFat, 2)}
          sub={dados.faturamentoLiquido === null ? "faturamento indisponível" : `fat. líquido ${semCentavos(dados.faturamentoLiquido)}${dados.fracaoMes < 1 ? " · custo proporcional ao mês corrido" : ""}`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {sub ? (
          <>
            <button type="button" onClick={fechar} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
              ◂ Voltar ao resumo
            </button>
            <span className="font-bold uppercase tracking-[0.16em] text-amber-300">Custo e equipe › {TITULO_SUB[sub]}</span>
          </>
        ) : (
          <span className="text-white/35">Clique num card para abrir o detalhe dele</span>
        )}
      </div>

      {sub === null && (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`}>
          <TabelaEquipe pessoas={pessoas} papeis={PAPEIS} total={total} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]">
            <ListaEquipamentos equipamentos={equipamentos} />
            <Bloco titulo="Do que é feito o custo">
              <BarraComposicao fatias={fatias} />
              <div className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Custo por mês</div>
              {serie("custo", 110)}
            </Bloco>
          </div>
        </div>
      )}

      {sub === "custo" && (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
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
          <Bloco titulo="Custo por mês" direita={<Dica>folha da foto do mês + equipamentos de hoje</Dica>}>
            {serie("custo", 220)}
          </Bloco>
        </div>
      )}

      {sub === "equipe" && (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`}>
          <TabelaEquipe pessoas={pessoas} papeis={PAPEIS} total={total} />
          <Bloco titulo="Por função">
            <ul className="space-y-4">
              {presentes.map((pp) => {
                const g = pessoas.filter((y) => y.papel === pp.id);
                const tot = g.reduce((s, y) => s + y.custo, 0);
                return (
                  <li key={pp.id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-bold text-white">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: pp.cor }} />
                        {pp.plural} · {g.length}
                      </span>
                      <span className="font-bold tabular-nums text-white">{formatBRL(tot)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${folha > 0 ? (tot / folha) * 100 : 0}%`, background: pp.cor }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-white/45">
                      <span>{formatPercent(folha > 0 ? tot / folha : 0, 0)} da folha</span>
                      <span>média {formatBRL(tot / g.length)} por pessoa</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Pessoas por mês</div>
            <BarrasTV
              altura={110}
              fmt={(v) => String(v)}
              itens={dados.serie.filter((x) => x.mes <= dados.mes).map((x) => ({ chave: x.mes, rotulo: mesCurto(x.mes), valor: x.pessoas, cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6", detalhe: formatMesAno(x.mes) }))}
            />
          </Bloco>
        </div>
      )}

      {sub === "folha" && <SubFolha pessoas={pessoas} papeis={PAPEIS} />}

      {sub === "equipamentos" && (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]`}>
          <ListaEquipamentos equipamentos={equipamentos} grande />
          <div className="grid grid-cols-2 content-start gap-3">
            <Mini rotulo="% do custo do setor" valor={total > 0 ? formatPercent(custoEquip / total, 0) : "—"} />
            <Mini rotulo="Unidades" valor={String(equipamentos.reduce((s, e) => s + e.quantidade, 0))} sub="cadastro em Custos › Equipamentos" />
          </div>
        </div>
      )}

      {sub === "linha" && (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
          <div className="grid grid-cols-2 content-start gap-3">
            <Mini rotulo="Custo por endereço" valor={brl(ind.unit.porLinha)} sub={t ? `${n0(t.linhas)} endereços` : undefined} />
            <Mini rotulo="Custo por pedido" valor={brl(ind.unit.porPedido)} sub={t ? `${n0(t.pedidos)} pedidos` : undefined} />
            <Mini rotulo="Custo por tonelada" valor={ind.unit.porTonelada === null ? "—" : semCentavos(ind.unit.porTonelada)} sub={t ? t1(t.kg) : undefined} />
            <Mini rotulo="Custo por pessoa" valor={pessoas.length ? formatBRL(total / pessoas.length) : "—"} sub="média, com equipamentos" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0 xl:grid-rows-2">
            <Bloco titulo="Custo por endereço · mês a mês">{serie("linha", 140)}</Bloco>
            <Bloco titulo="Custo por tonelada · mês a mês">{serie("tonelada", 140)}</Bloco>
          </div>
        </div>
      )}

      {sub === "fat" && (
        <Bloco titulo="Custo ÷ faturamento líquido · mês a mês" direita={<Dica>faturamento líquido da rotina 111 · mês corrente proporcional</Dica>}>
          {serie("fat", 240)}
        </Bloco>
      )}
    </div>
  );
}
// --- PRODUÇÃO -----------------------------------------------------------------

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
type MedidaProd = "linhas" | "pedidos" | "kg";
const ROT_PROD: Record<MedidaProd, string> = { linhas: "Endereços", pedidos: "Pedidos", kg: "Toneladas" };

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
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(28rem,1fr)_auto]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Endereços" valor={n0(r.linhas)} sub={r.dias ? `${n0(r.linhas / r.dias)}/dia` : undefined} />
        <Mini rotulo="Pedidos" valor={n0(r.pedidos)} sub={r.pedidos ? `${n1(r.linhas / r.pedidos)} endereços/pedido` : undefined} />
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
          <Bloco titulo="Endereços por dia · mês a mês">
            <BarrasTV
              altura={140}
              fmt={n0}
              itens={hist.map((x) => ({
                chave: x.mes,
                rotulo: mesCurto(x.mes) + (x.parcial ? "*" : ""),
                valor: x.dias ? x.linhas! / x.dias : null,
                cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6",
                detalhe: `${formatMesAno(x.mes)} · ${x.dias} dias · ${n0(x.linhas!)} endereços`,
              }))}
            />
          </Bloco>
        </div>
      </div>
      <div className={`${DUAS_COLUNAS} xl:grid-cols-2`}>
        <Bloco titulo="Endereços mais visitados · mês" direita={<Dica>{n0(p.enderecos.total)} endereços</Dica>}>
          <TabelaEnderecos itens={p.enderecos.mais} />
        </Bloco>
        <Bloco titulo="Endereços menos visitados · mês" direita={<Dica>{n0(p.enderecos.umaVisita)} com 1 visita</Dica>}>
          <TabelaEnderecos itens={p.enderecos.menos} />
        </Bloco>
      </div>
    </div>
  );
}

function TabelaEnderecos({ itens }: { itens: EnderecoVisitado[] }) {
  if (!itens.length) return <p className="py-4 text-center text-sm text-white/40">Sem endereço no mês.</p>;
  return (
    <Tabela
      cab={["Endereço", "Produto", "Visitas", "Caixas", "Unidades"]}
      alinhar={["l", "l", "r", "r", "r"]}
      linhas={itens.map((x) => [
        x.endereco,
        <span key="p" className="block max-w-[18rem] truncate" title={x.descricao ?? undefined}>
          <span className="text-white/45">{x.produto}</span> {x.descricao ?? ""}
        </span>,
        n0(x.visitas),
        n0(x.caixas),
        n0(x.unidades),
      ])}
    />
  );
}

