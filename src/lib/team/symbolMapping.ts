export type SymbolChain = "ethereum" | "bsc" | "solana";

export interface SymbolMapping {
  symbol: string;
  coinwPair: string;
  coingeckoId: string;
  chain?: SymbolChain | null;
  contract?: string;
  defillamaSlug?: string;
  execution: {
    executable: boolean;
    coinwPair: string | null;
    watchOnlyReason?: "not_listed_on_coinw" | "mapping_unknown";
  };
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
    execution: { executable: true, coinwPair: "BTC_USDT" },
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  ETH: {
    symbol: "ETH",
    coinwPair: "ETH_USDT",
    coingeckoId: "ethereum",
    chain: "ethereum",
    execution: { executable: true, coinwPair: "ETH_USDT" },
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  SOL: {
    symbol: "SOL",
    coinwPair: "SOL_USDT",
    coingeckoId: "solana",
    chain: "solana",
    execution: { executable: true, coinwPair: "SOL_USDT" },
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  HYPE: {
    symbol: "HYPE",
    coinwPair: "HYPE_USDT",
    coingeckoId: "hyperliquid",
    chain: null,
    execution: { executable: true, coinwPair: "HYPE_USDT" },
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  BILL: {
    symbol: "BILL",
    coinwPair: "BILL_USDT",
    coingeckoId: "bill",
    chain: null,
    execution: { executable: true, coinwPair: "BILL_USDT" },
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  IRYS: {
    symbol: "IRYS",
    coinwPair: "IRYS_USDT",
    coingeckoId: "irys",
    chain: null,
    execution: {
      executable: false,
      coinwPair: null,
      watchOnlyReason: "not_listed_on_coinw",
    },
    fallback: { onchainMissing: true, fundamentalMissing: true },
  },
  USDT: {
    symbol: "USDT",
    coinwPair: "USDT_USDT",
    coingeckoId: "tether",
    chain: "ethereum",
    contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    execution: {
      executable: false,
      coinwPair: null,
      watchOnlyReason: "not_listed_on_coinw",
    },
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
      execution: {
        executable: false,
        coinwPair: null,
        watchOnlyReason: "mapping_unknown",
      },
      fallback: { onchainMissing: true, fundamentalMissing: true },
    }
  );
}

export function knownSymbolMappings() {
  return { ...KNOWN_SYMBOL_MAPPINGS };
}
