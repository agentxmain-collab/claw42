import type { LocalizedText, Severity } from "@/types/common";

export type TopicItem = {
  id: string;
  rank: number;
  title: LocalizedText;
  detail: LocalizedText;
  heat: number;
  severity: Severity;
};
