const LEGACY_TIMELINE_COMMANDS_PER_VIEWER = 28;
const LEGACY_FOLLOW_STATS_COMMANDS_PER_VIEWER = 30;
const LEGACY_SSE_COMMANDS_PER_VIEWER = 2;
const SNAPSHOT_READ_COMMANDS_PER_CACHE_MISS = 2;
const SNAPSHOT_WRITE_COMMANDS_PER_WRITE = 45;

function estimate({ viewerCount, cacheMissesPerMinute = 1, snapshotWritesPerMinute = 1 }) {
  return {
    viewers: viewerCount,
    legacyKvCommandsPerMinute:
      viewerCount *
      (LEGACY_TIMELINE_COMMANDS_PER_VIEWER +
        LEGACY_FOLLOW_STATS_COMMANDS_PER_VIEWER +
        LEGACY_SSE_COMMANDS_PER_VIEWER),
    snapshotKvCommandsPerMinute:
      cacheMissesPerMinute * SNAPSHOT_READ_COMMANDS_PER_CACHE_MISS +
      snapshotWritesPerMinute * SNAPSHOT_WRITE_COMMANDS_PER_WRITE,
  };
}

const viewers = process.argv.slice(2).map((value) => Number(value)).filter(Number.isFinite);
const samples = viewers.length > 0 ? viewers : [1, 50, 500, 5000];

console.table(samples.map((viewerCount) => estimate({ viewerCount })));
