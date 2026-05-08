import { getCachedSignals } from "@/lib/signal-engine/store";
import type {
  SignalCard,
  SignalDistributionMode,
  SignalHealth,
  SignalHealthCheck,
  SignalHealthStatus,
} from "@/types/signal";

const defaultCacheTtlSeconds = 60;
const defaultFreshnessWindowHours = 240;

type SignalHealthOptions = {
  now?: Date;
  provider?: string;
  cacheTtlSeconds?: number;
  freshnessWindowHours?: number;
};

export async function getSignalHealth(options: SignalHealthOptions = {}): Promise<SignalHealth> {
  const signals = await getCachedSignals();
  return evaluateSignalHealth(signals, options);
}

export function evaluateSignalHealth(
  signals: SignalCard[],
  options: SignalHealthOptions = {},
): SignalHealth {
  const now = options.now ?? resolveVerificationNow() ?? new Date();
  const provider = options.provider ?? process.env.SIGNAL_PROVIDER ?? "stub";
  const cacheTtlSeconds = options.cacheTtlSeconds ?? defaultCacheTtlSeconds;
  const freshnessWindowHours = options.freshnessWindowHours ?? defaultFreshnessWindowHours;
  const freshnessCutoff = now.getTime() - freshnessWindowHours * 60 * 60 * 1000;
  const newestTimestamp = signals.reduce(
    (latest, signal) => Math.max(latest, new Date(signal.facts.publishedAt).getTime()),
    0,
  );

  const metrics = {
    signalCount: signals.length,
    headlinerCount: signals.filter((signal) => signal.engine.isHeadliner).length,
    lowConfidenceCount: signals.filter(
      (signal) => signal.judgment.confidence < 40 || signal.judgment.direction === null,
    ).length,
    multiSourceCount: signals.filter((signal) => signal.evidence.multiSourceConfirm).length,
    evidencePieceCount: signals.reduce((sum, signal) => sum + signal.evidence.pieces.length, 0),
    actionCount: signals.reduce((sum, signal) => sum + signal.actions.length, 0),
    staleSignalCount: signals.filter(
      (signal) => new Date(signal.facts.publishedAt).getTime() < freshnessCutoff,
    ).length,
    newestSignalAt: newestTimestamp ? new Date(newestTimestamp).toISOString() : null,
  };

  const allSignalsHaveRiskNotes = signals.every((signal) => signal.judgment.riskNotes.length > 0);
  const checks: SignalHealthCheck[] = [
    volumeCheck(metrics.signalCount),
    headlinerCheck(metrics.signalCount, metrics.headlinerCount),
    evidenceCheck(metrics.signalCount, metrics.evidencePieceCount, metrics.multiSourceCount),
    actionCheck(metrics.signalCount, metrics.actionCount),
    riskCheck(metrics.signalCount, allSignalsHaveRiskNotes, metrics.lowConfidenceCount),
    freshnessCheck(metrics.signalCount, metrics.staleSignalCount, freshnessWindowHours),
  ];

  const status = resolveStatus(checks);
  const distributionMode = resolveDistributionMode(status);

  return {
    status,
    distributionMode,
    automationReady: distributionMode === "auto",
    humanInterventionRequired: status === "blocked",
    provider,
    generatedAt: now.toISOString(),
    cacheTtlSeconds,
    metrics,
    checks,
  };
}

function volumeCheck(signalCount: number): SignalHealthCheck {
  if (signalCount >= 5) {
    return check(
      "signal_volume",
      "pass",
      "信号覆盖",
      "Signal coverage",
      `当前 ${signalCount} 条，满足自动分发基线。`,
      `${signalCount} signals available, enough for automatic distribution.`,
    );
  }
  if (signalCount > 0) {
    return check(
      "signal_volume",
      "warn",
      "信号覆盖",
      "Signal coverage",
      `当前仅 ${signalCount} 条，自动分发降级为观察。`,
      `Only ${signalCount} signals are available, so distribution falls back to watch-only.`,
    );
  }
  return check(
    "signal_volume",
    "fail",
    "信号覆盖",
    "Signal coverage",
    "当前没有可用信号，暂停分发。",
    "No usable signal is available, so distribution is held.",
  );
}

function headlinerCheck(signalCount: number, headlinerCount: number): SignalHealthCheck {
  if (headlinerCount > 0) {
    return check(
      "headliner",
      "pass",
      "重大信号",
      "Major signal",
      `已识别 ${headlinerCount} 个重大信号。`,
      `${headlinerCount} major signal is identified.`,
    );
  }
  if (signalCount > 0) {
    return check(
      "headliner",
      "warn",
      "重大信号",
      "Major signal",
      "未识别重大信号，首页和 API 使用普通热榜。",
      "No major signal is identified; homepage and API use regular hotlist.",
    );
  }
  return check(
    "headliner",
    "fail",
    "重大信号",
    "Major signal",
    "没有信号可供排序。",
    "No signal is available for ranking.",
  );
}

