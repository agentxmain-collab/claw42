import type { TeamMemberId } from "@/lib/team/teamRegistry";

export type TeamActivityStatus = "analyzing" | "waiting_data" | "completed_recently" | "idle";

export interface TeamActivitySnapshot {
  memberId: TeamMemberId;
  status: TeamActivityStatus;
  lastActivityTs: number | null;
  activeRecordId?: string | null;
}

export type TeamActivityStatusMap = Partial<Record<TeamMemberId, TeamActivitySnapshot>>;
