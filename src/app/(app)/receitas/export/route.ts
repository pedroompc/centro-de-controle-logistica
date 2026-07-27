import { NextRequest } from "next/server";
import { listarReceitasDoMes } from "@/data/receitas";
import { listarDiversasDoMes } from "@/data/receitas-diversas";
import { listarTotaisDiariosDoMes } from "@/data/receitas-diario";
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

  const [receitas, diversas, totais] = await Promise.all([
    listarReceitasDoMes(mes, { fornecedorId, tipo }),
    listarDiversasDoMes(mes),
    listarTotaisDiariosDoMes(mes),
  ]);

  // Fornecedor e tipo são conceitos exclusivos de descarregamento — com um dos dois
  // ativo, o pedido é um recorte de descarregamento. Emitir linhas de reciclagem
  // (que não têm fornecedor nem tipo) junto inflaria o CSV com dados de fora do
  // filtro, sem coluna nenhuma para explicar por quê. Mesma regra da página.
  const filtrandoDescarregamento = Boolean(fornecedorId || tipo);
  const diversasVisiveis = filtrandoDescarregamento ? [] : diversas;
  const totaisVisiveis = filtrandoDescarregamento ? [] : totais;

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
      r.tipo === "volume" ? "" : num(r.precoPorTonelada),                        // Preço/ton
      num(r.minimoAplicado),                                                     // Mínimo aplicado
      "",                                                                        // Material
      r.tipo === "volume" && r.quantidade !== null ? String(r.quantidade) : "", // Quantidade (caixas)
      r.tipo === "volume" && r.precoPorUnidade !== null ? num(r.precoPorUnidade) : "", // Preço unitário (R$/caixa)
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

  const linhasDiario = totaisVisiveis.map((t) => ({
    data: t.data,
    campos: [
      "Total do dia",
      t.data,
      "",                        // Fornecedor
      num(t.pesoKg),             // Peso (kg)
      num(toneladas(t.pesoKg)),  // Peso (t)
      "",                        // Tipo
      "",                        // Preço/ton
      "",                        // Mínimo aplicado
      "",                        // Material
      String(t.descarregos),     // Quantidade → nº de descarregos
      "",                        // Preço unitário
      num(t.receita),            // Valor
    ],
  }));

  const linhas = [...linhasDesc, ...linhasDiv, ...linhasDiario]
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
