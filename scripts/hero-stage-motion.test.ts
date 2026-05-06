import assert from "node:assert/strict";
import {
  heroDepthOffset,
  heroScrollProgress,
  heroStageCssVars,
} from "../src/modules/landing/HeroScene/heroStageMotion";

assert.equal(heroScrollProgress({ top: 120, height: 900 }), 0);
assert.equal(heroScrollProgress({ top: 0, height: 900 }), 0);
assert.equal(heroScrollProgress({ top: -225, height: 900 }), 0.25);
assert.equal(heroScrollProgress({ top: -900, height: 900 }), 1);
assert.equal(heroScrollProgress({ top: -1400, height: 900 }), 1);
assert.equal(heroScrollProgress({ top: -100, height: 0 }), 0);

assert.equal(heroDepthOffset(0, 30), 0);
assert.equal(heroDepthOffset(0.5, 30), 15);
assert.equal(heroDepthOffset(1, -12), -12);

const cssVars = heroStageCssVars(0.5);
assert.equal(cssVars["--claw42-hero-depth-bg-y"], "0px");
assert.equal(cssVars["--claw42-hero-depth-horizon-y"], "0px");
assert.equal(cssVars["--claw42-hero-depth-robot-y"], "-3px");
assert.equal(cssVars["--claw42-hero-depth-coin-y"], "-5px");
assert.equal(cssVars["--claw42-hero-depth-pedestal-y"], "0px");

console.log("hero stage motion tests passed");
