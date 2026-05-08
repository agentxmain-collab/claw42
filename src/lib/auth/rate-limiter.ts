import type { AuthContext, RateLimitCheckResult } from "./types";

export async function checkRateLimit(
  context: AuthContext,
  rateLimitKey = "default",
): Promise<RateLimitCheckResult> {
  void context;
  void rateLimitKey;

  return {
    ok: true,
  };
}
