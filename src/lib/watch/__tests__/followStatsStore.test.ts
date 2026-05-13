import { afterEach, describe, expect, it } from "vitest";
import {
  __resetFollowStatsForTests,
  followRecord,
  getFollowStats,
  hashAnonIdForFollowStats,
} from "@/lib/watch/followStatsStore";

describe("followStatsStore fallback", () => {
  afterEach(() => {
    __resetFollowStatsForTests();
  });

  it("hashes anon ids before storage keys use them", () => {
    const hash = hashAnonIdForFollowStats("anon-raw-id");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("anon-raw-id");
  });

  it("increments follow count once per anonymous id", async () => {
    const first = await followRecord("record-1", "anon-1");
    const second = await followRecord("record-1", "anon-1");
    const third = await followRecord("record-1", "anon-2");

    expect(first.followCount).toBe(1);
    expect(second.followCount).toBe(1);
    expect(third.followCount).toBe(2);
  });

  it("returns userFollowed for the current anonymous id only", async () => {
    await followRecord("record-1", "anon-1");

    await expect(getFollowStats(["record-1"], "anon-1")).resolves.toEqual({
      "record-1": { watchCount: 1, followCount: 1, userFollowed: true },
    });
    await expect(getFollowStats(["record-1"], "anon-2")).resolves.toEqual({
      "record-1": { watchCount: 1, followCount: 1, userFollowed: false },
    });
  });
});
