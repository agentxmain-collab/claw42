import type { NewsItem } from "@/lib/types";

export type NewsEvidenceSeverity = "low" | "medium" | "high";

export interface NewsEvidence {
  id: string;
  source: string;
  sourceDomain?: string;
  title: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  symbol: string[];
  impactSeverity: NewsEvidenceSeverity;
  summary: string;
}

export function generateEvidenceId(url: string, publishedAt: string): string {
  const input = `${url.trim().toLowerCase()}|${publishedAt}`;
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `ev_${(hash >>> 0).toString(36)}`;
}

export function evidenceSeverityFromNews(item: NewsItem): NewsEvidenceSeverity {
  const importantVotes = item.votes?.important ?? 0;
  if (importantVotes >= 5) return "high";
  if (item.sentiment !== "neutral" || importantVotes >= 2) return "medium";
  return "low";
}

function normalizeEvidenceSymbol(symbol: string) {
  return symbol.trim().replace(/^\$+/, "").toUpperCase();
}

function normalizeSourceDomain(value: string | undefined) {
  const domain = value?.trim().toLowerCase();
  if (!domain) return undefined;
  return (
    domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0] || undefined
  );
}

function sourceDomainFromNews(item: NewsItem) {
  const explicitDomain = normalizeSourceDomain(item.sourceDomain);
  if (explicitDomain) return explicitDomain;
  try {
    return normalizeSourceDomain(new URL(item.url).hostname);
  } catch {
    return undefined;
  }
}

function safeIsoDate(value: unknown, fallback: string) {
  const date = new Date(value as string | number | Date);
  if (Number.isFinite(date.getTime())) return date.toISOString();
  const fallbackDate = new Date(fallback);
  return Number.isFinite(fallbackDate.getTime())
    ? fallbackDate.toISOString()
    : new Date().toISOString();
}

export function newsItemToEvidence(
  item: NewsItem,
  fetchedAt = new Date().toISOString(),
): NewsEvidence {
  const normalizedFetchedAt = safeIsoDate(fetchedAt, new Date().toISOString());
  const publishedAt = safeIsoDate(item.publishedAt, normalizedFetchedAt);
  return {
    id: generateEvidenceId(item.url, publishedAt),
    source: item.source,
    sourceDomain: sourceDomainFromNews(item),
    title: item.title,
    url: item.url,
    publishedAt,
    fetchedAt: normalizedFetchedAt,
    symbol: Array.from(new Set(item.currencies.map(normalizeEvidenceSymbol).filter(Boolean))),
    impactSeverity: evidenceSeverityFromNews(item),
    summary: item.title,
  };
}
