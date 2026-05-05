import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/lib/types.ts",
  "src/lib/factionRegistry.ts",
  "src/lib/api/cryptopanic.ts",
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
  "vercel.json",
];

const checks = [];

for (const file of requiredFiles) {
  checks.push({
    name: `exists:${file}`,
    ok: existsSync(join(root, file)),
  });
}

const analytics = readFileSync(join(root, "src/lib/analytics.ts"), "utf8");
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
];
for (const event of events) {
  checks.push({ name: `analytics:${event}`, ok: analytics.includes(`"${event}"`) });
}

const csp = readFileSync(join(root, "next.config.mjs"), "utf8");
for (const domain of ["https://cryptopanic.com", "https://api.qrserver.com"]) {
  checks.push({ name: `csp:${domain}`, ok: csp.includes(domain) });
}

const vercelJson = readFileSync(join(root, "vercel.json"), "utf8");
checks.push({
  name: "cron:/api/cron/strategy-replay",
  ok: vercelJson.includes("/api/cron/strategy-replay"),
});

const failures = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "✓" : "✗"} ${check.name}`);
}

if (failures.length > 0) {
  console.error(`[claw42] news verification failed: ${failures.length} failed`);
  process.exit(1);
}

console.log("[claw42] news verification passed");
