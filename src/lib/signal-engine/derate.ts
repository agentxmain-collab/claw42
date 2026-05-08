import { isCredibleSource } from "@/lib/signal-engine/ingest";
import type { SignalCard } from "@/types/signal";

export function derateSignal(signal: SignalCard): SignalCard {
  const rules = new Set(signal.engine.rules);
  const needsDefaultRisk = signal.judgment.riskNotes.length === 0;
  const hasWeakEvidence = !signal.evidence.multiSourceConfirm && signal.evidence.pieces.length < 2;
  const hasLowConfidence = signal.judgment.confidence < 40;
  const hasSourceRisk = !isCredibleSource(signal.facts.source) && signal.facts.source !== "mock-market";
  const directionConflict = rules.has("direction_conflict");

  return {
    ...signal,
    facts: {
      ...signal.facts,
      eventStatus: directionConflict ? "watching" : signal.facts.eventStatus
    },
    judgment: {
      ...signal.judgment,
      direction: hasLowConfidence ? null : signal.judgment.direction,
      riskNotes: needsDefaultRisk
        ? [
            {
              zh: "该信号证据仍需后续确认，请结合行情变化观察。",
              en: "This signal still needs confirmation; monitor it alongside market changes."
            }
          ]
        : signal.judgment.riskNotes
    },
    engine: {
      ...signal.engine,
      isHeadliner: signal.engine.isHeadliner && !hasWeakEvidence && !hasSourceRisk,
      rules: Array.from(new Set([...signal.engine.rules, ...(hasLowConfidence ? ["low_confidence_derated"] : []), ...(hasWeakEvidence ? ["weak_evidence_derated"] : []), ...(hasSourceRisk ? ["source_quality_derated"] : [])]))
    }
  };
}
