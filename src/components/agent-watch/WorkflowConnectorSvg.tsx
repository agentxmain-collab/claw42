import React from "react";

export function WorkflowConnectorSvg() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-8 top-[58%] hidden h-72 -translate-y-1/2 text-[#7650ff]/25 md:block"
      aria-hidden="true"
      viewBox="0 0 960 288"
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
        d="M120 26 C260 78 330 104 420 126"
        fill="none"
        stroke="url(#workflow-connector-gradient)"
        strokeLinecap="round"
        strokeWidth="2"
        strokeDasharray="12 18"
        className="animate-[workflowDash_6s_linear_infinite] motion-reduce:animate-none"
      />
      <path
        d="M840 26 C700 78 630 104 540 126"
        fill="none"
        stroke="url(#workflow-connector-gradient)"
        strokeLinecap="round"
        strokeWidth="2"
        strokeDasharray="12 18"
        className="animate-[workflowDash_6s_linear_infinite] motion-reduce:animate-none"
      />
      <path
        d="M420 168 C448 214 512 214 540 168"
        fill="none"
        stroke="url(#workflow-connector-gradient)"
        strokeLinecap="round"
        strokeWidth="2"
        strokeDasharray="12 18"
        className="animate-[workflowDash_6s_linear_infinite] motion-reduce:animate-none"
      />
      <path
        d="M480 188 C480 214 480 236 480 262"
        fill="none"
        stroke="url(#workflow-connector-gradient)"
        strokeLinecap="round"
        strokeWidth="2"
        strokeDasharray="10 16"
        className="animate-[workflowDash_6s_linear_infinite] motion-reduce:animate-none"
      />
    </svg>
  );
}
