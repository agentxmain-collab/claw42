"use client";

import { useEffect, useState } from "react";
import styles from "./dispatchConsoleV9.module.css";
import { FlowIntroView } from "./FlowIntroView";
import { MarketAnalysisView } from "./MarketAnalysisView";
import { WatchTabs } from "./WatchTabs";
import type { DispatchConsoleV9Props, DispatchView } from "./types";

function formatClock(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} · UTC+8`;
}

export function DispatchConsoleV9({ initialView = "flow" }: DispatchConsoleV9Props) {
  const [activeView, setActiveView] = useState<DispatchView>(initialView);
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function changeView(view: DispatchView) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className={`${styles.root} dispatch-console-v9`} aria-label="Claw42 dispatch console">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <span>claw42</span>
          <span className="brand-sub">DISPATCH · 调度台</span>
        </div>
        <WatchTabs activeView={activeView} onViewChange={changeView} />
        <div className="topbar-spacer" />
        <span className="live-pill-small" aria-live="polite">
          <span className="live-dot" aria-hidden="true" />
          LIVE
        </span>
        <span className="topbar-clock">{clock}</span>
      </div>

      <div
        id="dispatch-panel-flow"
        className={`view v-flow${activeView === "flow" ? " active" : ""}`}
        role="tabpanel"
        aria-labelledby="dispatch-tab-flow"
        hidden={activeView !== "flow"}
      >
        <FlowIntroView onGotoMarket={() => changeView("mkt")} />
      </div>
      <div
        id="dispatch-panel-mkt"
        className={`view v-mkt${activeView === "mkt" ? " active" : ""}`}
        role="tabpanel"
        aria-labelledby="dispatch-tab-mkt"
        hidden={activeView !== "mkt"}
      >
        <MarketAnalysisView onGotoFlow={() => changeView("flow")} />
      </div>
    </section>
  );
}
