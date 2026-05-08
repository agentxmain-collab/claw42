import type { AgentId } from "../types";
import type { AgentWatchLocale } from "../locale";

const ZH_PHRASES: Record<AgentId, string[]> = {
  alpha: [
    "Alpha 在等量价同步",
    "Alpha 正在复核关键位",
    "Alpha 看突破是否站稳",
    "Alpha 在排除假突破",
    "Alpha 检查回踩条件",
    "Alpha 对比放量强度",
    "Alpha 等二次确认",
    "Alpha 收紧突破口径",
  ],
  beta: [
    "Beta 在看趋势斜率",
    "Beta 正在复核短中期线",
    "Beta 看回撤质量",
    "Beta 等趋势重新抬头",
    "Beta 检查高位是否抬升",
    "Beta 过滤反弹噪音",
    "Beta 在看结构延续",
    "Beta 暂不急着升级趋势",
  ],
  gamma: [
    "Gamma 在盯极端波动",
    "Gamma 正在等失速",
    "Gamma 看高低位边界",
    "Gamma 排除接飞刀风险",
    "Gamma 检查回归窗口",
    "Gamma 观察波动扩散",
    "Gamma 等均值回归确认",
    "Gamma 在收窄观察半径",
  ],
};

const EN_PHRASES: Record<AgentId, string[]> = {
  alpha: [
    "Alpha is checking volume",
    "Alpha is retesting key levels",
    "Alpha is waiting for a clean breakout",
    "Alpha is filtering false breaks",
    "Alpha is checking the retest",
    "Alpha is comparing volume strength",
    "Alpha is waiting for confirmation",
    "Alpha is tightening the breakout filter",
  ],
  beta: [
    "Beta is reading trend slope",
    "Beta is checking short-term structure",
    "Beta is judging pullback quality",
    "Beta is waiting for trend lift",
    "Beta is checking whether highs rise",
    "Beta is filtering bounce noise",
    "Beta is reading continuation",
    "Beta is holding the trend upgrade",
  ],
  gamma: [
    "Gamma is watching extremes",
    "Gamma is waiting for exhaustion",
    "Gamma is checking range edges",
    "Gamma is avoiding the first knife",
    "Gamma is checking the reversion window",
    "Gamma is watching volatility spread",
    "Gamma is waiting for mean reversion",
    "Gamma is narrowing the watch radius",
  ],
};

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 33 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

export function typingPhraseForAgent(
  agentId: AgentId,
  locale: AgentWatchLocale,
  seed: number = Date.now(),
) {
  const phrases = locale === "en_US" ? EN_PHRASES[agentId] : ZH_PHRASES[agentId];
  return phrases[Math.abs(hash(`${agentId}:${Math.floor(seed / 10_000)}`)) % phrases.length];
}
