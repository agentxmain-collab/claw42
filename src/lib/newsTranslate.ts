import { getCachedJson, setCachedJson } from "@/lib/cache/fileCache";
import { generateText } from "@/lib/llm/generateText";
import { antiMechanicalFallback } from "@/lib/llm/guardrails";
import type { NewsItem } from "@/lib/types";

export interface TranslatedNewsItem extends NewsItem {
  translatedTitle: string;
  translatedSource: "llm" | "cache" | "fallback";
}

function cacheKey(news: NewsItem, locale: string) {
  return `news-translate-${locale}-${news.id}`;
}

export async function translateNewsItem(
  news: NewsItem,
  locale: string,
): Promise<TranslatedNewsItem> {
  if (locale === "en_US") {
    return { ...news, translatedTitle: news.title, translatedSource: "fallback" };
  }

  const cached = await getCachedJson<{ title: string }>(cacheKey(news, locale));
  if (cached && Date.now() - cached.generatedAt < 6 * 60 * 60_000) {
    return { ...news, translatedTitle: cached.data.title, translatedSource: "cache" };
  }

  const fallback = news.title;
  let translatedTitle = fallback;
  let translatedSource: TranslatedNewsItem["translatedSource"] = "fallback";
  try {
    const text = await generateText(
      `把下面的加密新闻标题翻译成简体中文，只输出标题，不要解释：\n${news.title}`,
      {
        taskTag: `news:translate:${locale}`,
        temperature: 0.2,
        maxTokens: 120,
        cacheTTLSeconds: 6 * 60 * 60,
        enableGuardrails: true,
      },
    );
    translatedTitle = antiMechanicalFallback(text.replace(/^["“]|["”]$/g, ""), fallback).slice(
      0,
      120,
    );
    translatedSource = "llm";
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[news] translation fallback", error);
    }
  }

  await setCachedJson(cacheKey(news, locale), {
    generatedAt: Date.now(),
    data: { title: translatedTitle },
  });

  return { ...news, translatedTitle, translatedSource };
}
