import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Centro de Controle Logística — DIA",
    short_name: "Centro DIA",
    description: "Efetivo, custos e faturamento da logística DIA em um só painel.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1650",
    theme_color: "#0a1650",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
