import type { TeamMemberId } from "@/lib/team/teamRegistry";

export type Locale =
  | "zh_CN"
  | "zh_TW"
  | "en_US"
  | "ru_RU"
  | "uk_UA"
  | "ja_JP"
  | "fr_FR"
  | "es_ES"
  | "ar_SA"
  | "en_XA";

export type RatingDict = {
  StrongBuy: string;
  Buy: string;
  Hold: string;
  Sell: string;
  StrongSell: string;
};

export type TeamMemberDict = {
  displayName: string;
  roleTitle: string;
  oneLineCapability: string;
  shortBio: string;
  ariaLabel: string;
};

export type TeamTrackRecordDict = {
  title: string;
  subtitle: string;
  totalDecisions: string;
  overallWinRate: string;
  teamNetReturn7d: string;
  decisions: string;
  wins: string;
  winRate: string;
  netReturn7d: string;
  sampleSizeSmall: string;
  noRecords: string;
  aiDisclaimer: string;
  source: {
    live: string;
    paper: string;
    legacy: string;
    backtest: string;
    mixed: string;
    none: string;
  };
};

export type TeamWorkflowPanelDict = {
  title: string;
  description: string;
  mobileStageLabel: string;
};

export type TeamWorkflowNodeDict = {
  statusAnalyzing: string;
  statusWaitingData: string;
  statusCompletedRecently: string;
  statusIdle: string;
  lastActivityPrefix: string;
};

export type TeamDict = Record<TeamMemberId, TeamMemberDict> & {
  trackRecord: TeamTrackRecordDict;
  workflowPanel: TeamWorkflowPanelDict;
  workflowNode: TeamWorkflowNodeDict;
};

export type DispatchV10AgentRoleId =
  | "fundamental"
  | "onchain"
  | "news"
  | "technical"
  | "bullish"
  | "bearish"
  | "trader"
  | "aggressive"
  | "neutral"
  | "conservative"
  | "portfolioManager"
  | "memoryLoop";

export type DispatchV10RoleDict = {
  name: string;
  role: string;
  desc: string;
  readoutRole: string;
  stat: string;
};

export type DispatchV10StageDict = {
  name: string;
  tag: string;
  countLabel: string;
  footerChip: string;
  detail: Array<{ label: string; value: string }>;
};

export type DispatchV10OutcomeDict = {
  hit_tp: string;
  hit_sl: string;
  expired: string;
  manual_close: string;
  pending: string;
  reason: {
    take_profit_reached: string;
    stop_loss_reached: string;
    evaluation_window_elapsed: string;
  };
};

export type DispatchV10RoundDict = {
  label: string;
  separator: string;
  single: string;
  multi: string;
};

export type DispatchV10StageStatusDict = {
  pending: string;
  in_progress: string;
  in_progressNote: string;
  done: string;
  memoryPending: string;
};

export type DispatchV10Dict = {
  ariaLabel: string;
  hero: {
    ariaLabel: string;
    eyebrow: string;
    titlePrefix: string;
    titleAccent: string;
    titleSuffix: string;
    subtitle: string;
    metaAriaLabel: string;
    meta: Array<{ value: string; label: string }>;
  };
  tabs: {
    flow: string;
    market: string;
    live: string;
  };
  roles: Record<DispatchV10AgentRoleId, DispatchV10RoleDict>;
  outcome: DispatchV10OutcomeDict;
  round: DispatchV10RoundDict;
  stageStatus: DispatchV10StageStatusDict;
  flow: {
    ariaLabel: string;
    stages: DispatchV10StageDict[];
    footerStrong: string;
    footerText: string;
    footerCta: string;
  };
  market: {
    ariaLabel: string;
    title: string;
    subtitle: string;
    statsAriaLabel: string;
    hot: string;
    closed: string;
    debating: string;
    started: string;
    empty: string;
    statusDone: string;
    statusPending: string;
    statusActive: string;
    collapse: string;
    expand: string;
    original: string;
    progressAriaLabel: string;
    progressLabels: string[];
    latestStrategy: string;
    entry: string;
    stopLoss: string;
    takeProfit: string;
    watchReminder: string;
    watchCount: string;
    followed: string;
  };
  placeholder: {
    title: string;
    body: string;
    close: string;
  };
};

