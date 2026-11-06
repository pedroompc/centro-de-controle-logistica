"use client";

import { useState } from "react";
import { formatPercent } from "@/domain/format";
import { variacaoPercentual } from "@/domain/tendencias";
import { pctComSinal } from "@/domain/comparacao";
import { BIShell, type HrefMes } from "../bi-shell";
import { Quadro, Vazio, ChipTV, ddmm, semCentavos } from "../bi-ui";
import { resumoVolume, resumoAntecedencia, premiacaoA424 } from "@/domain/abastecimento";
import type { DadosBIAbastecimento } from "../abastecimento-dados";
import { OCULTAS, VISOES, VisaoAba, custoSobreFaturamento, n0, n1 } from "./base";
import { VisaoCusto } from "./custo";
import { VisaoAntecedencia, VisaoVolume } from "./volume";
import { VisaoGiro } from "./giro";
import { VisaoMovimento } from "./movimento";
import { VisaoRupturas } from "./rupturas";

export function BIAbastecimento({ dados, hrefMes, hrefSair }: { dados: DadosBIAbastecimento; hrefMes: HrefMes; hrefSair: string }) {
  const [visao, setVisao] = useState<VisaoAba | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const abrir = (v: VisaoAba) => setVisao((a) => (a === v ? null : v));
  const titulo = visao ? VISOES.find((v) => v.id === visao)! : null;

  const custo = dados.custoRecorte;
  const delta = dados.custoMedio !== null && dados.custoMedioAnterior ? variacaoPercentual(dados.custoMedio, dados.custoMedioAnterior) : null;
  const sobreFat = custoSobreFaturamento(dados);
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
          sub={`${sobreFat !== null ? `${formatPercent(sobreFat, 2)} do fat. líquido · ` : ""}${dados.pessoas.length} pessoas · ${conta("lider")} líder(es)${delta !== null ? ` · ${pctComSinal(delta)} vs ${dados.rotuloAnterior}` : ""}`}
        />
        <Quadro
          {...q("volume")}
          rotulo="Volume"
          valor={resumo ? `${n0(resumo.caixas)} cx` : "—"}
          sub={semH ?? (resumo && resumo.dias ? `${n0(resumo.abastecimentos)} reabast. · ${resumo.dias} dias` : "sem abastecimento no período")}
        />
        {!OCULTAS.has("antecedencia") && <Quadro
          {...q("antecedencia")}
          rotulo="Antecedência"
          valor={pctAntes !== null ? formatPercent(pctAntes, 0) : "—"}
          sub={semH ?? (ant ? `mediana ${ant.medianaHoras !== null ? n1(ant.medianaHoras) : "—"}h de folga` : "sem cargas no período")}
        />}
        <Quadro
          {...q("giro")}
          rotulo="Giro de picking"
          valor={h ? `${n0(abastProdutos)} abast.` : "—"}
          sub={semH ?? (abastProdutos ? `${n0(skusProdutos)} produtos · ${resumo?.dias ?? 0} dias` : "sem abastecimento no período")}
        />
        <Quadro
          {...q("movimento")}
          rotulo="Movimentação"
          valor={prem ? n0(prem.total) : "—"}
          sub={semH ?? (prem ? `${n0(prem.descendente)} desc. · ${n0(prem.ascendente)} asc.` : "sem dado no período")}
        />
        {!OCULTAS.has("rupturas") && <Quadro
          {...q("rupturas")}
          rotulo="Rupturas"
          valor={h ? `${h.rupturas.length}` : "—"}
          sub={semH ?? (h && h.rupturas.length > 0 ? "estoque negativo no picking" : "nenhuma no período")}
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
      periodo={dados.periodo}
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
                  <VisaoVolume h={h} mes={dados.mes} periodo={dados.periodo} custoMes={custo} dia={dia} onDia={setDia} />
                ) : visao === "antecedencia" ? (
                  <VisaoAntecedencia h={h} mes={dados.mes} periodo={dados.periodo} dia={dia} onDia={setDia} />
                ) : visao === "giro" ? (
                  <VisaoGiro h={h} />
                ) : visao === "movimento" ? (
                  <VisaoMovimento movimento={h.movimentoPiso} convocacoes={h.convocacoes} recepcao={h.recepcao} mes={dados.mes} periodo={dados.periodo} dia={dia} onDia={setDia} nomes={dados.nomes} />
                ) : (
                  <VisaoRupturas h={h} mes={dados.mes} periodo={dados.periodo} />
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
