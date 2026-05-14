import type { DispatchView } from "./types";

export function resolveDispatchInitialView(value?: string | string[] | null): DispatchView {
  const requested = Array.isArray(value) ? value[0] : value;
  return requested === "flow" ? "flow" : "mkt";
}
