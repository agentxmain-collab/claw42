import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { projectStreamEntryToPublic } from "@/lib/watch/publicTimelineProjection";
import type { StreamEntry } from "@/modules/agent-watch/types";

const getWatchHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => true,
}));

vi.mock("@/lib/watchHistoryStore", () => ({
  getWatchHistory: getWatchHistoryMock,
}));

import { GET as getWatchTimeline } from "@/app/api/watch/timeline/route";

const ROOT = process.cwd();
const requireMadge = createRequire(__filename);

type MadgeResult = {
  obj(): Record<string, string[]>;
};

type Madge = (
  entryPoint: string,
  options: { tsConfig: string; fileExtensions: string[] },
) => Promise<MadgeResult>;

const madge = requireMadge("madge") as Madge;

const PUBLIC_WATCH_ENTRY_POINTS = [
  "src/modules/agent-watch/AgentWatchBoard.tsx",
  "src/app/[locale]/agent/page.tsx",
  "src/app/api/watch/timeline/route.ts",
  "src/app/api/watch/history/route.ts",
] as const;

const BLOCKED_CHAT_MODULES = [
  "src/lib/dev/streamChatThreads.ts",
  "src/modules/agent-watch/components/AgentMessageBubble.tsx",
  "src/modules/agent-watch/components/ChatMessageBubble.tsx",
] as const;

type DependencyGraph = Map<string, string[]>;

function toProjectPath(absolutePath: string) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function resolveGraphPath(entryPoint: string, graphPath: string) {
  if (path.isAbsolute(graphPath)) return path.normalize(graphPath);

  const fromEntryDirectory = path.resolve(ROOT, path.dirname(entryPoint), graphPath);
  if (fs.existsSync(fromEntryDirectory)) return fromEntryDirectory;

  return path.resolve(ROOT, graphPath);
}

async function readMadgeGraph(entryPoint: string): Promise<DependencyGraph> {
  const result = await madge(entryPoint, {
    tsConfig: "tsconfig.json",
    fileExtensions: ["ts", "tsx"],
  });
  const parsed = result.obj();
  const graph: DependencyGraph = new Map();

  for (const [node, dependencies] of Object.entries(parsed)) {
    const absoluteNode = resolveGraphPath(entryPoint, node);
    graph.set(
      absoluteNode,
      dependencies.map((dependency) => resolveGraphPath(entryPoint, dependency)),
    );
  }

  return graph;
}

async function findImportPath(entryPoint: string, blockedModule: string): Promise<string[] | null> {
  const graph = await readMadgeGraph(entryPoint);
  const start = path.resolve(ROOT, entryPoint);
  const target = path.resolve(ROOT, blockedModule);
  const queue: string[][] = [[start]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const current = currentPath[currentPath.length - 1]!;
    if (current === target) return currentPath.map(toProjectPath);
    if (visited.has(current)) continue;
    visited.add(current);

    for (const dependency of graph.get(current) ?? []) {
      if (!visited.has(dependency)) queue.push([...currentPath, dependency]);
    }
  }

  return null;
}

const rawDebugEntry: StreamEntry = {
  kind: "focus_event",
  id: "debug-focus",
  ts: Date.now(),
  symbol: "BTC",
  signalType: "breakout",
  severity: "alert",
  description: "debug signal",
  primaryResponse: { agentId: "alpha", content: "debug", symbol: "BTC" },
  meta: {
    visibility: "debug",
    importance: "critical",
    sourceTrigger: "market_signal",
    evidenceIds: [],
  },
};

describe("chat authenticity public import boundary", () => {
  test("public Watch entry dependency closures do not reach legacy chat rendering modules", async () => {
    const violations: string[] = [];

    for (const entryPoint of PUBLIC_WATCH_ENTRY_POINTS) {
      for (const blockedModule of BLOCKED_CHAT_MODULES) {
        const importPath = await findImportPath(entryPoint, blockedModule);
        if (importPath) {
          violations.push(`${entryPoint} -> ${blockedModule}\n${importPath.join(" -> ")}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("dev-only stream chat module remains available outside the public closure", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/dev/streamChatThreads.ts"), "utf8");

    expect(source).toContain("export function buildStreamChatThread");
    expect(source).toContain("function withConversationFollowUps");
  });
});

describe("public timeline projection chat filtering", () => {
  test("does not project agent_message entries", () => {
    const entry: StreamEntry = {
      kind: "agent_message",
      id: "agent-message-1",
      ts: Date.now(),
      agentId: "alpha",
      content: "ambient chatter",
      triggerSignalId: "signal-1",
      meta: {
        visibility: "public",
        importance: "critical",
        sourceTrigger: "fallback",
        evidenceIds: [],
      },
    };

    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });

  test("does not project agent_discussion entries", () => {
    const entry: StreamEntry = {
      kind: "agent_discussion",
      id: "agent-discussion-1",
      ts: Date.now(),
      topic: "ambient discussion",
      summary: "discussion summary",
      dedupeKey: "discussion-1",
      symbols: ["BTC"],
      responses: [{ agentId: "beta", content: "ambient discussion", symbol: "BTC" }],
      severity: "watch",
      meta: {
        visibility: "public",
        importance: "critical",
        sourceTrigger: "fallback",
        evidenceIds: [],
      },
    };

    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });
});

describe("watch timeline debug guard", () => {
  beforeEach(() => {
    getWatchHistoryMock.mockReset();
    getWatchHistoryMock.mockResolvedValue({
      entries: [rawDebugEntry],
      oldestTs: rawDebugEntry.ts,
      hasMore: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("rejects debug mode in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await getWatchTimeline(
      new NextRequest("https://claw42.ai/api/watch/timeline?mode=debug", {
        headers: { "x-claw42-debug": "1" },
      }),
    );

    expect(response.status).toBe(403);
  });

  test("rejects debug mode without the debug header outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const response = await getWatchTimeline(
      new NextRequest("https://claw42.ai/api/watch/timeline?mode=debug"),
    );

    expect(response.status).toBe(403);
  });

  test("returns raw entries only outside production with the debug header", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const response = await getWatchTimeline(
      new NextRequest("https://claw42.ai/api/watch/timeline?mode=debug", {
        headers: { "x-claw42-debug": "1" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0].id).toBe("debug-focus");
    expect(json.events).toBeUndefined();
  });
});
