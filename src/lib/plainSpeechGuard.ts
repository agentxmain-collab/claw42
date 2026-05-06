const BANNED_TERM_PATTERNS = [
  /\bEMA(?:12|13|144|169)?\b/i,
  /\bMACD\b/i,
  /\bRSI\b/i,
  /布林/,
  /K\s*线/i,
  /均线共振/,
];

const ACTION_WORDS = [
  "等",
  "看",
  "追",
  "不追",
  "跟",
  "不跟",
  "止盈",
  "止损",
  "观察",
  "确认",
  "暂停",
  "站稳",
  "跌破",
  "破",
];

export const PLAIN_SPEECH_PROMPT_BLOCK = `## 白话化硬规则

必须把术语翻译成普通用户能看懂的价格判断：
- ❌ "EMA12/13 共振" → ✅ "短期线在 80950 / 中期线在 80920，两条线在 80950 附近合上"
- ❌ "BTC 突破前高" → ✅ "BTC 现价 81665，比上周高点 81450 高 215"
- ❌ "等 5min K 线确认" → ✅ "再看 5 分钟，如果价格稳在 81000 上方，就算确认"
- ❌ "极端涨速" → ✅ "30 分钟从 80200 拉到 81665，涨了 1.8%，太快可能回吐"
- ❌ "趋势没破" → ✅ "BTC 从昨晚到现在一直在 80500 上方，这条线没破就是涨势"

硬约束：
- 发言必须含具体数字。
- 禁止 EMA / MACD / RSI / 布林 / K 线 / 均线共振 等术语原样出现。
- 必须出现“所以”，并在“所以”后给具体动作或观察条件。
- “所以”后的结论必须含数字或明确动作词。`;

export interface PlainSpeechValidation {
  ok: boolean;
  reasons: string[];
}

function hasNumber(content: string): boolean {
  return /[$¥]?\d+(?:,\d{3})*(?:\.\d+)?%?/.test(content);
}

function hasBannedTerm(content: string): boolean {
  return BANNED_TERM_PATTERNS.some((pattern) => pattern.test(content));
}

function hasConclusionAnchor(content: string): boolean {
  const match = content.match(/所以([^。；;\n]+)/);
  if (!match) return false;
  const conclusion = match[1] ?? "";
  return hasNumber(conclusion) || ACTION_WORDS.some((word) => conclusion.includes(word));
}

export function validatePlainSpeech(content: string): PlainSpeechValidation {
  const reasons: string[] = [];
  const text = content.trim();

  if (text.length < 8) reasons.push("内容太短");
  if (!hasNumber(text)) reasons.push("缺少具体数字");
  if (hasBannedTerm(text)) reasons.push("术语未白话化");
  if (!hasConclusionAnchor(text)) reasons.push("缺少“所以”结论锚");

  return { ok: reasons.length === 0, reasons };
}

export function plainSpeechRetryInstruction(reasons: string[]): string {
  return [
    "上一版发言未通过白话校验。",
    `失败原因：${reasons.join("；") || "未知"}`,
    "请重写 content，只输出同样 JSON 结构，不要解释。",
    PLAIN_SPEECH_PROMPT_BLOCK,
  ].join("\n\n");
}
