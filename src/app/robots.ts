import type { MetadataRoute } from "next";
import { SITE_URL, withBasePath } from "@/lib/basePath";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: withBasePath("/"), disallow: [withBasePath("/api/")] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
