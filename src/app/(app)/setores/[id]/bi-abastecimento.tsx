"use client";

/**
 * BI do Abastecimento em tela cheia — mesma moldura e peças do BI da
 * Separação. Custo e equipe vêm do cadastro. O resto vem do Harpia (WMS), de
 * DUAS fontes diferentes:
 *  - Volume/Antecedência/Giro: `PREPARA_ABAST_*` — o FATURAMENTO preparando
 *    carga/guia pra separação. Quem gera ali NÃO é quem executa no piso, por
 *    isso essa parte nunca rankeia por usuário.
 *  - Movimentação: `MOVIMENT_END_502` (reserva → picking) — a equipe REAL de
 *    piso (depto Logística). Aqui sim o ranking por pessoa é legítimo.
 * `dia` é um filtro CRUZADO: clicar num dia em Volume, Antecedência ou
 * Movimentação filtra as três. Esc limpa. Pessoa (Movimentação) e produto
 * (Giro) abrem histórico diário ao clicar — clique de novo fecha.
 */
import { useState } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { variacaoPercentual } from "@/domain/tendencias";
import { BIShell, type HrefMes } from "./bi-shell";
import {
  Quadro, Vazio, Bloco, Mini, useSub, Dica, BarrasTV, BarraComposicao,
  TabelaEquipe, ListaEquipamentos, SubFolha, CalendarioBI, ChipTV, ddmm, semCentavos, type PapelBI,
  NomeUsuario,
} from "./bi-ui";
import type { NomesHarpia } from "./turno-dados";
import { type RendimentoA424, resumoVolume, resumoAntecedencia, horaMovimento, historicoProduto, resumoConvocacoes, porOperadorConvocacoes, rendimentoA424, historicoA424, premiacaoA424, premiacaoPorDia } from "@/domain/abastecimento";
import type { DadosHarpiaAbastecimento, MovimentoPiso, LinhaConvocacao, RecepcaoProtocolo } from "@/data/harpia-abastecimento";
import type { DadosBIAbastecimento } from "./abastecimento-dados";

// Verde é só pra receita (identidade visual) — curva A em azul-céu.
const CURVA_COR: Record<string, string> = { A: "#38bdf8", B: "#5b6fd6", C: "#c2820a" };
const corCurva = (c: string) => CURVA_COR[c] ?? "#64748b";

type VisaoAba = "custo" | "volume" | "antecedencia" | "giro" | "movimento" | "rupturas";

const VISOES: { id: VisaoAba; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo e equipe", contexto: "quem e o que compõe o custo — pessoas por função, salários e equipamentos" },
  { id: "volume", titulo: "Volume", contexto: "o que foi reabastecido no picking (regra da A424) · clique num dia para filtrar" },
  { id: "antecedencia", titulo: "Antecedência", contexto: "folga entre o abastecimento e o fim da separação da carga · clique num dia para filtrar" },
  { id: "giro", titulo: "Giro de picking", contexto: "produtos mais reabastecidos no mês (regra da A424) · clique numa curva ABC para filtrar, num produto para ver o histórico diário" },
  { id: "movimento", titulo: "Movimentação", contexto: "quem move, descendente × ascendente × horizontal e horário — a equipe real de piso · clique num dia ou numa pessoa" },
  { id: "rupturas", titulo: "Rupturas", contexto: "estoque negativo no endereço de picking, resolvido por um abastecimento" },
];

// Fora do menu por ora (pedido do Pedro, 20/10/2026) — as visões continuam no código.
const OCULTAS: ReadonlySet<VisaoAba> = new Set(["antecedencia", "rupturas"]);

const PAPEIS: PapelBI[] = [
  { id: "lider", rotulo: "Líder", plural: "Liderança", cor: "#10b981" },
  { id: "empilhador", rotulo: "Empilhador", plural: "Empilhadores", cor: "#38bdf8" },
  { id: "wms", rotulo: "WMS", plural: "WMS", cor: "#c2820a" },
  { id: "operador", rotulo: "Operador", plural: "Operadores de abastecimento", cor: "#5b6fd6" },
];

const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);

/** Custo do mês: folha (foto do mês; no corrente, o cadastro) + equipamentos de hoje. */
function custoDoMes(d: DadosBIAbastecimento, mes: string): number | null {
  const p = d.serie.find((x) => x.mes === mes);
  if (!p || p.folha === null) return null;
  return p.folha + d.equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
}

