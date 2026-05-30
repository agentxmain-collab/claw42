import { describe, expect, test } from "vitest";
import arSA from "../dicts/ar_SA.json";
import enUS from "../dicts/en_US.json";
import enXA from "../dicts/en_XA.json";
import esES from "../dicts/es_ES.json";
import frFR from "../dicts/fr_FR.json";
import jaJP from "../dicts/ja_JP.json";
import ruRU from "../dicts/ru_RU.json";
import ukUA from "../dicts/uk_UA.json";
import zhCN from "../dicts/zh_CN.json";
import zhTW from "../dicts/zh_TW.json";

const expectedRobotGuideCopy = {
  ar_SA: "اضغط لعرض تحليل السوق بالذكاء الاصطناعي",
  en_US: "Tap for AI market analysis",
  en_XA: "[!! Ţåp ƒöŕ ÅÎ måŕķëţ åñåľýšîš !!]",
  es_ES: "Toca para ver el análisis de mercado con IA",
  fr_FR: "Touchez pour voir l'analyse IA du marché",
  ja_JP: "タップしてAI相場分析を見る",
  ru_RU: "Нажмите, чтобы увидеть AI-анализ рынка",
  uk_UA: "Натисніть, щоб переглянути AI-аналіз ринку",
  zh_CN: "点击查看AI分析行情",
  zh_TW: "點擊查看 AI 行情分析",
};

const dicts = {
  ar_SA: arSA,
  en_US: enUS,
  en_XA: enXA,
  es_ES: esES,
  fr_FR: frFR,
  ja_JP: jaJP,
  ru_RU: ruRU,
  uk_UA: ukUA,
  zh_CN: zhCN,
  zh_TW: zhTW,
};

describe("hero robot guide localized benefit copy", () => {
  test("updates all locale dictionaries to the AI market-analysis benefit copy", () => {
    for (const [locale, dict] of Object.entries(dicts)) {
      expect(dict.hero.robotGuide).toBe(
        expectedRobotGuideCopy[locale as keyof typeof expectedRobotGuideCopy],
      );
    }
  });
});
