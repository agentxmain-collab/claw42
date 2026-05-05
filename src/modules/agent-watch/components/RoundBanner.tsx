export function RoundBanner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
    </div>
  );
}
