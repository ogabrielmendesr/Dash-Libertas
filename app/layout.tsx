import type { Metadata } from "next";
import { display, sans, mono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Libertas — Painel de Vendas",
  description: "Cruzamento de gastos publicitários e vendas para infoprodutores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}
