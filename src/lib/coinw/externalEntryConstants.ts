export const EXTERNAL_ENTRY_SIG_TTL_SEC = 300;
export const EXTERNAL_ENTRY_FROM_MAX_LENGTH = 100;
export const SYMBOL_SNAPSHOT_RATE_LIMIT_QPS = 10;
export const SYMBOL_SNAPSHOT_CACHE_TTL_SEC = 300;
export const PUSH_WEBHOOK_FREQUENCY_WINDOW_SEC = 60 * 60 * 24;
export const PUSH_WEBHOOK_RETRY_COUNT = 3;
export const TASK_PROGRESS_IDEMPOTENCY_TTL_SEC = 60 * 60 * 24 * 365;
export const TASK_PROGRESS_RETRY_COUNT = 3;
export const LANDING_SESSION_COOKIE_NAME = "claw42_session_id";
export const LANDING_SESSION_COOKIE_TTL_SEC = 60 * 60 * 24 * 30;
export const WEBHOOK_REQUEST_ID_HEADER = "X-Request-Id";

export const EXTERNAL_ENTRY_KNOWN_FROMS = [
  "futures_fab",
  "symbol_detail_card",
  "positions_inline",
  "copy_trading_tab",
  "push_position_signal",
  "push_loss_review",
  "rewards_newuser_task",
  "academy_tutorial",
] as const;

export type ExternalEntryFrom = (typeof EXTERNAL_ENTRY_KNOWN_FROMS)[number];

export const COINW_IFRAME_ORIGIN_WHITELIST = [
  "https://www.coinw.com",
  "https://*.coinw.com",
] as const;

export const COINW_IFRAME_PARENT_ORIGINS = COINW_IFRAME_ORIGIN_WHITELIST;

export function isExternalEntryFrom(value: string): value is ExternalEntryFrom {
  return (EXTERNAL_ENTRY_KNOWN_FROMS as readonly string[]).includes(value);
}
