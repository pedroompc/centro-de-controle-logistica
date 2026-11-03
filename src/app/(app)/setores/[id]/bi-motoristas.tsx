"use client";

/**
 * BI dos Motoristas em tela cheia. A entrega vem do Winthor: nota de venda em
 * carga → carga (motorista, ajudante, veículo) → capacidade do veículo. VIAGEM =
 * veículo + motorista + dia de saída da nota; peso pelas notas. Clicar num dia
 * filtra Custo, Entregas, Frota e Devolução; Esc limpa. Devolução é POR PERÍODO
 * DE FATURAMENTO: das notas saídas no dia/mês, as que voltaram por motivo da Logística.
 */
import { useState } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { variacaoPercentual } from "@/domain/tendencias";
import { custoDoPeriodo, custoSobreFaturamento } from "@/domain/separacao";
import { totaisEntregas, porDiaEntregas, porVeiculo, faixasOcupacao, resumoDevolucao, devolucaoPorDia, type ViagemEntrega, type DiaEntregas } from "@/domain/motoristas";
import { BIShell, type HrefMes } from "./bi-shell";
import {
  Quadro, Vazio, Bloco, Mini, useSub, Dica, BarrasTV, BarraComposicao, TabelaEquipe, ListaEquipamentos, SubFolha, CalendarioBI, ChipTV, ddmm, semCentavos, type PapelBI,
} from "./bi-ui";
import { DUAS_COLUNAS, GRADE_CARDS, GRADE_MENU, VISAO, Tabela, n0, n1, t1, brl, pct, sinalPct, varRel, ou } from "./bi-separacao-comum";
import type { DadosBIMotoristas, MotoristaBI, PontoHistoricoMot } from "./motoristas-dados";

type VisaoMot = "custo" | "entregas" | "frota" | "motoristas" | "devolucao";

const VISOES: { id: VisaoMot; titulo: string; admin?: boolean }[] = [
  { id: "custo", titulo: "Custo e equipe" },
  { id: "entregas", titulo: "Entregas" },
  { id: "frota", titulo: "Frota e ocupação" },
  { id: "motoristas", titulo: "Motoristas", admin: true },
  { id: "devolucao", titulo: "Devolução logística" },
];

const PAPEIS: PapelBI[] = [
  { id: "motorista", rotulo: "Motorista", plural: "Motoristas", cor: "#5b6fd6" },
  { id: "ajudante", rotulo: "Ajudante", plural: "Ajudantes", cor: "#8b93e0" },
  { id: "lider", rotulo: "Líder", plural: "Liderança", cor: "#a78bfa" },
  { id: "outros", rotulo: "Outros", plural: "Outros", cor: "#64748b" },
];

const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);
const comViagens = (e: DadosBIMotoristas["entregas"]): e is { viagens: ViagemEntrega[] } => "viagens" in e;
const ROT_TIPO = { F: "casa", T: "terceiro" } as const;
/** "JOSE RAPHAEL OLIVEIRA DA SILVA" → "JOSE SILVA" (primeiro + último). */
const nomeCurto = (nome: string) => {
  const t = nome.trim().split(/\s+/);
  return t.length > 1 ? `${t[0]} ${t[t.length - 1]}` : t[0];
};

/** Indicadores do recorte (mês ou 1 dia) — a MESMA conta alimenta cards e gráficos. */
function indicadores(d: DadosBIMotoristas, dia: string | null) {
  const vs = comViagens(d.entregas) ? d.entregas.viagens : null;
  const h = d.historico.find((x) => x.mes === d.mes) ?? null;
  const totMes = vs ? totaisEntregas(vs) : null;
  const tot = vs ? totaisEntregas(vs, dia) : null;
  const custo = custoDoPeriodo(h?.custo ?? null, d.fracaoMes, totMes?.dias ?? 0, !!dia);
  const por = (q: number | undefined) => (custo === null || !q ? null : custo / q);
  return {
    vs,
    h,
    tot,
    custo,
    porEntrega: por(tot?.entregas),
    porViagem: por(tot?.viagens),
    porTonelada: tot && tot.kg > 0 && custo !== null ? custo / (tot.kg / 1000) : null,
    sobreFat: custoSobreFaturamento(h?.custoPeriodo ?? null, d.faturamentoLiquido),
  };
}

