import { describe, expect, it } from "vitest";
import { NEWS_EVIDENCE_TTL_SECONDS } from "@/lib/news/newsEvidenceStore";

describe("newsEvidenceStore", () => {
  it("keeps news evidence for sixty days", () => {
    expect(NEWS_EVIDENCE_TTL_SECONDS).toBe(60 * 24 * 60 * 60);
  });
});
