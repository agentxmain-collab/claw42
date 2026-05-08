import type { EventType, SignalAction } from "@/types/signal";

export type ActionRule = {
  match: {
    primaryAsset?: string;
    eventType?: EventType;
  };
  action: SignalAction;
};

export const actionRules: ActionRule[] = [
  {
    match: { primaryAsset: "BTC" },
    action: { kind: "trade", label: { zh: "查看 BTC/USDT", en: "View BTC/USDT" }, url: "/trade/BTC-USDT", payload: { symbol: "BTC" } }
  },
  {
    match: { primaryAsset: "ETH" },
    action: { kind: "trade", label: { zh: "查看 ETH/USDT", en: "View ETH/USDT" }, url: "/trade/ETH-USDT", payload: { symbol: "ETH" } }
  },
  {
    match: { primaryAsset: "SOL" },
    action: { kind: "trade", label: { zh: "查看 SOL/USDT", en: "View SOL/USDT" }, url: "/trade/SOL-USDT", payload: { symbol: "SOL" } }
  },
  {
    match: { eventType: "etf" },
    action: { kind: "topic", label: { zh: "进入 ETF 专题", en: "Open ETF topic" }, url: "/topics/etf" }
  },
  {
    match: { eventType: "regulation" },
    action: { kind: "topic", label: { zh: "查看政策专题", en: "View policy topic" }, url: "/topics/regulation" }
  },
  {
    match: { eventType: "project" },
    action: { kind: "alert", label: { zh: "设置项目提醒", en: "Set project alert" }, payload: { type: "project_event" } }
  }
];
