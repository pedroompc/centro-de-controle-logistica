import type { ReactElement } from "react";
import type { ResumoFechamento } from "@/domain/fechamento";
import { rotuloPeriodo } from "@/domain/fechamento";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";

const WHITE = "#ffffff";
const AMBER = "#f5b301";
const GREEN = "#34d399";
const MUTED = "rgba(255,255,255,0.55)";
const FAINT = "rgba(255,255,255,0.42)";

function Tile({ label, value, color = WHITE }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", flex: 1,
        backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 22, padding: "26px 28px",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 48, fontWeight: 800, color, marginTop: 12 }}>{value}</div>
    </div>
  );
}

export function ArteFechamento({
  resumo, ini, fim, geradoEm,
}: {
  resumo: ResumoFechamento; ini: string; fim: string; geradoEm: string;
}): ReactElement {
  const { eyebrow, titulo } = rotuloPeriodo(ini, fim);
  const fatur = resumo.faturamentoBruto === null ? "—" : formatBRL(resumo.faturamentoBruto);
  const sub =
    resumo.faturamentoBruto === null
      ? "Faturamento indisponível (fora da rede)"
      : `${resumo.pdvsAtendidos} PDVs atendidos · ${resumo.notasEmitidas} notas emitidas`;
  const peso = resumo.pesoFaturadoKg === null ? "—" : formatKg(resumo.pesoFaturadoKg);
  const taxa = resumo.taxaDevolucaoMes === null ? "—" : formatPercent(resumo.taxaDevolucaoMes);

  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        padding: 72, color: WHITE, fontFamily: "Sora",
        backgroundImage: "linear-gradient(160deg, #0a1650 0%, #111c5b 55%, #16205f 100%)",
      }}
    >
      {/* Marca */}
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1, color: WHITE }}>DIA</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 10, color: MUTED, marginLeft: 20, textTransform: "uppercase" }}>
          Distribuição
        </div>
      </div>

      {/* Contexto + data */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: "#f5c451", textTransform: "uppercase" }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: WHITE, marginTop: 10 }}>{titulo}</div>
      </div>

      {/* Herói — faturamento bruto */}
      <div style={{ display: "flex", marginTop: 48 }}>
        <div style={{ width: 10, backgroundColor: AMBER, borderRadius: 6, marginRight: 26 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, color: MUTED, textTransform: "uppercase" }}>
            Faturamento bruto
          </div>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, color: WHITE, marginTop: 8 }}>{fatur}</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginTop: 12 }}>{sub}</div>
        </div>
      </div>

      {/* Tiles 2x2 (flexbox) */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <div style={{ display: "flex" }}>
          <Tile label="Receitas logísticas" value={formatBRL(resumo.receitasLogisticas)} color={GREEN} />
          <div style={{ width: 22 }} />
          <Tile label="Peso faturado" value={peso} />
        </div>
        <div style={{ height: 22 }} />
        <div style={{ display: "flex" }}>
          <Tile label="Devolução · mês" value={taxa} color={AMBER} />
          <div style={{ width: 22 }} />
          <Tile label="Faltas no dia" value={String(resumo.faltas)} />
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 44, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 20, fontWeight: 600, color: FAINT }}>
        <div>Gerado {geradoEm}</div>
        <div>Filiais 1 + 11</div>
      </div>
    </div>
  );
}
