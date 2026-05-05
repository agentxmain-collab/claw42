import fs from "fs/promises";
import path from "path";

export type CachedPayload<T> = {
  data: T;
  generatedAt: number;
};

const CACHE_DIR = path.join(process.env.CLAW42_CACHE_DIR || "/tmp/claw42-cache");

function cachePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "-");
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

export async function getCachedJson<T>(key: string): Promise<CachedPayload<T> | null> {
  try {
    const raw = await fs.readFile(cachePath(key), "utf8");
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!parsed || typeof parsed.generatedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedJson<T>(key: string, payload: CachedPayload<T>): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachePath(key), JSON.stringify(payload, null, 2));
}
