import React from "react";
import { dispatchFlowStages } from "./fixtureData";
import type { DispatchFlowStage } from "./types";

function avatarLabel(stage: DispatchFlowStage, avatarClass: string) {
  if (avatarClass === "a-bull") return "↑";
  if (avatarClass === "a-bear") return "↓";
  if (avatarClass === "a-trade") return "$";
  if (avatarClass === "a-pm") return "PM";
  if (avatarClass === "a-mem") return "∞";
  if (avatarClass === "a-aggr") return "A";
  if (avatarClass === "a-neut") return "N";
  if (avatarClass === "a-cons") return "C";
  return stage.agents.find((agent) => agent.avatarClass === avatarClass)?.role.at(0) ?? "";
}

function FlowStageCard({ stage }: { stage: DispatchFlowStage }) {
  const variantClass = stage.variant ? ` ${stage.variant}` : "";
  const agentCountClass = `fagents-${stage.agents.length}`;

  return (
    <article className={`fstage4${variantClass}`} aria-labelledby={`flow-stage-${stage.num}`}>
      <div className="fstage4-side">
        <div className="fs4-head">
          <span className="fs4-num">{stage.num}</span>
          <div className="fs4-meta">
            <h2 id={`flow-stage-${stage.num}`} className="fs4-name">
              {stage.name}
            </h2>
            <div className="fs4-tag">{stage.tag}</div>
          </div>
        </div>
        <span className="fs4-cnt">{stage.countLabel}</span>
        <span className="fs4-side-chip">{stage.footerChip}</span>
      </div>

      <div className="fstage4-body">
        <div className={`fagents ${agentCountClass}`}>
          {stage.agents.map((agent) => (
            <div className="fagent" key={agent.id}>
              <div className="fagent-head">
                <div className={`fagent-avatar ${agent.avatarClass}`} aria-hidden="true">
                  {avatarLabel(stage, agent.avatarClass)}
                </div>
                <div className="fagent-info">
                  <div className="fagent-name">{agent.name}</div>
                  <div className="fagent-role">{agent.role}</div>
                </div>
              </div>
              <div className="fagent-desc">{agent.desc}</div>
            </div>
          ))}
        </div>

        <div className="fstage4-detail">
          {stage.detail.map((item) => (
            <div className="fsd-col" key={`${stage.num}-${item.label}`}>
              <span className="fsd-label">{item.label}</span>
              <span className="fsd-value">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function FlowIntroView({ onGotoMarket }: { onGotoMarket: () => void }) {
  return (
    <>
      <div className="flow-stages-v4">
        {dispatchFlowStages.map((stage) => (
          <FlowStageCard key={stage.num} stage={stage} />
        ))}
      </div>

      <div className="flow-footer-cta">
        <div className="flow-footer-note">
          <b>每一步都有专人</b> · 每一次分歧被记录 · 每一笔结果被复盘
        </div>
        <button className="switch-to-debate" type="button" onClick={onGotoMarket}>
          查看实时 AI 团队工作 →
        </button>
      </div>
    </>
  );
}
