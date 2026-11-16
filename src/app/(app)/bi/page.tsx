import { Suspense } from "react";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { hojeISO } from "@/domain/fechamento";
import {
  atalhosPeriodo, deslocarPeriodo, lerComparacao, lerPeriodo, mesDoPeriodo, paramsDoPeriodo, primeiroDiaDoMes,
} from "@/domain/periodo";
import { lerAba, pisoDaAba, hrefBI } from "@/domain/bi-geral-rotas";
import { setoresDoBI } from "./setores-do-bi";
import { EsqueletoBI } from "../setores/[id]/esqueleto-bi";
import type { HrefMes } from "../setores/[id]/bi-shell";
import {
  ConteudoBIAbastecimento, ConteudoBIMotoristas, ConteudoBIRecebimento, ConteudoBISeparacao,
} from "../setores/[id]/conteudos-bi";
import { AbasBI } from "./abas-bi";
import { SeletorComparacao } from "@/components/seletor-comparacao";
import { AbaGeral } from "./geral";

/**
 * BI Geral: um BI só, com a aba Geral (números da casa e de cada setor) e o
 * BI completo de cada setor. Período e comparação valem para todas as abas.
 */
export default async function BIGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; mes?: string; de?: string; ate?: string; cmp?: string }>;
}) {
  const sp = await searchParams;
  const aba = lerAba(sp.aba);
  const piso = pisoDaAba(aba);
  const periodo = lerPeriodo(sp, { piso });
  const cmp = lerComparacao(sp.cmp, periodo);
  const hoje = hojeISO();
  const extra: Record<string, string> = sp.cmp && cmp ? { cmp: sp.cmp } : {};
  const q = { ...paramsDoPeriodo(periodo), ...extra };

  const ant = deslocarPeriodo(periodo, -1);
  const prox = deslocarPeriodo(periodo, 1);
  const hrefMes: HrefMes = {
    anterior: ant.ate >= piso ? hrefBI(aba, { ...paramsDoPeriodo(ant), ...extra }) : null,
    proximo: prox.de <= hoje ? hrefBI(aba, { ...paramsDoPeriodo(prox), ...extra }) : null,
    atual: mesDoPeriodo(periodo) === primeiroDiaDoMes() ? null : hrefBI(aba, extra),
    piso,
    hoje,
    atalhos: atalhosPeriodo().filter((a) => a.periodo.ate >= piso),
  };

  const [setores, funcionarios] = await Promise.all([listarSetores(), listarFuncionarios()]);
  const porAba = setoresDoBI(setores);
  const abas = <AbasBI ativa={aba} q={q} direita={<SeletorComparacao periodo={periodo} comparacao={cmp} piso={piso} hoje={hoje} />} />;
  const chave = `${aba}|${periodo.de}|${periodo.ate}|${sp.cmp ?? ""}`;
  const comum = { funcionarios, periodo, hrefMes, hrefSair: "/", abas, comparacao: cmp };

  let conteudo;
  if (aba === "geral") {
    conteudo = <AbaGeral periodo={periodo} comparacao={cmp} setores={porAba} funcionarios={funcionarios} hrefMes={hrefMes} abas={abas} q={q} />;
  } else if (aba === "recebimento") {
    conteudo = <ConteudoBIRecebimento periodo={periodo} hrefMes={hrefMes} hrefSair="/" abas={abas} comparacao={cmp} />;
  } else {
    const setor = porAba[aba];
    if (!setor) {
      conteudo = <AbaGeral periodo={periodo} comparacao={cmp} setores={porAba} funcionarios={funcionarios} hrefMes={hrefMes} abas={abas} q={q} faltando={aba} />;
    } else if (aba === "separacao") {
      conteudo = <ConteudoBISeparacao setor={setor} {...comum} />;
    } else if (aba === "abastecimento") {
      conteudo = <ConteudoBIAbastecimento setor={setor} {...comum} />;
    } else {
      conteudo = <ConteudoBIMotoristas setor={setor} {...comum} />;
    }
  }

  return (
    <Suspense key={chave} fallback={<EsqueletoBI />}>
      {conteudo}
    </Suspense>
  );
}
