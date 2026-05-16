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
