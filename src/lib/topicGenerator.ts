import type { CoinPoolPayload, SignalRecord } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

const TOPIC_COOLDOWN_MS = 30 * 60_000;
const TYPE_DEDUPE_MS = 12 * 60 * 60_000;
const lastByType = new Map<string, number>();
let lastTopicAt = 0;

function allTickers(pool?: CoinPoolPayload) {
  return pool ? [...pool.majors, ...pool.trending, ...pool.opportunity] : [];
}

function claim(type: string, now: number) {
  if (now - lastTopicAt < TOPIC_COOLDOWN_MS) return false;
  const last = lastByType.get(type);
  if (last && now - last < TYPE_DEDUPE_MS) return false;
  lastByType.set(type, now);
  lastTopicAt = now;
  return true;
}

function topicId(type: string, now: number) {
  return `topic:${type}:${Math.floor(now / TYPE_DEDUPE_MS)}`;
}

export function buildNoNewsDebateTopic({
  now,
  pool,
  signals,
}: {
  now: number;
  pool?: CoinPoolPayload;
  signals: SignalRecord[];
}): NewsItem | null {
  const latestSignal = [...signals].sort((a, b) => b.ts - a.ts)[0] ?? null;
  const mover = allTickers(pool).sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))[0];

  if (latestSignal && claim(`signal:${latestSignal.type}`, now)) {
    const symbol = latestSignal.symbol.toUpperCase();
    return {
      id: topicId(`signal:${latestSignal.type}:${symbol}`, now),
      title: `${symbol} live market check: ${latestSignal.payload.description ?? latestSignal.type}`,
      url: "claw42://internal/no-news-topic",
      source: "Claw42 TopicGenerator",
      currencies: [symbol],
      sentiment:
        latestSignal.payload.change24h && latestSignal.payload.change24h < 0
          ? "bearish"
          : "neutral",
      publishedAt: now,
      votes: { positive: 0, negative: 0, important: 9 },
    };
  }

  if (mover && claim("top-mover", now)) {
    return {
      id: topicId(`top-mover:${mover.symbol}`, now),
      title: `${mover.symbol} 24h move ${mover.change24h.toFixed(2)}% becomes the active market topic`,
      url: "claw42://internal/no-news-topic",
      source: "Claw42 TopicGenerator",
      currencies: [mover.symbol],
      sentiment: mover.change24h >= 0 ? "bullish" : "bearish",
      publishedAt: now,
      votes: {
        positive: mover.change24h >= 0 ? 9 : 0,
        negative: mover.change24h < 0 ? 9 : 0,
        important: 9,
      },
    };
  }

  if (claim("majors-check", now)) {
    return {
      id: topicId("majors-check", now),
      title: "BTC ETH SOL live structure check while no major news is moving the tape",
      url: "claw42://internal/no-news-topic",
      source: "Claw42 TopicGenerator",
      currencies: ["BTC", "ETH", "SOL"],
      sentiment: "neutral",
      publishedAt: now,
      votes: { positive: 0, negative: 0, important: 8 },
    };
  }

  return null;
}
