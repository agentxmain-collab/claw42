import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/locales";
import { SITE_URL } from "@/lib/basePath";

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: locale === "en_US" ? 1.0 : 0.8,
  }));
}
