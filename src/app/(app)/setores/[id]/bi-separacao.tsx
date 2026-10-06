"use client";

/**
 * BI da Separação em tela cheia — mesma moldura e peças do BI do Recebimento.
 * Custo e equipe vêm do cadastro; Produção, Conferência e Qualidade vêm do
 * Harpia (WMS). Sem coletor, a produção é medida pela CONFERÊNCIA do mapa
 * (tudo que foi conferido foi separado). Clicar num dia do calendário filtra
 * as três visões do Harpia; Esc limpa.
 */
import { useState } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { variacaoPercentual } from "@/domain/tendencias";
import { BIShell, type HrefMes } from "./bi-shell";
import {
  Quadro, Vazio, Bloco, Mini, useSub, Dica, BarrasTV, BarraComposicao,
  TabelaEquipe, ListaEquipamentos, SubFolha, CalendarioBI, ChipTV, ddmm, semCentavos, type PapelBI,
} from "./bi-ui";
import { resumoProducao, porConferente, errosPorMilItens } from "@/domain/separacao";
import type { DadosHarpiaSeparacao } from "@/data/harpia-separacao";
import type { DadosBISeparacao } from "./separacao-dados";

type VisaoSep = "custo" | "producao" | "conferencia" | "qualidade";

const VISOES: { id: VisaoSep; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo e equipe", contexto: "quem e o que compõe o custo — pessoas por função, salários e equipamentos" },
  { id: "producao", titulo: "Produção", contexto: "o que foi separado e conferido, dia a dia · clique num dia para filtrar" },
  { id: "conferencia", titulo: "Conferência", contexto: "caixas por conferente e por hora na doca · clique num dia para filtrar" },
  { id: "qualidade", titulo: "Qualidade", contexto: "divergências pegas na conferência (bipado ≠ carga) · clique num dia para filtrar" },
];

const PAPEIS: PapelBI[] = [
  { id: "separador", rotulo: "Separador", plural: "Separadores", cor: "#5b6fd6" },
  { id: "conferente", rotulo: "Conferente", plural: "Conferentes", cor: "#8b93e0" },
  { id: "maquina", rotulo: "Operador de máquina", plural: "Operadores de máquina", cor: "#c2820a" },
  { id: "lider", rotulo: "Líder", plural: "Liderança", cor: "#10b981" },
  { id: "outros", rotulo: "Outros", plural: "Outros", cor: "#64748b" },
];

const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);

/** Custo do mês: folha (foto do mês; no corrente, o cadastro) + equipamentos de hoje. */
function custoDoMes(d: DadosBISeparacao, mes: string): number | null {
  const p = d.serie.find((x) => x.mes === mes);
  if (!p || p.folha === null) return null;
  return p.folha + d.equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
}

