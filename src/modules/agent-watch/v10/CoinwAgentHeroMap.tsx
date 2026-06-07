import React from "react";
import type { DispatchV10Dict } from "@/i18n/types";

type AgentTone = "cyan" | "green" | "pink" | "gold" | "purple" | "lime" | "red" | "blue";

type AgentBlueprint = {
  key: string;
  glyph: string;
  tone: AgentTone;
  size?: "large" | "chief";
};

const STAGE_AGENTS: AgentBlueprint[][] = [
  [
    { key: "news", glyph: "==", tone: "cyan" },
    { key: "onchain", glyph: "o-o", tone: "green" },
    { key: "social", glyph: "@", tone: "pink" },
  ],
  [
    { key: "technical", glyph: "∿", tone: "cyan" },
    { key: "liquidity", glyph: "$ $", tone: "gold" },
  ],
  [
    { key: "bull", glyph: "^ ^", tone: "lime", size: "large" },
    { key: "bear", glyph: "v v", tone: "red", size: "large" },
  ],
  [{ key: "strategy", glyph: "⇄", tone: "purple" }],
  [
    { key: "risk", glyph: "◆", tone: "gold" },
    { key: "position", glyph: "%", tone: "purple" },
  ],
  [{ key: "cio", glyph: "◉◉", tone: "blue", size: "chief" }],
];

function AgentFace({ agent, label }: { agent: AgentBlueprint; label: string }) {
  return (
    <div className="coinw-agent-face-wrap">
      <div
        className={["coinw-agent-face", `tone-${agent.tone}`, agent.size && `size-${agent.size}`]
          .filter(Boolean)
          .join(" ")}
        data-testid="coinw-agent-face"
        aria-hidden="true"
      >
        {agent.glyph}
      </div>
      <div
        className={["coinw-agent-name", agent.size === "chief" && "chief"]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </div>
    </div>
  );
}

function Connector({ variant = "purple" }: { variant?: "purple" | "split" | "lime" }) {
  return <div className={`coinw-agent-connector ${variant}`} aria-hidden="true" />;
}

function StageCard({
  num,
  stage,
  agents,
  className,
}: {
  num: number;
  stage: DispatchV10Dict["hero"]["coinwAgentMap"]["stages"][number];
  agents: AgentBlueprint[];
  className?: string;
}) {
  const stageNum = String(num).padStart(2, "0");

  if (num === 3) {
    return (
      <article
        className={["coinw-agent-stage", "debate", className].filter(Boolean).join(" ")}
        data-testid="coinw-agent-stage"
      >
        <div className="coinw-agent-stage-title">
          <span className="coinw-agent-stage-num">{stageNum}</span>
          <span>{stage.name}</span>
        </div>
        <div className="coinw-agent-debate-row">
          <AgentFace agent={agents[0]!} label={stage.agents[0] ?? agents[0]!.key} />
          <span className="coinw-agent-vs">{stage.vsLabel}</span>
          <AgentFace agent={agents[1]!} label={stage.agents[1] ?? agents[1]!.key} />
          <p className="coinw-agent-note">
            {stage.notes?.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </p>
        </div>
      </article>
    );
  }

  if (num === 6) {
    return (
      <article
        className={["coinw-agent-stage", "final", className].filter(Boolean).join(" ")}
        data-testid="coinw-agent-stage"
      >
        <div className="coinw-agent-stage-title">
          <span className="coinw-agent-stage-num">{stageNum}</span>
          <span>{stage.name}</span>
        </div>
        <div className="coinw-agent-final-row">
          <AgentFace agent={agents[0]!} label={stage.agents[0] ?? agents[0]!.key} />
          <span>{stage.notes?.[0]}</span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={["coinw-agent-stage", className].filter(Boolean).join(" ")}
      data-testid="coinw-agent-stage"
    >
      <div className="coinw-agent-stage-title">
        <span className="coinw-agent-stage-num">{stageNum}</span>
        <span>{stage.name}</span>
      </div>
      <div className="coinw-agent-face-grid">
        {agents.map((agent, index) => (
          <AgentFace agent={agent} label={stage.agents[index] ?? agent.key} key={agent.key} />
        ))}
      </div>
    </article>
  );
}

export function CoinwAgentHeroMap({ dict }: { dict: DispatchV10Dict }) {
  const copy = dict.hero.coinwAgentMap;

  return (
    <div className="hero-right">
      <div className="coinw-agent-map" data-testid="coinw-agent-map" aria-label={copy.ariaLabel}>
        <div className="coinw-agent-map-glow" aria-hidden="true" />
        <div className="coinw-agent-row top">
          <StageCard num={1} stage={copy.stages[0]!} agents={STAGE_AGENTS[0]!} className="wide" />
          <StageCard num={2} stage={copy.stages[1]!} agents={STAGE_AGENTS[1]!} />
        </div>
        <Connector />
        <StageCard num={3} stage={copy.stages[2]!} agents={STAGE_AGENTS[2]!} />
        <Connector variant="split" />
        <div className="coinw-agent-row mid">
          <StageCard num={4} stage={copy.stages[3]!} agents={STAGE_AGENTS[3]!} />
          <StageCard num={5} stage={copy.stages[4]!} agents={STAGE_AGENTS[4]!} className="wide" />
        </div>
        <Connector variant="lime" />
        <StageCard num={6} stage={copy.stages[5]!} agents={STAGE_AGENTS[5]!} />
        <div className="coinw-agent-output">
          <span>{copy.conclusionTitle}</span>
          <span>{copy.conclusionDetails}</span>
        </div>
      </div>
    </div>
  );
}
