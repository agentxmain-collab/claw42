export interface PersonaSlangPolicy {
  allowed: string[];
  banned: string[];
  intensity: "mild" | "neutral";
}

export const PERSONA_SLANG_POLICY_BY_LOCALE: Record<string, PersonaSlangPolicy> = {
  zh_CN: {
    allowed: ["卧槽", "草", "靠"],
    banned: ["操", "妈的", "他妈", "cao", "操你", "妈逼"],
    intensity: "mild",
  },
  zh_TW: {
    allowed: ["靠", "草", "靠北"],
    banned: ["操", "妈的", "幹"],
    intensity: "mild",
  },
  en_US: {
    allowed: ["damn", "hell", "wtf", "bs", "jeez"],
    banned: ["fuck", "shit", "bitch", "asshole"],
    intensity: "mild",
  },
  ja_JP: {
    allowed: ["まじか", "やばい", "うわ"],
    banned: ["くそ", "バカ", "クソ"],
    intensity: "mild",
  },
  ru_RU: {
    allowed: ["блин", "чёрт", "ё-моё"],
    banned: ["блядь", "хуй", "пизда"],
    intensity: "mild",
  },
  uk_UA: {
    allowed: ["блін", "чорт", "дідько"],
    banned: ["блядь", "хуй"],
    intensity: "mild",
  },
  fr_FR: {
    allowed: ["mince", "zut", "flûte", "merde"],
    banned: ["putain", "enculé"],
    intensity: "mild",
  },
  es_ES: {
    allowed: ["vaya", "caray", "jolín"],
    banned: ["joder", "mierda", "cojones"],
    intensity: "mild",
  },
  ar_SA: {
    allowed: [],
    banned: ["*"],
    intensity: "neutral",
  },
  en_XA: {
    allowed: [],
    banned: [],
    intensity: "neutral",
  },
};

export function slangPolicyPrompt(locale = "zh_CN"): string {
  const policy = PERSONA_SLANG_POLICY_BY_LOCALE[locale] ?? PERSONA_SLANG_POLICY_BY_LOCALE.en_US;
  const allowed = policy.allowed.length ? policy.allowed.join(" / ") : "无";
  const banned = policy.banned.length ? policy.banned.join(" / ") : "无";
  return [
    "## 语气边界",
    `允许轻度情绪词：${allowed}`,
    `绝对不能用：${banned}`,
    policy.intensity === "neutral" ? "本语言使用中性语气，不主动加入粗口或强情绪词。" : "",
  ]
    .filter(Boolean)
    .join("\n");
}
