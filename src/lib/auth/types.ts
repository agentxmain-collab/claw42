export type AuthLevel = "public" | "internal" | "api_key";

export type AuthContext = {
  level: AuthLevel;
  subject?: string;
  apiKeyId?: string;
};

export type ApiGuardResult = {
  ok: boolean;
  reason?: string;
  context?: AuthContext;
};

export type QuotaCheckResult = {
  ok: boolean;
  reason?: string;
  limit?: number;
  remaining?: number;
  resetAt?: number;
};

export type RateLimitCheckResult = {
  ok: boolean;
  reason?: string;
  limit?: number;
  remaining?: number;
  resetAt?: number;
};
