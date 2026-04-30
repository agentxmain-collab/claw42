import type {
  AgentDiscussionEntry,
  AgentId,
  StreamEntry,
  WatchUpdateEntry,
} from "../types";

const PRIORITY_THINK_MS = { min: 900, max: 1400 };
const DISCUSSION_THINK_MS = { min: 1400, max: 2200 };
const DEFAULT_THINK_MS = { min: 1800, max: 3000 };
const PRIORITY_GAP_MS = 1100;
const DISCUSSION_GAP_MS = 1300;
const DEFAULT_GAP_MS = 900;

function isWatchUpdate(entry: StreamEntry): entry is WatchUpdateEntry {
  return entry.kind === "watch_update";
}

function isAgentDiscussion(entry: StreamEntry): entry is AgentDiscussionEntry {
  return entry.kind === "agent_discussion";
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function boundedJitter(key: string, min: number, max: number): number {
  const span = Math.max(0, max - min);
  if (span === 0) return min;
  return min + (hashString(key) % (span + 1));
}

export function displayScheduleStartDelay(
  now: number,
  scheduledUntil: number,
  clearPending = false,
): number {
  if (clearPending) return 0;
  return Math.max(0, scheduledUntil - now);
}

export function splitStreamEntryForDisplay(entry: StreamEntry): StreamEntry[] {
  if (entry.kind === "collective_event") {
    const responses = [entry.primaryResponse, ...entry.echoResponses]
      .filter((response) => response.content.trim().length > 0);
    if (responses.length <= 1) return [entry];

    return responses.map((response) => ({
      ...entry,
      id: `${entry.id}-${response.agentId}`,
      primaryResponse: response,
      echoResponses: [],
    }));
  }

  if (entry.kind === "conflict_event" && entry.responses.length > 1) {
    return entry.responses.map((response) => ({
      ...entry,
      id: `${entry.id}-${response.agentId}`,
      responses: [response],
    }));
  }

  if (!isAgentDiscussion(entry) || entry.responses.length <= 1) return [entry];

  return entry.responses.map((response) => ({
    ...entry,
    id: `${entry.id}-${response.agentId}`,
    responses: [response],
  }));
}

export function speakerForStreamEntry(entry: StreamEntry): AgentId | null {
  if (entry.kind === "agent_message") return entry.agentId;
  if (isWatchUpdate(entry)) return entry.agentId ?? "beta";
  if (isAgentDiscussion(entry)) return entry.responses[0]?.agentId ?? null;
  if (entry.kind === "focus_event") return entry.primaryResponse.agentId;
  if (entry.kind === "collective_event") return entry.primaryResponse.agentId;
  if (entry.kind === "conflict_event") return entry.responses[0]?.agentId ?? null;
  return null;
}

export function thinkDurationForStreamEntry(
  entry: StreamEntry,
  index = 0,
  reduceMotion = false,
): number {
  if (reduceMotion) return 0;

  const key = `${entry.id}:${index}`;
  if (entry.kind === "focus_event" || entry.kind === "collective_event" || entry.kind === "conflict_event") {
    return boundedJitter(key, PRIORITY_THINK_MS.min, PRIORITY_THINK_MS.max);
  }

  if (isAgentDiscussion(entry)) {
    return boundedJitter(key, DISCUSSION_THINK_MS.min, DISCUSSION_THINK_MS.max);
  }

  return boundedJitter(key, DEFAULT_THINK_MS.min, DEFAULT_THINK_MS.max);
}

export function gapDurationAfterStreamEntry(
  entry: StreamEntry,
  reduceMotion = false,
): number {
  if (reduceMotion) return 120;
  if (entry.kind === "focus_event" || entry.kind === "collective_event" || entry.kind === "conflict_event") {
    return PRIORITY_GAP_MS;
  }
  if (isAgentDiscussion(entry)) return DISCUSSION_GAP_MS;
  return DEFAULT_GAP_MS;
}
