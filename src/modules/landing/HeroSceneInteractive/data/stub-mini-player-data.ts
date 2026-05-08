import type { HeroMiniPlayerData, HeroStrategyDirection } from "../types/mini-player";

const supportedSymbols = [
  "BTC",
  "ETH",
  "SOL",
  "NIL",
  "BNB",
  "XRP",
  "DOGE",
  "ADA",
  "AVAX",
  "LINK",
  "TON",
  "TRX",
  "DOT",
  "SUI",
] as const;

type SupportedSymbol = (typeof supportedSymbols)[number];

const names: Record<SupportedSymbol, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  NIL: "Nillion",
  BNB: "BNB",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  TON: "Toncoin",
  TRX: "TRON",
  DOT: "Polkadot",
  SUI: "Sui",
};

const directionBySymbol: Record<SupportedSymbol, HeroStrategyDirection> = {
  BTC: "watch",
  ETH: "long",
  SOL: "long",
  NIL: "watch",
  BNB: "watch",
  XRP: "short",
  DOGE: "watch",
  ADA: "watch",
  AVAX: "long",
  LINK: "long",
  TON: "watch",
  TRX: "short",
  DOT: "watch",
  SUI: "long",
};

function buildStub(symbol: string, displayName: string, direction: HeroStrategyDirection) {
  return {
    symbol,
    displayName,
    priceLine: `${symbol}/USDT · 24h signal preview`,
    agentMessages: [
      {
        agentName: "Momentum Agent",
        role: "Trend",
        message: `${symbol} momentum is elevated; wait for confirmation near the current range high.`,
      },
      {
        agentName: "Risk Agent",
        role: "Risk",
        message:
          "Position size should stay light until volatility compresses below the session average.",
      },
      {
        agentName: "Flow Agent",
        role: "Flow",
        message:
          "Spot flow is active, but derivative leverage has not yet confirmed a clean follow-through.",
      },
    ],
    strategyCard: {
      direction,
      confidence: direction === "watch" ? 62 : 68,
      entry: "Break and retest of the nearest 15m range",
      stopLoss: "Invalidation below the previous impulse low",
      target: "First liquidity pocket, then trail with volume",
      note: "Stage 1 preview uses stubbed Agent commentary. Live orchestration lands in Stage 2.",
    },
  } satisfies HeroMiniPlayerData;
}

const data = Object.fromEntries(
  supportedSymbols.map((symbol) => [
    symbol,
    buildStub(symbol, names[symbol], directionBySymbol[symbol]),
  ]),
) as Record<SupportedSymbol, HeroMiniPlayerData>;

export async function fetchHeroMiniPlayerData(symbol: string): Promise<HeroMiniPlayerData> {
  await new Promise((resolve) => window.setTimeout(resolve, 160));
  const normalized = symbol.toUpperCase();

  if (normalized in data) {
    return data[normalized as SupportedSymbol];
  }

  return buildStub(normalized, normalized, "watch");
}
