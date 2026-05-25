import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AIDisclaimer } from "@/components/agent-watch/AIDisclaimer";
import { getDict } from "@/i18n/dictRegistry";
import type { Locale } from "@/i18n/types";
import { AgentWatchBoard } from "@/modules/agent-watch/AgentWatchBoard";
import { agentWatchRedirectPath } from "@/modules/agent-watch/locale";
import { resolveDispatchInitialView } from "@/modules/agent-watch/v9/initialView";
import { DispatchConsoleV10 } from "@/modules/agent-watch/v10/DispatchConsoleV10";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const { locale } = await params;
  const typedLocale = locale as Locale;
  const t = getDict(typedLocale);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialView = resolveDispatchInitialView(resolvedSearchParams.view);
  const redirectPath = agentWatchRedirectPath(locale);
  if (redirectPath) redirect(redirectPath);
  noStore();

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <div className="relative z-10">
        <AgentWatchBoard console={DispatchConsoleV10} initialView={initialView} />
      </div>
      <section className="disclaimer-analysis-section relative px-6 py-20 md:px-12 lg:px-20">
        <div className="mx-auto max-w-7xl">
          <AIDisclaimer>{t.disclaimerAnalysis.paragraphs.join(" ")}</AIDisclaimer>
        </div>
      </section>
    </main>
  );
}
