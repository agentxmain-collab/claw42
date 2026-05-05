import type { Metadata } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import { notFound } from "next/navigation";
import { AnalyticsPageView } from "@/components/AnalyticsPageView";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/i18n/I18nProvider";
import { HTML_LANG, LOCALES, RTL_LOCALES, isLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";

const baseUrl = "https://claw42.ai";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sc",
  display: "swap",
});
const bodyFontClassName = `${inter.variable} ${notoSansSC.variable} font-sans`;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  return {
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: Object.fromEntries(LOCALES.map((item) => [HTML_LANG[item], `${baseUrl}/${item}`])),
    },
  };
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
    <html lang={HTML_LANG[typedLocale]} dir={dir} className="dark">
      <body className={bodyFontClassName}>
        <I18nProvider initialLocale={typedLocale}>
          <AnalyticsPageView />
          <SiteHeader />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
