"use client";

import React from "react";
import type { CSSProperties } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { InlineAvatarSvg } from "./InlineAvatarSvg";
import type { HeroAgentVisual } from "./types";

export function AgentNode({
  agent,
  role,
}: {
  agent: HeroAgentVisual;
  role: DispatchV10Dict["roles"][HeroAgentVisual["id"]];
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
        <b>{agent.readoutId}</b>
        <br />
        {role.readoutRole}
        <br />
        <b>{role.stat}</b>
      </div>
    </div>
  );
}
