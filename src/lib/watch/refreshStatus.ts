export const WATCH_REFRESH_STATUSES = [
  "cached",
  "stale",
  "refreshing",
  "locked",
  "no_signal",
] as const;

export type WatchRefreshStatus = (typeof WATCH_REFRESH_STATUSES)[number];
