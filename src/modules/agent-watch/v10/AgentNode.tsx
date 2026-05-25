"use client";

import React from "react";
import type { CSSProperties } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { InlineAvatarSvg } from "./InlineAvatarSvg";
import type { HeroAgentVisual } from "./types";

export function AgentNode({
  agent,
  role,
  readoutLabels,
}: {
  agent: HeroAgentVisual;
  role: DispatchV10Dict["roles"][HeroAgentVisual["id"]];
  readoutLabels: DispatchV10Dict["hero"]["readoutLabels"];
}) {
  const style = {
    left: agent.style.left,
    top: agent.style.top,
    "--tz": agent.style.tz,
    "--bob": agent.style.bob,
    "--dur": agent.style.dur,
    "--delay": agent.style.delay,
  } as CSSProperties;

  return (
    <div className={`anode ${agent.tier} ${agent.className}`} style={style}>
      <div className="av">
        <InlineAvatarSvg className="anode-avatar" name={agent.id} />
        {agent.hasSpeech ? (
          <span className="speech-dot">
            <span className="d" />
            <span className="d" />
            <span className="d" />
          </span>
        ) : null}
      </div>
      <div className="reticle">
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
        <span className="b4" />
        <span className="scan" />
      </div>
      <div className="readout">
        <span className="lbl">{readoutLabels.id}</span> <b>{agent.readoutId}</b>
        <br />
        <span className="lbl">{readoutLabels.role}</span> {role.readoutRole}
        <br />
        <span className="lbl">{readoutLabels.stat}</span> <b>{role.stat}</b>
      </div>
      <div className="tip-card">
        <div className="nm">{role.name}</div>
        <span className="rl">{agent.label}</span>
      </div>
    </div>
  );
}
