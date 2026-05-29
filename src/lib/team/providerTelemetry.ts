import { kv } from "@/lib/kv-shim";
import {
  TEAM_MEMBER_REGISTRY,
  isTeamMemberId,
  type TeamMemberId,
  type TeamProviderId,
} from "@/lib/team/teamRegistry";
import type { ProviderId } from "@/lib/llm/providers/types";

type ProviderTelemetryKvClient = {
  lpush(key: string, value: string): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  expire(key: string, seconds: number): Promise<unknown>;
};

export interface ProviderCallTelemetry {
  ts: number;
  taskTag: string;
  roleId: TeamMemberId | null;
  defaultProvider: TeamProviderId | null;
  providerOverride: ProviderId | null;
  providerChain: ProviderId[];
  attemptedProviders: ProviderId[];
  skippedProviders: ProviderId[];
  finalProvider: ProviderId | null;
  fallbackCount: number;
  latencyMs: number;
  success: boolean;
  cached: boolean;
  cacheHitProvider: ProviderId | null;
  error: string | null;
}

export interface ProviderTelemetryInput {
  taskTag: string;
  providerOverride?: ProviderId;
  providerChain: ProviderId[];
  attemptedProviders: ProviderId[];
  skippedProviders: ProviderId[];
  finalProvider?: ProviderId | null;
  fallbackCount: number;
  latencyMs: number;
  success: boolean;
  cached?: boolean;
  cacheHitProvider?: ProviderId | null;
  error?: string | null;
  ts?: number;
}

export interface ProviderTelemetrySummary {
  totalCalls: number;
  providerCounts: Partial<Record<ProviderId, number>>;
  fallbackCalls: number;
  failureCalls: number;
  singleProviderConcentration: {
    provider: ProviderId | null;
    count: number;
    ratio: number;
    threshold: number;
    alert: boolean;
  };
}

const KV_KEY = "claw42:llm:provider-telemetry:v1";
const KV_ALERT_KEY = "claw42:llm:provider-telemetry:alerts:v1";
const KV_TTL_SECONDS = 7 * 86_400;
const KV_LINE_CAP = 500;
const MEMORY_LINE_CAP = 500;
const DEFAULT_CONCENTRATION_THRESHOLD = 0.9;

const memoryCalls: ProviderCallTelemetry[] = [];
let warnedKvFallback = false;

function hasKvClient(): boolean {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    kv &&
    typeof kv.lpush === "function" &&
    typeof kv.ltrim === "function" &&
    typeof kv.expire === "function",
  );
}

function warnKvFallback(error: unknown) {
  if (warnedKvFallback) return;
  warnedKvFallback = true;
  if (process.env.NODE_ENV !== "production") {
    console.warn("[claw42] provider telemetry KV unavailable, using memory fallback", error);
  }
}

function roleIdFromTaskTag(taskTag: string): TeamMemberId | null {
  const [, scope, candidate] = taskTag.split(":");
  return scope === "pm-decision" && candidate && isTeamMemberId(candidate) ? candidate : null;
}

function defaultProviderForRole(roleId: TeamMemberId | null): TeamProviderId | null {
  return roleId ? (TEAM_MEMBER_REGISTRY[roleId]?.defaultProvider ?? null) : null;
}

function normalizeTelemetry(input: ProviderTelemetryInput): ProviderCallTelemetry {
  const roleId = roleIdFromTaskTag(input.taskTag);
  return {
    ts: input.ts ?? Date.now(),
    taskTag: input.taskTag,
    roleId,
    defaultProvider: defaultProviderForRole(roleId),
    providerOverride: input.providerOverride ?? null,
    providerChain: [...input.providerChain],
    attemptedProviders: [...input.attemptedProviders],
    skippedProviders: [...input.skippedProviders],
    finalProvider: input.finalProvider ?? null,
    fallbackCount: Math.max(0, input.fallbackCount),
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    success: input.success,
    cached: Boolean(input.cached),
    cacheHitProvider: input.cacheHitProvider ?? null,
    error: input.error ?? null,
  };
}

function appendMemoryCall(event: ProviderCallTelemetry) {
  memoryCalls.unshift(event);
  memoryCalls.splice(MEMORY_LINE_CAP);
}

