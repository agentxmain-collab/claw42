import { describe, expect, it } from "vitest";
import {
  buildDecisionOpsResidentPrewarmCoverage,
  type DecisionOpsResidentPrewarmCoverageReport,
} from "@/lib/team/decisionOpsResidentPrewarmCoverage";
import type {
  ResidentPrewarmKind,
  ResidentPrewarmKindStatus,
  ResidentPrewarmStatus,
} from "@/lib/watch/residentPrewarmStatus";

const now = Date.parse("2026-05-19T12:00:00.000Z");

function kindStatus(
  kind: ResidentPrewarmKind,
  overrides: Partial<ResidentPrewarmKindStatus> = {},
): ResidentPrewarmKindStatus {
  return {
    kind,
    state: "ready",
    slaState: "healthy",
    stale: false,
    ageMs: 60 * 60_000,
    expectedIntervalMs: 3 * 60 * 60_000,
    staleAfterMs: 6 * 60 * 60_000,
    lastSucceededAt: "2026-05-19T11:00:00.000Z",
    lastAttemptAt: "2026-05-19T11:00:00.000Z",
    nextRunAt: null,
    lastError: null,
    jobId: null,
    candidateKey:
      kind === "market_overview"
        ? "market_overview:utc:zh_CN:2026-05-19T09"
        : "hotspot:utc:zh_CN:2026-05-19T09:market",
    ...overrides,
  };
}

function residentStatus(overrides: Partial<ResidentPrewarmStatus> = {}): ResidentPrewarmStatus {
  const marketOverview = kindStatus("market_overview");
  const hotspot = kindStatus("hotspot");
  return {
    schemaVersion: 1,
    servedAt: now,
    overallState: "ready",
    slaState: "healthy",
    latestSucceededAt: "2026-05-19T11:00:00.000Z",
    marketOverview,
    hotspot,
    ...overrides,
  };
}

describe("buildDecisionOpsResidentPrewarmCoverage", () => {
  it("marks the global resident lanes ready when market and hotspot are fresh", () => {
    const report = buildDecisionOpsResidentPrewarmCoverage({
      residentStatus: residentStatus(),
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      allGlobalLanesCovered: true,
      utcPolicy: {
        clock: "UTC",
        marketOverviewIntervalHours: 3,
        hotspotIntervalHours: 3,
        hotspotBurstWindowHours: 1,
        hotspotBurstScoreThreshold: 130,
      },
      lanes: {
        marketOverview: expect.objectContaining({
          required: true,
          ready: true,
          state: "ready",
        }),
        hotspot: expect.objectContaining({
          required: true,
          ready: true,
          state: "ready",
        }),
      },
      blockingReasons: [],
    } satisfies Partial<DecisionOpsResidentPrewarmCoverageReport>);
  });

  it("blocks when a required global lane is missing", () => {
    const report = buildDecisionOpsResidentPrewarmCoverage({
      residentStatus: residentStatus({
        overallState: "ready",
        slaState: "critical",
        marketOverview: kindStatus("market_overview", {
          state: "empty",
          slaState: "critical",
          ageMs: null,
          lastSucceededAt: null,
          candidateKey: null,
        }),
      }),
      now,
    });

    expect(report).toMatchObject({
      status: "critical",
      allGlobalLanesCovered: false,
      blockingReasons: ["resident_market_overview_missing"],
      lanes: {
        marketOverview: expect.objectContaining({
          ready: false,
          issue: "missing",
        }),
      },
    });
  });

  it("treats a lane past its UTC cadence as degraded before the 2x stale window", () => {
    const report = buildDecisionOpsResidentPrewarmCoverage({
      residentStatus: residentStatus({
        overallState: "ready",
        slaState: "degraded",
        hotspot: kindStatus("hotspot", {
          slaState: "degraded",
          ageMs: 4 * 60 * 60_000,
          expectedIntervalMs: 3 * 60 * 60_000,
          stale: false,
        }),
      }),
      now,
    });

    expect(report).toMatchObject({
      status: "degraded",
      allGlobalLanesCovered: true,
      blockingReasons: ["resident_hotspot_cadence_late"],
      lanes: {
        hotspot: expect.objectContaining({
          ready: false,
          issue: "cadence_late",
        }),
      },
    });
  });
});
