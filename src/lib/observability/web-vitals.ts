"use client";

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

const ENDPOINT = "/api/observability/web-vitals";
const SESSION_KEY = "claw42_observability_session_id";

export function registerWebVitals() {
  onCLS(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
  onINP(reportMetric);
}

function reportMetric(metric: Metric) {
  reportVital(metric.name, metric.value, metric.id, metric.navigationType);
}

export function reportVital(
  name: string,
  value: number,
  id: string,
  navigationType: string,
) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    name,
    value,
    id,
    navigationType,
    url: window.location.href,
    ts: new Date().toISOString(),
    sessionId: getSessionId(),
  });

  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.(ENDPOINT, blob)) return;

  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Observability must never interrupt the user journey.
  });
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const nextId = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, nextId);
    return nextId;
  } catch {
    return crypto.randomUUID();
  }
}
