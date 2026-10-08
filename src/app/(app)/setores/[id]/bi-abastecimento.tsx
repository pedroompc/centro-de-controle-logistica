"use client";

/**
 * BI do Abastecimento em tela cheia — mesma moldura e peças do BI da
 * Separação. Custo e equipe vêm do cadastro; Volume, Antecedência, Giro de
 * picking e Rupturas vêm do Harpia (WMS). Quem prepara o abastecimento no
 * Harpia é o FATURAMENTO gerando a ordem, não quem executa — por isso NUNCA
 * se rankeia por usuário aqui; rendimento é sempre da equipe cadastrada no
 * setor (headcount do app). Esc limpa o filtro de dia (visão Volume).
 */
import { useState } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { variacaoPercentual } from "@/domain/tendencias";
import { BIShell, type HrefMes } from "./bi-shell";
import {
  Quadro, Vazio, Bloco, Mini, useSub, Dica, BarrasTV, BarraComposicao,
  TabelaEquipe, ListaEquipamentos, SubFolha, CalendarioBI, ddmm, semCentavos, type PapelBI,
} from "./bi-ui";
import { resumoVolume, resumoAntecedencia } from "@/domain/abastecimento";
import type { DadosHarpiaAbastecimento } from "@/data/harpia-abastecimento";
import type { DadosBIAbastecimento } from "./abastecimento-dados";

type VisaoAba = "custo" | "volume" | "antecedencia" | "giro" | "rupturas";

const VISOES: { id: VisaoAba; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo e equipe", contexto: "quem e o que compõe o custo — pessoas por função, salários e equipamentos" },
  { id: "volume", titulo: "Volume", contexto: "caixas e unidades abastecidas por dia · clique num dia para filtrar" },
  { id: "antecedencia", titulo: "Antecedência", contexto: "folga entre o abastecimento e o fim da separação da carga" },
  { id: "giro", titulo: "Giro de picking", contexto: "produtos com mais abastecimentos no mês" },
  { id: "rupturas", titulo: "Rupturas", contexto: "estoque negativo no endereço de picking, resolvido por um abastecimento" },
];

