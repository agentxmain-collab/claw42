import React from "react";
import type { DispatchV10Dict } from "@/i18n/types";

export function FlowFooterCTA({
  dict,
  onGotoMarket,
}: {
  dict: DispatchV10Dict;
  onGotoMarket: () => void;
}) {
  return (
    <div className="flow-footer-cta">
      <div className="flow-footer-note">
        <b>{dict.flow.footerStrong}</b> · {dict.flow.footerText}
      </div>
      <button className="switch-to-debate" type="button" onClick={onGotoMarket}>
        {dict.flow.footerCta}
      </button>
    </div>
  );
}
