import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const DICT_DIR = path.join(ROOT, "src", "i18n", "dicts");
const BANNED_FACTION_VALUE = /\b(alpha|beta|gamma)\b/i;

describe("agentWatch i18n value faction retirement", () => {
  test("locale dict values do not expose retired faction labels", () => {
    const violations: string[] = [];

    for (const file of fs.readdirSync(DICT_DIR).filter((name) => name.endsWith(".json"))) {
      const dict = JSON.parse(fs.readFileSync(path.join(DICT_DIR, file), "utf8")) as unknown;
      collectFactionValueViolations(dict, file.replace(/\.json$/, ""), "", violations);
    }

    expect(violations).toEqual([]);
  });
});

function collectFactionValueViolations(
  value: unknown,
  locale: string,
  keyPath: string,
  violations: string[],
) {
  if (typeof value === "string") {
    if (BANNED_FACTION_VALUE.test(value)) {
      violations.push(`${locale}:${keyPath} => ${value}`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectFactionValueViolations(item, locale, `${keyPath}[${index}]`, violations),
    );
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectFactionValueViolations(item, locale, keyPath ? `${keyPath}.${key}` : key, violations);
    }
  }
}
