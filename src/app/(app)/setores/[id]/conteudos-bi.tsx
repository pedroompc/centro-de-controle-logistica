// Carregamento + tela de cada BI de setor. Usado pela página do setor
// (/setores/[id]?aba=bi) e pelo BI Geral (/bi) — mesmo código, mesmo número.
import type { ReactNode } from "react";
import { hojeISO } from "@/domain/fechamento";
import { primeiroDiaDoMes, tipoPeriodo, type Periodo, type PeriodoComparado } from "@/domain/periodo";
import { pisoDaAba } from "@/domain/bi-geral-rotas";
import { resumoAbastecimento, resumoMotoristas, resumoRecebimento, resumoSeparacao } from "@/domain/bi-geral";
import { carregarComparacao, numerosAbastecimento, numerosMotoristas, numerosRecebimento, numerosSeparacao } from "@/domain/bi-quadros";
import { carregarRecebimento, carregarDetalheCusto, carregarFatosDescarrego, carregarFatosDescarregoPeriodo } from "../../painel/painel-actions";
import { getResumoFaturamentoPeriodo } from "@/data/faturamento-mensal";
import { indicadoresDoPeriodo } from "@/domain/recebimento";
import { resumir } from "@/domain/bi-recebimento";
import { BIAba } from "./bi-aba";
import { carregarBISeparacao } from "./separacao-dados";
import { BISeparacao } from "./bi-separacao";
import { carregarBIAbastecimento } from "./abastecimento-dados";
import { BIAbastecimento } from "./bi-abastecimento";
import { carregarBIMotoristas } from "./motoristas-dados";
import { BIMotoristas } from "./bi-motoristas";
import type { HrefMes } from "./bi-shell";
import type { DadosBI } from "./bi-recebimento/base";
import type { Funcionario, Setor } from "@/domain/types";

export interface PropsSetor {
  setor: Setor;
  funcionarios: Funcionario[];
  periodo: Periodo;
  hrefMes: HrefMes;
  hrefSair: string;
  abas?: ReactNode;
  /** Só no BI Geral (`?cmp=`): cada quadro compara com este período. */
  comparacao?: PeriodoComparado | null;
}

// Com comparação, o período de comparação carrega DEPOIS do da tela (em
// sequência): dois carregamentos pesados juntos derrubam conexões do Oracle.

export async function ConteudoBISeparacao({ setor, funcionarios, periodo, hrefMes, hrefSair, abas, comparacao }: PropsSetor) {
  const dados = await carregarBISeparacao(setor, funcionarios, periodo);
  const cmp = await carregarComparacao(comparacao, pisoDaAba("separacao"), (p) => carregarBISeparacao(setor, funcionarios, p), numerosSeparacao, (d) => resumoSeparacao(d).erro);
  return <BISeparacao key={`${periodo.de}|${periodo.ate}`} dados={dados} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} cmp={cmp} />;
}

export async function ConteudoBIAbastecimento({ setor, funcionarios, periodo, hrefMes, hrefSair, abas, comparacao }: PropsSetor) {
  const dados = await carregarBIAbastecimento(setor, funcionarios, periodo);
  const cmp = await carregarComparacao(comparacao, pisoDaAba("abastecimento"), (p) => carregarBIAbastecimento(setor, funcionarios, p), numerosAbastecimento, (d) => resumoAbastecimento(d).erro);
  return <BIAbastecimento key={`${periodo.de}|${periodo.ate}`} dados={dados} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} cmp={cmp} />;
}

export async function ConteudoBIMotoristas({ setor, funcionarios, periodo, hrefMes, hrefSair, abas, comparacao }: PropsSetor) {
  const dados = await carregarBIMotoristas(setor, funcionarios, periodo);
  const cmp = await carregarComparacao(comparacao, pisoDaAba("motoristas"), (p) => carregarBIMotoristas(setor, funcionarios, p), numerosMotoristas, (d) => resumoMotoristas(d, null).erro);
  return <BIMotoristas key={`${periodo.de}|${periodo.ate}`} dados={dados} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} cmp={cmp} />;
}

/** Dados do BI do Recebimento no período (série, custo e fatos do descarrego). */
export async function carregarDadosRecebimento(periodo: Periodo): Promise<DadosBI> {
  const mensal = tipoPeriodo(periodo) === "mes";
  const hoje = hojeISO();
  const mes = primeiroDiaDoMes(periodo.ate < hoje ? periodo.ate : hoje);
  const [serie, custo, fatos, fat] = await Promise.all([
    carregarRecebimento(),
    carregarDetalheCusto().catch(() => null),
    (mensal ? carregarFatosDescarrego(mes) : carregarFatosDescarregoPeriodo(periodo.de, periodo.ate)).catch(() => null),
    mensal ? Promise.resolve(null) : getResumoFaturamentoPeriodo(periodo.de, periodo.ate).catch(() => null),
  ]);
  // Período: a linha de indicadores é montada dos fatos do período + custo proporcional dos meses.
  const ref = mensal
    ? undefined
    : (indicadoresDoPeriodo({ periodo, mes, serie, fatos: resumir(fatos ?? []), faturamentoLiquido: fat?.vendaLiquida ?? null }) ?? undefined);
  return { mes, periodo, mensal, ref, serie, custo, fatos };
}

export async function ConteudoBIRecebimento({ periodo, hrefMes, hrefSair, abas, comparacao }: Omit<PropsSetor, "setor" | "funcionarios">) {
  const dados = await carregarDadosRecebimento(periodo);
  const cmp = await carregarComparacao(comparacao, pisoDaAba("recebimento"), carregarDadosRecebimento, numerosRecebimento, (d) => resumoRecebimento(d).erro);
  // Tela cheia (overlay como o Painel da Operação); "Sair" volta a `hrefSair`.
  return <BIAba key={`${periodo.de}|${periodo.ate}`} dados={dados} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} cmp={cmp} />;
}
