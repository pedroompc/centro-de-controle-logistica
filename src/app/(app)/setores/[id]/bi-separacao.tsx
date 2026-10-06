"use client";

/**
 * BI da Separação em tela cheia — mesma moldura e peças do BI do Recebimento.
 * Por enquanto o quadro "Custo e equipe" é o único com dado; Produção,
 * Conferência e Qualidade vêm do Harpia (WMS) e entram depois.
 */
import { useState } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { variacaoPercentual } from "@/domain/tendencias";
import { BIShell, type HrefMes } from "./bi-shell";
import {
  Quadro, Vazio, Bloco, Mini, useSub, Dica, BarrasTV, BarraComposicao,
  TabelaEquipe, ListaEquipamentos, SubFolha, semCentavos, type PapelBI,
} from "./bi-ui";
import type { DadosBISeparacao } from "./separacao-dados";

type VisaoSep = "custo" | "producao" | "conferencia" | "qualidade";

const VISOES: { id: VisaoSep; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo e equipe", contexto: "quem e o que compõe o custo — pessoas por função, salários e equipamentos" },
  { id: "producao", titulo: "Produção", contexto: "caixas, mapas e pedidos separados por dia" },
  { id: "conferencia", titulo: "Conferência", contexto: "caixas conferidas por conferente e por hora" },
  { id: "qualidade", titulo: "Qualidade", contexto: "divergências pegas na conferência" },
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
  const abrir = (v: VisaoSep) => setVisao((a) => (a === v ? null : v));
  const titulo = visao ? VISOES.find((v) => v.id === visao)! : null;

  const custo = custoDoMes(dados, dados.mes);
  const i = dados.serie.findIndex((x) => x.mes === dados.mes);
  const anterior = i > 0 ? custoDoMes(dados, dados.serie[i - 1].mes) : null;
  const delta = custo !== null && anterior ? variacaoPercentual(custo, anterior) : null;
  const conta = (id: string) => dados.pessoas.filter((y) => y.papel === id).length;
  const q = (v: VisaoSep) => ({ ativo: visao === v, onClick: () => abrir(v) });

  const menu = (
    <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Quadro
        {...q("custo")}
        rotulo="Custo e equipe"
        valor={custo === null ? "—" : semCentavos(custo)}
        sub={`${dados.pessoas.length} pessoas · ${conta("separador")} sep · ${conta("conferente")} conf${delta !== null ? ` · ${delta > 0 ? "+" : ""}${formatPercent(delta, 1)} vs mês anterior` : ""}`}
      />
      <Quadro {...q("producao")} rotulo="Produção" valor="em breve" sub="caixas separadas por dia · Harpia" />
      <Quadro {...q("conferencia")} rotulo="Conferência" valor="em breve" sub="caixas por conferente · Harpia" />
      <Quadro {...q("qualidade")} rotulo="Qualidade" valor="em breve" sub="divergências na conferência · Harpia" />
    </div>
  );

  return (
    <BIShell
      titulo={`BI da ${dados.setor.charAt(0)}${dados.setor.slice(1).toLowerCase()}`}
      mes={dados.mes}
      hrefMes={hrefMes}
      hrefSair={hrefSair}
      menu={menu}
      palco={
        visao && titulo
          ? { chave: visao, titulo: titulo.titulo, contexto: titulo.contexto, conteudo: visao === "custo" ? <VisaoCusto dados={dados} /> : <EmBreve visao={visao} /> }
          : null
      }
    />
  );
}

function EmBreve({ visao }: { visao: VisaoSep }) {
  const texto: Record<VisaoSep, string> = {
    custo: "",
    producao: "Caixas, unidades, mapas, pedidos e clientes separados por dia (calendário), vindos dos mapas de separação do Harpia.",
    conferencia: "Caixas conferidas por conferente e por hora — o Harpia grava quem conferiu e quando, item a item.",
    qualidade: "Divergências pegas na conferência (quantidade bipada ≠ carga), por dia, produto e endereço.",
  };
  return (
    <Vazio>
      <div className="max-w-xl space-y-3">
        <p className="text-xl font-semibold text-white/70">Em construção</p>
        <p className="text-base text-white/50">{texto[visao]}</p>
        <p className="text-sm text-white/35">Depende de o app ter leitura das tabelas do Harpia (esquema HARPIAW2) no Oracle.</p>
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
