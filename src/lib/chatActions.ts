import { getFactionIds } from "@/lib/factionRegistry";
import type { ChatAction, ChatMessage, FactionId } from "@/lib/types";

export const CHAT_ACTIONS: ChatAction[] = [
  "open",
  "rebut",
  "agree",
  "question",
  "taunt",
  "derail",
  "refocus",
  "comment",
  "react",
  "concede",
  "gloat",
];

export const ACTION_EMOJI: Record<ChatAction, string> = {
  open: "▶",
  rebut: "✦",
  agree: "✓",
  question: "?",
  taunt: "!",
  derail: "↯",
  refocus: "◆",
  comment: "•",
  react: "·",
  concede: "↘",
  gloat: "▲",
};

export const ACTION_DESCRIPTIONS: Record<ChatAction, string> = {
  open: "开场，直接抛出第一个判断",
  rebut: "反驳上一条，但必须回到价格条件",
  agree: "附议上一条，并补一个具体触发价",
  question: "追问对方要确认条件",
  taunt: "轻微嘲讽，但不能离开行情",
  derail: "短暂跑偏，但必须用一句话拉回行情",
  refocus: "把话题拉回价格和触发条件",
  comment: "自由评论当前信号",
  react: "短反应，必须补一个数字",
  concede: "让步承认对方有一点道理",
  gloat: "小得意，但必须给下一步条件",
};

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function weightedPick<T extends string>(weights: Partial<Record<T, number>>, key: string): T {
  const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0) as Array<
    [T, number]
  >;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const value = hashString(key) % Math.max(1, total);
  let cursor = 0;
  for (const [item, weight] of entries) {
    cursor += weight;
    if (value < cursor) return item;
  }
  return entries[0]![0];
}

export function pickNextSpeaker(messages: ChatMessage[]): FactionId | null {
  const last = messages[messages.length - 1];
  const factionIds = getFactionIds();
  if (!last) return factionIds[0] ?? null;

  if (last.mentioning && last.mentioning !== last.agentId) return last.mentioning;

  const candidates = factionIds.filter((agentId) => agentId !== last.agentId);
  if (candidates.length === 0) return null;

  const lastSpokeAt = new Map<FactionId, number>();
  messages.forEach((message, index) => lastSpokeAt.set(message.agentId, index));

  if (!last.expectsReply) {
    const silent = candidates.sort(
      (a, b) => (lastSpokeAt.get(a) ?? -1) - (lastSpokeAt.get(b) ?? -1),
    );
    const oldest = silent[0];
    const oldestIndex = oldest ? (lastSpokeAt.get(oldest) ?? -1) : messages.length;
    return messages.length - oldestIndex >= 5 ? oldest : null;
  }

  return candidates
    .map((agentId) => ({
      agentId,
      score: messages.length - (lastSpokeAt.get(agentId) ?? -1),
    }))
    .sort((a, b) => b.score - a.score)[0]!.agentId;
}

export function pickAction(
  agentId: FactionId,
  history: ChatMessage[],
  relationshipDebt: number,
): ChatAction {
  const last = history[history.length - 1];
  if (!last) return "open";
  const key = `${agentId}:${history.length}:${last.id}:${relationshipDebt}`;

  if (last.mentioning === agentId) {
    if (relationshipDebt > 5) {
      return weightedPick<ChatAction>({ concede: 35, question: 30, agree: 25, rebut: 10 }, key);
    }
    if (relationshipDebt < -5) {
      return weightedPick<ChatAction>({ taunt: 30, gloat: 25, rebut: 30, question: 15 }, key);
    }
    return weightedPick<ChatAction>(
      { rebut: 30, question: 25, agree: 20, taunt: 15, concede: 10 },
      key,
    );
  }

  if (last.expectsReply) {
    return weightedPick<ChatAction>(
      { rebut: 25, agree: 20, question: 20, comment: 15, react: 10, taunt: 10 },
      key,
    );
  }

  return weightedPick<ChatAction>(
    { comment: 35, react: 25, derail: 15, refocus: 10, taunt: 15 },
    key,
  );
}

export function actionEmoji(action: ChatAction): string {
  return ACTION_EMOJI[action] ?? "•";
}
