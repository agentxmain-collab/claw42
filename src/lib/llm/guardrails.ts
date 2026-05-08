import { FORBIDDEN_PREFIX_PATTERNS, sanitizeChatContent } from "@/lib/chatGuardrails";

const MECHANICAL_OUTPUT_PATTERNS = [
  ...FORBIDDEN_PREFIX_PATTERNS,
  /作为\s*(?:Alpha|Beta|Gamma|[^\s，,。]{1,8}派)/i,
  /首先/,
  /其次/,
  /综上所述/,
  /值得注意的是/,
  /^.*?[:：]\s*(?:破位|趋势|Gamma\s*复核|观察状态)/i,
];

export function hasMechanicalOutput(text: string, taskTag = "generic"): boolean {
  void taskTag;
  const trimmed = text.trim();
  return MECHANICAL_OUTPUT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function cleanMechanicalText(text: string): string {
  return sanitizeChatContent(text)
    .replace(/作为\s*(?:Alpha|Beta|Gamma)\s*派?[，,：:\s]*/gi, "")
    .replace(/作为\s*(?:Alpha|Beta|Gamma|[^\s，,。]{1,8}派)[，,：:\s]*/gi, "")
    .replace(/(?:首先|其次|综上所述|值得注意的是)[，,：:\s]*/g, "")
    .trim();
}

export function antiMechanicalFallback(text: string, fallback?: string): string {
  if (!hasMechanicalOutput(text)) return text.trim();
  const cleaned = cleanMechanicalText(text);
  return cleaned || fallback || "";
}

export function buildGuardrailRetryPrompt(prompt: string, rejectedText: string): string {
  return `${prompt}

上一次输出被系统拒绝，原因是带报告前缀或机械套话。
被拒绝文本：
${rejectedText}

请直接改写为自然短句，不要使用"首先/其次/综上/作为某派/某某视角："等格式。`;
}

export async function applyGuardrails(text: string, taskTag = "generic"): Promise<string> {
  if (!hasMechanicalOutput(text, taskTag)) return text.trim();
  return antiMechanicalFallback(text);
}
