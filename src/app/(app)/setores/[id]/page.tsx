import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listarSetores, renomearSetor, excluirSetor } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { isAdmin } from "@/data/auth";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual, limitarAoHistorico, primeiroDiaDoMes, mesAnterior, mesProximo, INICIO_HISTORICO } from "@/domain/periodo";
import { carregarRecebimento, carregarDetalheCusto, carregarFatosDescarrego } from "../../painel/painel-actions";
import { BIAba } from "./bi-aba";
import { PageHeader, StatCard, Card, SectionTitle, BackLink, StatusBadge } from "@/components/ui";
import { BotaoConfirmar } from "@/components/confirm-button";
import { ehSetorRecebimento } from "@/domain/recebimento";
import { carregarAnaliseRecebimento } from "./recebimento-dados";
import { RecebimentoDesempenho } from "./recebimento-desempenho";
import { RecebimentoProjecoes } from "./recebimento-projecoes";
import { ehSetorSeparacao } from "@/domain/separacao";
import { carregarBISeparacao } from "./separacao-dados";
import { BISeparacao } from "./bi-separacao";
import { MapasAba } from "./mapas-aba";

const ABAS_RECEBIMENTO = [
  { aba: "", label: "Visão geral" },
  { aba: "bi", label: "BI" },
  { aba: "desempenho", label: "Desempenho" },
  { aba: "projecoes", label: "Projeções" },
] as const;

const ABAS_SEPARACAO = [
  { aba: "", label: "Visão geral" },
  { aba: "bi", label: "BI" },
  { aba: "mapas", label: "Quem separou" },
] as const;

