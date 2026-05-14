import type {
  DispatchAgentId,
  DispatchMessage,
  DispatchStageMarker,
  DispatchStrategy,
  DispatchTopic,
} from "../v9/types";

type DemoAction = DispatchStrategy["action"];

interface DemoTopicInput {
  id: string;
  symbol: "BTC" | "ETH" | "SOL";
  title: string;
  startedAt: string;
  progress: string;
  intensity: number;
  trigger: string;
  action: DemoAction;
  actionLabel: string;
  strategyName: string;
  meta: string;
  metaHighlight?: DispatchStrategy["metaHighlight"];
  entry: string;
  stopLoss: string;
  takeProfit: string;
  primaryLabel: string;
  primaryDisabled: boolean;
  secondaryLabel: string;
  watchCount: number;
  followCount: number;
  defaultCollapsed: boolean;
  messages: Omit<DispatchMessage, "id">[];
}

function fullStages(id: string): DispatchStageMarker[] {
  return [
    { id: `${id}-stage-1`, label: "阶段 1 · 信息收集", status: "done" },
    { id: `${id}-stage-2`, label: "阶段 2 · 多空辩论", status: "done" },
    { id: `${id}-stage-3`, label: "阶段 3 · 交易方案", status: "done" },
    { id: `${id}-stage-4`, label: "阶段 4 · 风险审查", status: "done" },
    { id: `${id}-stage-5`, label: "阶段 5 · 最终决策", status: "final" },
    { id: `${id}-stage-6`, label: "阶段 6 · 复盘沉淀", status: "done" },
  ];
}

function msg(
  stageId: string,
  agentId: DispatchAgentId,
  agentName: string,
  time: string,
  content: string,
  options: Partial<Pick<DispatchMessage, "mentions" | "quote" | "dataAge">> = {},
): Omit<DispatchMessage, "id"> {
  return {
    stageId,
    agentId,
    agentName,
    time,
    mentions: options.mentions ?? [],
    quote: options.quote,
    dataAge: options.dataAge,
    content,
  };
}

function makeTopic(input: DemoTopicInput): DispatchTopic {
  const stages = fullStages(input.id);

  return {
    id: input.id,
    symbol: input.symbol,
    status: "done",
    title: input.title,
    originalUrl: "#",
    startedAt: input.startedAt,
    progress: input.progress,
    intensity: input.intensity,
    trigger: {
      ticker: `$${input.symbol}`,
      text: input.trigger,
    },
    stages,
    messages: input.messages.map((message, index) => ({
      ...message,
      id: `${input.id}-msg-${index + 1}`,
    })),
    strategy: {
      action: input.action,
      actionLabel: input.actionLabel,
      name: input.strategyName,
      ticker: `$${input.symbol}`,
      meta: input.meta,
      metaHighlight: input.metaHighlight,
      entry: input.entry,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      follow: {
        primaryLabel: input.primaryLabel,
        primaryDisabled: input.primaryDisabled,
        secondaryLabel: input.secondaryLabel,
        watchCount: input.watchCount,
        followCount: input.followCount,
      },
    },
    defaultCollapsed: input.defaultCollapsed,
  };
}

