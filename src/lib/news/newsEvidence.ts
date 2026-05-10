import type { NewsItem } from "@/lib/types";

export type NewsEvidenceSeverity = "low" | "medium" | "high";

export interface NewsEvidence {
  id: string;
  source: string;
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

export function newsItemToEvidence(
  item: NewsItem,
  fetchedAt = new Date().toISOString(),
): NewsEvidence {
  const publishedAt = new Date(item.publishedAt).toISOString();
  return {
    id: generateEvidenceId(item.url, publishedAt),
    source: item.source,
    title: item.title,
    url: item.url,
    publishedAt,
    fetchedAt,
    symbol: Array.from(
      new Set(item.currencies.map((symbol) => symbol.replace(/^\$/, "").toUpperCase())),
    ),
    impactSeverity: evidenceSeverityFromNews(item),
    summary: item.title,
  };
}
