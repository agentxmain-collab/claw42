import { chromium } from "playwright";

const TARGET_URL = "https://www.coinw.com/zh_CN";

const TOP_LEVEL_LABELS = [
  "买币",
  "行情",
  "U本位合约",
  "交易",
  "跟单",
  "策略大厅",
  "赚币",
  "Launch X",
  "更多",
];

const LABEL_NORMALIZATION = new Map([["策略大厅", "策略"]]);

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isTopLevelMatch(text, label) {
  if (label === "跟单") return text === "跟单New" || text === "跟单";
  if (label === "策略大厅") return text.startsWith("策略大厅");
  return text === label;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("header a, nav a", { timeout: 60000 });
    await page.waitForTimeout(3000);

    const anchors = await page.evaluate(() =>
      Array.from(document.querySelectorAll("header a, nav a")).map((anchor) => ({
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.href,
      })),
    );

    const navLinks = TOP_LEVEL_LABELS.map((label) => {
      const anchor = anchors.find((candidate) => isTopLevelMatch(candidate.text, label));
      if (!anchor?.href) {
        throw new Error(`Missing CoinW nav link for ${label}`);
      }
      return {
        label: LABEL_NORMALIZATION.get(label) ?? label,
        href: anchor.href,
        ...(label === "跟单" ? { badge: "New" } : {}),
      };
    });

    process.stdout.write(`${JSON.stringify(navLinks, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
