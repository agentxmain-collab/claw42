"use client";

import React, { useEffect, useState } from "react";
import styles from "./dispatchConsoleV9.module.css";
import { FlowIntroView } from "./FlowIntroView";
import { MarketAnalysisView } from "./MarketAnalysisView";
import { WatchTabs } from "./WatchTabs";
import type {
  DispatchConsoleV9Props,
  DispatchTopic,
  DispatchTopicAction,
  DispatchView,
} from "./types";

function formatClock(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} · UTC+8`;
}

function Clock() {
  const [clock, setClock] = useState("19:31:42 · UTC+8");

  useEffect(() => {
    setClock(formatClock(new Date()));
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <span className="topbar-clock">{clock}</span>;
}

export function DispatchConsoleV9({
  topics,
  initialView = "flow",
  onViewChange,
  onTopicAction,
}: DispatchConsoleV9Props) {
  const [activeView, setActiveView] = useState<DispatchView>(initialView);
  const [placeholder, setPlaceholder] = useState<{
    topic: DispatchTopic;
    actionLabel: string;
  } | null>(null);

  function changeView(view: DispatchView) {
    setActiveView(view);
    onViewChange?.(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleTopicAction(
    topic: DispatchTopic,
    actionLabel: string,
    action: DispatchTopicAction,
  ) {
    void onTopicAction?.(topic, actionLabel, action);
    setPlaceholder({ topic, actionLabel });
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
        <Clock />
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
        <MarketAnalysisView
          topics={topics}
          onGotoFlow={() => changeView("flow")}
          onPlaceholder={handleTopicAction}
        />
      </div>
      {placeholder ? (
        <div className="follow-placeholder-backdrop" role="presentation">
          <div
            className="follow-placeholder"
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-placeholder-title"
          >
            <div className="follow-placeholder-kicker">{placeholder.topic.trigger.ticker}</div>
            <h2 id="follow-placeholder-title">跟单功能开发中</h2>
            <p>
              已记录「{placeholder.actionLabel}」占位操作。Phase A 不执行交易，后续会接入授权和风险确认流程。
            </p>
            <button
              className="follow-placeholder-close"
              type="button"
              onClick={() => setPlaceholder(null)}
            >
              返回调度台
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
