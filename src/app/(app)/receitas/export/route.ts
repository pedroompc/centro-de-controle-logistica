import { NextRequest } from "next/server";
import { listarReceitasDoMes } from "@/data/receitas";
import { listarDiversasDoMes } from "@/data/receitas-diversas";
import { toneladas } from "@/domain/receitas-metrics";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { ROTULO_TIPO } from "@/domain/descarregamento";
import { ROTULO_CATEGORIA } from "@/domain/receitas-diversas";
import type { DescarregamentoTipo } from "@/domain/types";

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
const num = (n: number) => String(n).replace(".", ",");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mes = sp.get("mes") ? primeiroDiaDoMes(sp.get("mes")!) : primeiroDiaDoMes();
  const fornecedorId = sp.get("fornecedor") || undefined;
  const tipo = (sp.get("tipo") as DescarregamentoTipo) || undefined;

  const [receitas, diversas] = await Promise.all([
    listarReceitasDoMes(mes, { fornecedorId, tipo }),
    listarDiversasDoMes(mes),
  ]);

  // Fornecedor e tipo são conceitos exclusivos de descarregamento — com um dos dois
  // ativo, o pedido é um recorte de descarregamento. Emitir linhas de reciclagem
  // (que não têm fornecedor nem tipo) junto inflaria o CSV com dados de fora do
  // filtro, sem coluna nenhuma para explicar por quê. Mesma regra da página.
  const filtrandoDescarregamento = Boolean(fornecedorId || tipo);
  const diversasVisiveis = filtrandoDescarregamento ? [] : diversas;

  // Arquivo único com as duas origens: colunas específicas ficam vazias onde
  // não se aplicam. Decisão do Pedro — facilita jogar tudo numa dinâmica só.
  const header = [
    "Origem", "Data", "Fornecedor", "Peso (kg)", "Peso (t)", "Tipo", "Preço/ton",
    "Mínimo aplicado", "Material", "Quantidade", "Preço unitário", "Valor",
  ];

  const linhasDesc = receitas.map((r) => ({
    data: r.data,
    campos: [
      "Descarregamento",
      r.data,
      esc(r.fornecedorNome),
      num(r.pesoKg),
      num(toneladas(r.pesoKg)),
      ROTULO_TIPO[r.tipo] ?? r.tipo,
      num(r.precoPorTonelada),
      num(r.minimoAplicado),
      "", "", "",
      num(r.receita),
    ],
  }));

  const linhasDiv = diversasVisiveis.map((d) => ({
    data: d.data,
    campos: [
      // Rótulo da categoria, não string fixa: uma categoria futura sai certa
      // sem ninguém lembrar de editar este arquivo.
      esc(ROTULO_CATEGORIA[d.categoria] ?? d.categoria),
      d.data,
      "", "", "", "", "", "",
      esc(d.material ?? ""),
      d.quantidade === null ? "" : num(d.quantidade),
      d.precoUnitario === null ? "" : num(d.precoUnitario),
      num(d.valor),
    ],
  }));

  const linhas = [...linhasDesc, ...linhasDiv]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((l) => l.campos.join(";"));

  const csv = "﻿" + [header.join(";"), ...linhas].join("\n"); // BOM p/ Excel PT-BR

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receitas-${mes}.csv"`,
    },
  });
}
