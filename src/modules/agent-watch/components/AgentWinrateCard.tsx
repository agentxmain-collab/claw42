import { getFaction } from "@/lib/factionRegistry";
import type { AgentWinrate } from "@/lib/types";

export function AgentWinrateCard({ winrate }: { winrate: AgentWinrate }) {
  const faction = getFaction(winrate.agentId);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-bold" style={{ color: faction.color }}>
        {faction.displayName}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{winrate.winrate}%</div>
      <div className="text-xs text-white/40">
        {winrate.wins}W / {winrate.losses}L · n={winrate.sampleSize}
      </div>
    </div>
  );
}
