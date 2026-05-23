import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALES, matchLocale } from "@/i18n/locales";

const LOCALE_COOKIE = "claw42-locale";

type RootPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function buildSearchSuffix(searchParams: RootPageProps["searchParams"]) {
  if (!searchParams) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export default function RootPage({ searchParams }: RootPageProps) {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale =
    cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)
      ? cookieLocale
      : matchLocale(headers().get("accept-language"));

  redirect(`/${locale}${buildSearchSuffix(searchParams)}`);
}
