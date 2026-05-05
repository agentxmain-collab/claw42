import { checkAgentSpeech, recordAgentSpoke } from "@/lib/agentSpeechGuard";
import { emotionFromContext, emojiForEmotion } from "@/lib/agentEmotion";
import { debatePacingForSeverity } from "@/lib/debatePacing";
import { getFaction, getFactionIds, isFactionId } from "@/lib/factionRegistry";
import { fakeFollowCount } from "@/lib/fakeFollowCount";
import {
  buildDebateR1Prompt,
  buildDebateR2Prompt,
  buildDebateR3Prompt,
} from "@/lib/llmPromptBuilder";
import {
  antiMechanicalFallback,
  generateLlmText,
  hasMechanicalOutput,
} from "@/lib/llmFallbackChain";
import { classifyNewsTrigger } from "@/lib/newsTriggers";
import { buildCoinwDeeplink } from "@/lib/strategyDeeplink";
import type { SignalRecord } from "@/modules/agent-watch/types";
import type {
  ConsensusRatio,
  DebateDirection,
  DebateRound,
  FactionId,
  FinalStrategy,
  NewsDebate,
  NewsItem,
  Utterance,
  UtterancePrefix,
} from "@/lib/types";

const debateStore = new Map<string, NewsDebate>();
const VALID_PREFIXES = new Set<Exclude<UtterancePrefix, null>>([
  "rebut",
  "taunt",
  "sneer",
  "mock",
  "cool",
  "remind",
  "agree",
  "reflect",
]);

function parseObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return JSON.parse(jsonText) as Record<string, unknown>;
}

function fallbackUtterance(
  agentId: FactionId,
  news: NewsItem,
  ts: number,
  round: number,
): Utterance {
  const faction = getFaction(agentId);
  const content = `${faction.nickname}：${news.currencies[0] ?? "BTC"} ${faction.catchphrases[round % faction.catchphrases.length]}`;
  const emotion = emotionFromContext({ agentId, sentiment: news.sentiment });
  return {
    id: `${news.id}:${agentId}:fallback:${round}:${ts}`,
    agentId,
    content,
    prefix: null,
    emoji: emojiForEmotion(agentId, emotion),
    emotion,
    isGoldenLine: false,
    ts,
  };
}

function syntheticSignal(agentId: FactionId, news: NewsItem, ts: number): SignalRecord {
  const faction = getFaction(agentId);
  return {
    id: `news-${news.id}-${agentId}`,
    ts,
    symbol: news.currencies[0] ?? "BTC",
    type: faction.signalTypes[0] ?? "breakout",
    severity: "watch",
    payload: { description: news.title },
  };
}

async function callDebateJson(prompt: string, fallback: Record<string, unknown>) {
  const first = await generateLlmText(prompt);
  if (!first) return fallback;
  if (!hasMechanicalOutput(first.text)) return parseObject(first.text);

  const retry = await generateLlmText(
    `${prompt}\n\n上一版太机械，重写：不要铺垫，不要套话，只输出 JSON。`,
  );
  if (!retry || hasMechanicalOutput(retry.text)) return fallback;
  return parseObject(retry.text);
}

async function generateR1(agentId: FactionId, news: NewsItem, ts: number): Promise<Utterance> {
  const signal = syntheticSignal(agentId, news, ts);
  const decision = checkAgentSpeech(agentId, [signal], ts);
  const fallback = fallbackUtterance(agentId, news, ts, 1);
  if (!decision.shouldSpeak) return fallback;

  const raw = await callDebateJson(await buildDebateR1Prompt(agentId, news), {
    content: fallback.content,
    isGoldenLine: false,
  });
  const content = antiMechanicalFallback(
    String(raw.content ?? fallback.content),
    fallback.content,
  ).slice(0, 140);
  const isGoldenLine = Boolean(raw.isGoldenLine);
  const emotion = emotionFromContext({ agentId, sentiment: news.sentiment, isGoldenLine });
  return {
    id: `${news.id}:${agentId}:r1:${ts}`,
    agentId,
    content,
    prefix: null,
    emoji: emojiForEmotion(agentId, emotion),
    emotion,
    isGoldenLine,
    ts,
  };
}

async function generateR2(
  agentId: FactionId,
  news: NewsItem,
  ownR1: Utterance,
  otherR1: Utterance[],
  ts: number,
): Promise<Utterance> {
  const signal = syntheticSignal(agentId, news, ts);
  const decision = checkAgentSpeech(agentId, [signal], ts);
  const fallback = fallbackUtterance(agentId, news, ts, 2);
  if (!decision.shouldSpeak) return { ...fallback, id: `${news.id}:${agentId}:r2:fallback:${ts}` };

  const cited = otherR1[0] ?? ownR1;
  const raw = await callDebateJson(await buildDebateR2Prompt(agentId, ownR1, otherR1), {
    content: fallback.content,
    prefix: "rebut",
    citedAgentId: cited.agentId,
    citedQuote: cited.content.slice(0, 30),
    isGoldenLine: false,
  });
  const prefix = VALID_PREFIXES.has(raw.prefix as Exclude<UtterancePrefix, null>)
    ? (raw.prefix as Exclude<UtterancePrefix, null>)
    : "rebut";
  const rawCitedAgentId = String(raw.citedAgentId);
  const citedAgentId: FactionId = isFactionId(rawCitedAgentId) ? rawCitedAgentId : cited.agentId;
  const content = antiMechanicalFallback(
    String(raw.content ?? fallback.content),
    fallback.content,
  ).slice(0, 140);
  const isGoldenLine = Boolean(raw.isGoldenLine);
  const emotion = emotionFromContext({ agentId, sentiment: news.sentiment, prefix, isGoldenLine });
  return {
    id: `${news.id}:${agentId}:r2:${ts}`,
    agentId,
    content,
    prefix,
    emoji: emojiForEmotion(agentId, emotion),
    emotion,
    citedAgentId,
    citedQuote: String(raw.citedQuote ?? cited.content).slice(0, 30),
    isGoldenLine,
    ts,
  };
}

