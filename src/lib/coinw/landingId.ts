import {
  LANDING_SESSION_COOKIE_NAME,
  LANDING_SESSION_COOKIE_TTL_SEC,
} from "./externalEntryConstants";

export function generateLandingId() {
  return crypto.randomUUID();
}

export function generateLandingSessionId() {
  return crypto.randomUUID();
}

export function ensureLandingSessionCookie({
  cookieName = LANDING_SESSION_COOKIE_NAME,
  maxAgeSec = LANDING_SESSION_COOKIE_TTL_SEC,
}: {
  cookieName?: string;
  maxAgeSec?: number;
} = {}) {
  if (typeof document === "undefined") return null;
  const existing = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.split("=")[1];
  if (existing) return decodeURIComponent(existing);

  const sessionId = generateLandingSessionId();
  document.cookie = `${cookieName}=${encodeURIComponent(
    sessionId,
  )}; path=/; max-age=${Math.floor(maxAgeSec)}; samesite=lax`;
  return sessionId;
}