export interface Dict {
  nav: {
    switchLangToEn: string; // 当前中文时按钮显示
    switchLangToZh: string; // 当前英文时按钮显示
    agentLiveMenuItem: string;
  };
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaPrimaryClipboard: string;
    ctaPrimaryCopiedToast: string;
    ctaSecondary: string;
    speechBubble: string[];
    speechBubbleAriaLabel: string;
    miniPlayer: {
      title: string;
      loading: string;
      strategyDirection: {
        long: string;
        short: string;
        watch: string;
      };
      confidence: string;
      entry: string;
      stopLoss: string;
      target: string;
    };
    cta: {
      openAgentWatch: string;
      openCoinwAccount: string;
      openCoinwAccountWithSymbol: string;
    };
    hint: {
      tapCoin: string;
      tapCoinMobile: string;
    };
    miniPlayerClose: string;
  };
  quickStart: {
    title: string;
  };
  scenarios: {
    sectionTitle: string;
    sectionSubtitle: string;
    daily: {
      title: string;
      badge: string;
      desc: string;
      inputPlaceholder: string;
      defaultPrompt: string;
      copiedToast: string;
      cta: string;
      ctaClipboard: string;
      ctaCopiedToast: string;
      chatSpeaker: string;
      dailyBrief: {
        title: string;
        realtimeLabel: string;
        sentimentLabel: string;
        sentimentNeutral: string;
        sentimentExtremeFear: string;
        sentimentFear: string;
        sentimentGreed: string;
        sentimentExtremeGreed: string;
        todayMoverLabel: string;
        tierOpportunity: string;
        tierHot: string;
        tierMajors: string;
        justNow: string;
        minutesAgo: string;
        unavailable: string;
      };
    };
    realtime: {
      title: string;
      desc: string;
      ticker: string;
    };
    autoTrade: {
      title: string;
      desc: string;
      cta: string;
    };
  };
  why: {
    title: string;
    subtitle: string;
    cards: Array<{ title: string; desc: string }>;
    tagline: string;
  };
  skillsEco: {
    title: string;
    subtitle: string;
    cards: Array<{
      icon: string;
      title: string;
      desc: string;
      cta: string;
    }>;
  };
  startTrade: {
    title: string;
    subtitle: string;
    helper: string;
    cards: Array<{
      step: string;
      title: string;
      desc: string;
    }>;
  };
  disclaimer: {
    title: string;
    paragraphs: string[];
  };
  team: TeamDict;
  agentWatch: {
    pageTitle: string;
    pageSubtitle: string;
    pageHeroTagline: string;
    sidebarStatus: {
      thinking: string;
      speaking: string;
      idle: string;
    };
    bottomCta: string;
    linkCardLiveBadge: string;
    linkCardTitle: string;
    linkCardDesc: string;
    fallbackNotice: string;
    banner: {
      newContent: string;
      dismissAriaLabel: string;
    };
    emptyHistory: string;
    loadingHistory: string;
    loadMore: string;
    loadingMore: string;
    emptyState: {
      title: string;
      subtitle: string;
    };
    timeline: {
      title: string;
      recentHour: string;
      olderWindow: string;
      showProcess: string;
      showConclusion: string;
      processToggle: {
        analysts: string;
        leads: string;
        collapse: string;
        expand: string;
        waitingMember: string;
      };
      market_signal: string;
      news: string;
      pm_decision: string;
      team_discussion: string;
      cron_heartbeat: string;
      fallback: string;
    };
    citationChip: {
      sourceUnavailable: string;
    };
    coinPool: {
      majors: string;
      trending: string;
      opportunity: string;
    };
    focusCard: {
      watching: string;
      focusLabel: string;
      trigger: string;
      fail: string;
      expandFail: string;
      evidenceCount: string;
      minutesAgo: string;
      warmup: string;
      thinking: string;
    };
    marketEvent: {
      title: string;
      empty: string;
    };
    newsDebate: {
      liveBadge: string;
      criticalBadge: string;
      source: string;
      original: string;
      intensity: string;
      roundIndependent: string;
      roundRebuttal: string;
      roundConsensus: string;
      finalStrategy: string;
      consensus: string;
      entry: string;
      stopLoss: string;
      takeProfit: string;
      dissent: string;
      risk: string;
      follow: string;
      watching: string;
      expired: string;
      expiresIn: string;
      followLong: string;
      followShort: string;
      waitSignal: string;
      share: string;
      replay: string;
      newsTab: string;
      noNews: string;
    };
    dispatchV10: DispatchV10Dict;
  };
  rating: RatingDict;
  coinModal: {
    closeAriaLabel: string;
    goToWatchCta: string;
    loadingPrice: string;
    agentCommentMissing: string;
  };
}
