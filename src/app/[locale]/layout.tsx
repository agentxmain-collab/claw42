import type { Metadata } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { AnalyticsPageView } from "@/components/AnalyticsPageView";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { WebVitalsBeacon } from "@/components/observability/WebVitalsBeacon";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/i18n/I18nProvider";
import { HTML_LANG, LOCALES, RTL_LOCALES, isLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";
import { SITE_URL } from "@/lib/basePath";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const satoshi = localFont({
  src: [
    { path: "../../../public/fonts/satoshi/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../../public/fonts/satoshi/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../../public/fonts/satoshi/Satoshi-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../../public/fonts/satoshi/Satoshi-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sc",
  display: "swap",
});
const bodyFontClassName = `${inter.variable} ${satoshi.variable} ${notoSansSC.variable} font-language`;

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
      canonical: `${SITE_URL}/${locale}`,
      languages: Object.fromEntries(
        LOCALES.map((item) => [HTML_LANG[item], `${SITE_URL}/${item}`]),
      ),
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
          <AppErrorBoundary>
            <AnalyticsPageView />
            <WebVitalsBeacon />
            <SiteHeader />
            {children}
          </AppErrorBoundary>
        </I18nProvider>
      </body>
    </html>
  );
}