export function BIAbastecimento({ dados, hrefMes, hrefSair }: { dados: DadosBIAbastecimento; hrefMes: HrefMes; hrefSair: string }) {
  const [visao, setVisao] = useState<VisaoAba | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const abrir = (v: VisaoAba) => setVisao((a) => (a === v ? null : v));
  const titulo = visao ? VISOES.find((v) => v.id === visao)! : null;

  const custo = custoDoMes(dados, dados.mes);
  const i = dados.serie.findIndex((x) => x.mes === dados.mes);
  const anterior = i > 0 ? custoDoMes(dados, dados.serie[i - 1].mes) : null;
  const delta = custo !== null && anterior ? variacaoPercentual(custo, anterior) : null;
  const conta = (id: string) => dados.pessoas.filter((y) => y.papel === id).length;
  const q = (v: VisaoAba) => ({ ativo: visao === v, onClick: () => abrir(v) });
  const h = "dados" in dados.harpia ? dados.harpia.dados : null;
  const semH = h ? null : "erro" in dados.harpia ? dados.harpia.erro : "";

  const resumo = h ? resumoVolume(h.reabastecimento) : null;
  const prem = h ? premiacaoA424(h.movimentoPiso.a424, null, h.movimentoPiso.empilhadores, h.movimentoPiso.lancadoresWms) : null;
  const abastProdutos = h ? h.curvas.reduce((t, c) => t + c.abastecimentos, 0) : 0;
  const skusProdutos = h ? h.curvas.reduce((t, c) => t + c.skus, 0) : 0;
  const ant = h ? resumoAntecedencia(h.cargas) : null;
  const pctAntes = ant && ant.antes + ant.depoisOuJunto > 0 ? ant.antes / (ant.antes + ant.depoisOuJunto) : null;

  const menu = (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Quadro
          {...q("custo")}
          rotulo="Custo e equipe"
          valor={custo === null ? "—" : semCentavos(custo)}
          sub={`${dados.pessoas.length} pessoas · ${conta("lider")} líder(es)${delta !== null ? ` · ${delta > 0 ? "+" : ""}${formatPercent(delta, 1)} vs mês anterior` : ""}`}
        />
        <Quadro
          {...q("volume")}
          rotulo="Volume"
          valor={resumo ? `${n0(resumo.caixas)} cx` : "—"}
          sub={semH ?? (resumo && resumo.dias ? `${n0(resumo.abastecimentos)} reabast. · ${resumo.dias} dias` : "sem abastecimento no mês")}
        />
        {!OCULTAS.has("antecedencia") && <Quadro
          {...q("antecedencia")}
          rotulo="Antecedência"
          valor={pctAntes !== null ? formatPercent(pctAntes, 0) : "—"}
          sub={semH ?? (ant ? `mediana ${ant.medianaHoras !== null ? n1(ant.medianaHoras) : "—"}h de folga` : "sem cargas no mês")}
        />}
        <Quadro
          {...q("giro")}
          rotulo="Giro de picking"
          valor={h ? `${n0(abastProdutos)} abast.` : "—"}
          sub={semH ?? (abastProdutos ? `${n0(skusProdutos)} produtos · ${resumo?.dias ?? 0} dias` : "sem abastecimento no mês")}
        />
        <Quadro
          {...q("movimento")}
          rotulo="Movimentação"
          valor={prem ? n0(prem.total) : "—"}
          sub={semH ?? (prem ? `${n0(prem.descendente)} desc. · ${n0(prem.ascendente)} asc.` : "sem dado no mês")}
        />
        {!OCULTAS.has("rupturas") && <Quadro
          {...q("rupturas")}
          rotulo="Rupturas"
          valor={h ? `${h.rupturas.length}` : "—"}
          sub={semH ?? (h && h.rupturas.length > 0 ? "estoque negativo no picking" : "nenhuma no mês")}
        />}
      </div>
      {dia && (
        <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
          <span className="font-semibold uppercase tracking-[0.16em]">Filtro</span>
          <ChipTV ativo onClick={() => setDia(null)}>
            dia {ddmm(dia)} ✕
          </ChipTV>
          <span>vale pra Volume e Movimentação · Esc limpa</span>
        </div>
      )}
    </>
  );

  return (
    <BIShell
      titulo={`BI do ${dados.setor.charAt(0)}${dados.setor.slice(1).toLowerCase()}`}
      mes={dados.mes}
      hrefMes={hrefMes}
      hrefSair={hrefSair}
      menu={menu}
      onEsc={() => setDia(null)}
      palco={
        visao && titulo
          ? {
              chave: visao,
              titulo: titulo.titulo,
              contexto: titulo.contexto,
              conteudo:
                visao === "custo" ? (
                  <VisaoCusto dados={dados} />
                ) : !h ? (
                  <SemHarpia erro={semH ?? ""} />
                ) : visao === "volume" ? (
                  <VisaoVolume h={h} mes={dados.mes} custoMes={custo} dia={dia} onDia={setDia} />
                ) : visao === "antecedencia" ? (
                  <VisaoAntecedencia h={h} mes={dados.mes} dia={dia} onDia={setDia} />
                ) : visao === "giro" ? (
                  <VisaoGiro h={h} />
                ) : visao === "movimento" ? (
                  <VisaoMovimento movimento={h.movimentoPiso} convocacoes={h.convocacoes} recepcao={h.recepcao} mes={dados.mes} dia={dia} onDia={setDia} nomes={dados.nomes} />
                ) : (
                  <VisaoRupturas h={h} mes={dados.mes} />
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
            ? "O usuário de banco do app não tem leitura nas tabelas do Harpia (esquema HARPIAW2). Peça ao DBA: grant select em PREPARA_ABAST_809, PREPARA_ABAST_GUIAS_1360, PREPARA_ABAST_MERC_1361 e HIST_ABAST_NEG_848 para esse usuário."
            : "A consulta ao Oracle falhou. Confira se o banco está acessível de onde o app roda."}
        </p>
        {erro && <p className="font-mono text-xs text-white/35">{erro}</p>}
      </div>
    </Vazio>
  );
}

// --- CUSTO E EQUIPE -----------------------------------------------------------

type SubCusto = "custo" | "equipe" | "folha" | "equipamentos";
const TITULO_SUB: Record<SubCusto, string> = { custo: "Custo do mês", equipe: "Equipe", folha: "Folha", equipamentos: "Equipamentos" };

function VisaoCusto({ dados }: { dados: DadosBIAbastecimento }) {
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

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">
        <Mini {...card("custo")} rotulo="Custo do mês" valor={custoMes === null ? "—" : formatBRL(custoMes)} sub={custoMes === null ? "mês sem foto do efetivo" : formatMesAno(dados.mes)} />
        <Mini {...card("equipe")} rotulo="Equipe" valor={`${pessoas.length} pessoas`} sub={presentes.map((pp) => `${pessoas.filter((y) => y.papel === pp.id).length} ${pp.rotulo.toLowerCase()}`).join(" · ")} />
        <Mini {...card("folha")} rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub="por mês, com encargos" />
        <Mini {...card("equipamentos")} rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${equipamentos.reduce((t, e) => t + e.quantidade, 0)} unidades · por mês`} />
        <Mini rotulo="Custo por pessoa" valor={pessoas.length ? formatBRL(total / pessoas.length) : "—"} sub="média, com equipamentos" />
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

// --- VOLUME --------------------------------------------------------------------

function VisaoVolume({
  h, mes, custoMes, dia, onDia,
}: {
  h: DadosHarpiaAbastecimento; mes: string; custoMes: number | null; dia: string | null; onDia: (d: string | null) => void;
}) {
  const dias = h.reabastecimento;
  const resumo = resumoVolume(dias);
  if (dias.length === 0) return <Vazio>Nenhum reabastecimento registrado neste mês.</Vazio>;
  const peso = dias.reduce((t, d) => t + d.peso, 0);
  const porDiaCx = new Map(dias.map((d) => [d.dia, d.caixas]));
  const custoPorCaixa = custoMes !== null && resumo.caixas > 0 ? custoMes / resumo.caixas : null;
  const diaDados = dia ? dias.find((d) => d.dia === dia) ?? null : null;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">
        <Mini rotulo="Caixas" valor={n0(resumo.caixas)} sub={`${resumo.dias} dias com reabastecimento`} />
        <Mini rotulo="Peso" valor={`${n1(peso / 1000)} t`} sub={`${n0(peso)} kg`} />
        <Mini rotulo="SKUs por dia" valor={resumo.skusMedioDia !== null ? n0(resumo.skusMedioDia) : "—"} sub="produtos distintos, média do dia" />
        <Mini rotulo="Reabastecimentos" valor={n0(resumo.abastecimentos)} sub={resumo.dias ? `${n0(resumo.abastecimentos / resumo.dias)} por dia` : undefined} />
        <Mini rotulo="Caixas por reabast." valor={resumo.abastecimentos ? n1(resumo.caixas / resumo.abastecimentos) : "—"} sub={custoPorCaixa !== null ? `custo por caixa ${formatBRL(custoPorCaixa)}` : undefined} />
      </div>
      {diaDados && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-amber-400/10 p-2 ring-1 ring-amber-400/30 xl:grid-cols-4">
          <Mini rotulo={`Caixas · ${ddmm(dia!)}`} valor={n0(diaDados.caixas)} />
          <Mini rotulo="Peso do dia" valor={`${n1(diaDados.peso / 1000)} t`} />
          <Mini rotulo="SKUs do dia" valor={n0(diaDados.skus)} />
          <Mini rotulo="Reabast. do dia" valor={n0(diaDados.abastecimentos)} />
        </div>
      )}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Bloco titulo="Caixas reabastecidas por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
          <CalendarioBI mes={mes} porDia={porDiaCx} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem reabastecimento" />
        </Bloco>
        <div className="grid min-h-0 grid-rows-2 gap-4">
          <Bloco titulo="Peso reabastecido por dia" direita={<Dica>toneladas</Dica>}>
            <BarrasTV
              altura={150}
              fmt={(v) => n1(v / 1000)}
              onClick={(d) => onDia(dia === d ? null : d)}
              itens={dias.map((d) => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), valor: d.peso, detalhe: `${ddmm(d.dia)} · ${n1(d.peso / 1000)} t · ${n0(d.caixas)} cx`, selecionado: d.dia === dia }))}
            />
          </Bloco>
          <Bloco titulo="SKUs distintos reabastecidos por dia">
            <BarrasTV
              altura={150}
              fmt={n0}
              onClick={(d) => onDia(dia === d ? null : d)}
              itens={dias.map((d) => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), valor: d.skus, detalhe: `${ddmm(d.dia)} · ${n0(d.skus)} SKUs`, selecionado: d.dia === dia }))}
            />
          </Bloco>
        </div>
      </div>
    </div>
  );
}

// --- ANTECEDÊNCIA ---------------------------------------------------------------

function VisaoAntecedencia({
  h, mes, dia, onDia,
}: {
  h: DadosHarpiaAbastecimento; mes: string; dia: string | null; onDia: (d: string | null) => void;
}) {
  const cargasFiltradas = dia ? h.cargas.filter((c) => c.dia === dia) : h.cargas;
  const ant = resumoAntecedencia(cargasFiltradas);
  if (h.cargas.length === 0) return <Vazio>Nenhuma carga abastecida neste mês.</Vazio>;
  const pctAntes = ant.antes + ant.depoisOuJunto > 0 ? ant.antes / (ant.antes + ant.depoisOuJunto) : null;
  const maxFaixa = Math.max(1, ...ant.faixas.map((f) => f.qtd));
  const porDia = new Map<string, number>();
  for (const c of h.cargas) porDia.set(c.dia, (porDia.get(c.dia) ?? 0) + 1);
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini rotulo="Cargas analisadas" valor={n0(ant.total)} sub={dia ? ddmm(dia) : ant.semSeparacao ? `${ant.semSeparacao} ainda sem separação` : formatMesAno(mes)} />
        <Mini rotulo="Abastecido antes" valor={pctAntes !== null ? formatPercent(pctAntes, 0) : "—"} sub={`${n0(ant.antes)} de ${n0(ant.antes + ant.depoisOuJunto)} cargas`} />
        <Mini rotulo="Mediana de folga" valor={ant.medianaHoras !== null ? `${n1(ant.medianaHoras)}h` : "—"} sub="entre o abastecimento e o fim da separação" />
        <Mini rotulo="Depois ou junto" valor={n0(ant.depoisOuJunto)} sub="carga separada sem folga de abastecimento" />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Bloco titulo="Cargas abastecidas por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
          <CalendarioBI mes={mes} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem carga" />
        </Bloco>
        <Bloco titulo="Distribuição da folga">
          <BarrasTV
            altura={220}
            fmt={n0}
            itens={ant.faixas.map((f) => ({ chave: f.chave, rotulo: f.rotulo, valor: f.qtd, detalhe: `${f.rotulo} · ${n0(f.qtd)} cargas`, cor: f.qtd === maxFaixa ? "#c2820a" : "#5b6fd6" }))}
          />
          <p className="mt-3 text-xs text-white/35">Folga = horas entre o 1º abastecimento que serviu a carga e o fim da separação dela. &quot;Depois/junto&quot; nunca deveria ter volume relevante — o abastecimento alimenta o estoque que a separação consome.</p>
        </Bloco>
      </div>
    </div>
  );
}

// --- GIRO DE PICKING -------------------------------------------------------------

const TOP_GIRO = 20;
const rotuloCurva = (c: string) => (c === "?" ? "Sem classificação" : `Curva ${c}`);

function VisaoGiro({ h }: { h: DadosHarpiaAbastecimento }) {
  const [produtoAberto, setProdutoAberto] = useState<number | null>(null);
  const [curvaSel, setCurvaSel] = useState<string | null>(null);
  const resumo = resumoVolume(h.reabastecimento);
  const diasAtivos = resumo.dias;
  if (h.produtos.length === 0) return <Vazio>Nenhum abastecimento registrado neste mês.</Vazio>;
  const totalCurvas = h.curvas.reduce((t, c) => t + c.abastecimentos, 0);
  const curva = curvaSel ? h.curvas.find((c) => c.curva === curvaSel) ?? null : null;
  // Recorte: a curva clicada ou o mês inteiro.
  const abast = curva ? curva.abastecimentos : totalCurvas;
  const skus = curva ? curva.skus : h.curvas.reduce((t, c) => t + c.skus, 0);
  const lista = h.produtos
    .filter((p) => !curvaSel || (p.curva ?? "?") === curvaSel)
    .sort((a, b) => b.abastecimentos - a.abastecimentos)
    .slice(0, TOP_GIRO);
  const somaTop = lista.reduce((t, p) => t + p.abastecimentos, 0);
  const max = Math.max(1, ...lista.map((p) => p.abastecimentos));
  const fatiasCurva = h.curvas.map((c) => ({ rotulo: rotuloCurva(c.curva), valor: c.abastecimentos, cor: corCurva(c.curva) }));
  const produtoSel = produtoAberto ? h.produtos.find((p) => p.produto === produtoAberto) ?? null : null;
  const historico = produtoAberto ? historicoProduto(h.produtosDia, produtoAberto) : [];
  const toggle = (p: number) => setProdutoAberto((a) => (a === p ? null : p));
  const selecionarCurva = (r: string | null) => setCurvaSel(r === null ? null : h.curvas.find((c) => rotuloCurva(c.curva) === r)?.curva ?? null);
  const recorte = curva ? rotuloCurva(curva.curva).toLowerCase() : "no mês";
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini
          rotulo={curva ? `Reabastecimentos · ${rotuloCurva(curva.curva)}` : "Reabastecimentos"}
          valor={n0(abast)}
          sub={curva && totalCurvas ? `${formatPercent(abast / totalCurvas, 0)} do total do mês` : `${n0(resumo.caixas)} caixas no mês`}
        />
        <Mini rotulo="Produtos reabastecidos" valor={n0(skus)} sub={`${n1(abast / Math.max(1, skus))} abast. por produto · ${recorte}`} />
        <Mini rotulo="Dias com reabastecimento" valor={String(diasAtivos)} sub={diasAtivos ? `${n0(abast / diasAtivos)} abast. por dia · ${recorte}` : undefined} />
        <Mini
          rotulo={`Peso do top ${TOP_GIRO}`}
          valor={abast ? formatPercent(somaTop / abast, 0) : "—"}
          sub={`${n0(somaTop)} abast. nos ${lista.length} produtos da lista`}
        />
      </div>
      {totalCurvas > 0 && (
        <Bloco titulo="Reabastecimento por curva ABC" direita={<Dica>clique numa curva pra ver os produtos dela · CLASSEVENDA do Winthor</Dica>} className="shrink-0">
          <BarraComposicao fatias={fatiasCurva} fmt={(v) => `${n0(v)} abast.`} selecionado={curva ? rotuloCurva(curva.curva) : null} onSelecionar={selecionarCurva} />
          <p className="mt-2 text-xs text-white/35">
            {h.curvas
              .filter((c) => c.curva !== "?")
              .map((c) => `curva ${c.curva}: ${c.skus} produtos, ${n1(c.abastecimentos / Math.max(1, c.skus))}/produto`)
              .join(" · ")}
          </p>
        </Bloco>
      )}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Bloco
          titulo={curva ? `${rotuloCurva(curva.curva)} · mais reabastecidos` : "Produtos mais reabastecidos"}
          direita={
            curva ? (
              <ChipTV ativo onClick={() => setCurvaSel(null)}>
                {rotuloCurva(curva.curva)} ✕
              </ChipTV>
            ) : (
              <Dica>clique num produto pra ver o histórico diário</Dica>
            )
          }
        >
          <ul className="h-full space-y-2 overflow-auto pr-1">
            {lista.map((p) => (
              <li key={p.produto}>
                <button
                  type="button"
                  onClick={() => toggle(p.produto)}
                  className={`w-full rounded-lg px-1.5 py-1 text-left transition ${p.produto === produtoAberto ? "bg-amber-400/10 ring-1 ring-amber-400/40" : "hover:bg-white/[0.04]"}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-white" title={p.descricao ?? undefined}>
                      {p.curva && (
                        <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-[0.6rem] font-bold text-[#0a1650]" style={{ background: corCurva(p.curva) }}>
                          {p.curva}
                        </span>
                      )}
                      <span className="text-white/45">{p.produto}</span> {p.descricao ?? ""}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-white">
                      {n0(p.abastecimentos)} <span className="font-normal text-white/45">· {diasAtivos ? n1(p.abastecimentos / diasAtivos) : "—"}/dia</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#5b6fd6]" style={{ width: `${(p.abastecimentos / max) * 100}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo={produtoSel ? `${produtoSel.produto} · histórico diário` : "Histórico diário"} direita={produtoSel?.descricao ? <Dica>{produtoSel.descricao}</Dica> : undefined}>
          {produtoSel ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Mini rotulo="Caixas" valor={n0(produtoSel.caixas)} />
                <Mini rotulo="Reabast./dia" valor={diasAtivos ? n1(produtoSel.abastecimentos / diasAtivos) : "—"} />
              </div>
              <BarrasTV
                altura={150}
                fmt={n0}
                itens={historico.map((d) => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), valor: d.abastecimentos, detalhe: `${ddmm(d.dia)} · ${n0(d.abastecimentos)}` }))}
              />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-white/40">Clique num produto na lista pra ver o histórico diário dele.</p>
          )}
        </Bloco>
      </div>
    </div>
  );
}

