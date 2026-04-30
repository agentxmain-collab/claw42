import assert from "node:assert/strict";
import {
  formatCoinSymbol,
  prefixLeadingCoinSymbol,
} from "../src/modules/agent-watch/utils/symbolFormat";
import { buildWatchSupplementalEntry } from "../src/modules/agent-watch/utils/watchSupplementalUpdates";
import { buildStreamChatMessages } from "../src/modules/agent-watch/utils/streamChatMessages";
import {
  speakerForStreamEntry,
  splitStreamEntryForDisplay,
  thinkDurationForStreamEntry,
} from "../src/modules/agent-watch/utils/streamDisplayQueue";
import { buildHeroSpeechLines } from "../src/modules/landing/HeroScene/heroSpeechLines";
import type {
  AgentFocus,
  AgentMessage,
  CoinPoolPayload,
  FocusEvent,
  TickerMap,
} from "../src/modules/agent-watch/types";

const tickers: TickerMap = {
  BTC: { price: 75_817.95, change24h: -1.49 },
  ETH: { price: 2_250.11, change24h: -2.67 },
  SOL: { price: 82.88, change24h: -1.97 },
  USDT: { price: 1, change24h: 0.01 },
};

const pool: CoinPoolPayload = {
  ts: 1_714_000_000_000,
  tickers,
  source: "coinw-kline",
  majors: [
    { symbol: "BTC", price: 75_817.95, change24h: -1.49, category: "majors" },
    { symbol: "ETH", price: 2_250.11, change24h: -2.67, category: "majors" },
    { symbol: "SOL", price: 82.88, change24h: -1.97, category: "majors" },
  ],
  trending: [
    { symbol: "DOGE", price: 0.18, change24h: 6.4, category: "trending" },
  ],
  opportunity: [
    { symbol: "AI", price: 0.12, change24h: -41.1, category: "opportunity" },
    { symbol: "BIO", price: 0.22, change24h: 20.1, category: "opportunity" },
  ],
};

const focus: AgentFocus[] = [
  {
    agentId: "alpha",
    symbol: "DOGE",
    judgment: "DOGE 先看关键位和放量确认，没信号就不追。",
    trigger: {
      type: "breakout_with_volume",
      symbol: "DOGE",
      description: "DOGE 需要放量突破近期高点。",
    },
    fail: {
      type: "volume_dry",
      symbol: "DOGE",
      description: "DOGE 量能缩回均值下方则放弃。",
    },
    evidenceCount: 2,
    generatedAt: 1_714_000_000_000,
  },
  {
    agentId: "beta",
    symbol: "BTC",
    judgment: "BTC 趋势信号不足，先等 EMA12/13 共振。",
    trigger: {
      type: "ema_cross",
      symbol: "BTC",
      description: "BTC 重新站回 EMA13 才升级。",
    },
    fail: {
      type: "ema_break",
      symbol: "BTC",
      description: "BTC 跌回 EMA13 下方则失效。",
    },
    evidenceCount: 1,
    generatedAt: 1_714_000_000_000,
  },
  {
    agentId: "gamma",
    symbol: "AI",
    judgment: "AI 还没到足够极端的位置。",
    trigger: {
      type: "range_break",
      symbol: "AI",
      description: "AI 接近近期低位后观察回归。",
    },
    fail: {
      type: "price_break",
      symbol: "AI",
      description: "AI 脱离锚点则回归判断失效。",
    },
    evidenceCount: 1,
    generatedAt: 1_714_000_000_000,
  },
];

const highEvent: FocusEvent = {
  kind: "focus_event",
  id: "focus-1",
  ts: 1_714_000_000_000,
  symbol: "AI",
  signalType: "range_change",
  severity: "alert",
  description: "AI 24h -41.1%（机会区异动）",
  primaryResponse: { agentId: "gamma", content: "等待近期低位失速。" },
};

assert.equal(formatCoinSymbol("btc"), "$BTC");
assert.equal(formatCoinSymbol("$eth"), "$ETH");
assert.equal(formatCoinSymbol("—"), "—");
assert.equal(prefixLeadingCoinSymbol("AI 24h -41.1%（机会区异动）", "AI"), "$AI 24h -41.1%（机会区异动）");
assert.equal(prefixLeadingCoinSymbol("AI Agent 正在分析", "BTC"), "AI Agent 正在分析");
assert.equal(prefixLeadingCoinSymbol("AI Agent 正在分析", "AI"), "AI Agent 正在分析");

const digest = buildWatchSupplementalEntry({
  now: 1_714_000_020_000,
  pool,
  focus,
  signals: [],
  existingEntries: [],
  preferredKind: "market_digest",
});
assert.ok(digest);
assert.equal(digest.kind, "watch_update");
assert.equal(digest.updateType, "market_digest");
assert.match(digest.content, /\$AI|\$BIO/);

