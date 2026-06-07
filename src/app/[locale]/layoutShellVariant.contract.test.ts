import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  test("uses the shell variant as the only inner/outer hero divergence switch", () => {
    const page = read("src/app/[locale]/agent/page.tsx");
    const hero = read("src/modules/agent-watch/v10/Hero.tsx");
    const contract = read("docs/dual-site-contract.md");

    expect(page).toContain("SITE_SHELL_VARIANT");
    expect(page).toContain("siteShellVariant={SITE_SHELL_VARIANT}");
    expect(hero).toContain('siteShellVariant === "coinw"');
    expect(hero).not.toContain("NEXT_PUBLIC_COINW_HERO");
    expect(contract).toContain("hero 区域");
    expect(contract).toContain("已实现");
    expect(contract).toContain("SITE_SHELL_VARIANT");
  });

  test("keeps CoinW hero copy present for every supported locale", () => {
    const dictDir = join(root, "src/i18n/dicts");
    const dictFiles = readdirSync(dictDir)
      .filter((file) => file.endsWith(".json"))
      .sort();

    expect(dictFiles).toEqual([
      "ar_SA.json",
      "en_US.json",
      "en_XA.json",
      "es_ES.json",
      "fr_FR.json",
      "ja_JP.json",
      "ru_RU.json",
      "uk_UA.json",
      "zh_CN.json",
      "zh_TW.json",
    ]);

    for (const file of dictFiles) {
      const dict = JSON.parse(readFileSync(join(dictDir, file), "utf8"));
      const copy = dict.agentWatch.dispatchV10.hero.coinwAgentMap;

      expect(copy.ariaLabel, file).toBeTruthy();
      expect(copy.stages, file).toHaveLength(6);
      expect(
        copy.stages.reduce(
          (sum: number, stage: { agents: string[] }) => sum + stage.agents.length,
          0,
        ),
        file,
      ).toBe(11);
      expect(copy.conclusionTitle, file).toBeTruthy();
      expect(copy.conclusionDetails, file).toBeTruthy();
    }
  });
});
