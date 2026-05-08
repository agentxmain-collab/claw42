import assert from "node:assert/strict";
import {
  sanitizeChatContent,
  shouldForceMentionInOpening,
  validateChatContent,
} from "../src/lib/chatOrchestrator";

const valid = "$BTC 现价 81200，站稳 81500 再追多，所以跌回 80600 就不动。";
assert.equal(validateChatContent(valid).ok, true);

const bannedSamples = [
  "破位: $BTC 81200 站稳再追多，所以跌回 80600 不动。",
  "趋势：$ETH 2240 上车做多，所以跌破 2200 不动。",
  "极端: $SOL 82 入场做多，所以跌回 80 不动。",
  "Alpha: $BTC 81200 上车做多，所以 80600 失守不动。",
  "老K 追多: $BTC 81200 上车做多，所以 80600 失守不动。",
  "趋势视角：$BTC 81200 上车做多，所以 80600 失守不动。",
];

bannedSamples.forEach((sample) => {
  assert.equal(validateChatContent(sample).ok, false, sample);
  assert.equal(validateChatContent(sanitizeChatContent(sample)).ok, true, sample);
});

assert.equal(
  validateChatContent("$BTC 81200 上车，所以 81500 站稳再说。").reasons.includes(
    "动作词缺少明确方向",
  ),
  true,
);
assert.equal(validateChatContent("$BTC 81200 上车做多，所以 81500 站稳再追多。").ok, true);

assert.equal(shouldForceMentionInOpening(0, "seed"), false);
assert.equal(shouldForceMentionInOpening(1, "seed"), true);
assert.equal(shouldForceMentionInOpening(3, "seed"), true);
assert.equal(shouldForceMentionInOpening(6, "seed"), false);

console.log("chat v3.1 guardrail tests passed");
