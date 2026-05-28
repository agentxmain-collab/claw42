import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/public-card-index/backfill/route";

const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const backfillPublicCardIndexFromRecordsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/watch/publicCardIndex", () => ({
  backfillPublicCardIndexFromRecords: backfillPublicCardIndexFromRecordsMock,
}));

describe("/api/admin/public-card-index/backfill", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    vi.stubEnv("BACKFILL_TOKEN", "test-backfill-token");
    readAllDecisionRecordsMock.mockReset();
    backfillPublicCardIndexFromRecordsMock.mockReset();
    readAllDecisionRecordsMock.mockResolvedValue([{ id: "record-1" }]);
    backfillPublicCardIndexFromRecordsMock.mockImplementation((_records, options) => ({
      ok: true,
      locale: options.locale,
      dryRun: Boolean(options.dryRun),
      recordsScanned: 50,
      recordsWritten: options.dryRun ? 0 : 50,
      recordsSkippedReason: {
        localeMismatch: 0,
        notProjectable: 0,
        invalidCreatedAt: 0,
        writeFailed: 0,
      },
      indexCountAfter: options.dryRun ? 0 : 50,
      removedByAge: 0,
      removedByCap: 0,
      removedByNonStrategy: 0,
      durationMs: 1,
    }));
  });

  it("rejects unauthenticated backfill requests before reading records", async () => {
    const response = await POST(
      new NextRequest("https://claw42.ai/api/admin/public-card-index/backfill"),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "unauthorized" });
    expect(readAllDecisionRecordsMock).not.toHaveBeenCalled();
    expect(backfillPublicCardIndexFromRecordsMock).not.toHaveBeenCalled();
  });

  it("backfills zh_CN and en_US by default with the cron bearer secret", async () => {
    const response = await POST(
      new NextRequest("https://claw42.ai/api/admin/public-card-index/backfill", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      dryRun: false,
      locales: ["zh_CN", "en_US"],
      totals: {
        recordsScanned: 100,
        recordsWritten: 100,
        indexCountAfter: 100,
      },
    });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(2000, "zh_CN");
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(2000, "en_US");
  });

  it("supports single-locale dry runs without writes", async () => {
    const response = await POST(
      new NextRequest(
        "https://claw42.ai/api/admin/public-card-index/backfill?locale=zh_CN&dryRun=1",
        { headers: { authorization: "Bearer test-cron-secret" } },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      dryRun: true,
      locales: ["zh_CN"],
      results: [
        {
          locale: "zh_CN",
          dryRun: true,
        },
      ],
    });
    expect(backfillPublicCardIndexFromRecordsMock).toHaveBeenCalledWith(
      [{ id: "record-1" }],
      expect.objectContaining({
        locale: "zh_CN",
        dryRun: true,
      }),
    );
  });

  it("accepts the scoped backfill query token without the cron bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await POST(
      new NextRequest(
        "https://claw42.ai/api/admin/public-card-index/backfill?locale=en_US&token=test-backfill-token",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      locales: ["en_US"],
    });
    expect(readAllDecisionRecordsMock).toHaveBeenCalledWith(2000, "en_US");
  });
});
