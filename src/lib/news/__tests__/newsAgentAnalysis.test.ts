import { describe, expect, it, vi } from "vitest";
import { analyzeNewsForAgent } from "@/lib/news/newsAgentAnalysis";
import type { NewsItem } from "@/lib/types";

const generateTextMock = vi.hoisted(() => vi.fn());
const getCachedJsonMock = vi.hoisted(() => vi.fn());
const setCachedJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llm/generateText", () => ({
  generateText: generateTextMock,
}));

vi.mock("@/lib/cache/fileCache", () => ({
  getCachedJson: getCachedJsonMock,
  setCachedJson: setCachedJsonMock,
}));

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "news-1",
    title: "ETH protocol update improves execution",
    url: "https://example.com/news-1",
    source: "CoinDesk",
    currencies: [" $eth ", "$$sol", "$"],
    sentiment: "bullish",
    publishedAt: Date.UTC(2026, 4, 13, 20, 0, 0),
    ...overrides,
  };
}

describe("analyzeNewsForAgent", () => {
  it("normalizes currency symbols in fallback summaries", async () => {
    getCachedJsonMock.mockResolvedValue(null);
    setCachedJsonMock.mockResolvedValue(undefined);
    generateTextMock.mockRejectedValue(new Error("llm unavailable"));

    const result = await analyzeNewsForAgent(newsItem(), "zh_CN");

    expect(result.summary).toContain("$ETH / $SOL");
    expect(result.summary).not.toContain("$$");
    expect(result.summary).not.toContain("$eth");
    expect(result.summary).not.toContain("$sol");
  });
});
