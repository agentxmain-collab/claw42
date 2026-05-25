import React from "react";

export function CoreRobot({ className = "" }: { className?: string }) {
  return (
    <span className={["core-robot", className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className="ear-l" />
      <span className="ear-r" />
      <span className="foot-l" />
      <span className="foot-r" />
      <span className="head">
        <span className="face">
          <span className="eye" />
          <span className="eye right" />
        </span>
      </span>
    </span>
  );
}
