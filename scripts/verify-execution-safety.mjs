import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function readRelative(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`missing:${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function requireIncludes(relativePath, needle, label) {
  const value = readRelative(relativePath);
  if (!value.includes(needle)) failures.push(`${relativePath}:${label}`);
}

function requireNotIncludes(relativePath, needle, label) {
  const value = readRelative(relativePath);
  if (value.includes(needle)) failures.push(`${relativePath}:${label}`);
}

function listFiles(directory) {
  const absolutePath = path.join(root, directory);
  if (!existsSync(absolutePath)) return [];
  return readdirSync(absolutePath).flatMap((entry) => {
    const fullPath = path.join(absolutePath, entry);
    const relativePath = path.relative(root, fullPath);
    if (statSync(fullPath).isDirectory()) return listFiles(relativePath);
    return [relativePath];
  });
}

requireIncludes(
  "src/modules/agent-watch/v9/TopicStrategy.tsx",
  '(topic.candidateType ?? "symbol") === "symbol"',
  "v9 follow trade must require symbol candidate type",
);
requireIncludes(
  "src/modules/agent-watch/v9/TopicStrategy.tsx",
  "topic.execution?.watchOnly !== true",
  "v9 follow trade must reject watch-only metadata",
);
requireIncludes(
  "src/modules/agent-watch/v9/TopicStrategy.tsx",
  "topic.execution?.executable !== false",
  "v9 follow trade must reject explicitly non-executable metadata",
);
requireIncludes(
  "src/modules/agent-watch/v9/TopicStrategy.tsx",
  "disabled",
  "v9 primary follow action must stay disabled until real execution is separately approved",
);

requireIncludes(
  "src/modules/agent-watch/v10/MarketAnalysisPanel.tsx",
  'candidateType === "symbol"',
  "v10 follow trade must require symbol candidate type",
);
requireIncludes(
  "src/modules/agent-watch/v10/MarketAnalysisPanel.tsx",
  "topic.execution?.executable === true",
  "v10 CoinW pair deep link must require explicit executable metadata",
);
requireIncludes(
  "src/modules/agent-watch/v10/MarketAnalysisPanel.tsx",
  "href={coinwFuturesUrl}",
  "v10 primary action must navigate out to CoinW instead of submitting an internal order",
);
requireNotIncludes(
  "src/modules/agent-watch/v10/MarketAnalysisPanel.tsx",
  "dict.followTrade.disabled_label",
  "v10 primary action must not render the deprecated disabled demo action",
);

requireIncludes(
  "src/modules/agent-watch/AgentWatchBoard.tsx",
  '(topic.candidateType ?? "symbol") !== "symbol"',
  "client follow handler must reject non-symbol candidates",
);
requireIncludes(
  "src/modules/agent-watch/AgentWatchBoard.tsx",
  'apiPath("/api/watch/follow-stats")',
  "client follow handler may only write follow statistics",
);
requireNotIncludes(
  "src/modules/agent-watch/AgentWatchBoard.tsx",
  "/api/coinw",
  "client follow handler must not call CoinW routes",
);

requireNotIncludes(
  "src/app/api/watch/follow-stats/route.ts",
  "coinw",
  "follow-stats route must not call CoinW",
);
requireNotIncludes(
  "src/app/api/watch/follow-stats/route.ts",
  "placeOrder",
  "follow-stats route must not place orders",
);
requireNotIncludes(
  "src/app/api/watch/follow-stats/route.ts",
  "submitOrder",
  "follow-stats route must not submit orders",
);

requireIncludes(
  "src/app/api/watch/follow-intents/route.ts",
  "coinw_real_submission_not_enabled",
  "follow-intents route must default to disabled real submission",
);
requireNotIncludes(
  "src/app/api/watch/follow-intents/route.ts",
  "fetch(",
  "follow-intents route must not submit directly to CoinW",
);
requireNotIncludes(
  "src/app/api/watch/follow-intents/route.ts",
  "/v1/perpum/order",
  "follow-intents route must not embed a direct CoinW order submission",
);

const apiRouteFiles = listFiles("src/app/api").filter(
  (file) => file.endsWith("/route.ts") || file.endsWith("/route.tsx"),
);
const unexpectedExecutionRoutes = apiRouteFiles.filter((file) =>
  /\/(?:coinw|execution|order|trade)\//i.test(`/${file}`),
);
if (unexpectedExecutionRoutes.length > 0) {
  failures.push(`unexpected execution API routes:${unexpectedExecutionRoutes.join(",")}`);
}

if (!existsSync(path.join(root, "docs/coinw-integration-requirements.md"))) {
  failures.push("missing:docs/coinw-integration-requirements.md");
}
if (!existsSync(path.join(root, "docs/claw42-agent-service-architecture.md"))) {
  failures.push("missing:docs/claw42-agent-service-architecture.md");
}

if (failures.length > 0) {
  console.error("[claw42] execution safety verification failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[claw42] execution safety verification passed");
