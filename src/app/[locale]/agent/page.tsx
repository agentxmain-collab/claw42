import { redirect } from "next/navigation";
import { AgentWatchBoard } from "@/modules/agent-watch/AgentWatchBoard";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "zh_CN") redirect(`/${locale}`);

  return (
    <main className="min-h-screen bg-black">
      <AgentWatchBoard />
    </main>
  );
}
