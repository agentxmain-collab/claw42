import type { LocalizedText, MarketDirection } from "@/types/common";
import type { ImpactLevel } from "@/types/signal";
import type { RawCandidate, RuleEvaluation } from "@/lib/signal-engine/types";

export type StructuredFields = {
  whyItMatters: LocalizedText;
  marketContext: LocalizedText;
  watchPoints: LocalizedText[];
  direction: MarketDirection | null;
  confidence: number;
  impactLevel: ImpactLevel;
  riskNotes: LocalizedText[];
};

export type StructuringProviderInput = {
  candidate: RawCandidate;
  rules: RuleEvaluation[];
  score: number;
  impactLevel: ImpactLevel;
};

export type StructuringProvider = {
  name: string;
  structure(input: StructuringProviderInput): Promise<StructuredFields>;
};
