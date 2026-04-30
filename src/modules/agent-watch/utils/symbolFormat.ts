const SYMBOL_PREFIX = "$";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCoinSymbol(symbol: string): string {
  return symbol.trim().replace(/^\$+/, "").toUpperCase();
}

export function formatCoinSymbol(symbol: string): string {
  const normalized = normalizeCoinSymbol(symbol);
  if (!/^[A-Z0-9]+$/.test(normalized)) return symbol.trim();
  return normalized ? `${SYMBOL_PREFIX}${normalized}` : "";
}

export function prefixLeadingCoinSymbol(text: string, symbol: string): string {
  const normalized = normalizeCoinSymbol(symbol);
  if (!normalized) return text;
  if (normalized === "AI" && /^\s*\$?AI\s+Agent\b/i.test(text)) return text;

  const leadingSymbol = new RegExp(`^\\s*\\$?${escapeRegExp(normalized)}(?=\\b|\\s|\\d|[-+/(（:：])`, "i");
  return text.replace(leadingSymbol, formatCoinSymbol(normalized));
}

export function prefixKnownLeadingSymbol(text: string, symbols: string[]): string {
  const sortedSymbols = symbols
    .map(normalizeCoinSymbol)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const symbol of sortedSymbols) {
    if (prefixLeadingCoinSymbol(text, symbol) !== text) {
      return prefixLeadingCoinSymbol(text, symbol);
    }
  }

  return text;
}

export function prefixCoinSymbolsInText(text: string, symbols: string[]): string {
  return symbols
    .map(normalizeCoinSymbol)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .reduce((current, symbol) => {
      const symbolPattern = new RegExp(`(^|[^$A-Za-z0-9_])\\$?${escapeRegExp(symbol)}(?=$|[^A-Za-z0-9_])`, "g");
      return current.replace(symbolPattern, (_match, prefix: string) => `${prefix}${formatCoinSymbol(symbol)}`);
    }, text);
}
