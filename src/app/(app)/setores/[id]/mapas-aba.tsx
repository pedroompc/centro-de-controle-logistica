import { listarMapasSeparados, removerMapa } from "@/data/separacao-mapas";
import { lerMapasConferidos } from "@/data/harpia-separacao";
import { chaveMapa, papelSeparacao } from "@/domain/separacao";
import { formatDataBR, formatPercent } from "@/domain/format";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { Card, SectionTitle, StatCard } from "@/components/ui";
import type { Funcionario } from "@/domain/types";
import { MapaForm } from "./mapas-form";

/**
 * Aba "Quem separou" do setor Separação: o líder registra o separador de cada
 * mapa. O BI cruza com a conferência do Harpia pelo nº do mapa. A cobertura
 * (mapas conferidos com separador informado) mostra se a equipe está lançando.
 */
export async function MapasAba({ setorId, funcionarios }: { setorId: string; funcionarios: Funcionario[] }) {
  const mes = primeiroDiaDoMes();
  const [registros, conferidos] = await Promise.all([
    listarMapasSeparados(mes),
    lerMapasConferidos(mes).catch((e: unknown) => (e instanceof Error ? e.message : String(e))),
  ]);
  const ativos = funcionarios.filter((f) => f.status === "ativo");
  const doSetor = ativos.filter((f) => f.setorId === setorId);
  const separadores = doSetor.filter((f) => papelSeparacao(f.cargo) === "separador");
  const resto = ativos.filter((f) => !separadores.includes(f));
  const nome = new Map(ativos.map((f) => [f.id, f.nome]));
  for (const f of funcionarios) if (!nome.has(f.id)) nome.set(f.id, f.nome);

  if (registros === null) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        A tabela de mapas ainda não existe no banco — rode a migração <code>0026_separacao_mapas.sql</code> no Supabase.
      </Card>
    );
  }

  const informados = new Set(registros.map((r) => chaveMapa(r.mapa)));
  const lista = typeof conferidos === "string" ? null : conferidos;
  const cobertos = lista ? lista.filter((m) => informados.has(chaveMapa(m.mapa))).length : 0;
  // Pendentes: conferidos nos últimos 3 dias com movimento, sem separador.
  const diasRecentes = lista ? [...new Set(lista.map((m) => m.dia))].sort().slice(-3) : [];
  const pendentes = lista ? lista.filter((m) => diasRecentes.includes(m.dia) && !informados.has(chaveMapa(m.mapa))).sort((a, b) => b.dia.localeCompare(a.dia) || Number(a.mapa) - Number(b.mapa)) : [];

  // Registros agrupados por mapa (um mapa pode ter 2 separadores).
  const porMapa = new Map<string, typeof registros>();
  for (const r of registros) porMapa.set(`${r.data}|${chaveMapa(r.mapa)}`, [...(porMapa.get(`${r.data}|${chaveMapa(r.mapa)}`) ?? []), r]);
  const grupos = [...porMapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle>Registrar quem separou</SectionTitle>
        <MapaForm separadores={separadores.map((f) => ({ id: f.id, nome: f.nome }))} outros={resto.map((f) => ({ id: f.id, nome: f.nome }))} />
        <p className="mt-3 text-xs text-slate-400">
          O nº do mapa é o da planilha de separação do Harpia (o mesmo que o conferente vê). É ele que liga o separador às caixas conferidas e aos erros.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Mapas com separador no mês" value={String(informados.size)} accent="navy" />
        <StatCard
          label="Cobertura"
          value={lista && lista.length ? formatPercent(cobertos / lista.length, 0) : "—"}
          hint={lista ? `${cobertos} de ${lista.length} mapas conferidos no Harpia` : "sem leitura do Harpia"}
          accent={lista && lista.length && cobertos / lista.length >= 0.9 ? "gold" : "red"}
        />
        <StatCard label="Pendentes (últimos 3 dias)" value={lista ? String(pendentes.length) : "—"} hint="mapas conferidos sem separador" accent="red" />
      </div>

      {typeof conferidos === "string" && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Não consegui ler os mapas conferidos no Harpia — a cobertura e os pendentes ficam sem conta. <span className="font-mono text-xs">{conferidos}</span>
        </Card>
      )}

      {pendentes.length > 0 && (
        <Card className="p-5">
          <SectionTitle>Mapas conferidos sem separador</SectionTitle>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {pendentes.slice(0, 80).map((m) => (
              <span key={m.mapa} className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold tabular-nums text-rose-700" title={`${formatDataBR(m.dia)} · ${m.itens} itens`}>
                {m.mapa} <span className="font-normal text-rose-400">{m.dia.slice(8, 10)}/{m.dia.slice(5, 7)}</span>
              </span>
            ))}
            {pendentes.length > 80 && <span className="px-2 py-1 text-slate-400">+{pendentes.length - 80}</span>}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Data</th>
              <th className="px-5 py-3 font-semibold">Mapa</th>
              <th className="px-5 py-3 font-semibold">Separador(es)</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(([k, rs]) => (
              <tr key={k} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(rs[0].data)}</td>
                <td className="px-5 py-2.5 font-semibold tabular-nums text-[#141a4d]">{chaveMapa(rs[0].mapa)}</td>
                <td className="px-5 py-2.5">
                  <div className="flex flex-wrap gap-2">
                    {rs.map((r) => (
                      <form key={r.id} action={removerMapa.bind(null, r.id)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                        {nome.get(r.funcionarioId) ?? "—"}
                        <button className="text-slate-400 hover:text-rose-600" title="Remover">✕</button>
                      </form>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {grupos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-slate-400">Nenhum mapa registrado neste mês.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
