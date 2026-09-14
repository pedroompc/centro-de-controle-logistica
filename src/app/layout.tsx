import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Centro de Controle Logística",
  description: "Efetivo, custos e faturamento da operação logística em um só painel.",
  applicationName: "Centro de Controle",
  // Abre em tela cheia quando adicionado à tela inicial do iPhone.
  appleWebApp: { capable: true, title: "Centro de Controle", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a1650",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
