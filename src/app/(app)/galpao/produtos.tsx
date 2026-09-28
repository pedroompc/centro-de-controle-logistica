import { getProdutosWms, TOP_PRODUTOS } from "@/data/wms-produtos";
import { resumirProdutos, formatarEndereco, type LinhaProduto, type Alerta } from "@/domain/wms-produtos";
import { porUnidade } from "@/domain/wms";
import { formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { Card, SectionTitle, StatCard, Pill } from "@/components/ui";

const int = (v: number) => Math.round(v).toLocaleString("pt-BR");

const ROTULO_ALERTA: Record<Alerta, { texto: string; dica: string }> = {
  "picking-alto": { texto: "picking alto", dica: "Giro alto (classe A) com picking acima do nível 01 — cada abastecimento/separação depende de empilhadeira" },
  "sem-picking": { texto: "sem picking", dica: "Giro alto sem abastecimento de picking no mês — sai direto do pulmão ou não tem picking fixo" },
  "palete-divergente": { texto: "palete ≠ cadastro", dica: "Quantidade que chega por palete difere mais de 10% do cadastro (lastro × camadas)" },
};

/** Aba "Produtos": o que mais se movimenta, por quem, onde está e como chega paletizado. */
export async function Produtos({ mes }: { mes: string }) {
  const { linhas, indisponivel } = await getProdutosWms(mes);

  if (indisponivel.includes("movimentos por produto")) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">Sem conexão com o WMS. O banco só responde de dentro da rede da empresa.</p>
      </Card>
    );
  }

  const r = resumirProdutos(linhas);
  const topo = linhas.slice(0, TOP_PRODUTOS);
  const a = r.porClasse.A;

  return (
    <div>
      {indisponivel.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">
            Parte do cadastro não carregou ({indisponivel.join(", ")}). Movimentos e endereços continuam valendo.
          </p>
        </Card>
      )}

      <p className="mb-6 text-sm text-slate-500">
        {formatMesAno(mes)} · {int(r.movimentos)} movimentos efetivados em {int(r.skus)} produtos
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Curva A de movimento"
          value={`${int(a.skus)} SKUs`}
          hint={`${formatPercent(porUnidade(a.skus, r.skus))} dos produtos fazem ${formatPercent(porUnidade(a.movimentos, r.movimentos))} dos movimentos`}
        />
        <StatCard
          label="Curva A com picking alto"
          value={int(r.pickingAlto)}
          hint="Picking acima do nível 01: candidatos a descer para o chão"
          accent={r.pickingAlto ? "red" : "navy"}
        />
        <StatCard
          label="Curva A sem picking"
          value={int(r.semPicking)}
          hint="Nenhum abastecimento de picking no mês"
          accent={r.semPicking ? "gold" : "navy"}
        />
        <StatCard
          label="Palete diferente do cadastro"
          value={int(r.paleteDivergente)}
          hint="Entre os produtos com cadastro de paletização"
          accent={r.paleteDivergente ? "gold" : "navy"}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Os {Math.min(TOP_PRODUTOS, linhas.length)} produtos mais movimentados</SectionTitle>
      </div>
      <Card className="overflow-x-auto">
        <TabelaProdutos linhas={topo} />
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        <b>Picking</b> = destino mais frequente dos abastecimentos (pulmão → picking) no mês; <b>pulmões</b> = endereços de
        origem distintos desses abastecimentos. <b>Palete praticado</b> = quantidade mais comum por armazenagem (um palete por
        movimento); <b>cadastro</b> = lastro × camadas do WinThor. ⚠️ Unidade da quantidade do WMS (caixa × unidade) e o vínculo
        código WMS = código WinThor ainda estão em validação (<code>docs/wms/validacao-produtos.sql</code>).
      </p>
    </div>
  );
}

function TabelaProdutos({ linhas }: { linhas: LinhaProduto[] }) {
  if (!linhas.length) return <p className="p-5 text-sm text-slate-500">Nenhum movimento efetivado no mês.</p>;
  return (
    <table className="w-full min-w-[1100px] text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
          <th className="px-4 py-3 font-semibold">#</th>
          <th className="px-3 py-3 font-semibold">Produto</th>
          <th className="px-3 py-3 text-right font-semibold">Movimentos</th>
          <th className="px-3 py-3 text-right font-semibold">Abast. / Armaz.</th>
          <th className="px-3 py-3 text-right font-semibold">% vertical</th>
          <th className="px-3 py-3 font-semibold">Quem mais movimentou</th>
          <th className="px-3 py-3 font-semibold">Picking</th>
          <th className="px-3 py-3 text-right font-semibold">Pulmões</th>
          <th className="px-3 py-3 text-right font-semibold">Palete praticado</th>
          <th className="px-3 py-3 text-right font-semibold">Cadastro (L × C)</th>
          <th className="px-3 py-3 font-semibold">Alertas</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-[#141a4d]">
        {linhas.map((l) => (
          <tr key={l.merc} className="border-b border-slate-50 align-top last:border-0">
            <td className="px-4 py-2.5 text-slate-400">
              {l.posicao}
              <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{l.classe}</span>
            </td>
            <td className="max-w-[260px] px-3 py-2.5">
              <span className="block truncate font-medium" title={l.descricao ?? undefined}>{l.descricao ?? `Produto ${l.merc}`}</span>
              <span className="text-[10px] text-slate-400">#{l.merc}{l.embalagem && ` · ${l.embalagem}`}</span>
            </td>
            <td className="px-3 py-2.5 text-right">
              <span className="font-semibold">{int(l.movimentos)}</span>
              <span className="block text-[10px] text-slate-400">{formatPercent(l.participacao)} do mês</span>
            </td>
            <td className="px-3 py-2.5 text-right">{int(l.abastecimentos)} / {int(l.armazenagens)}</td>
            <td className="px-3 py-2.5 text-right">{formatPercent(porUnidade(l.verticais, l.movimentos), 0)}</td>
            <td className="max-w-[180px] px-3 py-2.5">
              <span className="block truncate">{l.operadorPrincipal ?? "—"}</span>
              <span className="text-[10px] text-slate-400">{l.operadores} {l.operadores === 1 ? "pessoa" : "pessoas"} no mês</span>
            </td>
            <td className="px-3 py-2.5 font-mono text-xs">
              {formatarEndereco(l.picking)}
              {l.nivelPicking && <span className="block font-sans text-[10px] text-slate-400">nível {l.nivelPicking}</span>}
            </td>
            <td className="px-3 py-2.5 text-right">{l.pulmoes || "—"}</td>
            <td className="px-3 py-2.5 text-right">{l.qtdPaletePraticada ? int(l.qtdPaletePraticada) : "—"}</td>
            <td className="px-3 py-2.5 text-right">
              {l.qtdPaleteCadastro ? int(l.qtdPaleteCadastro) : "—"}
              {l.lastro && l.camadas && <span className="block text-[10px] text-slate-400">{l.lastro} × {l.camadas}</span>}
            </td>
            <td className="px-3 py-2.5">
              <div className="flex flex-wrap gap-1">
                {l.alertas.map((a) => (
                  <span key={a} title={ROTULO_ALERTA[a].dica}>
                    <Pill tone={a === "picking-alto" ? "red" : "gold"}>{ROTULO_ALERTA[a].texto}</Pill>
                  </span>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