export const dispatchV10DemoTopics: DispatchTopic[] = [
  makeTopic({
    id: "v10-demo-btc-decision-flow",
    symbol: "BTC",
    title: "BTC 决策流 · 回踩不破 104k，动量仍在多头侧",
    startedAt: "19:06",
    progress: "24 分钟闭环",
    intensity: 4,
    trigger: "104k 附近承接增强 · ETF 净流入恢复",
    action: "long",
    actionLabel: "LONG 6%",
    strategyName: "已批准",
    meta: "已批准 19:30 · 当前模拟盈亏",
    metaHighlight: { text: "+1.1%", tone: "ok" },
    entry: "104,200 - 104,800",
    stopLoss: "101,800",
    takeProfit: "106,500 / 109,200",
    primaryLabel: "跟进观察",
    primaryDisabled: false,
    secondaryLabel: "查看详情",
    watchCount: 186,
    followCount: 71,
    defaultCollapsed: false,
    messages: [
      msg(
        "v10-demo-btc-decision-flow-stage-1",
        "technical_analyst",
        "技术分析师",
        "19:07",
        "$BTC 回踩 104k 后快速收回，4h MA20 未被有效跌破。**短线结构仍偏多**，失效位放在 101,800。",
        { dataAge: "数据 74 秒前" },
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-1",
        "onchain_analyst",
        "链上分析师",
        "19:08",
        "交易所净流入连续两小时下降，大额钱包未出现同步抛压。链上信号不支持追空。",
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-1",
        "news_analyst",
        "新闻分析师",
        "19:09",
        "ETF 单日净流入恢复，宏观事件窗口暂未出现反向冲击。新闻面给多头留出执行窗口。",
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-2",
        "bullish_researcher",
        "看多研究员",
        "19:12",
        "回踩承接 + 资金回流 + 关键位守住，三项证据一致。建议只做确认后的低杠杆 LONG。",
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-2",
        "bearish_researcher",
        "看空研究员",
        "19:14",
        "上方 106,500 仍是密集抛压区，不能追价。若 101,800 失守，多头论点立即作废。",
        {
          mentions: ["@多头"],
          quote: { agentName: "多头", text: "三项证据一致" },
        },
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-3",
        "trader",
        "交易员",
        "19:20",
        "交易方案：**LONG 6%**。入场 104,200-104,800，止损 101,800，第一止盈 106,500，第二止盈 109,200。",
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-4",
        "neutral_reviewer",
        "中立派",
        "19:25",
        "通过，但把仓位从 8% 压到 6%。理由：上方抛压还在，收益风险比成立但不能放大杠杆。",
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-5",
        "portfolio_manager",
        "组合经理",
        "19:30",
        "**批准 LONG**。本组合当前 BTC 敞口可承受，101,800 是硬退出条件，不允许移动止损。",
      ),
      msg(
        "v10-demo-btc-decision-flow-stage-6",
        "memory_loop",
        "记忆回路",
        "19:31",
        "已落盘 #demo-btc-042。记录：回踩确认类交易必须同时满足承接、资金、宏观窗口三项条件。",
      ),
    ],
  }),
  makeTopic({
    id: "v10-demo-eth-decision-flow",
    symbol: "ETH",
    title: "ETH 决策流 · 4h EMA50 失守，反弹仍被卖盘压制",
    startedAt: "18:42",
    progress: "31 分钟闭环",
    intensity: 5,
    trigger: "CEX 净流入扩大 · 4h MACD 下穿零轴",
    action: "short",
    actionLabel: "SHORT 5%",
    strategyName: "已批准",
    meta: "已批准 19:13 · 当前模拟盈亏",
    metaHighlight: { text: "+0.7%", tone: "ok" },
    entry: "2,548 - 2,560",
    stopLoss: "2,610",
    takeProfit: "2,460 / 2,400",
    primaryLabel: "跟进观察",
    primaryDisabled: false,
    secondaryLabel: "查看详情",
    watchCount: 154,
    followCount: 49,
    defaultCollapsed: true,
    messages: [
      msg(
        "v10-demo-eth-decision-flow-stage-1",
        "technical_analyst",
        "技术分析师",
        "18:43",
        "$ETH 4h 跌破 EMA50，MACD 下穿零轴。若反弹不能重新站上 2,610，结构偏空。",
      ),
      msg(
        "v10-demo-eth-decision-flow-stage-1",
        "onchain_analyst",
        "链上分析师",
        "18:45",
        "过去 3 小时 CEX 净流入扩大，巨鲸转入 Binance。资金行为偏防守，短线不支持加多。",
      ),
      msg(
        "v10-demo-eth-decision-flow-stage-2",
        "bearish_researcher",
        "看空研究员",
        "18:49",
        "技术破位和资金流入交易所同时出现，空头证据质量高。建议反弹接近 2,560 时 SHORT。",
      ),
      msg(
        "v10-demo-eth-decision-flow-stage-2",
        "bullish_researcher",
        "看多研究员",
        "18:52",
        "只保留一个反驳：2,460 是强支撑，追空不能过深。若先到支撑位，交易取消。",
        {
          mentions: ["@看空"],
          quote: { agentName: "看空", text: "空头证据质量高" },
        },
      ),
      msg(
        "v10-demo-eth-decision-flow-stage-3",
        "trader",
        "交易员",
        "19:00",
        "交易方案：**SHORT 5%**。入场 2,548-2,560，止损 2,610，止盈 2,460 / 2,400。",
      ),
      msg(
        "v10-demo-eth-decision-flow-stage-4",
        "conservative_reviewer",
        "保守派",
        "19:07",
        "同意方向，但不允许加仓。若 2,610 被收回，说明破位失败，必须退出。",
      ),
      msg(
        "v10-demo-eth-decision-flow-stage-5",
        "portfolio_manager",
        "组合经理",
        "19:13",
        "**批准 SHORT**。该仓位对冲组合多头 beta，风险预算内，执行后进入 4 小时观察窗。",
      ),
      msg(
        "v10-demo-eth-decision-flow-stage-6",
        "memory_loop",
        "记忆回路",
        "19:14",
        "已落盘 #demo-eth-108。记录：EMA50 破位交易要与 CEX 净流入同步验证，单独技术信号不够。",
      ),
    ],
  }),
  makeTopic({
    id: "v10-demo-sol-decision-flow",
    symbol: "SOL",
    title: "SOL 决策流 · 区间噪音过高，暂不追单",
    startedAt: "19:18",
    progress: "18 分钟闭环",
    intensity: 2,
    trigger: "165-175 区间震荡 · 链上活跃地址下行",
    action: "wait",
    actionLabel: "NO TRADE",
    strategyName: "拒绝交易",
    meta: "已拒绝 19:36 · 等待下一触发",
    entry: "不入场",
    stopLoss: "等待 165 / 175 任一侧确认",
    takeProfit: "无",
    primaryLabel: "等待新信号",
    primaryDisabled: true,
    secondaryLabel: "查看详情",
    watchCount: 92,
    followCount: 0,
    defaultCollapsed: true,
    messages: [
      msg(
        "v10-demo-sol-decision-flow-stage-1",
        "technical_analyst",
        "技术分析师",
        "19:19",
        "$SOL 仍在 165-175 区间内震荡，趋势信号不完整。当前价格没有给出可执行边界。",
      ),
      msg(
        "v10-demo-sol-decision-flow-stage-1",
        "fundamental_analyst",
        "基本面分析师",
        "19:21",
        "生态消息没有形成新增催化，成交量也未放大。基本面不支持主动追单。",
      ),
      msg(
        "v10-demo-sol-decision-flow-stage-2",
        "bullish_researcher",
        "看多研究员",
        "19:25",
        "多头只有一个理由：165 附近有承接。但没有放量突破，不能证明上沿会被打穿。",
      ),
      msg(
        "v10-demo-sol-decision-flow-stage-2",
        "bearish_researcher",
        "看空研究员",
        "19:26",
        "空头也不完整。活跃地址下降只是弱负面，不能直接推出趋势下跌。",
      ),
      msg(
        "v10-demo-sol-decision-flow-stage-3",
        "trader",
        "交易员",
        "19:31",
        "交易方案：**不交易**。只有突破 175 或跌破 165 后，才重新生成方向性交易卡。",
      ),
      msg(
        "v10-demo-sol-decision-flow-stage-4",
        "aggressive_reviewer",
        "激进派",
        "19:33",
        "不建议为低质量信号消耗风险预算。即使小仓试探，收益风险比也不稳定。",
      ),
      msg(
        "v10-demo-sol-decision-flow-stage-5",
        "portfolio_manager",
        "组合经理",
        "19:36",
        "**拒绝交易**。本次只保留观察，不发送执行。下一触发条件：175 上破或 165 下破。",
      ),
      msg(
        "v10-demo-sol-decision-flow-stage-6",
        "memory_loop",
        "记忆回路",
        "19:37",
        "已落盘 #demo-sol-219。记录：区间震荡中，系统应优先拒绝低质量交易，而不是为了输出而交易。",
      ),
    ],
  }),
];
