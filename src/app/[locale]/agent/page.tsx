import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { loadRecentChatHistory } from "@/lib/chatHistoryStore";
import { AgentWatchBoard } from "@/modules/agent-watch/AgentWatchBoard";
import { agentWatchRedirectPath } from "@/modules/agent-watch/locale";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const redirectPath = agentWatchRedirectPath(locale);
  if (redirectPath) redirect(redirectPath);
  noStore();
  const initialChatThreads = await loadRecentChatHistory({ limit: 3, messagesPerChat: 5 });

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
        <AgentWatchBoard initialChatThreads={initialChatThreads} />
      </div>
    </main>
  );
}
