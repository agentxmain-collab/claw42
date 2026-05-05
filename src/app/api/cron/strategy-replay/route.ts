import { NextResponse, type NextRequest } from "next/server";
import { fetchCryptoPanicNews } from "@/lib/api/cryptopanic";
import { tryOrchestrateNewsDebate, listNewsDebates } from "@/lib/debateOrchestrator";
import { getCoinPool } from "@/lib/marketDataCache";
import { evaluateStrategy, recordStrategyReplay } from "@/lib/strategyHistory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const { items, mode, degraded } = await fetchCryptoPanicNews({ limit: 8 });
  const debates = [];

  for (const item of items) {
    const debate = await tryOrchestrateNewsDebate(item, now + debates.length * 1000);
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
    recordStrategyReplay(replay);
    replayed.push(replay);
  }

  return NextResponse.json({
    ok: true,
    mode,
    degraded,
    generatedDebates: debates.length,
    replayed: replayed.length,
    servedAt: now,
  });
}
