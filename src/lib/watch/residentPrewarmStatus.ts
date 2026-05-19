import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import { normalizeCandidateType } from "@/lib/watch/decisionCandidate";
import {
  HOTSPOT_WINDOW_HOURS,
  MARKET_OVERVIEW_INTERVAL_HOURS,
} from "@/lib/watch/residentCandidate";

export type ResidentPrewarmKind = "market_overview" | "hotspot";
export type ResidentPrewarmKindState = "empty" | "ready" | "queued" | "running" | "failed";
export type ResidentPrewarmOverallState = ResidentPrewarmKindState;

export interface ResidentPrewarmKindStatus {
  kind: ResidentPrewarmKind;
  state: ResidentPrewarmKindState;
  stale: boolean;
  lastSucceededAt: string | null;
  lastAttemptAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  jobId: string | null;
  candidateKey: string | null;
}

export interface ResidentPrewarmStatus {
  schemaVersion: 1;
  servedAt: number;
  overallState: ResidentPrewarmOverallState;
  latestSucceededAt: string | null;
  marketOverview: ResidentPrewarmKindStatus;
  hotspot: ResidentPrewarmKindStatus;
}

const STALE_MULTIPLIER = 2;
const KIND_INTERVAL_MS: Record<ResidentPrewarmKind, number> = {
  market_overview: MARKET_OVERVIEW_INTERVAL_HOURS * 60 * 60_000,
  hotspot: HOTSPOT_WINDOW_HOURS * 60 * 60_000,
};

export function deriveResidentPrewarmStatus({
  records = [],
  jobs = [],
  now = Date.now(),
}: {
  records?: readonly StrategyDecisionRecord[];
  jobs?: readonly PmDecisionJobRecord[];
  now?: number;
}): ResidentPrewarmStatus {
  const marketOverview = deriveKindStatus("market_overview", records, jobs, now);
  const hotspot = deriveKindStatus("hotspot", records, jobs, now);
  const latestSucceededAt = latestIso([marketOverview.lastSucceededAt, hotspot.lastSucceededAt]);

  return {
    schemaVersion: 1,
    servedAt: now,
    overallState: overallState([marketOverview, hotspot]),
    latestSucceededAt,
    marketOverview,
    hotspot,
  };
}

function deriveKindStatus(
  kind: ResidentPrewarmKind,
  records: readonly StrategyDecisionRecord[],
  jobs: readonly PmDecisionJobRecord[],
  now: number,
): ResidentPrewarmKindStatus {
  const latestRecord = records
    .filter((record) => normalizeCandidateType(record.candidate?.candidateType) === kind)
    .map((record) => ({
      candidateKey: record.candidate?.candidateKey ?? null,
      ts: Date.parse(record.createdAt),
      iso: record.createdAt,
    }))
    .filter((item) => Number.isFinite(item.ts) && item.ts <= now)
    .sort(
      (left, right) =>
        right.ts - left.ts || left.candidateKey?.localeCompare(right.candidateKey ?? "") || 0,
    )[0];
  const latestJob = jobs
    .filter((job) => normalizeCandidateType(job.candidate?.candidateType) === kind)
    .map((job) => ({ job, ts: jobTime(job) }))
    .filter((item) => Number.isFinite(item.ts))
    .sort((left, right) => right.ts - left.ts || left.job.id.localeCompare(right.job.id))[0]?.job;

  const lastSucceededAt = latestRecord?.iso ?? null;
  const lastSucceededAtMs = latestRecord?.ts ?? null;
  const stale =
    lastSucceededAtMs === null ||
    now - lastSucceededAtMs > KIND_INTERVAL_MS[kind] * STALE_MULTIPLIER;
  const activeState =
    latestJob?.status === "running" || latestJob?.status === "queued" ? latestJob.status : null;
  const latestJobUpdatedAtMs = latestJob ? jobTime(latestJob) : null;
  const failureIsNewer =
    latestJob?.status === "failed" &&
    (lastSucceededAtMs === null ||
      (latestJobUpdatedAtMs !== null && latestJobUpdatedAtMs > lastSucceededAtMs));

  const state: ResidentPrewarmKindState = activeState
    ? activeState
    : failureIsNewer
      ? "failed"
      : lastSucceededAt
        ? "ready"
        : "empty";

  return {
    kind,
    state,
    stale,
    lastSucceededAt,
    lastAttemptAt: latestJob?.updatedAt ?? latestJob?.createdAt ?? null,
    nextRunAt: latestJob?.nextRunAt ?? null,
    lastError: latestJob?.lastError ?? null,
    jobId: latestJob?.id ?? null,
    candidateKey: latestJob?.candidate?.candidateKey ?? latestRecord?.candidateKey ?? null,
  };
}

function overallState(statuses: readonly ResidentPrewarmKindStatus[]): ResidentPrewarmOverallState {
  if (statuses.some((status) => status.state === "running")) return "running";
  if (statuses.some((status) => status.state === "queued")) return "queued";
  if (statuses.some((status) => status.state === "failed")) return "failed";
  if (statuses.some((status) => status.state === "ready")) return "ready";
  return "empty";
}

function latestIso(values: Array<string | null>) {
  return (
    values
      .flatMap((value) => {
        if (!value) return [];
        const ts = Date.parse(value);
        return Number.isFinite(ts) ? [{ value, ts }] : [];
      })
      .sort((left, right) => right.ts - left.ts)[0]?.value ?? null
  );
}

function jobTime(job: PmDecisionJobRecord) {
  const candidates = [job.updatedAt, job.completedAt, job.startedAt, job.createdAt]
    .map((value) => Date.parse(value ?? ""))
    .filter(Number.isFinite);
  return Math.max(...candidates);
}
