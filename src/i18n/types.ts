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
      chatTime: string;
      chatTitle: string;
      chatBullets: string[];
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
    coinPool: {
      majors: string;
      trending: string;
      opportunity: string;
    };
    focusCard: {
      watching: string;
      focusLabel: string;
      focusTooltip: string;
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
  };
  coinModal: {
    closeAriaLabel: string;
    goToWatchCta: string;
    loadingPrice: string;
    agentCommentMissing: string;
  };
}
