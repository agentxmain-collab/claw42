#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = [
  "vitest",
  "run",
  "src/lib/observability/__tests__/metrics.test.ts",
  "src/lib/storage/__tests__/jsonl-writer.test.ts",
];

const child = spawn("npx", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
