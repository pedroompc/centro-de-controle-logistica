import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Ícone neutro: barras (dashboard) em âmbar sobre o navy do painel.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 28,
          padding: 120,
          background: "linear-gradient(180deg,#0a1650 0%,#0b1a58 100%)",
        }}
      >
        <div style={{ width: 56, height: 120, background: "#fbbf24", borderRadius: 14 }} />
        <div style={{ width: 56, height: 240, background: "#fbbf24", borderRadius: 14 }} />
        <div style={{ width: 56, height: 180, background: "#fbbf24", borderRadius: 14 }} />
      </div>
    ),
    size,
  );
}
