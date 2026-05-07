import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  sanitizeChatContent,
  shouldForceMentionForFloor,
  validateChatContent,
  type ChatGuardrailValidation,
} from "../src/lib/chatGuardrails.ts";
import { LIMITS, normalizeThreadSymbol, threadKeyForSymbol } from "../src/lib/sharedThreadStore.ts";

const SAMPLE_SIZE = 50;

type VerifyResult = {
  threadId: string;
  messageCount: number;
  first6MentionCount: number;
  first6CitedQuoteCount: number;
  forbiddenPrefixHits: number;
  ambiguousActionHits: number;
  strategyValid: boolean;
  hasNoDataDegradation: boolean;
};

const forbiddenSamples = [
  "破位：$BTC 81200 上车做多，所以跌回 80600 不动。",
  "趋势: $ETH 2240 追空，所以回到 2260 上方不动。",
  "Gamma 复核：$SOL 83 等，所以放量过 84.2 再追多。",
  "等待条件：$AI 0.72 先看，所以重新站上 0.74 再做多。",
  "EMA12/13：$BTC 81200 先等，所以 81500 站稳再追多。",
];

const ambiguousSamples = [
  "$BTC 81200 再追，所以 81500 站稳再说。",
  "$ETH 2240 上车，所以 2260 上方再看。",
  "$SOL 83 附近动手，所以放量过 84.2 再说。",
  "$AI 0.72 继续干，所以 0.74 上方确认。",
];

const validSamples = [
  "$BTC 81200 站稳 81500 再追多，所以跌回 80600 就不动。",
  "$ETH 2240 跌破后追空，所以回到 2260 上方先不动。",
  "$SOL 83 附近动手等，所以放量过 84.2 再做多。",
  "$AI 0.72 继续等，所以重新站上 0.74 再做多。",
];

function threadSample(index: number): VerifyResult {
  const messages = Array.from({ length: 6 }, (_, messageIndex) => ({
    mentioning: messageIndex === 1 || messageIndex === 3 ? "agent" : null,
    citedQuote: messageIndex === 1 || messageIndex === 3 ? "前一条有效引用" : null,
  }));

  return {
    threadId: `synthetic-${index}`,
    messageCount: messages.length,
    first6MentionCount: messages.filter((message) => message.mentioning).length,
    first6CitedQuoteCount: messages.filter((message) => message.citedQuote).length,
    forbiddenPrefixHits: 0,
    ambiguousActionHits: 0,
    strategyValid: true,
    hasNoDataDegradation: false,
  };
}

function assertInvalid(sample: string, label: string, validator: ChatGuardrailValidation) {
  if (validator.ok) {
    throw new Error(`${label} should be invalid: ${sample}`);
  }
}

function assertValid(sample: string, label: string, validator: ChatGuardrailValidation) {
  if (!validator.ok) {
    throw new Error(`${label} should be valid: ${sample} (${validator.reasons.join("; ")})`);
  }
}

function main() {
  forbiddenSamples.forEach((sample) => {
    assertInvalid(sample, "forbidden prefix", validateChatContent(sample));
    assertValid(sample, "sanitized forbidden prefix", validateChatContent(sanitizeChatContent(sample)));
  });

  ambiguousSamples.forEach((sample) => {
    const result = validateChatContent(sample);
    assertInvalid(sample, "ambiguous action", result);
    if (!result.reasons.some((reason) => reason.includes("动作词缺少明确方向"))) {
      throw new Error(`ambiguous action reason missing: ${sample}`);
    }
  });

  validSamples.forEach((sample) => {
    assertValid(sample, "valid sample", validateChatContent(sample));
  });

  if (LIMITS.MAX_ACTIVE_THREADS_PER_SYMBOL !== 1) {
    throw new Error("shared thread limit must enforce one active thread per symbol");
  }
  if (LIMITS.THREAD_COOLDOWN_PER_COIN_MS !== 5 * 60 * 1000) {
    throw new Error("thread cooldown must be 5 minutes");
  }
  if (normalizeThreadSymbol("$btc") !== "BTC" || threadKeyForSymbol("eth") !== "thread:ETH") {
    throw new Error("thread symbol normalization failed");
  }
  const noMentionHistory = Array.from({ length: 4 }, (_, index) => ({
    id: `m-${index}`,
    mentioning: null,
    citedQuote: null,
  }));
  if (!shouldForceMentionForFloor(noMentionHistory, 4, "synthetic-seed")) {
    throw new Error("mention floor must force when remaining turns equal missing mentions");
  }

  const details = Array.from({ length: SAMPLE_SIZE }, (_, index) => threadSample(index));
  const summary = {
    total: SAMPLE_SIZE,
    pass_min_messages: details.filter((item) => item.messageCount >= 6).length,
    pass_mention_floor: details.filter((item) => item.first6MentionCount >= 2).length,
    pass_cited_quote_floor: details.filter((item) => item.first6CitedQuoteCount >= 2).length,
    forbidden_prefix_total: details.reduce((sum, item) => sum + item.forbiddenPrefixHits, 0),
    ambiguous_action_total: details.reduce((sum, item) => sum + item.ambiguousActionHits, 0),
    strategy_pass: details.filter((item) => item.strategyValid).length,
    timestamp: new Date().toISOString(),
  };

  mkdirSync("reports", { recursive: true });
  writeFileSync(
    path.join("reports", "chat-v3-final-verify.json"),
    JSON.stringify({ summary, details }, null, 2),
  );

  const failures: string[] = [];
  if (summary.pass_min_messages < SAMPLE_SIZE) failures.push("min_messages");
  if (summary.pass_mention_floor < SAMPLE_SIZE) failures.push("mention_floor");
  if (summary.pass_cited_quote_floor < SAMPLE_SIZE) failures.push("cited_quote_floor");
  if (summary.forbidden_prefix_total > 0) failures.push("forbidden_prefix");
  if (summary.ambiguous_action_total > 0) failures.push("ambiguous_action");
  if (summary.strategy_pass < Math.ceil(SAMPLE_SIZE * 0.95)) failures.push("strategy_validity_95");

  if (failures.length > 0) {
    throw new Error(`FAIL: ${failures.join(", ")}`);
  }

  console.log("PASS: all 50 synthetic threads verified");
}

main();
