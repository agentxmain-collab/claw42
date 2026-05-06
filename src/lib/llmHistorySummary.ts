import type { AgentAnalysisPayload } from "@/modules/agent-watch/types";

const LAST_BATCH_TTL_MS = 30 * 60_000;
const SNIPPET_MAX_LENGTH = 48;

let lastSuccessfulPayload: { value: AgentAnalysisPayload; ts: number } | null = null;

function snippet(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= SNIPPET_MAX_LENGTH) return text;
  return `${text.slice(0, SNIPPET_MAX_LENGTH)}...`;
}

export function recordSuccessfulPayload(payload: AgentAnalysisPayload) {
  lastSuccessfulPayload = { value: payload, ts: Date.now() };
}

export function getLastBatchSummary(): { summary: string; ageMs: number } | null {
  if (!lastSuccessfulPayload) return null;

  const { value, ts } = lastSuccessfulPayload;
  const ageMs = Date.now() - ts;
  if (ageMs > LAST_BATCH_TTL_MS) return null;

  const lines: string[] = [];
  if (value.focus?.length) {
    lines.push("focus:");
    for (const item of value.focus) {
      lines.push(`- ${item.agentId}: ${item.symbol} "${snippet(item.judgment)}"`);
    }
  }

  if (value.stream.length) {
    lines.push("stream:");
    for (const item of value.stream) {
      lines.push(`- ${item.agentId}: "${snippet(item.content)}"`);
    }
  }

  return { summary: lines.join("\n"), ageMs };
}
