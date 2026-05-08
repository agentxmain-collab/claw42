import type { SignalCard } from "@/types/signal";

export function dedupSignals(signals: SignalCard[]) {
  const byKey = new Map<string, SignalCard>();

  for (const signal of signals) {
    const existing = byKey.get(signal.engine.dedupKey);
    if (!existing) {
      byKey.set(signal.engine.dedupKey, signal);
      continue;
    }

    const winner = existing.engine.candidateScore >= signal.engine.candidateScore ? existing : signal;
    const loser = winner === existing ? signal : existing;

    byKey.set(signal.engine.dedupKey, {
      ...winner,
      evidence: {
        ...winner.evidence,
        pieces: [...winner.evidence.pieces, ...loser.evidence.pieces],
        timeline: [...winner.evidence.timeline, ...loser.evidence.timeline],
        multiSourceConfirm: true,
        confirmCount: winner.evidence.confirmCount + loser.evidence.confirmCount
      },
      engine: {
        ...winner.engine,
        rules: Array.from(new Set([...winner.engine.rules, ...loser.engine.rules, "dedup_merge"]))
      }
    });
  }

  return Array.from(byKey.values());
}
