import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendJsonLine } from "../jsonl-writer";

describe("appendJsonLine", () => {
  it("rotates when the target file exceeds the byte limit", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "claw42-jsonl-"));
    const filePath = join(rootDir, "2026-05-07.jsonl");

    try {
      await writeFile(filePath, `${"x".repeat(80)}\n`);
      await appendJsonLine(filePath, { ok: true }, { maxBytes: 90, maxFiles: 2 });

      const active = await readFile(filePath, "utf8");
      const rotated = await readFile(`${filePath}.1`, "utf8");

      expect(JSON.parse(active.trim())).toEqual({ ok: true });
      expect(rotated).toContain("x");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps at most the configured rotation count", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "claw42-jsonl-"));
    const filePath = join(rootDir, "2026-05-07.jsonl");

    try {
      for (let index = 0; index < 4; index += 1) {
        await writeFile(filePath, `${"x".repeat(80)}\n`);
        await appendJsonLine(filePath, { index }, { maxBytes: 90, maxFiles: 2 });
      }

      const files = await readdir(rootDir);
      expect(files.filter((file) => file.startsWith("2026-05-07.jsonl"))).toHaveLength(3);
      expect(files).toContain("2026-05-07.jsonl.2");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
