// Carregamento + tela de cada BI de setor. Usado pela página do setor
// (/setores/[id]?aba=bi) e pelo BI Geral (/bi) — mesmo código, mesmo número.
import type { ReactNode } from "react";
import { hojeISO } from "@/domain/fechamento";
import { primeiroDiaDoMes, tipoPeriodo, type Periodo } from "@/domain/periodo";
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
import type { Funcionario, Setor } from "@/domain/types";

export interface PropsSetor {
  setor: Setor;
  funcionarios: Funcionario[];
  periodo: Periodo;
  hrefMes: HrefMes;
  hrefSair: string;
  abas?: ReactNode;
}

export async function ConteudoBISeparacao({ setor, funcionarios, periodo, hrefMes, hrefSair, abas }: PropsSetor) {
  const dados = await carregarBISeparacao(setor, funcionarios, periodo);
  return <BISeparacao key={`${periodo.de}|${periodo.ate}`} dados={dados} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} />;
}

export async function ConteudoBIAbastecimento({ setor, funcionarios, periodo, hrefMes, hrefSair, abas }: PropsSetor) {
  const dados = await carregarBIAbastecimento(setor, funcionarios, periodo);
  return <BIAbastecimento key={`${periodo.de}|${periodo.ate}`} dados={dados} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} />;
}

export async function ConteudoBIMotoristas({ setor, funcionarios, periodo, hrefMes, hrefSair, abas }: PropsSetor) {
  const dados = await carregarBIMotoristas(setor, funcionarios, periodo);
  return <BIMotoristas key={`${periodo.de}|${periodo.ate}`} dados={dados} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} />;
}

export async function ConteudoBIRecebimento({ periodo, hrefMes, hrefSair, abas }: Omit<PropsSetor, "setor" | "funcionarios">) {
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
  // Tela cheia (overlay como o Painel da Operação); "Sair" volta a `hrefSair`.
  return <BIAba key={`${periodo.de}|${periodo.ate}`} dados={{ mes, periodo, mensal, ref, serie, custo, fatos }} hrefSair={hrefSair} hrefMes={hrefMes} abas={abas} />;
}