const PAPEIS: PapelBI[] = [
  { id: "lider", rotulo: "Líder", plural: "Liderança", cor: "#10b981" },
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

  const resumo = h ? resumoVolume(h.dias) : null;
  const ant = h ? resumoAntecedencia(h.cargas) : null;
  const pctAntes = ant && ant.antes + ant.depoisOuJunto > 0 ? ant.antes / (ant.antes + ant.depoisOuJunto) : null;

  const menu = (
    <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
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
        sub={semH ?? (resumo ? `${n0(resumo.unidades)} un · ${resumo.dias} dias` : "sem abastecimento no mês")}
      />
      <Quadro
        {...q("antecedencia")}
        rotulo="Antecedência"
        valor={pctAntes !== null ? formatPercent(pctAntes, 0) : "—"}
        sub={semH ?? (ant ? `mediana ${ant.medianaHoras !== null ? n1(ant.medianaHoras) : "—"}h de folga` : "sem cargas no mês")}
      />
      <Quadro
        {...q("giro")}
        rotulo="Giro de picking"
        valor={h ? `${h.produtos.length} produtos` : "—"}
        sub={semH ?? (resumo ? `${n0(resumo.abastecimentos)} abastecimentos · ${resumo.dias} dias` : "sem abastecimento no mês")}
      />
      <Quadro
        {...q("rupturas")}
        rotulo="Rupturas"
        valor={h ? `${h.rupturas.length}` : "—"}
        sub={semH ?? (h && h.rupturas.length > 0 ? "estoque negativo no picking" : "nenhuma no mês")}
      />
    </div>
  );

  return (
    <BIShell
      titulo={`BI do ${dados.setor.charAt(0)}${dados.setor.slice(1).toLowerCase()}`}
      mes={dados.mes}
      hrefMes={hrefMes}
      hrefSair={hrefSair}
      menu={menu}
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
                  <VisaoVolume h={h} mes={dados.mes} pessoas={dados.pessoas.length} custoMes={custo} />
                ) : visao === "antecedencia" ? (
                  <VisaoAntecedencia ant={ant!} />
                ) : visao === "giro" ? (
                  <VisaoGiro h={h} />
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

function VisaoVolume({ h, mes, pessoas, custoMes }: { h: DadosHarpiaAbastecimento; mes: string; pessoas: number; custoMes: number | null }) {
  const [dia, setDia] = useState<string | null>(null);
  const resumo = resumoVolume(h.dias);
  if (h.dias.length === 0) return <Vazio>Nenhum abastecimento registrado neste mês.</Vazio>;
  const porDiaCx = new Map(h.dias.map((d) => [d.dia, d.caixas]));
  const caixasPorPessoaDia = pessoas && resumo.dias ? resumo.caixas / pessoas / resumo.dias : null;
  const skusPorPessoaDia = pessoas && resumo.skusMedioDia !== null ? resumo.skusMedioDia / pessoas : null;
  const custoPorCaixa = custoMes !== null && resumo.caixas > 0 ? custoMes / resumo.caixas : null;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <Mini rotulo="Caixas" valor={n0(resumo.caixas)} sub={`${resumo.dias} dias com abastecimento`} />
        <Mini rotulo="Unidades" valor={n0(resumo.unidades)} />
        <Mini rotulo="SKUs por dia" valor={resumo.skusMedioDia !== null ? n0(resumo.skusMedioDia) : "—"} sub="produtos distintos, média do dia" />
        <Mini rotulo="Abastecimentos" valor={n0(resumo.abastecimentos)} sub={resumo.dias ? `${n0(resumo.abastecimentos / resumo.dias)} por dia` : undefined} />
        <Mini rotulo="Caixas por pessoa/dia" valor={caixasPorPessoaDia !== null ? n1(caixasPorPessoaDia) : "—"} sub={pessoas ? `${pessoas} pessoas no setor` : "nenhuma pessoa cadastrada no setor"} />
        <Mini rotulo="SKUs por pessoa/dia" valor={skusPorPessoaDia !== null ? n1(skusPorPessoaDia) : "—"} sub="eficiência da equipe, não por pessoa" />
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Bloco titulo="Caixas abastecidas por dia" direita={<Dica>clique num dia para filtrar</Dica>}>
          <CalendarioBI mes={mes} porDia={porDiaCx} fmt={n0} selecionado={dia} onSelecionar={setDia} vazio="sem abastecimento" />
        </Bloco>
        <div className="grid min-h-0 grid-rows-2 gap-4">
          <Bloco titulo="Unidades abastecidas por dia">
            <BarrasTV
              altura={150}
              fmt={n0}
              onClick={(d) => setDia(dia === d ? null : d)}
              itens={h.dias.map((d) => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), valor: d.unidades, detalhe: `${ddmm(d.dia)} · ${n0(d.unidades)} un`, selecionado: d.dia === dia }))}
            />
          </Bloco>
          <Bloco titulo="SKUs distintos abastecidos por dia" direita={<Dica>custo por caixa: {custoPorCaixa !== null ? formatBRL(custoPorCaixa) : "—"}</Dica>}>
            <BarrasTV
              altura={150}
              fmt={n0}
              onClick={(d) => setDia(dia === d ? null : d)}
              itens={h.dias.map((d) => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), valor: d.skus, detalhe: `${ddmm(d.dia)} · ${n0(d.skus)} SKUs`, selecionado: d.dia === dia }))}
            />
          </Bloco>
        </div>
      </div>
    </div>
  );
}

// --- ANTECEDÊNCIA ---------------------------------------------------------------

