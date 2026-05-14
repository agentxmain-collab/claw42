import { getCachedJson, setCachedJson } from "@/lib/cache/fileCache";
import { generateText } from "@/lib/llm/generateText";
import { antiMechanicalFallback } from "@/lib/llm/guardrails";
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

function formattedSymbols(currencies: string[]) {
  return Array.from(
    new Set(
      currencies
        .map((symbol) => symbol.trim().replace(/^\$+/, "").toUpperCase())
        .filter((symbol) => /^[A-Z0-9]{2,12}$/.test(symbol)),
    ),
  )
    .map((symbol) => `$${symbol}`)
    .join(" / ");
}

function fallbackAnalysis(news: NewsItem, locale: string) {
  const symbols = formattedSymbols(news.currencies);
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
  let summary = fallback;
  let source: NewsAgentAnalysis["source"] = "fallback";
  try {
    const text = await generateText(prompt, {
      taskTag: `news:agent-analysis:${locale}`,
      temperature: 0.65,
      maxTokens: 180,
      cacheTTLSeconds: 6 * 60 * 60,
      enableGuardrails: true,
    });
    summary = antiMechanicalFallback(text, fallback).slice(0, 140);
    source = "llm";
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[news] agent analysis fallback", error);
    }
  }

  await setCachedJson(cacheKey(news, locale), {
    generatedAt: Date.now(),
    data: { summary },
  });

  return {
    newsId: news.id,
    locale,
    summary,
    source,
    generatedAt: Date.now(),
  };
}
