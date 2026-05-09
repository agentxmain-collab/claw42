import type { CoinPoolPayload, SignalRecord, StreamEntry } from "@/modules/agent-watch/types";
import { isAmbientChatterEnabled } from "@/lib/ambientChatter";

export type ChatterPreferredKind =
  | "agent_discussion"
  | "agent_heartbeat"
  | "market_digest"
  | "focus_update"
  | "condition_update"
  | "quiet_observation";

export interface ChatterPlan {
  shouldSpeak: boolean;
  intervalMs: number;
  preferredKinds: Array<ChatterPreferredKind | undefined>;
  activity: "hot" | "active" | "quiet";
}

const HOT_INTERVAL_MS = 8 * 60_000;
const ACTIVE_INTERVAL_MS = 4 * 60_000;
const QUIET_INTERVAL_MS = 2.4 * 60_000;
const HOT_SIGNAL_WINDOW_MS = 90_000;
const ACTIVE_SIGNAL_WINDOW_MS = 5 * 60_000;

function allChanges(pool?: CoinPoolPayload): number[] {
  if (!pool) return [];
  return [...pool.majors, ...pool.trending, ...pool.opportunity]
    .map((ticker) => Math.abs(ticker.change24h))
    .filter(Number.isFinite);
}

function recentSignalSeverity(signals: SignalRecord[], now: number): "hot" | "active" | "quiet" {
  const latestHot = signals.some(
    (signal) => signal.severity === "alert" && Math.abs(now - signal.ts) <= HOT_SIGNAL_WINDOW_MS,
  );
  if (latestHot) return "hot";

  const latestActive = signals.some(
    (signal) =>
      (signal.severity === "alert" || signal.severity === "watch") &&
      Math.abs(now - signal.ts) <= ACTIVE_SIGNAL_WINDOW_MS,
  );
  return latestActive ? "active" : "quiet";
}

function marketActivity(pool: CoinPoolPayload | undefined, signals: SignalRecord[], now: number) {
  const signalActivity = recentSignalSeverity(signals, now);
  if (signalActivity !== "quiet") return signalActivity;

  const maxChange = Math.max(0, ...allChanges(pool));
  if (maxChange >= 15) return "hot";
  if (maxChange >= 7) return "active";
  return "quiet";
}

function hasFreshPriority(entries: StreamEntry[], now: number) {
  return entries.some(
    (entry) =>
      (entry.kind === "collective_event" ||
        entry.kind === "focus_event" ||
        entry.kind === "conflict_event" ||
        entry.kind === "news_debate") &&
      Math.abs(now - entry.ts) <= ACTIVE_SIGNAL_WINDOW_MS,
  );
}

export function buildChatterPlan({
  now,
  lastSpokeAt,
  pool,
  signals,
  visibleEntries,
}: {
  now: number;
  lastSpokeAt: number;
  pool?: CoinPoolPayload;
  signals: SignalRecord[];
  visibleEntries: StreamEntry[];
}): ChatterPlan {
  const activity = marketActivity(pool, signals, now);
  const intervalMs =
    activity === "hot"
      ? HOT_INTERVAL_MS
      : activity === "active"
        ? ACTIVE_INTERVAL_MS
        : QUIET_INTERVAL_MS;
  if (!isAmbientChatterEnabled()) {
    return { shouldSpeak: false, intervalMs, activity, preferredKinds: [] };
  }

  const shouldSpeak = now - lastSpokeAt >= intervalMs;

  if (hasFreshPriority(visibleEntries, now)) {
    return {
      shouldSpeak,
      intervalMs,
      activity,
      preferredKinds: ["agent_discussion", "agent_heartbeat"],
    };
  }

  if (activity === "hot") {
    return {
      shouldSpeak,
      intervalMs,
      activity,
      preferredKinds: ["agent_discussion", "condition_update", "agent_heartbeat"],
    };
  }

  if (activity === "active") {
    return {
      shouldSpeak,
      intervalMs,
      activity,
      preferredKinds: ["agent_discussion", "focus_update", "market_digest"],
    };
  }

  return {
    shouldSpeak,
    intervalMs,
    activity,
    preferredKinds: ["agent_heartbeat", "quiet_observation", "agent_discussion"],
  };
}
