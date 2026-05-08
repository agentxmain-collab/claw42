import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const dataSourceHealthFileName = ".hotpursuit-data-source-health.json";

export type DataSourceName = "coingecko" | "cryptocompare" | "rss";

export type DataSourceHealthEntry = {
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  cooldownUntil?: string;
  fallbackCount: number;
};

type DataSourceHealthFile = {
  version: 1;
  sources: Partial<Record<DataSourceName, DataSourceHealthEntry>>;
};

export async function isDataSourceInCooldown(
  source: DataSourceName,
  options: { stateDir?: string; now?: Date } = {},
) {
  if (!options.stateDir) return false;
  const entry = (await readHealthFile(options.stateDir)).sources[source];
  if (!entry?.cooldownUntil) return false;
  return new Date(entry.cooldownUntil).getTime() > (options.now ?? new Date()).getTime();
}

export async function recordDataSourceSuccess(
  source: DataSourceName,
  options: { stateDir?: string; now?: Date } = {},
) {
  if (!options.stateDir) return;
  await updateHealthFile(source, options.stateDir, (entry) => ({
    ...entry,
    lastSuccessAt: (options.now ?? new Date()).toISOString(),
    cooldownUntil: undefined,
  }));
}

export async function recordDataSourceError(
  source: DataSourceName,
  error: unknown,
  options: { stateDir?: string; cooldownMs?: number; now?: Date } = {},
) {
  if (!options.stateDir) return;
  const now = options.now ?? new Date();
  const cooldownMs = Math.max(0, options.cooldownMs ?? 0);
  await updateHealthFile(source, options.stateDir, (entry) => ({
    ...entry,
    lastErrorAt: now.toISOString(),
    lastError: errorMessage(error),
    cooldownUntil: cooldownMs > 0 ? new Date(now.getTime() + cooldownMs).toISOString() : undefined,
  }));
}

export async function recordDataSourceFallback(
  source: DataSourceName,
  options: { stateDir?: string } = {},
) {
  if (!options.stateDir) return;
  await updateHealthFile(source, options.stateDir, (entry) => ({
    ...entry,
    fallbackCount: entry.fallbackCount + 1,
  }));
}

async function updateHealthFile(
  source: DataSourceName,
  stateDir: string,
  updater: (entry: DataSourceHealthEntry) => DataSourceHealthEntry,
) {
  const health = await readHealthFile(stateDir);
  health.sources[source] = updater(health.sources[source] ?? { fallbackCount: 0 });
  await writeHealthFile(stateDir, health);
}

async function readHealthFile(stateDir: string): Promise<DataSourceHealthFile> {
  try {
    const parsed = JSON.parse(
      await readFile(join(resolveStateDir(stateDir), dataSourceHealthFileName), "utf8"),
    ) as DataSourceHealthFile;
    return { version: 1, sources: parsed.sources ?? {} };
  } catch {
    return { version: 1, sources: {} };
  }
}

async function writeHealthFile(stateDir: string, health: DataSourceHealthFile) {
  const resolved = resolveStateDir(stateDir);
  await mkdir(resolved, { recursive: true });
  await writeFile(join(resolved, dataSourceHealthFileName), JSON.stringify(health, null, 2));
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

function resolveStateDir(stateDir: string) {
  return stateDir.trim() || ".cache/hotpursuit";
}
