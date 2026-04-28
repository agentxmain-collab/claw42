import type { Locale } from "@/i18n/types";

export function formatAgentMessageTime(timestamp: number, locale: Locale): string {
  const bcp47 = locale.replace("_", "-");

  try {
    return new Intl.DateTimeFormat(bcp47, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(timestamp);
  } catch {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
      2,
      "0",
    )}`;
  }
}
