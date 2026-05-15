import { describe, expect, it, vi } from "vitest";
import {
  buildAnalystRoundPrompt,
  latestAnalystRoundByMember,
  runMultiRoundAnalystDebate,
} from "@/lib/team/multiRoundPipeline";
import type { TeamMemberId } from "@/lib/team/teamRegistry";

describe("multiRoundPipeline", () => {
  it("builds a second-round prompt from previous round outputs", () => {
    const prompt = buildAnalystRoundPrompt({
      basePrompt: "base prompt",
      round: 2,
      previousRoundOutputs: [
        {
          memberId: "chart_analyst",
          round: 1,
          direction: "long",
          confidence: 0.6,
          rationale: "support held",
          citations: ["ev_1"],
          observedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
    });

    expect(prompt).toContain("Round 2");
    expect(prompt).toContain("chart_analyst: long 0.6 support held");
  });

  it("runs two rounds and exposes the latest analyst view per member", async () => {
    const generateRound = vi.fn(async (memberId: TeamMemberId, _prompt: string, round: number) => ({
      memberId,
      direction: round === 1 ? ("neutral" as const) : ("long" as const),
      confidence: round === 1 ? 0.5 : 0.72,
      rationale: `round ${round}`,
      citations: [`ev_${round}`],
    }));

    const outputs = await runMultiRoundAnalystDebate({
      candidates: [{ memberId: "chart_analyst", prompt: "base prompt" }],
      generateRound,
      now: () => Date.UTC(2026, 4, 15, 0, 0, 0),
    });

    expect(generateRound).toHaveBeenCalledTimes(2);
    expect(generateRound.mock.calls[1]?.[1]).toContain("round 1");
    expect(outputs.map((output) => output.round)).toEqual([1, 2]);
    expect(latestAnalystRoundByMember(outputs)).toEqual([
      expect.objectContaining({
        memberId: "chart_analyst",
        round: 2,
        rationale: "round 2",
      }),
    ]);
  });
});
