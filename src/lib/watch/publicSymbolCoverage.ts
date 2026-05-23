export const PUBLIC_BETA_SYMBOL_COVERAGE_TARGET = 3;
export const PUBLIC_BETA_MAJOR_ROTATION_SYMBOLS = ["BTC", "ETH", "SOL"] as const;

const NON_SYMBOL_VALUES = new Set(["UNKNOWN", "MARKET", "HOTSPOT", "SYMBOL"]);

export function normalizePublicSymbol(symbol: string | null | undefined) {
  const normalized = symbol
    ?.trim()
    .replace(/^\$+/, "")
    .replace(/_?USDT$/i, "")
    .toUpperCase();
  return normalized && !NON_SYMBOL_VALUES.has(normalized) ? normalized : null;
}

export function publicBetaSymbolCoverage(symbols: readonly (string | null | undefined)[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => normalizePublicSymbol(symbol))
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );
}

export function hasPublicBetaSymbolCoverage(symbols: readonly (string | null | undefined)[]) {
  return publicBetaSymbolCoverage(symbols).length >= PUBLIC_BETA_SYMBOL_COVERAGE_TARGET;
}

export function publicBetaSymbolCoverageKey(symbols: readonly (string | null | undefined)[]) {
  const coverage = publicBetaSymbolCoverage(symbols);
  return coverage.length > 0 ? `${coverage.length}-${coverage.join("_")}` : "0-none";
}

export function isPublicBetaMajorRotationSymbol(symbol: string | null | undefined) {
  const normalized = normalizePublicSymbol(symbol);
  return normalized
    ? PUBLIC_BETA_MAJOR_ROTATION_SYMBOLS.includes(
        normalized as (typeof PUBLIC_BETA_MAJOR_ROTATION_SYMBOLS)[number],
      )
    : false;
}
