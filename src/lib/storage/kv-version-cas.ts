import { kv } from "@/lib/kv-shim";

export interface VersionedKvEnvelope<T> {
  version: number;
  value: T;
  updatedAt: string;
}

type KvCasClient = {
  get<T>(key: string): Promise<T | null>;
  set?(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  eval?(script: string, keys: string[], args: string[]): Promise<unknown>;
};

export interface UpdateKvVersionedJsonOptions {
  client?: KvCasClient;
  maxAttempts?: number;
  ttlSeconds?: number;
}

const memoryStore = new Map<string, VersionedKvEnvelope<unknown>>();

const CAS_SCRIPT = `
  local current = redis.call("get", KEYS[1])
  local expected = tonumber(ARGV[1])
  if current == false then
    if expected ~= -1 then
      return 0
    end
  else
    local ok, decoded = pcall(cjson.decode, current)
    if not ok or tonumber(decoded["version"]) ~= expected then
      return 0
    end
  end
  if ARGV[3] and ARGV[3] ~= "" then
    redis.call("set", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
  else
    redis.call("set", KEYS[1], ARGV[2])
  end
  return 1
`;

export class KvVersionConflictError extends Error {
  constructor(
    public readonly key: string,
    public readonly attempts: number,
  ) {
    super(`KV version conflict for "${key}" after ${attempts} attempts`);
    this.name = "KvVersionConflictError";
  }
}

export class KvVersionCasUnavailableError extends Error {
  constructor(public readonly key: string) {
    super(`KV atomic CAS is unavailable for "${key}"`);
    this.name = "KvVersionCasUnavailableError";
  }
}

export async function updateKvVersionedJson<T>(
  key: string,
  updater: (current: T | null, currentVersion: number) => T | Promise<T>,
  options: UpdateKvVersionedJsonOptions = {},
): Promise<VersionedKvEnvelope<T>> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const client = options.client ?? kvClient();

  if (!client) {
    return updateMemoryVersionedJson(key, updater);
  }

  if (typeof client.eval !== "function") {
    throw new KvVersionCasUnavailableError(key);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const currentEnvelope = await readEnvelope<T>(client, key);
    const currentVersion = currentEnvelope?.version ?? -1;
    const nextVersion = currentVersion + 1;
    const nextValue = await updater(currentEnvelope?.value ?? null, currentVersion);
    const nextEnvelope: VersionedKvEnvelope<T> = {
      version: nextVersion,
      value: nextValue,
      updatedAt: new Date().toISOString(),
    };
    const result = await client.eval(
      CAS_SCRIPT,
      [key],
      [
        String(currentVersion),
        JSON.stringify(nextEnvelope),
        options.ttlSeconds ? String(Math.floor(options.ttlSeconds)) : "",
      ],
    );
    if (result === 1 || result === "1") return nextEnvelope;
  }

  throw new KvVersionConflictError(key, maxAttempts);
}

async function readEnvelope<T>(
  client: KvCasClient,
  key: string,
): Promise<VersionedKvEnvelope<T> | null> {
  const raw = await client.get<VersionedKvEnvelope<T> | string>(key);
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return normalizeEnvelope(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return normalizeEnvelope(raw);
}

function normalizeEnvelope<T>(raw: unknown): VersionedKvEnvelope<T> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const envelope = raw as Partial<VersionedKvEnvelope<T>>;
  if (typeof envelope.version !== "number" || !Number.isFinite(envelope.version)) return null;
  if (!("value" in envelope)) return null;
  return {
    version: Math.floor(envelope.version),
    value: envelope.value as T,
    updatedAt:
      typeof envelope.updatedAt === "string" ? envelope.updatedAt : new Date(0).toISOString(),
  };
}

async function updateMemoryVersionedJson<T>(
  key: string,
  updater: (current: T | null, currentVersion: number) => T | Promise<T>,
): Promise<VersionedKvEnvelope<T>> {
  const current = memoryStore.get(key) as VersionedKvEnvelope<T> | undefined;
  const currentVersion = current?.version ?? -1;
  const nextEnvelope: VersionedKvEnvelope<T> = {
    version: currentVersion + 1,
    value: await updater(current?.value ?? null, currentVersion),
    updatedAt: new Date().toISOString(),
  };
  memoryStore.set(key, nextEnvelope as VersionedKvEnvelope<unknown>);
  return nextEnvelope;
}

function kvClient(): KvCasClient | null {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  )
    ? (kv as KvCasClient)
    : null;
}

export const __kvVersionCasTestUtils = {
  clearMemoryStore() {
    memoryStore.clear();
  },
};
