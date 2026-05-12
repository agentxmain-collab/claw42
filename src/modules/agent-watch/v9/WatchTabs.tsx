import type { KeyboardEvent } from "react";
import type { DispatchView } from "./types";

const DISPATCH_VIEWS: DispatchView[] = ["flow", "mkt"];

export function resolveDispatchTabKey(current: DispatchView, key: string): DispatchView {
  const currentIndex = DISPATCH_VIEWS.indexOf(current);
  if (key === "ArrowRight") return DISPATCH_VIEWS[(currentIndex + 1) % DISPATCH_VIEWS.length]!;
  if (key === "ArrowLeft") {
    return DISPATCH_VIEWS[
      (currentIndex - 1 + DISPATCH_VIEWS.length) % DISPATCH_VIEWS.length
    ]!;
  }
  return current;
}

export function WatchTabs({
  activeView,
  onViewChange,
}: {
  activeView: DispatchView;
  onViewChange: (view: DispatchView) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const nextView = resolveDispatchTabKey(activeView, event.key);
    if (nextView === activeView) return;
    event.preventDefault();
    onViewChange(nextView);
  }

  return (
    <div className="topbar-tabs" role="tablist" aria-label="Watch dispatch views">
      <button
        id="dispatch-tab-flow"
        className={`ttab${activeView === "flow" ? " active" : ""}`}
        type="button"
        role="tab"
        aria-selected={activeView === "flow"}
        aria-controls="dispatch-panel-flow"
        tabIndex={activeView === "flow" ? 0 : -1}
        onClick={() => onViewChange("flow")}
        onKeyDown={handleKeyDown}
      >
        流程介绍
      </button>
      <button
        id="dispatch-tab-mkt"
        className={`ttab${activeView === "mkt" ? " active" : ""}`}
        type="button"
        role="tab"
        aria-selected={activeView === "mkt"}
        aria-controls="dispatch-panel-mkt"
        tabIndex={activeView === "mkt" ? 0 : -1}
        onClick={() => onViewChange("mkt")}
        onKeyDown={handleKeyDown}
      >
        行情分析 <span className="badge">LIVE</span>
      </button>
    </div>
  );
}
