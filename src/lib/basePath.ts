const DEFAULT_ROOT_SITE_URL = "https://claw42.ai";
const DEFAULT_PATH_SITE_ORIGIN = "https://ai.coinw.com";

export function normalizeBasePath(value: string | undefined | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "/") return "";

  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

function isExternalPath(path: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//") || path.startsWith("#");
}

export function withBasePath(path: string) {
  if (!BASE_PATH || isExternalPath(path)) return path;
  if (path === "/") return BASE_PATH;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  if (path.startsWith("/")) return `${BASE_PATH}${path}`;
  return `${BASE_PATH}/${path}`;
}

export function apiPath(path: `/api/${string}`) {
  return withBasePath(path);
}

export function stripBasePathFromPathname(pathname: string | null | undefined) {
  const value = pathname || "/";
  if (!BASE_PATH) return value;
  if (value === BASE_PATH) return "/";
  if (value.startsWith(`${BASE_PATH}/`)) return value.slice(BASE_PATH.length) || "/";
  return value;
}

export function localeCookiePath() {
  return BASE_PATH || "/";
}

function normalizeSiteUrl(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export const SITE_URL =
  normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
  (BASE_PATH ? `${DEFAULT_PATH_SITE_ORIGIN}${BASE_PATH}` : DEFAULT_ROOT_SITE_URL);
