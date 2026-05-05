"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { priceDeltaColor } from "@/modules/agent-watch/utils/priceDeltaColor";
import { formatCoinSymbol } from "@/modules/agent-watch/utils/symbolFormat";
import { fadeUpVariants, getFadeUpTransition, motionViewport } from "@/lib/motion";
import type { DailyBriefData, DailyBriefMajor, DailyBriefMover } from "@/lib/dailyBrief";

type Props = {
  delay: number;
};

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";

  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 2 : 4,
  })}`;
}

function formatChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatMoverChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function changeClassName(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "text-white/40";
  return priceDeltaColor(value);
}

function useDailyBrief(locale: string): DailyBriefData | null {
  const [data, setData] = useState<DailyBriefData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await fetch(`/api/daily-brief?locale=${encodeURIComponent(locale)}`);
        if (!response.ok) throw new Error(`daily-brief ${response.status}`);
        const payload = (await response.json()) as DailyBriefData;
        if (mounted) setData(payload);
      } catch (error) {
        console.warn("[DailyBriefCard] refresh failed", error);
      }
    }

    void load();
    const interval = window.setInterval(load, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [locale]);

  return data;
}

function BriefRow({
  major,
  unavailable,
}: {
  major: DailyBriefMajor;
  unavailable: string;
}) {
  const change = formatChange(major.change24h);

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-white/40">•</span>
      <span className="font-mono font-semibold text-white">{formatCoinSymbol(major.symbol)}:</span>
      <span className="font-mono text-white/85">{formatPrice(major.price)}</span>
      <span className={changeClassName(major.change24h)}>({change})</span>
      <span className="text-white/35">-</span>
      <span className="text-white/70">{major.narrative || unavailable}</span>
    </li>
  );
}

function MoverRow({
  mover,
  label,
  tierLabel,
}: {
  mover: DailyBriefMover;
  label: string;
  tierLabel: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-white/40">•</span>
      <span className="text-white/70">{label}:</span>
      <span className="font-mono font-semibold text-white">{formatCoinSymbol(mover.symbol)}</span>
      <span className="font-mono text-white/60">24h</span>
      <span className={priceDeltaColor(mover.change24h)}>{formatMoverChange(mover.change24h)}</span>
      <span className="text-xs text-white/45">({tierLabel})</span>
    </li>
  );
}

export default function DailyBriefCard({ delay }: Props) {
  const { t, locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const data = useDailyBrief(locale);
  const copy = t.scenarios.daily.dailyBrief;
  const minutesAgo = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, Math.floor((Date.now() - data.generatedAt) / 60_000));
  }, [data]);
  const timeLabel =
    minutesAgo === 0 ? copy.justNow : copy.minutesAgo.replace("{n}", String(minutesAgo));
  const sentimentLabel = data?.fearGreed
    ? ({
        "Extreme Fear": copy.sentimentExtremeFear,
        Fear: copy.sentimentFear,
        Neutral: copy.sentimentNeutral,
        Greed: copy.sentimentGreed,
        "Extreme Greed": copy.sentimentExtremeGreed,
      }[data.fearGreed.classification] ?? data.fearGreed.classificationZh)
    : null;
  const tierLabels: Record<DailyBriefMover["tier"], string> = {
    majors: copy.tierMajors,
    trending: copy.tierHot,
    opportunity: copy.tierOpportunity,
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeUpVariants(reduceMotion)}
      transition={getFadeUpTransition(delay)}
      whileHover={reduceMotion ? undefined : { scale: 1.015 }}
      className="scenario-agent-frame group h-full min-h-[280px]"
    >
      <div className="scenario-agent-frame-glow" />
      <div className="scenario-agent-frame-white" />
      <div className="scenario-agent-frame-dark" />
      <div className="scenario-agent-frame-border" />

      <div className="scenario-agent-frame-inner h-full w-full max-w-md p-5 transition-colors duration-500 group-hover:bg-[#0f0a1a]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8ad4] via-[#a78bfa] to-[#7c5cff] text-xs font-black text-white shadow-[0_0_18px_rgba(167,139,250,0.55)]">
            C42
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-white">
                {t.scenarios.daily.chatSpeaker}
              </span>
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]/70" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]/45" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]/30" />
              </span>
            </div>
            <div className="mt-0.5 text-xs text-white/40">
              {copy.realtimeLabel} · {timeLabel}
            </div>
          </div>
        </div>

        <h3 className="mb-3 text-base font-semibold text-white">{copy.title}</h3>

        <ul className="space-y-2 text-sm leading-relaxed text-gray-300">
          {(data?.majors ?? []).map((major) => (
            <BriefRow key={major.symbol} major={major} unavailable={copy.unavailable} />
          ))}

          {!data &&
            (["BTC", "ETH", "SOL"] as const).map((symbol) => (
              <BriefRow
                key={symbol}
                major={{ symbol, price: null, change24h: null, narrative: copy.unavailable }}
                unavailable={copy.unavailable}
              />
            ))}

          {data?.fearGreed && sentimentLabel && (
            <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-white/40">•</span>
              <span className="text-white/70">{copy.sentimentLabel}:</span>
              <span className="font-semibold text-white">
                {sentimentLabel} {data.fearGreed.value}
              </span>
            </li>
          )}

          {data?.todayMover && (
            <MoverRow
              mover={data.todayMover}
              label={copy.todayMoverLabel}
              tierLabel={tierLabels[data.todayMover.tier]}
            />
          )}
        </ul>
      </div>
    </motion.div>
  );
}
