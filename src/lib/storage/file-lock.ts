import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

type FileLockOptions = {
  timeoutMs?: number;
  retryMs?: number;
  staleMs?: number;
};

const defaultTimeoutMs = 5_000;
const defaultRetryMs = 10;
const defaultStaleMs = 30_000;

/**
 * Serializes local file mutations with a lock file created via exclusive open.
 * The lock file stores pid/createdAt for diagnostics; stale locks are removed
 * after `staleMs`, and acquisition fails after `timeoutMs` instead of hanging.
 */
export async function withFileLock<T>(lockPath: string, run: () => Promise<T>, options: FileLockOptions = {}): Promise<T> {
  const release = await acquireFileLock(lockPath, options);
  try {
    return await run();
  } finally {
    await release();
  }
}

async function acquireFileLock(lockPath: string, options: FileLockOptions) {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const retryMs = options.retryMs ?? defaultRetryMs;
  const staleMs = options.staleMs ?? defaultStaleMs;
  const startedAt = Date.now();

  await mkdir(dirname(lockPath), { recursive: true });

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      return async () => {
        await handle.close();
        await rm(lockPath, { force: true });
      };
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      await removeStaleLock(lockPath, staleMs);
      await sleep(retryMs);
    }
  }

  throw new Error(`Timed out waiting for file lock: ${lockPath}`);
}

async function removeStaleLock(lockPath: string, staleMs: number) {
  try {
    const value = await stat(lockPath);
    if (Date.now() - value.mtimeMs > staleMs) await rm(lockPath, { force: true });
  } catch {
    // If another process removed the lock first, retry acquisition normally.
  }
}

function isFileExistsError(value: unknown) {
  return value instanceof Error && "code" in value && value.code === "EEXIST";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
