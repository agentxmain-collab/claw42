import { readFile } from "node:fs/promises";
import path from "node:path";
import { ACTION_DESCRIPTIONS } from "@/lib/chatActions";
import { getFaction, getFactionIds } from "@/lib/factionRegistry";
import { loadRelationshipStates, relationshipContextForAgent } from "@/lib/agentRelationship";
import { formatLiveSnapshotForPrompt, type TickerSnapshot } from "@/lib/news/livePriceFetch";
import { PLAIN_SPEECH_PROMPT_BLOCK } from "@/lib/plainSpeechGuard";
import type { ChatAction, ChatMessage, ConversationSeed, FactionId, NewsItem } from "@/lib/types";

const AGENT_IP_DIR = path.join(process.cwd(), "docs", "agent-ip");
const ipDocCache: Partial<Record<FactionId, string>> = {};

export async function loadAgentIp(agentId: FactionId): Promise<string> {
  if (ipDocCache[agentId]) return ipDocCache[agentId]!;
  const faction = getFaction(agentId);
  const filePath = path.join(AGENT_IP_DIR, faction.ipDocFile);
  const content = await readFile(filePath, "utf8").catch(() => {
    return `${faction.title} · ${faction.nickname}\n${faction.catchphrases.join("\n")}`;
  });
  ipDocCache[agentId] = content;
  return content;
}

export function seedFromNews(news: NewsItem, createdAt: number): ConversationSeed {
  return {
    id: news.id,
    type: news.source === "topic-generator" ? "chitchat" : "news",
    title: news.title,
    description: news.title,
    symbols: news.currencies.map((symbol) => symbol.replace(/^\$/, "").toUpperCase()),
    sentiment: news.sentiment,
    source: news.source,
    url: news.url,
    createdAt,
  };
}

function newsBlock(seed: ConversationSeed): string {
  return [
    `type: ${seed.type}`,
    `title: ${seed.title}`,
    `description: ${seed.description}`,
    `symbols: ${seed.symbols.join(", ") || "UNKNOWN"}`,
    `sentiment: ${seed.sentiment}`,
    seed.source ? `source: ${seed.source}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function liveMarketBlock(snapshot: TickerSnapshot | null, seed: ConversationSeed): string {
  const symbols = ["BTC", "ETH", "SOL", ...seed.symbols];
  return formatLiveSnapshotForPrompt(snapshot, symbols);
}

async function relationshipBlock(agentId: FactionId): Promise<string> {
  const snapshot = await loadRelationshipStates().catch(() => null);
  return snapshot ? relationshipContextForAgent(agentId, snapshot) : "";
}

function historyBlock(history: ChatMessage[]): string {
  if (history.length === 0) return "暂无历史，直接开场。";
  return history
    .slice(-5)
    .map((message) => {
      const faction = getFaction(message.agentId);
      const mention = message.mentioning ? ` @${getFaction(message.mentioning).displayName}` : "";
      return `- ${message.id} ${faction.displayName}/${faction.nickname}${mention}: ${message.content}`;
    })
    .join("\n");
}

export async function buildChatMessagePrompt({
  agentId,
  action,
  seed,
  history,
  snapshot,
  relationshipDebt,
}: {
  agentId: FactionId;
  action: ChatAction;
  seed: ConversationSeed;
  history: ChatMessage[];
  snapshot: TickerSnapshot | null;
  relationshipDebt: string;
}): Promise<string> {
  const faction = getFaction(agentId);
  const [ip, relationship] = await Promise.all([loadAgentIp(agentId), relationshipBlock(agentId)]);
  const factionIds = getFactionIds().join("|");

  return `你是 ${faction.displayName} ${faction.title}·${faction.nickname}，加密交易江湖人物。

## 你的人设
${ip}

${relationship}
${relationshipDebt}

## 本场情境
${newsBlock(seed)}

${liveMarketBlock(snapshot, seed)}

## 最近 5 条聊天历史
${historyBlock(history)}

## 本次动作
${action}: ${ACTION_DESCRIPTIONS[action]}

${PLAIN_SPEECH_PROMPT_BLOCK}

## 聊天硬约束
- 只生成你自己的 1 条 message。
- content 1-2 句，不超过 80 个中文字符或 80 words。
- 直接说话，禁止“突破视角：”“趋势视角：”“回归视角：”“${faction.displayName} 派认为：”“基于分析”。
- 禁止“首先 / 其次 / 最后 / 综上所述 / 值得注意的是”。
- 必须引用实时市场状态里的至少 1 个具体价格、百分比或时间窗口。
- 必须出现“所以”，并在“所以”后给行动和具体价格触发条件。
- mentioning 只能是 ${factionIds} 或 null；不能 @ 自己。
- replyTo 只能填最近 5 条历史里的 message id，没引用就 null。
- citedQuote 只在 replyTo 不为 null 时填写，必须来自被引用 message 的原话片段。
- 允许轻微语气词，但不要脏话、不要空泛鼓动、不要投资承诺。

## 输出 JSON
{
  "content": "...",
  "replyTo": "message id|null",
  "mentioning": "${factionIds}|null",
  "expectsReply": true,
  "mood": "aggressive|agreeable|neutral|sarcastic|curious",
  "citedQuote": "可选，≤28 字"
}`;
}

export function buildChatStrategyPrompt(
  seed: ConversationSeed,
  messages: ChatMessage[],
  snapshot: TickerSnapshot | null,
): string {
  const primarySymbol = seed.symbols[0] ?? "BTC";
  const transcript = messages
    .map((message) => `${getFaction(message.agentId).nickname}: ${message.content}`)
    .join("\n");

  return `你是中立交易裁判，负责从 3 派聊天里提取最终策略。

## 触发源
${newsBlock(seed)}

## 完整聊天
${transcript}

${liveMarketBlock(snapshot, seed)}

## 任务
如果 3 派已经收敛到同一个方向和触发条件，输出 strategy。
如果分歧大、价格条件不一致、缺少可执行点位，输出 consensusReached=false 且 strategy=null。

## 输出 JSON
{
  "consensusReached": true,
  "strategy": {
    "consensusRatio": "3:0|2:1|1:2|0:3",
    "consensusAgents": ["${getFactionIds().join('","')}"],
    "dissentAgents": [],
    "direction": "long|short|wait",
    "symbol": "${primarySymbol}",
    "entryCondition": "必须含点位或价格触发条件",
    "stopLoss": 76500,
    "takeProfit": [78500, 79200],
    "dissentNote": "保留意见",
    "riskNote": "本页面内容均由 AI 生成，不构成投资建议"
  }
}

## 约束
- strategy 为 null 时，consensusReached 必须是 false。
- entryCondition / stopLoss / takeProfit 必须围绕实时市场状态里的 current 价格，不能偏离当前价 10% 以上。
- 不出现“可能”“建议”“或许”“首先”“其次”“综上所述”“值得注意的是”。
- 只输出 JSON，不要解释。`;
}
