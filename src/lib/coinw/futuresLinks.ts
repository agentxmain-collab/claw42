const DEFAULT_COINW_HOST = "https://www.coinw.com";
const DEFAULT_COINW_LOCALE = "zh_CN";

export function normalizeCoinWFuturesLocale(value: string | null | undefined) {
  const locale = value?.trim();
  return locale && /^[a-z]{2}_[A-Z]{2}$/.test(locale) ? locale : DEFAULT_COINW_LOCALE;
}

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
  locale,
  template = process.env.NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE,
  fallbackUrl = process.env.NEXT_PUBLIC_COINW_FUTURES_URL,
}: {
  coinwPair: string | null | undefined;
  locale?: string | null;
  template?: string;
  fallbackUrl?: string;
}) {
  const normalizedLocale = normalizeCoinWFuturesLocale(locale);
  const resolvedFallback =
    fallbackUrl?.trim() || `${DEFAULT_COINW_HOST}/${normalizedLocale}/futures/usdt`;
  const normalizedPair = normalizeCoinWFuturesPair(coinwPair);
  const resolvedTemplate =
    template?.trim() || `${DEFAULT_COINW_HOST}/{locale}/futures/usdt/{pairCompactLower}`;
  if (!normalizedPair) return resolvedFallback.replace(/\{locale\}/g, normalizedLocale);

  const symbol = normalizedPair.replace(/_USDT$/, "");
  const pairCompact = normalizedPair.replace("_", "");
  return resolvedTemplate
    .replace(/\{locale\}/g, normalizedLocale)
    .replace(/\{pair\}/g, normalizedPair)
    .replace(/\{pairLower\}/g, normalizedPair.toLowerCase())
    .replace(/\{pairCompact\}/g, pairCompact)
    .replace(/\{pairCompactLower\}/g, pairCompact.toLowerCase())
    .replace(/\{symbol\}/g, symbol)
    .replace(/\{symbolLower\}/g, symbol.toLowerCase());
}
