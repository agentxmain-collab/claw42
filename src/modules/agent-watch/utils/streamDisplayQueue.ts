import type { AgentId, StreamEntry } from "../types";

const MESSAGE_REVEAL_BUDGET_MS = 2800;
const THREAD_GAP_MS = 900;
const MAX_THREAD_GAP_MS = 14_000;

export function displayScheduleStartDelay(
  now: number,
  scheduledUntil: number,
  clearPending = false,
): number {
  if (clearPending) return 0;
  return Math.max(0, scheduledUntil - now);
}

export function splitStreamEntryForDisplay(entry: StreamEntry): StreamEntry[] {
  return [entry];
}

export function speakerForStreamEntry(entry: StreamEntry): AgentId | null {
  void entry;
  return null;
}

function messageCountForStreamEntry(entry: StreamEntry): number {
  if (entry.kind === "news_debate") return Math.max(1, entry.debate.chatThread.messages.length);
  if (entry.kind === "chat_thread") return Math.max(1, entry.thread.messages.length);
  if (entry.kind === "agent_discussion") return Math.max(1, entry.responses.length);
  if (entry.kind === "collective_event") {
    return Math.max(
      1,
      [entry.primaryResponse, ...entry.echoResponses].filter(
        (response) => response.content.trim().length > 0,
      ).length,
    );
  }
  if (entry.kind === "conflict_event") {
    return Math.max(
      1,
      entry.responses.filter((response) => response.content.trim().length > 0).length,
    );
  }
  return 1;
}

export function thinkDurationForStreamEntry(
  entry: StreamEntry,
  index = 0,
  reduceMotion = false,
): number {
  void entry;
  void index;
  if (reduceMotion) return 0;
  return 0;
}

export function gapDurationAfterStreamEntry(entry: StreamEntry, reduceMotion = false): number {
  if (reduceMotion) return 120;
  return Math.min(
    MAX_THREAD_GAP_MS,
    messageCountForStreamEntry(entry) * MESSAGE_REVEAL_BUDGET_MS + THREAD_GAP_MS,
  );
}
