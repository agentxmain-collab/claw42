import type { Dict, Locale } from "./types";

import ar_SA from "./dicts/ar_SA.json";
import en_US from "./dicts/en_US.json";
import en_XA from "./dicts/en_XA.json";
import es_ES from "./dicts/es_ES.json";
import fr_FR from "./dicts/fr_FR.json";
import ja_JP from "./dicts/ja_JP.json";
import ru_RU from "./dicts/ru_RU.json";
import uk_UA from "./dicts/uk_UA.json";
import zh_CN from "./dicts/zh_CN.json";
import zh_TW from "./dicts/zh_TW.json";

export const DICTS: Record<Locale, Dict> = {
  zh_CN: zh_CN as Dict,
  zh_TW: zh_TW as Dict,
  en_US: en_US as Dict,
  ru_RU: ru_RU as Dict,
  uk_UA: uk_UA as Dict,
  ja_JP: ja_JP as Dict,
  fr_FR: fr_FR as Dict,
  es_ES: es_ES as Dict,
  ar_SA: ar_SA as Dict,
  en_XA: en_XA as Dict,
};

export function getDict(locale: Locale) {
  return DICTS[locale];
}
