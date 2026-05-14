import React from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { avatarClassByRole, avatarLabelByRole } from "./staticContent";
import type { FlowStageVisual } from "./types";

export function FlowStageCard({ stage, dict }: { stage: FlowStageVisual; dict: DispatchV10Dict }) {
  const stageCopy = dict.flow.stages[stage.num - 1];
  const variantClass = stage.variant ? ` ${stage.variant}` : "";
  const agentCountClass = `fagents-${stage.agentIds.length}`;

  return (
    <article className={`fstage4${variantClass}`} aria-labelledby={`flow-stage-${stage.num}`}>
      <div className="fstage4-side" data-num={stage.num}>
        <div className="fs4-head">
          <span className="fs4-num">{stage.num}</span>
          <div className="fs4-meta">
            <h2 id={`flow-stage-${stage.num}`} className="fs4-name">
              {stageCopy.name}
            </h2>
            <div className="fs4-tag">{stageCopy.tag}</div>
          </div>
        </div>
        <span className="fs4-cnt">{stageCopy.countLabel}</span>
        <span className="fs4-side-chip">{stageCopy.footerChip}</span>
      </div>

      <div className="fstage4-body">
        <div className={`fagents ${agentCountClass}`}>
          {stage.agentIds.map((agentId) => {
            const role = dict.roles[agentId];
            return (
              <div className="fagent" key={agentId}>
                <div className="fagent-head">
                  <div className={`fagent-avatar ${avatarClassByRole[agentId]}`} aria-hidden="true">
                    {avatarLabelByRole[agentId]}
                  </div>
                  <div className="fagent-info">
                    <div className="fagent-name">{role.name}</div>
                    <div className="fagent-role">{role.role}</div>
                  </div>
                </div>
                <div className="fagent-desc">{role.desc}</div>
              </div>
            );
          })}
        </div>

        <div className="fstage4-detail">
          {stageCopy.detail.map((item) => (
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
