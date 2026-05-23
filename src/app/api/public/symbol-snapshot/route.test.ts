import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const getPublicSymbolSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/watch/publicSymbolSnapshot", () => ({
  getPublicSymbolSnapshot: getPublicSymbolSnapshotMock,
}));

describe("/api/public/symbol-snapshot", () => {
  beforeEach(() => {
    getPublicSymbolSnapshotMock.mockReset();
    getPublicSymbolSnapshotMock.mockResolvedValue({
      symbol: "BTC",
      summary: "BTC public summary",
      signal_strength: "high",
      updated_at: "2026-05-21T12:00:00.000Z",
      lang: "zh_CN",
    });
  });

  it("returns a cached public snapshot", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/public/symbol-snapshot?symbol=BTC&lang=zh_CN", {
        headers: { "x-forwarded-for": crypto.randomUUID() },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(body).toMatchObject({ symbol: "BTC", signal_strength: "high" });
    expect(getPublicSymbolSnapshotMock).toHaveBeenCalledWith("BTC", "zh_CN");
  });

  it("returns 404 when there is no public snapshot", async () => {
    getPublicSymbolSnapshotMock.mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/public/symbol-snapshot?symbol=NOPE", {
        headers: { "x-forwarded-for": crypto.randomUUID() },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("no_data");
  });
});
