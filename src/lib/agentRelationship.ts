import fs from "node:fs/promises";
import path from "node:path";
import { getFaction, getFactionIds } from "@/lib/factionRegistry";
import type { FactionId, StrategyReplay } from "@/lib/types";

export interface AgentRelationshipHistoryPoint {
  ts: number;
  debt: number;
  reason: string;
}

export interface AgentRelationshipState {
  pairKey: string;
  agentA: FactionId;
  agentB: FactionId;
  emotionalDebt: number;
  updatedAt: number;
  history: AgentRelationshipHistoryPoint[];
  unsettledPunchlines: AgentRelationshipHistoryPoint[];
}

export interface AgentRelationshipSnapshot {
  updatedAt: number;
  pairs: AgentRelationshipState[];
}

const CACHE_DIR = path.join(process.env.CLAW42_CACHE_DIR || process.cwd(), ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "agent-relationships.json");
const WEEK_MS = 7 * 24 * 60 * 60_000;
const DECAY_PER_WEEK = 0.7;
const MAX_HISTORY = 60;

function pairKey(agentA: FactionId, agentB: FactionId) {
  return [agentA, agentB].sort().join(":");
}

function pairsFromRegistry(now: number): AgentRelationshipState[] {
  const ids = getFactionIds();
  const pairs: AgentRelationshipState[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const agentA = ids[i]!;
      const agentB = ids[j]!;
      pairs.push({
        pairKey: pairKey(agentA, agentB),
        agentA,
        agentB,
        emotionalDebt: 0,
        updatedAt: now,
        history: [],
        unsettledPunchlines: [],
      });
    }
  }
  return pairs;
}

function normalizeSnapshot(value: Partial<AgentRelationshipSnapshot> | null, now: number) {
  const defaults = pairsFromRegistry(now);
  const byKey = new Map(
    Array.isArray(value?.pairs)
      ? value.pairs
          .filter((pair): pair is AgentRelationshipState => Boolean(pair?.pairKey))
          .map((pair) => [pair.pairKey, pair])
      : [],
  );

  return {
    updatedAt: typeof value?.updatedAt === "number" ? value.updatedAt : now,
    pairs: defaults.map((fallback) => ({
      ...fallback,
      ...(byKey.get(fallback.pairKey) ?? {}),
    })),
  };
}

function applyDecay(pair: AgentRelationshipState, now: number): AgentRelationshipState {
  const age = Math.max(0, now - pair.updatedAt);
  const decay = Math.pow(DECAY_PER_WEEK, age / WEEK_MS);
  const emotionalDebt = Math.abs(pair.emotionalDebt) < 0.1 ? 0 : pair.emotionalDebt * decay;
  const cutoff = now - WEEK_MS;
  return {
    ...pair,
    emotionalDebt: Number(emotionalDebt.toFixed(2)),
    updatedAt: now,
    history: pair.history.slice(-MAX_HISTORY),
    unsettledPunchlines: pair.unsettledPunchlines.filter((item) => item.ts >= cutoff),
  };
}

export async function loadRelationshipStates(now = Date.now()): Promise<AgentRelationshipSnapshot> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = normalizeSnapshot(JSON.parse(raw) as Partial<AgentRelationshipSnapshot>, now);
    return {
      updatedAt: now,
      pairs: parsed.pairs.map((pair) => applyDecay(pair, now)),
    };
  } catch {
    return { updatedAt: now, pairs: pairsFromRegistry(now) };
  }
}

export async function saveRelationshipStates(snapshot: AgentRelationshipSnapshot) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(snapshot, null, 2));
}

function appendHistory(pair: AgentRelationshipState, now: number, delta: number, reason: string) {
  return {
    ...pair,
    emotionalDebt: Number(Math.max(-12, Math.min(12, pair.emotionalDebt + delta)).toFixed(2)),
    updatedAt: now,
    history: [...pair.history, { ts: now, debt: pair.emotionalDebt + delta, reason }].slice(
      -MAX_HISTORY,
    ),
    unsettledPunchlines:
      Math.abs(delta) >= 1.5
        ? [
            ...pair.unsettledPunchlines,
            { ts: now, debt: pair.emotionalDebt + delta, reason },
          ].slice(-MAX_HISTORY)
        : pair.unsettledPunchlines,
  };
}

export async function adjustDebtFromReplays(replays: StrategyReplay[], now = Date.now()) {
  const snapshot = await loadRelationshipStates(now);
  if (replays.length === 0) {
    await saveRelationshipStates(snapshot);
    return snapshot;
  }

  const net = replays.reduce((sum, replay) => sum + (replay.isWin ? 0.45 : -0.55), 0);
  const pairs = snapshot.pairs.map((pair, index) =>
    appendHistory(pair, now, net * (index % 2 === 0 ? 1 : -0.8), "strategy_replay"),
  );
  const next = { updatedAt: now, pairs };
  await saveRelationshipStates(next);
  return next;
}

export function relationshipContextForAgent(
  agentId: FactionId,
  snapshot: AgentRelationshipSnapshot,
): string {
  const lines = snapshot.pairs
    .filter((pair) => pair.agentA === agentId || pair.agentB === agentId)
    .filter((pair) => Math.abs(pair.emotionalDebt) >= 5)
    .map((pair) => {
      const otherId = pair.agentA === agentId ? pair.agentB : pair.agentA;
      const other = getFaction(otherId);
      const relation = pair.emotionalDebt > 0 ? "欠一次反击" : "刚被压过一头";
      return `- 和 ${other.displayName}/${other.nickname} 的关系：${relation}，但不能影响价格判断。`;
    });
  return lines.length > 0 ? `## 派别关系动态\n${lines.join("\n")}` : "";
}

export function relationshipChartRows(snapshot: AgentRelationshipSnapshot) {
  return snapshot.pairs.map((pair) => ({
    pair: `${getFaction(pair.agentA).displayName}/${getFaction(pair.agentB).displayName}`,
    debt: Number(pair.emotionalDebt.toFixed(2)),
    updatedAt: pair.updatedAt,
  }));
}

export type AgentRelationshipChartRow = ReturnType<typeof relationshipChartRows>[number];
