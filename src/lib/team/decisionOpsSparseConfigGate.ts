import type { DecisionOpsSparseShadowHistoryReport } from "@/lib/team/decisionOpsSparseShadowHistory";

export type DecisionOpsSparseFanoutMode = "off" | "shadow";

export type DecisionOpsSparseConfigGateStatus = "disabled" | "blocked_by_history" | "shadow_ready";

export interface DecisionOpsSparseConfigIssue {
  name: "CLAW42_SPARSE_FANOUT_MODE";
  severity: "warning";
  message: string;
}

export interface DecisionOpsSparseConfigGateRecommendation {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsSparseConfigGateReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsSparseConfigGateStatus;
  configuredMode: DecisionOpsSparseFanoutMode;
  safeToEnableShadow: boolean;
  configGateOpen: boolean;
  sourceHistoryStatus: DecisionOpsSparseShadowHistoryReport["status"];
  runtimeEffect: {
    executionMode: "diagnostics_only";
    liveFanoutChangeAllowed: false;
    publicBehaviorChangeAllowed: false;
  };
  blockingReasons: string[];
  configIssues: DecisionOpsSparseConfigIssue[];
  recommendations: DecisionOpsSparseConfigGateRecommendation[];
}

const MODE_ENV = "CLAW42_SPARSE_FANOUT_MODE";

export function buildDecisionOpsSparseConfigGate({
  sparseShadowHistory,
  env,
  now = Date.now(),
}: {
  sparseShadowHistory: DecisionOpsSparseShadowHistoryReport;
  env: Record<string, string | undefined>;
  now?: number;
}): DecisionOpsSparseConfigGateReport {
  const parsedMode = parseMode(env[MODE_ENV]);
  const safeToEnableShadow = sparseShadowHistory.safeToPrepareConfigGate;
  const blockingReasons = safeToEnableShadow ? [] : ["sparse_shadow_history_not_ready"];
  const status = statusFor({
    configuredMode: parsedMode.mode,
    safeToEnableShadow,
    configIssues: parsedMode.issues,
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status,
    configuredMode: parsedMode.mode,
    safeToEnableShadow,
    configGateOpen: status === "shadow_ready",
    sourceHistoryStatus: sparseShadowHistory.status,
    runtimeEffect: {
      executionMode: "diagnostics_only",
      liveFanoutChangeAllowed: false,
      publicBehaviorChangeAllowed: false,
    },
    blockingReasons,
    configIssues: parsedMode.issues,
    recommendations: recommendationsFor({
      status,
      safeToEnableShadow,
    }),
  };
}

function parseMode(value: string | undefined): {
  mode: DecisionOpsSparseFanoutMode;
  issues: DecisionOpsSparseConfigIssue[];
} {
  if (!value || value === "off") {
    return {
      mode: "off",
      issues: [],
    };
  }
  if (value === "shadow") {
    return {
      mode: "shadow",
      issues: [],
    };
  }
  return {
    mode: "off",
    issues: [
      {
        name: MODE_ENV,
        severity: "warning",
        message: `Unknown ${MODE_ENV} value ignored; sparse fan-out remains off.`,
      },
    ],
  };
}

function statusFor({
  configuredMode,
  safeToEnableShadow,
  configIssues,
}: {
  configuredMode: DecisionOpsSparseFanoutMode;
  safeToEnableShadow: boolean;
  configIssues: readonly DecisionOpsSparseConfigIssue[];
}): DecisionOpsSparseConfigGateStatus {
  if (configuredMode === "off" || configIssues.length > 0) return "disabled";
  if (!safeToEnableShadow) return "blocked_by_history";
  return "shadow_ready";
}

function recommendationsFor({
  status,
  safeToEnableShadow,
}: {
  status: DecisionOpsSparseConfigGateStatus;
  safeToEnableShadow: boolean;
}): DecisionOpsSparseConfigGateRecommendation[] {
  if (status === "shadow_ready") {
    return [
      {
        title: "Wire shadow telemetry before changing PM fan-out",
        description:
          "The config gate is open only for diagnostics. Live role execution must remain full fan-out until a later telemetry-backed implementation is reviewed.",
        executable: false,
      },
    ];
  }
  if (!safeToEnableShadow) {
    return [
      {
        title: "Keep sparse fan-out config disabled",
        description: "Recent sparse shadow history is not safe enough for a shadow runtime gate.",
        executable: false,
      },
    ];
  }
  return [
    {
      title: "Sparse fan-out config is intentionally off",
      description:
        "Set CLAW42_SPARSE_FANOUT_MODE=shadow only after reviewing ops-only sparse shadow history on live records.",
      executable: false,
    },
  ];
}
