import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
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
        <div className="mx-auto flex max-w-7xl flex-col gap-[32px]">
          <h2 className="text-3xl font-bold leading-tight text-fg-primary md:text-4xl lg:text-[45px] lg:leading-[52px]">
            {t.disclaimerAnalysis.title}
          </h2>
          <div className="flex flex-col items-start gap-4 rounded-3xl p-[24px]">
            {t.disclaimerAnalysis.paragraphs.map((para, i) => (
              <p key={i} className="text-sm leading-[22px] tracking-[0.25px] text-fg-primary">
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
