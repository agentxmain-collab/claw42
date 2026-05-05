"use client";

import type { Dict } from "@/i18n/types";
import type { NewsDebate } from "@/lib/types";
import { FinalStrategyBlock } from "./FinalStrategyBlock";
import { RoundBanner } from "./RoundBanner";
import { UtteranceBubble } from "./UtteranceBubble";

export function NewsDebateCard({
  debate,
  labels,
}: {
  debate: NewsDebate;
  labels: Dict["agentWatch"]["newsDebate"];
}) {
  return (
    <article className="my-4 rounded-3xl border border-amber-300/30 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.13),rgba(12,12,16,0.94)_42%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <header className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-amber-200/70">
          <span className="animate-pulse">●</span>
          <span className="font-bold">{labels.liveBadge}</span>
          <span className="text-white/30">·</span>
          <span>
            {labels.source}: {debate.newsSource}
          </span>
          {debate.layers.trigger.severity === "critical" && (
            <span className="rounded-full bg-rose-400/20 px-2 py-0.5 font-bold text-rose-200">
              {labels.criticalBadge}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold leading-snug text-white md:text-lg">
          🔥 {debate.newsTitle}
        </h3>
        <a
          href={debate.newsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex text-xs text-white/40 hover:text-white/70"
        >
          {labels.original} →
        </a>
      </header>

      <div className="mb-4 flex items-center gap-2 text-xs text-white/55">
        <span>{labels.intensity}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <span
              key={level}
              className={`h-1.5 w-5 rounded-full ${
                level <= debate.intensityScore ? "bg-amber-300" : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <span>{debate.intensityScore}/5</span>
      </div>

      <div className="space-y-3">
        {debate.rounds.map((round) => (
          <section key={round.roundNumber} className="space-y-3">
            <RoundBanner
              label={
                round.roundType === "independent"
                  ? labels.roundIndependent
                  : round.roundType === "rebuttal"
                    ? labels.roundRebuttal
                    : labels.roundConsensus
              }
            />
            {round.utterances.map((utterance) => (
              <UtteranceBubble key={utterance.id} utterance={utterance} />
            ))}
          </section>
        ))}
      </div>

      {debate.finalStrategy && (
        <FinalStrategyBlock strategy={debate.finalStrategy} labels={labels} />
      )}
    </article>
  );
}
