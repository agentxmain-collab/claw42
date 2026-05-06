import type { Locale } from "@/i18n/types";

export type AgentWatchLocale = "zh_CN" | "en_US";

export const AGENT_WATCH_LOCALES = ["en_US", "zh_CN"] as const satisfies readonly Locale[];

export function isAgentWatchLocale(locale: string): locale is AgentWatchLocale {
  return locale === "zh_CN" || locale === "en_US";
}

export function resolveAgentWatchLocale(locale: string): AgentWatchLocale {
  return isAgentWatchLocale(locale) ? locale : "en_US";
}

export function agentWatchRedirectPath(locale: string): string | null {
  return isAgentWatchLocale(locale) ? null : "/en_US/agent";
}
