import type { Metadata } from "next";
import "./globals.css";

const baseUrl = "https://claw42.ai";
const siteTitle = "Claw 42 — AI Trading Agent Platform";
const siteDescription =
  "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: baseUrl,
    siteName: "Claw 42",
    images: [
      {
        url: "/images/brand/claw42-horizontal-blue.png",
        width: 1200,
        height: 630,
        alt: "Claw 42",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/images/brand/claw42-horizontal-blue.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
