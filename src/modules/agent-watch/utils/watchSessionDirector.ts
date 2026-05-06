import type {
  AgentDiscussionEntry,
  AgentFocus,
  AgentId,
  CoinPoolPayload,
  SignalRecord,
  StreamEntry,
  WatchUpdateEntry,
} from "../types";
import type { AgentWatchLocale } from "../locale";
import { buildWatchSupplementalEntry } from "./watchSupplementalUpdates";

export const WATCH_DIRECTOR_MEMORY_KEY = "claw42.watch.director.v1";

const RESUME_WINDOW_MS = 5 * 60_000;
const RECHECK_WINDOW_MS = 30 * 60_000;
const MAX_SEEN_KEYS = 36;

type SupplementalKind =
  | "market_digest"
  | "focus_update"
  | "condition_update"
  | "agent_heartbeat"
  | "quiet_observation"
  | "agent_discussion";

export type WatchDirectorMode = "fresh" | "resume" | "recheck";

export interface WatchDirectorMemory {
  lastVisitAt: number | null;
  seenKeys: string[];
  lastSpeaker?: AgentId | null;
  lastSymbols?: string[];
}

export interface WatchDirectorOpeningInput {
  now: number;
  mode: WatchDirectorMode;
  pool?: CoinPoolPayload;
  focus?: AgentFocus[];
  signals: SignalRecord[];
  analysisEntries: StreamEntry[];
  memory: WatchDirectorMemory;
  locale?: AgentWatchLocale;
}

export interface WatchDirectorOpening {
  entries: StreamEntry[];
  mode: WatchDirectorMode;
}

function isWatchUpdate(entry: StreamEntry): entry is WatchUpdateEntry {
  return entry.kind === "watch_update";
}

function isAgentDiscussion(entry: StreamEntry): entry is AgentDiscussionEntry {
  return entry.kind === "agent_discussion";
}

function entrySpeakers(entry: StreamEntry): AgentId[] {
  if (entry.kind === "agent_message") return [entry.agentId];
  if (isWatchUpdate(entry)) return entry.agentId ? [entry.agentId] : [];
  if (isAgentDiscussion(entry)) return entry.responses.map((response) => response.agentId);
  if (entry.kind === "focus_event") return [entry.primaryResponse.agentId];
  if (entry.kind === "collective_event") {
    return [entry.primaryResponse, ...entry.echoResponses].map((response) => response.agentId);
  }
  if (entry.kind === "conflict_event") return entry.responses.map((response) => response.agentId);
  return [];
}

function entrySymbols(entry: StreamEntry): string[] {
  if ("symbols" in entry && Array.isArray(entry.symbols)) return entry.symbols;
  if ("symbol" in entry && typeof entry.symbol === "string") return [entry.symbol];
  return [];
}

export function directorModeForVisit(now: number, lastVisitAt: number | null | undefined): WatchDirectorMode {
  if (!lastVisitAt || now <= lastVisitAt) return "fresh";
  const age = now - lastVisitAt;
  if (age <= RESUME_WINDOW_MS) return "resume";
  if (age <= RECHECK_WINDOW_MS) return "recheck";
  return "fresh";
}

export function directorKeyForEntry(entry: StreamEntry): string {
  if (isWatchUpdate(entry) || isAgentDiscussion(entry)) return entry.dedupeKey;
  if (entry.kind === "agent_message") {
    return `agent:${entry.agentId}:${entry.triggerSignalId}:${entry.content.trim()}`;
  }
  if (entry.kind === "focus_event") return `focus:${entry.symbol}:${entry.signalType}:${entry.description}`;
  if (entry.kind === "collective_event") {
    return `collective:${entry.signalType}:${entry.direction}:${entry.symbols.join(":")}:${entry.description}`;
  }
  return `conflict:${entry.symbol}:${entry.conflictingAgents.join(":")}:${entry.description}`;
}

function hasSeen(memory: WatchDirectorMemory, entry: StreamEntry): boolean {
  return memory.seenKeys.includes(directorKeyForEntry(entry));
}

function isPriority(entry: StreamEntry): boolean {
  return entry.kind === "collective_event" || entry.kind === "focus_event" || entry.kind === "conflict_event";
}

function entryRank(entry: StreamEntry): number {
  if (isPriority(entry)) return 0;
  if (entry.kind === "agent_message") return 1;
  if (isAgentDiscussion(entry)) return 2;
  return 3;
}

function pickAnalysisEntry(entries: StreamEntry[], memory: WatchDirectorMemory): StreamEntry | null {
  return [...entries]
    .filter((entry) => !hasSeen(memory, entry))
    .sort((a, b) => entryRank(a) - entryRank(b) || b.ts - a.ts)[0] ?? null;
}

