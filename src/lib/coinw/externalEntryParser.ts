import { EXTERNAL_ENTRY_FROM_MAX_LENGTH, isExternalEntryFrom } from "./externalEntryConstants";
import { verifyExternalEntrySignature } from "./externalEntrySignature";
import { generateLandingId } from "./landingId";
import type { ExternalEntryLandingContext } from "./landingContext";
import { EMPTY_LANDING_CONTEXT } from "./landingContext";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const EXTERNAL_KEYS = ["from", "symbol", "pair", "uid", "uid_hash", "ts", "sig", "deep_link"];

export function parseExternalEntry({
  searchParams,
  secret,
  nowSec,
}: {
  searchParams: URLSearchParams;
  secret?: string;
  nowSec?: number;
}): ExternalEntryLandingContext {
  const raw_params = readRawParams(searchParams);
  const isExternalEntry = EXTERNAL_KEYS.some((key) => searchParams.has(key));
  if (!isExternalEntry) return EMPTY_LANDING_CONTEXT;

  const rawFrom = readParam(searchParams, "from");
  const from = normalizeFrom(rawFrom);
  const symbol = normalizeSymbol(readParam(searchParams, "symbol"));
  const rawPair = readParam(searchParams, "pair");
  const pair = normalizePair(rawPair);
  const rawUid = readParam(searchParams, "uid_hash") ?? readParam(searchParams, "uid");
  const uid = normalizeUidHash(rawUid);
  const ts = Number(readParam(searchParams, "ts"));
  const sig = normalizeSignature(readParam(searchParams, "sig"));
  const signature = verifyExternalEntrySignature({
    payload: {
      from: rawFrom ?? "",
      symbol: symbol ?? "",
      pair: rawPair ?? "",
      uid: uid ?? "",
      ts,
      sig: sig ?? "",
    },
    secret,
    nowSec,
  });

  return {
    isExternalEntry: true,
    from,
    symbol,
    pair,
    uid_hash: signature.valid ? uid : null,
    sig_valid: signature.valid,
    ...(signature.valid ? {} : { sig_reason: signature.reason }),
    deep_link: normalizeToken(readParam(searchParams, "deep_link"), 80),
    lang: normalizeToken(readParam(searchParams, "lang"), 20),
    theme: normalizeTheme(readParam(searchParams, "theme")),
    utm: readUtm(searchParams),
    raw_params,
    landing_id: generateLandingId(),
  };
}

function readParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value === null ? null : value.trim();
}

function readRawParams(params: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const [key, value] of Array.from(params.entries())) {
    raw[key.slice(0, 80)] = value.slice(0, 240);
  }
  return raw;
}

function readUtm(params: URLSearchParams) {
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = readParam(params, key);
    if (value) utm[key] = value.slice(0, 120);
  }
  return utm;
}

function normalizeFrom(value: string | null) {
  const cleaned = normalizeToken(value, EXTERNAL_ENTRY_FROM_MAX_LENGTH);
  if (!cleaned) return "unknown";
  if (isExternalEntryFrom(cleaned)) return cleaned;
  return `unknown_${cleaned}`.slice(0, EXTERNAL_ENTRY_FROM_MAX_LENGTH);
}

function normalizeSymbol(value: string | null) {
  const cleaned = value?.replace(/^\$+/, "").trim().toUpperCase() ?? "";
  return /^[A-Z0-9]{2,16}$/.test(cleaned) ? cleaned : null;
}

function normalizePair(value: string | null) {
  const cleaned = value?.trim().replace(/[/-]/g, "_").toUpperCase() ?? "";
  return /^[A-Z0-9]{2,20}_USDT$/.test(cleaned) ? cleaned : null;
}

function normalizeUidHash(value: string | null) {
  const cleaned = value?.trim() ?? "";
  return /^[A-Za-z0-9_-]{8,128}$/.test(cleaned) ? cleaned : null;
}

function normalizeSignature(value: string | null) {
  const cleaned = value?.trim() ?? "";
  return /^[A-Fa-f0-9]{64}$/.test(cleaned) ? cleaned : null;
}

function normalizeTheme(value: string | null) {
  if (value === "dark" || value === "light") return value;
  return null;
}

function normalizeToken(value: string | null, maxLength: number) {
  const cleaned =
    value
      ?.trim()
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .replace(/_+/g, "_") ?? "";
  return cleaned ? cleaned.slice(0, maxLength) : null;
}