// --- MOVIMENTAÇÃO DE ENDEREÇO (equipe real de piso) -------------------------------

type SubMov = "equipe" | "horario" | "tempo" | "subida";

/**
 * Quem fez, do jeito que a premiação conta pela A424: Mov. = função 04,
 * ↓ = função 03 (reabastecimento), ↑ = o resto. Os lançadores do WMS (Lucas,
 * Rafael) entram numa linha só, sem dono — o empilhador real não fica gravado.
 */
function TabelaEmpilhadores({
  rendimentos, lancadores, nomes, aberta, onAbrir,
}: {
  rendimentos: RendimentoA424[]; lancadores: RendimentoA424[]; nomes: NomesHarpia; aberta: number | null; onAbrir: (usuario: number) => void;
}) {
  const soma = (k: "tarefas" | "caixas" | "peso") => rendimentos.reduce((t, r) => t + r.reabastecimento[k], 0);
  const movEmp = rendimentos.reduce((t, r) => t + r.empilhadeira.tarefas, 0);
  const movWms = lancadores.reduce((t, r) => t + r.empilhadeira.tarefas, 0);
  const desc = soma("tarefas");
  const num = "py-2 text-right tabular-nums";
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
        <tr>
          <th className="py-2 font-semibold">Empilhador</th>
          <th className="py-2 text-right font-semibold" title="A424 função 04 — Movimentação">Mov.</th>
          <th className="py-2 text-right font-semibold" title="descendente = A424 função 03, reabastecimento até o picking">↓ Desc.</th>
          <th className="py-2 text-right font-semibold" title="ascendente = movimentações − descendente">↑ Asc.</th>
          <th className="py-2 text-right font-semibold">Caixas</th>
          <th className="py-2 text-right font-semibold">Peso</th>
          <th className="py-2 text-right font-semibold">SKUs</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t border-white/10 bg-white/[0.04] text-xs">
          <td className="py-1.5 font-bold uppercase tracking-[0.14em] text-amber-300">Total</td>
          <td className={`${num} font-bold text-white/80`}>{n0(movEmp + movWms)}</td>
          <td className={`${num} text-white/60`}>{n0(desc)}</td>
          <td className={`${num} text-white/60`}>{n0(movEmp + movWms - desc)}</td>
          <td className={`${num} text-white/60`}>{n0(soma("caixas"))}</td>
          <td className={`${num} text-white/60`}>{n1(soma("peso") / 1000)} t</td>
          <td />
        </tr>
        {rendimentos.map((r) => (
          <tr
            key={r.usuario}
            onClick={() => onAbrir(r.usuario)}
            className={`cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.05] ${r.usuario === aberta ? "bg-amber-400/10" : ""}`}
          >
            <td className="max-w-0 py-2"><NomeUsuario usuario={r.usuario} nomeHarpia={r.nome} nomes={nomes} /></td>
            <td className={`${num} font-bold text-white`}>{n0(r.empilhadeira.tarefas)}</td>
            <td className={`${num} text-white/70`}>{n0(r.reabastecimento.tarefas)}</td>
            <td className={`${num} text-white/70`}>{n0(r.empilhadeira.tarefas - r.reabastecimento.tarefas)}</td>
            <td className={`${num} text-white/70`}>{n0(r.reabastecimento.caixas)}</td>
            <td className={`${num} text-white/70`}>{n1(r.reabastecimento.peso / 1000)} t</td>
            <td className={`${num} text-white/70`}>{n0(r.reabastecimento.skus)}</td>
          </tr>
        ))}
        {movWms > 0 && (
          <tr className="border-t border-white/[0.06]" title="movimentação de empilhador lançada no WMS por outra pessoa — o Harpia não grava qual empilhador fez">
            <td className="max-w-0 py-2">
              <div className="truncate font-semibold text-white/80">Lançamento manual</div>
              <div className="truncate text-[0.65rem] text-white/35">{lancadores.map((r) => r.nome ?? `usuário ${r.usuario}`).join(", ")} · sem empilhador identificado</div>
            </td>
            <td className={`${num} font-bold text-white/80`}>{n0(movWms)}</td>
            <td className={`${num} text-white/40`}>—</td>
            <td className={`${num} text-white/70`}>{n0(movWms)}</td>
            <td className={`${num} text-white/40`}>—</td>
            <td className={`${num} text-white/40`}>—</td>
            <td className={`${num} text-white/40`}>—</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function VisaoMovimento({
  movimento, convocacoes, recepcao, mes, dia, onDia, nomes,
}: {
  movimento: MovimentoPiso; convocacoes: LinhaConvocacao[]; recepcao: RecepcaoProtocolo[]; mes: string; dia: string | null; onDia: (d: string | null) => void; nomes: NomesHarpia;
}) {
  const { sub, abrir, fechar } = useSub<SubMov>();
  const [pessoaAberta, setPessoaAberta] = useState<number | null>(null);
  if (movimento.a424.length === 0) return <Vazio>Nenhuma movimentação registrada em {formatMesAno(mes)}.</Vazio>;
  const porDia = premiacaoPorDia(movimento.a424, movimento.empilhadores, movimento.lancadoresWms);
  const porHora = horaMovimento(movimento.porHoraDia, dia);
  const resumoConv = resumoConvocacoes(convocacoes, dia);
  const porOperador = porOperadorConvocacoes(convocacoes, dia);
  const prem = premiacaoA424(movimento.a424, dia, movimento.empilhadores, movimento.lancadoresWms);
  // Picking → reserva na 502 (só pra tela do ascendente do recebimento).
  const diaPiso = dia ? movimento.dias.find((d) => d.dia === dia) ?? null : null;
  const ascendenteInterno = diaPiso ? diaPiso.ascendente : movimento.ascendente;
  const totalHora = porHora.reduce((t, x) => t + x.total, 0);
  const maxProduto = Math.max(1, ...movimento.produtosTop.map((p) => p.total));
  const maxOperadorConv = Math.max(1, ...porOperador.map((o) => o.total));
  const pico = porHora.reduce((a, b) => (b.total > a.total ? b : a), { hora: -1, total: 0 });
  // Pessoas = só os empilhadores, pela A424 (como a premiação conta). Ajudante
  // não entra; o que Lucas/Rafael lançam no WMS vai numa linha sem dono.
  const rend = rendimentoA424(movimento.a424, dia, movimento.a424SkusMes);
  const emp = rend.filter((r) => movimento.empilhadores.includes(r.usuario));
  const lanc = rend.filter((r) => movimento.lancadoresWms.includes(r.usuario));
  // Média só entre os empilhadores — quem move de vez em quando não puxa a média pra baixo.
  const mediaPorEmpilhador = emp.length ? emp.reduce((t, r) => t + r.empilhadeira.tarefas, 0) / emp.length : null;
  const card = (k: SubMov) => ({ onClick: abrir(k), ativo: sub === k });
  const empSel = pessoaAberta ? emp.find((r) => r.usuario === pessoaAberta) ?? null : null;
  const historicoEmp = empSel ? historicoA424(movimento.a424, empSel.usuario) : [];
  const abrirPessoa = (u: number) => setPessoaAberta((a) => (a === u ? null : u));
  const recepcaoFiltrada = dia ? recepcao.filter((r) => r.dia === dia) : recepcao;
  const volumesRecepcao = recepcaoFiltrada.reduce((t, r) => t + r.volumes, 0);
  const fmtMin = (v: number | null) => (v === null ? "—" : v < 1 ? `${Math.round(v * 60)}s` : `${n1(v)} min`);
  const TITULO_SUB_MOV: Record<SubMov, string> = { equipe: "Quem fez", horario: "Horário", tempo: "Tempo de resposta", subida: "Ascendente do recebimento" };
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-7">
        <Mini rotulo="Movimentações" valor={n0(prem.total)} sub={`${dia ? ddmm(dia) : formatMesAno(mes)}`} />
        <Mini rotulo="↓ Descendente" valor={n0(prem.descendente)} sub="reabastecimento — reserva → picking" />
        <Mini {...card("subida")} rotulo="↑ Ascendente" valor={n0(prem.ascendente)} sub={`movimentações − descendente · ${n0(volumesRecepcao)} vol. recebidos`} />
        <Mini {...card("equipe")} rotulo="Empilhadores" valor={String(emp.length)} sub="clique pra ver o rendimento" />
        <Mini rotulo="Média por empilhador" valor={mediaPorEmpilhador !== null ? n1(mediaPorEmpilhador) : "—"} sub={`movimentações ${dia ? "nesse dia" : "no mês"}${prem.lancadoWms ? ` · fora ${n0(prem.lancadoWms)} do WMS` : ""}`} />
        <Mini {...card("horario")} rotulo="Pico" valor={pico.hora >= 0 ? `${String(pico.hora).padStart(2, "0")}h` : "—"} sub={pico.hora >= 0 ? `${n0(pico.total)} movimentações nessa hora` : undefined} />
        <Mini {...card("tempo")} rotulo="Tempo de resposta" valor={fmtMin(resumoConv.medianaRespostaMin)} sub={resumoConv.total ? `Convocação Ativa · ${resumoConv.total} tarefas` : "Convocação Ativa — sem tarefa ainda"} />
      </div>
      <div className="flex items-center gap-3 text-xs">
        {sub ? (
          <>
            <button type="button" onClick={fechar} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
              ◂ Voltar ao resumo
            </button>
            <span className="font-bold uppercase tracking-[0.16em] text-amber-300">Movimentação › {TITULO_SUB_MOV[sub]}</span>
          </>
        ) : (
          <span className="text-white/35">Clique num card pra ver o ascendente do recebimento, quem fez, o horário ou o tempo de resposta</span>
        )}
      </div>

      {sub === null && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Bloco titulo="Movimentações por dia" direita={<Dica>empilhadores + lançamento manual (A424)</Dica>}>
            <CalendarioBI mes={mes} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem movimentação" />
          </Bloco>
          <Bloco titulo="Top 50 produtos mais mexidos" direita={<Dica>mês inteiro, por nº de movimentações</Dica>}>
            {movimento.produtosTop.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">Nenhum produto movimentado no mês.</p>
            ) : (
              <ul className="h-full space-y-3 overflow-auto pr-1">
                {movimento.produtosTop.map((p) => (
                  <li key={p.produto}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-white" title={p.descricao ?? undefined}>
                        <span className="text-white/45">{p.produto}</span> {p.descricao ?? ""}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-white">{n0(p.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#5b6fd6]" style={{ width: `${(p.total / maxProduto) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      )}

      {sub === "equipe" && (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Bloco titulo="Quem fez" direita={<Dica>{dia ? `${ddmm(dia)} · clique numa pessoa` : "mês inteiro · clique numa pessoa"}</Dica>}>
            {emp.length > 0 ? (
              <div className="h-full overflow-auto pr-1">
                <TabelaEmpilhadores rendimentos={emp} lancadores={lanc} nomes={nomes} aberta={pessoaAberta} onAbrir={abrirPessoa} />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-white/40">Nenhum empilhador com tarefa {dia ? `em ${ddmm(dia)}` : "no mês"}.</p>
            )}
          </Bloco>
          <Bloco
            titulo={empSel ? `${empSel.nome ?? `Usuário ${empSel.usuario}`} · rendimento` : "Rendimento"}
            direita={empSel ? <Dica>regra A424 · {dia ? ddmm(dia) : formatMesAno(mes)}</Dica> : undefined}
          >
            {empSel ? (
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1">
                <div className="grid grid-cols-2 gap-2 2xl:grid-cols-3">
                  <Mini rotulo="Movimentações" valor={n0(empSel.empilhadeira.tarefas)} sub={empSel.dias > 1 ? `${n1(empSel.empilhadeira.tarefas / empSel.dias)} por dia · ${empSel.dias} dias` : "A424 função 04"} />
                  <Mini rotulo="↓ Descendente" valor={n0(empSel.reabastecimento.tarefas)} sub="reabastecimento (A424 03)" />
                  <Mini rotulo="↑ Ascendente" valor={n0(empSel.empilhadeira.tarefas - empSel.reabastecimento.tarefas)} sub="movimentações − descendente" />
                  <Mini rotulo="Caixas" valor={n0(empSel.reabastecimento.caixas)} sub={empSel.reabastecimento.tarefas ? `${n1(empSel.reabastecimento.caixas / empSel.reabastecimento.tarefas)} por reabastecimento` : undefined} />
                  <Mini rotulo="Peso" valor={`${n1(empSel.reabastecimento.peso / 1000)} t`} sub={`${n0(empSel.reabastecimento.peso)} kg`} />
                  <Mini rotulo="SKUs" valor={n0(empSel.reabastecimento.skus)} sub="produtos distintos" />
                </div>
                <div className="min-h-[180px] flex-1">
                  <BarrasTV
                    altura={170}
                    fmt={n0}
                    onClick={(d) => onDia(dia === d ? null : d)}
                    itens={historicoEmp.map((x) => ({ chave: x.dia, rotulo: x.dia.slice(8, 10), valor: x.movimentacoes, detalhe: `${ddmm(x.dia)} · ${n0(x.movimentacoes)} mov. · ${n0(x.tarefas)} reabast. · ${n0(x.caixas)} cx · ${n1(x.peso / 1000)} t`, selecionado: x.dia === dia }))}
                  />
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-white/40">Clique num empilhador na tabela pra ver o rendimento dele: movimentações, reabastecimentos, caixas, peso e SKUs, dia a dia.</p>
            )}
          </Bloco>
        </div>
      )}

      {sub === "horario" && (
        <Bloco titulo="Movimentações por hora do dia" direita={<Dica>{dia ? ddmm(dia) : formatMesAno(mes)}</Dica>}>
          <BarrasTV
            altura={240}
            fmt={n0}
            itens={porHora.map((x) => ({
              chave: String(x.hora),
              rotulo: `${x.hora}h`,
              valor: x.total,
              cor: x.hora === pico.hora ? "#f5b301" : "#5b6fd6",
              detalhe: `${String(x.hora).padStart(2, "0")}:00–${String(x.hora).padStart(2, "0")}:59 · ${n0(x.total)}`,
            }))}
          />
          <p className="mt-2 text-xs text-white/35">Pico em {String(pico.hora).padStart(2, "0")}h, com {n0(pico.total)} de {n0(totalHora)} movimentações entre endereços ({formatPercent(totalHora > 0 ? pico.total / totalHora : 0, 0)}).</p>
        </Bloco>
      )}

      {sub === "subida" && <SubidaRecebimento recepcao={recepcaoFiltrada} mes={mes} dia={dia} ascendenteInterno={ascendenteInterno} />}

      {sub === "tempo" && (
        resumoConv.total === 0 ? (
          <Vazio>
            <div className="max-w-md space-y-2">
              <p className="text-lg font-semibold text-white/70">Convocação Ativa ligada, sem tarefa {dia ? `em ${ddmm(dia)}` : `em ${formatMesAno(mes)}`}</p>
              <p className="text-sm text-white/40">Vocês ligaram o módulo em 13/10 — a partir de segunda, toda movimentação passa a entrar aqui. Esse card enche sozinho.</p>
            </div>
          </Vazio>
        ) : (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Bloco titulo="Tempo por operador" direita={<Dica>mediana, não média — um teste isolado não distorce</Dica>}>
              <div className="h-full overflow-auto pr-1">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
                    <tr>
                      <th className="py-2 font-semibold">Operador</th>
                      <th className="py-2 text-right font-semibold">Tarefas</th>
                      <th className="py-2 text-right font-semibold">Resposta</th>
                      <th className="py-2 text-right font-semibold">Execução</th>
                      <th className="w-24 py-2 text-right font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porOperador.map((o) => (
                      <tr key={o.operador} className="border-t border-white/[0.06]">
                        <td className="py-2 font-semibold text-white">{o.nome ?? `Operador ${o.operador}`}</td>
                        <td className="py-2 text-right font-bold tabular-nums text-white">{n0(o.total)}</td>
                        <td className="py-2 text-right tabular-nums text-white/70">{fmtMin(o.medianaRespostaMin)}</td>
                        <td className="py-2 text-right tabular-nums text-white/70">{fmtMin(o.medianaExecucaoMin)}</td>
                        <td className="py-2">
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-[#5b6fd6]" style={{ width: `${(o.total / maxOperadorConv) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Bloco>
            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Mini rotulo="Tarefas" valor={n0(resumoConv.total)} sub={`${n0(resumoConv.finalizadas)} finalizadas`} />
                <Mini rotulo="Rejeitadas" valor={n0(resumoConv.rejeitadas)} sub={resumoConv.total ? formatPercent(resumoConv.rejeitadas / resumoConv.total, 0) : undefined} />
                <Mini rotulo="Resposta (mediana)" valor={fmtMin(resumoConv.medianaRespostaMin)} sub="solicitação → aceite" />
                <Mini rotulo="Execução (mediana)" valor={fmtMin(resumoConv.medianaExecucaoMin)} sub="aceite → finalização" />
              </div>
              <Bloco titulo="O que é isso" className="shrink-0">
                <p className="text-sm text-white/50">
                  A <strong className="text-white/70">Convocação Ativa</strong> é a rotina que chama o operador pra uma tarefa de movimentação — diferente do que o resto desse card mede (o movimento em si, no <code className="text-white/70">MOVIMENT_END_502</code>). Aqui dá pra medir quanto tempo o operador leva pra aceitar a convocação, e quanto tempo leva da aceitação até finalizar.
                </p>
                <p className="mt-3 text-xs text-white/35">Módulo ligado em 13/10/2026 — ainda é pouco dado ({resumoConv.total} tarefas até agora). A partir de segunda-feira toda a equipe passa a usar, então esse número fica confiável com o tempo.</p>
              </Bloco>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Ascendente do recebimento: o que a recepção de compras trouxe e foi
 * armazenado pra cima (rotina 229 do Harpia). Lista por protocolo no mesmo
 * formato da 229, pra conferir lado a lado.
 */
function SubidaRecebimento({ recepcao, mes, dia, ascendenteInterno }: { recepcao: RecepcaoProtocolo[]; mes: string; dia: string | null; ascendenteInterno: number }) {
  if (recepcao.length === 0) return <Vazio>Nenhuma recepção de compra {dia ? `em ${ddmm(dia)}` : `em ${formatMesAno(mes)}`}.</Vazio>;
  const soma = (k: "skus" | "volumes" | "peso") => recepcao.reduce((t, r) => t + r[k], 0);
  const volumes = soma("volumes");
  const peso = soma("peso");
  const porDia = new Map<string, { volumes: number; peso: number }>();
  for (const r of recepcao) {
    const d = porDia.get(r.dia) ?? { volumes: 0, peso: 0 };
    d.volumes += r.volumes;
    d.peso += r.peso;
    porDia.set(r.dia, d);
  }
  const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lista = [...recepcao].sort((a, b) => b.dia.localeCompare(a.dia) || b.protocolo - a.protocolo);
  const ton = (kg: number) => `${n1(kg / 1000)} t`;
  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Bloco titulo="Protocolos de recepção" direita={<Dica>compras · mesmo formato da rotina 229</Dica>}>
        <div className="h-full overflow-auto pr-1">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
              <tr>
                <th className="py-2 font-semibold">Data</th>
                <th className="py-2 font-semibold">Protocolo</th>
                <th className="py-2 font-semibold">Descrição</th>
                <th className="py-2 text-right font-semibold">SKUs</th>
                <th className="py-2 text-right font-semibold">Volumes</th>
                <th className="py-2 text-right font-semibold">Peso (kg)</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.protocolo} className="border-t border-white/[0.06]">
                  <td className="py-2 tabular-nums text-white/60">{ddmm(r.dia)}</td>
                  <td className="py-2 tabular-nums text-white/60">{r.protocolo}</td>
                  <td className="max-w-0 truncate py-2 text-white" title={r.descricao ?? undefined}>{r.descricao ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n0(r.skus)}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{n0(r.volumes)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n1(r.peso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Mini rotulo="Volumes recebidos" valor={n0(volumes)} sub={dia ? ddmm(dia) : formatMesAno(mes)} />
          <Mini rotulo="Peso" valor={ton(peso)} sub={`${n0(peso)} kg`} />
          <Mini rotulo="Protocolos" valor={n0(recepcao.length)} sub={`${n0(soma("skus"))} SKUs (soma por protocolo)`} />
          <Mini rotulo="Ascendente interno" valor={n0(ascendenteInterno)} sub="movimentações picking → reserva" />
        </div>
        <Bloco titulo="Volumes por dia" direita={<Dica>passe o mouse pra ver o peso</Dica>}>
          <BarrasTV
            altura={160}
            fmt={n0}
            itens={dias.map(([d, x]) => ({ chave: d, rotulo: d.slice(8, 10), valor: x.volumes, detalhe: `${ddmm(d)} · ${n0(x.volumes)} vol. · ${ton(x.peso)}` }))}
          />
        </Bloco>
      </div>
    </div>
  );
}

// --- RUPTURAS --------------------------------------------------------------------

function VisaoRupturas({ h, mes }: { h: DadosHarpiaAbastecimento; mes: string }) {
  const totalAbast = resumoVolume(h.dias).abastecimentos;
  const preventivos = Math.max(0, totalAbast - h.abastecimentosReativos);
  const pctPreventivo = totalAbast > 0 ? preventivos / totalAbast : null;
  if (h.rupturas.length === 0) {
    return (
      <Vazio>
        <div>
          Nenhuma ruptura de picking em {formatMesAno(mes)}.
          {totalAbast > 0 && <p className="mt-2 text-sm text-white/40">{n0(totalAbast)} abastecimentos no mês, 100% preventivos.</p>}
        </div>
      </Vazio>
    );
  }
  const caixas = h.rupturas.reduce((t, r) => t + r.caixas, 0);
  const unidades = h.rupturas.reduce((t, r) => t + r.unidades, 0);
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">
        <Mini rotulo="Rupturas" valor={n0(h.rupturas.length)} sub={formatMesAno(mes)} />
        <Mini rotulo="Caixas faltantes" valor={n0(caixas)} />
        <Mini rotulo="Unidades faltantes" valor={n0(unidades)} />
        <Mini rotulo="Abastecimento preventivo" valor={pctPreventivo !== null ? formatPercent(pctPreventivo, 1) : "—"} sub={`${n0(preventivos)} de ${n0(totalAbast)} abastecimentos`} />
        <Mini rotulo="Abastecimento reativo" valor={n0(h.abastecimentosReativos)} sub="feito por causa de uma ruptura" />
      </div>
      <Bloco titulo="Eventos de ruptura" direita={<Dica>estoque negativo no endereço de picking, já resolvido pelo abastecimento que o registrou</Dica>}>
        <div className="h-full overflow-auto pr-1">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
              <tr>
                <th className="py-2 font-semibold">Quando</th>
                <th className="py-2 font-semibold">Produto</th>
                <th className="py-2 text-right font-semibold">Caixas</th>
                <th className="py-2 text-right font-semibold">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {h.rupturas.map((r, i) => (
                <tr key={i} className="border-t border-white/[0.06]">
                  <td className="py-2 tabular-nums text-white/70">{r.data}</td>
                  <td className="py-2 text-white">
                    <span className="text-white/45">{r.produto}</span> {r.descricao ?? ""}
                  </td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n0(r.caixas)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{n0(r.unidades)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </div>
  );
}
