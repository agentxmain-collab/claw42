import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const requireMadge = createRequire(__filename);

type MadgeResult = {
  obj(): Record<string, string[]>;
};

type Madge = (
  entryPoint: string,
  options: { tsConfig: string; fileExtensions: string[] },
) => Promise<MadgeResult>;

const madge = requireMadge("madge") as Madge;

const PUBLIC_WATCH_ENTRY_POINTS = [
  "src/modules/agent-watch/AgentWatchBoard.tsx",
  "src/app/[locale]/agent/page.tsx",
  "src/app/api/watch/timeline/route.ts",
  "src/app/api/watch/history/route.ts",
] as const;

const BLOCKED_LEGACY_MODULES = [
  "src/lib/factionRegistry.ts",
  "src/modules/agent-watch/components/AgentMiniCard.tsx",
  "src/modules/agent-watch/components/AgentWinrateCard.tsx",
  "src/modules/agent-watch/components/NewsDebateCard.tsx",
  "src/modules/agent-watch/components/FactionPresenceBar.tsx",
] as const;

type DependencyGraph = Map<string, string[]>;

function toProjectPath(absolutePath: string) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function resolveGraphPath(entryPoint: string, graphPath: string) {
  if (path.isAbsolute(graphPath)) return path.normalize(graphPath);

  const fromEntryDirectory = path.resolve(ROOT, path.dirname(entryPoint), graphPath);
  if (fs.existsSync(fromEntryDirectory)) return fromEntryDirectory;

  return path.resolve(ROOT, graphPath);
}

async function readMadgeGraph(entryPoint: string): Promise<DependencyGraph> {
  const result = await madge(entryPoint, {
    tsConfig: "tsconfig.json",
    fileExtensions: ["ts", "tsx"],
  });
  const parsed = result.obj();
  const graph: DependencyGraph = new Map();

  for (const [node, dependencies] of Object.entries(parsed)) {
    const absoluteNode = resolveGraphPath(entryPoint, node);
    graph.set(
      absoluteNode,
      dependencies.map((dependency) => resolveGraphPath(entryPoint, dependency)),
    );
  }

  return graph;
}

function findImportPathInGraph(
  entryPoint: string,
  blockedModule: string,
  graph: DependencyGraph,
): string[] | null {
  const start = path.resolve(ROOT, entryPoint);
  const target = path.resolve(ROOT, blockedModule);
  const queue: string[][] = [[start]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const current = currentPath[currentPath.length - 1]!;
    if (current === target) return currentPath.map(toProjectPath);
    if (visited.has(current)) continue;
    visited.add(current);

    for (const dependency of graph.get(current) ?? []) {
      if (!visited.has(dependency)) queue.push([...currentPath, dependency]);
    }
  }

  return null;
}

describe("faction retirement public import boundary", () => {
  test("public Watch entry dependency closures do not reach retired faction modules", async () => {
    const violations: string[] = [];

    for (const entryPoint of PUBLIC_WATCH_ENTRY_POINTS) {
      const graph = await readMadgeGraph(entryPoint);
      for (const blockedModule of BLOCKED_LEGACY_MODULES) {
        const importPath = findImportPathInGraph(entryPoint, blockedModule, graph);
        if (importPath) {
          violations.push(`${entryPoint} -> ${blockedModule}\n${importPath.join(" -> ")}`);
        }
      }
    }

    expect(violations).toEqual([]);
  }, 30_000);
});
