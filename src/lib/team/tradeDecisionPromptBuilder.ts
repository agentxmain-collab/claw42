import { callWithChain } from "@/lib/llm/providers";
import type { ProviderId } from "@/lib/llm/providers/types";
import type { TeamMemberId, TeamProviderId } from "@/lib/team/teamRegistry";
import type { Locale } from "@/i18n/types";
import {
  allTextMatchesLocale,
  buildLocaleInstruction,
  buildLocaleRetryInstruction,
  LEGACY_WATCH_LOCALE,
  normalizeWatchLocale,
} from "@/lib/watch/locale";
import {
  validateTradeDecision,
  type Severity,
  type TradeDecision,
  type TradeDirection,
} from "@/lib/team/tradeDecision";

export interface TradeCardPromptContext {
  symbol: string;
  currentPrice: number;
  analystInputs: Array<{
    memberId: TeamMemberId;
    direction: Extract<TradeDirection, "long" | "short"> | "neutral";
    confidence: number;
    rationale: string;
  }>;
  riskNotes: string[];
  newsContext: string[];
  severity: Severity;
  locale?: Locale;
}

export interface PMProviderSelection {
  requestedProvider: Extract<TeamProviderId, "claude-haiku" | "claude-opus">;
  providerOverride: ProviderId;
  fallbackReason: string | null;
}

const PROMPT_VERSION = "trade-decision-v1";
const SYSTEM_PROMPT = [
  "You are the Claw42 Portfolio Manager.",
  "Return strict JSON only. Do not wrap it in Markdown.",
  'If evidence is weak or analyst disagreement is severe, return direction="wait".',
].join("\n");

export function selectPMProvider(
  severity: Severity,
): Extract<TeamProviderId, "claude-haiku" | "claude-opus"> {
  return severity === "high" ? "claude-opus" : "claude-haiku";
}

export function resolvePMProviderSelection(severity: Severity): PMProviderSelection {
  const requestedProvider = selectPMProvider(severity);
  if (requestedProvider === "claude-opus") {
    return {
      requestedProvider,
      providerOverride: "claude-haiku",
      fallbackReason: "claude-opus tier is not exposed by the current provider registry",
    };
  }
  return {
    requestedProvider,
    providerOverride: "claude-haiku",
    fallbackReason: null,
  };
}

function formatAnalystInputs(ctx: TradeCardPromptContext): string {
  if (ctx.analystInputs.length === 0) return "- none";
  return ctx.analystInputs
    .map((input) => {
      return `- ${input.memberId}: direction=${input.direction}, confidence=${input.confidence.toFixed(
        2,
      )}, rationale=${input.rationale}`;
    })
    .join("\n");
}

function formatList(items: string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildTradeDecisionPrompt(ctx: TradeCardPromptContext): string {
  const symbol = ctx.symbol.replace(/^\$/, "").toUpperCase();
  const locale = normalizeWatchLocale(ctx.locale, LEGACY_WATCH_LOCALE);
  return `You are Portfolio Manager for Claw42.

## Task
Integrate analyst inputs and risk objections into one TradeDecision JSON object.

## Core instructions
1. You are Portfolio Manager, integrating analyst inputs and risk_lead objections.
2. Output strict JSON matching the TradeDecision schema below.
3. If evidence is insufficient or disagreement is severe, output direction="wait" and do not force a directional trade.
4. entryPrice / stopLoss / takeProfit must be based on currentPrice=${ctx.currentPrice}, not imagined historical prices.
5. positionSizing reflects confidence multiplied by evidence quality; do not derive it mechanically from consensus ratio.
6. invalidatesIf must be a concrete verifiable condition, not vague language like "market reverses".

## Market
symbol: ${symbol}
currentPrice: ${ctx.currentPrice}
severity: ${ctx.severity}

## Analyst inputs
${formatAnalystInputs(ctx)}

## Risk notes
${formatList(ctx.riskNotes)}

## News context
${formatList(ctx.newsContext)}

## Locale
${buildLocaleInstruction(locale)}

## TradeDecision JSON schema
{
  "id": "stable unique id",
  "schemaVersion": 1,
  "symbol": "${symbol}",
  "generatedBy": "pm",
  "generatedAt": "ISO timestamp",
  "direction": "long|short|wait",
  "entryType": "market|limit|breakout|pullback|wait",
  "entryPrice": number_or_null,
  "entryRange": { "low": number, "high": number } | null,
  "stopLoss": number_or_null,
  "takeProfit": [number],
  "positionSizing": number_between_0_and_0_5,
  "timeHorizon": "intraday|swing|position",
  "rating": 1_to_5,
  "confidence": number_between_0_and_1,
  "evidenceIds": [],
  "riskNote": "short concrete risk note",
  "invalidatesIf": "specific invalidation condition",
  "promptVersion": "${PROMPT_VERSION}",
  "modelProvider": "provider id",
  "severity": "${ctx.severity}"
}

## Directional examples
- Long: stopLoss < entryPrice and every takeProfit > entryPrice.
- Short: stopLoss > entryPrice and every takeProfit < entryPrice.
- Wait: entryType="wait", entryPrice=null, entryRange=null, stopLoss=null, takeProfit=[].

Return JSON only.`;
}

function tryParseJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  const source = fenced ?? trimmed;
  try {
    return JSON.parse(source);
  } catch {
    const firstBrace = source.indexOf("{");
    const lastBrace = source.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(source.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("LLM output is not valid JSON");
  }
}

function attachProvider(raw: unknown, provider: ProviderId): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return {
    ...(raw as Record<string, unknown>),
    modelProvider: provider,
  };
}

async function callPM(prompt: string, ctx: TradeCardPromptContext, attempt: "first" | "retry") {
  const selection = resolvePMProviderSelection(ctx.severity);
  const locale = normalizeWatchLocale(ctx.locale, LEGACY_WATCH_LOCALE);
  return callWithChain({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 900,
    timeoutMs: 12_000,
    taskTag: `team:trade-decision:${ctx.severity}:${locale}:${attempt}`,
    providerOverride: selection.providerOverride,
  });
}

function decisionMatchesLocale(decision: TradeDecision, locale: Locale) {
  return allTextMatchesLocale(locale, [decision.riskNote, decision.invalidatesIf]);
}

export async function generateTradeDecision(
  ctx: TradeCardPromptContext,
): Promise<TradeDecision | null> {
  const locale = normalizeWatchLocale(ctx.locale, LEGACY_WATCH_LOCALE);
  const prompt = buildTradeDecisionPrompt(ctx);

  const firstOutput = await callPM(prompt, ctx, "first");
  let parsed = attachProvider(tryParseJson(firstOutput.text), firstOutput.provider);
  let validation = validateTradeDecision(parsed, ctx.currentPrice);
  if (validation.valid && decisionMatchesLocale(validation.decision, locale)) {
    return validation.decision;
  }

  const retryPrompt = [
    prompt,
    "",
    "The previous JSON failed validation.",
    `Errors: ${validation.valid ? `locale ${locale} mismatch` : validation.errors.join("; ")}`,
    buildLocaleRetryInstruction(locale),
    "Return a corrected TradeDecision JSON object only.",
  ].join("\n");

  const retryOutput = await callPM(retryPrompt, ctx, "retry");
  parsed = attachProvider(tryParseJson(retryOutput.text), retryOutput.provider);
  validation = validateTradeDecision(parsed, ctx.currentPrice);
  if (validation.valid && decisionMatchesLocale(validation.decision, locale)) {
    return validation.decision;
  }

  return null;
}

export type { Severity, TradeDecision };
