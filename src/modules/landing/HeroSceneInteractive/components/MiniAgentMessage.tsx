import type { AgentMessage } from "../types/mini-player";

export function MiniAgentMessage({ message }: { message: AgentMessage }) {
  return (
    <li className="rounded-md border border-white/10 bg-white/[0.055] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-white">{message.agentName}</span>
        <span className="text-[11px] text-[#8feeff]">{message.role}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[#d7e1ea]">{message.message}</p>
    </li>
  );
}
