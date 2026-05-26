import { kv } from "@/lib/kv-shim";
import type { LLMInput, LLMOutput, LLMProvider, ProviderId } from "@/lib/llm/providers/types";

type BudgetKvClient = {
  incrby(key: string, value: number): Promise<number>;
  get<T>(key: string): Promise<T | null>;
  expire(key: string, seconds: number): Promise<unknown>;
};

type MemoryUsage = {
  milliUsd: number;
  expiresAt: number;
};

const MONTH_TTL_SECONDS = 35 * 86_400;
const memoryUsage = new Map<string, MemoryUsage>();
let warnedAboutFallback = false;

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export interface MonthlyUsage {
  usd: number;
  pct: number;
}

function getMonthlyBudgetUsd() {
  const value = Number.parseFloat(process.env.LLM_MONTHLY_BUDGET_USD || "800");
  return Number.isFinite(value) && value > 0 ? value : 800;
}

function getAlarmThreshold() {
  const value = Number.parseFloat(process.env.LLM_BUDGET_ALARM_THRESHOLD || "0.8");
  return Number.isFinite(value) && value > 0 ? value : 0.8;
}

function getAutopauseThreshold() {
  const value = Number.parseFloat(process.env.LLM_BUDGET_AUTOPAUSE_THRESHOLD || "0.95");
  return Number.isFinite(value) && value > 0 ? value : 0.95;
}

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function buildBudgetKey(month: string, providerId: ProviderId | "_total") {
  return `budget:${month}:${providerId}`;
}

function hasKvClient(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    kv &&
    typeof kv.incrby === "function" &&
    typeof kv.get === "function" &&
    typeof kv.expire === "function",
  );
}

function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("KV not configured, using in-memory LLM budget fallback (single instance only)");
}

function cleanupMemoryUsage(now = Date.now()) {
  memoryUsage.forEach((value, key) => {
    if (value.expiresAt <= now) memoryUsage.delete(key);
  });
}

async function incrementBudgetKey(key: string, milliUsd: number): Promise<void> {
  if (hasKvClient()) {
    const client = kv as BudgetKvClient;
    const nextValue = await client.incrby(key, milliUsd);
    if (nextValue === milliUsd) await client.expire(key, MONTH_TTL_SECONDS);
    return;
  }

  warnFallbackOnce();
  cleanupMemoryUsage();
  const existing = memoryUsage.get(key);
  memoryUsage.set(key, {
    milliUsd: (existing?.milliUsd ?? 0) + milliUsd,
    expiresAt: Date.now() + MONTH_TTL_SECONDS * 1000,
  });
}

async function readBudgetKey(key: string): Promise<number> {
  if (hasKvClient()) {
    const value = await (kv as BudgetKvClient).get<number>(key);
    return Number(value ?? 0);
  }

  warnFallbackOnce();
  cleanupMemoryUsage();
  return memoryUsage.get(key)?.milliUsd ?? 0;
}

export async function trackUsage(
  provider: LLMProvider,
  input: LLMInput,
  output: LLMOutput,
): Promise<void> {
  const estimate = provider.estimateCost({
    ...input,
    maxTokens: output.outputTokens || input.maxTokens,
  });
  const milliUsd = Math.max(0, Math.round((estimate.inputUsd + estimate.outputUsd) * 1000));
  if (milliUsd <= 0) return;

  const month = getMonthKey();
  await incrementBudgetKey(buildBudgetKey(month, provider.id), milliUsd);
  await incrementBudgetKey(buildBudgetKey(month, "_total"), milliUsd);
}

export async function getMonthlyUsage(providerId: ProviderId | "_total" = "_total") {
  const month = getMonthKey();
  const milliUsd = await readBudgetKey(buildBudgetKey(month, providerId));
  const usd = milliUsd / 1000;
  return {
    usd,
    pct: usd / getMonthlyBudgetUsd(),
  } satisfies MonthlyUsage;
}

export async function isBudgetAutopaused(): Promise<boolean> {
  const { pct } = await getMonthlyUsage();
  return pct >= getAutopauseThreshold();
}

export async function shouldAlarmBudget(): Promise<boolean> {
  const { pct } = await getMonthlyUsage();
  return pct >= getAlarmThreshold();
}

export const __llmBudgetTestUtils = {
  clearMemoryUsage() {
    memoryUsage.clear();
    warnedAboutFallback = false;
  },
  memoryUsage,
};
