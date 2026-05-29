import { callWithChain } from "@/lib/llm/providers";
import type { LLMAttemptDiagnosticsCollector, ProviderId } from "@/lib/llm/providers";
import {
  applyGuardrails,
  buildGuardrailRetryPrompt,
  hasMechanicalOutput,
} from "@/lib/llm/guardrails";
import { hashCacheKey } from "@/lib/llm/cache";

export interface GenerateTextOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  taskTag: string;
  enableCache?: boolean;
  cacheTTLSeconds?: number;
  enableGuardrails?: boolean;
  providerOverride?: ProviderId;
  modelOverride?: string;
  thinkingMode?: "enabled" | "disabled";
  responseFormat?: "json_object";
  timeoutMs?: number;
  diagnosticsCollector?: LLMAttemptDiagnosticsCollector;
}

export async function generateText(prompt: string, options: GenerateTextOptions): Promise<string> {
  const cacheKey =
    options.enableCache !== false
      ? hashCacheKey(
          prompt,
          options.taskTag,
          [
            options.systemPrompt,
            options.providerOverride ? `provider:${options.providerOverride}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
      : undefined;

  const output = await callWithChain({
    prompt,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    cacheKey,
    cacheTTLSeconds: options.cacheTTLSeconds,
    taskTag: options.taskTag,
    providerOverride: options.providerOverride,
    modelOverride: options.modelOverride,
    thinkingMode: options.thinkingMode,
    responseFormat: options.responseFormat,
    timeoutMs: options.timeoutMs,
    diagnosticsCollector: options.diagnosticsCollector,
  });

  if (options.enableGuardrails === false || !hasMechanicalOutput(output.text, options.taskTag)) {
    return output.text.trim();
  }

  const retryOutput = await callWithChain({
    prompt: buildGuardrailRetryPrompt(prompt, output.text),
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeoutMs: options.timeoutMs ?? 10_000,
    taskTag: `${options.taskTag}:guardrail-retry`,
    providerOverride: options.providerOverride,
    modelOverride: options.modelOverride,
    thinkingMode: options.thinkingMode,
    responseFormat: options.responseFormat,
    diagnosticsCollector: options.diagnosticsCollector,
  });

  return applyGuardrails(retryOutput.text, options.taskTag);
}