function preferredKindsForMode(mode: WatchDirectorMode, hasAnalysisEntry: boolean): SupplementalKind[] {
  if (mode === "resume") {
    return hasAnalysisEntry
      ? ["condition_update", "agent_discussion", "agent_heartbeat", "quiet_observation"]
      : ["focus_update", "condition_update", "agent_discussion", "agent_heartbeat"];
  }

  if (mode === "recheck") {
    return hasAnalysisEntry
      ? ["agent_discussion", "condition_update", "quiet_observation", "agent_heartbeat"]
      : ["market_digest", "agent_discussion", "focus_update", "quiet_observation"];
  }

  return hasAnalysisEntry
    ? ["agent_discussion", "condition_update", "agent_heartbeat", "quiet_observation"]
    : ["agent_discussion", "agent_heartbeat", "condition_update", "market_digest"];
}

function pushEntry(
  target: StreamEntry[],
  entry: StreamEntry | null,
  memory: WatchDirectorMemory,
  allowSeenFallback = false,
): boolean {
  if (!entry) return false;
  const key = directorKeyForEntry(entry);
  const alreadyQueued = target.some((item) => directorKeyForEntry(item) === key);
  if (alreadyQueued) return false;
  if (!allowSeenFallback && hasSeen(memory, entry)) return false;
  target.push(entry);
  return true;
}

function buildSupplemental(
  kind: SupplementalKind,
  input: WatchDirectorOpeningInput,
  existingEntries: StreamEntry[],
): StreamEntry | null {
  return buildWatchSupplementalEntry({
    now: input.now,
    pool: input.pool,
    focus: input.focus,
    signals: input.signals,
    existingEntries,
    preferredKind: kind as never,
    locale: input.locale,
  });
}

export function buildWatchDirectorOpening(input: WatchDirectorOpeningInput): WatchDirectorOpening {
  const entries: StreamEntry[] = [];
  const analysisEntry = pickAnalysisEntry(input.analysisEntries, input.memory);
  pushEntry(entries, analysisEntry, input.memory);

  const kinds = preferredKindsForMode(input.mode, Boolean(analysisEntry));
  for (const kind of kinds) {
    if (entries.length >= 3) break;
    const candidate = buildSupplemental(kind, input, [...input.analysisEntries, ...entries]);
    pushEntry(entries, candidate, input.memory);
  }

  if (entries.length === 0) {
    for (const kind of kinds) {
      const fallback = buildSupplemental(kind, input, input.analysisEntries);
      if (pushEntry(entries, fallback, input.memory, true)) break;
    }
  }

  return { entries, mode: input.mode };
}

export function rememberDirectorEntries(
  memory: WatchDirectorMemory,
  entries: StreamEntry[],
  now: number,
): WatchDirectorMemory {
  const seenKeys = [
    ...memory.seenKeys,
    ...entries.map(directorKeyForEntry),
  ].filter((key, index, source) => source.indexOf(key) === index).slice(-MAX_SEEN_KEYS);
  const speakers = entries.flatMap(entrySpeakers);
  const symbols = entries.flatMap(entrySymbols);

  return {
    lastVisitAt: now,
    seenKeys,
    lastSpeaker: speakers[speakers.length - 1] ?? memory.lastSpeaker ?? null,
    lastSymbols: symbols.length > 0 ? Array.from(new Set(symbols)).slice(0, 4) : memory.lastSymbols,
  };
}

export function emptyDirectorMemory(): WatchDirectorMemory {
  return { lastVisitAt: null, seenKeys: [], lastSpeaker: null, lastSymbols: [] };
}

export function readWatchDirectorMemory(storage: Storage | undefined): WatchDirectorMemory {
  if (!storage) return emptyDirectorMemory();

  try {
    const raw = storage.getItem(WATCH_DIRECTOR_MEMORY_KEY);
    if (!raw) return emptyDirectorMemory();
    const parsed = JSON.parse(raw) as Partial<WatchDirectorMemory>;
    return {
      lastVisitAt: typeof parsed.lastVisitAt === "number" ? parsed.lastVisitAt : null,
      seenKeys: Array.isArray(parsed.seenKeys)
        ? parsed.seenKeys.filter((key): key is string => typeof key === "string").slice(-MAX_SEEN_KEYS)
        : [],
      lastSpeaker:
        parsed.lastSpeaker === "alpha" || parsed.lastSpeaker === "beta" || parsed.lastSpeaker === "gamma"
          ? parsed.lastSpeaker
          : null,
      lastSymbols: Array.isArray(parsed.lastSymbols)
        ? parsed.lastSymbols.filter((symbol): symbol is string => typeof symbol === "string").slice(0, 4)
        : [],
    };
  } catch {
    return emptyDirectorMemory();
  }
}

export function writeWatchDirectorMemory(storage: Storage | undefined, memory: WatchDirectorMemory) {
  if (!storage) return;
  try {
    storage.setItem(WATCH_DIRECTOR_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Browsers may reject storage in private or restricted contexts; the director can still run statelessly.
  }
}
