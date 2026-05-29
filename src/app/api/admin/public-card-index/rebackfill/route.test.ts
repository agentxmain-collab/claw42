import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/admin/public-card-index/rebackfill/route";

const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const readPublicCardIndexEntriesMock = vi.hoisted(() => vi.fn());
const buildPublicCardIndexEntryMock = vi.hoisted(() => vi.fn());
const backfillPublicCardIndexFromRecordsMock = vi.hoisted(() => vi.fn());
const rebuildPublicCardIndexFromRecordsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/team/decisionRecordStore", () => ({
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/watch/publicCardIndex", () => ({
  backfillPublicCardIndexFromRecords: backfillPublicCardIndexFromRecordsMock,
  buildPublicCardIndexEntry: buildPublicCardIndexEntryMock,
  readPublicCardIndexEntries: readPublicCardIndexEntriesMock,
  rebuildPublicCardIndexFromRecords: rebuildPublicCardIndexFromRecordsMock,
}));

describe("/api/admin/public-card-index/rebackfill", () => {
  beforeEach(() => {
    vi.stubEnv("OPS_HEALTH_SECRET", "test-ops-secret");
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const records = Array.from({ length: 15 }, (_, index) => ({
      id: index < 13 ? `stuck-${index}` : index === 13 ? "indexed-1" : "analysis-only",
    }));
    readAllDecisionRecordsMock.mockReset().mockResolvedValue(records);
    readPublicCardIndexEntriesMock.mockReset().mockResolvedValue([{ id: "pm-decision:indexed-1" }]);
    buildPublicCardIndexEntryMock.mockReset().mockImplementation((record) => {
      if (record.id === "analysis-only") return null;
      return { id: `pm-decision:${record.id}`, createdAt: "2026-05-28T07:00:00.000Z" };
    });
    backfillPublicCardIndexFromRecordsMock.mockReset().mockResolvedValue({
      ok: true,
      locale: "zh_CN",
      dryRun: false,
      recordsScanned: 13,
      recordsWritten: 13,
      recordsSkippedReason: {
        localeMismatch: 0,
        notProjectable: 0,
        invalidCreatedAt: 0,
        writeFailed: 0,
      },
      indexCountAfter: 14,
      removedByAge: 0,
      removedByCap: 0,
      removedByNonStrategy: 0,
      durationMs: 1,
    });
    rebuildPublicCardIndexFromRecordsMock.mockReset().mockResolvedValue({
      ok: true,
      locale: "zh_CN",
      dryRun: false,
      recordsRead: 15,
      candidateCount: 14,
      rebuiltCount: 14,
      addedCount: 13,
      removedCount: 1,
      kept: 1,
      alreadyIndexed: 1,
      skippedNonStrategy: 1,
      invalidCreatedAt: 0,
      errors: 0,
      indexCountAfter: 14,
      durationMs: 1,
    });
  });

  it("rejects unauthorized rebackfill requests before reading records", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/admin/public-card-index/rebackfill"),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "unauthorized" });
    expect(readAllDecisionRecordsMock).not.toHaveBeenCalled();
  });

  it("dry-runs the zh_CN stuck record count without writing", async () => {
    const response = await GET(
      new NextRequest(
        "https://claw42.ai/api/admin/public-card-index/rebackfill?locale=zh_CN&dryRun=1",
        { headers: { "x-claw42-ops-secret": "test-ops-secret" } },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      locale: "zh_CN",
      dryRun: true,
      recordsRead: 15,
      alreadyIndexed: 1,
      skippedNonStrategy: 1,
      candidateCount: 13,
      rebackfilledCount: 13,
      errors: 0,
    });
    expect(backfillPublicCardIndexFromRecordsMock).not.toHaveBeenCalled();
  });

  it("keeps the phase scope zh_CN-only", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/admin/public-card-index/rebackfill?locale=en_US", {
        headers: { "x-claw42-ops-secret": "test-ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      ok: false,
      error: "unsupported_locale",
      locale: "en_US",
      supportedLocales: ["zh_CN"],
    });
    expect(readAllDecisionRecordsMock).not.toHaveBeenCalled();
  });

  it("rebackfills only missing public strategy cards", async () => {
    const response = await POST(
      new NextRequest("https://claw42.ai/api/admin/public-card-index/rebackfill?locale=zh_CN", {
        method: "POST",
        headers: { authorization: "Bearer test-ops-secret" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rebackfilledCount).toBe(13);
    expect(backfillPublicCardIndexFromRecordsMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "stuck-0" })]),
      { locale: "zh_CN", dryRun: false },
    );
    expect(backfillPublicCardIndexFromRecordsMock.mock.calls[0]?.[0]).toHaveLength(13);
  });

  it("rebuilds the index when explicitly requested", async () => {
    const response = await POST(
      new NextRequest(
        "https://claw42.ai/api/admin/public-card-index/rebackfill?locale=zh_CN&action=rebuild",
        {
          method: "POST",
          headers: { authorization: "Bearer test-ops-secret" },
        },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      locale: "zh_CN",
      action: "rebuild",
      recordsRead: 15,
      rebuiltCount: 14,
      addedCount: 13,
      removedCount: 1,
      kept: 1,
      alreadyIndexed: 1,
      errors: 0,
    });
    expect(rebuildPublicCardIndexFromRecordsMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "stuck-0" })]),
      { locale: "zh_CN", dryRun: false },
    );
    expect(backfillPublicCardIndexFromRecordsMock).not.toHaveBeenCalled();
  });
});
