"use client";

import React, { useRef } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { AgentNode } from "./AgentNode";
import { heroAgents } from "./staticContent";
import { useConstellationFocus } from "./useConstellationFocus";
import { useReducedMotion } from "./useReducedMotion";

export function Constellation({ dict, active }: { dict: DispatchV10Dict; active: boolean }) {
  const constellationRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useConstellationFocus(constellationRef, active && !reducedMotion);

  return (
    <div className="hero-right" aria-hidden="true">
      <div
        className={["constellation", reducedMotion && "motion-reduced"].filter(Boolean).join(" ")}
        ref={constellationRef}
      >
        <div className="scene">
          <div className="ground" />
          <svg className="web" viewBox="0 0 500 540" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="dispatch-v10-arc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="rgba(124,92,255,0)" />
                <stop offset="0.5" stopColor="rgba(124,92,255,0.7)" />
                <stop offset="1" stopColor="rgba(124,92,255,0)" />
              </linearGradient>
              <linearGradient id="dispatch-v10-arc-lime" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="rgba(209,255,85,0)" />
                <stop offset="0.5" stopColor="rgba(209,255,85,0.85)" />
                <stop offset="1" stopColor="rgba(209,255,85,0)" />
              </linearGradient>
              <radialGradient id="dispatch-v10-dot" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="rgba(124,92,255,0.5)" />
                <stop offset="1" stopColor="rgba(124,92,255,0)" />
              </radialGradient>
            </defs>
            <ellipse
              cx="250"
              cy="250"
              rx="92"
              ry="96"
              fill="none"
              stroke="rgba(209,255,85,0.12)"
              strokeWidth="1"
              strokeDasharray="2 6"
            />
            <g
              fill="none"
              stroke="url(#dispatch-v10-arc)"
              strokeWidth="1.4"
              strokeDasharray="5 8"
              className="chat-arc"
            >
              <path d="M 345 102.6 L 250 259.2" />
              <path d="M 160 113.4 L 250 259.2" />
              <path d="M 40 151.2 L 250 259.2" />
              <path d="M 355 205.2 L 250 259.2" />
              <path d="M 440 275.4 L 250 259.2" />
              <path d="M 250 151.2 L 250 259.2" />
            </g>
            <g
              fill="none"
              stroke="url(#dispatch-v10-arc-lime)"
              strokeWidth="1.1"
              strokeDasharray="3 8"
              className="chat-arc slow"
            >
              <path d="M 250 259.2 L 305 448.2" />
              <path d="M 250 259.2 L 85 394.2" />
              <path d="M 250 259.2 L 100 270" />
              <path d="M 250 259.2 L 345 334.8" />
              <path d="M 250 259.2 L 210 383.4" />
            </g>
            <g fill="url(#dispatch-v10-dot)">
              {[
                [305, 180],
                [368, 262],
                [280, 358],
                [160, 370],
                [110, 220],
                [200, 125],
                [298, 92],
                [408, 195],
                [412, 370],
                [138, 430],
                [55, 290],
              ].map(([cx, cy]) => (
                <circle cx={cx} cy={cy} r="3" key={`${cx}-${cy}`} />
              ))}
            </g>
          </svg>

          <div className="core">
            <span className="ring" />
            <span className="d1 ring" />
            <span className="d2 ring" />
            <span className="ear-l" />
            <span className="ear-r" />
            <span className="foot-l" />
            <span className="foot-r" />
            <div className="head">
              <div className="face">
                <span className="eye" />
                <span className="eye right" />
              </div>
            </div>
            <div className="podium" />
          </div>

          {heroAgents.map((agent) => (
            <AgentNode
              agent={agent}
              role={dict.roles[agent.id]}
              readoutLabels={dict.hero.readoutLabels}
              key={agent.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
