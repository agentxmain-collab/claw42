import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { projectStreamEntryToPublic } from "@/lib/watch/publicTimelineProjection";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { StreamEntry } from "@/modules/agent-watch/types";

const getWatchHistoryMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const readDecisionRecordsMock = vi.hoisted(() => vi.fn());
const getNewsEvidenceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => true,
}));

vi.mock("@/lib/watchHistoryStore", () => ({
  getWatchHistory: getWatchHistoryMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
  readDecisionRecords: readDecisionRecordsMock,
}));

vi.mock("@/lib/news/newsEvidenceStore", () => ({
  getNewsEvidence: getNewsEvidenceMock,
}));

import { GET as getWatchHistoryRoute } from "@/app/api/watch/history/route";
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

const BLOCKED_PUBLIC_TRIGGER_MODULES = [
  "src/modules/agent-watch/api/llmClient.ts",
  "src/modules/agent-watch/hooks/useAgentAnalysis.ts",
] as const;

type DependencyGraph = Map<string, string[]>;

const madgeGraphCache = new Map<string, Promise<DependencyGraph>>();

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
  const cached = madgeGraphCache.get(entryPoint);
  if (cached) return cached;

  const graphPromise = readMadgeGraphUncached(entryPoint);
  madgeGraphCache.set(entryPoint, graphPromise);
  return graphPromise;
}

async function readMadgeGraphUncached(entryPoint: string): Promise<DependencyGraph> {
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
    locale: "zh_CN",
  },
};

const rawPublicEntry: StreamEntry = {
  kind: "focus_event",
  id: "public-focus",
  ts: Date.now(),
  symbol: "BTC",
  signalType: "breakout",
  severity: "alert",
  description: "public signal",
  primaryResponse: { agentId: "alpha", content: "public", symbol: "BTC" },
  meta: {
    visibility: "public",
    importance: "high",
    sourceTrigger: "market_signal",
    evidenceIds: [],
    locale: "zh_CN",
  },
};

const historyFreshTradeDecision: TradeDecision = {
  id: "fresh-trade",
  schemaVersion: 1,
  symbol: "BTC",
  generatedBy: "pm",
  generatedAt: new Date(rawPublicEntry.ts).toISOString(),
  direction: "long",
  entryType: "market",
  entryPrice: 76000,
  entryRange: { low: 75500, high: 76500 },
  stopLoss: 74800,
  takeProfit: [78000],
  positionSizing: 0.1,
  timeHorizon: "intraday",
  rating: 4,
  confidence: 0.72,
  evidenceIds: ["ev_1"],
  riskNote: "Risk can fade",
  invalidatesIf: "BTC loses 74800",
  promptVersion: "test",
  modelProvider: "stub",
  severity: "high",
};

const historyDecisionRecord: StrategyDecisionRecord = {
  id: "record-history",
  schemaVersion: 1,
  recordSource: "live",
  symbol: "BTC",
  locale: "zh_CN",
  decisionOwnerId: "pm",
  contributorIds: ["fundamental_analyst"],
  analystInputs: [
    {
      memberId: "fundamental_analyst",
      direction: "long",
      confidence: 0.7,
      rationale: "BTC spot demand is improving near 76000.",
      evidenceIds: ["ev_1"],
    },
  ],
  sourceThreadId: "history-thread",
  tradeDecision: historyFreshTradeDecision,
  createdAt: new Date(rawPublicEntry.ts).toISOString(),
  evaluationWindowEndsAt: null,
  resolvedAt: null,
  resolvedOutcome: null,
  promptVersion: "test",
  modelProvider: "stub",
  legacyFactionId: null,
  stageTrace: [
    {
      stageId: "analyst_inputs",
      label: "Analyst input generation",
      status: "done",
      observedAt: new Date(rawPublicEntry.ts).toISOString(),
    },
  ],
};

function pmHistoryEntry(tradeDecision: TradeDecision): StreamEntry {
  return {
    kind: "chat_thread",
    id: "history-thread",
    ts: rawPublicEntry.ts,
    thread: {
      id: "history-thread",
      seed: {
        id: "seed",
        type: "market",
        title: "Market",
        description: "Market",
        symbols: ["BTC"],
        sentiment: "neutral",
        createdAt: rawPublicEntry.ts,
      },
      messages: [],
      strategy: null,
      status: "completed",
      createdAt: rawPublicEntry.ts,
    },
    meta: {
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: ["ev_1"],
      locale: "zh_CN",
      recordId: "record-history",
      tradeDecision,
    },
  };
}

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
  }, 30_000);

  test("dev-only stream chat module remains available outside the public closure", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/lib/dev/streamChatThreads.ts"), "utf8");

    expect(source).toContain("export function buildStreamChatThread");
    expect(source).toContain("function withConversationFollowUps");
  });

  test("public Watch page stays off legacy analysis polling trigger modules", async () => {
    const violations: string[] = [];

    for (const blockedModule of BLOCKED_PUBLIC_TRIGGER_MODULES) {
      const importPath = await findImportPath(
        "src/modules/agent-watch/AgentWatchBoard.tsx",
        blockedModule,
      );
      if (importPath) {
        violations.push(`AgentWatchBoard -> ${blockedModule}\n${importPath.join(" -> ")}`);
      }
    }

    expect(violations).toEqual([]);
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
        locale: "zh_CN",
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
        locale: "zh_CN",
      },
    };

    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });
});

