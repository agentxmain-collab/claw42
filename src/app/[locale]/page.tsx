import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { parseExternalEntry } from "@/lib/coinw/externalEntryParser";
import { serializedSearchParamsToURLSearchParams } from "@/lib/coinw/landingContext";
import ClientLandingPage from "./ClientLandingPage";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LocalePage({ params, searchParams }: LocalePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const landingContext = parseExternalEntry({
    searchParams: serializedSearchParamsToURLSearchParams(resolvedSearchParams),
    secret: process.env.COINW_EXTERNAL_ENTRY_HMAC_SECRET,
    nowSec: Math.floor(Date.now() / 1000),
  });

  return <ClientLandingPage landingContext={landingContext} />;
}
