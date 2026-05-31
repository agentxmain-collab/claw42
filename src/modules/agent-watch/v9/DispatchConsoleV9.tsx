"use client";

import React, { useState } from "react";
import styles from "./dispatchConsoleV9.module.css";
import { FlowIntroView } from "./FlowIntroView";
import { MarketAnalysisView } from "./MarketAnalysisView";
import { WatchTabs } from "./WatchTabs";
import type {
  DispatchFreshnessState,
  DispatchConsoleV9Props,
  DispatchTopic,
  DispatchTopicAction,
  DispatchView,
} from "./types";

function DispatchPageHeader({
  activeView,
  onViewChange,
  freshness,
}: {
  activeView: DispatchView;
  onViewChange: (view: DispatchView) => void;
  freshness?: DispatchFreshnessState;
}) {
  return (
    <header className="dispatch-page-header">
      <div className="dispatch-page-title-row">
        <div className="dispatch-page-copy">
          <div className="eyebrow">CLAW 42 · DISPATCH CONSOLE</div>
          <h1 className="title">
            一笔交易决策 · <span className="accent">11 个角色 · 6 个阶段</span> 协同产出
          </h1>
          <p className="subtitle">
            不是一个 AI 拍脑袋。每一步都有专人，每一次分歧被记录，每一笔结果都回灌下一轮。
          </p>
        </div>
        <div className="meta-row" aria-label="Dispatch process summary">
          <div className="meta-chip">
            <span className="meta-num">11</span>
            <span className="meta-lbl">Agents</span>
          </div>
          <div className="meta-chip">
            <span className="meta-num">6</span>
            <span className="meta-lbl">Stages</span>
          </div>
          <div className="meta-chip">
            <span className="meta-num">2×</span>
            <span className="meta-lbl">Debate</span>
          </div>
          <div className="meta-chip">
            <span className="meta-num">∞</span>
            <span className="meta-lbl">Memory</span>
          </div>
        </div>
      </div>
      <SnapshotStatus freshness={freshness} />
      <WatchTabs activeView={activeView} onViewChange={onViewChange} />
    </header>
  );
}

function SnapshotStatus({ freshness }: { freshness?: DispatchFreshnessState }) {
  if (!freshness?.snapshotStatus && !freshness?.snapshotGeneratedAt) return null;
  const status = freshness?.snapshotStatus ?? "stale";
  const label =
    status === "fresh"
      ? "Snapshot fresh"
      : status === "empty"
        ? "Snapshot empty"
        : status === "degraded"
          ? "Snapshot degraded"
          : "Snapshot stale";
  const timestamp = freshness?.snapshotGeneratedAt
    ? freshness.snapshotGeneratedAt.replace("T", " ").slice(0, 16)
    : null;
  return (
    <div className="snapshot-status-row" aria-label="Timeline snapshot status">
      <span className={`snapshot-pill ${status}`}>{label}</span>
      {timestamp ? <span className="snapshot-generated-at">{timestamp}</span> : null}
    </div>
  );
}

export function DispatchConsoleV9({
  topics,
  initialView = "flow",
  onViewChange,
  onTopicAction,
  followTradeDict,
  freshness,
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

  const flowClassName = ["view", "v-flow", activeView === "flow" ? "active" : ""]
    .filter(Boolean)
    .join(" ");
  const marketClassName = ["view", "v-mkt", activeView === "mkt" ? "active" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={`${styles.root} dispatch-console-v9`} aria-label="Claw42 dispatch console">
      <DispatchPageHeader activeView={activeView} onViewChange={changeView} freshness={freshness} />

      <div
        id="dispatch-panel-flow"
        className={flowClassName}
        role="tabpanel"
        aria-labelledby="dispatch-tab-flow"
        hidden={activeView !== "flow"}
      >
        <FlowIntroView onGotoMarket={() => changeView("mkt")} />
      </div>
      <div
        id="dispatch-panel-mkt"
        className={marketClassName}
        role="tabpanel"
        aria-labelledby="dispatch-tab-mkt"
        hidden={activeView !== "mkt"}
      >
        <MarketAnalysisView
          topics={topics}
          onPlaceholder={handleTopicAction}
          followTradeDict={followTradeDict}
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
              已记录「{placeholder.actionLabel}」占位操作。Phase A
              不执行交易，后续会接入授权和风险确认流程。
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
