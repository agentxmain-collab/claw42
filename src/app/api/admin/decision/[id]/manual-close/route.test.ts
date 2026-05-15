import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/decision/[id]/manual-close/route";
import { manualCloseDecisionRecord, ManualCloseDecisionError } from "@/lib/team/manualCloseHandler";

const getCoinPoolMock = vi.hoisted(() => vi.fn());
const manualCloseDecisionRecordMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/marketDataCache", () => ({
  getCoinPool: getCoinPoolMock,
}));

vi.mock("@/lib/team/manualCloseHandler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/team/manualCloseHandler")>();
  return {
    ...actual,
    manualCloseDecisionRecord: manualCloseDecisionRecordMock,
  };
});

vi.mock("@/lib/watch/locale", () => ({
  localeFromRequestUrl: () => "zh_CN",
}));

describe("/api/admin/decision/[id]/manual-close", () => {
  beforeEach(() => {
    getCoinPoolMock.mockReset();
    manualCloseDecisionRecordMock.mockReset();
    getCoinPoolMock.mockResolvedValue({
      majors: [{ symbol: "BTC", price: 101000 }],
      trending: [],
      opportunity: [],
    });
    manualCloseDecisionRecordMock.mockResolvedValue({
      record: { id: "record-1" },
      resolution: {
        outcome: "manual_close",
        reason: "manual_close_requested",
        observedPrice: 101000,
        observedPriceSource: "admin_manual",
        resolvedAt: "2026-05-15T12:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without the admin token", async () => {
    vi.stubEnv("ADMIN_API_TOKEN", "secret");

    const response = await POST(
      new NextRequest("https://claw42.ai/api/admin/decision/record-1/manual-close", {
        method: "POST",
      }),
      { params: { id: "record-1" } },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(manualCloseDecisionRecord).not.toHaveBeenCalled();
  });

  it("manual-closes a decision using the current market price map", async () => {
    vi.stubEnv("ADMIN_API_TOKEN", "secret");

    const response = await POST(
      new NextRequest("https://claw42.ai/api/admin/decision/record-1/manual-close", {
        method: "POST",
        headers: { "x-admin-token": "secret" },
      }),
      { params: { id: "record-1" } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      recordId: "record-1",
      outcome: "manual_close",
      reason: "manual_close_requested",
      observedPriceSource: "admin_manual",
    });
    expect(manualCloseDecisionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "record-1",
        locale: "zh_CN",
        priceBySymbol: new Map([["BTC", 101000]]),
      }),
    );
  });

  it("maps already-resolved decisions to an idempotency conflict", async () => {
    vi.stubEnv("ADMIN_API_TOKEN", "secret");
    manualCloseDecisionRecordMock.mockRejectedValueOnce(
      new ManualCloseDecisionError("already_resolved", "already resolved"),
    );

    const response = await POST(
      new NextRequest("https://claw42.ai/api/admin/decision/record-1/manual-close", {
        method: "POST",
        headers: { "x-admin-token": "secret" },
        body: JSON.stringify({ observedPrice: 101000 }),
      }),
      { params: { id: "record-1" } },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "idempotency_conflict" });
    expect(getCoinPoolMock).not.toHaveBeenCalled();
  });
});
