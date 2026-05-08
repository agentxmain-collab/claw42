export interface HeroTrendingCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  priceUsd: number;
  changePercent24h: number;
  totalVolumeUsd24h: number;
  marketCapUsd: number;
  score: number;
}

export interface HeroTrendingCoinsResponse {
  coins: HeroTrendingCoin[];
  generatedAt: string;
  source: "coingecko" | "last-cache" | "fallback" | "session";
}
