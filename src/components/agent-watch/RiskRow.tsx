"use client";

import type { AnalystRowProps } from "./AnalystRow";
import { AnalystRow } from "./AnalystRow";

export function RiskRow(props: Omit<AnalystRowProps, "emphasis">) {
  return <AnalystRow {...props} emphasis="risk" />;
}
