import { NextResponse } from "next/server";
import { readDecisionRuns } from "@/lib/team/decisionRunLedger";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { buildDecisionOpsAlertSnapshot } from "@/lib/team/decisionOpsAlertSnapshot";
import { buildDecisionOpsCausalRunbook } from "@/lib/team/decisionOpsCausalRunbook";
import { buildDecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import { buildDecisionOpsCronAudit } from "@/lib/team/decisionOpsCronAudit";
import { buildDecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import { buildDecisionOpsFreshness } from "@/lib/team/decisionOpsFreshness";
import {
  buildDecisionOpsHealthDetails,
  summarizeDecisionOpsHealth,
} from "@/lib/team/decisionOpsHealth";
import { buildDecisionOpsLifecycleDiagnostics } from "@/lib/team/decisionOpsLifecycleDiagnostics";
import { buildDecisionOpsModelQuality } from "@/lib/team/decisionOpsModelQuality";
import { buildDecisionOpsPublicOutputStability } from "@/lib/team/decisionOpsPublicOutputStability";
import { buildDecisionOpsQualityBaseline } from "@/lib/team/decisionOpsQualityBaseline";
import { buildDecisionOpsQualityGate } from "@/lib/team/decisionOpsQualityGate";
import { buildDecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";
import { buildDecisionOpsReconciliation } from "@/lib/team/decisionOpsReconciliation";
import { buildDecisionOpsRollup } from "@/lib/team/decisionOpsRollup";
import { buildDecisionOpsSlo } from "@/lib/team/decisionOpsSlo";
import { buildDecisionOpsSparseExecution } from "@/lib/team/decisionOpsSparseExecution";
import { buildDecisionOpsStability } from "@/lib/team/decisionOpsStability";
import { buildDecisionOpsSummary } from "@/lib/team/decisionOpsSummary";
import { getPmDecisionQueueReadiness } from "@/lib/team/pmDecisionJobQueue";
import { summarizeProviderTelemetry } from "@/lib/team/providerTelemetry";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import { deriveResidentPrewarmStatus } from "@/lib/watch/residentPrewarmStatus";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const includeDetails = url.searchParams.get("details") === "1";
  const includeReconciliation = url.searchParams.get("reconcile") === "1";
  const includeDeepDiagnostics = url.searchParams.get("deep") === "1";
  const includeFreshness = url.searchParams.get("freshness") === "1";
  const includeRollup = url.searchParams.get("rollup") === "1";
  const includeSlo = url.searchParams.get("slo") === "1";
  const includeQualityGate = url.searchParams.get("qualityGate") === "1";
  const includeCronAudit = url.searchParams.get("cronAudit") === "1";
  const includeRunbook = url.searchParams.get("runbook") === "1";
  const includeRecovery = url.searchParams.get("recovery") === "1";
  const includeModelQuality = url.searchParams.get("modelQuality") === "1";
  const includeQualityBaseline = url.searchParams.get("qualityBaseline") === "1";
  const includeOutputStability = url.searchParams.get("outputStability") === "1";
  const includeLifecycle = url.searchParams.get("lifecycle") === "1";
  const includeOpsSummary = url.searchParams.get("opsSummary") === "1";
  const includeSparseExecution = url.searchParams.get("sparseExecution") === "1";
  const now = Date.now();
  const includeStability = url.searchParams.get("stability") === "1";
  const includeCausalRunbook = url.searchParams.get("causalRunbook") === "1";
  const includeAlertSnapshot = url.searchParams.get("alertSnapshot") === "1";
  const ledgerLimit =
    includeStability || includeQualityBaseline || includeCausalRunbook || includeAlertSnapshot
      ? MAX_LIMIT
      : limit;
  const needsDecisionRecords =
    includeReconciliation ||
    includeDeepDiagnostics ||
    includeFreshness ||
    includeRollup ||
    includeSlo ||
    includeQualityGate ||
    includeRunbook ||
    includeRecovery ||
    includeModelQuality ||
    includeQualityBaseline ||
    includeOutputStability ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeLifecycle ||
    includeOpsSummary ||
    includeSparseExecution ||
    includeStability;
  const detailLimit = normalizeDetailLimit(url.searchParams.get("detailLimit"));
  const [jobs, runs, decisionRecords] = await Promise.all([
    readPmDecisionJobs({ locale, limit: ledgerLimit }),
    readDecisionRuns({ locale, limit: ledgerLimit }),
    needsDecisionRecords ? readAllDecisionRecords(500, locale) : Promise.resolve([]),
  ]);
  const queueReadiness = getPmDecisionQueueReadiness();
  const health = summarizeDecisionOpsHealth({ jobs, runs });
  const publicEvents =
    includeReconciliation ||
    includeFreshness ||
    includeRollup ||
    includeSlo ||
    includeRunbook ||
    includeRecovery ||
    includeOpsSummary ||
    includeStability ||
    includeOutputStability ||
    includeCausalRunbook ||
    includeAlertSnapshot
      ? publicPmEventsFromRecords(decisionRecords)
      : [];
  const providerTelemetry =
    includeDeepDiagnostics ||
    includeRollup ||
    includeQualityGate ||
    includeModelQuality ||
    includeQualityBaseline ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary
      ? summarizeProviderTelemetry({ since: Date.now() - 24 * 60_000 })
      : null;
  const residentPrewarm =
    includeFreshness ||
    includeRollup ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary
      ? deriveResidentPrewarmStatus({
          records: decisionRecords,
          jobs,
          now,
        })
      : null;
  const reconciliation =
    includeReconciliation || includeRollup
      ? buildDecisionOpsReconciliation({
          jobs,
          runs,
          publicEvents,
          queueReadiness,
        })
      : null;
  const deepDiagnostics =
    includeDeepDiagnostics ||
    includeRollup ||
    includeModelQuality ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary
      ? buildDecisionOpsDeepDiagnostics({
          jobs,
          runs,
          records: decisionRecords,
          providerTelemetry,
        })
      : null;
  const qualityGate =
    includeQualityGate ||
    includeModelQuality ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary
      ? buildDecisionOpsQualityGate({
          runs,
          records: decisionRecords,
          providerTelemetry,
        })
      : null;
  const freshness =
    includeFreshness ||
    includeRollup ||
    includeRunbook ||
    includeRecovery ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary
      ? buildDecisionOpsFreshness({
          jobs,
          runs,
          publicEvents,
        })
      : null;
  const cronAudit =
    includeCronAudit ||
    includeRunbook ||
    includeRecovery ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary
      ? buildDecisionOpsCronAudit({
          jobs,
          runs,
          queueReadiness,
        })
      : null;
  const runbook =
    (includeRunbook ||
      includeRecovery ||
      includeCausalRunbook ||
      includeAlertSnapshot ||
      includeOpsSummary) &&
    cronAudit &&
    freshness
      ? buildDecisionOpsChainRunbook({
          cronAudit,
          freshness,
          health,
        })
      : null;
  const recoveryPolicy =
    (includeRecovery || includeCausalRunbook || includeAlertSnapshot || includeOpsSummary) &&
    runbook &&
    cronAudit
      ? buildDecisionOpsQueueRecoveryPolicy({
          runbook,
          cronAudit,
          health,
        })
      : null;
  const modelQuality =
    (includeModelQuality || includeCausalRunbook || includeAlertSnapshot || includeOpsSummary) &&
    qualityGate &&
    deepDiagnostics
      ? buildDecisionOpsModelQuality({
          qualityGate,
          deepDiagnostics,
        })
      : null;
  const qualityBaseline =
    includeQualityBaseline || includeCausalRunbook || includeAlertSnapshot
      ? buildDecisionOpsQualityBaseline({
          runs,
          records: decisionRecords,
          providerTelemetry,
        })
      : null;
  const outputStability =
    includeOutputStability || includeCausalRunbook || includeAlertSnapshot
      ? buildDecisionOpsPublicOutputStability({
          publicEvents,
        })
      : null;
  const lifecycle =
    includeLifecycle || includeOpsSummary
      ? buildDecisionOpsLifecycleDiagnostics({
          records: decisionRecords,
        })
      : null;
  const stability =
    includeStability || includeCausalRunbook || includeAlertSnapshot
      ? buildDecisionOpsStability({
          jobs,
          runs,
          publicEvents,
        })
      : null;
  const causalRunbook =
    (includeCausalRunbook || includeAlertSnapshot) &&
    runbook &&
    recoveryPolicy &&
    stability &&
    outputStability &&
    qualityBaseline
      ? buildDecisionOpsCausalRunbook({
          runbook,
          recoveryPolicy,
          stability,
          outputStability,
          qualityBaseline,
        })
      : null;
  const alertSnapshot =
    includeAlertSnapshot && causalRunbook
      ? buildDecisionOpsAlertSnapshot({
          causalRunbook,
        })
      : null;
  const sparseExecution = includeSparseExecution
    ? buildDecisionOpsSparseExecution({
        records: decisionRecords,
      })
    : null;

  return NextResponse.json(
    {
      ok: true,
      locale,
      health,
      queueReadiness,
      ...(includeDetails
        ? { details: buildDecisionOpsHealthDetails({ jobs, runs, limit: detailLimit }) }
        : {}),
      ...(includeReconciliation ? { reconciliation } : {}),
      ...(includeDeepDiagnostics ? { deepDiagnostics } : {}),
      ...(includeFreshness ? { freshness } : {}),
      ...(includeFreshness && residentPrewarm ? { residentPrewarm } : {}),
      ...(includeRollup && reconciliation && deepDiagnostics && freshness
        ? {
            rollup: buildDecisionOpsRollup({
              health,
              reconciliation,
              deepDiagnostics,
              freshness,
            }),
          }
        : {}),
      ...(includeSlo
        ? {
            slo: buildDecisionOpsSlo({
              jobs,
              runs,
              publicEvents,
            }),
          }
        : {}),
      ...(includeQualityGate ? { qualityGate } : {}),
      ...(includeCronAudit
        ? {
            cronAudit,
          }
        : {}),
      ...(includeRunbook && cronAudit && freshness
        ? {
            runbook,
          }
        : {}),
      ...(includeRecovery && cronAudit && freshness
        ? {
            recoveryPolicy,
          }
        : {}),
      ...(includeModelQuality && qualityGate && deepDiagnostics
        ? {
            modelQuality,
          }
        : {}),
      ...(includeQualityBaseline
        ? {
            qualityBaseline,
          }
        : {}),
      ...(includeOutputStability
        ? {
            outputStability,
          }
        : {}),
      ...(includeLifecycle
        ? {
            lifecycle,
          }
        : {}),
      ...(includeStability
        ? {
            stability,
          }
        : {}),
      ...(includeCausalRunbook
        ? {
            causalRunbook,
          }
        : {}),
      ...(includeAlertSnapshot
        ? {
            alertSnapshot,
          }
        : {}),
      ...(includeSparseExecution
        ? {
            sparseExecution,
          }
        : {}),
      ...(includeOpsSummary && runbook && recoveryPolicy && modelQuality && lifecycle
        ? {
            opsSummary: buildDecisionOpsSummary({
              runbook,
              recoveryPolicy,
              modelQuality,
              lifecycle,
            }),
          }
        : {}),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function publicPmEventsFromRecords(records: readonly StrategyDecisionRecord[]) {
  return records
    .map((record) => projectDecisionRecordToPublicEvent(record))
    .filter((event): event is PublicTimelineEvent => event?.payload.kind === "pm_decision");
}

function isAuthorized(request: Request) {
  const secret = process.env.OPS_HEALTH_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-claw42-ops-secret") === secret;
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function normalizeDetailLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}
