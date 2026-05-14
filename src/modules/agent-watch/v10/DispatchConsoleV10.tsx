"use client";

import React, { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { DispatchTopic, DispatchTopicAction, DispatchView } from "../v9/types";
import styles from "./DispatchConsoleV10.module.css";
import type { DispatchConsoleV10Props } from "./types";
import { FlowPanel } from "./FlowPanel";
import { Hero } from "./Hero";
import { MarketAnalysisPanel } from "./MarketAnalysisPanel";

export function DispatchConsoleV10({
  topics,
  initialView = "flow",
  onViewChange,
  onTopicAction,
}: DispatchConsoleV10Props) {
  const { t } = useI18n();
  const dict = t.agentWatch.dispatchV10;
  const [activeView, setActiveView] = useState<DispatchView>(initialView);
  const [placeholder, setPlaceholder] = useState<{
    topic: DispatchTopic;
    actionLabel: string;
  } | null>(null);

  function changeView(view: DispatchView) {
    setActiveView(view);
    onViewChange?.(view);
  }

  function gotoMarket() {
    changeView("mkt");
    window.requestAnimationFrame(() => {
      document
        .getElementById("dispatch-v10-panel-mkt")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    <section
      className={`${styles.dispatchConsoleV10} dispatch-console-v10`}
      aria-label={dict.ariaLabel}
    >
      <Hero dict={dict} activeView={activeView} onViewChange={changeView} />

      <section
        id="dispatch-v10-panel-flow"
        className={["panel", activeView === "flow" && "active"].filter(Boolean).join(" ")}
        role="tabpanel"
        aria-labelledby="dispatch-v10-tab-flow"
        hidden={activeView !== "flow"}
      >
        <FlowPanel dict={dict} onGotoMarket={gotoMarket} />
      </section>

      <section
        id="dispatch-v10-panel-mkt"
        className={["panel", activeView === "mkt" && "active"].filter(Boolean).join(" ")}
        role="tabpanel"
        aria-labelledby="dispatch-v10-tab-mkt"
        hidden={activeView !== "mkt"}
      >
        <MarketAnalysisPanel topics={topics} dict={dict} onPlaceholder={handleTopicAction} />
      </section>

      {placeholder ? (
        <div className="follow-placeholder-backdrop" role="presentation">
          <div
            className="follow-placeholder"
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-placeholder-title"
          >
            <div className="follow-placeholder-kicker">{placeholder.topic.trigger.ticker}</div>
            <h2 id="follow-placeholder-title">{dict.placeholder.title}</h2>
            <p>{dict.placeholder.body.replace("{action}", placeholder.actionLabel)}</p>
            <button
              className="follow-placeholder-close"
              type="button"
              onClick={() => setPlaceholder(null)}
            >
              {dict.placeholder.close}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
