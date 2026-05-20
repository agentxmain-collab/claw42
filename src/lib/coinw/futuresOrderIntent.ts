import { randomUUID } from "node:crypto";
import {
  normalizeCoinWFuturesSymbol,
  type CoinWFuturesInstrumentSet,
} from "@/lib/coinw/futuresInstruments";

export type CoinWFuturesOrderDirection = "long" | "short";
export type CoinWFuturesOrderType = "market" | "limit";
export type CoinWFuturesMarginMode = "isolated" | "cross";
export type CoinWFuturesPositionType = "execute" | "plan";

export interface CoinWFuturesOrderIntentInput {
  recordId: string;
  symbol: string;
  direction: CoinWFuturesOrderDirection;
  orderType: CoinWFuturesOrderType;
  quantity: string | number;
  price?: string | number | null;
  leverage: number;
  marginMode: CoinWFuturesMarginMode;
  takeProfit?: string | number | null;
  stopLoss?: string | number | null;
}

export interface CoinWFuturesOrderIntent {
  intentId: string;
  status: "pending_confirmation";
  createdAt: string;
  expiresAt: string;
  marketType: "futures";
  recordId: string;
  symbol: string;
  coinwPair: string;
  direction: CoinWFuturesOrderDirection;
  orderType: CoinWFuturesOrderType;
  quantity: string;
  price: string | null;
  leverage: number;
  marginMode: CoinWFuturesMarginMode;
  takeProfit: string | null;
  stopLoss: string | null;
  source: {
    source: "claw42";
    intentId: string;
    recordId: string;
  };
  coinwRequest: {
    method: "POST";
    endpoint: "/v1/perpum/order";
    body: CoinWFuturesOrderRequestBody;
  };
}

export interface CoinWFuturesOrderRequestBody {
  instrument: string;
  direction: CoinWFuturesOrderDirection;
  leverage: number;
  quantityUnit: 0;
  quantity: string;
  positionModel: 0 | 1;
  positionType: CoinWFuturesPositionType;
  openPrice?: string;
  stopProfitPrice?: string;
  stopLossPrice?: string;
  thirdOrderId: string;
}

const MAX_THIRD_ORDER_ID_LENGTH = 50;
const INTENT_TTL_MS = 10 * 60_000;

function sanitizeThirdOrderComponent(value: string) {
  return value
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildCoinWFuturesThirdOrderId(intentId: string, attempt = 1) {
  const prefix = "claw42_";
  const suffix = `_${Math.max(1, Math.floor(attempt))}`;
  const available = MAX_THIRD_ORDER_ID_LENGTH - prefix.length - suffix.length;
  const source = sanitizeThirdOrderComponent(intentId) || randomUUID().replace(/-/g, "");
  return `${prefix}${source.slice(0, Math.max(1, available))}${suffix}`;
}

function normalizePositiveDecimal(value: string | number | null | undefined, errorCode: string) {
  const stringValue =
    typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^(?:\d+|\d*\.\d+)$/.test(stringValue) || Number(stringValue) <= 0) {
    throw new Error(errorCode);
  }
  return stringValue;
}

function normalizeOptionalPositiveDecimal(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return null;
  return normalizePositiveDecimal(value, "coinw_futures_optional_price_invalid");
}

function normalizeRecordId(value: string) {
  const recordId = value.trim();
  if (!/^[A-Za-z0-9:_-]{1,180}$/.test(recordId)) {
    throw new Error("coinw_futures_record_id_invalid");
  }
  return recordId;
}

function assertLeverage(leverage: number, maxLeverage?: number) {
  if (!Number.isInteger(leverage) || leverage < 1) {
    throw new Error("coinw_futures_leverage_invalid");
  }
  if (maxLeverage !== undefined && leverage > maxLeverage) {
    throw new Error("coinw_futures_leverage_exceeds_instrument_limit");
  }
}

export function buildCoinWFuturesOrderIntent(
  input: CoinWFuturesOrderIntentInput,
  options: {
    instruments: CoinWFuturesInstrumentSet;
    now?: string;
    intentId?: string;
    attempt?: number;
  },
): CoinWFuturesOrderIntent {
  const symbol = normalizeCoinWFuturesSymbol(input.symbol);
  if (!symbol) throw new Error("coinw_futures_symbol_invalid");
  const instrument = options.instruments.get(symbol);
  if (!instrument) throw new Error("coinw_futures_symbol_not_supported");

  const recordId = normalizeRecordId(input.recordId);
  const quantity = normalizePositiveDecimal(input.quantity, "coinw_futures_quantity_required");
  const price =
    input.orderType === "limit"
      ? normalizePositiveDecimal(input.price, "coinw_futures_limit_price_required")
      : null;
  const takeProfit = normalizeOptionalPositiveDecimal(input.takeProfit);
  const stopLoss = normalizeOptionalPositiveDecimal(input.stopLoss);
  assertLeverage(input.leverage, instrument.maxLeverage);

  const intentId = options.intentId ?? randomUUID();
  const createdAt = options.now ?? new Date().toISOString();
  const createdTime = Date.parse(createdAt);
  const expiresAt = new Date(
    Number.isFinite(createdTime) ? createdTime + INTENT_TTL_MS : Date.now() + INTENT_TTL_MS,
  ).toISOString();
  const positionType: CoinWFuturesPositionType = input.orderType === "market" ? "execute" : "plan";
  const body: CoinWFuturesOrderRequestBody = {
    instrument: symbol,
    direction: input.direction,
    leverage: input.leverage,
    quantityUnit: 0,
    quantity,
    positionModel: input.marginMode === "isolated" ? 0 : 1,
    positionType,
    ...(price ? { openPrice: price } : {}),
    ...(takeProfit ? { stopProfitPrice: takeProfit } : {}),
    ...(stopLoss ? { stopLossPrice: stopLoss } : {}),
    thirdOrderId: buildCoinWFuturesThirdOrderId(intentId, options.attempt ?? 1),
  };

  return {
    intentId,
    status: "pending_confirmation",
    createdAt,
    expiresAt,
    marketType: "futures",
    recordId,
    symbol,
    coinwPair: instrument.coinwPair,
    direction: input.direction,
    orderType: input.orderType,
    quantity,
    price,
    leverage: input.leverage,
    marginMode: input.marginMode,
    takeProfit,
    stopLoss,
    source: {
      source: "claw42",
      intentId,
      recordId,
    },
    coinwRequest: {
      method: "POST",
      endpoint: "/v1/perpum/order",
      body,
    },
  };
}
