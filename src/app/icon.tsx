import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Composto no build: sol da DIA sobre o navy da marca. Precisa ser opaco —
// o iOS pinta de preto qualquer transparência no ícone da tela inicial.
const sol = readFileSync(join(process.cwd(), "src/assets/sol-dia-icon.png")).toString("base64");

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg,#0a1650 0%,#0b1a58 100%)",
        }}
      >
        <img src={`data:image/png;base64,${sol}`} width={368} height={368} alt="" />
      </div>
    ),
    size,
  );
}
