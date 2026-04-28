import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claw 42",
    short_name: "Claw 42",
    description: "AI Trading Agent Platform",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#7c5cff",
    icons: [
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
