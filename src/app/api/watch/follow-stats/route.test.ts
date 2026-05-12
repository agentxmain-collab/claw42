import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { __resetFollowStatsForTests } from "@/lib/watch/followStatsStore";

describe("/api/watch/follow-stats", () => {
  afterEach(() => {
    __resetFollowStatsForTests();
  });

  it("returns empty stats and sets an anonymous cookie", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/follow-stats?recordIds=record-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats["record-1"]).toEqual({ watchCount: 0, followCount: 0, userFollowed: false });
    expect(response.headers.get("set-cookie")).toContain("claw42-anon-id=");
  });

  it("records follow actions idempotently for one anon cookie", async () => {
    const first = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-stats", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.1" },
        body: JSON.stringify({ action: "follow", recordId: "record-1" }),
      }),
    );
    const cookie = first.headers.get("set-cookie")?.match(/claw42-anon-id=([^;]+)/)?.[1];
    expect(cookie).toBeTruthy();

    const second = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-stats", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.1",
          cookie: `claw42-anon-id=${cookie}`,
        },
        body: JSON.stringify({ action: "follow", recordId: "record-1" }),
      }),
    );
    const body = await second.json();

    expect(second.status).toBe(200);
    expect(body.stats).toEqual({ watchCount: 1, followCount: 1, userFollowed: true });
  });
});
