import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("hero robot guide contract", () => {
  test("removes the old viewport-fixed CTA guide from the landing page", () => {
    const source = read("src/app/[locale]/ClientLandingPage.tsx");

    expect(source).not.toContain("HeroCtaGuide");
    expect(source).not.toContain("<HeroCtaGuide");
  });

  test("anchors the guide to the shared robot layer without storage suppression", () => {
    const robotLayer = read("src/modules/landing/HeroScene/RobotLayer.tsx");
    const guidePath = "src/modules/landing/HeroScene/HeroRobotGuide.tsx";

    expect(existsSync(join(root, guidePath))).toBe(true);
    expect(robotLayer).toContain("HeroRobotGuide");
    expect(robotLayer).toContain("setGuideVisible(false)");
    expect(robotLayer).not.toContain("localStorage");
    expect(robotLayer).not.toContain("sessionStorage");

    if (!existsSync(join(root, guidePath))) return;
    const guide = read(guidePath);
    expect(guide).toContain("claw42-hero-robot-guide");
    expect(guide).toContain("claw42-hero-robot-guide-ring");
    expect(guide).not.toContain("fixed");
    expect(guide).not.toContain("localStorage");
    expect(guide).not.toContain("sessionStorage");
  });
});
