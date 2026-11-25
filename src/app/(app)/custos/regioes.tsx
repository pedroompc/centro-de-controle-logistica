"use client";

import { useState } from "react";
import { ratearPorRegiao, type CustoRegiao, type RegiaoCusto } from "@/domain/custo-regioes";
import { fracao } from "@/domain/custo-grupos";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import type { BaseRegioesMes } from "@/data/custo-regioes";
import { Card, SectionTitle } from "@/components/ui";

const NOME: Record<RegiaoCusto, string> = {
  RMR: "RMR",
  Litoral: "Litoral",
  "Zona da Mata": "Zona da Mata",
  Agreste: "Agreste",
  "Sertão": "Sertão",
  Outras: "Outras",
  Retira: "Retira no balcão",
};

const SUB: Partial<Record<RegiaoCusto, string>> = {
  RMR: "Região Metropolitana do Recife",
  Outras: "Noronha, fora de PE e cidades sem rota",
  Retira: "Cliente busca no CD: usa o galpão, não usa caminhão",
};

const num = (v: number) => Math.round(v).toLocaleString("pt-BR");
/** "R$ 6,40" de custo a cada R$ 100 vendidos. */
const porCem = (custo: number, venda: number) => (venda > 0 ? formatBRL((custo / venda) * 100) : "—");

