import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceIds = [
  "cryptocompare",
  "coingecko",
  "cryptopanic",
  "rss-coindesk",
  "rss-cointelegraph",
  "rss-decrypt",
  "binance-announcements",
  "coinw-announcements",
];

const requiredFiles = [
  "src/lib/types.ts",
  "src/lib/factionRegistry.ts",
  "src/lib/news/sourceRegistry.ts",
  "src/lib/news/sourceChain.ts",
  "src/lib/news/cache.ts",
  "src/lib/news/normalizer.ts",
  "src/lib/news/quotaTracker.ts",
  "src/lib/news/mock-news.json",
  "src/lib/news/mock-all-sources-offline.json",
  "src/lib/news/adapters/types.ts",
  "src/lib/news/adapters/cryptocompare-adapter.ts",
  "src/lib/news/adapters/coingecko-news-adapter.ts",
  "src/lib/news/adapters/rss-adapter.ts",
  "src/lib/news/adapters/binance-announcements-adapter.ts",
  "src/lib/news/adapters/coinw-announcements-adapter.ts",
  "src/lib/news/adapters/cryptopanic-adapter.ts",
  "src/lib/debateOrchestrator.ts",
  "src/modules/agent-watch/components/NewsDebateCard.tsx",
  "src/modules/agent-watch/components/NewsFeedTicker.tsx",
  "src/app/api/cron/strategy-replay/route.ts",
  "src/app/api/debates/[id]/route.ts",
  "src/app/api/og/debate/[id]/route.tsx",
  "src/app/[locale]/agent/replay/page.tsx",
  "docs/adr/0003-fake-follow-count.md",
  "docs/adr/0004-strategy-replay-cron.md",
  "docs/adr/0005-recharts-bundle-impact.md",
  "docs/adr/0006-vercel-og-bundle.md",
  "docs/adr/0007-rss-parser-dependency.md",
  "docs/adr/0008-cryptopanic-standby-mode.md",
  "vercel.json",
];

const checks = [];

function file(path) {
  return join(root, path);
}

function read(path) {
  return readFileSync(file(path), "utf8");
}

function check(name, ok, level = "error") {
  checks.push({ name, ok, level });
}

for (const path of requiredFiles) {
  check(`exists:${path}`, existsSync(file(path)));
}

check("removed:src/lib/api/cryptopanic.ts", !existsSync(file("src/lib/api/cryptopanic.ts")));

const packageJson = JSON.parse(read("package.json"));
check("dependency:rss-parser", packageJson.dependencies?.["rss-parser"] === "^3.13.0");

const analytics = read("src/lib/analytics.ts");
const events = [
  "news_debate_view",
  "news_debate_original_click",
  "news_debate_strategy_follow_click",
  "news_debate_share_open",
  "news_debate_share_copy",
  "news_feed_ticker_click",
  "agent_mini_card_click",
  "strategy_replay_view",
  "replay_page_view",
  "news_fetched",
  "news_source_failed",
  "news_normalizer_run",
  "news_quota_alert",
];
for (const event of events) {
  check(`analytics:${event}`, analytics.includes(`"${event}"`));
}

const csp = read("next.config.mjs");
for (const domain of [
  "https://min-api.cryptocompare.com",
  "https://api.coingecko.com",
  "https://pro-api.coingecko.com",
  "https://www.coindesk.com",
  "https://cointelegraph.com",
  "https://decrypt.co",
  "https://www.binance.com",
  "https://cryptopanic.com",
  "https://api.qrserver.com",
]) {
  check(`csp:${domain}`, csp.includes(domain));
}

const sourceRegistry = read("src/lib/news/sourceRegistry.ts");
for (const id of sourceIds) {
  check(`registry:${id}`, sourceRegistry.includes(`id: "${id}"`));
}
check(
  "registry:cryptopanic-standby",
  /["']?cryptopanic["']?:[\s\S]*status:\s*"standby"/.test(sourceRegistry),
);
check(
  "registry:coinw-planned",
  /["']?coinw-announcements["']?:[\s\S]*status:\s*"planned"/.test(sourceRegistry),
);

const sourceLiteralViolations = [];
const srcFiles = [
  "src/lib/news/sourceChain.ts",
  "src/lib/news/adapters/cryptocompare-adapter.ts",
  "src/lib/news/adapters/coingecko-news-adapter.ts",
  "src/lib/news/adapters/rss-adapter.ts",
  "src/lib/news/adapters/binance-announcements-adapter.ts",
  "src/lib/news/adapters/coinw-announcements-adapter.ts",
  "src/lib/news/adapters/cryptopanic-adapter.ts",
  "src/lib/debateOrchestrator.ts",
  "src/lib/agentAnalysis.ts",
  "src/lib/newsTriggers.ts",
];
for (const path of srcFiles) {
  const text = read(path);
  for (const id of sourceIds) {
    if (new RegExp(`["']${id}["']`).test(text)) sourceLiteralViolations.push(`${path}:${id}`);
  }
}
check("NEWS_SOURCE_REGISTRY hardcode-grep:0", sourceLiteralViolations.length === 0);

const mockNews = JSON.parse(read("src/lib/news/mock-news.json"));
check(
  "mock-news:schema",
  Array.isArray(mockNews) &&
    mockNews.length > 0 &&
    mockNews.every(
      (item) =>
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.url === "string" &&
        typeof item.source === "string" &&
        Array.isArray(item.currencies) &&
        ["bullish", "bearish", "neutral"].includes(item.sentiment) &&
        typeof item.publishedAt === "number",
    ),
);

const vercelJson = read("vercel.json");
check("cron:/api/cron/strategy-replay", vercelJson.includes("/api/cron/strategy-replay"));

check("env:CRYPTOCOMPARE_API_KEY", Boolean(process.env.CRYPTOCOMPARE_API_KEY), "warn");
check("env:COINGECKO_DEMO_KEY", Boolean(process.env.COINGECKO_DEMO_KEY), "warn");
check("env:CRYPTOPANIC_API_KEY standby", Boolean(process.env.CRYPTOPANIC_API_KEY), "warn");
check("rss:live-check skipped", process.env.VERIFY_NEWS_LIVE === "1", "warn");
check("coinw:planned endpoint pending", false, "warn");

for (const item of checks) {
  const icon = item.ok ? "✅" : item.level === "warn" ? "⚠️" : "❌";
  console.log(`${icon} ${item.name}`);
}

if (sourceLiteralViolations.length > 0) {
  console.error("source-id literal violations:");
  for (const violation of sourceLiteralViolations) console.error(`- ${violation}`);
}

const failures = checks.filter((item) => !item.ok && item.level === "error");
if (failures.length > 0) {
  console.error(`[claw42] news verification failed: ${failures.length} failed`);
  process.exit(1);
}

console.log("[claw42] news verification passed");
