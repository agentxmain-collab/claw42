import { getCachedJson, setCachedJson } from "@/lib/cache/fileCache";
import { antiMechanicalFallback, generateLlmText } from "@/lib/llmFallbackChain";
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
  const result = await generateLlmText(
    `把下面的加密新闻标题翻译成简体中文，只输出标题，不要解释：\n${news.title}`,
  );
  const translatedTitle = result
    ? antiMechanicalFallback(result.text.replace(/^["“]|["”]$/g, ""), fallback).slice(0, 120)
    : fallback;

  await setCachedJson(cacheKey(news, locale), {
    generatedAt: Date.now(),
    data: { title: translatedTitle },
  });

  return { ...news, translatedTitle, translatedSource: result ? "llm" : "fallback" };
}
