import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { montarFechamento } from "@/data/fechamento";
import { intervaloDias, clampDia, hojeISO } from "@/domain/fechamento";
import { ArteFechamento } from "../arte-card";

// readFile/Node APIs → runtime Node (não Edge).
export const runtime = "nodejs";
// Sempre ao vivo (bate no Winthor a cada request).
export const dynamic = "force-dynamic";

function geradoEmBR(agora = new Date()): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  // "10/08, 17:42" → "10/08 · 17:42"
  return fmt.format(agora).replace(", ", " · ");
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const hoje = hojeISO();
    const iniBruto = clampDia(searchParams.get("ini") ?? hoje);
    const fimBruto = clampDia(searchParams.get("fim") ?? iniBruto);
    const { ini, fim } = intervaloDias(iniBruto, fimBruto);

    const resumo = await montarFechamento(ini, fim);

    const dir = join(process.cwd(), "src/assets/fonts");
    const [s600, s700, s800] = await Promise.all([
      readFile(join(dir, "sora-600.ttf")),
      readFile(join(dir, "sora-700.ttf")),
      readFile(join(dir, "sora-800.ttf")),
    ]);

    return new ImageResponse(
      ArteFechamento({ resumo, ini, fim, geradoEm: geradoEmBR() }),
      {
        width: 1080,
        height: 1350,
        fonts: [
          { name: "Sora", data: s600, weight: 600, style: "normal" },
          { name: "Sora", data: s700, weight: 700, style: "normal" },
          { name: "Sora", data: s800, weight: 800, style: "normal" },
        ],
      },
    );
  } catch (e) {
    console.error("[fechamento/arte]", (e as Error).message);
    return new Response("Falha ao gerar a arte", { status: 500 });
  }
}
