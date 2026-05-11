import { describe, expect, test } from "vitest";
import { PIPELINE_REPLAY_SEQUENCE } from "@/lib/team/usePipelineReplay";

describe("PIPELINE_REPLAY_SEQUENCE", () => {
  test("replays four analysts, two leads, then PM", () => {
    expect(PIPELINE_REPLAY_SEQUENCE).toEqual([
      "fundamental_analyst",
      "news_analyst",
      "chart_analyst",
      "onchain_analyst",
      "research_lead",
      "risk_lead",
      "pm",
    ]);
  });
});
