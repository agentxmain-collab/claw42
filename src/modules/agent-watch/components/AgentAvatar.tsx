"use client";

import Image from "next/image";
import { AGENT_COLOR_TOKEN, AGENT_META } from "../agents";
import type { AgentId } from "../types";

const AVATAR_SIZE = {
  card: { className: "h-14 w-14", pixels: 56 },
  sidebar: { className: "h-12 w-12", pixels: 48 },
  message: { className: "h-6 w-6", pixels: 24 },
  typing: { className: "h-10 w-10", pixels: 40 },
} as const;

export function AgentAvatar({
  agentId,
  size = "message",
  className = "",
}: {
  agentId: AgentId;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
}) {
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];
  const avatarSize = AVATAR_SIZE[size];

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible ${avatarSize.className} ${className}`}
      style={{ filter: `drop-shadow(0 0 12px ${token.soft})` }}
    >
      <Image
        src={meta.avatarSrc}
        alt=""
        width={avatarSize.pixels}
        height={avatarSize.pixels}
        className="h-full w-full object-contain"
        sizes={`${avatarSize.pixels}px`}
      />
    </span>
  );
}