function anteriorDe(d: DadosBIMotoristas): PontoHistoricoMot | null {
  const i = d.historico.findIndex((x) => x.mes === d.mes);
  return i > 0 ? d.historico[i - 1] : null;
}


export function BIMotoristas({ dados, hrefMes, hrefSair }: { dados: DadosBIMotoristas; hrefMes: HrefMes; hrefSair: string }) {
  const [visao, setVisao] = useState<VisaoMot | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const abrir = (v: VisaoMot) => setVisao((a) => (a === v ? null : v));
  const visoes = VISOES.filter((v) => !v.admin || (dados.admin && dados.motoristas));
  const titulo = visao ? visoes.find((v) => v.id === visao) ?? null : null;
  const q = (v: VisaoMot) => ({ ativo: visao === v, onClick: () => abrir(v) });

  const ind = indicadores(dados, dia);
  const { vs, tot, h } = ind;
  const ant = anteriorDe(dados);
  const entDiaVar = h?.entregas && h.dias && ant?.entregas && ant.dias ? varRel(h.entregas / h.dias, ant.entregas / ant.dias) : null;
  const deltaCusto = h?.custo != null && ant?.custo ? variacaoPercentual(h.custo, ant.custo) : null;
  const semDado = vs ? null : "sem acesso ao Winthor";
  const dev = dados.devolucao ? resumoDevolucao(dados.devolucao, dia) : null;
  const sufixo = (r: string) => (dia ? `${r} · ${ddmm(dia)}` : r);

  const menu = (
    <div className={`mt-4 ${GRADE_MENU}`}>
      <Quadro
        {...q("custo")}
        rotulo={sufixo("Custo e equipe")}
        valor={ind.custo === null ? "—" : semCentavos(ind.custo)}
        sub={`${ind.sobreFat !== null ? `${formatPercent(ind.sobreFat, 2)} do fat. líquido · ` : ""}${dados.pessoas.length} pessoas${deltaCusto !== null ? ` · ${sinalPct(deltaCusto)} vs mês anterior` : ""}`}
      />
      <Quadro
        {...q("entregas")}
        rotulo={sufixo("Entregas")}
        valor={tot ? n0(tot.entregas) : "—"}
        sub={semDado ?? `${n0(tot!.viagens)} viagens · ${t1(tot!.kg)}${!dia && entDiaVar !== null ? ` · ${sinalPct(entDiaVar)}/dia` : ""}`}
      />
      <Quadro
        {...q("frota")}
        rotulo={sufixo("Ocupação da frota")}
        valor={tot ? pct(tot.ocupacao, 0) : "—"}
        sub={semDado ?? `${tot!.veiculos} veículos · ${ou(tot!.kgPorViagem, n0)} kg/viagem`}
      />
      {dados.admin && dados.motoristas && (
        <Quadro {...q("motoristas")} rotulo="Motoristas" valor={`${dados.motoristas.length}`} sub={`${dados.motoristas.filter((m) => m.tipo === "F").length} da casa · ${dados.motoristas.filter((m) => m.tipo === "T").length} terceiros`} />
      )}
      <Quadro
        {...q("devolucao")}
        rotulo={sufixo("Devolução logística")}
        valor={dev ? pct(dev.taxa, 2) : "—"}
        sub={dev ? `${n0(dev.devolvidas)} notas · ${semCentavos(Math.round(dev.valorDevolvido))}` : "sem acesso ao Winthor"}
      />
    </div>
  );

  return (
    <BIShell
      titulo="BI dos Motoristas"
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
                ) : visao === "devolucao" ? (
                  <VisaoDevolucao dados={dados} dia={dia} onDia={setDia} />
                ) : !vs ? (
                  <SemWinthor erro={"erro" in dados.entregas ? dados.entregas.erro : ""} />
                ) : visao === "entregas" ? (
                  <VisaoEntregas dados={dados} vs={vs} dia={dia} onDia={setDia} />
                ) : visao === "frota" ? (
                  <VisaoFrota vs={vs} dia={dia} />
                ) : visao === "motoristas" && dados.motoristas ? (
                  <VisaoMotoristas lista={dados.motoristas} mes={dados.mes} />
                ) : null,
            }
          : null
      }
    />
  );
}

