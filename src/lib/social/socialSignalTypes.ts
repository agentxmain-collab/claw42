export type SocialSignalProviderId = "cryptopanic" | "x_v2" | "lunarcrush" | "santiment";

export type SocialSignalStatus = "ok" | "missing" | "stale" | "error";

export interface SocialSignalObservation {
  provider: SocialSignalProviderId;
  candidateKey: string;
  symbol?: string;
  observedAt: string;
  windowMs: number;
  status: SocialSignalStatus;
  mentionCount: number;
  sentimentScore: number;
  engagementScore: number;
  sourceCount: number;
  reliability: number;
}

export interface SocialSignalSnapshot {
  provider: SocialSignalProviderId;
  cacheVersion: string;
  observedAt: string;
  observations: SocialSignalObservation[];
}

export const SOCIAL_PROVIDER_IDS = ["cryptopanic", "x_v2", "lunarcrush", "santiment"] as const;

export const SOCIAL_SCORE_CAP = 0.15;
export const SOCIAL_SIGNAL_WINDOW_MS = 24 * 60 * 60_000;
export const SOCIAL_SIGNAL_CACHE_TTL_MS = 5 * 60_000;
export const SOCIAL_SIGNAL_CACHE_VERSION_PREFIX = "social:v1";
export const SOCIAL_PROVIDER_TIMEOUT_MS = 5000;

export const SOCIAL_NEUTRAL_FALLBACK: SocialSignalObservation = {
  provider: "cryptopanic",
  candidateKey: "missing",
  observedAt: new Date(0).toISOString(),
  windowMs: SOCIAL_SIGNAL_WINDOW_MS,
  status: "missing",
  mentionCount: 0,
  sentimentScore: 0,
  engagementScore: 0,
  sourceCount: 0,
  reliability: 0,
};
