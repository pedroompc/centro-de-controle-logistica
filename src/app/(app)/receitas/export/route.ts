import { NextRequest } from "next/server";
import { listarReceitasDoMes } from "@/data/receitas";
import { toneladas } from "@/domain/receitas-metrics";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { ROTULO_TIPO } from "@/domain/descarregamento";
import type { DescarregamentoTipo } from "@/domain/types";

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
const num = (n: number) => String(n).replace(".", ",");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mes = sp.get("mes") ? primeiroDiaDoMes(sp.get("mes")!) : primeiroDiaDoMes();
  const fornecedorId = sp.get("fornecedor") || undefined;
  const tipo = (sp.get("tipo") as DescarregamentoTipo) || undefined;
  const receitas = await listarReceitasDoMes(mes, { fornecedorId, tipo });

  const header = ["Data", "Fornecedor", "Peso (kg)", "Peso (t)", "Tipo", "Preço/ton", "Receita", "Mínimo aplicado"];
  const linhas = receitas.map((r) =>
    [
      r.data,
      esc(r.fornecedorNome),
      num(r.pesoKg),
      num(toneladas(r.pesoKg)),
      ROTULO_TIPO[r.tipo] ?? r.tipo,
      num(r.precoPorTonelada),
      num(r.receita),
      num(r.minimoAplicado),
    ].join(";"),
  );
  const csv = "﻿" + [header.join(";"), ...linhas].join("\n"); // BOM p/ Excel PT-BR

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receitas-${mes}.csv"`,
    },
  });
}
