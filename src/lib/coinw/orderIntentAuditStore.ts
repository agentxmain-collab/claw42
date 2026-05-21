import { kv } from "@vercel/kv";
import type { CandidateType } from "@/lib/watch/decisionCandidate";
import type { CoinWFuturesOrderIntent, CoinWFuturesOrderType } from "./futuresOrderIntent";
import {
  INTENT_SIGNATURE_TTL_MS,
  nonceHash,
  payloadHash,
  type SignedCoinWOrderIntent,
} from "./orderIntentSignature";

export const COINW_ORDER_INTENT_AUDIT_VERSION = 1;
export const INTENT_REPLAY_LOCK_TTL_MS = INTENT_SIGNATURE_TTL_MS + 60_000;

export const COINW_HANDOFF_STATUS_VALUES = [
  "created",
  "opened",
  "confirmed",
  "submitted",
  "rejected",
  "expired",
  "cancelled",
  "failed",
] as const;

export type CoinWHandoffStatus = (typeof COINW_HANDOFF_STATUS_VALUES)[number];

export interface CoinWOrderIntentAuditRow {
  auditVersion: typeof COINW_ORDER_INTENT_AUDIT_VERSION;
  intentId: string;
  recordId: string;
  candidateType: CandidateType | null;
  candidateKey: string | null;
  symbol: string;
  coinwPair: string;
  direction: CoinWFuturesOrderIntent["direction"];
  orderType: CoinWFuturesOrderType;
  leverage: number;
  marginMode: CoinWFuturesOrderIntent["marginMode"];
  gate: string;
  mode: string;
  createdAt: string;
  expiresAt: string;
  payloadHash: string;
  signatureKid: string;
  nonceHash: string;
  handoffUrlHash: string | null;
  coinwStatus: CoinWHandoffStatus;
  coinwOrderId: string | null;
  rejectErrorCode: string | null;
  callbackAt: string | null;
  userSessionHash: string | null;
}

type KvClient = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(
    key: string,
    value: unknown,
    options?: { ex?: number; px?: number; nx?: true },
  ): Promise<unknown>;
};

interface StoreOptions {
  client?: KvClient;
  now?: number;
  ttlSeconds?: number;
}

const AUDIT_TTL_SECONDS = 60 * 60 * 24 * 30;
const memoryAuditRows = new Map<string, CoinWOrderIntentAuditRow>();
const memoryNonceLocks = new Map<string, number>();

export function isCoinWHandoffStatus(value: unknown): value is CoinWHandoffStatus {
  return (
    typeof value === "string" && (COINW_HANDOFF_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function buildCoinWOrderIntentAuditRow({
  intent,
  signedIntent,
  gate,
  mode,
  candidateType = "symbol",
  candidateKey = intent.symbol,
  userSessionHash = null,
  handoffUrl = null,
}: {
  intent: CoinWFuturesOrderIntent;
  signedIntent: SignedCoinWOrderIntent;
  gate: string;
  mode: string;
  candidateType?: CandidateType | null;
  candidateKey?: string | null;
  userSessionHash?: string | null;
  handoffUrl?: string | null;
}): CoinWOrderIntentAuditRow {
  return {
    auditVersion: COINW_ORDER_INTENT_AUDIT_VERSION,
    intentId: intent.intentId,
    recordId: intent.recordId,
    candidateType,
    candidateKey,
    symbol: intent.symbol,
    coinwPair: intent.coinwPair,
    direction: intent.direction,
    orderType: intent.orderType,
    leverage: intent.leverage,
    marginMode: intent.marginMode,
    gate,
    mode,
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
    payloadHash: signedIntent.payloadHash,
    signatureKid: signedIntent.kid,
    nonceHash: nonceHash(signedIntent.nonce),
    handoffUrlHash: handoffUrl ? payloadHash(handoffUrl) : null,
    coinwStatus: "created",
    coinwOrderId: null,
    rejectErrorCode: null,
    callbackAt: null,
    userSessionHash,
  };
}

export async function reserveCoinWIntentNonce(
  nonceHashValue: string,
  options: StoreOptions & { ttlMs?: number } = {},
) {
  const ttlMs = Math.max(1, Math.floor(options.ttlMs ?? INTENT_REPLAY_LOCK_TTL_MS));
  const client = options.client ?? kvClient();
  if (!client) return reserveMemoryNonce(nonceHashValue, ttlMs, options.now ?? Date.now());

  const result = await client.set(nonceStorageKey(nonceHashValue), "1", {
    nx: true,
    px: ttlMs,
  });
  return result === "OK" || result === "ok" || result === true;
}

export async function writeCoinWOrderIntentAudit(
  row: CoinWOrderIntentAuditRow,
  options: StoreOptions = {},
) {
  const client = options.client ?? kvClient();
  if (!client) {
    memoryAuditRows.set(row.intentId, row);
    return row;
  }

  await client.set(auditStorageKey(row.intentId), row, {
    ex: Math.floor(options.ttlSeconds ?? AUDIT_TTL_SECONDS),
  });
  return row;
}

export async function readCoinWOrderIntentAudit(
  intentId: string,
  options: StoreOptions = {},
): Promise<CoinWOrderIntentAuditRow | null> {
  const client = options.client ?? kvClient();
  if (!client) return memoryAuditRows.get(intentId) ?? null;
  return normalizeAuditRow(await client.get(auditStorageKey(intentId)));
}

export async function updateCoinWOrderIntentAuditStatus(
  intentId: string,
  update: {
    status: CoinWHandoffStatus;
    coinwOrderId?: string | null;
    rejectErrorCode?: string | null;
    callbackAt?: string | null;
  },
  options: StoreOptions = {},
) {
  const current = await readCoinWOrderIntentAudit(intentId, options);
  if (!current) return null;
  const next: CoinWOrderIntentAuditRow = {
    ...current,
    coinwStatus: update.status,
    coinwOrderId: update.coinwOrderId ?? current.coinwOrderId,
    rejectErrorCode: update.rejectErrorCode ?? current.rejectErrorCode,
    callbackAt: update.callbackAt ?? new Date(options.now ?? Date.now()).toISOString(),
  };
  return writeCoinWOrderIntentAudit(next, options);
}

function reserveMemoryNonce(nonceHashValue: string, ttlMs: number, now: number) {
  cleanupMemoryNonces(now);
  if (memoryNonceLocks.has(nonceHashValue)) return false;
  memoryNonceLocks.set(nonceHashValue, now + ttlMs);
  return true;
}

function cleanupMemoryNonces(now: number) {
  for (const [key, expiresAt] of Array.from(memoryNonceLocks.entries())) {
    if (expiresAt <= now) memoryNonceLocks.delete(key);
  }
}

function normalizeAuditRow(value: unknown): CoinWOrderIntentAuditRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<CoinWOrderIntentAuditRow>;
  if (row.auditVersion !== COINW_ORDER_INTENT_AUDIT_VERSION || !row.intentId) return null;
  if (!isCoinWHandoffStatus(row.coinwStatus)) return null;
  return row as CoinWOrderIntentAuditRow;
}

function auditStorageKey(intentId: string) {
  return `coinw:intent:audit:${intentId}`;
}

function nonceStorageKey(nonceHashValue: string) {
  return `coinw:intent:nonce:${nonceHashValue}`;
}

function kvClient(): KvClient | null {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    ? (kv as KvClient)
    : null;
}

export const __coinWOrderIntentAuditStoreTestUtils = {
  clearMemory() {
    memoryAuditRows.clear();
    memoryNonceLocks.clear();
  },
  memoryAuditRows,
  memoryNonceLocks,
};
