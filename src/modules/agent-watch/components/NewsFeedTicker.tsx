import type { Dict } from "@/i18n/types";
import type { NewsDebate } from "@/lib/types";

export function NewsFeedTicker({
  debates,
  labels,
}: {
  debates: NewsDebate[];
  labels: Dict["agentWatch"]["newsDebate"];
}) {
  if (debates.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] py-2">
      <div className="animate-market-marquee flex w-max gap-3 px-3 text-xs text-white/60">
        {[...debates, ...debates].map((debate, index) => (
          <span
            key={`${debate.id}-${index}`}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1"
          >
            {labels.newsTab} · {debate.newsCurrencies.map((symbol) => `$${symbol}`).join("/")} ·{" "}
            {debate.newsTitle}
          </span>
        ))}
      </div>
    </div>
  );
}
