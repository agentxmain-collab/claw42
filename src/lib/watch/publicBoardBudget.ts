export interface PublicBoardTrafficBudgetInput {
  viewerCount: number;
  cacheMissesPerMinute: number;
  snapshotWritesPerMinute: number;
}

export interface PublicBoardTrafficBudgetEstimate {
  legacy: {
    timelineKvCommandsPerViewer: number;
    followStatsKvCommandsPerViewer: number;
    sseKvCommandsPerViewer: number;
    kvCommandsPerMinute: number;
  };
  snapshot: {
    snapshotReadKvCommandsPerCacheMiss: number;
    snapshotWriteKvCommandsPerWrite: number;
    kvCommandsPerMinute: number;
  };
}

export interface PublicBoardHardStopMonthlyBudgetEstimate {
  pieces: {
    timelineCanonicalReads: number;
    timelineSnapshotRebuilds: number;
    publicCardWrites: number;
    lowFrequencyPrune: number;
    miscPublicEndpoints: number;
  };
  total: number;
  planLimit: number;
}

const LEGACY_TIMELINE_COMMANDS_PER_VIEWER = 28;
const LEGACY_FOLLOW_STATS_COMMANDS_PER_VIEWER = 30;
const LEGACY_SSE_COMMANDS_PER_VIEWER = 2;
const SNAPSHOT_READ_COMMANDS_PER_CACHE_MISS = 2;
const SNAPSHOT_WRITE_COMMANDS_PER_WRITE = 45;
const HARDSTOP_MONTHLY_PLAN_LIMIT = 500_000;
const HARDSTOP_TIMELINE_CANONICAL_READS = 115_200;
const HARDSTOP_TIMELINE_SNAPSHOT_REBUILDS = 199_440;
const HARDSTOP_PUBLIC_CARD_WRITES = 12_000;
const HARDSTOP_LOW_FREQUENCY_PRUNE = 30_000;
const HARDSTOP_MISC_PUBLIC_ENDPOINTS = 60_000;

export function estimatePublicBoardTrafficBudget({
  viewerCount,
  cacheMissesPerMinute,
  snapshotWritesPerMinute,
}: PublicBoardTrafficBudgetInput): PublicBoardTrafficBudgetEstimate {
  const normalizedViewerCount = Math.max(0, Math.floor(viewerCount));
  const normalizedCacheMisses = Math.max(0, cacheMissesPerMinute);
  const normalizedSnapshotWrites = Math.max(0, snapshotWritesPerMinute);

  return {
    legacy: {
      timelineKvCommandsPerViewer: LEGACY_TIMELINE_COMMANDS_PER_VIEWER,
      followStatsKvCommandsPerViewer: LEGACY_FOLLOW_STATS_COMMANDS_PER_VIEWER,
      sseKvCommandsPerViewer: LEGACY_SSE_COMMANDS_PER_VIEWER,
      kvCommandsPerMinute:
        normalizedViewerCount *
        (LEGACY_TIMELINE_COMMANDS_PER_VIEWER +
          LEGACY_FOLLOW_STATS_COMMANDS_PER_VIEWER +
          LEGACY_SSE_COMMANDS_PER_VIEWER),
    },
    snapshot: {
      snapshotReadKvCommandsPerCacheMiss: SNAPSHOT_READ_COMMANDS_PER_CACHE_MISS,
      snapshotWriteKvCommandsPerWrite: SNAPSHOT_WRITE_COMMANDS_PER_WRITE,
      kvCommandsPerMinute:
        normalizedCacheMisses * SNAPSHOT_READ_COMMANDS_PER_CACHE_MISS +
        normalizedSnapshotWrites * SNAPSHOT_WRITE_COMMANDS_PER_WRITE,
    },
  };
}

export function estimatePublicBoardHardStopMonthlyBudget(): PublicBoardHardStopMonthlyBudgetEstimate {
  const pieces = {
    timelineCanonicalReads: HARDSTOP_TIMELINE_CANONICAL_READS,
    timelineSnapshotRebuilds: HARDSTOP_TIMELINE_SNAPSHOT_REBUILDS,
    publicCardWrites: HARDSTOP_PUBLIC_CARD_WRITES,
    lowFrequencyPrune: HARDSTOP_LOW_FREQUENCY_PRUNE,
    miscPublicEndpoints: HARDSTOP_MISC_PUBLIC_ENDPOINTS,
  };
  return {
    pieces,
    total: Object.values(pieces).reduce((sum, value) => sum + value, 0),
    planLimit: HARDSTOP_MONTHLY_PLAN_LIMIT,
  };
}
