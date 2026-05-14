"use client";

import React, { useRef } from "react";
import type { DispatchV10Dict } from "@/i18n/types";
import { heroAgents } from "./staticContent";
import { AgentNode } from "./AgentNode";
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
              <path d="M 250 150 Q 322 168 353 203 Q 382 268 345 333 Q 285 372 210 383 Q 130 358 100 271 Q 78 178 161 111 Q 248 56 347 101 Q 442 170 439 277 Q 412 402 306 446 Q 178 462 86 392 Q 0 308 42 153" />
            </g>
            <g
              fill="none"
              stroke="url(#dispatch-v10-arc-lime)"
              strokeWidth="1.1"
              strokeDasharray="3 8"
              className="chat-arc slow"
            >
              <path d="M 250 250 Q 178 280 200 335 Q 250 392 312 358 Q 348 308 318 252 Q 274 198 220 218 Q 178 248 208 285" />
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
            <div className="head">
              <div className="face">
                <span className="eye" />
                <span className="eye right" />
              </div>
            </div>
            <div className="podium" />
          </div>

          {heroAgents.map((agent) => (
            <AgentNode agent={agent} role={dict.roles[agent.id]} key={agent.id} />
          ))}
        </div>
      </div>
    </div>
  );
}
