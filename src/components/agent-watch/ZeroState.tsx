"use client";

export function ZeroState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.24)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/[0.08] text-xl">
        ✦
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/55">{subtitle}</p>
    </div>
  );
}
