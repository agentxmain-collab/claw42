import { describe, expect, test } from "vitest";
import type { NewsDebate } from "@/lib/types";
import type { StreamEntry } from "../types";
import { filterStreamEntries, isCriticalEntry } from "./streamFilter";

const agentMessage = {
  kind: "agent_message",
  id: "agent-1",
  ts: 1,
  agentId: "alpha",
  content: "ambient",
  triggerSignalId: "signal-1",
} satisfies StreamEntry;

const watchUpdate = {
  kind: "watch_update",
  id: "watch-1",
  ts: 2,
  updateType: "quiet_observation",
  title: "巡检",
  content: "still watching",
  dedupeKey: "watch-1",
  severity: "neutral",
} satisfies StreamEntry;

const newsDebate = {
  kind: "news_debate",
  id: "debate-1",
  ts: 3,
  debate: {} as NewsDebate,
} satisfies StreamEntry;

describe("streamFilter", () => {
  test("hides ambient agent messages and watch updates in critical mode", () => {
    expect(filterStreamEntries([agentMessage, watchUpdate, newsDebate])).toEqual([newsDebate]);
  });

  test("keeps all entries in all mode", () => {
    expect(filterStreamEntries([agentMessage, watchUpdate, newsDebate], "all")).toEqual([
      agentMessage,
      watchUpdate,
      newsDebate,
    ]);
  });

  test("marks news debates as critical", () => {
    expect(isCriticalEntry(newsDebate)).toBe(true);
    expect(isCriticalEntry(agentMessage)).toBe(false);
  });
});
