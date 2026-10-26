"use client";

import { formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { porMilLinhas, resumoErros, rotuloTurno, type ResumoTurno, type TotaisProducao } from "@/domain/separacao";
import { diferenca } from "@/domain/separacao-auditoria";
import { TURNOS_SEPARACAO } from "@/domain/turnos-separacao";
import { Bloco, CalendarioBI, Dica, Mini, ddmm } from "./bi-ui";
import { COR_TURNO, DUAS_COLUNAS, GRADE_CARDS, Tabela, VISAO, n0, n1, ou, pct, sinalPct, t1 } from "./bi-separacao-comum";
import type { AuditoriaSep, ProducaoBI } from "./separacao-dados";

// --- QUALIDADE ----------------------------------------------------------------

export function VisaoQualidade({ p, mes, dia, onDia, linhas, turnos }: { p: ProducaoBI; mes: string; dia: string | null; onDia: (d: string | null) => void; linhas: number; turnos: ResumoTurno[] }) {
  const r = resumoErros(p.erros, dia);
  const s = r.separador;
  const taxa = porMilLinhas(s.itens, linhas);
  const atribuidos = p.erros.filter((e) => e.origem === "separador" && e.atribuido && (!dia || e.dia === dia)).reduce((t, e) => t + e.itens, 0);
  const porDia = new Map<string, number>();
  for (const e of p.erros) if (e.origem === "separador") porDia.set(e.dia, (porDia.get(e.dia) ?? 0) + e.itens);
  const maxP = Math.max(1, ...p.produtosComErro.map((x) => x.itens));
  const maxT = Math.max(1e-9, ...turnos.map((t) => t.errosPorMil ?? 0));
  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(26rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Do separador" valor={n0(s.itens)} sub={dia ? ddmm(dia) : formatMesAno(mes)} />
        <Mini rotulo="Por mil linhas" valor={ou(taxa, n1)} sub={`${n0(linhas)} linhas`} />
        <Mini rotulo="Ocorrências" valor={n0(s.ocorrencias)} />
        <Mini rotulo="Unid. divergentes" valor={n0(s.unidades)} />
        <Mini rotulo="Falta × sobra" valor={`${n0(s.falta)} × ${n0(s.sobra)}`} />
        <Mini rotulo="Do conferente" valor={n0(r.conferente.itens)} sub={r.sem_origem.itens ? `${n0(r.sem_origem.itens)} sem origem` : undefined} />
        <Mini rotulo="Atribuídos" valor={s.itens ? formatPercent(atribuidos / s.itens, 0) : "—"} />
      </div>
      <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}>
        <Bloco className="min-h-[22rem] xl:min-h-0" titulo="Itens com erro do separador por dia">
          <CalendarioBI mes={mes} porDia={porDia} fmt={n0} selecionado={dia} onSelecionar={onDia} vazio="sem erro" menorEhMelhor />
        </Bloco>
        <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-auto xl:pr-1 [&>*]:shrink-0">
          <Bloco titulo="Por turno · erros a cada 1.000 linhas">
            <ul className="space-y-2">
              {turnos.map((t) => (
                <li key={t.turno}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-white">{t.rotulo}</span>
                    <span className="tabular-nums text-white">
                      {ou(t.errosPorMil, n1)} <span className="text-white/40">· {n0(t.errosSeparador)} / {n0(t.linhas)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${((t.errosPorMil ?? 0) / maxT) * 100}%`, background: COR_TURNO[t.turno] }} />
                  </div>
                </li>
              ))}
            </ul>
          </Bloco>
          <Bloco titulo="Produtos com mais erro do separador">
            {p.produtosComErro.length === 0 ? (
              <p className="py-4 text-center text-sm text-white/40">Nenhum erro do separador no mês.</p>
            ) : (
              <ul className="space-y-2">
                {p.produtosComErro.map((x) => (
                  <li key={x.produto}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-white" title={x.descricao ?? undefined}>
                        <span className="text-white/45">{x.produto}</span> {x.descricao ?? ""}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-white">
                        {x.itens} <span className="font-normal text-white/45">itens · {x.ocorrencias} bloq. · {n0(x.unidades)} un</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${(x.itens / maxP) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      </div>
    </div>
  );
}

// --- AUDITORIA ----------------------------------------------------------------

export function VisaoAuditoria({ a, tot, totalMes }: { a: AuditoriaSep; tot: TotaisProducao; totalMes: ProducaoBI["totalMes"] }) {
  const pedH = a.confronto.reduce((s, x) => s + x.pedidosHarpia, 0);
  const pedW = a.confronto.reduce((s, x) => s + x.pedidosWinthor, 0);
  const kgH = a.confronto.reduce((s, x) => s + x.kgHarpia, 0);
  const kgW = a.confronto.reduce((s, x) => s + x.kgWinthor, 0);
  const forte = (d: number | null) => (d !== null && Math.abs(d) > 0.05 ? "font-bold text-rose-300" : "");
  return (
    <div className={`${VISAO} gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
      <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-auto xl:pr-1 [&>*]:shrink-0">
        <Bloco titulo="Harpia × Winthor · mês" direita={<Dica>filial 1</Dica>}>
          {a.winthorErro ? (
            <p className="text-sm text-rose-300">Winthor indisponível: {a.winthorErro}</p>
          ) : (
            <Tabela
              cab={["", "Harpia (BI)", "Winthor", "Diferença"]}
              linhas={[
                ["Pedidos", n0(pedH), n0(pedW), <span key="p" className={forte(diferenca(pedH, pedW))}>{sinalPct(diferenca(pedH, pedW))}</span>],
                ["Peso", t1(kgH), t1(kgW), <span key="k" className={forte(diferenca(kgH, kgW))}>{sinalPct(diferenca(kgH, kgW))}</span>],
              ]}
            />
          )}
          <p className="mt-2 text-xs text-white/45">
            Filial 11: {n0(a.filial11.pedidos)} pedidos · {t1(a.filial11.kg)} · cancelados após separar: {n0(a.canceladosAposSeparar)}
          </p>
        </Bloco>
        <Bloco titulo="Por dia">
          <Tabela
            cab={["Dia", "Ped. Harpia", "Ped. Winthor", "Dif.", "t Harpia", "t Winthor", "Dif."]}
            linhas={a.confronto.map((x) => {
              const dp = diferenca(x.pedidosHarpia, x.pedidosWinthor);
              const dk = diferenca(x.kgHarpia, x.kgWinthor);
              return [ddmm(x.dia), n0(x.pedidosHarpia), n0(x.pedidosWinthor), <span key="p" className={forte(dp)}>{sinalPct(dp)}</span>, n1(x.kgHarpia / 1000), n1(x.kgWinthor / 1000), <span key="k" className={forte(dk)}>{sinalPct(dk)}</span>];
            })}
          />
        </Bloco>
      </div>
      <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-auto xl:pr-1 [&>*]:shrink-0">
        <Bloco titulo="Cobertura do registro de separador" direita={<Dica>{pct(tot.linhas ? tot.linhasComSeparador / tot.linhas : null, 0)} das linhas</Dica>}>
          <Tabela
            cab={["Tipo de mapa", "Mapas", "Linhas", "Com separador"]}
            linhas={a.porTipo.map((x) => [x.rotulo, n0(x.mapas), n0(x.linhas), pct(x.linhas ? x.comSeparador / x.linhas : null, 0)])}
          />
        </Bloco>
        <Bloco titulo="Cadastro e atribuição">
          <ul className="space-y-1.5 text-sm text-white/75">
            <li>
              Separadores sem funcionário ligado: <strong className="text-white">{a.semFuncionario.separadores}</strong> ({n0(a.semFuncionario.linhas)} linhas)
            </li>
            <li>
              Horário no Harpia ≠ turno do cadastro: <strong className="text-white">{a.divergenciasTurno.quantidade}</strong> separador(es), {n0(a.divergenciasTurno.linhas)} linhas.
            </li>
            <li>
              Erros do separador atribuídos: <strong className="text-white">{pct(a.errosSeparador.itens ? a.errosSeparador.atribuidos / a.errosSeparador.itens : null, 0)}</strong> de {n0(a.errosSeparador.itens)}.
            </li>
            <li>
              Dias úteis sem nenhum mapa: <strong className="text-white">{a.diasSemProducao.length ? a.diasSemProducao.map(ddmm).join(", ") : "nenhum"}</strong>
            </li>
            <li>
              Usuários com página registrada: <strong className="text-white">{a.separadoresRegistrados}</strong>
            </li>
            <li>
              Totais: {n0(tot.linhas)} linhas · {n0(totalMes.pedidos)} pedidos · {n0(totalMes.mapas)} mapas · {n0(totalMes.cargas)} cargas · {n0(totalMes.clientes)} clientes · {n0(totalMes.skus)} SKUs
            </li>
          </ul>
          {a.divergenciasTurno.detalhes && a.divergenciasTurno.detalhes.length > 0 && (
            <div className="mt-3">
              <Tabela
                cab={["Separador", "Cadastro", "Horário no Harpia", "Linhas"]}
                linhas={a.divergenciasTurno.detalhes.map((d) => [d.nome, rotuloTurno(d.cadastro), `${rotuloTurno(d.horario)} (mediana ${d.horaMediana}h)`, n0(d.linhas)])}
              />
            </div>
          )}
        </Bloco>
        <Bloco titulo="Regras de turno" direita={a.turnosValidados ? undefined : <Dica>referência · não validado pelo RH</Dica>}>
          <Tabela
            cab={["Turno", "Observado no banco", "Janela de atribuição", "Jornada"]}
            linhas={TURNOS_SEPARACAO.map((t) => [t.rotulo, t.horarioObservado, `${t.inicio}h–${t.fim}h`, `${t.jornadaHoras}h`])}
          />
        </Bloco>
      </div>
    </div>
  );
}
