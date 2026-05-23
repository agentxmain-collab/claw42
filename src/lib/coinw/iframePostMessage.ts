import { COINW_IFRAME_PARENT_ORIGINS } from "./externalEntryConstants";

export type IframePostMessageEvent =
  | "claw42_embed_ready"
  | "claw42_embed_close"
  | "claw42_embed_error";

export interface IframePostMessagePayload {
  type: IframePostMessageEvent;
  landingId?: string | null;
  reason?: string;
}

export function getValidParentOrigin({
  referrer,
  allowedOrigins = COINW_IFRAME_PARENT_ORIGINS,
}: {
  referrer: string | null | undefined;
  allowedOrigins?: readonly string[];
}) {
  if (!referrer) return null;

  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }

  const origin = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
  return allowedOrigins.some((pattern) => originMatchesPattern(url, pattern)) ? origin : null;
}

export function postMessageToValidParent(payload: IframePostMessagePayload) {
  if (typeof window === "undefined") return false;
  const targetOrigin = getValidParentOrigin({ referrer: document.referrer });
  if (!targetOrigin || !window.parent) return false;
  window.parent.postMessage(payload, targetOrigin);
  return true;
}

function originMatchesPattern(url: URL, pattern: string) {
  let patternUrl: URL;
  try {
    patternUrl = new URL(pattern.replace("*.", "wildcard."));
  } catch {
    return false;
  }

  if (url.protocol !== patternUrl.protocol) return false;
  if (url.port && url.port !== "443") return false;

  const patternHost = patternUrl.hostname.replace(/^wildcard\./, "*.");
  if (!patternHost.startsWith("*.")) {
    return url.hostname === patternHost && (url.port === "" || url.port === "443");
  }

  const suffix = patternHost.slice(1);
  return url.hostname.endsWith(suffix) && url.hostname.length > suffix.length;
}
