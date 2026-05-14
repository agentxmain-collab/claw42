"use client";

import React, { useRef } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { flowStages } from "./staticContent";
import { FlowFooterCTA } from "./FlowFooterCTA";
import { FlowStageCard } from "./FlowStageCard";
import { useStageEntryAnimation } from "./useStageEntryAnimation";

function StageConnector() {
  return (
    <div className="stage-connector" aria-hidden="true">
      <svg viewBox="0 0 48 34" preserveAspectRatio="none">
        <path d="M 24 0 C 36 12 12 22 24 34" />
      </svg>
      <span className="nodule" />
    </div>
  );
}

export function FlowPanel({
  dict,
  onGotoMarket,
}: {
  dict: DispatchV10Dict;
  onGotoMarket: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useStageEntryAnimation(panelRef);

  return (
    <section ref={panelRef} aria-label={dict.flow.ariaLabel}>
      <div className="flow-stages-v4">
        {flowStages.map((stage, index) => (
          <div className="flow-stage-group" key={stage.num}>
            {index > 0 ? <StageConnector /> : null}
            <FlowStageCard stage={stage} dict={dict} />
          </div>
        ))}
      </div>
      <FlowFooterCTA dict={dict} onGotoMarket={onGotoMarket} />
    </section>
  );
}
