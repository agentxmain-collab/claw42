import { getSignalsByWindow } from "@/lib/signalBuffer";
import type { SignalRecord } from "@/modules/agent-watch/types";

const SUMMARY_WINDOW_MS = 2 * 60 * 60_000;
const SIGNAL_TYPE_LABELS: Record<SignalRecord["type"], string> = {
  volume_spike: "放量异动",
  near_high: "接近近期高位",
  near_low: "接近近期低位",
  breakout: "突破信号",
  ema_cross: "EMA 共振变化",
  range_change: "波动区间变化",
};

export interface BufferSummary {
  windowMs: number;
  totalSignals: number;
  bySymbol: Record<
    string,
    {
      count: number;
      latest: number;
      types: SignalRecord["type"][];
      descriptions: string[];
    }
  >;
  topAlerts: SignalRecord[];
}

export function buildSignalSummary(): BufferSummary {
  const signals = getSignalsByWindow(SUMMARY_WINDOW_MS);
  const bySymbol: BufferSummary["bySymbol"] = {};

  for (const signal of [...signals].sort((a, b) => b.ts - a.ts)) {
    bySymbol[signal.symbol] ??= {
      count: 0,
      latest: 0,
      types: [],
      descriptions: [],
    };

    const entry = bySymbol[signal.symbol];
    entry.count += 1;
    entry.latest = Math.max(entry.latest, signal.ts);
    if (!entry.types.includes(signal.type)) entry.types.push(signal.type);
    if (signal.payload.description && entry.descriptions.length < 5) {
      entry.descriptions.push(signal.payload.description);
    }
  }

  return {
    windowMs: SUMMARY_WINDOW_MS,
    totalSignals: signals.length,
    bySymbol,
    topAlerts: signals
      .filter((signal) => signal.severity === "alert")
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5),
  };
}

export function formatSummaryForPrompt(summary: BufferSummary): string {
  const lines = [
    `## 过去 ${Math.round(summary.windowMs / 60_000)} 分钟市场信号沉淀（共 ${summary.totalSignals} 条）`,
  ];

  const entries = Object.entries(summary.bySymbol).sort((a, b) => b[1].count - a[1].count);
  if (entries.length === 0) {
    lines.push("- 暂无足够信号。只能输出观察中，不得编造技术指标。");
  }

  for (const [symbol, entry] of entries) {
    const typeLabels = entry.types.map((type) => SIGNAL_TYPE_LABELS[type] ?? type);
    lines.push("");
    lines.push(`### ${symbol}（${entry.count} 条信号，类型：${typeLabels.join(" / ")}）`);
    entry.descriptions.forEach((description) => lines.push(`- ${description}`));
  }

  if (summary.topAlerts.length > 0) {
    lines.push("");
    lines.push("## 高优警报");
    summary.topAlerts.forEach((alert) => {
      lines.push(
        `- [${new Date(alert.ts).toISOString().slice(11, 16)}] ${
          alert.payload.description ?? `${alert.symbol} ${SIGNAL_TYPE_LABELS[alert.type] ?? alert.type}`
        }`,
      );
    });
  }

  return lines.join("\n");
}