export function BISeparacao({ dados, hrefMes, hrefSair }: { dados: DadosBISeparacao; hrefMes: HrefMes; hrefSair: string }) {
  const [visao, setVisao] = useState<VisaoSep | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const abrir = (v: VisaoSep) => setVisao((a) => (a === v ? null : v));
  const titulo = visao ? VISOES.find((v) => v.id === visao)! : null;

  const custo = custoDoMes(dados, dados.mes);
  const i = dados.serie.findIndex((x) => x.mes === dados.mes);
  const anterior = i > 0 ? custoDoMes(dados, dados.serie[i - 1].mes) : null;
  const delta = custo !== null && anterior ? variacaoPercentual(custo, anterior) : null;
  const conta = (id: string) => dados.pessoas.filter((y) => y.papel === id).length;
  const q = (v: VisaoSep) => ({ ativo: visao === v, onClick: () => abrir(v) });
  const h = "dados" in dados.harpia ? dados.harpia.dados : null;
  const diasH = h ? h.dias.filter((d) => !dia || d.dia === dia) : [];
  const prod = resumoProducao(diasH);
  const errosRec = h ? h.erros.filter((e) => !dia || e.dia === dia) : [];
  const totErros = errosRec.reduce((t, e) => t + e.erros, 0);
  const confs = h ? porConferente(h.conferentes, dia) : [];
  const taxa = errosPorMilItens(totErros, prod.itens);
  const semH = h ? null : "sem acesso ao Harpia";

  const menu = (
    <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Quadro
        {...q("custo")}
        rotulo="Custo e equipe"
        valor={custo === null ? "—" : semCentavos(custo)}
        sub={`${dados.pessoas.length} pessoas · ${conta("separador")} sep · ${conta("conferente")} conf${delta !== null ? ` · ${delta > 0 ? "+" : ""}${formatPercent(delta, 1)} vs mês anterior` : ""}`}
      />
      <Quadro
        {...q("producao")}
        rotulo={dia ? `Produção · ${ddmm(dia)}` : "Produção"}
        valor={h ? `${prod.caixas.toLocaleString("pt-BR")} cx` : "—"}
        sub={semH ?? `${prod.unidades.toLocaleString("pt-BR")} un · ${prod.pedidos.toLocaleString("pt-BR")} pedidos · ${prod.dias} ${prod.dias === 1 ? "dia" : "dias"}`}
      />
      <Quadro
        {...q("conferencia")}
        rotulo="Conferência"
        valor={h ? `${confs.length} conferentes` : "—"}
        sub={semH ?? (prod.dias > 0 && confs.length ? `${Math.round(prod.caixas / prod.dias / confs.length).toLocaleString("pt-BR")} cx por conferente/dia` : "sem conferência no período")}
      />
      <Quadro
        {...q("qualidade")}
        rotulo="Qualidade"
        valor={h ? `${totErros.toLocaleString("pt-BR")} erros` : "—"}
        sub={semH ?? (taxa !== null ? `${taxa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} a cada 1.000 itens conferidos` : "sem itens conferidos")}
      />
    </div>
  );

  return (
    <BIShell
      titulo={`BI da ${dados.setor.charAt(0)}${dados.setor.slice(1).toLowerCase()}`}
      mes={dados.mes}
      hrefMes={hrefMes}
      hrefSair={hrefSair}
      menu={
        <>
          {menu}
          {dia && (
            <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
              <span className="font-semibold uppercase tracking-[0.16em]">Filtro</span>
              <ChipTV ativo onClick={() => setDia(null)}>
                dia {ddmm(dia)} ✕
              </ChipTV>
              <span>Esc limpa</span>
            </div>
          )}
        </>
      }
      onEsc={() => setDia(null)}
      palco={
        visao && titulo
          ? { chave: visao, titulo: titulo.titulo, contexto: titulo.contexto, conteudo:
                visao === "custo" ? (
                  <VisaoCusto dados={dados} />
                ) : !h ? (
                  <SemHarpia erro={"erro" in dados.harpia ? dados.harpia.erro : ""} />
                ) : visao === "producao" ? (
                  <VisaoProducao h={h} mes={dados.mes} dia={dia} onDia={setDia} custoMes={custo} />
                ) : visao === "conferencia" ? (
                  <VisaoConferencia h={h} mes={dados.mes} dia={dia} onDia={setDia} />
                ) : (
                  <VisaoQualidade h={h} mes={dados.mes} dia={dia} onDia={setDia} />
                ),
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
            ? "O usuário de banco do app não tem leitura nas tabelas do Harpia (esquema HARPIAW2). Peça ao DBA: grant select em PLAN_SEP_MAPA_AVERIG_1197 e PLAN_SEP_MAPA_MERC_ERRO_1199 para esse usuário."
            : "A consulta ao Oracle falhou. Confira se o banco está acessível de onde o app roda."}
        </p>
        {erro && <p className="font-mono text-xs text-white/35">{erro}</p>}
      </div>
    </Vazio>
  );
}

type SubCusto = "custo" | "equipe" | "folha" | "equipamentos";
const TITULO_SUB: Record<SubCusto, string> = { custo: "Custo do mês", equipe: "Equipe", folha: "Folha", equipamentos: "Equipamentos" };

function VisaoCusto({ dados }: { dados: DadosBISeparacao }) {
  const { sub, abrir, fechar } = useSub<SubCusto>();
  const { pessoas, equipamentos } = dados;
  if (pessoas.length === 0 && equipamentos.length === 0) return <Vazio>Nenhum funcionário ativo neste setor.</Vazio>;
  const folha = pessoas.reduce((t, y) => t + y.custo, 0);
  const custoEquip = equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  const total = folha + custoEquip;
  const custoMes = custoDoMes(dados, dados.mes);
  const presentes = PAPEIS.filter((pp) => pessoas.some((y) => y.papel === pp.id));
  const fatias = [
    ...presentes.map((pp) => ({ rotulo: pp.plural, valor: pessoas.filter((y) => y.papel === pp.id).reduce((t, y) => t + y.custo, 0), cor: pp.cor })),
    { rotulo: "Equipamentos", valor: custoEquip, cor: "#f5b301" },
  ].filter((f) => f.valor > 0);
  const card = (k: SubCusto) => ({ onClick: abrir(k), ativo: sub === k });
  const ate = dados.serie.filter((x) => x.mes <= dados.mes);
  const serieCusto = (altura: number) => (
    <BarrasTV
      altura={altura}
      fmt={semCentavos}
      itens={ate.map((x) => ({
        chave: x.mes,
        rotulo: mesCurto(x.mes) + (x.mes === dados.atual ? "*" : ""),
        valor: custoDoMes(dados, x.mes),
        cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6",
        detalhe: `${formatMesAno(x.mes)}${x.folha === null ? " (sem foto do mês)" : x.mes === dados.atual ? " (cadastro atual)" : ""}`,
      }))}
    />
  );
  const separadores = pessoas.filter((y) => y.papel === "separador");

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Mini {...card("custo")} rotulo="Custo do mês" valor={custoMes === null ? "—" : formatBRL(custoMes)} sub={custoMes === null ? "mês sem foto do efetivo" : formatMesAno(dados.mes)} />
        <Mini {...card("equipe")} rotulo="Equipe" valor={`${pessoas.length} pessoas`} sub={presentes.map((pp) => `${pessoas.filter((y) => y.papel === pp.id).length} ${pp.rotulo.toLowerCase().slice(0, 4)}.`).join(" · ")} />
        <Mini {...card("folha")} rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub="por mês, com encargos" />
        <Mini {...card("equipamentos")} rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${equipamentos.reduce((t, e) => t + e.quantidade, 0)} unidades · por mês`} />
        <Mini rotulo="Custo por pessoa" valor={pessoas.length ? formatBRL(total / pessoas.length) : "—"} sub="média, com equipamentos" />
        <Mini rotulo="Custo por separador" valor={separadores.length ? formatBRL(total / separadores.length) : "—"} sub={`${separadores.length} separadores`} />
      </div>
      <div className="flex items-center gap-3 text-xs">
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
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TabelaEquipe pessoas={pessoas} papeis={PAPEIS} total={total} />
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <ListaEquipamentos equipamentos={equipamentos} />
            <Bloco titulo="Do que é feito o custo">
              <BarraComposicao fatias={fatias} />
              <div className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/40">Custo por mês</div>
              {serieCusto(110)}
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
                    {formatBRL(f.valor)} <span className="text-white/40">· {formatPercent(f.valor / total, 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Bloco>
          <Bloco titulo="Custo por mês" direita={<Dica>folha da foto do mês + equipamentos de hoje</Dica>}>
            {serieCusto(220)}
          </Bloco>
        </div>
      )}

      {sub === "equipe" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TabelaEquipe pessoas={pessoas} papeis={PAPEIS} total={total} />
          <Bloco titulo="Por função">
            <ul className="space-y-4">
              {presentes.map((pp) => {
                const g = pessoas.filter((y) => y.papel === pp.id);
                const tot = g.reduce((t, y) => t + y.custo, 0);
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
              itens={ate.map((x) => ({ chave: x.mes, rotulo: mesCurto(x.mes), valor: x.pessoas, cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6", detalhe: formatMesAno(x.mes) }))}
            />
          </Bloco>
        </div>
      )}

      {sub === "folha" && <SubFolha pessoas={pessoas} papeis={PAPEIS} />}

      {sub === "equipamentos" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <ListaEquipamentos equipamentos={equipamentos} grande />
          <div className="grid grid-cols-2 content-start gap-3">
            <Mini rotulo="% do custo do setor" valor={total > 0 ? formatPercent(custoEquip / total, 0) : "—"} />
            <Mini rotulo="Unidades" valor={String(equipamentos.reduce((t, e) => t + e.quantidade, 0))} sub="cadastro em Custos › Equipamentos" />
          </div>
        </div>
      )}
    </div>
  );
}

// --- HARPIA -------------------------------------------------------------------

const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type PropsHarpia = { h: DadosHarpiaSeparacao; mes: string; dia: string | null; onDia: (d: string | null) => void };

/** Média de um valor por dia da semana (só dias com movimento). */
function porDiaDaSemana(itens: { dia: string; valor: number }[]) {
  const soma = Array(7).fill(0);
  const qtd = Array(7).fill(0);
  for (const it of itens) {
    if (it.valor <= 0) continue;
    const [a, m, d] = it.dia.split("-").map(Number);
    const w = new Date(a, m - 1, d).getDay();
    soma[w] += it.valor;
    qtd[w] += 1;
  }
  return SEMANA.map((rotulo, w) => ({ chave: rotulo, rotulo, valor: qtd[w] ? soma[w] / qtd[w] : null, detalhe: `${rotulo} · ${qtd[w]} dias` }));
}

function VisaoProducao({ h, mes, dia, onDia, custoMes }: PropsHarpia & { custoMes: number | null }) {
  const sel = h.dias.filter((d) => !dia || d.dia === dia);
  const r = resumoProducao(sel);
  const todos = resumoProducao(h.dias);
  // Custo do recorte: o do mês ÷ dias trabalhados, vezes os dias do recorte.
  const custo = custoMes !== null && todos.dias > 0 ? (custoMes / todos.dias) * r.dias : null;
  const porDia = new Map(h.dias.map((d) => [d.dia, d.caixas]));
  if (h.dias.length === 0) return <Vazio>Nenhuma conferência registrada no Harpia neste mês.</Vazio>;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-7">
        <Mini rotulo="Caixas" valor={n0(r.caixas)} sub={r.dias ? `${n0(r.caixas / r.dias)} por dia` : undefined} />
        <Mini rotulo="Unidades" valor={n0(r.unidades)} sub={r.caixas ? `${n1(r.unidades / r.caixas)} un por caixa` : undefined} />
        <Mini rotulo="Itens (linhas)" valor={n0(r.itens)} sub={r.pedidos ? `${n1(r.itens / r.pedidos)} por pedido` : undefined} />
        <Mini rotulo="Pedidos" valor={n0(r.pedidos)} sub={r.pedidos ? `${n1(r.caixas / r.pedidos)} cx por pedido` : undefined} />
        <Mini rotulo="Mapas" valor={n0(r.mapas)} sub={`${n0(r.clientes)} clientes`} />
        <Mini rotulo="Dias trabalhados" valor={String(r.dias)} sub={dia ? ddmm(dia) : formatMesAno(mes)} />
        <Mini rotulo="Custo por caixa" valor={custo !== null && r.caixas > 0 ? formatBRL(custo / r.caixas) : "—"} sub="custo do setor ÷ caixas" />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Bloco titulo="Caixas por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
          <CalendarioBI mes={mes} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem conferência" />
        </Bloco>
        <div className="grid min-h-0 grid-rows-2 gap-4">
          <Bloco titulo="Média de caixas por dia da semana">
            <BarrasTV altura={150} fmt={n0} itens={porDiaDaSemana(h.dias.map((d) => ({ dia: d.dia, valor: d.caixas })))} />
          </Bloco>
          <Bloco titulo="Pedidos por dia">
            <BarrasTV
              altura={150}
              fmt={n0}
              onClick={(d) => onDia(dia === d ? null : d)}
              itens={h.dias.map((d) => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), valor: d.pedidos, detalhe: ddmm(d.dia), selecionado: d.dia === dia }))}
            />
          </Bloco>
        </div>
      </div>
    </div>
  );
}

function VisaoConferencia({ h, mes, dia, onDia }: PropsHarpia) {
  const lista = porConferente(h.conferentes, dia);
  const tot = lista.reduce((t, c) => t + c.caixas, 0);
  const max = Math.max(1, ...lista.map((c) => c.caixas));
  const porDia = new Map(h.dias.map((d) => [d.dia, d.caixas]));
  // Taxa da equipe: só os dias com 1h+ de conferência de cada pessoa.
  const diasLongos = h.conferentes.filter((c) => (!dia || c.dia === dia) && c.horas >= 1);
  const horasLongas = diasLongos.reduce((t, c) => t + c.horas, 0);
  const mediaHora = horasLongas > 0 ? diasLongos.reduce((t, c) => t + c.caixas, 0) / horasLongas : null;
  if (lista.length === 0) return <Vazio>Nenhuma conferência registrada {dia ? `em ${ddmm(dia)}` : "neste mês"}.</Vazio>;
  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Bloco titulo={`Conferentes${dia ? ` · ${ddmm(dia)}` : ""}`} direita={<Dica>usuário do Harpia · horas = 1ª à última conferência do dia</Dica>}>
        <div className="h-full overflow-auto pr-1">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
              <tr>
                <th className="py-2 font-semibold">Conferente</th>
                <th className="py-2 text-right font-semibold">Caixas</th>
                <th className="py-2 text-right font-semibold">Unidades</th>
                <th className="py-2 text-right font-semibold">Pedidos</th>
                <th className="py-2 text-right font-semibold">Dias</th>
                <th className="py-2 text-right font-semibold">Horas</th>
                <th className="py-2 text-right font-semibold">Cx / hora</th>
                <th className="w-14 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.usuario} className="border-t border-white/[0.06]">
                  <td className="max-w-0 py-2">
                    <div className="truncate font-semibold text-white">Usuário {c.usuario}</div>
                    <div className="mt-1 h-1 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#5b6fd6]" style={{ width: `${(c.caixas / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{n0(c.caixas)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n0(c.unidades)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n0(c.pedidos)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{c.dias}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n1(c.horas)}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{c.caixasPorHora === null ? "—" : n0(c.caixasPorHora)}</td>
                  <td className="py-2 text-right tabular-nums text-white/50">{tot > 0 ? formatPercent(c.caixas / tot, 0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Mini rotulo="Conferentes" valor={String(lista.length)} sub={dia ? ddmm(dia) : formatMesAno(mes)} />
          <Mini rotulo="Caixas por hora (equipe)" valor={mediaHora === null ? "—" : n0(mediaHora)} sub="só dias com 1h+ de conferência" />
        </div>
        <Bloco titulo="Caixas conferidas por dia" direita={<Dica>clique filtra</Dica>}>
          <CalendarioBI mes={mes} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem conferência" />
        </Bloco>
      </div>
    </div>
  );
}

function VisaoQualidade({ h, mes, dia, onDia }: PropsHarpia) {
  const sel = h.erros.filter((e) => !dia || e.dia === dia);
  const erros = sel.reduce((t, e) => t + e.erros, 0);
  const dif = sel.reduce((t, e) => t + e.unidadesDivergentes, 0);
  const itens = resumoProducao(h.dias.filter((d) => !dia || d.dia === dia)).itens;
  const taxa = errosPorMilItens(erros, itens);
  const porDia = new Map(h.erros.map((e) => [e.dia, e.erros]));
  const maxP = Math.max(1, ...h.produtosComErro.map((p) => p.erros));
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini rotulo="Divergências" valor={n0(erros)} sub={dia ? ddmm(dia) : formatMesAno(mes)} />
        <Mini rotulo="A cada 1.000 itens conferidos" valor={taxa === null ? "—" : n1(taxa)} sub={`${n0(itens)} itens conferidos`} />
        <Mini rotulo="Unidades divergentes" valor={n0(dif)} sub="|carga − bipado| somado" />
        <Mini rotulo="Dias com divergência" valor={String(sel.filter((e) => e.erros > 0).length)} />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Bloco titulo="Divergências por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
          <CalendarioBI mes={mes} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem divergência" />
        </Bloco>
        <Bloco titulo="Produtos que mais dão divergência" direita={<Dica>no mês</Dica>}>
          {h.produtosComErro.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">Nenhuma divergência no mês.</p>
          ) : (
            <ul className="h-full space-y-2 overflow-auto pr-1">
              {h.produtosComErro.map((p) => (
                <li key={p.produto}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-white" title={p.descricao ?? undefined}>
                      <span className="text-white/45">{p.produto}</span> {p.descricao ?? ""}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-white">
                      {p.erros} <span className="font-normal text-white/45">· {n0(p.unidadesDivergentes)} un</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${(p.erros / maxP) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </div>
  );
}
