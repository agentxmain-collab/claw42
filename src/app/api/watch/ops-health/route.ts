import { NextResponse } from "next/server";
import { readDecisionRuns } from "@/lib/team/decisionRunLedger";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { buildDecisionOpsAlertSnapshot } from "@/lib/team/decisionOpsAlertSnapshot";
import { buildDecisionOpsCausalRunbook } from "@/lib/team/decisionOpsCausalRunbook";
import { buildDecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import { buildDecisionOpsCronAudit } from "@/lib/team/decisionOpsCronAudit";
import { buildDecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import { buildDecisionOpsFreshness } from "@/lib/team/decisionOpsFreshness";
import { buildDecisionOpsAutonomousRemediation } from "@/lib/team/decisionOpsAutonomousRemediation";
import { buildDecisionOpsGlobalProgressGate } from "@/lib/team/decisionOpsGlobalProgressGate";
import { buildDecisionOpsGlobalPrewarmPlan } from "@/lib/team/decisionOpsGlobalPrewarmPlan";
import {
  buildDecisionOpsHealthDetails,
  summarizeDecisionOpsHealth,
} from "@/lib/team/decisionOpsHealth";
import { buildDecisionOpsLifecycleDiagnostics } from "@/lib/team/decisionOpsLifecycleDiagnostics";
import { buildDecisionOpsMemoryLearning } from "@/lib/team/decisionOpsMemoryLearning";
import { buildDecisionOpsMemoryProductizationGate } from "@/lib/team/decisionOpsMemoryProductizationGate";
import { buildDecisionOpsModelQuality } from "@/lib/team/decisionOpsModelQuality";
import { buildDecisionOpsPublicAnalysisBetaGate } from "@/lib/team/decisionOpsPublicAnalysisBetaGate";
import { buildDecisionOpsPublicOutputStability } from "@/lib/team/decisionOpsPublicOutputStability";
import { buildDecisionOpsQualityBaseline } from "@/lib/team/decisionOpsQualityBaseline";
import { buildDecisionOpsQualityGate } from "@/lib/team/decisionOpsQualityGate";
import { buildDecisionOpsQueuePriorityPolicy } from "@/lib/team/decisionOpsQueuePriorityPolicy";
import { buildDecisionOpsResidentQueueCanary } from "@/lib/team/decisionOpsResidentQueueCanary";
import { buildDecisionOpsResidentPublicVisibility } from "@/lib/team/decisionOpsResidentPublicVisibility";
import { buildDecisionOpsResidentPrewarmCoverage } from "@/lib/team/decisionOpsResidentPrewarmCoverage";
import { buildDecisionOpsRoleDiversityGate } from "@/lib/team/decisionOpsRoleDiversityGate";
import { buildDecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";
import { buildDecisionOpsReconciliation } from "@/lib/team/decisionOpsReconciliation";
import { buildDecisionOpsRollup } from "@/lib/team/decisionOpsRollup";
import { buildDecisionOpsRuntimeQualityGate } from "@/lib/team/decisionOpsRuntimeQualityGate";
import { buildDecisionOpsRuntimeStabilityGate } from "@/lib/team/decisionOpsRuntimeStabilityGate";
import { buildDecisionOpsSlo } from "@/lib/team/decisionOpsSlo";
import { buildDecisionOpsSparseCandidatePolicy } from "@/lib/team/decisionOpsSparseCandidatePolicy";
import { buildDecisionOpsSparseConfigGate } from "@/lib/team/decisionOpsSparseConfigGate";
import { buildDecisionOpsSparseExecution } from "@/lib/team/decisionOpsSparseExecution";
import { buildDecisionOpsSparseOperatorReport } from "@/lib/team/decisionOpsSparseOperatorReport";
import { buildDecisionOpsSparseReadiness } from "@/lib/team/decisionOpsSparseReadiness";
import { buildDecisionOpsSparseReleaseGate } from "@/lib/team/decisionOpsSparseReleaseGate";
import { buildDecisionOpsSparseRuntimePlan } from "@/lib/team/decisionOpsSparseRuntimePlan";
import { buildDecisionOpsSparseShadow } from "@/lib/team/decisionOpsSparseShadow";
import { buildDecisionOpsSparseShadowHistory } from "@/lib/team/decisionOpsSparseShadowHistory";
import { buildDecisionOpsSparseShadowTelemetry } from "@/lib/team/decisionOpsSparseShadowTelemetry";
import { buildDecisionOpsStability } from "@/lib/team/decisionOpsStability";
import { buildDecisionOpsModelQualityEvidence } from "@/lib/team/decisionOpsModelQualityEvidence";
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
  const includeMemoryLearning = url.searchParams.get("memoryLearning") === "1";
  const includeOpsSummary = url.searchParams.get("opsSummary") === "1";
  const includeSparseExecution = url.searchParams.get("sparseExecution") === "1";
  const includeSparseShadow = url.searchParams.get("sparseShadow") === "1";
  const includeSparseShadowHistory = url.searchParams.get("sparseShadowHistory") === "1";
  const includeSparseConfigGate = url.searchParams.get("sparseConfigGate") === "1";
  const includeSparseReadiness = url.searchParams.get("sparseReadiness") === "1";
  const includeSparseTelemetry = url.searchParams.get("sparseTelemetry") === "1";
  const includeSparseOperatorReport = url.searchParams.get("sparseOperatorReport") === "1";
  const includeSparseCandidatePolicy = url.searchParams.get("sparseCandidatePolicy") === "1";
  const includeSparseRuntimePlan = url.searchParams.get("sparseRuntimePlan") === "1";
  const includeSparseReleaseGate = url.searchParams.get("sparseReleaseGate") === "1";
  const includeResidentCoverage = url.searchParams.get("residentCoverage") === "1";
  const includeResidentVisibility = url.searchParams.get("residentVisibility") === "1";
  const includeRuntimeStabilityGate = url.searchParams.get("runtimeStabilityGate") === "1";
  const includeModelQualityEvidence = url.searchParams.get("modelQualityEvidence") === "1";
  const includeRuntimeQualityGate = url.searchParams.get("runtimeQualityGate") === "1";
  const includeQueuePriority = url.searchParams.get("queuePriority") === "1";
  const includeGlobalProgress = url.searchParams.get("globalProgress") === "1";
  const includeGlobalPrewarmPlan = url.searchParams.get("globalPrewarmPlan") === "1";
  const includeAutonomousRemediation = url.searchParams.get("autonomousRemediation") === "1";
  const includeResidentQueueCanary = url.searchParams.get("residentQueueCanary") === "1";
  const includeRoleDiversityGate = url.searchParams.get("roleDiversity") === "1";
  const includeMemoryProductizationGate = url.searchParams.get("memoryProductization") === "1";
  const includeGlobalAutonomy = url.searchParams.get("globalAutonomy") === "1";
  const includePublicBeta = url.searchParams.get("publicBeta") === "1";
  const residentPrewarmExecutorEnabled =
    process.env.OPS_RESIDENT_PREWARM_EXECUTOR_ENABLED?.toLowerCase() === "true";
  const residentPrewarmQueuePublishEnabled =
    process.env.OPS_RESIDENT_PREWARM_QUEUE_PUBLISH_ENABLED?.toLowerCase() === "true";
  const needsGlobalPrewarmPlan =
    includeGlobalPrewarmPlan || includeAutonomousRemediation || includeGlobalAutonomy;
  const needsAutonomousRemediation = includeAutonomousRemediation || includeGlobalAutonomy;
  const needsPublicBeta = includePublicBeta || includeGlobalAutonomy;
  const needsResidentQueueCanary =
    includeResidentQueueCanary || includeGlobalAutonomy || needsPublicBeta;
  const needsRoleDiversityGate = includeRoleDiversityGate || includeGlobalAutonomy;
  const needsMemoryProductizationGate = includeMemoryProductizationGate || includeGlobalAutonomy;
  const needsGlobalProgress =
    includeGlobalProgress || needsAutonomousRemediation || needsPublicBeta;
  const now = Date.now();
  const includeStability = url.searchParams.get("stability") === "1";
  const includeCausalRunbook = url.searchParams.get("causalRunbook") === "1";
  const includeAlertSnapshot = url.searchParams.get("alertSnapshot") === "1";
  const ledgerLimit =
    includeStability ||
    includeQualityBaseline ||
    includeResidentVisibility ||
    includeMemoryLearning ||
    includeRuntimeStabilityGate ||
    includeModelQualityEvidence ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
    needsGlobalPrewarmPlan ||
    needsResidentQueueCanary ||
    needsRoleDiversityGate ||
    needsMemoryProductizationGate ||
    includeCausalRunbook ||
    includeAlertSnapshot
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
    includeMemoryLearning ||
    needsGlobalProgress ||
    needsGlobalPrewarmPlan ||
    needsResidentQueueCanary ||
    needsRoleDiversityGate ||
    needsMemoryProductizationGate ||
    includeOpsSummary ||
    includeResidentCoverage ||
    includeResidentVisibility ||
    includeRuntimeStabilityGate ||
    includeModelQualityEvidence ||
    includeRuntimeQualityGate ||
    includeSparseExecution ||
    includeSparseShadow ||
    includeSparseShadowHistory ||
    includeSparseConfigGate ||
    includeSparseReadiness ||
    includeSparseTelemetry ||
    includeSparseOperatorReport ||
    includeSparseCandidatePolicy ||
    includeSparseRuntimePlan ||
    includeSparseReleaseGate ||
    includeStability;
  const detailLimit = normalizeDetailLimit(url.searchParams.get("detailLimit"));
  const [jobs, runs, decisionRecords] = await Promise.all([
    readPmDecisionJobs({ locale, limit: ledgerLimit }),
    readDecisionRuns({ locale, limit: ledgerLimit }),
    needsDecisionRecords ? readAllDecisionRecords(500, locale) : Promise.resolve([]),
  ]);
  const queueReadiness = getPmDecisionQueueReadiness();
  const queuePriority =
    includeQueuePriority || needsGlobalProgress || needsGlobalPrewarmPlan
      ? buildDecisionOpsQueuePriorityPolicy({
          jobs,
          now,
        })
      : null;
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
    includeResidentVisibility ||
    includeRuntimeStabilityGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
    needsGlobalPrewarmPlan ||
    needsResidentQueueCanary ||
    includeCausalRunbook ||
    includeAlertSnapshot
      ? publicPmEventsFromRecords(decisionRecords)
      : [];
  const residentQueueCanary = needsResidentQueueCanary
    ? buildDecisionOpsResidentQueueCanary({
        jobs,
        runs,
        publicEvents,
        now,
      })
    : null;
  const providerTelemetry =
    includeDeepDiagnostics ||
    includeRollup ||
    includeQualityGate ||
    includeModelQuality ||
    includeQualityBaseline ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary ||
    includeModelQualityEvidence ||
    includeRuntimeQualityGate ||
    needsGlobalProgress
      ? summarizeProviderTelemetry({ since: Date.now() - 24 * 60_000 })
      : null;
  const residentPrewarm =
    includeFreshness ||
    includeRollup ||
    includeCausalRunbook ||
    includeAlertSnapshot ||
    includeOpsSummary ||
    includeResidentCoverage ||
    includeRuntimeStabilityGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
    needsGlobalPrewarmPlan
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
    includeModelQualityEvidence ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
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
    includeModelQualityEvidence ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
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
    needsAutonomousRemediation ||
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
    needsAutonomousRemediation ||
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
      needsAutonomousRemediation ||
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
    (includeRecovery ||
      needsAutonomousRemediation ||
      includeCausalRunbook ||
      includeAlertSnapshot ||
      includeOpsSummary) &&
    runbook &&
    cronAudit
      ? buildDecisionOpsQueueRecoveryPolicy({
          runbook,
          cronAudit,
          health,
        })
      : null;
  const modelQuality =
    (includeModelQuality ||
      includeModelQualityEvidence ||
      includeRuntimeQualityGate ||
      needsGlobalProgress ||
      includeCausalRunbook ||
      includeAlertSnapshot ||
      includeOpsSummary) &&
    qualityGate &&
    deepDiagnostics
      ? buildDecisionOpsModelQuality({
          qualityGate,
          deepDiagnostics,
        })
      : null;
  const qualityBaseline =
    includeQualityBaseline ||
    includeModelQualityEvidence ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
    includeCausalRunbook ||
    includeAlertSnapshot
      ? buildDecisionOpsQualityBaseline({
          runs,
          records: decisionRecords,
          providerTelemetry,
        })
      : null;
  const outputStability =
    includeOutputStability ||
    includeRuntimeStabilityGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
    needsAutonomousRemediation ||
    includeCausalRunbook ||
    includeAlertSnapshot
      ? buildDecisionOpsPublicOutputStability({
          publicEvents,
        })
      : null;
  const residentVisibility =
    includeResidentVisibility ||
    includeRuntimeStabilityGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress ||
    needsGlobalPrewarmPlan
      ? buildDecisionOpsResidentPublicVisibility({
          publicEvents,
          now,
        })
      : null;
  const residentCoverage =
    (includeResidentCoverage ||
      includeRuntimeStabilityGate ||
      includeRuntimeQualityGate ||
      needsGlobalProgress ||
      needsGlobalPrewarmPlan) &&
    residentPrewarm
      ? buildDecisionOpsResidentPrewarmCoverage({
          residentStatus: residentPrewarm,
        })
      : null;
  const runtimeStabilityGate =
    (includeRuntimeStabilityGate || includeRuntimeQualityGate) &&
    residentCoverage &&
    outputStability
      ? buildDecisionOpsRuntimeStabilityGate({
          residentCoverage,
          residentPublicVisibility: residentVisibility ?? undefined,
          outputStability,
        })
      : null;
  const globalProgressRuntimeStability =
    needsGlobalProgress && residentCoverage && outputStability
      ? buildDecisionOpsRuntimeStabilityGate({
          residentCoverage,
          residentPublicVisibility: residentVisibility ?? undefined,
          outputStability,
        })
      : runtimeStabilityGate;
  const modelQualityEvidence =
    (includeModelQualityEvidence || includeRuntimeQualityGate) && qualityBaseline && modelQuality
      ? buildDecisionOpsModelQualityEvidence({
          qualityBaseline,
          modelQuality,
        })
      : null;
  const lifecycle =
    includeLifecycle || includeOpsSummary
      ? buildDecisionOpsLifecycleDiagnostics({
          records: decisionRecords,
        })
      : null;
  const memoryLearning =
    includeMemoryLearning || needsGlobalProgress || needsMemoryProductizationGate
      ? buildDecisionOpsMemoryLearning({
          records: decisionRecords,
          now,
        })
      : null;
  const globalPrewarmPlan =
    needsGlobalPrewarmPlan && residentPrewarm && residentVisibility && queuePriority
      ? buildDecisionOpsGlobalPrewarmPlan({
          residentStatus: residentPrewarm,
          residentVisibility,
          queuePriority,
          locale,
          now,
        })
      : null;
  const roleDiversityGate = needsRoleDiversityGate
    ? buildDecisionOpsRoleDiversityGate({
        records: decisionRecords,
        now,
      })
    : null;
  const memoryProductizationGate =
    needsMemoryProductizationGate && memoryLearning
      ? buildDecisionOpsMemoryProductizationGate({
          memoryLearning,
          records: decisionRecords,
          now,
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
  const needsSparseTelemetry =
    includeSparseTelemetry ||
    includeSparseOperatorReport ||
    includeSparseCandidatePolicy ||
    includeSparseRuntimePlan ||
    includeSparseReleaseGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress;
  const needsSparseReadiness =
    includeSparseReadiness ||
    includeSparseOperatorReport ||
    includeSparseRuntimePlan ||
    includeSparseReleaseGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress;
  const needsSparseConfigGate =
    includeSparseConfigGate ||
    includeSparseReadiness ||
    includeSparseRuntimePlan ||
    includeSparseReleaseGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress;
  const needsSparseShadowHistory =
    includeSparseShadowHistory || needsSparseConfigGate || needsSparseReadiness;
  const needsSparseShadow = includeSparseShadow || needsSparseTelemetry || needsSparseReadiness;
  const needsSparseExecution = includeSparseExecution || needsSparseShadow || needsSparseReadiness;
  const sparseExecutionSource = needsSparseExecution
    ? buildDecisionOpsSparseExecution({
        records: decisionRecords,
      })
    : null;
  const sparseExecution = includeSparseExecution ? sparseExecutionSource : null;
  const sparseShadowSource = needsSparseShadow
    ? buildDecisionOpsSparseShadow({
        records: decisionRecords,
      })
    : null;
  const sparseShadow = includeSparseShadow ? sparseShadowSource : null;
  const sparseShadowHistorySource = needsSparseShadowHistory
    ? buildDecisionOpsSparseShadowHistory({
        records: decisionRecords,
      })
    : null;
  const sparseShadowHistory = includeSparseShadowHistory ? sparseShadowHistorySource : null;
  const sparseConfigGateSource = needsSparseConfigGate
    ? buildDecisionOpsSparseConfigGate({
        sparseShadowHistory: sparseShadowHistorySource!,
        env: process.env,
      })
    : null;
  const sparseConfigGate = includeSparseConfigGate ? sparseConfigGateSource : null;
  const sparseReadinessSource = needsSparseReadiness
    ? buildDecisionOpsSparseReadiness({
        sparseExecution: sparseExecutionSource!,
        sparseShadow: sparseShadowSource!,
        sparseShadowHistory: sparseShadowHistorySource!,
        sparseConfigGate: sparseConfigGateSource!,
      })
    : null;
  const sparseReadiness = includeSparseReadiness ? sparseReadinessSource : null;
  const sparseTelemetrySource = needsSparseTelemetry
    ? buildDecisionOpsSparseShadowTelemetry({
        records: decisionRecords,
        sparseShadow: sparseShadowSource!,
      })
    : null;
  const sparseTelemetry = includeSparseTelemetry ? sparseTelemetrySource : null;
  const sparseOperatorReportSource =
    includeSparseOperatorReport ||
    includeSparseReleaseGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress
      ? buildDecisionOpsSparseOperatorReport({
          sparseReadiness: sparseReadinessSource!,
          sparseTelemetry: sparseTelemetrySource!,
        })
      : null;
  const sparseOperatorReport = includeSparseOperatorReport ? sparseOperatorReportSource : null;
  const sparseCandidatePolicySource =
    includeSparseCandidatePolicy ||
    includeSparseRuntimePlan ||
    includeSparseReleaseGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress
      ? buildDecisionOpsSparseCandidatePolicy({
          sparseTelemetry: sparseTelemetrySource!,
        })
      : null;
  const sparseCandidatePolicy = includeSparseCandidatePolicy ? sparseCandidatePolicySource : null;
  const sparseRuntimePlanSource =
    includeSparseRuntimePlan ||
    includeSparseReleaseGate ||
    includeRuntimeQualityGate ||
    needsGlobalProgress
      ? buildDecisionOpsSparseRuntimePlan({
          sparseReadiness: sparseReadinessSource!,
          sparseConfigGate: sparseConfigGateSource!,
          sparseCandidatePolicy: sparseCandidatePolicySource!,
        })
      : null;
  const sparseRuntimePlan = includeSparseRuntimePlan ? sparseRuntimePlanSource : null;
  const sparseReleaseGate = includeSparseReleaseGate
    ? buildDecisionOpsSparseReleaseGate({
        sparseOperatorReport: sparseOperatorReportSource!,
        sparseTelemetry: sparseTelemetrySource!,
        sparseCandidatePolicy: sparseCandidatePolicySource!,
        sparseRuntimePlan: sparseRuntimePlanSource!,
      })
    : null;
  const runtimeQualityGate =
    includeRuntimeQualityGate && runtimeStabilityGate && modelQualityEvidence
      ? buildDecisionOpsRuntimeQualityGate({
          runtimeStability: runtimeStabilityGate,
          modelQualityEvidence,
          sparseReleaseGate:
            sparseReleaseGate ??
            buildDecisionOpsSparseReleaseGate({
              sparseOperatorReport: sparseOperatorReportSource!,
              sparseTelemetry: sparseTelemetrySource!,
              sparseCandidatePolicy: sparseCandidatePolicySource!,
              sparseRuntimePlan: sparseRuntimePlanSource!,
            }),
        })
      : null;
  const globalProgressModelQualityEvidence =
    needsGlobalProgress && qualityBaseline && modelQuality
      ? buildDecisionOpsModelQualityEvidence({
          qualityBaseline,
          modelQuality,
        })
      : modelQualityEvidence;
  const globalProgressRuntimeQualityGate =
    needsGlobalProgress && globalProgressRuntimeStability && globalProgressModelQualityEvidence
      ? buildDecisionOpsRuntimeQualityGate({
          runtimeStability: globalProgressRuntimeStability,
          modelQualityEvidence: globalProgressModelQualityEvidence,
          sparseReleaseGate:
            sparseReleaseGate ??
            buildDecisionOpsSparseReleaseGate({
              sparseOperatorReport: sparseOperatorReportSource!,
              sparseTelemetry: sparseTelemetrySource!,
              sparseCandidatePolicy: sparseCandidatePolicySource!,
              sparseRuntimePlan: sparseRuntimePlanSource!,
            }),
        })
      : runtimeQualityGate;
  const globalProgress =
    needsGlobalProgress &&
    residentCoverage &&
    residentVisibility &&
    queuePriority &&
    globalProgressRuntimeQualityGate &&
    memoryLearning
      ? buildDecisionOpsGlobalProgressGate({
          residentCoverage,
          residentVisibility,
          queuePriority,
          runtimeQualityGate: globalProgressRuntimeQualityGate,
          memoryLearning,
        })
      : null;
  const autonomousRemediation =
    needsAutonomousRemediation &&
    globalProgress &&
    globalPrewarmPlan &&
    recoveryPolicy &&
    outputStability
      ? buildDecisionOpsAutonomousRemediation({
          globalProgress,
          globalPrewarmPlan,
          queueRecoveryPolicy: recoveryPolicy,
          outputStability,
          residentPrewarmExecutor: {
            executorEnabled: residentPrewarmExecutorEnabled,
            queuePublishEnabled: residentPrewarmQueuePublishEnabled,
            queueReady: queueReadiness.enabled,
          },
          now,
        })
      : null;
  const publicAnalysisBetaGate =
    needsPublicBeta &&
    globalProgress &&
    residentQueueCanary &&
    qualityGate &&
    globalProgressRuntimeQualityGate &&
    memoryLearning
      ? buildDecisionOpsPublicAnalysisBetaGate({
          globalProgress,
          residentQueueCanary,
          qualityGate,
          runtimeQualityGate: globalProgressRuntimeQualityGate,
          memoryLearning,
          feedbackCaptureReady: true,
          costPolicy: {
            queuePublishExplicitOptIn: true,
            maxVisitResidentJobs: 1,
            maxVisitSymbolJobs: 3,
          },
          now,
        })
      : null;

  return NextResponse.json(
    {
      ok: true,
      locale,
      health,
      queueReadiness,
      ...(includeQueuePriority
        ? {
            queuePriority,
          }
        : {}),
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
      ...(includeMemoryLearning
        ? {
            memoryLearning,
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
      ...(includeSparseShadow
        ? {
            sparseShadow,
          }
        : {}),
      ...(includeSparseShadowHistory
        ? {
            sparseShadowHistory,
          }
        : {}),
      ...(includeSparseConfigGate
        ? {
            sparseConfigGate,
          }
        : {}),
      ...(includeSparseReadiness
        ? {
            sparseReadiness,
          }
        : {}),
      ...(includeSparseTelemetry
        ? {
            sparseTelemetry,
          }
        : {}),
      ...(includeSparseOperatorReport
        ? {
            sparseOperatorReport,
          }
        : {}),
      ...(includeSparseCandidatePolicy
        ? {
            sparseCandidatePolicy,
          }
        : {}),
      ...(includeSparseRuntimePlan
        ? {
            sparseRuntimePlan,
          }
        : {}),
      ...(includeSparseReleaseGate
        ? {
            sparseReleaseGate,
          }
        : {}),
      ...(includeResidentCoverage
        ? {
            residentCoverage,
          }
        : {}),
      ...(includeResidentVisibility
        ? {
            residentVisibility,
          }
        : {}),
      ...(includeResidentQueueCanary
        ? {
            residentQueueCanary,
          }
        : {}),
      ...(includeRuntimeStabilityGate
        ? {
            runtimeStabilityGate,
          }
        : {}),
      ...(includeModelQualityEvidence
        ? {
            modelQualityEvidence,
          }
        : {}),
      ...(includeRuntimeQualityGate
        ? {
            runtimeQualityGate,
          }
        : {}),
      ...(includeGlobalProgress
        ? {
            globalProgress,
          }
        : {}),
      ...(includeGlobalPrewarmPlan
        ? {
            globalPrewarmPlan,
          }
        : {}),
      ...(includeAutonomousRemediation
        ? {
            autonomousRemediation,
          }
        : {}),
      ...(includeRoleDiversityGate
        ? {
            roleDiversityGate,
          }
        : {}),
      ...(includeMemoryProductizationGate
        ? {
            memoryProductizationGate,
          }
        : {}),
      ...(includePublicBeta
        ? {
            publicAnalysisBetaGate,
          }
        : {}),
      ...(includeGlobalAutonomy
        ? {
            globalAutonomy: {
              globalProgress,
              globalPrewarmPlan,
              residentQueueCanary,
              autonomousRemediation,
              roleDiversityGate,
              memoryProductizationGate,
              publicAnalysisBetaGate,
            },
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
