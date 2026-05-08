import { kv } from "@vercel/kv";
import type { LLMInput, LLMOutput, LLMProvider } from "@/lib/llm/providers/types";

type LogKvClient = {
  lpush(key: string, value: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

type MemoryLogEntry = {
  value: string;
  expiresAt: number;
};

const LOG_TTL_SECONDS = 7 * 86_400;
const memoryLogs = new Map<string, MemoryLogEntry[]>();
let warnedAboutFallback = false;

function hasKvClient(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN &&
    kv &&
    typeof kv.lpush === "function" &&
    typeof kv.expire === "function",
  );
}

function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("KV not configured, using in-memory LLM log fallback (single instance only)");
}

function cleanupMemoryLogs(now = Date.now()) {
  memoryLogs.forEach((entries, key) => {
    const fresh = entries.filter((entry) => entry.expiresAt > now);
    if (fresh.length === 0) {
      memoryLogs.delete(key);
    } else {
      memoryLogs.set(key, fresh);
    }
  });
}

export async function logCall(
  provider: LLMProvider,
  input: LLMInput,
  output: LLMOutput,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const key = `llm-log:${date}:${input.taskTag}`;
  const entry = JSON.stringify({
    provider: provider.id,
    taskTag: input.taskTag,
    inputTokens: output.inputTokens,
    outputTokens: output.outputTokens,
    latencyMs: output.latencyMs,
    cached: output.cached,
    timestamp: Date.now(),
  });

  if (hasKvClient()) {
    const client = kv as LogKvClient;
    const length = await client.lpush(key, entry);
    if (length === 1) await client.expire(key, LOG_TTL_SECONDS);
    return;
  }

  warnFallbackOnce();
  cleanupMemoryLogs();
  const existing = memoryLogs.get(key) ?? [];
  memoryLogs.set(key, [
    { value: entry, expiresAt: Date.now() + LOG_TTL_SECONDS * 1000 },
    ...existing,
  ]);
}

export const __llmLogTestUtils = {
  clearMemoryLogs() {
    memoryLogs.clear();
    warnedAboutFallback = false;
  },
  memoryLogs,
};
