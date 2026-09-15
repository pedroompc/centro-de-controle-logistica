import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 180x180 é o tamanho que o iOS usa no ícone da tela inicial.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const sol = readFileSync(join(process.cwd(), "src/assets/sol-dia-icon.png")).toString("base64");

export default function AppleIcon() {
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
        <img src={`data:image/png;base64,${sol}`} width={130} height={130} alt="" />
      </div>
    ),
    size,
  );
}
