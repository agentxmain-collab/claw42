import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";
import type { FollowStatsSnapshot } from "@/lib/watch/v9TopicAdapter";

const FOLLOW_STATS_KEY_PREFIX = "watch:follow-stats:v1";
const FOLLOWER_SET_TTL_SECONDS = 7 * 24 * 60 * 60;

interface FallbackRecord {
  watchCount: number;
  followCount: number;
  followers: Set<string>;
}

type KvFollowStatsClient = typeof kv & {
  get<T = unknown>(key: string): Promise<T | null>;
  incr(key: string): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  sismember(key: string, member: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

const fallbackRecords = new Map<string, FallbackRecord>();
let warnedAboutFallback = false;

function getKvClient(): KvFollowStatsClient | null {
  const available = Boolean(
    process.env.KV_REST_API_URL &&
      process.env.KV_REST_API_TOKEN &&
      kv &&
      typeof kv.get === "function" &&
      typeof kv.incr === "function" &&
      typeof kv.sadd === "function" &&
      typeof kv.sismember === "function" &&
      typeof kv.expire === "function",
  );
  return available ? (kv as KvFollowStatsClient) : null;
}

function warnFallbackOnce() {
  if (warnedAboutFallback || process.env.NODE_ENV === "test") return;
  warnedAboutFallback = true;
  console.warn("KV not configured, using in-memory follow stats fallback (single instance only)");
}

function statsKey(recordId: string, field: "watch" | "follow" | "followers") {
  return `${FOLLOW_STATS_KEY_PREFIX}:${recordId}:${field}`;
}

function fallbackFor(recordId: string) {
  const existing = fallbackRecords.get(recordId);
  if (existing) return existing;
  const next: FallbackRecord = {
    watchCount: 0,
    followCount: 0,
    followers: new Set(),
  };
  fallbackRecords.set(recordId, next);
  return next;
}

function serverSalt() {
  return (
    process.env.FOLLOW_STATS_HASH_SALT ??
    process.env.NEXTAUTH_SECRET ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "claw42-follow-stats-local-salt"
  );
}

export function hashAnonIdForFollowStats(anonId: string) {
  return createHash("sha256").update(serverSalt()).update(":").update(anonId).digest("hex");
}

function normalizeCount(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

export async function getFollowStats(
  recordIds: readonly string[],
  anonId?: string | null,
): Promise<Record<string, FollowStatsSnapshot>> {
  const uniqueRecordIds = Array.from(new Set(recordIds.filter(Boolean)));
  const hashedAnonId = anonId ? hashAnonIdForFollowStats(anonId) : null;

  const client = getKvClient();
  if (!client) {
    warnFallbackOnce();
    return Object.fromEntries(
      uniqueRecordIds.map((recordId) => {
        const record = fallbackFor(recordId);
        return [
          recordId,
          {
            watchCount: record.watchCount,
            followCount: record.followCount,
            userFollowed: hashedAnonId ? record.followers.has(hashedAnonId) : false,
          },
        ];
      }),
    );
  }

  const pairs = await Promise.all(
    uniqueRecordIds.map(async (recordId) => {
      const [watchCount, followCount, userFollowed] = await Promise.all([
        client.get<number>(statsKey(recordId, "watch")),
        client.get<number>(statsKey(recordId, "follow")),
        hashedAnonId ? client.sismember(statsKey(recordId, "followers"), hashedAnonId) : 0,
      ]);
      return [
        recordId,
        {
          watchCount: Math.max(normalizeCount(watchCount), normalizeCount(followCount)),
          followCount: normalizeCount(followCount),
          userFollowed: Boolean(userFollowed),
        },
      ] as const;
    }),
  );

  return Object.fromEntries(pairs);
}

export async function followRecord(
  recordId: string,
  anonId: string,
): Promise<FollowStatsSnapshot> {
  const hashedAnonId = hashAnonIdForFollowStats(anonId);

  const client = getKvClient();
  if (!client) {
    warnFallbackOnce();
    const record = fallbackFor(recordId);
    if (!record.followers.has(hashedAnonId)) {
      record.followers.add(hashedAnonId);
      record.followCount += 1;
      record.watchCount = Math.max(record.watchCount, record.followCount);
    }
    return {
      watchCount: record.watchCount,
      followCount: record.followCount,
      userFollowed: true,
    };
  }

  const followersKey = statsKey(recordId, "followers");
  const added = await client.sadd(followersKey, hashedAnonId);
  await client.expire(followersKey, FOLLOWER_SET_TTL_SECONDS);

  let followCount = normalizeCount(await client.get<number>(statsKey(recordId, "follow")));
  if (added > 0) {
    followCount = await client.incr(statsKey(recordId, "follow"));
  }
  const watchCount = Math.max(
    normalizeCount(await client.get<number>(statsKey(recordId, "watch"))),
    followCount,
  );

  return {
    watchCount,
    followCount,
    userFollowed: true,
  };
}

export function __resetFollowStatsForTests() {
  fallbackRecords.clear();
  warnedAboutFallback = false;
}
