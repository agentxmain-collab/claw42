export type Locale = "zh" | "en";

export interface Dict {
  nav: {
    switchLangToEn: string; // 当前中文时按钮显示
    switchLangToZh: string; // 当前英文时按钮显示
  };
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
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
      cta: string;
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
  disclaimer: {
    title: string;
    paragraphs: string[];
  };
}
