import React from "react";
import type { KeyboardEvent } from "react";
import type { DispatchView } from "../v9/types";

export function resolveDispatchV10TabKey(current: DispatchView, key: string): DispatchView {
  if (key === "ArrowRight" || key === "ArrowLeft") return current === "flow" ? "mkt" : "flow";
  if (key === "Home") return "flow";
  if (key === "End") return "mkt";
  return current;
}

export function WatchTabs({
  activeView,
  onViewChange,
  flowLabel,
  marketLabel,
  liveLabel,
}: {
  activeView: DispatchView;
  onViewChange: (view: DispatchView) => void;
  flowLabel: string;
  marketLabel: string;
  liveLabel: string;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = resolveDispatchV10TabKey(activeView, event.key);
    if (next === activeView) return;
    event.preventDefault();
    onViewChange(next);
  }

  return (
    <div className="topbar-tabs" role="tablist" aria-label="Dispatch console views">
      <button
        id="dispatch-v10-tab-flow"
        className={["ttab", activeView === "flow" && "active"].filter(Boolean).join(" ")}
        type="button"
        role="tab"
        aria-selected={activeView === "flow"}
        aria-controls="dispatch-v10-panel-flow"
        tabIndex={activeView === "flow" ? 0 : -1}
        onClick={() => onViewChange("flow")}
        onKeyDown={handleKeyDown}
      >
        {flowLabel}
      </button>
      <button
        id="dispatch-v10-tab-mkt"
        className={["ttab", activeView === "mkt" && "active"].filter(Boolean).join(" ")}
        type="button"
        role="tab"
        aria-selected={activeView === "mkt"}
        aria-controls="dispatch-v10-panel-mkt"
        tabIndex={activeView === "mkt" ? 0 : -1}
        onClick={() => onViewChange("mkt")}
        onKeyDown={handleKeyDown}
      >
        {marketLabel} <span className="badge">{liveLabel}</span>
      </button>
    </div>
  );
}
