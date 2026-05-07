import type { SignalDataSourceResult } from "@/lib/data-sources";

export type DataSourceQualityStatus = "pass" | "warn" | "fail";

export type DataSourceQualityDimension = {
  score: number;
  maxScore: number;
  passed: boolean;
  detail: string;
};

export type DataSourceQualityReport = {
  status: DataSourceQualityStatus;
  score: number;
  dimensions: {
    priceCoverage: DataSourceQualityDimension;
    priceFreshness: DataSourceQualityDimension;
    volumeChangeCoverage: DataSourceQualityDimension;
    newsCoverage: DataSourceQualityDimension;
    warningRate: DataSourceQualityDimension;
  };
  warnings: string[];
};

export type StabilityRun = {
  quality: DataSourceQualityReport;
  latencyMs: number;
};

export type StabilitySummary = {
  status: DataSourceQualityStatus;
  totalRuns: number;
  passedRuns: number;
  passRate: number;
  averageScore: number;
  averageLatencyMs: number;
  warnings: string[];
};

type QualityOptions = {
  requiredSymbols?: string[];
  now?: Date;
  maxPriceAgeMs?: number;
};

const defaultRequiredSymbols = ["BTC", "ETH", "SOL"];
const defaultMaxPriceAgeMs = 6 * 60 * 60 * 1000;

export function scoreDataSourceQuality(result: SignalDataSourceResult, options: QualityOptions = {}): DataSourceQualityReport {
  const requiredSymbols = options.requiredSymbols ?? defaultRequiredSymbols;
  const now = options.now ?? new Date();
  const maxPriceAgeMs = options.maxPriceAgeMs ?? defaultMaxPriceAgeMs;

  const priceCoverage = scorePriceCoverage(result, requiredSymbols);
  const priceFreshness = scorePriceFreshness(result, requiredSymbols, now, maxPriceAgeMs);
  const volumeChangeCoverage = scoreVolumeChangeCoverage(result, requiredSymbols);
  const newsCoverage = scoreNewsCoverage(result);
  const warningRate = scoreWarningRate(result);
  const score = roundScore(priceCoverage.score + priceFreshness.score + volumeChangeCoverage.score + newsCoverage.score + warningRate.score);
  const hardFailure = !priceCoverage.passed || !newsCoverage.passed || !warningRate.passed;

  return {
    status: hardFailure || score < 65 ? "fail" : score >= 85 ? "pass" : "warn",
    score,
    dimensions: {
      priceCoverage,
      priceFreshness,
      volumeChangeCoverage,
      newsCoverage,
      warningRate
    },
    warnings: result.warnings
  };
}

export function summarizeStabilityRuns(runs: StabilityRun[]): StabilitySummary {
  const totalRuns = runs.length;
  const passedRuns = runs.filter((run) => run.quality.status === "pass").length;
  const passRate = totalRuns ? passedRuns / totalRuns : 0;
  const averageScore = totalRuns ? roundScore(runs.reduce((sum, run) => sum + run.quality.score, 0) / totalRuns) : 0;
  const averageLatencyMs = totalRuns ? Math.round(runs.reduce((sum, run) => sum + run.latencyMs, 0) / totalRuns) : 0;
  const warnings = Array.from(new Set(runs.flatMap((run) => run.quality.warnings)));

  return {
    status: passRate >= 0.95 && averageScore >= 85 ? "pass" : passRate >= 0.8 && averageScore >= 70 ? "warn" : "fail",
    totalRuns,
    passedRuns,
    passRate,
    averageScore,
    averageLatencyMs,
    warnings
  };
}

function scorePriceCoverage(result: SignalDataSourceResult, requiredSymbols: string[]): DataSourceQualityDimension {
  const covered = requiredSymbols.filter((symbol) => result.priceSnapshots.some((item) => item.symbol === symbol && item.price > 0));
  const score = 30 * ratio(covered.length, requiredSymbols.length);
  return {
    score,
    maxScore: 30,
    passed: covered.length === requiredSymbols.length,
    detail: `${covered.length}/${requiredSymbols.length} required prices available`
  };
}

function scorePriceFreshness(result: SignalDataSourceResult, requiredSymbols: string[], now: Date, maxPriceAgeMs: number): DataSourceQualityDimension {
  const fresh = requiredSymbols.filter((symbol) => {
    const snapshot = result.priceSnapshots.find((item) => item.symbol === symbol);
    if (!snapshot) return false;
    const updatedAt = Date.parse(snapshot.updatedAt);
    return Number.isFinite(updatedAt) && now.getTime() - updatedAt <= maxPriceAgeMs;
  });
  const score = 20 * ratio(fresh.length, requiredSymbols.length);
  return {
    score,
    maxScore: 20,
    passed: fresh.length === requiredSymbols.length,
    detail: `${fresh.length}/${requiredSymbols.length} required prices are fresh`
  };
}

function scoreVolumeChangeCoverage(result: SignalDataSourceResult, requiredSymbols: string[]): DataSourceQualityDimension {
  const covered = requiredSymbols.filter((symbol) => {
    const snapshot = result.priceSnapshots.find((item) => item.symbol === symbol);
    return snapshot && Number.isFinite(snapshot.volumeChange24h);
  });
  const score = 15 * ratio(covered.length, requiredSymbols.length);
  return {
    score,
    maxScore: 15,
    passed: covered.length === requiredSymbols.length,
    detail: `${covered.length}/${requiredSymbols.length} volume-change values available`
  };
}

function scoreNewsCoverage(result: SignalDataSourceResult): DataSourceQualityDimension {
  const validNews = result.newsItems.filter((item) => item.title.zh && item.title.en && item.summary.zh && item.summary.en);
  const passed = validNews.length > 0;
  return {
    score: passed ? 20 : 0,
    maxScore: 20,
    passed,
    detail: `${validNews.length} valid news items available`
  };
}

function scoreWarningRate(result: SignalDataSourceResult): DataSourceQualityDimension {
  const score = Math.max(0, 15 - result.warnings.length * 7.5);
  return {
    score,
    maxScore: 15,
    passed: result.warnings.length === 0,
    detail: `${result.warnings.length} source warnings`
  };
}

function ratio(value: number, total: number) {
  return total ? value / total : 0;
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}
