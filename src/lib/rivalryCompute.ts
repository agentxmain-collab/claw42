import type { FactionId, RivalryRecord, StrategyReplay } from "@/lib/types";
import { getFactionIds } from "@/lib/factionRegistry";

export function computeRivalryRecords(input: {
  byAgent: Partial<Record<FactionId, StrategyReplay[]>>;
}): RivalryRecord[] {
  const ids = getFactionIds();
  const records: RivalryRecord[] = [];

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const agentA = ids[i]!;
      const agentB = ids[j]!;
      const aReplays = input.byAgent[agentA] ?? [];
      const bReplays = input.byAgent[agentB] ?? [];
      const rounds = Math.max(aReplays.length, bReplays.length);
      let winsA = 0;
      let winsB = 0;
      let draws = 0;

      for (let round = 0; round < rounds; round += 1) {
        const a = aReplays[round]?.pnlPct ?? 0;
        const b = bReplays[round]?.pnlPct ?? 0;
        if (Math.abs(a - b) < 0.05) draws += 1;
        else if (a > b) winsA += 1;
        else winsB += 1;
      }

      records.push({ agentA, agentB, winsA, winsB, draws });
    }
  }

  return records;
}
