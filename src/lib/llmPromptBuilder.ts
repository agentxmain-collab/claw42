import { readFile } from "node:fs/promises";
import path from "node:path";
import { getFaction, getFactionIds } from "@/lib/factionRegistry";
import type { FactionId, NewsItem, Utterance } from "@/lib/types";

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

function newsBlock(news: NewsItem): string {
  return [
    `title: ${news.title}`,
    `currencies: ${news.currencies.join(", ") || "UNKNOWN"}`,
    `sentiment: ${news.sentiment}`,
    `source: ${news.source}`,
  ].join("\n");
}

export async function buildDebateR1Prompt(agentId: FactionId, news: NewsItem): Promise<string> {
  const faction = getFaction(agentId);
  const ip = await loadAgentIp(agentId);
  return `你是 ${faction.displayName} ${faction.title}·${faction.nickname}，加密交易江湖人物。

## 你的人设
${ip}

## 触发新闻
${newsBlock(news)}

## 输出 JSON
{
  "content": "1-2 句你的独立观点。直接说事，不要客套",
  "isGoldenLine": false
}

## 约束
- 字数 30-80
- 直接说事，不要“作为 ${faction.displayName}”这种铺垫
- 至少引用新闻里的一个具体词或数据点
- 用江湖人物口吻，可以用招牌话术但不要复读
- 不允许“可能”“或许”“建议”“首先”“其次”“综上所述”“值得注意的是”
- 不允许 cite 别的 Agent`;
}

export async function buildDebateR2Prompt(
  agentId: FactionId,
  ownR1: Utterance,
  otherR1: Utterance[],
): Promise<string> {
  const faction = getFaction(agentId);
  const ip = await loadAgentIp(agentId);
  const others = otherR1
    .map((utterance) => `- ${getFaction(utterance.agentId).displayName}: "${utterance.content}"`)
    .join("\n");

  return `你是 ${faction.displayName} ${faction.title}·${faction.nickname}。

## 你的人设
${ip}

## 你的 R1 观点
${ownR1.content}

## 其他 2 派的 R1 观点
${others}

## 任务
挑其中 1 派的 R1 观点反驳 / 嘲讽 / 提点 / 阴阳。

## 输出 JSON
{
  "content": "1-2 句反驳",
  "prefix": "rebut|taunt|sneer|mock|cool|remind",
  "citedAgentId": "${getFactionIds().join("|")}",
  "citedQuote": "你引用对方的原句（≤30 字）",
  "isGoldenLine": false
}

## 约束
- content 必须呼应 citedQuote
- prefix 强制不为空
- 字数 25-60
- 毒舌可以但不能脏话
- 不允许“可能”“或许”“建议”“首先”“其次”“综上所述”“值得注意的是”`;
}

export function buildDebateR3Prompt(news: NewsItem, utterances: Utterance[]): string {
  const lines = utterances
    .map((utterance) => {
      const faction = getFaction(utterance.agentId);
      return `- ${faction.displayName}/${faction.nickname}: ${utterance.content}`;
    })
    .join("\n");
  const primarySymbol = news.currencies[0] ?? "BTC";

  return `你是中立的辩论裁判，不是 3 派之一。

## 触发新闻
${newsBlock(news)}

## 3 派 R1 + R2 全部内容
${lines}

## 输出 JSON
{
  "consensusRatio": "3:0|2:1|1:2|0:3",
  "consensusAgents": ["${getFactionIds().join('","')}"],
  "dissentAgents": [],
  "direction": "long|short|wait",
  "symbol": "${primarySymbol}",
  "entryCondition": "具体的入场条件描述，必须含点位或K线条件",
  "stopLoss": 76500,
  "takeProfit": [78500, 79200],
  "dissentNote": "保留意见的核心论点",
  "riskNote": "本场关键风险提示"
}

## 约束
- direction = wait 时，entryCondition / stopLoss / takeProfit 仍要填
- consensusRatio 严格按 3 派最终方向投票
- 不出现“可能”“建议”“或许”“首先”“其次”“综上所述”“值得注意的是”
- entryCondition 必须可执行`;
}
