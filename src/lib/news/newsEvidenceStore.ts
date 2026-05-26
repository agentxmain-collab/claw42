import { promises as fs } from "fs";
import path from "path";
import { kv } from "@/lib/kv-shim";
import type { NewsEvidence } from "@/lib/news/newsEvidence";

type KvClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
};

const KV_PREFIX = "news-evidence:v1:";
const KV_TTL_SECONDS = 7 * 24 * 60 * 60;
const memoryEvidence = new Map<string, NewsEvidence>();

function hasKvConfig() {
  return Boolean(
    process.env.USE_PERSISTENT_KV === "true" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN,
  );
}

function keyForEvidence(evidenceId: string) {
  return `${KV_PREFIX}${evidenceId}`;
}

export async function saveNewsEvidence(evidence: NewsEvidence): Promise<NewsEvidence> {
  memoryEvidence.set(evidence.id, evidence);
  if (hasKvConfig()) {
    try {
      await (kv as KvClient).set(keyForEvidence(evidence.id), evidence, { ex: KV_TTL_SECONDS });
      return evidence;
    } catch {
      // Keep memory/local fallback below.
    }
  }

  try {
    await appendLocalEvidence(evidence);
  } catch {
    // Memory fallback is already populated.
  }
  return evidence;
}

export async function getNewsEvidence(evidenceId: string): Promise<NewsEvidence | null> {
  const inMemory = memoryEvidence.get(evidenceId);
  if (inMemory) return inMemory;

  if (hasKvConfig()) {
    try {
      const value = await (kv as KvClient).get<NewsEvidence>(keyForEvidence(evidenceId));
      if (value) memoryEvidence.set(value.id, value);
      return value ?? null;
    } catch {
      return getLocalEvidence(evidenceId);
    }
  }

  return getLocalEvidence(evidenceId);
}

async function localStoreFile() {
  return (
    process.env.NEWS_EVIDENCE_STORE_FILE ??
    path.join(process.cwd(), ".cache", "news-evidence.jsonl")
  );
}

async function appendLocalEvidence(evidence: NewsEvidence) {
  const file = await localStoreFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(evidence)}\n`, "utf8");
}

async function getLocalEvidence(evidenceId: string): Promise<NewsEvidence | null> {
  const file = await localStoreFile();
  const content = await fs.readFile(file, "utf8").catch(() => "");
  const lines = content.split("\n").filter(Boolean).reverse();
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as NewsEvidence;
      if (parsed.id === evidenceId) {
        memoryEvidence.set(parsed.id, parsed);
        return parsed;
      }
    } catch {
      // Ignore malformed local fallback lines.
    }
  }
  return null;
}

export const __newsEvidenceStoreTestUtils = {
  clearMemory() {
    memoryEvidence.clear();
  },
};
