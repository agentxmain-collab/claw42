"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { NewsEvidence } from "@/lib/news/newsEvidence";

const EvidenceMapContext = createContext<Record<string, NewsEvidence>>({});

export function EvidenceMapProvider({
  value,
  children,
}: {
  value: Record<string, NewsEvidence>;
  children: ReactNode;
}) {
  return <EvidenceMapContext.Provider value={value}>{children}</EvidenceMapContext.Provider>;
}

function relativeTimeLabel(publishedAt: string, locale: string) {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return "";
  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const unit: Intl.RelativeTimeFormatUnit =
    absSeconds < 3600 ? "minute" : absSeconds < 86_400 ? "hour" : "day";
  const divisor = unit === "minute" ? 60 : unit === "hour" ? 3600 : 86_400;
  const value = Math.round(diffSeconds / divisor);
  return new Intl.RelativeTimeFormat(locale.replace("_", "-"), { numeric: "auto" }).format(
    value,
    unit,
  );
}

export function CitationChip({
  evidenceId,
  index,
  label,
  renderEmpty = false,
}: {
  evidenceId: string;
  index: number;
  label?: string;
  renderEmpty?: boolean;
}) {
  const { t, locale } = useI18n();
  const evidence = useContext(EvidenceMapContext)[evidenceId];
  if (!evidence && !renderEmpty) return null;
  const display = evidence
    ? `${evidence.source} · ${relativeTimeLabel(evidence.publishedAt, locale)}`
    : t.agentWatch.citationChip.sourceUnavailable;
  const content = (
    <>
      <span>{label ?? `C${index + 1}`}</span>
      <span className="max-w-[11rem] truncate text-violet-100/65">{display}</span>
    </>
  );

  const className =
    "inline-flex items-center gap-1 rounded-full border border-violet-300/25 bg-violet-300/[0.08] px-2 py-1 text-[11px] font-semibold text-violet-100";

  return evidence?.url ? (
    <a
      href={evidence.url}
      target="_blank"
      rel="noreferrer"
      className={className}
      title={evidence.title}
    >
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}
