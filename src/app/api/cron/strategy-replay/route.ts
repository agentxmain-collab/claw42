import { NextResponse, type NextRequest } from "next/server";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { fetchNewsWithChain } from "@/lib/news/sourceChain";
import { tryOrchestrateNewsDebate, listNewsDebates } from "@/lib/debateOrchestrator";
import { getCoinPool } from "@/lib/marketDataCache";
import { adjustDebtFromReplays } from "@/lib/agentRelationship";
import { evaluateStrategy, recordStrategyReplay } from "@/lib/strategyHistory";
import { tryAcquireLock } from "@/lib/storage/kv-lock";
import { triggerPmDecisionPipelineOnce } from "@/lib/team/pmDecisionTrigger";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STRATEGY_REPLAY_TRIGGER_LOCK_KEY = "cron:strategy-replay:trigger-now";
const STRATEGY_REPLAY_TRIGGER_LOCK_MS = 5 * 60_000;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const trigger = request.nextUrl.searchParams.get("trigger");
  const triggerLock =
    trigger === "now"
      ? await tryAcquireLock(STRATEGY_REPLAY_TRIGGER_LOCK_KEY, {
          ttlMs: STRATEGY_REPLAY_TRIGGER_LOCK_MS,
          waitMs: 0,
        })
      : null;
  if (trigger === "now" && !triggerLock) {
    return NextResponse.json({
      ok: true,
      skipped: "strategy-replay trigger already ran within 5 minutes",
      trigger,
      servedAt: Date.now(),
    });
  }

  const now = Date.now();
  const { items, servedBy, fellBackFrom } = await fetchNewsWithChain({ limit: 8 });
  const debates = [];
  const normalizedItems: NewsItem[] = [];

  for (const item of items) {
    const normalizedItem = await normalizeNewsItem(item, servedBy);
    normalizedItems.push(normalizedItem);
    const debate = await tryOrchestrateNewsDebate(normalizedItem, now + debates.length * 1000);
    if (!debate) continue;
    debates.push(debate);
    if (debates.length >= 2) break;
  }

  const pool = await getCoinPool();
  const replayed = [];

  for (const debate of listNewsDebates(20)) {
    const strategy = debate.finalStrategy;
    if (!strategy || strategy.direction === "wait") continue;
    const ticker = [...pool.majors, ...pool.trending, ...pool.opportunity].find(
      (item) => item.symbol.toUpperCase() === strategy.symbol.toUpperCase(),
    );
    if (!ticker) continue;
    const entryPrice =
      strategy.stopLoss > 0 ? (strategy.stopLoss + ticker.price) / 2 : ticker.price;
    const replay = evaluateStrategy(strategy, entryPrice, ticker.price, now);
    await recordStrategyReplay(replay);
    replayed.push(replay);
  }
  await adjustDebtFromReplays(replayed, now).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[claw42] relationship debt adjustment skipped", error);
    }
  });
  const pmDecision = await triggerPmDecisionPipelineOnce({
    triggerSource: trigger === "now" ? "user_visit_trigger" : "cron",
    pool,
    newsItems: normalizedItems,
    now,
  });

  return NextResponse.json({
    ok: true,
    servedBy,
    fellBackFrom,
    generatedDebates: debates.length,
    pmDecisionGenerated: Boolean(pmDecision),
    replayed: replayed.length,
    trigger,
    triggerLockAcquiredAt: triggerLock?.acquiredAt ?? null,
    servedAt: now,
  });
}
