import { TEAM_MEMBER_IDS } from "@/lib/team/teamRegistry";
import type { Locale } from "@/i18n/types";

const PUBLIC_CONTENT_FORBIDDEN_PATTERNS: RegExp[] = [
  /缺失|空白|没有|暂无|数据不足|缺乏|待更新|不可用|未配置|未接入|未提供|不存在|信息真空/i,
  /等待|维持观察|维持\s*wait|后续.{0,12}更新/i,
  /无.{0,8}(?:参考|验证|分析|数据|信号|证据|映射|配置|来源|确认|结构|新闻|止损|成交量|事件)/i,
  /\b(?:missing|absent|wait|pending|insufficient|unavailable|no data|null|awaiting)\b/i,
  /\b(?:chart|news|bullish|bearish|fundamental|onchain|neutral|conservative|aggressive)[_-]?analyst\b/i,
  /\b(?:bullish|bearish|neutral|conservative|aggressive)[_-]?researcher\b/i,
  /\b(?:research|risk)[_-]?lead\b/i,
  /\bmemory[_-]?loop\b/i,
];

const TEAM_MEMBER_ID_PATTERNS = TEAM_MEMBER_IDS.map(
  (memberId) => new RegExp(`\\b${memberId.replace(/_/g, "[_-]?")}\\b`, "i"),
);

const PUBLIC_ANALYSIS_SUMMARY_MAX_CHARS = 120;
const REDUNDANT_ANALYSIS_TITLE_PATTERN =
  /^(?:今日大盘综述|热点叙事追踪|[A-Z0-9]{2,12}\s*实时行情分析)\s*[:：]\s*/i;

export function containsPublicContentLeak(value: string | undefined | null): boolean {
  if (!value) return false;
  return [...PUBLIC_CONTENT_FORBIDDEN_PATTERNS, ...TEAM_MEMBER_ID_PATTERNS].some((pattern) =>
    pattern.test(value),
  );
}

export function isPublicDecisionTextClean(value: string | undefined | null): value is string {
  return Boolean(value?.trim()) && !containsPublicContentLeak(value);
}

export function cleanPublicDecisionText(
  value: string | undefined | null,
  _locale?: Locale,
): string | null {
  void _locale;
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return containsPublicContentLeak(trimmed) ? null : trimmed;
}

export function cleanPublicAnalysisSummary(
  value: string | undefined | null,
  locale?: Locale,
): string | null {
  const cleaned = cleanPublicDecisionText(value, locale);
  if (!cleaned) return null;
  const withoutTitle = cleaned.replace(REDUNDANT_ANALYSIS_TITLE_PATTERN, "").trim() || cleaned;
  return truncatePublicAnalysisSummary(withoutTitle);
}

function truncatePublicAnalysisSummary(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const firstSentenceMatch = /[。！？.!?]/.exec(normalized);
  const firstSentenceEnd =
    firstSentenceMatch?.index === undefined
      ? -1
      : firstSentenceMatch.index + firstSentenceMatch[0].length;
  if (firstSentenceEnd >= 18) return normalized.slice(0, firstSentenceEnd).trim();
  if (normalized.length <= PUBLIC_ANALYSIS_SUMMARY_MAX_CHARS) return normalized;

  const boundary = findSentenceBoundary(normalized, PUBLIC_ANALYSIS_SUMMARY_MAX_CHARS);
  if (boundary >= 32) return normalized.slice(0, boundary).trim();

  return `${normalized.slice(0, PUBLIC_ANALYSIS_SUMMARY_MAX_CHARS - 1).trim()}…`;
}

function findSentenceBoundary(value: string, maxLength: number) {
  let boundary = -1;
  const sentenceEndPattern = /[。！？.!?]/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceEndPattern.exec(value))) {
    const end = match.index + match[0].length;
    if (end > maxLength) break;
    boundary = end;
  }
  return boundary;
}

export function publicContentForbiddenTermsForReport() {
  return [
    "缺失",
    "空白",
    "没有",
    "无 X",
    "等待",
    "wait",
    "维持观察",
    "暂无",
    "数据不足",
    "缺乏",
    "待更新",
    "后续 X 更新",
    "missing",
    "absent",
    "pending",
    "insufficient",
    "unavailable",
    "no data",
    "null",
    "awaiting",
    ...TEAM_MEMBER_IDS,
  ];
}
