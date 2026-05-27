export type ProviderId =
  | "deepseek-chat"
  | "minimax"
  | "claude-haiku"
  | "openai"
  | "anthropic"
  | "stub";

export interface LLMInput {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  cacheKey?: string;
  cacheTTLSeconds?: number;
  taskTag: string;
  providerOverride?: ProviderId;
  modelOverride?: string;
  thinkingMode?: "enabled" | "disabled";
  responseFormat?: "json_object";
  diagnosticsCollector?: LLMAttemptDiagnosticsCollector;
}

export interface LLMOutput {
  text: string;
  provider: ProviderId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
  cacheHitProvider?: ProviderId;
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  generate(input: LLMInput): Promise<LLMOutput>;
  isHealthy(): Promise<boolean>;
  estimateCost(input: LLMInput): { inputUsd: number; outputUsd: number };
}

export interface LLMAttemptDiagnostic {
  provider: ProviderId;
  model: string;
  taskTag: string;
  httpStatus: number | null;
  finishReason: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  contentLength: number | null;
  reasoningContent: {
    present: boolean;
    length: number | null;
  };
  error: string | null;
  latencyMs: number;
}

export type LLMAttemptDiagnosticsCollector = (diagnostic: LLMAttemptDiagnostic) => void;

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 800;
export const DEFAULT_TIMEOUT_MS = 10_000;

export function estimateTokenCount(text: string | undefined): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function resolveInputTokens(input: LLMInput): number {
  return estimateTokenCount(`${input.systemPrompt ?? ""}\n${input.prompt}`);
}

export function resolveCost(
  inputTokens: number,
  outputTokens: number,
  inputUsdPerMillion: number,
  outputUsdPerMillion: number,
) {
  return {
    inputUsd: (inputTokens / 1_000_000) * inputUsdPerMillion,
    outputUsd: (outputTokens / 1_000_000) * outputUsdPerMillion,
  };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
