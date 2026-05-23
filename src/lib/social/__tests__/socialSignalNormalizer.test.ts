import { describe, expect, it } from "vitest";
import {
  normalizeCryptoPanicSocialSignals,
  socialSignalScore,
} from "@/lib/social/socialSignalNormalizer";
import type { NewsItem } from "@/lib/types";

const now = Date.UTC(2026, 4, 21, 9, 0, 0);

function cryptoPanicItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "cryptopanic-1",
    title: "HYPE attracts renewed trader attention",
    url: "https://cryptopanic.com/news/hype",
    source: "CryptoPanic",
    sourceDomain: "cryptopanic.com",
    currencies: ["HYPE"],
    sentiment: "bullish",
    publishedAt: now - 10 * 60_000,
    votes: {
      positive: 12,
      negative: 2,
      important: 3,
    },
    ...overrides,
  };
}

describe("normalizeCryptoPanicSocialSignals", () => {
  it("aggregates CryptoPanic mentions, sentiment, engagement, and source diversity by symbol", () => {
    const snapshot = normalizeCryptoPanicSocialSignals(
      [
        cryptoPanicItem(),
        cryptoPanicItem({
          id: "cryptopanic-2",
          sourceDomain: "alt.cryptopanic.com",
          sentiment: "bearish",
          votes: { positive: 1, negative: 4, important: 0 },
        }),
      ],
      now,
    );

    expect(snapshot.provider).toBe("cryptopanic");
    expect(snapshot.cacheVersion).toContain("social:v1:cryptopanic");
    expect(snapshot.observations).toHaveLength(1);
    expect(snapshot.observations[0]).toMatchObject({
      provider: "cryptopanic",
      candidateKey: "HYPE",
      symbol: "HYPE",
      status: "ok",
      mentionCount: 2,
      sentimentScore: 0,
      engagementScore: 25,
      sourceCount: 2,
    });
    expect(socialSignalScore(snapshot.observations[0])).toBeGreaterThan(0);
    expect(socialSignalScore(snapshot.observations[0])).toBeLessThanOrEqual(15);
  });

  it("does not invent social observations from stale or vote-less news", () => {
    const snapshot = normalizeCryptoPanicSocialSignals(
      [
        cryptoPanicItem({ publishedAt: now - 25 * 60 * 60_000 }),
        cryptoPanicItem({ votes: undefined }),
      ],
      now,
    );

    expect(snapshot.observations).toEqual([]);
  });
});
