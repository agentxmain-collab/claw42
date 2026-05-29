import { NextResponse, type NextRequest } from "next/server";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import {
  backfillPublicCardIndexFromRecords,
  buildPublicCardIndexEntry,
  readPublicCardIndexEntries,
  rebuildPublicCardIndexFromRecords,
  type PublicCardIndexBackfillResult,
} from "@/lib/watch/publicCardIndex";
import { normalizeWatchLocale } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const REBACKFILL_RECORD_READ_LIMIT = 2_000;

export async function GET(request: NextRequest) {
  return handleRebackfill(request);
}

export async function POST(request: NextRequest) {
  return handleRebackfill(request);
}

async function handleRebackfill(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const locale = normalizeWatchLocale(request.nextUrl.searchParams.get("locale") ?? "zh_CN");
  if (locale !== "zh_CN") {
    return NextResponse.json(
      { ok: false, error: "unsupported_locale", locale, supportedLocales: ["zh_CN"] },
      { status: 400 },
    );
  }
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const action = request.nextUrl.searchParams.get("action") ?? "rebackfill";
  if (action !== "rebackfill") {
    if (action !== "rebuild") {
      return NextResponse.json(
        {
          ok: false,
          error: "unsupported_action",
          action,
          supportedActions: ["rebackfill", "rebuild"],
        },
        { status: 400 },
      );
    }
  }

  const records = await readAllDecisionRecords(REBACKFILL_RECORD_READ_LIMIT, locale);

  if (action === "rebuild") {
    const result = await rebuildPublicCardIndexFromRecords(records, { locale, dryRun });
    return NextResponse.json(
      {
        ok: true,
        locale,
        action,
        dryRun,
        rebuiltCount: result.rebuiltCount,
        addedCount: result.addedCount,
        removedCount: result.removedCount,
        kept: result.kept,
        alreadyIndexed: result.alreadyIndexed,
        recordsRead: result.recordsRead,
        candidateCount: result.candidateCount,
        skippedNonStrategy: result.skippedNonStrategy,
        errors: result.errors,
        result,
        durationMs: Math.max(0, Date.now() - startedAt),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const indexedEntries = await readPublicCardIndexEntries(locale);
  const indexedIds = new Set(indexedEntries.map((entry) => entry.id));
  const candidates: StrategyDecisionRecord[] = [];
  let alreadyIndexed = 0;
  let skippedNonStrategy = 0;

  for (const record of records) {
    const entry = buildPublicCardIndexEntry(record);
    if (!entry) {
      skippedNonStrategy += 1;
      continue;
    }
    if (indexedIds.has(entry.id)) {
      alreadyIndexed += 1;
      continue;
    }
    candidates.push(record);
  }

  const result: PublicCardIndexBackfillResult | null = dryRun
    ? null
    : await backfillPublicCardIndexFromRecords(candidates, { locale, dryRun: false });

  return NextResponse.json(
    {
      ok: true,
      locale,
      dryRun,
      recordsRead: records.length,
      alreadyIndexed,
      skippedNonStrategy,
      candidateCount: candidates.length,
      rebackfilledCount: dryRun ? candidates.length : (result?.recordsWritten ?? 0),
      errors: result?.recordsSkippedReason.writeFailed ?? 0,
      result,
      durationMs: Math.max(0, Date.now() - startedAt),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.OPS_HEALTH_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-claw42-ops-secret") === secret;
}