async function appendKv(key: string, payload: unknown) {
  if (!hasKvClient()) return;
  const client = kv as ProviderTelemetryKvClient;
  await client.lpush(key, JSON.stringify(payload));
  await client.ltrim(key, 0, KV_LINE_CAP - 1);
  await client.expire(key, KV_TTL_SECONDS);
}

export async function recordProviderCall(input: ProviderTelemetryInput): Promise<void> {
  const event = normalizeTelemetry(input);
  appendMemoryCall(event);

  try {
    await appendKv(KV_KEY, event);
  } catch (error) {
    warnKvFallback(error);
  }
}

export async function readProviderTelemetryCalls({
  since,
  limit = KV_LINE_CAP,
}: {
  since?: number;
  limit?: number;
} = {}): Promise<ProviderCallTelemetry[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), KV_LINE_CAP));
  if (!hasKvClient()) {
    return memoryCalls
      .filter((call) => since === undefined || call.ts >= since)
      .slice(0, safeLimit);
  }

  try {
    const client = kv as ProviderTelemetryKvClient;
    const values = await client.lrange(KV_KEY, 0, safeLimit - 1);
    return values
      .map(parseProviderTelemetry)
      .filter(isProviderTelemetry)
      .filter((call) => since === undefined || call.ts >= since);
  } catch (error) {
    warnKvFallback(error);
    return memoryCalls
      .filter((call) => since === undefined || call.ts >= since)
      .slice(0, safeLimit);
  }
}

export function summarizeProviderTelemetry({
  since,
  threshold = DEFAULT_CONCENTRATION_THRESHOLD,
}: {
  since?: number;
  threshold?: number;
} = {}): ProviderTelemetrySummary {
  const calls = memoryCalls.filter((call) => since === undefined || call.ts >= since);
  const providerCounts: Partial<Record<ProviderId, number>> = {};
  let fallbackCalls = 0;
  let failureCalls = 0;

  for (const call of calls) {
    if (!call.success) {
      failureCalls += 1;
      continue;
    }
    if (call.finalProvider) {
      providerCounts[call.finalProvider] = (providerCounts[call.finalProvider] ?? 0) + 1;
    }
    if (call.fallbackCount > 0) fallbackCalls += 1;
  }

  const winningProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0] as
    | [ProviderId, number]
    | undefined;
  const totalSuccesses = Object.values(providerCounts).reduce((sum, count) => sum + count, 0);
  const ratio = winningProvider && totalSuccesses > 0 ? winningProvider[1] / totalSuccesses : 0;

  return {
    totalCalls: calls.length,
    providerCounts,
    fallbackCalls,
    failureCalls,
    singleProviderConcentration: {
      provider: winningProvider?.[0] ?? null,
      count: winningProvider?.[1] ?? 0,
      ratio,
      threshold,
      alert: totalSuccesses > 0 && ratio >= threshold,
    },
  };
}

function parseProviderTelemetry(value: unknown) {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isProviderTelemetry(value: unknown): value is ProviderCallTelemetry {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<ProviderCallTelemetry>;
  return (
    typeof event.ts === "number" &&
    typeof event.taskTag === "string" &&
    Array.isArray(event.providerChain) &&
    Array.isArray(event.attemptedProviders) &&
    typeof event.success === "boolean"
  );
}

export async function warnIfSingleProviderConcentration(
  summary: ProviderTelemetrySummary,
): Promise<void> {
  const concentration = summary.singleProviderConcentration;
  if (!concentration.alert || !concentration.provider) return;

  const alert = {
    type: "single_provider_concentration" as const,
    provider: concentration.provider,
    count: concentration.count,
    totalCalls: summary.totalCalls,
    ratio: concentration.ratio,
    threshold: concentration.threshold,
    ts: Date.now(),
  };

  console.warn("[claw42] Single provider concentration", alert);

  try {
    await appendKv(KV_ALERT_KEY, alert);
  } catch (error) {
    warnKvFallback(error);
  }
}

export const __providerTelemetryTestUtils = {
  clearMemory() {
    memoryCalls.length = 0;
    warnedKvFallback = false;
  },
  memoryCalls,
};