function SemWinthor({ erro }: { erro: string }) {
  return (
    <Vazio>
      <div className="max-w-2xl space-y-3">
        <p className="text-xl font-semibold text-white/70">Não consegui ler o Winthor</p>
        <p className="text-base text-white/50">A consulta ao Oracle falhou. Confira se o banco está acessível de onde o app roda.</p>
        {erro && <p className="font-mono text-xs text-white/35">{erro}</p>}
      </div>
    </Vazio>
  );
}

// --- CUSTO E EQUIPE (mesmo modelo dos outros BIs) ----------------------------

type SubCusto = "custo" | "equipe" | "folha" | "equipamentos" | "entrega" | "fat";
const TITULO_SUB: Record<SubCusto, string> = {
  custo: "Custo do mês", equipe: "Equipe", folha: "Folha", equipamentos: "Equipamentos", entrega: "Custo por entrega", fat: "Custo ÷ faturamento líquido",
};

type MedidaCusto = "custo" | "fat" | "entrega" | "tonelada";
const MEDIDA_CUSTO: Record<MedidaCusto, { valor: (x: PontoHistoricoMot) => number | null; fmt: (v: number) => string }> = {
  custo: { valor: (x) => x.custo, fmt: semCentavos },
  fat: { valor: (x) => custoSobreFaturamento(x.custoPeriodo, x.faturamentoLiquido), fmt: (v) => formatPercent(v, 2) },
  entrega: { valor: (x) => (x.custoPeriodo !== null && x.entregas ? x.custoPeriodo / x.entregas : null), fmt: (v) => formatBRL(v) },
  tonelada: { valor: (x) => (x.custoPeriodo !== null && x.kg ? x.custoPeriodo / (x.kg / 1000) : null), fmt: semCentavos },
};

