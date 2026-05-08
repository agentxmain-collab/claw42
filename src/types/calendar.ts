import type { LocalizedText, Severity } from "@/types/common";

export type CalendarKey = "today" | "tomorrow" | "week";

export type MacroItem = {
  id: string;
  range: CalendarKey;
  name: LocalizedText;
  datetime: string;
  forecast: string;
  actual: string;
  impact: Severity;
};
