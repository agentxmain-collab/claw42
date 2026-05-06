import { getCachedJson, setCachedJson } from "@/lib/cache/fileCache";
import { antiMechanicalFallback, generateLlmText } from "@/lib/llmFallbackChain";
import type { NewsItem } from "@/lib/types";

export interface NewsAgentAnalysis {
  newsId: string;
  locale: string;
  summary: string;
  source: "llm" | "cache" | "fallback";
  generatedAt: number;
}

function cacheKey(news: NewsItem, locale: string) {
  return `news-agent-analysis-${locale}-${news.id}`;
}

function fallbackAnalysis(news: NewsItem, locale: string) {
  const symbols = news.currencies.map((symbol) => `$${symbol}`).join(" / ");
  return locale === "en_US"
    ? `${symbols || "Market"} is on watch; wait for live price confirmation before acting.`
    : `${symbols || "市场"} 已进入观察；先等实时价格确认，不急着出手。`;
}

export async function analyzeNewsForAgent(
  news: NewsItem,
  locale: string,
): Promise<NewsAgentAnalysis> {
  const cached = await getCachedJson<{ summary: string }>(cacheKey(news, locale));
  if (cached && Date.now() - cached.generatedAt < 6 * 60 * 60_000) {
    return {
      newsId: news.id,
      locale,
      summary: cached.data.summary,
      source: "cache",
      generatedAt: cached.generatedAt,
    };
  }

  const fallback = fallbackAnalysis(news, locale);
  const prompt =
    locale === "en_US"
      ? `Give one plain-English agent-style market note for this crypto headline. Use one sentence, no investment advice, include symbols if present.\n${news.title}`
      : `为下面加密新闻写一句 Agent 旁观分析，白话、短句、不要投资建议，保留币种符号。\n${news.title}`;
  const result = await generateLlmText(prompt);
  const summary = result ? antiMechanicalFallback(result.text, fallback).slice(0, 140) : fallback;

  await setCachedJson(cacheKey(news, locale), {
    generatedAt: Date.now(),
    data: { summary },
  });

  return {
    newsId: news.id,
    locale,
    summary,
    source: result ? "llm" : "fallback",
    generatedAt: Date.now(),
  };
}
