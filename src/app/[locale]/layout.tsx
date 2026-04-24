import { notFound } from "next/navigation";
import { AnalyticsPageView } from "@/components/AnalyticsPageView";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/i18n/I18nProvider";
import { HTML_LANG, LOCALES, RTL_LOCALES, isLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const dir = RTL_LOCALES.has(typedLocale) ? "rtl" : "ltr";

  return (
    <div lang={HTML_LANG[typedLocale]} dir={dir}>
      <I18nProvider initialLocale={typedLocale}>
        <AnalyticsPageView />
        <SiteHeader />
        {children}
      </I18nProvider>
    </div>
  );
}