/** Abas do setor (mesmo visual das abas de Tendências). */
function AbasSetor({ id, ativa, abas }: { id: string; ativa: string; abas: readonly { aba: string; label: string }[] }) {
  return (
    <nav className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {abas.map((a) => (
        <Link
          key={a.aba}
          href={`/setores/${id}${a.aba ? `?aba=${a.aba}` : ""}`}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            ativa === a.aba ? "bg-white text-[#141a4d] shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-[#141a4d]"
          }`}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function SetorDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; mes?: string }>;
}) {
  const { id } = await params;
  const { aba: abaParam, mes: mesParam } = await searchParams;
  const [setores, funcionarios, faltas, admin] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
    isAdmin(),
  ]);
  const setor = setores.find((s) => s.id === id);
  if (!setor) notFound();

  async function excluir() {
    "use server";
    await excluirSetor(id);
    redirect("/setores");
  }

  // Recebimento ganha Desempenho e Projeções; os outros setores seguem iguais.
  const recebimento = ehSetorRecebimento(setor.nome);
  const separacao = !recebimento && ehSetorSeparacao(setor.nome);
  // Mês do BI (?mes=), limitado ao histórico, e a navegação ‹ mês ›.
  const mesBI = limitarAoHistorico(mesParam ? primeiroDiaDoMes(mesParam) : primeiroDiaDoMes());
  const mesAtual = primeiroDiaDoMes();
  const hrefBI = (m: string) => `/setores/${id}?aba=bi${m === mesAtual ? "" : `&mes=${m}`}`;
  const hrefMes = {
    anterior: mesBI > INICIO_HISTORICO ? hrefBI(mesAnterior(mesBI)) : null,
    proximo: mesBI < mesAtual ? hrefBI(mesProximo(mesBI)) : null,
    atual: mesBI < mesAtual ? hrefBI(mesAtual) : null,
  };
  if (separacao && abaParam === "bi") {
    const dados = await carregarBISeparacao(setor, funcionarios, mesBI);
    return <BISeparacao key={mesBI} dados={dados} hrefSair={`/setores/${id}`} hrefMes={hrefMes} />;
  }
  if (separacao && abaParam === "mapas") {
    return (
      <div>
        <BackLink href="/setores">Setores</BackLink>
        <PageHeader title={setor.nome} subtitle="Quem separou cada mapa — liga o separador à conferência e aos erros do Harpia" />
        <AbasSetor id={id} ativa="mapas" abas={ABAS_SEPARACAO} />
        <MapasAba setorId={id} funcionarios={funcionarios} />
      </div>
    );
  }
  const aba = recebimento && (abaParam === "bi" || abaParam === "desempenho" || abaParam === "projecoes") ? abaParam : "";
  if (aba === "bi") {
    const mes = mesBI;
    const [serie, custo, fatos] = await Promise.all([
      carregarRecebimento(),
      carregarDetalheCusto().catch(() => null),
      carregarFatosDescarrego(mes).catch(() => null),
    ]);
    // Tela cheia (overlay como o Painel da Operação); "Sair" volta ao setor.
    return (
      <BIAba
        key={mes}
        dados={{ mes, serie, custo, fatos }}
        hrefSair={`/setores/${id}`}
        hrefMes={hrefMes}
      />
    );
  }
  if (aba) {
    const analise = await carregarAnaliseRecebimento(funcionarios, setores);
    return (
      <div>
        <BackLink href="/setores">Setores</BackLink>
        <PageHeader title={setor.nome} subtitle={aba === "desempenho" ? "Desempenho mês a mês da equipe de descarga" : "Projeções e cenários"} />
        <AbasSetor id={id} ativa={aba} abas={ABAS_RECEBIMENTO} />
        {aba === "desempenho" ? (
          <RecebimentoDesempenho dados={analise} />
        ) : (
          <RecebimentoProjecoes serie={analise.serie} custoMedio={analise.custoMedio} perfil={analise.perfil} />
        )}
      </div>
    );
  }

  const doSetor = funcionarios.filter((f) => f.setorId === id);
  const head = headcountPorStatus(funcionarios, id);
  const { inicio, fim } = inicioFimMesAtual();
  const totalFaltas = faltasNoPeriodo(faltas, doSetor.map((f) => f.id), inicio, fim);

  return (
    <div>
      <BackLink href="/setores">Setores</BackLink>
      <PageHeader title={setor.nome} subtitle={`${doSetor.length} funcionários neste setor`} />
      {recebimento && <AbasSetor id={id} ativa="" abas={ABAS_RECEBIMENTO} />}
      {separacao && <AbasSetor id={id} ativa="" abas={ABAS_SEPARACAO} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Custo mensal (ativos)" value={formatBRL(custoDoSetor(funcionarios, id))} accent="gold" />
        <StatCard
          label="Pessoas"
          value={`${head.ativo}`}
          hint={`ativos${head.afastado ? ` · ${head.afastado} afastados` : ""}`}
          accent="navy"
        />
        <StatCard label="Faltas no mês" value={`${totalFaltas}`} accent="red" />
      </div>

      {admin && (
        <Card className="mt-6 p-6">
          <SectionTitle>Gerenciar setor</SectionTitle>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <form action={renomearSetor} className="flex w-full items-end gap-2 sm:w-auto">
              <input type="hidden" name="id" value={setor.id} />
              <label className="flex-1 text-sm sm:flex-none">
                <span className="mb-1 block text-xs font-medium text-slate-500">Nome do setor</span>
                <input
                  name="nome"
                  required
                  defaultValue={setor.nome}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                />
              </label>
              <button className="shrink-0 rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
                Salvar
              </button>
            </form>
            <form action={excluir}>
              <BotaoConfirmar
                confirmacao={`Excluir o setor "${setor.nome}"? Só é possível se não houver funcionários nele.`}
                className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Excluir setor
              </BotaoConfirmar>
            </form>
          </div>
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        {/* Desktop: tabela */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Cargo</th>
                <th className="px-5 py-3 font-semibold">Custo mensal</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {doSetor.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/funcionarios/${f.id}`} className="font-medium text-[#141a4d] hover:text-amber-600">
                      {f.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{f.cargo}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{formatBRL(f.custoMensal)}</td>
                  <td className="px-5 py-3"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
              {doSetor.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">Nenhum funcionário neste setor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {doSetor.map((f) => (
            <li key={f.id}>
              <Link
                href={`/funcionarios/${f.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#141a4d]">{f.nome}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{f.cargo}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="tabular-nums text-sm font-semibold text-slate-700">{formatBRL(f.custoMensal)}</span>
                  <StatusBadge status={f.status} />
                </div>
              </Link>
            </li>
          ))}
          {doSetor.length === 0 && (
            <li className="px-4 py-8 text-center text-slate-400">Nenhum funcionário neste setor.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
