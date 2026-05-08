import type { AuthContext, QuotaCheckResult } from "./types";

export async function checkQuota(
  context: AuthContext,
  quotaKey = "default",
): Promise<QuotaCheckResult> {
  void context;
  void quotaKey;

  return {
    ok: true,
  };
}

export async function consumeQuota(
  context: AuthContext,
  quotaKey = "default",
  amount = 1,
): Promise<QuotaCheckResult> {
  void context;
  void quotaKey;
  void amount;

  return {
    ok: true,
  };
}
