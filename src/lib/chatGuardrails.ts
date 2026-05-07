export interface ChatGuardrailValidation {
  ok: boolean;
  reasons: string[];
}

type MentionFloorMessage = {
  mentioning?: unknown;
  citedQuote?: unknown;
};

const FACTION_ALIAS_PATTERN = "(?:Alpha|Beta|Gamma|老\\s*K|老\\s*白|老\\s*G|老K|老白|老G)";

const REPORT_ACTION_PATTERN =
  "(?:突破|破位|趋势|极端|回归|反转|顺势|逆势|追涨|杀跌|盘整|横盘)";

export const FORBIDDEN_PREFIX_PATTERNS: RegExp[] = [
  new RegExp(`^\\s*${FACTION_ALIAS_PATTERN}\\s*[:：]`, "i"),
  new RegExp(`^\\s*${REPORT_ACTION_PATTERN}\\s*[:：]`, "i"),
  /^\s*(?:突破派|趋势派|回归派|破位派|极端派)\s*[:：]/,
  new RegExp(
    `^\\s*${FACTION_ALIAS_PATTERN}\\s*(?:说|看|认为|分析|视角|观察|复核|提点|怒怼|阴阳|追问|反驳|附议|嘲讽|判断|评论)\\s*[:：]`,
    "i",
  ),
  /(?:突破|趋势|回归|破位|极端|反转)\s*视角\s*[:：]/,
  /(?:突破派|趋势派|回归派)\s*认为\s*[:：]/,
  /^\s*(?:首先|其次|再次|然后|最后|总之|综上)\s*[，,：:]/,
  /^\s*(?:等待条件|市场摘要|本次摘要|当前判断|核心观点|结论|总结|风险提示)\s*[:：]/,
  /^\s*(?:实时上下文|上下文|刷新|下一跳|信号触发|事件触发|队列|推送|钩子|回调)\s*[:：]/,
  /^\s*(?:评估|判断|看法|观点|意见)\s*[:：]/,
  /^\s*(?:EMA12\/13|EMA12|EMA13|MACD|RSI|布林|K\s*线)\s*[:：]/i,
  /^\s*(?:Gamma|Alpha|Beta|老\s*K|老\s*白|老\s*G)\s*(?:复核|追问|反驳|同意|补充)\s*[:：]/i,
];

const FORBIDDEN_PREFIX_CLEANERS: RegExp[] = [
  new RegExp(`^\\s*${FACTION_ALIAS_PATTERN}\\s*[:：]\\s*`, "i"),
  new RegExp(`^\\s*${REPORT_ACTION_PATTERN}\\s*[:：]\\s*`, "i"),
  /^\s*(?:突破派|趋势派|回归派|破位派|极端派)\s*[:：]\s*/,
  new RegExp(
    `^\\s*${FACTION_ALIAS_PATTERN}\\s*(?:说|看|认为|分析|视角|观察|复核|提点|怒怼|阴阳|追问|反驳|附议|嘲讽|判断|评论)\\s*[:：]\\s*`,
    "i",
  ),
  /^(?:突破|趋势|回归|破位|极端|反转)\s*视角\s*[:：]\s*/,
  /^(?:突破派|趋势派|回归派)\s*认为\s*[:：]\s*/,
  /^\s*(?:首先|其次|再次|然后|最后|总之|综上)\s*[，,：:]\s*/,
  /^\s*(?:等待条件|市场摘要|本次摘要|当前判断|核心观点|结论|总结|风险提示)\s*[:：]\s*/,
  /^\s*(?:实时上下文|上下文|刷新|下一跳|信号触发|事件触发|队列|推送|钩子|回调)\s*[:：]\s*/,
  /^\s*(?:评估|判断|看法|观点|意见)\s*[:：]\s*/,
  /^\s*(?:EMA12\/13|EMA12|EMA13|MACD|RSI|布林|K\s*线)\s*[:：]\s*/i,
  /^\s*(?:Gamma|Alpha|Beta|老\s*K|老\s*白|老\s*G)\s*(?:复核|追问|反驳|同意|补充)\s*[:：]\s*/i,
  /^\s*[-—:：]\s*/,
];

const AMBIGUOUS_ACTION_PATTERN =
  /(再\s*)?(追|跟|做|动手|干|上车|入场|建仓|加仓|减仓|清仓|抄|砸)(?!\s*(?:做)?(?:多|空|等|不动|盘))/g;

export function sanitizeChatContent(content: string): string {
  let text = content.trim();
  let previous = "";
  let guard = 0;

  while (text !== previous && guard < 8) {
    previous = text;
    FORBIDDEN_PREFIX_CLEANERS.forEach((pattern) => {
      text = text.replace(pattern, "").trim();
    });
    guard += 1;
  }

  return text;
}

function hashNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function shouldForceMentionForFloor(
  messages: MentionFloorMessage[],
  currentTurn: number,
  seedId: string,
): boolean {
  if (currentTurn >= 6) return false;
  const mentionsSoFar = messages
    .slice(0, currentTurn)
    .filter((message) => message.mentioning && message.citedQuote).length;
  const remainingTurns = 6 - currentTurn;
  const stillNeed = 2 - mentionsSoFar;
  if (stillNeed <= 0) return false;
  if (remainingTurns <= stillNeed) return true;
  return hashNumber(`${seedId}:mention-floor:${currentTurn}`) % 10 < 7;
}

export function validateActionDirection(content: string): string[] {
  const reasons: string[] = [];
  AMBIGUOUS_ACTION_PATTERN.lastIndex = 0;
  if (AMBIGUOUS_ACTION_PATTERN.test(content)) {
    reasons.push("动作词缺少明确方向");
  }
  return reasons;
}

export function validateChatContent(content: string): ChatGuardrailValidation {
  const reasons: string[] = [];
  const text = content.trim();

  if (Array.from(text).length > 80) reasons.push("超过 80 字");
  if (FORBIDDEN_PREFIX_PATTERNS.some((pattern) => pattern.test(text))) {
    reasons.push("含报告前缀或套话");
  }
  reasons.push(...validateActionDirection(text));

  return { ok: reasons.length === 0, reasons };
}
