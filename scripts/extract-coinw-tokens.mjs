import { chromium } from "playwright";

const SOURCE_URL = "https://www.coinw.com/zh_CN";
const VIEWPORT = { width: 1440, height: 1200 };
const HYDRATION_WAIT_MS = 3000;

const headerDefinitions = [
  { key: "shell", selector: "header.stickyHead", required: true },
  { key: "leftCluster", selector: "header.stickyHead .left", required: true },
  { key: "logoLink", selector: "header.stickyHead a:has(svg)", required: true },
  { key: "nav", selector: "header.stickyHead nav.header-nav-main", required: true },
  { key: "navItem", selector: "header.stickyHead nav.header-nav-main .menu-item", required: true },
  {
    key: "navLink",
    selector: "header.stickyHead a[href*='/market/futures/all']",
    required: true,
  },
  { key: "rightCluster", selector: "header.stickyHead .header-right", required: true },
  { key: "buttonGroup", selector: "header.stickyHead .button-login", required: true },
];

const footerDefinitions = [
  { key: "wrapper", selector: ".footer-border.tw-bg-bgPrimary1", required: true },
  { key: "shell", selector: ".footer-border.tw-bg-bgPrimary1 footer", required: true },
  {
    key: "columns",
    selector: ".footer-border.tw-bg-bgPrimary1 footer .tw-flex.tw-items-start.tw-justify-between",
    required: true,
  },
  {
    key: "columnTitle",
    selector: ".footer-border.tw-bg-bgPrimary1 footer .tw-title-m-18-b-cw",
    required: true,
  },
  {
    key: "link",
    selector: ".footer-border.tw-bg-bgPrimary1 footer a.list-item",
    required: true,
  },
  {
    key: "bottomBar",
    selector:
      ".footer-border.tw-bg-bgPrimary1 footer .footer-border.tw-flex.tw-items-center.tw-justify-between",
    required: true,
  },
  {
    key: "copyright",
    selector: ".footer-border.tw-bg-bgPrimary1 footer .tw-text-textSecondary.tw-body-m-cw",
    required: true,
  },
  {
    key: "languageButton",
    selector: ".footer-border.tw-bg-bgPrimary1 footer .tw-bg-btnTertiaryDefault",
    required: true,
  },
];

function assertToken(section, field) {
  const value = section.tokens[field];
  if (value === undefined || value === "") {
    throw new Error(`${section.group}.${section.key} missing ${field}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: VIEWPORT,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const response = await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response || response.status() >= 400) {
    throw new Error(`CoinW request failed: ${response ? response.status() : "no response"}`);
  }

  await page.waitForSelector("header.stickyHead nav.header-nav-main", { timeout: 30_000 });
  await page.waitForSelector(".footer-border.tw-bg-bgPrimary1 footer", { timeout: 30_000 });
  await page.waitForTimeout(HYDRATION_WAIT_MS);

  const payload = await page.evaluate(
    ({ headerDefinitions, footerDefinitions, sourceUrl }) => {
      const fields = [
        "display",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "lineHeight",
        "letterSpacing",
        "color",
        "backgroundColor",
        "borderColor",
        "borderRadius",
        "padding",
        "margin",
        "gap",
        "height",
        "width",
      ];

      function pathFor(element) {
        const parts = [];
        let cursor = element;
        while (cursor && cursor.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
          let part = cursor.tagName.toLowerCase();
          if (cursor.className) {
            part += `.${String(cursor.className).trim().split(/\s+/).slice(0, 3).join(".")}`;
          }
          parts.unshift(part);
          cursor = cursor.parentElement;
        }
        return parts.join(" > ");
      }

      function tokensFor(element, definition, group) {
        const computed = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const tokens = {};
        for (const field of fields) tokens[field] = computed[field];
        tokens.height = `${rect.height}px`;
        tokens.width = `${rect.width}px`;
        return {
          group,
          key: definition.key,
          selector: definition.selector,
          domPath: pathFor(element),
          text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) || "",
          rect: {
            x: Number(rect.x.toFixed(3)),
            y: Number(rect.y.toFixed(3)),
            width: Number(rect.width.toFixed(3)),
            height: Number(rect.height.toFixed(3)),
          },
          tokens,
        };
      }

      function collect(definitions, group) {
        return definitions.map((definition) => {
          const element = document.querySelector(definition.selector);
          if (!element && definition.required) {
            throw new Error(`Missing ${group}.${definition.key}: ${definition.selector}`);
          }
          return tokensFor(element, definition, group);
        });
      }

      const logoSvg = document.querySelector("header.stickyHead a svg");
      if (!logoSvg) throw new Error("Missing CoinW header logo SVG");

      const loginButton = Array.from(document.querySelectorAll("header.stickyHead button")).find(
        (element) => element.textContent?.trim() === "登录",
      );
      const registerButton = Array.from(document.querySelectorAll("header.stickyHead button")).find(
        (element) => element.textContent?.trim() === "注册",
      );
      if (!loginButton || !registerButton) throw new Error("Missing CoinW auth buttons");

      const header = collect(headerDefinitions, "header");
      header.push(
        tokensFor(loginButton, { key: "loginButton", selector: "button:text('登录')" }, "header"),
      );
      header.push(
        tokensFor(
          registerButton,
          { key: "registerButton", selector: "button:text('注册')" },
          "header",
        ),
      );
      const footer = collect(footerDefinitions, "footer");

      return {
        meta: {
          extractedAt: new Date().toISOString(),
          extractedFrom: sourceUrl,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          method: "playwright + getComputedStyle",
        },
        assets: {
          logoSvg: logoSvg.outerHTML,
        },
        header: {
          sectionCount: header.length,
          sections: header,
          footer,
        },
        footer: {
          sectionCount: footer.length,
          sections: footer,
          source: "coinw.com",
        },
      };
    },
    { headerDefinitions, footerDefinitions, sourceUrl: SOURCE_URL },
  );

  for (const section of [...payload.header.sections, ...payload.footer.sections]) {
    assertToken(section, "fontFamily");
    assertToken(section, "fontSize");
    assertToken(section, "color");
  }

  console.log(JSON.stringify(payload, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
