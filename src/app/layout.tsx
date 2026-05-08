import type { Metadata } from "next";
import "./globals.css";

const baseUrl = "https://claw42.ai";
const siteTitle = "Claw 42 — AI Trading Agent Platform";
const siteDescription =
  "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading";
const ogImage = "/opengraph-image.png";

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
        url: ogImage,
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
    images: [ogImage],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The dynamic locale root owns <body>; it applies the Inter + Noto_Sans_SC font stack.
  return children;
}
