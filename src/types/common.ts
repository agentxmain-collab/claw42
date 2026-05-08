export type Locale = "zh" | "en";

export type Severity = "high" | "medium" | "low";

export type Tone = "risk_on" | "neutral" | "risk_off";

export type MarketDirection = "bullish" | "bearish" | "neutral";

export type LocalizedText = Record<Locale, string>;

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
  meta: Record<string, unknown>;
};