function evidenceCheck(
  signalCount: number,
  evidencePieceCount: number,
  multiSourceCount: number,
): SignalHealthCheck {
  if (signalCount === 0) {
    return check(
      "evidence",
      "fail",
      "证据覆盖",
      "Evidence coverage",
      "没有信号，无法形成证据链。",
      "No signal is available to form an evidence chain.",
    );
  }
  if (evidencePieceCount >= signalCount && multiSourceCount > 0) {
    return check(
      "evidence",
      "pass",
      "证据覆盖",
      "Evidence coverage",
      `累计 ${evidencePieceCount} 条证据，包含多源共振。`,
      `${evidencePieceCount} evidence pieces are available with multi-source confirmation.`,
    );
  }
  return check(
    "evidence",
    "warn",
    "证据覆盖",
    "Evidence coverage",
    "证据链不足，保留解释但降低分发强度。",
    "Evidence is thin; explanations remain available with lower distribution intensity.",
  );
}

function actionCheck(signalCount: number, actionCount: number): SignalHealthCheck {
  if (actionCount > 0) {
    return check(
      "action_match",
      "pass",
      "动作匹配",
      "Action matching",
      `已匹配 ${actionCount} 个动作入口。`,
      `${actionCount} action entry is matched.`,
    );
  }
  if (signalCount > 0) {
    return check(
      "action_match",
      "warn",
      "动作匹配",
      "Action matching",
      "当前信号仅做信息分发，不触发交易或活动动作。",
      "Current signals are information-only and do not trigger trade or campaign actions.",
    );
  }
  return check(
    "action_match",
    "fail",
    "动作匹配",
    "Action matching",
    "没有信号可匹配动作。",
    "No signal is available for action matching.",
  );
}

function riskCheck(
  signalCount: number,
  allSignalsHaveRiskNotes: boolean,
  lowConfidenceCount: number,
): SignalHealthCheck {
  if (signalCount === 0) {
    return check(
      "risk_guard",
      "fail",
      "风险降级",
      "Risk guard",
      "没有信号可执行风险降级。",
      "No signal is available for risk guard.",
    );
  }
  if (allSignalsHaveRiskNotes) {
    return check(
      "risk_guard",
      "pass",
      "风险降级",
      "Risk guard",
      `风险提示完整，低置信度信号 ${lowConfidenceCount} 条。`,
      `Risk notes are complete, with ${lowConfidenceCount} low-confidence signal.`,
    );
  }
  return check(
    "risk_guard",
    "warn",
    "风险降级",
    "Risk guard",
    "部分信号缺少风险提示，自动分发降级。",
    "Some signals miss risk notes, so automatic distribution is downgraded.",
  );
}

function freshnessCheck(
  signalCount: number,
  staleSignalCount: number,
  freshnessWindowHours: number,
): SignalHealthCheck {
  if (signalCount === 0) {
    return check(
      "freshness",
      "fail",
      "新鲜度",
      "Freshness",
      "没有信号更新时间。",
      "No signal timestamp is available.",
    );
  }
  if (staleSignalCount === 0) {
    return check(
      "freshness",
      "pass",
      "新鲜度",
      "Freshness",
      `信号均在 ${freshnessWindowHours} 小时窗口内。`,
      `Signals are within the ${freshnessWindowHours}h freshness window.`,
    );
  }
  return check(
    "freshness",
    "warn",
    "新鲜度",
    "Freshness",
    `${staleSignalCount} 条信号超过新鲜度窗口，自动分发降级。`,
    `${staleSignalCount} signals are outside the freshness window, so distribution is downgraded.`,
  );
}

function check(
  key: string,
  status: SignalHealthCheck["status"],
  zhLabel: string,
  enLabel: string,
  zhDetail: string,
  enDetail: string,
): SignalHealthCheck {
  return {
    key,
    status,
    label: { zh: zhLabel, en: enLabel },
    detail: { zh: zhDetail, en: enDetail },
  };
}

function resolveStatus(checks: SignalHealthCheck[]): SignalHealthStatus {
  if (checks.some((item) => item.status === "fail")) return "blocked";
  if (checks.some((item) => item.status === "warn")) return "degraded";
  return "healthy";
}

function resolveDistributionMode(status: SignalHealthStatus): SignalDistributionMode {
  const modes: Record<SignalHealthStatus, SignalDistributionMode> = {
    healthy: "auto",
    degraded: "watch_only",
    blocked: "hold",
  };
  return modes[status];
}

function resolveVerificationNow() {
  const value = process.env.HOTPURSUIT_VERIFY_NOW?.trim();
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}
