import posthog from "posthog-js";
import { apiPath } from "@/lib/basePath";

export const ANALYTICS_EVENTS = [
  "page_view",
  "hero_cta_copy",
  "hero_api_docs_click",
  "hero_agent_watch_click",
  "hero_coin_watch_click",
  "quick_start_copy",
  "daily_prompt_copy",
  "daily_cta_copy",
  "locale_dropdown_open",
  "locale_select",
  "skill_card_click",
  "back_to_top_click",
  "news_debate_view",
  "news_debate_original_click",
  "news_debate_strategy_follow_click",
  "news_debate_share_open",
  "news_debate_share_copy",
  "news_feed_ticker_click",
  "agent_mini_card_click",
  "strategy_replay_view",
  "replay_page_view",
  "news_fetched",
  "news_source_failed",
  "news_normalizer_run",
  "news_quota_alert",
  "strategy_synthesis_failed",
  "strategy_feedback",
  "strategy_followed_self_reported",
  "strategy_skipped_self_reported",
  "chat_thread_view",
  "chat_message_action",
  "watch_track_wall_view",
  "watch_topic_feedback",
  "team_member_card_click",
  "workflow_panel_view",
  "workflow_node_status_change",
  "process_accordion_collapse",
  "process_accordion_expand",
  "pipeline_replay_trigger",
  "coinw_trade_cta_click",
  "coinw_intent_created",
  "coinw_handoff_opened",
  "coinw_handoff_callback_confirmed",
  "coinw_handoff_callback_rejected",
  "coinw_handoff_callback_expired",
  "coinw_handoff_callback_cancelled",
  "coinw_order_submit_error",
  "coinw_gate_rollback",
  "trade_readiness_state_rendered",
  "claw42_external_entry",
  "claw42_landing_rendered",
  "claw42_stage_viewed",
  "claw42_card_expanded",
  "claw42_dwell_check",
  "claw42_session_end",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

interface AnalyticsPayload {
  event: AnalyticsEventName;
  properties: AnalyticsProperties;
  context: {
    path: string;
    referrer?: string;
    viewport?: string;
    language?: string;
    utm?: AnalyticsProperties;
    landing_id?: string | null;
    from?: string;
    sig_valid?: boolean;
  };
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

let posthogInited = false;
let landingAnalyticsContext: Pick<
  AnalyticsPayload["context"],
  "landing_id" | "from" | "sig_valid"
> = {};

export function setAnalyticsLandingContext(
  context: Pick<AnalyticsPayload["context"], "landing_id" | "from" | "sig_valid">,
) {
  landingAnalyticsContext = {
    landing_id: context.landing_id ?? null,
    from: context.from,
    sig_valid: context.sig_valid,
  };
}

function ensurePosthog() {
  if (posthogInited || typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    autocapture: false,
    capture_pageview: false,
  });
  posthogInited = true;
}

function capturePosthog(event: AnalyticsEventName, properties: AnalyticsProperties) {
  try {
    ensurePosthog();
    if (posthogInited) posthog.capture(event, properties);
  } catch {
    // Analytics must never interrupt the user journey.
  }
}

function getSafeReferrer() {
  if (!document.referrer) return undefined;

  try {
    const url = new URL(document.referrer);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function getUtmProperties(): AnalyticsProperties | undefined {
  const params = new URLSearchParams(window.location.search);
  const utm: AnalyticsProperties = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) utm[key] = value.slice(0, 120);
  }

  return Object.keys(utm).length > 0 ? utm : undefined;
}

function buildPayload(
  event: AnalyticsEventName,
  properties: AnalyticsProperties,
): AnalyticsPayload {
  return {
    event,
    properties,
    context: {
      path: window.location.pathname,
      referrer: getSafeReferrer(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      utm: getUtmProperties(),
      ...landingAnalyticsContext,
    },
  };
}

function landingContextProperties(): AnalyticsProperties {
  return Object.fromEntries(
    Object.entries(landingAnalyticsContext).filter(([, value]) => value !== undefined),
  ) as AnalyticsProperties;
}

export function trackEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(buildPayload(event, properties));
  const endpoint = apiPath("/api/analytics");
  capturePosthog(event, { ...landingContextProperties(), ...properties });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3000);

  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    signal: controller.signal,
  })
    .catch(() => {
      // Analytics must never interrupt the user journey.
    })
    .finally(() => window.clearTimeout(timeoutId));
}