function VisaoAntecedencia({ ant }: { ant: ReturnType<typeof resumoAntecedencia> }) {
  if (ant.total === 0) return <Vazio>Nenhuma carga abastecida neste mês.</Vazio>;
  const pctAntes = ant.antes + ant.depoisOuJunto > 0 ? ant.antes / (ant.antes + ant.depoisOuJunto) : null;
  const maxFaixa = Math.max(1, ...ant.faixas.map((f) => f.qtd));
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini rotulo="Cargas analisadas" valor={n0(ant.total)} sub={ant.semSeparacao ? `${ant.semSeparacao} ainda sem separação` : undefined} />
        <Mini rotulo="Abastecido antes" valor={pctAntes !== null ? formatPercent(pctAntes, 0) : "—"} sub={`${n0(ant.antes)} de ${n0(ant.antes + ant.depoisOuJunto)} cargas`} />
        <Mini rotulo="Mediana de folga" valor={ant.medianaHoras !== null ? `${n1(ant.medianaHoras)}h` : "—"} sub="entre o abastecimento e o fim da separação" />
        <Mini rotulo="Depois ou junto" valor={n0(ant.depoisOuJunto)} sub="carga separada sem folga de abastecimento" />
      </div>
      <Bloco titulo="Distribuição da folga">
        <BarrasTV
          altura={220}
          fmt={n0}
          itens={ant.faixas.map((f) => ({ chave: f.chave, rotulo: f.rotulo, valor: f.qtd, detalhe: `${f.rotulo} · ${n0(f.qtd)} cargas`, cor: f.qtd === maxFaixa ? "#c2820a" : "#5b6fd6" }))}
        />
        <p className="mt-3 text-xs text-white/35">Folga = horas entre o 1º abastecimento que serviu a carga e o fim da separação dela. &quot;Depois/junto&quot; nunca deveria ter volume relevante — o abastecimento alimenta o estoque que a separação consome.</p>
      </Bloco>
    </div>
  );
}

// --- GIRO DE PICKING -------------------------------------------------------------

function VisaoGiro({ h }: { h: DadosHarpiaAbastecimento }) {
  const diasAtivos = resumoVolume(h.dias).dias;
  const max = Math.max(1, ...h.produtos.map((p) => p.abastecimentos));
  if (h.produtos.length === 0) return <Vazio>Nenhum abastecimento registrado neste mês.</Vazio>;
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Mini rotulo="Produtos no top" valor={String(h.produtos.length)} sub="os 20 com mais abastecimentos" />
        <Mini rotulo="Dias com abastecimento" valor={String(diasAtivos)} />
        <Mini rotulo="Abastecimentos do top 20" valor={n0(h.produtos.reduce((t, p) => t + p.abastecimentos, 0))} />
      </div>
      <Bloco titulo="Produtos com mais abastecimentos" direita={<Dica>sem dado de capacidade do endereço — não é registrado para esses produtos no Harpia</Dica>}>
        <ul className="h-full space-y-2 overflow-auto pr-1">
          {h.produtos.map((p) => (
            <li key={p.produto}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-white" title={p.descricao ?? undefined}>
                  <span className="text-white/45">{p.produto}</span> {p.descricao ?? ""}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-white">
                  {n0(p.abastecimentos)} <span className="font-normal text-white/45">· {diasAtivos ? n1(p.abastecimentos / diasAtivos) : "—"}/dia</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#5b6fd6]" style={{ width: `${(p.abastecimentos / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Bloco>
    </div>
  );
}

// --- RUPTURAS --------------------------------------------------------------------

function VisaoRupturas({ h, mes }: { h: DadosHarpiaAbastecimento; mes: string }) {
  if (h.rupturas.length === 0) return <Vazio>Nenhuma ruptura de picking em {formatMesAno(mes)}.</Vazio>;
  const caixas = h.rupturas.reduce((t, r) => t + r.caixas, 0);
  const unidades = h.rupturas.reduce((t, r) => t + r.unidades, 0);
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Mini rotulo="Rupturas" valor={n0(h.rupturas.length)} sub={formatMesAno(mes)} />
        <Mini rotulo="Caixas faltantes" valor={n0(caixas)} />
        <Mini rotulo="Unidades faltantes" valor={n0(unidades)} />
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
