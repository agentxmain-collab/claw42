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
import { LOCALES } from "../locales";
import type { Dict, Locale } from "../types";

const dicts: Record<Locale, Dict> = {
  ar_SA: arSA as Dict,
  en_US: enUS as Dict,
  en_XA: enXA as Dict,
  es_ES: esES as Dict,
  fr_FR: frFR as Dict,
  ja_JP: jaJP as Dict,
  ru_RU: ruRU as Dict,
  uk_UA: ukUA as Dict,
  zh_CN: zhCN as Dict,
  zh_TW: zhTW as Dict,
};

const failureKinds = [
  "analysis_data_degraded",
  "instrument_unavailable",
  "auth_account_not_ready",
  "user_risk_confirmation_required",
  "submission_mode_blocked",
  "exchange_network_or_result_failed",
] as const;

describe("trade readiness i18n slots", () => {
  test("defines mode and state slots for every locale without final copy", () => {
    expect(Object.keys(dicts).sort()).toEqual([...LOCALES].sort());

    for (const locale of LOCALES) {
      const tradeReadiness = dicts[locale].agentWatch.tradeReadiness;
      expect(Object.keys(tradeReadiness.modes).sort()).toEqual(["disabled", "live", "test"]);
      for (const kind of failureKinds) {
        expect(tradeReadiness.states[kind]).toEqual({
          label: "",
          detail: "",
          action: "",
        });
      }
    }
  });
});
