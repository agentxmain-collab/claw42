import type { Dict } from "@/i18n/types";
import type { NewsDebate } from "@/lib/types";

export function SidebarNewsTab({
  debates,
  labels,
}: {
  debates: NewsDebate[];
  labels: Dict["agentWatch"]["newsDebate"];
}) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-[#111] p-4">
      <h3 className="text-sm font-bold text-white">{labels.newsTab}</h3>
      <div className="mt-3 space-y-2">
        {debates.length === 0 && <p className="text-xs text-white/35">{labels.noNews}</p>}
        {debates.slice(0, 5).map((debate) => (
          <a
            key={debate.id}
            href={`#${debate.id}`}
            className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/65 hover:text-white"
          >
            <span className="font-mono text-amber-200">
              {debate.newsCurrencies.map((symbol) => `$${symbol}`).join(" ")}
            </span>
            <span className="mt-1 line-clamp-2 block">{debate.newsTitle}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}
