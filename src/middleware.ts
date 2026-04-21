import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, matchLocale } from "./i18n/locales";

const LOCALE_COOKIE = "claw42-locale";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (hasLocale) return NextResponse.next();

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const isValidCookie =
    cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale);
  const locale = isValidCookie
    ? (cookieLocale as (typeof LOCALES)[number])
    : matchLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(url, 302);
}

export const config = {
  matcher: ["/((?!_next|api|images|fonts|.*\\..*).*)"],
};
