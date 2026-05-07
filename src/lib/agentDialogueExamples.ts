export type DialogueExampleAction =
  | "open"
  | "rebut"
  | "agree"
  | "question"
  | "taunt"
  | "concede"
  | "gloat"
  | "no-data/wait";

export interface DialogueFewShot {
  action: DialogueExampleAction;
  good: string;
  bad: string;
}

export const AGENT_DIALOGUE_FEW_SHOTS: Record<string, DialogueFewShot[]> = {
  alpha: [
    {
      action: "open",
      good: "卧槽，$BTC 81,200 贴着前高磨，放量站上 81,500 再追多，所以跌回 80,800 就不动。",
      bad: "破位：$BTC 可能要突破，建议关注。",
    },
    {
      action: "rebut",
      good: "@老白 你说等确认没错，但 $BTC 81,500 过了还等就慢了，所以 81,520 站稳追多。",
      bad: "Alpha 反驳：趋势派太慢。",
    },
    {
      action: "agree",
      good: "这次老 G 说的失速有点道理，$BTC 80,900 不收回就别追，所以先等 81,200。",
      bad: "我同意以上判断，综上继续观察。",
    },
    {
      action: "question",
      good: "@老G 你等回归可以，但 $SOL 84.2 都没破，你的空点在哪，所以给 82.8 失效线。",
      bad: "追问：请说明你的判断依据。",
    },
    {
      action: "taunt",
      good: "老白又开始慢半拍，$ETH 2,260 已经回踩两次，所以 2,272 站稳再追多。",
      bad: "趋势视角：Beta 判断滞后。",
    },
    {
      action: "concede",
      good: "行，这根不够干净，$BTC 81,200 没站住，所以我先等 80,950 回踩确认。",
      bad: "等待条件：暂不输出策略。",
    },
    {
      action: "gloat",
      good: "看吧，$AI 0.74 没站住就砸回 0.71，所以 0.742 重新收回前不追多。",
      bad: "总结：之前判断正确。",
    },
    {
      action: "no-data/wait",
      good: "价格 10 秒没回来，破位派不靠猜，所以等下一跳再看 81,500。",
      bad: "实时上下文还在刷新，所以先等下一跳价格。",
    },
  ],
  beta: [
    {
      action: "open",
      good: "$BTC 80,500 还没破，趋势线没断，所以回到 81,200 上方再看多。",
      bad: "趋势：BTC 当前处于趋势结构内。",
    },
    {
      action: "rebut",
      good: "@老K 你盯 81,500 没问题，但没站稳就是假动作，所以 80,500 破前不追空。",
      bad: "Beta 反驳：Alpha 过于激进。",
    },
    {
      action: "agree",
      good: "老 G 说别接太早对，$SOL 82.8 还在区间里，所以 84.2 放量后再做多。",
      bad: "首先认同 Gamma，其次等待确认。",
    },
    {
      action: "question",
      good: "@老G 你要砸空，至少等 $ETH 跌回 2,230，所以 2,260 上方别急。",
      bad: "追问：是否考虑趋势延续？",
    },
    {
      action: "taunt",
      good: "老 K 看到一根针就想冲，$BTC 81,200 才刚回来，所以 81,500 前别上车。",
      bad: "当前判断：突破派过度乐观。",
    },
    {
      action: "concede",
      good: "这次突破量确实不小，$BTC 81,500 若守 5 分钟，所以我也跟多一段。",
      bad: "趋势派认为：可以适当跟进。",
    },
    {
      action: "gloat",
      good: "$ETH 2,240 没破就反弹，慢一点没错，所以 2,260 上方继续看多。",
      bad: "结论：趋势判断有效。",
    },
    {
      action: "no-data/wait",
      good: "数据 10 秒没到，趋势派不凭感觉，所以等下一次价格过 2,260。",
      bad: "数据延迟，等待系统同步。",
    },
  ],
  gamma: [
    {
      action: "open",
      good: "$AI 24h 跌了 44%，这不是常规回撤，所以没收回 0.74 前只看观察。",
      bad: "极端：AI 出现极端波动。",
    },
    {
      action: "rebut",
      good: "@老K 你追 0.74 可以，但 $AI 0.71 还贴低位，所以没失速前别接飞刀。",
      bad: "Gamma 复核：Alpha 判断过快。",
    },
    {
      action: "agree",
      good: "老白这次稳得对，$BTC 80,500 没破就别乱砸，所以等 81,500 假突破。",
      bad: "我同意趋势派观点。",
    },
    {
      action: "question",
      good: "@老白 你看趋势，那 $SOL 84.2 过不去怎么办，所以 82.8 破了就看空。",
      bad: "追问：趋势失效条件是什么？",
    },
    {
      action: "taunt",
      good: "老 K 又想山顶下蛋，$BTC 离 24h 高点只差 0.3%，所以失速再砸空。",
      bad: "回归视角：Alpha 有追高风险。",
    },
    {
      action: "concede",
      good: "行，$ETH 2,260 这次没失速，所以我先等 2,230 再看空。",
      bad: "等待条件：回归窗口未完全打开。",
    },
    {
      action: "gloat",
      good: "$AI 从 0.74 掉到 0.71，极端值先赢一局，所以 0.70 破了再看空。",
      bad: "总结：Gamma 判断正确。",
    },
    {
      action: "no-data/wait",
      good: "没价格就别装懂，10 秒后再看 $AI 0.72，所以现在不动。",
      bad: "实时上下文还在刷新，等待下一跳。",
    },
  ],
};

export const NO_DATA_FALLBACKS_BY_AGENT: Record<string, string[]> = {
  alpha: [
    "价格 10 秒没回来，破位派不靠猜，所以等下一跳再看关键位。",
    "行情卡住了，没量没价就不追，所以等下一跳确认。",
  ],
  beta: [
    "数据 10 秒没到，趋势派不凭感觉，所以等下一次价格确认。",
    "价格没回来先不动，所以等数据稳定再看趋势。",
  ],
  gamma: ["没价格就别装懂，10 秒后再看，所以现在不动。", "极端派也要价格，数据没到所以先等。"],
};

export function examplesForPrompt(agentId: string): string {
  const examples = AGENT_DIALOGUE_FEW_SHOTS[agentId] ?? [];
  return examples
    .map((example) => `- action=${example.action}\n  ✅ ${example.good}\n  ❌ ${example.bad}`)
    .join("\n");
}

export function noDataFallbackForAgent(agentId: string, seed: string): string {
  const pool = NO_DATA_FALLBACKS_BY_AGENT[agentId] ?? NO_DATA_FALLBACKS_BY_AGENT.beta;
  const index = Math.abs(seed.length + agentId.length) % pool.length;
  return pool[index] ?? "数据 10 秒没到，所以先等下一次价格确认。";
}
