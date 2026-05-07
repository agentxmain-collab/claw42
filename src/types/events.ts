import type { LocalizedText, Severity } from "@/types/common";

export type EventItem = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  datetime: string;
  tag: LocalizedText;
  severity: Severity;
};
