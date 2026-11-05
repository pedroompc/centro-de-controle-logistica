"use client";

import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { Vazio, Bloco, Mini, Dica, BarrasTV, CalendarioBI, ddmm } from "../bi-ui";
import { resumoVolume, resumoAntecedencia } from "@/domain/abastecimento";
import type { DadosHarpiaAbastecimento } from "@/data/harpia-abastecimento";
import { n0, n1 } from "./base";

export function VisaoVolume({
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

export function VisaoAntecedencia({
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
