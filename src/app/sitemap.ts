import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/locales";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://claw42.ai";

  return LOCALES.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: locale === "en_US" ? 1.0 : 0.8,
  }));
}
