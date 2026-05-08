import type { ApiGuardResult, AuthContext, AuthLevel } from "./types";

export async function guardApiRequest(
  request: Request,
  requiredLevel: AuthLevel,
): Promise<ApiGuardResult> {
  void request;

  const context: AuthContext = {
    level: requiredLevel,
  };

  return {
    ok: true,
    context,
  };
}
