import type {
  DebateProjection,
  DebateProjectionView,
  NewsDebate,
  OperatorDebateProjection,
  PublicDebateProjection,
  ShareDebateProjection,
} from "@/lib/types";

function publicProjection(debate: NewsDebate): PublicDebateProjection {
  return {
    id: debate.id,
    ts: debate.ts,
    title: debate.newsTitle,
    source: debate.newsSource,
    currencies: debate.newsCurrencies,
    severity: debate.layers.trigger.severity,
    status: debate.status,
    intensityScore: debate.intensityScore,
    rounds: debate.rounds,
    finalStrategy: debate.finalStrategy,
  };
}

function operatorProjection(debate: NewsDebate): OperatorDebateProjection {
  return {
    ...publicProjection(debate),
    rawNews: debate.layers.source,
    trigger: debate.layers.trigger,
    layers: debate.layers,
  };
}

function shareProjection(debate: NewsDebate): ShareDebateProjection {
  const strategy = debate.finalStrategy;
  const symbol = strategy?.symbol ?? debate.newsCurrencies[0] ?? "BTC";
  return {
    id: debate.id,
    title: debate.newsTitle,
    source: debate.newsSource,
    symbol,
    direction: strategy?.direction ?? "wait",
    consensusRatio: strategy?.consensusRatio ?? "0:3",
    goldenLines: debate.rounds.flatMap((round) =>
      round.utterances.filter((utterance) => utterance.isGoldenLine),
    ),
    followCount: strategy?.followCount ?? 0,
  };
}

export function projectDebate(debate: NewsDebate, view: DebateProjectionView): DebateProjection {
  if (view === "operator") return operatorProjection(debate);
  if (view === "share") return shareProjection(debate);
  return publicProjection(debate);
}