function VisaoCusto({ dados, dia }: { dados: DadosBIMotoristas; dia: string | null }) {
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
        <Mini {...card("custo")} rotulo={dia ? `Custo do dia ${ddmm(dia)}` : "Custo do mês"} valor={brl(ind.custo)} sub={ind.h?.custo == null ? "mês sem foto do efetivo" : dia ? "custo do mês ÷ dias com entrega" : dados.fracaoMes < 1 ? "proporcional aos dias corridos" : formatMesAno(dados.mes)} />
        <Mini {...card("equipe")} rotulo="Equipe" valor={`${pessoas.length} pessoas`} sub={presentes.map((pp) => `${pessoas.filter((y) => y.papel === pp.id).length} ${pp.rotulo.toLowerCase().slice(0, 4)}.`).join(" · ")} />
        <Mini {...card("folha")} rotulo="Folha (cadastro atual)" valor={formatBRL(folha)} sub="por mês, com encargos" />
        <Mini {...card("equipamentos")} rotulo="Equipamentos" valor={formatBRL(custoEquip)} sub={`${equipamentos.reduce((s, e) => s + e.quantidade, 0)} unidades · por mês`} />
        <Mini {...card("entrega")} rotulo="Custo por entrega" valor={brl(ind.porEntrega)} sub={t ? `${n0(t.entregas)} entregas` : undefined} />
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
                const tg = g.reduce((s, y) => s + y.custo, 0);
                return (
                  <li key={pp.id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-bold text-white">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: pp.cor }} />
                        {pp.plural} · {g.length}
                      </span>
                      <span className="font-bold tabular-nums text-white">{formatBRL(tg)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${folha > 0 ? (tg / folha) * 100 : 0}%`, background: pp.cor }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-white/45">
                      <span>{formatPercent(folha > 0 ? tg / folha : 0, 0)} da folha</span>
                      <span>média {formatBRL(tg / g.length)} por pessoa</span>
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

      {sub === "entrega" && (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
          <div className="grid grid-cols-2 content-start gap-3">
            <Mini rotulo="Custo por entrega" valor={brl(ind.porEntrega)} sub={t ? `${n0(t.entregas)} entregas` : undefined} />
            <Mini rotulo="Custo por viagem" valor={brl(ind.porViagem)} sub={t ? `${n0(t.viagens)} viagens` : undefined} />
            <Mini rotulo="Custo por tonelada" valor={ind.porTonelada === null ? "—" : semCentavos(ind.porTonelada)} sub={t ? t1(t.kg) : undefined} />
            <Mini rotulo="Custo por pessoa" valor={pessoas.length ? formatBRL(total / pessoas.length) : "—"} sub="média, com equipamentos" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0 xl:grid-rows-2">
            <Bloco titulo="Custo por entrega · mês a mês">{serie("entrega", 140)}</Bloco>
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

// --- ENTREGAS -----------------------------------------------------------------

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
type MedidaEnt = "entregas" | "viagens" | "kg";
const ROT_ENT: Record<MedidaEnt, string> = { entregas: "Entregas", viagens: "Viagens", kg: "Toneladas" };

function VisaoEntregas({ dados, vs, dia, onDia }: { dados: DadosBIMotoristas; vs: ViagemEntrega[]; dia: string | null; onDia: (d: string | null) => void }) {
  const [medida, setMedida] = useState<MedidaEnt>("entregas");
  if (vs.length === 0) return <Vazio>Nenhuma entrega neste mês.</Vazio>;
  const r = totaisEntregas(vs, dia);
  const dias = [...porDiaEntregas(vs).entries()].sort(([a], [b]) => a.localeCompare(b));
  const valorDe = (x: DiaEntregas) => (medida === "kg" ? x.kg / 1000 : x[medida]);
  const fmtM = medida === "kg" ? (v: number) => `${n1(v)} t` : n0;
  const soma = Array(7).fill(0);
  const qtd = Array(7).fill(0);
  for (const [d, x] of dias) {
    const [a, m, dd] = d.split("-").map(Number);
    const w = new Date(a, m - 1, dd).getDay();
    soma[w] += valorDe(x);
    qtd[w] += 1;
  }
  const hist = dados.historico.filter((x) => x.entregas !== null);
  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(28rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Entregas" valor={n0(r.entregas)} sub={r.dias ? `${n0(r.entregas / r.dias)}/dia` : undefined} />
        <Mini rotulo="Viagens" valor={n0(r.viagens)} sub={r.dias ? `${n1(r.viagens / r.dias)}/dia` : undefined} />
        <Mini rotulo="Entregas por viagem" valor={ou(r.entregasPorViagem, n1)} />
        <Mini rotulo="Peso" valor={t1(r.kg)} sub={r.kgPorViagem !== null ? `${n0(r.kgPorViagem)} kg/viagem` : undefined} />
        <Mini rotulo="Notas" valor={n0(r.notas)} sub={`${n0(r.cargas)} cargas`} />
        <Mini rotulo="Valor entregue" valor={semCentavos(Math.round(r.valor))} />
        <Mini rotulo="Motoristas" valor={n0(r.motoristas)} />
        <Mini rotulo="Veículos" valor={n0(r.veiculos)} />
      </div>
      <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}>
        <Bloco
          className="min-h-[22rem] xl:min-h-0"
          titulo={`${ROT_ENT[medida]} por dia`}
          direita={
            <div className="flex flex-wrap justify-end gap-1.5">
              {(Object.keys(ROT_ENT) as MedidaEnt[]).map((k) => (
                <ChipTV key={k} ativo={medida === k} onClick={() => setMedida(k)}>
                  {ROT_ENT[k]}
                </ChipTV>
              ))}
            </div>
          }
        >
          <CalendarioBI mes={dados.mes} porDia={new Map(dias.map(([d, x]) => [d, valorDe(x)]))} fmt={fmtM} selecionado={dia} onSelecionar={onDia} vazio="sem entrega" />
        </Bloco>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0 xl:grid-rows-2">
          <Bloco titulo={`Média por dia da semana · ${ROT_ENT[medida].toLowerCase()}`}>
            <BarrasTV altura={140} fmt={fmtM} itens={SEMANA.map((rot, w) => ({ chave: rot, rotulo: rot, valor: qtd[w] ? soma[w] / qtd[w] : null, detalhe: `${rot} · ${qtd[w]} dias` }))} />
          </Bloco>
          <Bloco titulo="Entregas por dia · mês a mês">
            <BarrasTV
              altura={140}
              fmt={n0}
              itens={hist.map((x) => ({
                chave: x.mes,
                rotulo: mesCurto(x.mes) + (x.parcial ? "*" : ""),
                valor: x.dias ? x.entregas! / x.dias : null,
                cor: x.mes === dados.mes ? "#c2820a" : "#5b6fd6",
                detalhe: `${formatMesAno(x.mes)} · ${x.dias} dias · ${n0(x.entregas!)} entregas · ${n0(x.viagens ?? 0)} viagens`,
              }))}
            />
          </Bloco>
        </div>
      </div>
    </div>
  );
}

// --- FROTA E OCUPAÇÃO -----------------------------------------------------------

function VisaoFrota({ vs, dia }: { vs: ViagemEntrega[]; dia: string | null }) {
  const recorte = dia ? vs.filter((x) => x.dia === dia) : vs;
  if (recorte.length === 0) return <Vazio>Nenhuma viagem no recorte.</Vazio>;
  const r = totaisEntregas(recorte);
  const veic = porVeiculo(recorte);
  const faixas = faixasOcupacao(recorte);
  const semCap = recorte.filter((x) => !x.capacidadeKg).length;
  const corFaixa: Record<string, string> = { ate40: "#e11d48", "40-60": "#f59e0b", "60-80": "#5b6fd6", "80-100": "#818cf8", "100+": "#a78bfa" };
  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(24rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Ocupação média" valor={pct(r.ocupacao, 0)} sub="peso ÷ capacidade do veículo" />
        <Mini rotulo="Veículos" valor={n0(r.veiculos)} sub={r.dias ? `${n1(r.viagens / r.dias)} viagens/dia` : undefined} />
        <Mini rotulo="Kg por viagem" valor={ou(r.kgPorViagem, n0)} />
        <Mini rotulo="Viagens até 40%" valor={n0(faixas[0].qtd)} sub={`de ${n0(r.viagens - semCap)} com capacidade`} />
        {semCap > 0 && <Mini rotulo="Sem capacidade" valor={n0(semCap)} sub="veículo sem capacidade no cadastro" />}
      </div>
      <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]`}>
        <Bloco titulo="Viagens por faixa de ocupação">
          <BarrasTV altura={220} fmt={n0} itens={faixas.map((f) => ({ chave: f.chave, rotulo: f.rotulo, valor: f.qtd, cor: corFaixa[f.chave] }))} />
        </Bloco>
        <Bloco titulo="Por veículo" direita={<Dica>{veic.length} veículos</Dica>}>
          <div className="h-full overflow-auto pr-1">
            <Tabela
              cab={["Veículo", "Capacidade", "Viagens", "Dias", "Entregas", "Peso", "Ocupação", "Motoristas"]}
              alinhar={["l", "r", "r", "r", "r", "r", "r", "r"]}
              linhas={veic.map((x) => [
                <span key="v" className="block max-w-[20rem] truncate" title={x.descricao ?? undefined}>
                  {x.placa ?? `Veículo ${x.veiculo}`} <span className="text-white/40">{(x.descricao ?? "").replace(x.placa ?? "", "").replace(/^\s*-\s*/, "")}</span>
                </span>,
                x.capacidadeKg ? `${n0(x.capacidadeKg)} kg` : "—",
                n0(x.viagens),
                n0(x.dias),
                n0(x.entregas),
                t1(x.kg),
                <span key="o" className={x.ocupacao !== null && x.ocupacao <= 0.4 ? "text-rose-300" : ""}>{pct(x.ocupacao, 0)}</span>,
                n0(x.motoristas),
              ])}
            />
          </div>
        </Bloco>
      </div>
    </div>
  );
}

// --- MOTORISTAS (admin) ---------------------------------------------------------

type OrdemMot = "entregas" | "kg" | "ocupacao" | "devolucao" | "custo";
const ORDENS: Record<OrdemMot, { rotulo: string; valor: (m: MotoristaBI) => number | null; desc: boolean }> = {
  entregas: { rotulo: "Entregas", valor: (m) => m.entregas, desc: true },
  kg: { rotulo: "Peso", valor: (m) => m.kg, desc: true },
  ocupacao: { rotulo: "Ocupação", valor: (m) => m.ocupacao, desc: true },
  devolucao: { rotulo: "Devolução", valor: (m) => m.devolucao?.taxa ?? null, desc: true },
  custo: { rotulo: "Custo/entrega", valor: (m) => m.custoPorEntrega, desc: false },
};

function VisaoMotoristas({ lista, mes }: { lista: MotoristaBI[]; mes: string }) {
  const [tipo, setTipo] = useState<"F" | "T" | null>(null);
  const [ordem, setOrdem] = useState<OrdemMot>("entregas");
  const o = ORDENS[ordem];
  const itens = lista
    .filter((m) => !tipo || m.tipo === tipo)
    .sort((a, b) => ((o.valor(b) ?? (o.desc ? -Infinity : Infinity)) - (o.valor(a) ?? (o.desc ? -Infinity : Infinity))) * (o.desc ? 1 : -1));
  const casa = lista.filter((m) => m.tipo === "F");
  const terc = lista.filter((m) => m.tipo === "T");
  const media = (g: MotoristaBI[]) => {
    const dias = g.reduce((s, m) => s + m.dias, 0);
    return dias > 0 ? g.reduce((s, m) => s + m.entregas, 0) / dias : null;
  };
  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(20rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Motoristas" valor={String(lista.length)} sub={`${casa.length} casa · ${terc.length} terceiros`} />
        <Mini rotulo="Entregas/dia · casa" valor={ou(media(casa), n1)} sub="por motorista" />
        <Mini rotulo="Entregas/dia · terceiro" valor={ou(media(terc), n1)} sub="por motorista" />
        <Mini rotulo="Ligados ao Efetivo" valor={`${casa.filter((m) => m.funcionarioId).length} de ${casa.length}`} sub="casa, pelo nome" />
      </div>
      <Bloco
        titulo={`Motoristas · ${formatMesAno(mes)}`}
        direita={
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipTV ativo={tipo === "F"} onClick={() => setTipo(tipo === "F" ? null : "F")}>
              casa
            </ChipTV>
            <ChipTV ativo={tipo === "T"} onClick={() => setTipo(tipo === "T" ? null : "T")}>
              terceiros
            </ChipTV>
            <span className="mx-1 text-white/20">|</span>
            {(Object.keys(ORDENS) as OrdemMot[]).map((k) => (
              <ChipTV key={k} ativo={ordem === k} onClick={() => setOrdem(k)}>
                {ORDENS[k].rotulo}
              </ChipTV>
            ))}
          </div>
        }
      >
        <div className="h-full overflow-auto pr-1">
          <Tabela
            cab={["Motorista", "Tipo", "Dias", "Viagens", "Entregas", "Entregas/dia", "Peso", "Ocupação", "Devolução", "Custo/entrega"]}
            alinhar={["l", "l", "r", "r", "r", "r", "r", "r", "r", "r"]}
            linhas={itens.map((m) => [
              m.nome,
              <span key="t" className="text-white/50">{m.tipo ? ROT_TIPO[m.tipo] : "—"}</span>,
              n0(m.dias),
              n0(m.viagens),
              n0(m.entregas),
              m.dias ? n1(m.entregas / m.dias) : "—",
              t1(m.kg),
              pct(m.ocupacao, 0),
              m.devolucao ? <span key="d" title={`${m.devolucao.devolvidas} de ${m.devolucao.expedidas} notas`}>{pct(m.devolucao.taxa, 2)}</span> : "—",
              brl(m.custoPorEntrega),
            ])}
          />
        </div>
      </Bloco>
    </div>
  );
}

// --- DEVOLUÇÃO LOGÍSTICA --------------------------------------------------------

function VisaoDevolucao({ dados, dia, onDia }: { dados: DadosBIMotoristas; dia: string | null; onDia: (d: string | null) => void }) {
  if (!dados.devolucao) return <SemWinthor erro="" />;
  const r = resumoDevolucao(dados.devolucao, dia);
  const porDia = devolucaoPorDia(dados.devolucao);
  const minimo = dia ? 10 : 50;
  const piores = r.porMotorista.filter((m) => m.expedidas >= minimo).sort((a, b) => (b.taxa ?? 0) - (a.taxa ?? 0)).slice(0, 12);
  const pior = [...porDia.entries()].filter(([, x]) => x.expedidas >= 200).sort(([, a], [, b]) => (b.taxa ?? 0) - (a.taxa ?? 0))[0] ?? null;
  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(26rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo={dia ? `Taxa · ${ddmm(dia)}` : "Taxa (notas)"} valor={pct(r.taxa, 2)} sub={`${n0(r.devolvidas)} de ${n0(r.expedidas)} notas faturadas`} />
        <Mini rotulo="Valor devolvido" valor={semCentavos(Math.round(r.valorDevolvido))} sub={r.valorExpedido > 0 ? `${formatPercent(r.valorDevolvido / r.valorExpedido, 2)} do expedido` : undefined} />
        <Mini rotulo="Motoristas com devolução" valor={n0(r.porMotorista.filter((m) => m.devolvidas > 0).length)} sub={`de ${n0(r.porMotorista.length)}`} />
        {!dia && pior && <Mini rotulo="Pior dia" valor={pct(pior[1].taxa, 2)} sub={`${ddmm(pior[0])} · ${n0(pior[1].devolvidas)} de ${n0(pior[1].expedidas)} notas`} onClick={() => onDia(pior[0])} />}
      </div>
      <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}>
        <Bloco className="min-h-[22rem] xl:min-h-0" titulo="Taxa por dia de faturamento">
          <CalendarioBI
            mes={dados.mes}
            porDia={new Map([...porDia.entries()].flatMap(([d, x]) => (x.taxa === null ? [] : [[d, x.taxa] as [string, number]])))}
            fmt={(v) => formatPercent(v, 1)}
            selecionado={dia}
            onSelecionar={onDia}
            vazio="sem nota"
            menorEhMelhor
          />
        </Bloco>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]">
          <Bloco titulo="Maior taxa" direita={<Dica>{minimo}+ notas {dia ? "no dia" : "no mês"}</Dica>}>
            <BarrasTV
              altura={150}
              fmt={(v) => formatPercent(v, 1)}
              itens={piores.map((m) => ({ chave: String(m.codMotorista), rotulo: nomeCurto(m.nome), valor: m.taxa, cor: "#e11d48", detalhe: `${m.nome} · ${m.devolvidas} de ${m.expedidas} notas` }))}
            />
          </Bloco>
          <Bloco titulo="Por motorista">
            <div className="h-full overflow-auto pr-1">
              <Tabela
                cab={["Motorista", "Tipo", "Notas", "Devolvidas", "Taxa", "Valor devolvido"]}
                alinhar={["l", "l", "r", "r", "r", "r"]}
                linhas={r.porMotorista.map((m) => [
                  m.nome,
                  <span key="t" className="text-white/50">{m.tipo ? ROT_TIPO[m.tipo] : "—"}</span>,
                  n0(m.expedidas),
                  n0(m.devolvidas),
                  pct(m.taxa, 2),
                  formatBRL(m.valorDevolvido),
                ])}
              />
            </div>
          </Bloco>
        </div>
      </div>
    </div>
  );
}
