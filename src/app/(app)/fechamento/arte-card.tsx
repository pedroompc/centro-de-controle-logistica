import type { ReactElement } from "react";
import type { ResumoFechamento } from "@/domain/fechamento";
import { rotuloPeriodo } from "@/domain/fechamento";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";

const WHITE = "#ffffff";
const AMBER = "#f5b301";
const GREEN = "#34d399";
const MUTED = "rgba(255,255,255,0.55)";
const FAINT = "rgba(255,255,255,0.42)";
const TILE_BG = "rgba(255,255,255,0.06)";
const TILE_BORDER = "1px solid rgba(255,255,255,0.09)";

const labelStyle = {
  fontSize: 20, fontWeight: 700, letterSpacing: 1.5,
  color: MUTED, textTransform: "uppercase" as const,
};

/** Tile padrão: rótulo em cima, valor grande, subtítulo opcional. */
function Tile({ label, value, sub, color = WHITE }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, flexBasis: 0,
        backgroundColor: TILE_BG, border: TILE_BORDER, borderRadius: 22, padding: "22px 26px",
      }}
    >
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 46, fontWeight: 800, color, marginTop: 8 }}>{value}</div>
      {sub ? <div style={{ fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
}

/** Linha "Rótulo  valor" (dois nós, então precisa de display:flex p/ o Satori). */
function LinhaVal({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline" }}>
      <span style={{ fontSize: 22, fontWeight: 600, color: MUTED }}>{rotulo}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: WHITE, marginLeft: 10 }}>{valor}</span>
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
      : `${resumo.pdvsAtendidos} PDVs atendidos`;
  const peso = resumo.pesoFaturadoKg === null ? "—" : formatKg(resumo.pesoFaturadoKg);
  const taxa = resumo.taxaDevolucaoMes === null ? "—" : formatPercent(resumo.taxaDevolucaoMes);
  const devValor = resumo.devolucaoMesValor === null ? "—" : formatBRL(resumo.devolucaoMesValor);
  const devPeso = resumo.devolucaoMesPesoKg === null ? "—" : formatKg(resumo.devolucaoMesPesoKg);
  const notas = resumo.notasEmitidas === null ? "—" : resumo.notasEmitidas.toLocaleString("pt-BR");
  const setoresStr =
    resumo.faltasSetores.length > 0 ? resumo.faltasSetores.join(" · ") : resumo.faltas === 0 ? "Sem faltas" : "—";

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
        <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: -1, color: WHITE }}>DIA</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 10, color: MUTED, marginLeft: 18, textTransform: "uppercase" }}>
          Distribuição
        </div>
      </div>

      {/* Contexto + data */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: "#f5c451", textTransform: "uppercase" }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: WHITE, marginTop: 8 }}>{titulo}</div>
      </div>

      {/* Herói — faturamento bruto */}
      <div style={{ display: "flex", marginTop: 32 }}>
        <div style={{ width: 10, backgroundColor: AMBER, borderRadius: 6, marginRight: 24 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: MUTED, textTransform: "uppercase" }}>
            Faturamento bruto
          </div>
          <div style={{ fontSize: 90, fontWeight: 800, letterSpacing: -2, color: WHITE, marginTop: 6 }}>{fatur}</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>{sub}</div>
        </div>
      </div>

      {/* Grade — preenche o espaço restante */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, marginTop: 28 }}>
        <div style={{ display: "flex", flexGrow: 1 }}>
          <Tile label="Receitas logísticas" value={formatBRL(resumo.receitasLogisticas)} color={GREEN} />
          <div style={{ width: 18 }} />
          <Tile label="Peso faturado" value={peso} />
        </div>

        <div style={{ height: 18 }} />

        {/* Devolução do mês — fileira inteira: taxa | valor + peso */}
        <div
          style={{
            display: "flex", flexDirection: "row", alignItems: "center", flexGrow: 1,
            backgroundColor: TILE_BG, border: TILE_BORDER, borderRadius: 22, padding: "22px 28px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={labelStyle}>Devolução · mês</div>
            <div style={{ fontSize: 46, fontWeight: 800, color: AMBER, marginTop: 8 }}>{taxa}</div>
          </div>
          <div
            style={{
              display: "flex", flexDirection: "column", marginLeft: 28, paddingLeft: 28,
              borderLeft: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <LinhaVal rotulo="Valor" valor={devValor} />
            <div style={{ height: 8 }} />
            <LinhaVal rotulo="Peso" valor={devPeso} />
          </div>
        </div>

        <div style={{ height: 18 }} />

        <div style={{ display: "flex", flexGrow: 1 }}>
          <Tile label="Faltas no dia" value={String(resumo.faltas)} sub={setoresStr} />
          <div style={{ width: 18 }} />
          <Tile label="Notas emitidas" value={notas} />
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 20, fontWeight: 600, color: FAINT }}>
        <div>{`Gerado ${geradoEm}`}</div>
        <div>Filiais 1 + 11</div>
      </div>
    </div>
  );
}