describe("watch timeline debug guard", () => {
  beforeEach(() => {
    getWatchHistoryMock.mockReset();
    readAllDecisionRecordsMock.mockReset();
    readDecisionRecordsMock.mockReset();
    getNewsEvidenceMock.mockReset();
    readAllDecisionRecordsMock.mockResolvedValue([]);
    readDecisionRecordsMock.mockResolvedValue([]);
    getNewsEvidenceMock.mockResolvedValue(null);
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

  test("public mode returns projected events without raw debug entries", async () => {
    getWatchHistoryMock.mockResolvedValueOnce({
      entries: [rawDebugEntry, rawPublicEntry],
      oldestTs: rawDebugEntry.ts,
      hasMore: false,
    });

    const response = await getWatchTimeline(
      new NextRequest("https://claw42.ai/api/watch/timeline?mode=public&locale=zh_CN"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.entries).toBeUndefined();
    expect(json.events).toHaveLength(1);
    expect(json.events[0]).toMatchObject({
      id: "public-focus",
      payload: {
        kind: "market_signal",
        symbol: "BTC",
      },
    });
    expect(json.evidenceMap).toEqual({});
  });

  test("rejects invalid timeline pagination params before reading history", async () => {
    const beforeResponse = await getWatchTimeline(
      new NextRequest("https://claw42.ai/api/watch/timeline?before=not-a-number"),
    );
    const sinceResponse = await getWatchTimeline(
      new NextRequest("https://claw42.ai/api/watch/timeline?since=not-a-number"),
    );

    expect(beforeResponse.status).toBe(400);
    expect(await beforeResponse.json()).toEqual({ error: "invalid query" });
    expect(sinceResponse.status).toBe(400);
    expect(await sinceResponse.json()).toEqual({ error: "invalid query" });
    expect(getWatchHistoryMock).not.toHaveBeenCalled();
  });
});

describe("watch history public boundary", () => {
  beforeEach(() => {
    getWatchHistoryMock.mockReset();
    readAllDecisionRecordsMock.mockReset();
    readDecisionRecordsMock.mockReset();
    readAllDecisionRecordsMock.mockResolvedValue([]);
    readDecisionRecordsMock.mockResolvedValue([]);
    getWatchHistoryMock.mockResolvedValue({
      entries: [rawDebugEntry, rawPublicEntry],
      oldestTs: rawDebugEntry.ts,
      hasMore: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("public history returns projected events without raw stream entries", async () => {
    const response = await getWatchHistoryRoute(
      new NextRequest("https://claw42.ai/api/watch/history?mode=public&locale=zh_CN"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.entries).toBeUndefined();
    expect(json.events).toHaveLength(1);
    expect(json.events[0]).toMatchObject({
      id: "public-focus",
      payload: {
        kind: "market_signal",
        symbol: "BTC",
      },
    });
    expect(json.oldestTs).toBe(rawDebugEntry.ts);
    expect(json.hasMore).toBe(false);
    expect(json.locale).toBe("zh_CN");
  });

  test("public history prefers indexed decision records over stale PM metadata", async () => {
    getWatchHistoryMock.mockResolvedValueOnce({
      entries: [
        pmHistoryEntry({
          ...historyFreshTradeDecision,
          id: "stale-trade",
          symbol: "ETH",
          direction: "short",
          generatedAt: new Date(rawPublicEntry.ts - 60_000).toISOString(),
        }),
      ],
      oldestTs: rawPublicEntry.ts,
      hasMore: false,
    });
    readAllDecisionRecordsMock.mockResolvedValueOnce([historyDecisionRecord]);

    const response = await getWatchHistoryRoute(
      new NextRequest("https://claw42.ai/api/watch/history?mode=public&locale=zh_CN"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toHaveLength(1);
    expect(json.events[0].payload).toMatchObject({
      kind: "pm_decision",
      symbol: "BTC",
      tradeDecision: {
        id: "fresh-trade",
        direction: "long",
      },
    });
  });

  test("debug history still requires the debug header before returning raw entries", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const blocked = await getWatchHistoryRoute(
      new NextRequest("https://claw42.ai/api/watch/history?mode=debug"),
    );
    const allowed = await getWatchHistoryRoute(
      new NextRequest("https://claw42.ai/api/watch/history?mode=debug", {
        headers: { "x-claw42-debug": "1" },
      }),
    );
    const json = await allowed.json();

    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(json.entries).toHaveLength(2);
    expect(json.events).toBeUndefined();
  });
});
