import { mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";

export interface JsonlLoggerOptions {
  maxBytes?: number;
  lockTimeoutMs?: number;
}

const DEFAULT_MAX_BYTES = 1024 * 1024;
const DEFAULT_LOCK_TIMEOUT_MS = 1500;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFileLock<T>(
  filePath: string,
  timeoutMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const lockPath = `${filePath}.lock`;
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      try {
        return await fn();
      } finally {
        await handle.close();
        await unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`jsonl lock timeout: ${lockPath}`);
      }
      await sleep(50);
    }
  }
}

async function rotateIfNeeded(filePath: string, maxBytes: number) {
  const current = await stat(filePath).catch(() => null);
  if (!current || current.size < maxBytes) return;
  const rotatedPath = `${filePath}.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await rename(filePath, rotatedPath);
}

export async function appendJsonl(
  filePath: string,
  record: Record<string, unknown>,
  options: JsonlLoggerOptions = {},
) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  await mkdir(dirname(filePath), { recursive: true });

  await withFileLock(filePath, lockTimeoutMs, async () => {
    await rotateIfNeeded(filePath, maxBytes);
    const handle = await open(filePath, "a");
    try {
      await handle.appendFile(`${JSON.stringify({ ...record, loggedAt: Date.now() })}\n`, "utf8");
    } finally {
      await handle.close();
    }
  });
}
