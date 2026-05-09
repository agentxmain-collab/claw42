import type { FactionId } from "@/lib/types";
import type { TeamMemberId } from "@/lib/team/teamRegistry";

/**
 * Forward-path conversion from legacy factions to new team members is prohibited.
 *
 * @deprecated Legacy faction records must stay tagged as `recordSource: "legacy"` instead of
 * being rebranded as a new named analyst.
 */
export function legacyFactionToTeamMember(faction: FactionId): TeamMemberId {
  void faction;
  throw new Error(
    "legacyFactionToTeamMember called on forward path; legacy data should be tagged recordSource: 'legacy', not converted",
  );
}

/**
 * Map any old faction-owned record into the public legacy bucket for aggregation.
 *
 * @deprecated Remove after one release once legacy replay records are no longer read.
 */
export function legacyFactionToTrackRecordBucket(faction: FactionId): "legacy" {
  void faction;
  return "legacy";
}
