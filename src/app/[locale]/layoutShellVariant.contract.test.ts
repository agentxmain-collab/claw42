import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("locale layout shell variant contract", () => {
  test("keeps CoinW as default while allowing the original Claw 42 shell by env", () => {
    const layout = read("src/app/[locale]/layout.tsx");

    expect(layout).toContain("SITE_SHELL_VARIANT");
    expect(layout).toContain("SiteHeader");
    expect(layout).toContain("CoinwGlobalHeader");
    expect(layout).toContain("CoinwGlobalFooter");
    expect(layout).toContain('process.env.SITE_SHELL_VARIANT === "claw42"');
    expect(layout).toContain("<SiteHeader />");
    expect(layout).toContain("<CoinwGlobalHeader />");
    expect(layout).toContain("<CoinwGlobalFooter />");
    expect(layout).toContain("isClaw42Shell ? null : <CoinwGlobalFooter />");
  });

  test("documents the two deployment shell variants and production env ownership", () => {
    const docPath = "docs/deployment-shell-variants.md";

    expect(existsSync(join(root, docPath))).toBe(true);
    const doc = read(docPath);
    expect(doc).toContain("SITE_SHELL_VARIANT");
    expect(doc).toContain("claw42");
    expect(doc).toContain("coinw");
    expect(doc).toContain("Default: `coinw`");
    expect(doc).toContain("Codex must not create");
  });
});
