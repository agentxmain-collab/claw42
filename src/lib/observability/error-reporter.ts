"use client";

import type { ErrorInfo } from "react";

const ENDPOINT = "/api/observability/errors";
const SESSION_KEY = "claw42_error_session_id";

export type ErrorReportContext = Record<string, unknown> | ErrorInfo;

export function reportError(error: unknown, context: ErrorReportContext = {}) {
  const errorId = createId();
  if (typeof window === "undefined") return errorId;

  const body = JSON.stringify({
    message: safeMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: sanitizeContext(context),
    url: window.location.href,
    ts: new Date().toISOString(),
    sessionId: getSessionId(),
    errorId,
  });

  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.(ENDPOINT, blob)) return errorId;

  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Error reporting must never trigger another user-visible error.
  });

  return errorId;
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const nextId = createId();
    window.sessionStorage.setItem(SESSION_KEY, nextId);
    return nextId;
  } catch {
    return createId();
  }
}

function createId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
}

function safeMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === "string") return error.slice(0, 500);
  return "Unknown application error";
}

function sanitizeContext(context: ErrorReportContext) {
  return JSON.parse(
    JSON.stringify(context, (_key, value) => {
      if (typeof value === "string") return value.slice(0, 2000);
      if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
      if (Array.isArray(value)) return value.slice(0, 20);
      if (typeof value === "object") return value;
      return String(value).slice(0, 500);
    }),
  ) as Record<string, unknown>;
}
