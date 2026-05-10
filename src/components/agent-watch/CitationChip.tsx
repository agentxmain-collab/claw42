"use client";

export function CitationChip({
  evidenceId,
  index,
  label,
}: {
  evidenceId: string;
  index: number;
  label?: string;
}) {
  const shortId = evidenceId.replace(/^news:/, "").slice(0, 10);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/25 bg-violet-300/[0.08] px-2 py-1 text-[11px] font-semibold text-violet-100">
      <span>{label ?? `C${index + 1}`}</span>
      <span className="font-mono text-violet-100/55">{shortId}</span>
    </span>
  );
}
