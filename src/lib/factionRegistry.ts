import type { AgentId, SignalType } from "@/modules/agent-watch/types";
import type { AgentEmotion, FactionId } from "@/lib/types";

export interface FactionProfile {
  id: FactionId;
  displayName: string;
  nickname: string;
  title: string;
  role: "breakout" | "trend" | "reversion";
  color: string;
  softColor: string;
  avatarBase: string;
  catchphrases: string[];
  rivals: Partial<Record<FactionId, string>>;
  signalTypes: SignalType[];
  emotionEmoji: Record<AgentEmotion, string>;
}

export const FACTION_REGISTRY: Record<AgentId, FactionProfile> = {
  alpha: {
    id: "alpha",
    displayName: "Alpha",
    nickname: "老 K",
    title: "破位猎手",
    role: "breakout",
    color: "#ff5f5f",
    softColor: "rgba(255, 95, 95, 0.18)",
    avatarBase: "/images/agents/alpha-120.png",
    catchphrases: [
      "破位才是真信号，盘整就是装死",
      "不破不立，不立不破",
      "等你看清的时候已经吃饱了",
    ],
    rivals: {
      beta: "乌龟趋势僵尸",
      gamma: "接飞刀大队长",
    },
    signalTypes: ["breakout", "near_high", "near_low", "volume_spike"],
    emotionEmoji: {
      neutral: "🎯",
      confident: "🔥",
      angry: "💥",
      skeptical: "👀",
      excited: "⚡",
    },
  },
  beta: {
    id: "beta",
    displayName: "Beta",
    nickname: "老白",
    title: "趋势守正",
    role: "trend",
    color: "#3a7bff",
    softColor: "rgba(58, 123, 255, 0.18)",
    avatarBase: "/images/agents/beta-120.png",
    catchphrases: ["趋势是朋友，没确认别动", "逆势加仓是新手坟墓", "趋势没破慢慢加"],
    rivals: {
      alpha: "假突破韭菜",
      gamma: "刀口舔血",
    },
    signalTypes: ["ema_cross"],
    emotionEmoji: {
      neutral: "🧭",
      confident: "📈",
      angry: "🧊",
      skeptical: "🔎",
      excited: "✅",
    },
  },
  gamma: {
    id: "gamma",
    displayName: "Gamma",
    nickname: "老 G",
    title: "极端猎手",
    role: "reversion",
    color: "#9b6bff",
    softColor: "rgba(155, 107, 255, 0.18)",
    avatarBase: "/images/agents/gamma-120.png",
    catchphrases: ["涨太狠就该跌，跌太狠就该涨", "市场永远反人性", "极端就是反转信号，等失速"],
    rivals: {
      alpha: "追高山顶侠",
      beta: "趋势僵尸",
    },
    signalTypes: ["range_change", "near_high", "near_low"],
    emotionEmoji: {
      neutral: "🟣",
      confident: "😏",
      angry: "💢",
      skeptical: "🧪",
      excited: "🪝",
    },
  },
};

export const FACTION_IDS = Object.keys(FACTION_REGISTRY) as FactionId[];

export function isFactionId(value: string): value is FactionId {
  return value in FACTION_REGISTRY;
}

export function getFaction(id: FactionId): FactionProfile {
  return FACTION_REGISTRY[id];
}

export function getFactionIds(): FactionId[] {
  return [...FACTION_IDS];
}

export function getFactionByRole(role: FactionProfile["role"]): FactionProfile {
  return FACTION_IDS.map((id) => FACTION_REGISTRY[id]).find((profile) => profile.role === role)!;
}

export function getFactionForSignal(signalType: SignalType): FactionId {
  return (
    FACTION_IDS.find((id) => FACTION_REGISTRY[id].signalTypes.includes(signalType)) ??
    getFactionByRole("breakout").id
  );
}
