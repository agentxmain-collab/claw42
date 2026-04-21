import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Claw 42 — AI Trading Agent Platform",
  description:
    "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading",
  icons: {
    icon: "/images/robot-hero.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>
        <I18nProvider>
          <SiteHeader />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
