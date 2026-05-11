import React from "react";

export function WorkflowConnectorSvg() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-8 top-1/2 hidden h-24 -translate-y-1/2 text-[#7650ff]/25 md:block"
      aria-hidden="true"
      viewBox="0 0 960 96"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="workflow-connector-gradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="45%" stopColor="currentColor" stopOpacity="0.7" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <path
        d="M12 18 C220 18 250 78 460 48 C650 20 720 78 948 78"
        fill="none"
        stroke="url(#workflow-connector-gradient)"
        strokeLinecap="round"
        strokeWidth="2"
        strokeDasharray="12 18"
        className="animate-[workflowDash_6s_linear_infinite] motion-reduce:animate-none"
      />
    </svg>
  );
}
