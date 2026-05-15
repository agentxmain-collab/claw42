import type { Locale } from "@/i18n/types";
import type { TeamMemberId } from "@/lib/team/teamRegistry";

type LocaleNameMap = Record<TeamMemberId, string>;

export const TEAM_DISPLAY_NAMES: Record<Locale, LocaleNameMap> = {
  zh_CN: {
    fundamental_analyst: "基本面研究主管",
    news_analyst: "宏观情报分析师",
    chart_analyst: "技术策略主管",
    onchain_analyst: "链上数据分析主管",
    research_lead: "策略研究主管",
    risk_lead: "风控总监",
    pm: "首席投资官",
    bullish_researcher: "多头研究总监",
    bearish_researcher: "空头研究总监",
    trader: "交易策略总监",
    aggressive_reviewer: "收益进攻总监",
    neutral_reviewer: "组合平衡总监",
    conservative_reviewer: "风险防御总监",
    memory_loop: "策略复盘总监",
  },
  zh_TW: {
    fundamental_analyst: "基本面研究主管",
    news_analyst: "宏觀情報分析師",
    chart_analyst: "技術策略主管",
    onchain_analyst: "鏈上數據分析主管",
    research_lead: "策略研究主管",
    risk_lead: "風控總監",
    pm: "首席投資官",
    bullish_researcher: "多頭研究總監",
    bearish_researcher: "空頭研究總監",
    trader: "交易策略總監",
    aggressive_reviewer: "收益進攻總監",
    neutral_reviewer: "組合平衡總監",
    conservative_reviewer: "風險防禦總監",
    memory_loop: "策略複盤總監",
  },
  en_US: englishNames(),
  ja_JP: englishNames(),
  ru_RU: englishNames(),
  uk_UA: englishNames(),
  fr_FR: englishNames(),
  es_ES: englishNames(),
  ar_SA: englishNames(),
  en_XA: {
    fundamental_analyst: "[Fůňđâmêňţâļ Řêšêârĉħ Ļêâđ]",
    news_analyst: "[Mâĉřô Îňţêļļîĝêňĉê Âňâļŷšţ]",
    chart_analyst: "[Ţêĉħňîĉâļ Šţřâţêĝŷ Ļêâđ]",
    onchain_analyst: "[Ôň-ĉħâîň Đâţâ Ļêâđ]",
    research_lead: "[Šţřâţêĝŷ Řêšêârĉħ Ļêâđ]",
    risk_lead: "[Řîšķ Đîřêĉţôř]",
    pm: "[Ĉħîêƒ Îňvêšţmêňţ Ôƒƒîĉêř]",
    bullish_researcher: "[Bůļļîšħ Řêšêârĉħ Đîřêĉţôř]",
    bearish_researcher: "[Bêâřîšħ Řêšêârĉħ Đîřêĉţôř]",
    trader: "[Ţřâđîňĝ Šţřâţêĝŷ Đîřêĉţôř]",
    aggressive_reviewer: "[Řêţůřň Ôƒƒêňšê Đîřêĉţôř]",
    neutral_reviewer: "[Pôřţƒôļîô Bâļâňĉê Đîřêĉţôř]",
    conservative_reviewer: "[Řîšķ Đêƒêňšê Đîřêĉţôř]",
    memory_loop: "[Šţřâţêĝŷ Řêvîêŵ Đîřêĉţôř]",
  },
};

export function getTeamDisplayName(memberId: TeamMemberId, locale: Locale) {
  return TEAM_DISPLAY_NAMES[locale]?.[memberId] ?? TEAM_DISPLAY_NAMES.en_US[memberId];
}

function englishNames(): LocaleNameMap {
  return {
    fundamental_analyst: "Fundamental Research Lead",
    news_analyst: "Macro Intelligence Analyst",
    chart_analyst: "Technical Strategy Lead",
    onchain_analyst: "On-chain Data Lead",
    research_lead: "Strategy Research Lead",
    risk_lead: "Risk Director",
    pm: "Chief Investment Officer",
    bullish_researcher: "Bullish Research Director",
    bearish_researcher: "Bearish Research Director",
    trader: "Trading Strategy Director",
    aggressive_reviewer: "Return Offense Director",
    neutral_reviewer: "Portfolio Balance Director",
    conservative_reviewer: "Risk Defense Director",
    memory_loop: "Strategy Review Director",
  };
}
