#!/usr/bin/env node

import axe from "axe-core";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.A11Y_PORT || process.env.PORT || 3000);
const baseUrl = `http://127.0.0.1:${port}`;
const date = new Date().toISOString().slice(0, 10);
const reportDir = path.join(rootDir, "reports", "a11y");
const screenshotDir = path.join(reportDir, "screenshots");
const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

const routes = [
  { name: "zh_CN-home", path: "/zh_CN" },
  { name: "en_US-home", path: "/en_US" },
  { name: "ar_SA-home", path: "/ar_SA", expectDir: "rtl" },
  { name: "agent-root", path: "/agent" },
  { name: "zh_CN-agent", path: "/zh_CN/agent" },
];

if (existsSync(path.join(rootDir, "src", "app", "[locale]", "share"))) {
  routes.push({ name: "share-demo", path: "/share/demo", optional: true });
}

let nextProcess;

try {
  await mkdir(screenshotDir, { recursive: true });
  nextProcess = startNext();
  await waitForHttp(`${baseUrl}/zh_CN`, 60_000);

  const browser = await launchBrowser();
  const results = [];

  try {
    for (const route of routes) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const response = await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

      if (route.optional && response?.status() === 404) {
        await page.close();
        continue;
      }

      await page.addScriptTag({ content: axe.source });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
          resultTypes: ["violations"],
        });
        return result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            html: node.html,
            failureSummary: node.failureSummary,
          })),
        }));
      });

      const focusResults = await page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll("a[href], button:not([disabled]), input:not([disabled])"),
        ).filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).slice(0, 20);

        return elements.map((element, index) => {
          element.scrollIntoView({ block: "center", inline: "center" });
          element.focus();
          const style = window.getComputedStyle(element);
          const visible =
            style.outlineStyle !== "none" ||
            style.boxShadow !== "none" ||
            style.borderColor === "rgb(209, 255, 85)";
          return {
            index,
            tag: element.tagName.toLowerCase(),
            text: (element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 80),
            visible,
          };
        });
      });

      const dir = await page.locator("html").getAttribute("dir");
      if (route.expectDir && dir !== route.expectDir) {
        violations.push({
          id: "html-dir",
          impact: "serious",
          help: `Expected html dir=${route.expectDir}, received ${dir ?? "missing"}`,
          helpUrl: "",
          nodes: [{ target: ["html"], html: "<html>", failureSummary: "Incorrect text direction" }],
        });
      }

      if (["en_US-home", "ar_SA-home", "zh_CN-agent"].includes(route.name)) {
        await page.screenshot({
          path: path.join(screenshotDir, `${date}-${route.name}.png`),
          fullPage: true,
        });
      }

      results.push({
        route,
        finalUrl: page.url(),
        dir,
        violations,
        focusResults,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  await writeFile(
    path.join(reportDir, `${date}.json`),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  );

  printResults(results);
  const blockingCount = results.reduce(
    (total, result) =>
      total + result.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? "")).length,
    0,
  );
  const invisibleFocus = results.flatMap((result) =>
    result.focusResults.filter((item) => !item.visible).map((item) => `${result.route.name}:${item.tag}:${item.text}`),
  );

  if (invisibleFocus.length > 0) {
    console.warn(`\nFocus-visible warnings: ${invisibleFocus.length}`);
    invisibleFocus.slice(0, 10).forEach((item) => console.warn(`  - ${item}`));
  }

  if (blockingCount > 0) {
    throw new Error(`Found ${blockingCount} critical/serious axe violation${blockingCount === 1 ? "" : "s"}.`);
  }
} finally {
  await stopNext();
}

function startNext() {
  const nextBin = path.join(rootDir, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  const child = spawn(nextBin, ["dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: rootDir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  child.on("exit", (code) => {
    if (code !== null && code !== 0) console.error(`[next] exited with ${code}`);
  });
  return child;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ channel: "chrome", headless: true });
  }
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function printResults(results) {
  let total = 0;
  for (const result of results) {
    total += result.violations.length;
    console.log(`\n${result.route.name} ${result.route.path}: ${result.violations.length} axe violation(s)`);
    for (const violation of result.violations) {
      console.log(`  [${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.log(`    - ${Array.isArray(node.target) ? node.target.join(" ") : node.target}`);
      }
    }
  }
  if (total === 0) console.log("\nNo axe violations found on checked routes.");
}

async function stopNext() {
  if (!nextProcess || nextProcess.killed) return;
  nextProcess.kill("SIGTERM");
  await delay(500);
  if (!nextProcess.killed) nextProcess.kill("SIGKILL");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
