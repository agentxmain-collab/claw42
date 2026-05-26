import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const COINW_URL = "https://www.coinw.com/zh_CN";
const TARGET_URL = process.argv[2];
const OUT_DIR = "evidence";
const VIEWPORT = { width: 1440, height: 1200 };
const HYDRATION_WAIT_MS = 3000;

if (!TARGET_URL) {
  console.error("Usage: node scripts/capture-coinw-shell-evidence.mjs <target-url>");
  process.exit(1);
}

const comparisonRows = [
  ["header shell", "backgroundColor", "header.stickyHead", "[data-coinw-shell='header']"],
  ["header shell", "height", "header.stickyHead", "[data-coinw-shell='header']"],
  ["header shell", "padding", "header.stickyHead", "[data-coinw-shell='header']"],
  ["header shell", "fontFamily", "header.stickyHead", "[data-coinw-shell='header']"],
  [
    "header nav",
    "fontSize",
    "header.stickyHead a[href*='/market/futures/all']",
    "[data-coinw-shell='header-nav-link']",
  ],
  [
    "header nav",
    "fontWeight",
    "header.stickyHead a[href*='/market/futures/all']",
    "[data-coinw-shell='header-nav-link']",
  ],
  [
    "header nav",
    "color",
    "header.stickyHead a[href*='/market/futures/all']",
    "[data-coinw-shell='header-nav-link']",
  ],
  [
    "header register",
    "backgroundColor",
    "header.stickyHead .button-login button:last-child",
    "[data-coinw-shell='header-register']",
  ],
  [
    "header register",
    "borderRadius",
    "header.stickyHead .button-login button:last-child",
    "[data-coinw-shell='header-register']",
  ],
  [
    "footer shell",
    "backgroundColor",
    ".footer-border.tw-bg-bgPrimary1",
    "[data-coinw-shell='footer']",
  ],
  [
    "footer title",
    "fontSize",
    ".footer-border.tw-bg-bgPrimary1 footer .tw-title-m-18-b-cw",
    "[data-coinw-shell='footer-title']",
  ],
  [
    "footer title",
    "fontWeight",
    ".footer-border.tw-bg-bgPrimary1 footer .tw-title-m-18-b-cw",
    "[data-coinw-shell='footer-title']",
  ],
  [
    "footer link",
    "fontSize",
    ".footer-border.tw-bg-bgPrimary1 footer a.list-item",
    "[data-coinw-shell='footer-link']",
  ],
  [
    "footer link",
    "color",
    ".footer-border.tw-bg-bgPrimary1 footer a.list-item",
    "[data-coinw-shell='footer-link']",
  ],
  [
    "footer language",
    "borderRadius",
    ".footer-border.tw-bg-bgPrimary1 footer .tw-bg-btnTertiaryDefault",
    "[data-coinw-shell='footer-language']",
  ],
];

async function preparePage(browser, url) {
  const page = await browser.newPage({
    viewport: VIEWPORT,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response || response.status() >= 400) {
    throw new Error(`${url} failed: ${response ? response.status() : "no response"}`);
  }
  await page.waitForTimeout(HYDRATION_WAIT_MS);
  return page;
}

async function computed(page, selector, field) {
  return page.evaluate(
    ({ selector, field }) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing selector: ${selector}`);
      const style = window.getComputedStyle(element);
      if (field === "height") return `${element.getBoundingClientRect().height}px`;
      return style[field];
    },
    { selector, field },
  );
}

async function screenshotHeader(page, selector) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  return page.locator(selector).first().screenshot();
}

async function screenshotFooter(page, selector) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  return locator.screenshot();
}

async function combinedScreenshot(browser, title, leftBuffer, rightBuffer, outputPath) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 620 } });
  const left = `data:image/png;base64,${leftBuffer.toString("base64")}`;
  const right = `data:image/png;base64,${rightBuffer.toString("base64")}`;
  await page.setContent(`
    <html>
      <body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="padding:16px 18px 10px;font-weight:700;font-size:18px;color:#111;">${title}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 12px 12px;">
          <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:#555;">coinw.com actual</div><img src="${left}" style="width:100%;border:1px solid #d4d4d8;background:white;" /></div>
          <div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:#555;">claw42 target</div><img src="${right}" style="width:100%;border:1px solid #d4d4d8;background:white;" /></div>
        </div>
      </body>
    </html>
  `);
  await page.screenshot({ path: outputPath, fullPage: true });
  await page.close();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const coinw = await preparePage(browser, COINW_URL);
  const target = await preparePage(browser, TARGET_URL);

  await target.waitForSelector("[data-coinw-shell='header']", { timeout: 30_000 });
  await target.waitForSelector("[data-coinw-shell='footer']", { timeout: 30_000 });

  const rows = [];
  for (const [element, field, coinwSelector, targetSelector] of comparisonRows) {
    const coinwValue = await computed(coinw, coinwSelector, field);
    const targetValue = await computed(target, targetSelector, field);
    rows.push({ element, field, coinwValue, targetValue, match: coinwValue === targetValue });
  }

  const headerCoinw = await screenshotHeader(coinw, "header.stickyHead");
  const headerTarget = await screenshotHeader(target, "[data-coinw-shell='header']");
  await combinedScreenshot(
    browser,
    "Round 10 Header Comparison",
    headerCoinw,
    headerTarget,
    path.join(OUT_DIR, "round10-header-diff.png"),
  );

  const footerCoinw = await screenshotFooter(coinw, ".footer-border.tw-bg-bgPrimary1");
  const footerTarget = await screenshotFooter(target, "[data-coinw-shell='footer']");
  await combinedScreenshot(
    browser,
    "Round 10 Footer Comparison",
    footerCoinw,
    footerTarget,
    path.join(OUT_DIR, "round10-footer-diff.png"),
  );

  const matched = rows.filter((row) => row.match).length;
  const markdown = [
    "# Round 10 Token Comparison: coinw.com vs claw42 target",
    "",
    `- coinw.com source: ${COINW_URL}`,
    `- claw42 target: ${TARGET_URL}`,
    `- matched rows: ${matched}/${rows.length}`,
    "",
    "| Element | Field | coinw.com (actual) | claw42 target | Match? |",
    "|---|---|---|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.element} | ${row.field} | ${row.coinwValue.replaceAll("|", "\\|")} | ${row.targetValue.replaceAll("|", "\\|")} | ${row.match ? "✓" : "✗"} |`,
    ),
    "",
  ].join("\n");
  await fs.writeFile(path.join(OUT_DIR, "round10-token-comparison.md"), markdown);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
