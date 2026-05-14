import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALES, matchLocale } from "@/i18n/locales";

const LOCALE_COOKIE = "claw42-locale";

export default function RootPage() {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale =
    cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)
      ? cookieLocale
      : matchLocale(headers().get("accept-language"));

  redirect(`/${locale}`);
}
