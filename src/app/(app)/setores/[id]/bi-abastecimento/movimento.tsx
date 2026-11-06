"use client";

import { Fragment, useState } from "react";
import { formatPercent } from "@/domain/format";
import { type Periodo, rotuloPeriodo } from "@/domain/periodo";
import { ROTULO_TURNO } from "@/domain/metrics";
import { Vazio, Bloco, Mini, useSub, Dica, BarrasTV, CalendarioBI, ddmm, NomeUsuario } from "../bi-ui";
import type { NomesHarpia } from "../turno-dados";
import { type RendimentoA424, horaMovimento, resumoConvocacoes, porOperadorConvocacoes, rendimentoA424, historicoA424, premiacaoA424, premiacaoPorDia } from "@/domain/abastecimento";
import type { MovimentoPiso, LinhaConvocacao, RecepcaoProtocolo } from "@/data/harpia-abastecimento";
import { n0, n1 } from "./base";

type SubMov = "equipe" | "horario" | "tempo" | "subida";

/**
 * Quem fez, do jeito que a premiação conta pela A424: Mov. = função 04,
 * ↓ = função 03 (reabastecimento), ↑ = o resto. Os lançadores do WMS (Lucas,
 * Rafael) entram numa linha só, sem dono — o empilhador real não fica gravado.
 * Empilhadores agrupados por turno (pelo horário das movimentações no Harpia)
 * pra comparar manhã × noite.
 */
function TabelaEmpilhadores({
  rendimentos, lancadores, turnos, nomes, aberta, onAbrir,
}: {
  rendimentos: RendimentoA424[]; lancadores: RendimentoA424[]; turnos: MovimentoPiso["turnos"]; nomes: NomesHarpia; aberta: number | null; onAbrir: (usuario: number) => void;
}) {
  const grupos = (["manha", "noite"] as const)
    .map((t) => ({ turno: t, linhas: rendimentos.filter((r) => (turnos[r.usuario] ?? "manha") === t) }))
    .filter((g) => g.linhas.length > 0);
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
        {grupos.map((g) => {
          const mov = g.linhas.reduce((t, r) => t + r.empilhadeira.tarefas, 0);
          const desc = g.linhas.reduce((t, r) => t + r.reabastecimento.tarefas, 0);
          return (
            <Fragment key={g.turno}>
              {grupos.length > 1 && (
                <tr className="border-t border-white/10 text-xs">
                  <td className="py-1.5">
                    <span className="font-bold uppercase tracking-[0.14em] text-sky-300">{ROTULO_TURNO[g.turno]}</span>
                    <span className="ml-2 text-white/40">{g.linhas.length} empilhador{g.linhas.length > 1 ? "es" : ""} · média {n0(mov / g.linhas.length)} mov.</span>
                  </td>
                  <td className={`${num} font-bold text-white/70`}>{n0(mov)}</td>
                  <td className={`${num} text-white/50`}>{n0(desc)}</td>
                  <td className={`${num} text-white/50`}>{n0(mov - desc)}</td>
                  <td className={`${num} text-white/50`}>{n0(g.linhas.reduce((t, r) => t + r.reabastecimento.caixas, 0))}</td>
                  <td className={`${num} text-white/50`}>{n1(g.linhas.reduce((t, r) => t + r.reabastecimento.peso, 0) / 1000)} t</td>
                  <td />
                </tr>
              )}
              {g.linhas.map((r) => (
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
            </Fragment>
          );
        })}
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

export function VisaoMovimento({
  movimento, convocacoes, recepcao, mes, periodo, dia, onDia, nomes,
}: {
  movimento: MovimentoPiso; convocacoes: LinhaConvocacao[]; recepcao: RecepcaoProtocolo[]; mes: string; periodo: Periodo; dia: string | null; onDia: (d: string | null) => void; nomes: NomesHarpia;
}) {
  const { sub, abrir, fechar } = useSub<SubMov>();
  const [pessoaAberta, setPessoaAberta] = useState<number | null>(null);
  if (movimento.a424.length === 0) return <Vazio>Nenhuma movimentação registrada em {rotuloPeriodo(periodo)}.</Vazio>;
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
        <Mini rotulo="Movimentações" valor={n0(prem.total)} sub={`${dia ? ddmm(dia) : rotuloPeriodo(periodo)}`} />
        <Mini rotulo="↓ Descendente" valor={n0(prem.descendente)} sub="reabastecimento — reserva → picking" />
        <Mini {...card("subida")} rotulo="↑ Ascendente" valor={n0(prem.ascendente)} sub={`movimentações − descendente · ${n0(volumesRecepcao)} vol. recebidos`} />
        <Mini {...card("equipe")} rotulo="Empilhadores" valor={String(emp.length)} sub="clique pra ver o rendimento" />
        <Mini rotulo="Média por empilhador" valor={mediaPorEmpilhador !== null ? n1(mediaPorEmpilhador) : "—"} sub={`movimentações ${dia ? "nesse dia" : "no período"}${prem.lancadoWms ? ` · fora ${n0(prem.lancadoWms)} do WMS` : ""}`} />
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
            <CalendarioBI mes={mes} periodo={periodo} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem movimentação" />
          </Bloco>
          <Bloco titulo="Top 50 produtos mais mexidos" direita={<Dica>período inteiro, por nº de movimentações</Dica>}>
            {movimento.produtosTop.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">Nenhum produto movimentado no período.</p>
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
          <Bloco titulo="Quem fez" direita={<Dica>{dia ? `${ddmm(dia)} · clique numa pessoa` : "período inteiro · clique numa pessoa"}</Dica>}>
            {emp.length > 0 ? (
              <div className="h-full overflow-auto pr-1">
                <TabelaEmpilhadores rendimentos={emp} lancadores={lanc} turnos={movimento.turnos} nomes={nomes} aberta={pessoaAberta} onAbrir={abrirPessoa} />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-white/40">Nenhum empilhador com tarefa {dia ? `em ${ddmm(dia)}` : "no período"}.</p>
            )}
          </Bloco>
          <Bloco
            titulo={empSel ? `${empSel.nome ?? `Usuário ${empSel.usuario}`} · rendimento` : "Rendimento"}
            direita={empSel ? <Dica>regra A424 · {dia ? ddmm(dia) : rotuloPeriodo(periodo)}</Dica> : undefined}
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
        <Bloco titulo="Movimentações por hora do dia" direita={<Dica>{dia ? ddmm(dia) : rotuloPeriodo(periodo)}</Dica>}>
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

      {sub === "subida" && <SubidaRecebimento recepcao={recepcaoFiltrada} periodo={periodo} dia={dia} ascendenteInterno={ascendenteInterno} />}

      {sub === "tempo" && (
        resumoConv.total === 0 ? (
          <Vazio>
            <div className="max-w-md space-y-2">
              <p className="text-lg font-semibold text-white/70">Convocação Ativa ligada, sem tarefa {dia ? `em ${ddmm(dia)}` : `em ${rotuloPeriodo(periodo)}`}</p>
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
function SubidaRecebimento({ recepcao, periodo, dia, ascendenteInterno }: { recepcao: RecepcaoProtocolo[]; periodo: Periodo; dia: string | null; ascendenteInterno: number }) {
  if (recepcao.length === 0) return <Vazio>Nenhuma recepção de compra {dia ? `em ${ddmm(dia)}` : `em ${rotuloPeriodo(periodo)}`}.</Vazio>;
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
          <Mini rotulo="Volumes recebidos" valor={n0(volumes)} sub={dia ? ddmm(dia) : rotuloPeriodo(periodo)} />
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
