const DEFAULT_COINW_FUTURES_URL = "https://www.coinw.com/market/futures";

export function normalizeCoinWFuturesPair(value: string | null | undefined) {
  const raw = value
    ?.trim()
    .replace(/[-\s/]/g, "_")
    .toUpperCase();
  if (!raw) return null;
  if (/^[A-Z0-9]+_USDT$/.test(raw)) return raw;
  if (/^[A-Z0-9]+USDT$/.test(raw)) return `${raw.slice(0, -4)}_USDT`;
  return null;
}

export function buildCoinWFuturesTradeUrl({
  coinwPair,
  template = process.env.NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE,
  fallbackUrl = process.env.NEXT_PUBLIC_COINW_FUTURES_URL ?? DEFAULT_COINW_FUTURES_URL,
}: {
  coinwPair: string | null | undefined;
  template?: string;
  fallbackUrl?: string;
}) {
  const normalizedPair = normalizeCoinWFuturesPair(coinwPair);
  if (!normalizedPair || !template?.trim()) return fallbackUrl;

  const symbol = normalizedPair.replace(/_USDT$/, "");
  const pairCompact = normalizedPair.replace("_", "");
  return template
    .trim()
    .replace(/\{pair\}/g, normalizedPair)
    .replace(/\{pairLower\}/g, normalizedPair.toLowerCase())
    .replace(/\{pairCompact\}/g, pairCompact)
    .replace(/\{pairCompactLower\}/g, pairCompact.toLowerCase())
    .replace(/\{symbol\}/g, symbol)
    .replace(/\{symbolLower\}/g, symbol.toLowerCase());
}
