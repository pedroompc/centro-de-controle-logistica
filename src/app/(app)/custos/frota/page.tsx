import { lerCadastroFrota, salvarParametrosFrota, salvarModeloFrota, salvarVeiculoFrota, removerVeiculoFrota } from "@/data/frota-custos";
import { isAdmin } from "@/data/auth";
import { formatBRL } from "@/domain/format";
import { PageHeader, Card, BackLink, StatCard, SectionTitle } from "@/components/ui";

const campo =
  "rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm tabular-nums outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";
const botao = "rounded-lg bg-[#181d55] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#10143f]";
const th = "px-4 py-3 font-semibold";
const TIPOS = ["Três quarto", "Toco", "Truck", "Kia Bongo"];

/**
 * Cadastro do custo ESTIMADO da frota. O BI dos Motoristas (KM rodado) cruza com o
 * km real da telemetria: diesel = km ÷ km/L do modelo × preço do litro; desgaste e
 * manutenção = média mensal rateada pelo período.
 */
export default async function FrotaCustosPage() {
  const [cadastro, admin] = await Promise.all([lerCadastroFrota(), isAdmin()]);

  return (
    <div>
      <BackLink href="/custos">Custos</BackLink>
      <PageHeader title="Frota" subtitle="Consumo e custos de referência para o custo estimado da frota" />

      {cadastro === null ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          O cadastro da frota ainda não existe no banco — rode a migração <code>0028_frota_custos.sql</code> no Supabase.
        </Card>
      ) : (
        <Conteudo cadastro={cadastro} admin={admin} />
      )}
    </div>
  );
}

function Conteudo({ cadastro, admin }: { cadastro: NonNullable<Awaited<ReturnType<typeof lerCadastroFrota>>>; admin: boolean }) {
  const { parametros: p, modelos, veiculos } = cadastro;
  const usoModelo = new Map<string, number>();
  for (const v of veiculos) usoModelo.set(v.modelo, (usoModelo.get(v.modelo) ?? 0) + 1);

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Diesel (litro)" value={formatBRL(p.precoDiesel)} hint="estimado" accent="gold" />
        <StatCard label="Desgaste / mês" value={formatBRL(p.desgasteMensal)} hint="pneu, óleo, filtro, bateria" />
        <StatCard label="Manutenção / mês" value={formatBRL(p.manutencaoMensal)} hint="peças e mão de obra" />
        <StatCard label="Veículos" value={String(veiculos.length)} hint={`${modelos.length} modelos`} />
      </div>

      {admin && (
        <section className="mb-6">
          <SectionTitle>Parâmetros</SectionTitle>
          <Card className="p-4">
            <form action={salvarParametrosFrota} className="flex flex-wrap items-end gap-3 text-sm">
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Diesel (R$/litro)
                <input name="preco_diesel" type="number" min="0" step="0.001" defaultValue={p.precoDiesel} required className={`${campo} w-28`} />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Desgaste da frota (R$/mês)
                <input name="desgaste_mensal" type="number" min="0" step="0.01" defaultValue={p.desgasteMensal} required className={`${campo} w-36`} />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Manutenção da frota (R$/mês)
                <input name="manutencao_mensal" type="number" min="0" step="0.01" defaultValue={p.manutencaoMensal} required className={`${campo} w-36`} />
              </label>
              <button className={botao}>Salvar</button>
            </form>
          </Card>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section>
          <SectionTitle>Consumo por modelo</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className={th}>Modelo</th>
                  <th className={th}>km/L</th>
                  <th className={`${th} text-right`}>Veículos</th>
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.modelo} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-[#141a4d]">{m.modelo}</td>
                    <td className="px-4 py-2.5">
                      {admin ? (
                        <form action={salvarModeloFrota} className="flex items-center gap-2">
                          <input type="hidden" name="modelo" value={m.modelo} />
                          <input name="km_por_litro" type="number" min="0.1" step="0.01" defaultValue={m.kmPorLitro} required className={`${campo} w-20`} aria-label={`km/L do ${m.modelo}`} />
                          <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                        </form>
                      ) : (
                        <span className="tabular-nums text-slate-600">{m.kmPorLitro.toLocaleString("pt-BR")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{usoModelo.get(m.modelo) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {admin && (
              <form action={salvarModeloFrota} className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
                <input name="modelo" required placeholder="Modelo (ex: 9.170)" className={`${campo} w-36`} />
                <input name="km_por_litro" type="number" min="0.1" step="0.01" required placeholder="km/L" className={`${campo} w-20`} />
                <button className={botao}>Adicionar</button>
              </form>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>Veículos</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className={th}>Placa</th>
                  <th className={th}>Modelo · tipo</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {veiculos.map((v) => (
                  <tr key={v.placa} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium tabular-nums text-[#141a4d]">{v.placa}</td>
                    <td className="px-4 py-2.5">
                      {admin ? (
                        <form action={salvarVeiculoFrota} className="flex items-center gap-2">
                          <input type="hidden" name="placa" value={v.placa} />
                          <SelectModelo modelos={modelos.map((m) => m.modelo)} valor={v.modelo} />
                          <SelectTipo valor={v.tipo} />
                          <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                        </form>
                      ) : (
                        <span className="text-slate-600">
                          {v.modelo} · {v.tipo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {admin && (
                        <form action={removerVeiculoFrota.bind(null, v.placa)}>
                          <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {veiculos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">Nenhum veículo cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {admin && (
              <form action={salvarVeiculoFrota} className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
                <input name="placa" required placeholder="Placa" className={`${campo} w-28 uppercase`} />
                <SelectModelo modelos={modelos.map((m) => m.modelo)} />
                <SelectTipo />
                <button className={botao}>Adicionar</button>
              </form>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}

function SelectModelo({ modelos, valor }: { modelos: string[]; valor?: string }) {
  return (
    <select name="modelo" required defaultValue={valor ?? ""} className={campo} aria-label="Modelo">
      {!valor && <option value="" disabled>Modelo</option>}
      {modelos.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
}

function SelectTipo({ valor }: { valor?: string }) {
  const opcoes = valor && !TIPOS.includes(valor) ? [...TIPOS, valor] : TIPOS;
  return (
    <select name="tipo" required defaultValue={valor ?? TIPOS[0]} className={campo} aria-label="Tipo">
      {opcoes.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
