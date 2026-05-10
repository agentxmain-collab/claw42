import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { TrackRecordWall } from "@/components/agent-watch/TrackRecordWall";
import { loadRecentChatHistory } from "@/lib/chatHistoryStore";
import { computeTeamWinrates } from "@/lib/team/computeTeamWinrates";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { AgentWatchBoard } from "@/modules/agent-watch/AgentWatchBoard";
import { agentWatchRedirectPath } from "@/modules/agent-watch/locale";

const TEAM_MODE_ENABLED = process.env.NEXT_PUBLIC_WATCH_TEAM_MODE === "true";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const redirectPath = agentWatchRedirectPath(locale);
  if (redirectPath) redirect(redirectPath);
  if (TEAM_MODE_ENABLED) noStore();
  const [initialChatThreads, teamWinrates] = await Promise.all([
    loadRecentChatHistory({ limit: 3, messagesPerChat: 5 }),
    TEAM_MODE_ENABLED
      ? readAllDecisionRecords().then((records) => computeTeamWinrates(records))
      : Promise.resolve(null),
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 0%, rgba(124, 92, 255, 0.16) 0%, rgba(0, 0, 0, 0) 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 50%, rgba(58, 123, 255, 0.06) 0%, rgba(0, 0, 0, 0) 70%)",
        }}
      />
      <div className="relative z-10">
        {TEAM_MODE_ENABLED && teamWinrates && (
          <div className="mx-auto w-full max-w-7xl px-4 pt-24 md:px-8 md:pt-28">
            <TrackRecordWall winrates={teamWinrates} />
          </div>
        )}
        <AgentWatchBoard initialChatThreads={initialChatThreads} />
      </div>
    </main>
  );
}
