import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CoinWFuturesOrderIntent } from "./futuresOrderIntent";

export const COINW_HANDOFF_SIGNATURE_ALG = "HMAC-SHA256";
export const INTENT_SIGNATURE_TTL_MS = 10 * 60_000;
export const INTENT_NONCE_BYTES = 16;

export interface CoinWOrderIntentSignaturePayload {
  intentId: string;
  recordId: string;
  coinwPair: string;
  direction: CoinWFuturesOrderIntent["direction"];
  orderType: CoinWFuturesOrderIntent["orderType"];
  quantity: string;
  leverage: number;
  marginMode: CoinWFuturesOrderIntent["marginMode"];
  price: string | null;
  takeProfit: string | null;
  stopLoss: string | null;
  iat: number;
  exp: number;
  nonce: string;
  kid: string;
}

export interface SignedCoinWOrderIntent {
  version: 1;
  alg: typeof COINW_HANDOFF_SIGNATURE_ALG;
  kid: string;
  iat: number;
  exp: number;
  nonce: string;
  payloadHash: string;
  payload: CoinWOrderIntentSignaturePayload;
  signature: string;
}

export type CoinWOrderIntentSignatureVerification =
  | { valid: true }
  | { valid: false; reason: "expired" | "payload_hash_mismatch" | "signature_mismatch" };

export function generateIntentNonce(bytes = INTENT_NONCE_BYTES) {
  return randomBytes(Math.max(INTENT_NONCE_BYTES, Math.floor(bytes))).toString("base64url");
}

export function buildCoinWOrderIntentSignaturePayload({
  intent,
  kid,
  now = Date.now(),
  ttlMs = INTENT_SIGNATURE_TTL_MS,
  nonce = generateIntentNonce(),
}: {
  intent: CoinWFuturesOrderIntent;
  kid: string;
  now?: number;
  ttlMs?: number;
  nonce?: string;
}): CoinWOrderIntentSignaturePayload {
  const iat = Math.floor(now / 1000);
  const exp = Math.floor((now + ttlMs) / 1000);
  return {
    intentId: intent.intentId,
    recordId: intent.recordId,
    coinwPair: intent.coinwPair,
    direction: intent.direction,
    orderType: intent.orderType,
    quantity: intent.quantity,
    leverage: intent.leverage,
    marginMode: intent.marginMode,
    price: intent.price,
    takeProfit: intent.takeProfit,
    stopLoss: intent.stopLoss,
    iat,
    exp,
    nonce,
    kid,
  };
}

export function signCoinWOrderIntent({
  intent,
  kid,
  secret,
  now,
  ttlMs,
  nonce,
}: {
  intent: CoinWFuturesOrderIntent;
  kid: string;
  secret: string;
  now?: number;
  ttlMs?: number;
  nonce?: string;
}): SignedCoinWOrderIntent {
  const payload = buildCoinWOrderIntentSignaturePayload({
    intent,
    kid,
    now,
    ttlMs,
    nonce,
  });
  const payloadHash = sha256Hex(canonicalJson(payload));
  const signedContent = {
    version: 1,
    alg: COINW_HANDOFF_SIGNATURE_ALG,
    kid,
    iat: payload.iat,
    exp: payload.exp,
    nonce: payload.nonce,
    payloadHash,
    payload,
  } as const;

  return {
    ...signedContent,
    signature: hmacSha256Base64Url(secret, canonicalJson(signedContent)),
  };
}

export function verifySignedCoinWOrderIntent({
  signedIntent,
  secret,
  now = Date.now(),
}: {
  signedIntent: SignedCoinWOrderIntent;
  secret: string;
  now?: number;
}): CoinWOrderIntentSignatureVerification {
  if (signedIntent.exp * 1000 <= now) return { valid: false, reason: "expired" };
  const payloadHash = sha256Hex(canonicalJson(signedIntent.payload));
  if (payloadHash !== signedIntent.payloadHash) {
    return { valid: false, reason: "payload_hash_mismatch" };
  }
  const signedContent = {
    version: signedIntent.version,
    alg: signedIntent.alg,
    kid: signedIntent.kid,
    iat: signedIntent.iat,
    exp: signedIntent.exp,
    nonce: signedIntent.nonce,
    payloadHash: signedIntent.payloadHash,
    payload: signedIntent.payload,
  };
  const expected = hmacSha256Base64Url(secret, canonicalJson(signedContent));
  return safeEqual(expected, signedIntent.signature)
    ? { valid: true }
    : { valid: false, reason: "signature_mismatch" };
}

export function nonceHash(nonce: string) {
  return sha256Hex(nonce);
}

export function payloadHash(payload: unknown) {
  return sha256Hex(canonicalJson(payload));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortValue((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256Base64Url(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
