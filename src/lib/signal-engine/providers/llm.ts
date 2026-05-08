import { callWithChain } from "@/lib/llm/providers";
import { parseLlmJsonObject } from "@/lib/llm-json";
import { normalizeStructuredFields } from "@/lib/signal-engine/schema-guard";
import { structureWithStub } from "@/lib/signal-engine/providers/stub";
import type {
  StructuredFields,
  StructuringProvider,
  StructuringProviderInput,
} from "@/lib/signal-engine/providers/types";

type JsonSchemaLike = {
  required?: string[];
  [key: string]: unknown;
};

const STRUCTURED_FIELDS_SCHEMA = {
  type: "object",
  required: [
    "whyItMatters",
    "marketContext",
    "watchPoints",
    "direction",
    "confidence",
    "impactLevel",
    "riskNotes",
  ],
  properties: {
    whyItMatters: { type: "object", required: ["zh", "en"] },
    marketContext: { type: "object", required: ["zh", "en"] },
    watchPoints: { type: "array" },
    direction: { type: ["string", "null"], enum: ["bullish", "bearish", "neutral", null] },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    impactLevel: { type: "string", enum: ["critical", "high", "medium", "low"] },
    riskNotes: { type: "array" },
  },
} satisfies JsonSchemaLike;

export async function generateStructuredSignal(
  prompt: string,
  schema: JsonSchemaLike = STRUCTURED_FIELDS_SCHEMA,
): Promise<Record<string, unknown>> {
  const output = await callWithChain({
    prompt: `${prompt}

Return strict JSON only. Do not include markdown fences or explanations.
JSON schema:
${JSON.stringify(schema, null, 2)}`,
    temperature: 0.3,
    maxTokens: 1500,
    timeoutMs: 15_000,
    taskTag: "signal-structuring",
  });

  return parseAndValidate(output.text, schema);
}

function parseAndValidate(text: string, schema: JsonSchemaLike): Record<string, unknown> {
  const parsed = parseLlmJsonObject(text, "LLM provider returned invalid structured signal JSON");
  const missing = (schema.required ?? []).filter((key) => !(key in parsed));
  if (missing.length > 0) {
    throw new Error(`LLM structured signal missing required fields: ${missing.join(", ")}`);
  }
  return parsed;
}

function buildStructuredSignalPrompt(input: StructuringProviderInput): string {
  return `You are structuring a crypto market signal for Claw42.

Candidate:
${JSON.stringify(input.candidate, null, 2)}

Rule evaluations:
${JSON.stringify(input.rules, null, 2)}

Engine score: ${input.score}
Impact level: ${input.impactLevel}

Create concise bilingual fields:
- whyItMatters.zh/en
- marketContext.zh/en
- watchPoints[] as bilingual objects
- direction: bullish | bearish | neutral | null
- confidence: 0-100 integer
- impactLevel: critical | high | medium | low
- riskNotes[] as bilingual objects

Use only facts present in the candidate and rules.`;
}

export const llmStructuringProvider: StructuringProvider = {
  name: "llm",
  async structure(input: StructuringProviderInput): Promise<StructuredFields> {
    const fallback = structureWithStub(input.candidate, input.score, input.impactLevel);
    const parsed = await generateStructuredSignal(buildStructuredSignalPrompt(input));
    return normalizeStructuredFields(parsed, fallback);
  },
};

export const __llmStructuringTestUtils = {
  parseAndValidate,
  buildStructuredSignalPrompt,
};
