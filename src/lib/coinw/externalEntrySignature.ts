import { createHmac, timingSafeEqual } from "node:crypto";
import { EXTERNAL_ENTRY_SIG_TTL_SEC } from "./externalEntryConstants";

export interface ExternalEntrySignaturePayload {
  from: string;
  symbol: string;
  pair: string;
  uid: string;
  ts: number;
  sig: string;
}

export type ExternalEntrySignatureFailure =
  | "expired"
  | "invalid_signature"
  | "missing_field"
  | "missing_secret";

export type ExternalEntrySignatureResult =
  | { valid: true }
  | { valid: false; reason: ExternalEntrySignatureFailure };

export function externalEntrySignatureMessage(payload: Omit<ExternalEntrySignaturePayload, "sig">) {
  return `${payload.from}|${payload.symbol}|${payload.pair}|${payload.uid}|${payload.ts}`;
}

export function signExternalEntryPayload({
  payload,
  secret,
}: {
  payload: Omit<ExternalEntrySignaturePayload, "sig">;
  secret: string;
}) {
  return createHmac("sha256", secret).update(externalEntrySignatureMessage(payload)).digest("hex");
}

export function verifyExternalEntrySignature({
  payload,
  secret,
  nowSec = Math.floor(Date.now() / 1000),
  ttlSec = EXTERNAL_ENTRY_SIG_TTL_SEC,
}: {
  payload: Partial<ExternalEntrySignaturePayload>;
  secret: string | undefined;
  nowSec?: number;
  ttlSec?: number;
}): ExternalEntrySignatureResult {
  if (!secret) return { valid: false, reason: "missing_secret" };
  if (
    !payload.from ||
    !payload.symbol ||
    !payload.pair ||
    !payload.uid ||
    !Number.isFinite(payload.ts) ||
    !payload.sig
  ) {
    return { valid: false, reason: "missing_field" };
  }
  if (Math.abs(nowSec - Number(payload.ts)) > ttlSec) return { valid: false, reason: "expired" };

  const expected = signExternalEntryPayload({
    payload: {
      from: payload.from,
      symbol: payload.symbol,
      pair: payload.pair,
      uid: payload.uid,
      ts: Number(payload.ts),
    },
    secret,
  });

  return safeHexEqual(expected, payload.sig)
    ? { valid: true }
    : { valid: false, reason: "invalid_signature" };
}

function safeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right.toLowerCase(), "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
