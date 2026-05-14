import type { Metadata } from "next";
import { SITE_URL } from "@/lib/basePath";
import "./globals.css";

const siteTitle = "Claw 42 — AI Trading Agent Platform";
const siteDescription =
  "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading";
const siteOrigin = new URL(SITE_URL).origin;
const ogImage = `${SITE_URL}/opengraph-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: siteTitle,
  description: siteDescription,
  manifest: `${SITE_URL}/manifest.webmanifest`,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: SITE_URL,
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