const sameDigest = buildWatchSupplementalEntry({
  now: 1_714_000_080_000,
  pool,
  focus,
  signals: [],
  existingEntries: [],
  preferredKind: "market_digest",
});
assert.equal(sameDigest?.id, digest.id);

const focusUpdate = buildWatchSupplementalEntry({
  now: 0,
  pool,
  focus,
  signals: [],
  existingEntries: [],
  preferredKind: "focus_update",
});
assert.ok(focusUpdate);
assert.equal(focusUpdate.kind, "watch_update");
assert.equal(focusUpdate.agentId, "alpha");
assert.match(focusUpdate.content, /\$DOGE/);

const skipped = buildWatchSupplementalEntry({
  now: 1_714_000_020_000,
  pool,
  focus,
  signals: [],
  existingEntries: [highEvent],
  preferredKind: "market_digest",
});
assert.equal(skipped, null);

const discussionDuringPriority = buildWatchSupplementalEntry({
  now: 1_714_000_020_000,
  pool,
  focus,
  signals: [],
  existingEntries: [highEvent],
  preferredKind: "agent_discussion" as never,
});
assert.ok(discussionDuringPriority);
assert.equal(discussionDuringPriority.kind, "agent_discussion");

const heroLines = buildHeroSpeechLines(
  {
    source: "coinw-kline",
    pool: {
      majors: [],
      trending: [],
      opportunity: [{ symbol: "AI", change24h: -44.7 }],
    },
  },
  true,
);
assert.ok(heroLines?.some((line) => line.startsWith("$AI 24h -44.7%")));

const discussion = buildWatchSupplementalEntry({
  now: 1_714_000_180_000,
  pool,
  focus,
  signals: [],
  existingEntries: [],
  preferredKind: "agent_discussion",
});
assert.ok(discussion);
assert.equal(discussion.kind, "agent_discussion");
assert.equal(discussion.responses.length, 3);
assert.match(discussion.topic, /\$DOGE|\$BTC|\$AI/);

const heartbeat = buildWatchSupplementalEntry({
  now: 1_714_000_210_000,
  pool,
  focus,
  signals: [],
  existingEntries: [],
  preferredKind: "agent_heartbeat",
});
assert.ok(heartbeat);
assert.equal(heartbeat.kind, "watch_update");
assert.equal(heartbeat.updateType, "agent_heartbeat");
assert.match(heartbeat.content, /巡检|复核|扫描/);
assert.match(heartbeat.content, /\$DOGE|\$BTC|\$AI/);

const heartbeatDuringPriority = buildWatchSupplementalEntry({
  now: 1_714_000_210_000,
  pool,
  focus,
  signals: [],
  existingEntries: [highEvent],
  preferredKind: "agent_heartbeat",
});
assert.ok(heartbeatDuringPriority);
assert.equal(heartbeatDuringPriority.kind, "watch_update");
assert.equal(heartbeatDuringPriority.updateType, "agent_heartbeat");

const discussionChat = buildStreamChatMessages(discussion, pool);
assert.equal(discussionChat.length, 3);
assert.deepEqual(discussionChat.map((item) => item.agentId), ["alpha", "beta", "gamma"]);
assert.ok(discussionChat.every((item) => item.tag === "三方会诊"));
assert.ok(discussionChat.every((item) => item.points.length >= 3));

const discussionDisplayEntries = splitStreamEntryForDisplay(discussion);
assert.equal(discussionDisplayEntries.length, 3);
assert.deepEqual(discussionDisplayEntries.map(speakerForStreamEntry), ["alpha", "beta", "gamma"]);
assert.ok(
  discussionDisplayEntries.every(
    (entry) => entry.kind === "agent_discussion" && entry.responses.length === 1,
  ),
);

const focusChat = buildStreamChatMessages(highEvent, pool);
assert.equal(focusChat.length, 1);
assert.equal(focusChat[0].tag, "高优信号");
assert.equal(focusChat[0].symbols[0], "AI");
assert.ok(focusChat[0].points.some((point) => point.label === "现价" && point.value !== "未形成"));
assert.ok(thinkDurationForStreamEntry(highEvent, 0) < thinkDurationForStreamEntry(heartbeat, 0));

const liveAgentMessage: AgentMessage = {
  kind: "agent_message",
  id: "agent-live-1",
  ts: 1_714_000_000_000,
  agentId: "alpha",
  content: "BTC 先看放量突破，没量不追。",
  symbol: "BTC",
  symbols: ["BTC"],
  triggerSignalId: "signal-1",
};
const liveAgentChat = buildStreamChatMessages(liveAgentMessage, pool);
assert.equal(liveAgentChat.length, 1);
assert.equal(liveAgentChat[0].symbols[0], "BTC");
assert.match(liveAgentChat[0].content, /\$BTC/);
assert.ok(liveAgentChat[0].points.some((point) => point.label === "突破观察" && point.value !== "未形成"));

console.log("agent watch display tests passed");
