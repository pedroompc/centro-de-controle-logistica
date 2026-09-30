import { notFound, redirect } from "next/navigation";
import { buscarFuncionario, excluirFuncionario } from "@/data/funcionarios";
import { faltasDoFuncionario, excluirFalta } from "@/data/faltas";
import { listarSetores } from "@/data/setores";
import { isAdmin } from "@/data/auth";
import { formatBRL, formatDataBR } from "@/domain/format";
import { FATOR_ENCARGOS_SALARIO } from "@/domain/efetivo";
import { PageHeader, StatCard, Card, SectionTitle, BackLink, StatusBadge, Pill } from "@/components/ui";
import { BotaoConfirmar } from "@/components/confirm-button";
import { FuncionarioForm } from "../funcionario-form";
import { FaltaForm } from "./falta-form";

export default async function FuncionarioDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [funcionario, setores, faltas, admin] = await Promise.all([
    buscarFuncionario(id),
    listarSetores(),
    faltasDoFuncionario(id),
    isAdmin(),
  ]);
  if (!funcionario) notFound();
  const setor = setores.find((s) => s.id === funcionario.setorId);

  // Ordem da folha: salário, benefícios, adicional. null = não importado (mostra "—").
  const rubricas: { label: string; valor: number | null }[] = [
    { label: "Salário base", valor: funcionario.salarioBase },
    { label: "Passagem", valor: funcionario.passagem },
    { label: "Alimentação", valor: funcionario.alimentacao },
    { label: "Plano de saúde", valor: funcionario.planoSaude },
    { label: "Ajuda de custo", valor: funcionario.ajudaCusto },
    { label: "Premiação", valor: funcionario.premiacao },
    { label: "Adicional noturno", valor: funcionario.adicionalNoturno },
  ];

  async function excluir() {
    "use server";
    await excluirFuncionario(id);
    redirect("/funcionarios");
  }

  return (
    <div>
      <BackLink href="/funcionarios">Funcionários</BackLink>
      <PageHeader title={funcionario.nome} subtitle={`${funcionario.cargo} · ${setor?.nome ?? "—"}`}>
        <StatusBadge status={funcionario.status} />
        {admin && <FuncionarioForm setores={setores} inicial={funcionario} />}
        {admin && (
          <form action={excluir}>
            <BotaoConfirmar
              confirmacao={`Excluir o funcionário "${funcionario.nome}"? Essa ação não pode ser desfeita.`}
              className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              Excluir
            </BotaoConfirmar>
          </form>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Custo mensal" value={formatBRL(funcionario.custoMensal)} accent="gold" />
        <StatCard label="Admissão" value={formatDataBR(funcionario.dataAdmissao)} accent="navy" />
        <StatCard label="Total de faltas" value={`${faltas.length}`} accent={faltas.length > 0 ? "red" : "navy"} />
      </div>

      <section className="mt-6">
        <SectionTitle>Composição do custo</SectionTitle>
        <Card className="p-5">
          {rubricas.some((r) => r.valor !== null) ? (
            <dl className="divide-y divide-slate-100">
              {rubricas.map((r) => (
                <div key={r.label} className="flex items-center justify-between py-2.5">
                  <dt className="text-sm text-slate-500">{r.label}</dt>
                  <dd className="text-sm font-medium tabular-nums text-[#141a4d]">
                    {r.valor === null ? (
                      "—"
                    ) : r.label === "Salário base" ? (
                      // No custo mensal o salário entra com os encargos.
                      <>
                        <span className="font-normal text-slate-400">
                          {formatBRL(r.valor)} × {FATOR_ENCARGOS_SALARIO.toLocaleString("pt-BR")} ={" "}
                        </span>
                        {formatBRL(r.valor * FATOR_ENCARGOS_SALARIO)}
                      </>
                    ) : (
                      formatBRL(r.valor)
                    )}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3">
                <dt className="text-sm font-semibold text-[#141a4d]">Custo mensal</dt>
                <dd className="text-sm font-bold tabular-nums text-[#141a4d]">{formatBRL(funcionario.custoMensal)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">
              Sem detalhamento de custo importado para este funcionário.
            </p>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Faltas</SectionTitle>
          {admin && <FaltaForm funcionarioId={funcionario.id} />}
        </div>
        <Card className="overflow-hidden">
          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Observação</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {faltas.map((falta) => (
                  <tr key={falta.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 tabular-nums text-slate-700">{formatDataBR(falta.data)}</td>
                    <td className="px-5 py-3"><Pill tone="slate">{falta.tipo}</Pill></td>
                    <td className="px-5 py-3 text-slate-500">{falta.observacao ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      {admin && (
                        <form action={excluirFalta.bind(null, falta.id)}>
                          <BotaoConfirmar
                            confirmacao="Remover esta falta?"
                            className="text-sm font-medium text-rose-600 hover:text-rose-700"
                          >
                            Remover
                          </BotaoConfirmar>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {faltas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400">Sem faltas registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {faltas.map((falta) => (
              <li key={falta.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium text-slate-700">{formatDataBR(falta.data)}</span>
                    <Pill tone="slate">{falta.tipo}</Pill>
                  </div>
                  {falta.observacao && <p className="mt-1 truncate text-xs text-slate-500">{falta.observacao}</p>}
                </div>
                {admin && (
                  <form action={excluirFalta.bind(null, falta.id)} className="shrink-0">
                    <BotaoConfirmar
                      confirmacao="Remover esta falta?"
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 active:bg-rose-50"
                    >
                      Remover
                    </BotaoConfirmar>
                  </form>
                )}
              </li>
            ))}
            {faltas.length === 0 && (
              <li className="px-4 py-8 text-center text-slate-400">Sem faltas registradas.</li>
            )}
          </ul>
        </Card>
      </section>
    </div>
  );
}
