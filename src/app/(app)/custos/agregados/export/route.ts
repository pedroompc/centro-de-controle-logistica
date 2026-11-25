import { NextRequest } from "next/server";
import { isAdmin } from "@/data/auth";
import { carregarAgregados } from "@/data/agregados";
import { tabelaAgregados } from "@/domain/agregados-relatorio";
import { periodoDoPadrao } from "../periodo";
import { criarXlsx } from "@/lib/xlsx";

const LARGURA: Record<string, number> = { Agregado: 38, Papel: 11, Observação: 15, "Custo ÷ faturado líquido": 16, "Diferença vs CLT": 16, "Último pagamento": 14 };

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return new Response("Acesso restrito a administradores.", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const periodo = periodoDoPadrao({ mes: sp.get("mes") ?? undefined, de: sp.get("de") ?? undefined, ate: sp.get("ate") ?? undefined });
  const t = tabelaAgregados(await carregarAgregados(periodo));
  const xlsx = criarXlsx(
    "Agregados",
    t.colunas.map((c) => ({ ...c, largura: LARGURA[c.titulo] })),
    t.linhas,
    t.totais,
  );
  const nome = periodo.de.slice(0, 7) === periodo.ate.slice(0, 7) ? periodo.de.slice(0, 7) : `${periodo.de}_a_${periodo.ate}`;
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="agregados-${nome}.xlsx"`,
    },
  });
}
