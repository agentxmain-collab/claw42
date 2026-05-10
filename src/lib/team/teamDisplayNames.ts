import type { Locale } from "@/i18n/types";
import type { TeamMemberId } from "@/lib/team/teamRegistry";

type LocaleNameMap = Record<TeamMemberId, string>;

// TODO(spec-3-final): Dan 拍板终稿后替换这些占位人名。
export const TEAM_DISPLAY_NAMES: Record<Locale, LocaleNameMap> = {
  zh_CN: {
    fundamental_analyst: "老陈",
    news_analyst: "Mira",
    chart_analyst: "K 哥",
    onchain_analyst: "Vit",
    research_lead: "老 R",
    risk_lead: "老 X",
    pm: "PM",
  },
  zh_TW: {
    fundamental_analyst: "老陳",
    news_analyst: "Mira",
    chart_analyst: "K 哥",
    onchain_analyst: "Vit",
    research_lead: "老 R",
    risk_lead: "老 X",
    pm: "PM",
  },
  en_US: englishNames(),
  ja_JP: englishNames(),
  ru_RU: englishNames(),
  uk_UA: englishNames(),
  fr_FR: englishNames(),
  es_ES: englishNames(),
  ar_SA: englishNames(),
  en_XA: {
    fundamental_analyst: "[Cħeň]",
    news_analyst: "[Mırâ]",
    chart_analyst: "[K̃]",
    onchain_analyst: "[Vıt]",
    research_lead: "[Łêäd]",
    risk_lead: "[Rıṡk]",
    pm: "[P̃Ṁ]",
  },
};

export function getTeamDisplayName(memberId: TeamMemberId, locale: Locale) {
  return TEAM_DISPLAY_NAMES[locale]?.[memberId] ?? TEAM_DISPLAY_NAMES.en_US[memberId];
}

function englishNames(): LocaleNameMap {
  return {
    fundamental_analyst: "Chen",
    news_analyst: "Mira",
    chart_analyst: "K",
    onchain_analyst: "Vit",
    research_lead: "Lead R",
    risk_lead: "Risk X",
    pm: "PM",
  };
}
