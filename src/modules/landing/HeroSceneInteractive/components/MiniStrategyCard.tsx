import type { Dict } from "@/i18n/types";
import type { StrategyCard } from "../types/mini-player";

interface MiniStrategyCardProps {
  strategy: StrategyCard;
  t: Dict;
}

export function MiniStrategyCard({ strategy, t }: MiniStrategyCardProps) {
  return (
    <div className="rounded-md border border-[#62f0ff]/28 bg-[#071a22]/86 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-white">
          {t.hero.miniPlayer.strategyDirection[strategy.direction]}
        </span>
        <span className="rounded-full border border-white/12 bg-white/[0.07] px-2 py-0.5 text-[11px] text-[#f9f4ff]">
          {t.hero.miniPlayer.confidence}: {strategy.confidence}%
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#d7e1ea] sm:grid-cols-3">
        <div>
          <dt className="text-[11px] text-[#8feeff]">{t.hero.miniPlayer.entry}</dt>
          <dd className="mt-0.5 leading-snug">{strategy.entry}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[#ffcb91]">{t.hero.miniPlayer.stopLoss}</dt>
          <dd className="mt-0.5 leading-snug">{strategy.stopLoss}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[#a8ffcf]">{t.hero.miniPlayer.target}</dt>
          <dd className="mt-0.5 leading-snug">{strategy.target}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-[#b7c5cf]">{strategy.note}</p>
    </div>
  );
}
