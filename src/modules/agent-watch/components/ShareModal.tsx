"use client";

import type { Dict } from "@/i18n/types";
import type { NewsDebate } from "@/lib/types";

export function ShareModal({
  debate,
  labels,
  onClose,
}: {
  debate: NewsDebate | null;
  labels: Dict["agentWatch"]["newsDebate"];
  onClose: () => void;
}) {
  if (!debate) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-5">
        <h3 className="text-lg font-bold text-white">{labels.share}</h3>
        <p className="mt-2 text-sm text-white/55">{debate.newsTitle}</p>
        <a
          href={`/api/og/debate/${encodeURIComponent(debate.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"
        >
          PNG
        </a>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 rounded-xl px-4 py-2 text-sm text-white/65"
        >
          Close
        </button>
      </div>
    </div>
  );
}
