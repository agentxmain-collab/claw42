import { appendFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { withFileLock } from "@/lib/storage/file-lock";

export interface JsonlWriteOptions {
  maxBytes?: number;
  maxFiles?: number;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_FILES = 5;

/**
 * Appends one JSON-serializable value per line under a file lock.
 * Rotation naming is `events.jsonl` -> `events.jsonl.1` -> `events.jsonl.2`.
 * When `maxFiles` is exceeded the oldest suffix is deleted, then existing
 * files are moved with atomic rename before the new active file is appended.
 */
export async function appendJsonLine(
  filePath: string,
  value: unknown,
  options: JsonlWriteOptions = {},
) {
  const line = `${JSON.stringify(value)}\n`;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxFiles = Math.max(1, Math.floor(options.maxFiles ?? DEFAULT_MAX_FILES));

  await mkdir(dirname(filePath), { recursive: true });
  await withFileLock(`${filePath}.lock`, async () => {
    await rotateIfNeeded(filePath, Buffer.byteLength(line), maxBytes, maxFiles);
    await appendFile(filePath, line, "utf8");
  });
}

async function rotateIfNeeded(
  filePath: string,
  incomingBytes: number,
  maxBytes: number,
  maxFiles: number,
) {
  if (maxBytes <= 0) return;

  const currentBytes = await fileSize(filePath);
  if (currentBytes === 0 || currentBytes + incomingBytes <= maxBytes) return;

  await rm(`${filePath}.${maxFiles}`, { force: true });
  for (let index = maxFiles - 1; index >= 1; index -= 1) {
    await renameIfExists(`${filePath}.${index}`, `${filePath}.${index + 1}`);
  }
  await renameIfExists(filePath, `${filePath}.1`);
}

async function fileSize(filePath: string) {
  try {
    return (await stat(filePath)).size;
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

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function pruneJsonlRotations(directory: string, baseName: string, maxFiles: number) {
  const entries = await readdir(directory).catch(() => []);
  const rotations = entries
    .map((entry) => {
      const match = entry.match(new RegExp(`^${escapeRegExp(baseName)}\\.(\\d+)$`));
      return match ? { entry, index: Number(match[1]) } : null;
    })
    .filter((entry): entry is { entry: string; index: number } => entry !== null)
    .sort((a, b) => b.index - a.index);

  for (const rotation of rotations.slice(maxFiles)) {
    await rm(join(directory, rotation.entry), { force: true });
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
