import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { withFileLock } from "@/lib/storage/file-lock";

export type JsonlWriteOptions = {
  maxBytes?: number;
  maxFiles?: number;
};

const defaultMaxFiles = 5;

/**
 * Appends one JSON-serializable value per line under a file lock.
 * Rotation naming is `events.jsonl` -> `events.jsonl.1` -> `events.jsonl.2`.
 * When `maxFiles` is exceeded the oldest suffix is deleted, then existing
 * files are moved with atomic rename before the new active file is appended.
 */
export async function appendJsonLine(path: string, value: unknown, options: JsonlWriteOptions = {}) {
  const line = `${JSON.stringify(value)}\n`;
  const maxFiles = Math.max(1, Math.floor(options.maxFiles ?? defaultMaxFiles));

  await mkdir(dirname(path), { recursive: true });
  await withFileLock(`${path}.lock`, async () => {
    await rotateIfNeeded(path, Buffer.byteLength(line), options.maxBytes, maxFiles);
    await appendFile(path, line);
  });
}

async function rotateIfNeeded(path: string, lineBytes: number, maxBytes: number | undefined, maxFiles: number) {
  if (!maxBytes || maxBytes <= 0) return;
  const currentBytes = await fileSize(path);
  if (currentBytes === 0 || currentBytes + lineBytes <= maxBytes) return;

  await rm(`${path}.${maxFiles}`, { force: true });
  for (let index = maxFiles - 1; index >= 1; index -= 1) {
    await renameIfExists(`${path}.${index}`, `${path}.${index + 1}`);
  }
  await renameIfExists(path, `${path}.1`);
}

async function fileSize(path: string) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function renameIfExists(from: string, to: string) {
  try {
    await rename(from, to);
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
}

function isMissingFileError(value: unknown) {
  return value instanceof Error && "code" in value && value.code === "ENOENT";
}
