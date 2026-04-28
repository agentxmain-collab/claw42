import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "./i18n/locales";

const LOCALE_COOKIE = "claw42-locale";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (hasLocale) {
    const [, locale, nextSegment] = pathname.split("/");
    if (nextSegment === "agent" && locale !== "zh_CN") {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}`;
      return NextResponse.redirect(url, 302);
    }

    return NextResponse.next();
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const isValidCookie =
    cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale);
  const locale = isValidCookie
    ? (cookieLocale as (typeof LOCALES)[number])
    : DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(url, 302);
}

export const config = {
  matcher: ["/((?!_next|api|images|fonts|.*\\..*).*)"],
};
