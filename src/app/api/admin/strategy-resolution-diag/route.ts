import { NextResponse } from "next/server";
import { buildStrategyResolutionDiagnostic } from "@/lib/team/strategyResolutionDiag";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import type { Locale } from "@/i18n/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_READ_LIMIT = 500;
const MAX_READ_LIMIT = 2000;
const DEFAULT_LOCALES: Locale[] = ["zh_CN", "en_US"];

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const readLimit = normalizeReadLimit(url.searchParams.get("readLimit"));
  const locales = parseLocales(url.searchParams.get("locale"));
  const servedAt = Date.now();
  const diagnostics = await Promise.all(
    locales.map((locale) =>
      buildStrategyResolutionDiagnostic({
        locale,
        readLimit,
        now: servedAt,
      }),
    ),
  );

  if (diagnostics.length === 1) {
    return NextResponse.json(
      {
        ok: true,
        servedAt,
        ...diagnostics[0],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      servedAt,
      readLimit,
      locales,
      results: Object.fromEntries(diagnostics.map((diagnostic) => [diagnostic.locale, diagnostic])),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function isAuthorized(request: Request) {
  const secret = process.env.OPS_HEALTH_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-claw42-ops-secret") === secret;
}

function normalizeReadLimit(value: string | null) {
  if (!value) return DEFAULT_READ_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_READ_LIMIT;
  return Math.max(1, Math.min(MAX_READ_LIMIT, Math.floor(parsed)));
}

function parseLocales(value: string | null): Locale[] {
  if (!value) return DEFAULT_LOCALES;
  const locales = value
    .split(",")
    .map((item) => normalizeWatchLocale(item))
    .filter((locale, index, source) => source.indexOf(locale) === index);
  return locales.length > 0 ? locales : DEFAULT_LOCALES;
}
