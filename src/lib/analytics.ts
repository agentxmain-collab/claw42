import posthog from "posthog-js";

export const ANALYTICS_EVENTS = [
  "page_view",
  "hero_cta_copy",
  "hero_api_docs_click",
  "quick_start_copy",
  "daily_prompt_copy",
  "daily_cta_copy",
  "locale_dropdown_open",
  "locale_select",
  "skill_card_click",
  "back_to_top_click",
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
  };
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

let posthogInited = false;

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

function capturePosthog(
  event: AnalyticsEventName,
  properties: AnalyticsProperties
) {
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
  properties: AnalyticsProperties
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
    },
  };
}

export function trackEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {}
) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(buildPayload(event, properties));
  capturePosthog(event, properties);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/analytics", blob)) return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3000);

  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    signal: controller.signal,
  }).catch(() => {
    // Analytics must never interrupt the user journey.
  }).finally(() => window.clearTimeout(timeoutId));
}
