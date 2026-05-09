import type { StreamEntry } from "../types";

export type StreamFilterMode = "critical" | "all";

const HIDDEN_KINDS_IN_CRITICAL: Array<StreamEntry["kind"]> = ["agent_message", "watch_update"];

export function getStreamFilterMode(): StreamFilterMode {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SHOW_AMBIENT_CHATTER === "true") {
    return "all";
  }
  return "critical";
}

export function isCriticalEntry(entry: StreamEntry): boolean {
  return !HIDDEN_KINDS_IN_CRITICAL.includes(entry.kind);
}

export function filterStreamEntries(
  entries: StreamEntry[],
  mode: StreamFilterMode = getStreamFilterMode(),
): StreamEntry[] {
  if (mode === "all") return entries;
  return entries.filter(isCriticalEntry);
}
