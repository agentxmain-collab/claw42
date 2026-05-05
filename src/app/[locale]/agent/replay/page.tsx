import { listStrategyReplays } from "@/lib/strategyHistory";

export const dynamic = "force-dynamic";

export default function AgentReplayPage() {
  const replays = listStrategyReplays(30);

  return (
    <main className="min-h-screen bg-black px-5 py-24 text-white md:px-10">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-white/40">Claw 42</p>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">Strategy Replay</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">
          AI-generated debate strategies are checked against later market movement. This page is an
          operational preview and does not constitute investment advice.
        </p>

        <div className="mt-8 space-y-3">
          {replays.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
              Replay data will appear after the scheduled strategy replay job runs.
            </div>
          ) : (
            replays.map((replay) => (
              <article
                key={`${replay.strategyId}-${replay.evaluatedAt}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full border border-white/10 px-3 py-1 font-bold">
                    ${replay.symbol}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {replay.direction.toUpperCase()}
                  </span>
                  <span className={replay.pnlPct >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {replay.pnlPct.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-xs text-white/55 md:grid-cols-3">
                  <span>Entry {replay.entryPrice.toLocaleString("en-US")}</span>
                  <span>Exit {replay.exitPrice.toLocaleString("en-US")}</span>
                  <span>{replay.isWin ? "Win" : "Loss"}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