export function CustoPorRegiao({
  mes,
  base,
  custoEntrega,
  custoGalpao,
}: {
  mes: string;
  base: BaseRegioesMes | null;
  custoEntrega: number;
  custoGalpao: number; // galpão + galpão administrativo
}) {
  const [comGalpao, setComGalpao] = useState(false);
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle>Quanto custa atender cada região · {formatMesAno(mes)}</SectionTitle>
        <button
          type="button"
          role="switch"
          aria-checked={comGalpao}
          onClick={() => setComGalpao((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          title="Incluir o custo do galpão (galpão + galpão administrativo) na conta de cada região"
        >
          <span className={`relative h-4 w-7 rounded-full transition ${comGalpao ? "bg-[#181d55]" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${comGalpao ? "left-3.5" : "left-0.5"}`} />
          </span>
          Incluir galpão
        </button>
      </div>
      <p className="-mt-1 mb-4 max-w-4xl text-sm text-slate-500">
        O custo das equipes no mês (sem o aluguel do galpão) dividido entre as regiões. A <b className="font-semibold text-slate-700">entrega</b> (motoristas,
        ajudantes e frota) vai pelo km que os caminhões rodaram em cada região.
        {comGalpao ? (
          <>
            {" "}O <b className="font-semibold text-slate-700">galpão</b> (galpão + galpão administrativo) vai pelo número de notas separadas.
          </>
        ) : (
          " Galpão fora da conta."
        )}
      </p>
      {base === null ? (
        <Card className="p-5 text-sm text-amber-700">Winthor indisponível agora: a divisão por região não carregou.</Card>
      ) : (
        <Conteudo base={base} custoEntrega={custoEntrega} custoGalpao={comGalpao ? custoGalpao : 0} comGalpao={comGalpao} />
      )}
    </section>
  );
}

function Conteudo({ base, custoEntrega, custoGalpao, comGalpao }: { base: BaseRegioesMes; custoEntrega: number; custoGalpao: number; comGalpao: boolean }) {
  // Sem galpão, a retira no balcão não tem custo nenhum (não usa caminhão): sai da tela.
  const linhas = ratearPorRegiao(base.regioes, custoEntrega, custoGalpao).filter((l) => comGalpao || l.regiao !== "Retira");
  const tot = linhas.reduce(
    (t, l) => ({
      custo: t.custo + l.custo, entrega: t.entrega + l.custoEntrega, galpao: t.galpao + l.custoGalpao, valor: t.valor + l.valor,
      entregas: t.entregas + l.entregas, notas: t.notas + l.notas, km: t.km + l.km, kmMedido: t.kmMedido + l.kmMedido,
    }),
    { custo: 0, entrega: 0, galpao: 0, valor: 0, entregas: 0, notas: 0, km: 0, kmMedido: 0 },
  );
  const media = fracao(tot.custo, tot.valor);
  const maiorPorCem = Math.max(...linhas.map((l) => (l.valor > 0 ? l.custo / l.valor : 0)));

  return (
    <>
      {/* Um cartão por região: o número que importa é "a cada R$ 100 vendidos" */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {linhas.map((l) => (
          <CartaoRegiao key={l.regiao} l={l} totalCusto={tot.custo} media={media} maior={maiorPorCem} comGalpao={comGalpao} />
        ))}
      </div>

      {/* Detalhe com todos os números e o total que fecha com o custo do mês */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Região</th>
                <th className="px-4 py-3 text-right font-semibold" title={comGalpao ? "Entrega + galpão" : "Entrega"}>Custo para atender</th>
                <th className="px-4 py-3 text-right font-semibold" title="Motoristas, ajudantes e frota, pelo km rodado">Entrega</th>
                {comGalpao && <th className="px-4 py-3 text-right font-semibold" title="Galpão + galpão administrativo, pelas notas">Galpão</th>}
                <th className="px-4 py-3 text-right font-semibold" title="Venda líquida (mesma base do faturamento do Início)">Venda</th>
                <th className="px-4 py-3 text-right font-semibold" title="Custo para atender ÷ venda">Custo a cada R$ 100</th>
                <th className="px-4 py-3 text-right font-semibold" title="Cliente atendido por dia">Entregas</th>
                <th className="px-4 py-3 text-right font-semibold">Custo por entrega</th>
                <th className="px-4 py-3 text-right font-semibold">Notas</th>
                <th className="px-4 py-3 text-right font-semibold">KM rodado</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {linhas.map((l) => (
                <tr key={l.regiao} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-[#141a4d]">{NOME[l.regiao]}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#141a4d]">{formatBRL(l.custo)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatBRL(l.custoEntrega)}</td>
                  {comGalpao && <td className="px-4 py-3 text-right text-slate-600">{formatBRL(l.custoGalpao)}</td>}
                  <td className="px-4 py-3 text-right text-slate-600">{formatBRL(l.valor)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#141a4d]">{porCem(l.custo, l.valor)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{num(l.entregas)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{l.entregas > 0 ? formatBRL(l.custo / l.entregas) : "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{num(l.notas)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{l.km > 0 ? num(l.km) : "—"}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold text-[#141a4d]">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{formatBRL(tot.custo)}</td>
                <td className="px-4 py-3 text-right">{formatBRL(tot.entrega)}</td>
                {comGalpao && <td className="px-4 py-3 text-right">{formatBRL(tot.galpao)}</td>}
                <td className="px-4 py-3 text-right">{formatBRL(tot.valor)}</td>
                <td className="px-4 py-3 text-right">{porCem(tot.custo, tot.valor)}</td>
                <td className="px-4 py-3 text-right">{num(tot.entregas)}</td>
                <td className="px-4 py-3 text-right">{tot.entregas > 0 ? formatBRL(tot.custo / tot.entregas) : "—"}</td>
                <td className="px-4 py-3 text-right">{num(tot.notas)}</td>
                <td className="px-4 py-3 text-right">{num(tot.km)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-xs text-slate-400">
        KM pelo rastreador, da saída do caminhão até a próxima saída (viagem do Sertão conta todos os dias de estrada).{" "}
        {formatPercent(fracao(tot.kmMedido, tot.km) ?? 0, 0)} do km é medido; {base.viagensSemRastreador} de {base.viagens} viagens
        foram em caminhão sem rastreador e usam a média de km por viagem da região.
      </p>
    </>
  );
}

function CartaoRegiao({ l, totalCusto, media, maior, comGalpao }: { l: CustoRegiao; totalCusto: number; media: number | null; maior: number; comGalpao: boolean }) {
  const f = l.valor > 0 ? l.custo / l.valor : null;
  const acima = f !== null && media !== null && f > media;
  return (
    <div className="entrar levantar relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1 ${l.regiao === "Retira" ? "bg-slate-300" : "bg-[#1b2168]"}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{NOME[l.regiao]}</p>
          {SUB[l.regiao] && <p className="truncate text-[11px] text-slate-400" title={SUB[l.regiao]}>{SUB[l.regiao]}</p>}
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600" title="Fatia do custo logístico do mês">
          {formatPercent(fracao(l.custo, totalCusto) ?? 0, 1)} do custo
        </span>
      </div>
      <p className="mt-2 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">{formatBRL(l.custo)}</p>

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
        <p className={`font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums ${acima ? "text-rose-600" : "text-[#141a4d]"}`}>
          {porCem(l.custo, l.valor)}
          <span className="ml-1 font-sans text-xs font-normal text-slate-500">a cada R$ 100 vendidos</span>
        </p>
        {f !== null && maior > 0 && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={`crescer-x h-full ${acima ? "bg-rose-400" : "bg-amber-400"}`} style={{ width: `${(f / maior) * 100}%` }} />
          </div>
        )}
        {media !== null && f !== null && (
          <p className="mt-1 text-[11px] text-slate-400">
            {acima ? "acima" : "abaixo"} da média da empresa ({porCem(media, 1)})
          </p>
        )}
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <Linha rotulo="Entrega" valor={formatBRL(l.custoEntrega)} />
        {comGalpao && <Linha rotulo="Galpão" valor={formatBRL(l.custoGalpao)} />}
        <Linha rotulo="Venda" valor={formatBRL(l.valor)} />
        <Linha rotulo="Custo por entrega" valor={l.entregas > 0 ? formatBRL(l.custo / l.entregas) : "—"} dica="Cliente atendido por dia" />
      </dl>
    </div>
  );
}

function Linha({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div className="flex justify-between gap-3" title={dica}>
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="font-semibold tabular-nums text-[#141a4d]">{valor}</dd>
    </div>
  );
}
