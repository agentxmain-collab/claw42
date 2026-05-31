import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/team/memoryLoopEvidence", () => ({
  fetchTeamTrackRecord: vi.fn(async () => ({
    generatedAt: "2026-05-15T12:00:00.000Z",
    locale: "zh_CN",
    winrates: [],
  })),
}));

describe("/api/watch/team-track-record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns cacheable team track record payload", async () => {
    const response = await GET(
      new Request("https://claw42.ai/api/watch/team-track-record?locale=zh_CN"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600",
    );
    expect(payload).toMatchObject({
      generatedAt: "2026-05-15T12:00:00.000Z",
      locale: "zh_CN",
      winrates: [],
    });
  });
});