function normalizeDirection(value: unknown): DebateDirection {
  return value === "long" || value === "short" || value === "wait" ? value : "wait";
}

function normalizeConsensusRatio(value: unknown): ConsensusRatio {
  return value === "3:0" || value === "2:1" || value === "1:2" || value === "0:3" ? value : "1:2";
}

async function generateStrategy(
  news: NewsItem,
  utterances: Utterance[],
  ts: number,
): Promise<FinalStrategy> {
  const primarySymbol = news.currencies[0] ?? "BTC";
  const raw = await callDebateJson(buildDebateR3Prompt(news, utterances), {
    symbol: primarySymbol,
    direction: "wait",
    entryCondition: `${primarySymbol} 等 5min K 线重新站回关键位`,
    stopLoss: 0,
    takeProfit: [],
    consensusRatio: "1:2",
    consensusAgents: [],
    dissentAgents: getFactionIds(),
    dissentNote: "三派未达成一致",
    riskNote: "新闻驱动波动大，等待二次确认",
  });
  const createdAt = ts;
  const id = `${news.id}:strategy:${createdAt}`;
  const counts = fakeFollowCount(id, createdAt);
  const strategy: FinalStrategy = {
    id,
    symbol: String(raw.symbol ?? primarySymbol)
      .replace(/^\$/, "")
      .toUpperCase(),
    direction: normalizeDirection(raw.direction),
    entryCondition: String(raw.entryCondition ?? `${primarySymbol} 等关键位确认`).slice(0, 80),
    stopLoss: Number(raw.stopLoss) || 0,
    takeProfit: Array.isArray(raw.takeProfit)
      ? raw.takeProfit.map(Number).filter((value) => Number.isFinite(value))
      : [],
    consensusRatio: normalizeConsensusRatio(raw.consensusRatio),
    consensusAgents: Array.isArray(raw.consensusAgents)
      ? raw.consensusAgents.map(String).filter(isFactionId)
      : [],
    dissentAgents: Array.isArray(raw.dissentAgents)
      ? raw.dissentAgents.map(String).filter(isFactionId)
      : [],
    dissentNote: String(raw.dissentNote ?? "").slice(0, 80),
    riskNote: String(raw.riskNote ?? "本页面内容均由 AI 生成，不构成投资建议。").slice(0, 100),
    followCount: counts.followCount,
    viewCount: counts.viewCount,
    createdAt,
    expiresAt: createdAt + 30 * 60_000,
    deeplink: "",
  };
  strategy.deeplink = buildCoinwDeeplink(strategy);
  return strategy;
}

function intensityScore(rounds: DebateRound[]): NewsDebate["intensityScore"] {
  const utterances = rounds.flatMap((round) => round.utterances);
  const spice = utterances.filter((utterance) => utterance.prefix || utterance.isGoldenLine).length;
  return Math.min(5, Math.max(1, Math.ceil(spice / 2))) as NewsDebate["intensityScore"];
}

async function buildNewsDebate(
  news: NewsItem,
  trigger: ReturnType<typeof classifyNewsTrigger>,
  now: number,
): Promise<NewsDebate> {
  const pacing = debatePacingForSeverity(trigger.severity);
  const factionIds = getFactionIds();
  const r1 = await Promise.all(factionIds.map((agentId) => generateR1(agentId, news, now)));
  const r2: Utterance[] = [];

  for (const agentId of factionIds) {
    const own = r1.find((utterance) => utterance.agentId === agentId)!;
    const others = r1.filter((utterance) => utterance.agentId !== agentId);
    r2.push(await generateR2(agentId, news, own, others, now + r2.length * 1000));
  }

  const rounds: DebateRound[] = [
    { roundNumber: 1, roundType: "independent", utterances: r1, startedAt: now },
    {
      roundNumber: 2,
      roundType: "rebuttal",
      utterances: r2,
      startedAt: now + pacing.roundTwoDelayMs,
    },
  ];
  const strategy = await generateStrategy(news, [...r1, ...r2], now + pacing.strategyRevealDelayMs);
  factionIds.forEach((agentId) => recordAgentSpoke(agentId, now));

  const debate: NewsDebate = {
    id: `debate:${news.id}`,
    ts: now,
    newsId: news.id,
    newsTitle: news.title,
    newsUrl: news.url,
    newsSource: news.source,
    newsSentiment: news.sentiment,
    newsCurrencies: news.currencies,
    rounds,
    finalStrategy: strategy,
    intensityScore: intensityScore(rounds),
    status: "completed",
    createdAt: now,
    completedAt: Date.now(),
    layers: {
      source: news,
      trigger,
      pacing,
      rounds,
      strategy,
      replay: null,
    },
  };
  debateStore.set(debate.id, debate);
  return debate;
}

export async function tryOrchestrateNewsDebate(
  news: NewsItem,
  now = Date.now(),
): Promise<NewsDebate | null> {
  const trigger = classifyNewsTrigger(news, now);
  if (!trigger.shouldAutoDebate) return null;
  return buildNewsDebate(news, trigger, now);
}

export async function orchestrateNewsDebate(news: NewsItem, now = Date.now()): Promise<NewsDebate> {
  const trigger = classifyNewsTrigger(news, now);
  return buildNewsDebate(news, trigger, now);
}

export function listNewsDebates(limit = 20): NewsDebate[] {
  return Array.from(debateStore.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function getNewsDebate(id: string): NewsDebate | null {
  return debateStore.get(id) ?? null;
}
