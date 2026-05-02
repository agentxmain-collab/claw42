import { redirect } from "next/navigation";
import { AgentWatchBoard } from "@/modules/agent-watch/AgentWatchBoard";

export default async function AgentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "zh_CN") redirect(`/${locale}`);

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
        <AgentWatchBoard />
      </div>
    </main>
  );
}
