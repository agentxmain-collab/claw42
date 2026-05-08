import type { NewsItem, NewsSeverity, NewsTriggerClassification } from "@/lib/types";

const HIGH_IMPACT_KEYWORDS = [
  "ETF",
  "SEC",
  "Fed",
  "FOMC",
  "hack",
  "exploit",
  "regulation",
  "监管",
  "approval",
  "通过",
  "rejection",
  "驳回",
  "inflow",
  "outflow",
  "流入",
  "流出",
  "partnership",
  "合作",
  "launch",
  "发布",
];

const CRITICAL_KEYWORDS = ["hack", "exploit", "SEC", "FOMC", "监管", "驳回"];
const MAJOR_SYMBOLS = new Set(["BTC", "ETH", "SOL"]);
const DEBATE_DEDUP_WINDOW_MS = 12 * 60 * 60_000;
const DAILY_DEBATE_LIMIT = 20;
const recentDebateHashes = new Map<string, number>();
let dailyDebateBucket = "";
let dailyDebateCount = 0;

function todayBucket(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export function makeNewsHash(news: NewsItem, severity?: NewsSeverity): string {
  const symbols = news.currencies
    .map((currency) => currency.toUpperCase())
    .sort()
    .join(",");
  return `${symbols}:${severity ?? "any"}:${normalizeTitle(news.title)}`;
}

function classifySeverity(news: NewsItem): NewsSeverity {
  const titleLower = news.title.toLowerCase();
  const importantVotes = news.votes?.important ?? 0;
  const hasCritical = CRITICAL_KEYWORDS.some((keyword) =>
    titleLower.includes(keyword.toLowerCase()),
  );
  const hasHighImpact = HIGH_IMPACT_KEYWORDS.some((keyword) =>
    titleLower.includes(keyword.toLowerCase()),
  );

  if (hasCritical || importantVotes >= 15) return "critical";
  if (hasHighImpact || importantVotes >= 8) return "high";
  if (news.currencies.some((currency) => MAJOR_SYMBOLS.has(currency.toUpperCase())))
    return "medium";
  return "low";
}

function pruneHashes(now: number) {
  const cutoff = now - DEBATE_DEDUP_WINDOW_MS;
  for (const [hash, ts] of Array.from(recentDebateHashes.entries())) {
    if (ts < cutoff) recentDebateHashes.delete(hash);
  }
}

function canClaimDailySlot(now: number) {
  const bucket = todayBucket(now);
  if (bucket !== dailyDebateBucket) {
    dailyDebateBucket = bucket;
    dailyDebateCount = 0;
  }
  if (dailyDebateCount >= DAILY_DEBATE_LIMIT) return false;
  dailyDebateCount += 1;
  return true;
}

export function classifyNewsTrigger(news: NewsItem, now = Date.now()): NewsTriggerClassification {
  pruneHashes(now);
  const severity = classifySeverity(news);
  const dedupeKey = makeNewsHash(news, severity);
  const involvesMajor = news.currencies.some((currency) =>
    MAJOR_SYMBOLS.has(currency.toUpperCase()),
  );
  const hasKeyword = HIGH_IMPACT_KEYWORDS.some((keyword) =>
    news.title.toLowerCase().includes(keyword.toLowerCase()),
  );

  if (!involvesMajor) {
    return {
      severity,
      shouldAutoDebate: false,
      reason: "non_major_symbol",
      dedupeKey,
      signalSeverity: "info",
    };
  }

  if (severity !== "critical" && severity !== "high" && !hasKeyword) {
    return {
      severity,
      shouldAutoDebate: false,
      reason: "below_auto_threshold",
      dedupeKey,
      signalSeverity: severity === "medium" ? "watch" : "info",
    };
  }

  const lastDebatedAt = recentDebateHashes.get(dedupeKey);
  if (lastDebatedAt && now - lastDebatedAt < DEBATE_DEDUP_WINDOW_MS) {
    return {
      severity,
      shouldAutoDebate: false,
      reason: "dedup_12h",
      dedupeKey,
      signalSeverity: "watch",
    };
  }

  if (!canClaimDailySlot(now)) {
    return {
      severity,
      shouldAutoDebate: false,
      reason: "daily_limit",
      dedupeKey,
      signalSeverity: "watch",
    };
  }

  recentDebateHashes.set(dedupeKey, now);
  return {
    severity,
    shouldAutoDebate: true,
    reason: `${severity}_impact_news`,
    dedupeKey,
    signalSeverity: severity === "critical" ? "alert" : "watch",
  };
}

export function shouldAutoDebate(news: NewsItem, now = Date.now()): boolean {
  return classifyNewsTrigger(news, now).shouldAutoDebate;
}
