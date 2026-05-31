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

const LEGACY_TIMELINE_COMMANDS_PER_VIEWER = 28;
const LEGACY_FOLLOW_STATS_COMMANDS_PER_VIEWER = 30;
const LEGACY_SSE_COMMANDS_PER_VIEWER = 2;
const SNAPSHOT_READ_COMMANDS_PER_CACHE_MISS = 2;
const SNAPSHOT_WRITE_COMMANDS_PER_WRITE = 45;

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
