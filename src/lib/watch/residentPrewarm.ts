import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { marketSignalsFromPool } from "@/lib/team/pmDecisionTrigger";
import { selectPmDecisionTopics } from "@/lib/team/topicSelector";
import type { Locale } from "@/i18n/types";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import {
  hotspotDecisionCandidate,
  marketOverviewCandidate,
  shouldRunHotspotPrewarm,
  shouldRunMarketOverviewPrewarm,
  utcHourWindowKey,
} from "@/lib/watch/residentCandidate";
import {
  deriveResidentPrewarmStatus,
  type ResidentPrewarmKind,
  type ResidentPrewarmKindStatus,
  type ResidentPrewarmStatus,
} from "@/lib/watch/residentPrewarmStatus";

export const HOTSPOT_BURST_WINDOW_HOURS = 1;
export const HOTSPOT_BURST_SCORE_THRESHOLD = 130;

export interface ResidentPrewarmPlan {
  candidates: DecisionCandidate[];
  fixedCadenceCandidateKeys: string[];
  burstCandidateKey: string | null;
  burstScore: number | null;
  burstThreshold: number;
  backfillCandidateKeys: string[];
  residentStatus: ResidentPrewarmStatus;
}

export function residentPrewarmCandidates({
  locale,
  now,
  pool,
  newsItems = [],
  force = false,
  includeBurst = true,
}: {
  locale: Locale;
  now: number;
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  force?: boolean;
  includeBurst?: boolean;
}): DecisionCandidate[] {
  const candidates: DecisionCandidate[] = [];
  if (force || shouldRunMarketOverviewPrewarm(now)) {
    candidates.push(marketOverviewCandidate({ locale, now }));
  }
  if (force || shouldRunHotspotPrewarm(now)) {
    candidates.push(hotspotDecisionCandidate({ locale, now }));
  }

  const burst = includeBurst ? hotspotBurstCandidate({ locale, now, pool, newsItems }) : null;
  if (burst && !candidates.some((candidate) => candidate.candidateKey === burst.candidateKey)) {
    candidates.push(burst);
  }

  return candidates;
}

export function residentPrewarmPlan({
  locale,
  now,
  pool,
  newsItems = [],
  records = [],
  jobs = [],
  force = false,
  allowFirstFillBackfill = true,
}: {
  locale: Locale;
  now: number;
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  records?: readonly StrategyDecisionRecord[];
  jobs?: readonly PmDecisionJobRecord[];
  force?: boolean;
  allowFirstFillBackfill?: boolean;
}): ResidentPrewarmPlan {
  const fixedCadenceCandidates = residentPrewarmCandidates({
    locale,
    now,
    pool,
    newsItems,
    force,
    includeBurst: false,
  });
  const baselineCandidates = residentPrewarmCandidates({
    locale,
    now,
    pool,
    newsItems,
    force,
    includeBurst: true,
  });
  const fixedKeys = new Set(fixedCadenceCandidates.map((candidate) => candidate.candidateKey));
  const burst = baselineCandidates.find((candidate) => !fixedKeys.has(candidate.candidateKey));
  const residentStatus = deriveResidentPrewarmStatus({ records, jobs, now });
  const baselineKeys = new Set(baselineCandidates.map((candidate) => candidate.candidateKey));
  const backfillCandidates = [
    backfillCandidateForKind("market_overview", residentStatus.marketOverview, jobs, locale, now, {
      allowFirstFillBackfill,
    }),
    backfillCandidateForKind("hotspot", residentStatus.hotspot, jobs, locale, now, {
      allowFirstFillBackfill,
    }),
  ]
    .filter((candidate): candidate is DecisionCandidate => Boolean(candidate))
    .filter((candidate) => !baselineKeys.has(candidate.candidateKey));
  const candidates = dedupeCandidates([...baselineCandidates, ...backfillCandidates]);

  return {
    candidates,
    fixedCadenceCandidateKeys: fixedCadenceCandidates.map((candidate) => candidate.candidateKey),
    burstCandidateKey: burst?.candidateKey ?? null,
    burstScore: burst?.score ?? null,
    burstThreshold: HOTSPOT_BURST_SCORE_THRESHOLD,
    backfillCandidateKeys: backfillCandidates.map((candidate) => candidate.candidateKey),
    residentStatus,
  };
}

function hotspotBurstCandidate({
  locale,
  now,
  pool,
  newsItems,
}: {
  locale: Locale;
  now: number;
  pool?: CoinPoolPayload;
  newsItems: NewsItem[];
}) {
  const newsEvidence = newsItems.map((item) => newsItemToEvidence(item));
  const marketSignals = marketSignalsFromPool(pool, now);
  const topic = selectPmDecisionTopics({
    pool,
    marketSignals,
    newsEvidence,
    now,
  })[0];
  if (!topic || topic.score < HOTSPOT_BURST_SCORE_THRESHOLD) return null;

  return hotspotDecisionCandidate({
    locale,
    now,
    symbol: topic.symbol,
    executable: false,
    score: topic.score,
    reasons: topic.reasons,
    candidateKey: `hotspot:burst:${locale}:${utcHourWindowKey(
      now,
      HOTSPOT_BURST_WINDOW_HOURS,
    )}:${topic.symbol}`,
    displayTitle: `${topic.symbol} 热点异动追踪`,
  });
}

function backfillCandidateForKind(
  kind: ResidentPrewarmKind,
  status: ResidentPrewarmKindStatus,
  jobs: readonly PmDecisionJobRecord[],
  locale: Locale,
  now: number,
  {
    allowFirstFillBackfill,
  }: {
    allowFirstFillBackfill: boolean;
  },
) {
  if (status.state === "queued" || status.state === "running") return null;
  const dueFailedJob = latestDueFailedResidentJob(kind, jobs, now);
  if (dueFailedJob?.candidate) return dueFailedJob.candidate;
  if (!shouldSlaBackfill(status, { allowFirstFillBackfill })) return null;
  return kind === "market_overview"
    ? marketOverviewCandidate({ locale, now })
    : hotspotDecisionCandidate({ locale, now });
}

function shouldSlaBackfill(
  status: ResidentPrewarmKindStatus,
  {
    allowFirstFillBackfill,
  }: {
    allowFirstFillBackfill: boolean;
  },
) {
  if (status.state === "empty") return allowFirstFillBackfill;
  if (status.stale) return true;
  return status.slaState === "critical" && status.state === "failed";
}

function latestDueFailedResidentJob(
  kind: ResidentPrewarmKind,
  jobs: readonly PmDecisionJobRecord[],
  now: number,
) {
  return jobs
    .filter(
      (job) =>
        job.status === "failed" &&
        job.candidate?.candidateType === kind &&
        dueAtOrBefore(job.nextRunAt, now),
    )
    .sort(
      (left, right) => jobSortTime(right) - jobSortTime(left) || left.id.localeCompare(right.id),
    )[0];
}

function dueAtOrBefore(value: string | null, now: number) {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now;
}

function jobSortTime(job: PmDecisionJobRecord) {
  return Math.max(
    ...[job.updatedAt, job.completedAt, job.startedAt, job.createdAt]
      .map((value) => Date.parse(value ?? ""))
      .filter(Number.isFinite),
    0,
  );
}

function dedupeCandidates(candidates: readonly DecisionCandidate[]) {
  const seen = new Set<string>();
  const deduped: DecisionCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.candidateKey)) continue;
    seen.add(candidate.candidateKey);
    deduped.push(candidate);
  }
  return deduped;
}
