export type SymbolChain = "ethereum" | "bsc" | "solana";

export interface SymbolMapping {
  symbol: string;
  coinwPair: string;
  coingeckoId: string;
  chain?: SymbolChain | null;
  contract?: string;
  defillamaSlug?: string;
  fallback: {
    onchainMissing: boolean;
    fundamentalMissing: boolean;
  };
}

const KNOWN_SYMBOL_MAPPINGS: Record<string, SymbolMapping> = {
  BTC: {
    symbol: "BTC",
    coinwPair: "BTC_USDT",
    coingeckoId: "bitcoin",
    chain: null,
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  ETH: {
    symbol: "ETH",
    coinwPair: "ETH_USDT",
    coingeckoId: "ethereum",
    chain: "ethereum",
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  SOL: {
    symbol: "SOL",
    coinwPair: "SOL_USDT",
    coingeckoId: "solana",
    chain: "solana",
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  USDT: {
    symbol: "USDT",
    coinwPair: "USDT_USDT",
    coingeckoId: "tether",
    chain: "ethereum",
    contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    fallback: { onchainMissing: false, fundamentalMissing: true },
  },
};

function normalizeSymbol(symbol: string) {
  return symbol.trim().replace(/^\$+/, "").toUpperCase();
}

export function resolveSymbolMapping(symbol: string): SymbolMapping {
  const normalized = normalizeSymbol(symbol);
  return (
    KNOWN_SYMBOL_MAPPINGS[normalized] ?? {
      symbol: normalized || "UNKNOWN",
      coinwPair: normalized ? `${normalized}_USDT` : "UNKNOWN_USDT",
      coingeckoId: normalized.toLowerCase(),
      chain: null,
      fallback: { onchainMissing: true, fundamentalMissing: true },
    }
  );
}

export function knownSymbolMappings() {
  return { ...KNOWN_SYMBOL_MAPPINGS };
}
