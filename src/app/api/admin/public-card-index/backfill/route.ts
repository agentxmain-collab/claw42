import { NextResponse, type NextRequest } from "next/server";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import {
  backfillPublicCardIndexFromRecords,
  type PublicCardIndexBackfillResult,
} from "@/lib/watch/publicCardIndex";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import type { Locale } from "@/i18n/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BACKFILL_RECORD_READ_LIMIT = 2_000;
const DEFAULT_BACKFILL_LOCALES: Locale[] = ["zh_CN", "en_US"];

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const backfillToken = process.env.BACKFILL_TOKEN;
  // BACKFILL_TOKEN is a scoped manual-trigger fallback for this idempotent route only.
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  if (backfillToken && request.nextUrl.searchParams.get("token") === backfillToken) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const locales = resolveBackfillLocales(request.nextUrl.searchParams.get("locale"));
  const results: PublicCardIndexBackfillResult[] = [];

  for (const locale of locales) {
    const records = await readAllDecisionRecords(BACKFILL_RECORD_READ_LIMIT, locale);
    results.push(
      await backfillPublicCardIndexFromRecords(records, {
        locale,
        dryRun,
      }),
    );
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    locales,
    results,
    totals: summarizeBackfillResults(results),
    durationMs: Math.max(0, Date.now() - startedAt),
  });
}

function resolveBackfillLocales(value: string | null): Locale[] {
  if (!value) return DEFAULT_BACKFILL_LOCALES;
  return Array.from(
    new Set(
      value
        .split(",")
        .map((locale) => normalizeWatchLocale(locale.trim()))
        .filter(Boolean),
    ),
  );
}

function summarizeBackfillResults(results: PublicCardIndexBackfillResult[]) {
  return {
    recordsScanned: results.reduce((total, result) => total + result.recordsScanned, 0),
    recordsWritten: results.reduce((total, result) => total + result.recordsWritten, 0),
    indexCountAfter: results.reduce((total, result) => total + result.indexCountAfter, 0),
    removedByAge: results.reduce((total, result) => total + result.removedByAge, 0),
    removedByCap: results.reduce((total, result) => total + result.removedByCap, 0),
    writeFailed: results.reduce(
      (total, result) => total + result.recordsSkippedReason.writeFailed,
      0,
    ),
  };
}
