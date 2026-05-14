import { withBasePath } from "@/lib/basePath";

export const dynamic = "force-static";

export function GET() {
  return new Response(
    JSON.stringify({
      name: "Claw 42",
      short_name: "Claw 42",
      description: "AI Trading Agent Platform",
      start_url: withBasePath("/"),
      display: "standalone",
      background_color: "#000000",
      theme_color: "#7c5cff",
      icons: [
        { src: withBasePath("/icon.png"), sizes: "32x32", type: "image/png" },
        { src: withBasePath("/icon-192.png"), sizes: "192x192", type: "image/png" },
        { src: withBasePath("/icon-512.png"), sizes: "512x512", type: "image/png" },
        { src: withBasePath("/apple-icon.png"), sizes: "180x180", type: "image/png" },
      ],
    }),
    {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
      },
    },
  );
}
