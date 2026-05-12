import React from "react";
import { ChatShell } from "./ChatShell";
import { dispatchTopics } from "./fixtureData";
import type { DispatchTopic } from "./types";

export function MarketAnalysisView({
  onGotoFlow,
  onPlaceholder,
}: {
  onGotoFlow: () => void;
  onPlaceholder: (topic: DispatchTopic, actionLabel: string) => void;
}) {
  return (
    <>
      <header className="mkt-header">
        <div>
          <div className="eyebrow">CLAW 42 · 实时盯盘</div>
          <h1 className="title">
            AI 团队<span className="accent">正在分析热点</span>
          </h1>
          <p className="subtitle">每个热点独立一组 11 角色 6 阶段辩论 · 可分别跟单 · 不互相干扰</p>
        </div>
        <button className="switch-to-flow" type="button" onClick={onGotoFlow}>
          ← 流程介绍
        </button>
      </header>

      <ChatShell topics={dispatchTopics} onPlaceholder={onPlaceholder} />
    </>
  );
}
