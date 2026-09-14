import { ImageResponse } from "next/og";

// 180x180 é o tamanho que o iOS usa no ícone da tela inicial.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Ícone neutro: barras (dashboard) em âmbar sobre o navy do painel.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 10,
          padding: 42,
          background: "linear-gradient(180deg,#0a1650 0%,#0b1a58 100%)",
        }}
      >
        <div style={{ width: 20, height: 44, background: "#fbbf24", borderRadius: 6 }} />
        <div style={{ width: 20, height: 86, background: "#fbbf24", borderRadius: 6 }} />
        <div style={{ width: 20, height: 64, background: "#fbbf24", borderRadius: 6 }} />
      </div>
    ),
    size,
  );
}
