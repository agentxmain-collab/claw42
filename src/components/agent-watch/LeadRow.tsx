"use client";

import type { AnalystRowProps } from "./AnalystRow";
import { AnalystRow } from "./AnalystRow";

export function LeadRow(props: Omit<AnalystRowProps, "emphasis">) {
  return <AnalystRow {...props} emphasis="lead" />;
}
