# Task 15 — Watch 页 NewsDebate Mode（task-12 v3 产品形态转向）

> **决策迭代背景**：
>
> - task-12 v1（stage mode）= 推翻 stream → 已废止
> - task-12 v2（stream redesign）= 保留 stream + speechGuard + 3 类事件卡 → 已落地
> - task-12 v3（**本文件 task-15**）= 在 v2 基础上扩展 NewsDebate 第 4 类事件 + 5 个用户视角钩子 → 当前生效
>
> **核心转向**：从"信息呈现"到"产品体验"——AI 不只是看盘喊单的 3 个分析师，而是 **加密圈最有戏剧性的 AI 辩论秀 + 跟单生成器**。
>
> **执行者**：Codex
>
> **新分支**：`feature/news-debate-mode-01`
>
> **PR target**：`feature/act1-5-watch-page-01`（不变）
>
> **前置依赖**：task-12 v2 stream redesign + task-14 P0 工程化基线（PostHog / 安全头 / API 限流）+ task-13 hero daily brief（数据源思路复用）

---

## 1. 设计核心：5 个用户视角钩子（PM + GTM 视角）

### 1.1 用户视角的"价值漏点"诊断

| 用户痛点              | task-12 v2 现状 | 漏点                            |
| --------------------- | --------------- | ------------------------------- |
| "我为什么相信这个 AI" | 派别签名        | **无可验证胜率** → 信任锚点缺失 |
| "看完我做什么"        | 策略卡有        | **无社交证明** → 决策成本高     |
| "为什么是现在"        | 每场独立        | **无紧迫感** → 用户拖延         |
| "AI 像人吗"           | 派别色 + 名字   | **冷冰冰** → 没戏剧感           |
| "上次 AI 说对了吗"    | 无历史          | **无反馈闭环** → 信任无法建立   |

**根本问题**：v2 是信息流，v3 是产品体验。

### 1.2 5 个 P0 钩子

| #      | 钩子                | 用户感知                   | 工程成本              |
| ------ | ------------------- | -------------------------- | --------------------- |
| **H1** | **Win-rate 信任锚** | "AI 真的能赢"              | 中（24h 复盘 cron）   |
| **H2** | **复盘 tab**        | "上次对了 / 错了一目了然"  | 中（用 H1 数据）      |
| **H3** | **跟单数 + 倒计时** | "别人都在跟，再不跟就晚了" | 低（伪数 + 真倒计时） |
| **H4** | **一键深链跟单**    | "1 秒到位，不用找交易所"   | 低（URL 拼接）        |
| **H5** | **派别 IP 戏剧化**  | "AI 综艺感，像看撕逼"      | 低（Prompt + UI）     |

---

## 2. 派别 IP 重设计（深挖 AI 综艺感）

### 2.1 三个鲜明 IP（江湖称号 + 性格 + 口头禅）

| Agent     | 江湖称号            | 性格                   | 招牌话术（LLM few-shot 用）                                                                                                                                         | 招牌反派                                             |
| --------- | ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Alpha** | **破位猎手 · 老 K** | 激进 / 冲动 / 爱晒成绩 | "破位才是真信号，盘整就是装死"<br>"不破不立，不立不破"<br>"我这一把上次 +12%，懂的都懂"<br>"破！破！破了再说！"<br>"等你看清的时候已经吃饱了"                       | 嫌 Beta 是"乌龟趋势僵尸" / 嫌 Gamma 是"接飞刀大队长" |
| **Beta**  | **趋势守正 · 老白** | 沉稳 / 嘴硬 / 爱讲道理 | "趋势是朋友，没确认别动"<br>"逆势加仓是新手坟墓"<br>"回撤都是机会，破位才是危险"<br>"不要赢一把就 all-in，趋势没破慢慢加"<br>"你的'破位'我见过 100 次，80 次假突破" | 嫌 Alpha 是"假突破韭菜" / 嫌 Gamma 是"刀口舔血"      |
| **Gamma** | **极端猎手 · 老 G** | 阴险 / 毒舌 / 专挑顶底 | "涨太狠就该跌，跌太狠就该涨"<br>"市场永远反人性"<br>"老 K 又准备山顶下蛋了"<br>"极端就是反转信号，等失速"<br>"你以为的趋势，是顶部最后一根"                         | 嫌 Alpha 是"追高山顶侠" / 嫌 Beta 是"趋势僵尸"       |

### 2.2 综艺化机制（让 AI 像真人吵架）

**前缀动作 + emoji**（每条发言强制带 1 个）：

| 场景 | 前缀模板                | emoji |
| ---- | ----------------------- | ----- |
| 怒怼 | "{我} 怒怼 {对方}：xxx" | 💥    |
| 阴阳 | "{我} 阴阳 {对方}：xxx" | 😏    |
| 反呛 | "{我} 反呛 {对方}：xxx" | 💢    |
| 嘲讽 | "{我} 嘲讽 {对方}：xxx" | 🤡    |
| 冷怼 | "{我} 冷怼 {对方}：xxx" | 🧊    |
| 提点 | "{我} 提点 {对方}：xxx" | 🧠    |
| 附和 | "{我} 附和 {对方}：xxx" | 🔥    |
| 反思 | "{我} 反思：xxx"        | 🤔    |

LLM Prompt 强制 Round 2 每条必带前缀（Round 1 独立观点不强制）。

**金句标记**（让用户能截屏分享）：

LLM 输出 JSON 时可标 `[GOLD]` 标签：

```json
{
  "content": "破！破！破了再说！[GOLD]",
  "tag": "gold"
}
```

UI 渲染：金句加金色边框 + 大字号 + 报价符号包裹。用户截图分享率↑。

**激烈度 meter**（综艺感视觉指标）：

```
🔥 辩论激烈度 ████░ 4/5
```

算法：辩论结束后，按 Round 2 的"互怼次数 + cite 对方原话次数 + emoji 数"加权计算 1-5 级。Round 3 共识达成 -1 级，明显分歧 +1 级。

---

## 3. 辩论结构（3 Round 固定）

### 3.1 数据模型

```ts
// src/lib/types.ts 新增
export type NewsDebate = {
  id: string; // 唯一 ID（news.id 派生）
  ts: number;
  newsId: string;
  newsTitle: string;
  newsUrl: string;
  newsSource: string; // CryptoPanic / CoinDesk / etc
  newsSentiment: "bullish" | "bearish" | "neutral";
  newsCurrencies: string[]; // ['BTC', 'ETH']
  rounds: DebateRound[]; // 3 个
  finalStrategy: FinalStrategy;
  intensityScore: 1 | 2 | 3 | 4 | 5;
  status: "in_progress" | "completed";
  createdAt: number;
  completedAt: number | null;
};

export type DebateRound = {
  roundNumber: 1 | 2 | 3;
  roundType: "independent" | "rebuttal" | "consensus";
  utterances: Utterance[]; // 3 条（每派 1 条）
  startedAt: number;
};

export type Utterance = {
  agentId: "alpha" | "beta" | "gamma";
  content: string;
  prefix: "rebut" | "taunt" | "sneer" | "mock" | "cool" | "remind" | "agree" | "reflect" | null;
  emoji: string;
  citedAgentId?: "alpha" | "beta" | "gamma"; // Round 2 必有
  citedQuote?: string; // Round 2 必有
  isGoldenLine: boolean;
  ts: number;
};

export type FinalStrategy = {
  symbol: string;
  direction: "long" | "short" | "wait";
  entryCondition: string; // "突破 $77,200 + 5min K 线确认"
  stopLoss: number;
  takeProfit: number[]; // [78500, 79200] 多档
  consensusRatio: "3:0" | "2:1" | "1:2" | "0:3";
  consensusAgents: AgentId[]; // 共识方
  dissentAgents: AgentId[]; // 保留意见方
  dissentNote: string; // Gamma 保留意见的原话
  riskNote: string; // 固定声明 + 个性化风险
  followCount: number; // 跟单伪数（前期）
  viewCount: number; // 在看伪数（前期）
  expiresAt: number; // 失效时间
};
```

### 3.2 Round 流程

| Round  | 类型        | 内容                                              | LLM 调用次数                              |
| ------ | ----------- | ------------------------------------------------- | ----------------------------------------- |
| **R1** | 独立观点    | 3 派各从派别角度独立解读新闻，不知道对方说啥      | 3（并行）                                 |
| **R2** | 反驳追问    | 每派从对方 R1 中挑 1 条 cite + 反驳 / 嘲讽 / 提点 | 3（串行，需要 R1 上下文）                 |
| **R3** | 共识 / 分歧 | 强制输出 `consensusRatio` + 收敛或保留意见        | 1（meta-agent，整合 3 派 R1+R2 → 出策略） |

总计 **每场辩论 7 次 LLM 调用**。

### 3.3 Round 间错峰显示

视觉节奏：

- R1 三条按 1.2s 间隔逐条进入（task-11 M5 setTimeout 链复用）
- R1 全部出完后等 800ms（让用户读完）
- R2 三条同样 1.2s 间隔
- R2 全部出完后等 1500ms
- R3 共识/策略卡 fade-in 400ms（隆重进入）

总辩论显示时长 ~12-15s，符合"直播感"节奏。

---

## 4. CryptoPanic 数据源接入

### 4.1 API

**Endpoint**：`https://cryptopanic.com/api/v1/posts/?auth_token={KEY}&public=true&filter=hot&currencies=BTC,ETH,SOL,USDT`

**Response 关键字段**：

```json
{
  "results": [
    {
      "id": 12345,
      "kind": "news",
      "title": "BTC spot ETF inflows hit $1.2B daily record",
      "url": "https://...",
      "source": { "title": "CoinDesk", "domain": "coindesk.com" },
      "currencies": [{ "code": "BTC" }],
      "votes": { "positive": 45, "negative": 3, "important": 12 },
      "published_at": "2026-04-30T14:00:00Z"
    }
  ]
}
```

**Rate limit**：免费层 200 req/day → 每 8 分钟拉一次（180/day < 200）。

**配置**：

- env：`CRYPTOPANIC_API_KEY`
- 添加到 `.env.local.example` + README env 段
- next.config.mjs CSP `connect-src` 加 `https://cryptopanic.com`

### 4.2 触发逻辑（哪些新闻自动开辩论）

```ts
// src/lib/newsTriggers.ts 新建
const HIGH_IMPACT_KEYWORDS = [
  "ETF",
  "SEC",
  "Fed",
  "FOMC",
  "hack",
  "exploit",
  "regulation",
  "监管",
  "approval",
  "通过",
  "rejection",
  "驳回",
  "inflow",
  "outflow",
  "流入",
  "流出",
  "partnership",
  "合作",
  "launch",
  "发布",
];

const MAJOR_SYMBOLS = ["BTC", "ETH", "SOL"];

export function shouldAutoDebate(news: NewsItem): boolean {
  // 1. 涉及主流币
  const involvesMajor = news.currencies.some((c) => MAJOR_SYMBOLS.includes(c));
  if (!involvesMajor) return false;

  // 2. 关键词命中（任一）
  const titleLower = news.title.toLowerCase();
  const hasKeyword = HIGH_IMPACT_KEYWORDS.some((kw) => titleLower.includes(kw.toLowerCase()));
  if (!hasKeyword) return false;

  // 3. 12h 内同新闻去重（hash by title + currencies）
  const hash = makeNewsHash(news);
  if (recentDebatedHashes.has(hash)) return false;

  return true;
}
```

低 impact 新闻进新闻列表，用户点 "🎙 开辩" 按钮才触发（后续 P1）。**MVP 仅自动触发模式**。

---

## 5. LLM Prompt（3 套）

### 5.1 Prompt R1 — 独立观点（3 派并行）

```
你是 [Alpha 破位猎手·老 K | Beta 趋势守正·老白 | Gamma 极端猎手·老 G]，加密交易江湖人物。

## 你的人设
{persona block — 性格 + 口头禅 + 反派别 attitude}

## 触发新闻
title: BTC spot ETF inflows hit $1.2B daily record
currencies: BTC
sentiment: bullish
source: CoinDesk

## 输出 JSON

{
  "content": "1-2 句你的独立观点。直接说事，不要客套",
  "isGoldenLine": false  // 如果你觉得这句话特别有梗，标 true
}

## 约束
- 字数 30-80
- 直接说事，不要"作为 [派别]，我认为..."这种铺垫
- 至少引用新闻里的一个具体数据点（$1.2B / ETF / spot 等）
- 用江湖人物口吻，可以用招牌话术但本周内每条话术只用 1 次
- 不允许"可能"/"或许"/"建议"等空词
- 不允许 cite 别的 Agent（R1 是独立观点）
```

### 5.2 Prompt R2 — 反驳追问（3 派串行，需要 R1 上下文）

```
你是 [agent persona]。

## 你的 R1 观点
{your R1 content}

## 其他 2 派的 R1 观点
- {other_agent_1}: "{their content}"
- {other_agent_2}: "{their content}"

## 任务

挑其中 1 派的 R1 观点反驳 / 嘲讽 / 提点 / 阴阳。

## 输出 JSON

{
  "content": "1-2 句反驳",
  "prefix": "rebut|taunt|sneer|mock|cool|remind",
  "citedAgentId": "alpha|beta|gamma",
  "citedQuote": "你引用对方的原句（≤30 字）",
  "isGoldenLine": false
}

## 约束
- content 必须 cite 对方 quoted 内容（quote 在 citedQuote 字段，content 里至少呼应一次）
- prefix + emoji 强制不为空
- 字数 25-60
- 直接说事，毒舌可以但不能脏话
- 反派别 attitude 体现（参考你人设里的"嫌 X 派 Y"）
- 派别招牌话术不复读 R1 用过的
```

### 5.3 Prompt R3 — 共识收敛（meta-agent 整合）

```
你是中立的辩论裁判，不是 3 派之一。

## 3 派 R1 + R2 全部内容
{all utterances}

## 任务

整合出 FinalStrategy + 共识比例。

## 输出 JSON

{
  "consensusRatio": "3:0|2:1|1:2|0:3",
  "consensusAgents": ["alpha", "beta"],     // 同向的派别 ID
  "dissentAgents": ["gamma"],                // 保留意见的派别 ID（可空数组）
  "direction": "long|short|wait",
  "entryCondition": "具体的入场条件描述",     // ≤40 字
  "stopLoss": 76500,                         // 价格数字
  "takeProfit": [78500, 79200],              // 多档止盈
  "dissentNote": "Gamma 保留意见的核心论点",  // ≤40 字，无分歧时空字符串
  "riskNote": "本场关键风险提示"               // ≤30 字，结合新闻 sentiment
}

## 约束
- direction = wait 时（共识 0:3 或 1:2 等模糊场景），entryCondition / stopLoss / takeProfit 仍要填，描述"等待 X 信号触发再入场"
- consensusRatio 严格按 3 派最终方向投票（long / short / wait）
- 不出现"可能"/"建议"/"或许"
- entryCondition 必须可执行（具体价格 / 信号 / K 线条数）
```

---

## 6. 跟单数 + 倒计时（H3 全伪数）

### 6.1 伪数算法

```ts
// src/lib/fakeFollowCount.ts 新建（前期冷启动用，task-16 P2 切真）
export function fakeFollowCount(
  strategyId: string,
  createdAt: number,
): {
  followCount: number;
  viewCount: number;
} {
  const elapsedMin = (Date.now() - createdAt) / 60_000;

  // 在看：随时间增长 + hash 抖动
  // 0-5min: 50-150
  // 5-30min: 200-500
  // 30-60min: 500-700（饱和）
  const seed = hashStringToNum(strategyId);
  const baseView =
    elapsedMin < 5
      ? 50 + (seed % 100)
      : elapsedMin < 30
        ? 200 + Math.floor(elapsedMin * 10) + (seed % 100)
        : 500 + Math.min(200, Math.floor((elapsedMin - 30) * 6)) + (seed % 50);

  // 跟单 ≈ 在看 / 5（合理转化率）+ hash 抖动
  const baseFollow = Math.floor(baseView / 5) + (seed % 8);

  return { followCount: baseFollow, viewCount: baseView };
}

function hashStringToNum(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}
```

**透明性**：在 ADR 0003 留痕，spec 里明示"前期冷启动伪数，task-16 P2 切真数据"。**不在 UI 里展示"伪"标签**——前期就是要给用户"已有 X 人跟单"的真实感。

### 6.2 倒计时

```ts
// 策略卡显示倒计时
const remainingSec = Math.max(0, Math.floor((strategy.expiresAt - Date.now()) / 1000));
const expiresIn =
  remainingSec > 60 ? `${Math.floor(remainingSec / 60)} 分钟` : `${remainingSec} 秒`;

// expiresAt = createdAt + 30 * 60_000;  // 30min 默认有效期（基于 5min 信号 × 6 = 30min）
```

到期后：策略卡变灰 + "已失效" 标签 + 跟单按钮禁用。

---

## 7. 一键深链跟单（H4）

### 7.1 URL 模板（CoinW 链接 TODO）

```ts
// src/lib/strategyDeeplink.ts 新建
const COINW_BASE = "claw42-todo://placeholder"; // ⚠️ TODO: Dan 提供 CoinW affiliate URL 模板后替换

export function buildCoinwDeeplink(strategy: FinalStrategy): string {
  if (strategy.direction === "wait") return ""; // wait 不跳

  const params = new URLSearchParams({
    symbol: `${strategy.symbol}USDT`,
    side: strategy.direction === "long" ? "buy" : "sell",
    sl: strategy.stopLoss.toString(),
    tp1: strategy.takeProfit[0]?.toString() ?? "",
    tp2: strategy.takeProfit[1]?.toString() ?? "",
    ref: "claw42",
  });
  return `${COINW_BASE}?${params.toString()}`;
}
```

**Codex 实施时**：用 placeholder URL，spec TODO 标"等 Dan 给 CoinW 模板"。后续替换不影响其他逻辑。

### 7.2 跟单按钮交互

```tsx
<button
  onClick={() => {
    track("strategy_follow_click", {
      strategy_id: strategy.id,
      symbol: strategy.symbol,
      direction: strategy.direction,
    });
    window.open(buildCoinwDeeplink(strategy), "_blank");
  }}
  disabled={strategy.direction === "wait" || isExpired}
  className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
>
  {strategy.direction === "wait" ? "等待信号" : `一键跟多 →`}
</button>
```

---

## 8. UI 布局

### 8.1 整体 layout（在 task-12 v2 stream 上扩展）

```
┌─ Hero · Live · 加密市场 ─────────────────────┐
├─ Ticker（折叠主流，task-12 v3 U2 落地）────┤
├─ MarketEventFeed 跑马灯 ───────────────────┤
├─ 3 张 AgentRowCard 横向（task-11 M4 落地）──┤
│   每卡新增："🏆 本周 X 战 Y 胜（Z%）" 一行   │
├─ Stream（混合时间流）─────────────────────┤
│   - 现有 4 类 entry（task-12 v2 落地）       │
│   - 新增 NewsDebateEntry（本 task 加）       │
└─────────────────────────────────────────┘
```

### 8.2 NewsDebateEntry 组件

```tsx
// src/modules/agent-watch/components/NewsDebateCard.tsx 新建
<article className="my-4 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/20 to-zinc-950/40 p-5">
  {/* 新闻头 */}
  <header className="mb-4">
    <div className="mb-1.5 flex items-center gap-2 text-xs text-amber-300/70">
      <span className="animate-pulse">🔴</span>
      <span>LIVE 辩论</span>
      <span className="text-white/40">·</span>
      <span>{formatTime(debate.ts)}</span>
      <span className="text-white/40">·</span>
      <span>来源: {debate.newsSource}</span>
    </div>
    <h3 className="text-base font-semibold text-white/90">🔥 {debate.newsTitle}</h3>
    <a
      href={debate.newsUrl}
      target="_blank"
      rel="noopener"
      className="text-xs text-white/40 hover:text-white/60"
    >
      原文 →
    </a>
  </header>

  {/* 激烈度 meter */}
  <div className="mb-3 flex items-center gap-2 text-xs text-white/60">
    <span>🔥 激烈度</span>
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${
            i <= debate.intensityScore ? "bg-amber-400" : "bg-white/10"
          }`}
        />
      ))}
    </div>
    <span className="text-white/40">{debate.intensityScore}/5</span>
  </div>

  {/* 3 Round */}
  <div className="space-y-3">
    {debate.rounds.map((round) => (
      <RoundBlock key={round.roundNumber} round={round} />
    ))}
  </div>

  {/* FinalStrategy 卡 */}
  <FinalStrategyBlock strategy={debate.finalStrategy} debateId={debate.id} />
</article>
```

### 8.3 Utterance 渲染（综艺感）

```tsx
function UtteranceBubble({ utterance }: { utterance: Utterance }) {
  const agent = AGENT_PROFILES[utterance.agentId];

  return (
    <div className="flex items-start gap-2">
      <AgentAvatar agentId={utterance.agentId} className="h-8 w-8 shrink-0" />
      <div className="flex-1">
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="font-semibold" style={{ color: agent.color }}>
            {agent.nickname}
          </span>
          <span className="text-white/40">{agent.handle}</span>
        </div>
        <div
          className={`mt-1 rounded-xl border-l-2 bg-white/[0.04] px-3 py-2 text-sm ${
            utterance.isGoldenLine
              ? "border-amber-400 bg-amber-400/[0.06]"
              : `border-[${agent.color}]/40`
          }`}
        >
          <span className="mr-1">{utterance.emoji}</span>
          {utterance.prefix && (
            <span className="mr-1 text-white/60">
              {agent.nickname} {PREFIX_LABEL[utterance.prefix]}{" "}
              {utterance.citedAgentId && AGENT_PROFILES[utterance.citedAgentId].nickname}：
            </span>
          )}
          <span className={utterance.isGoldenLine ? "font-semibold text-amber-200" : ""}>
            {utterance.isGoldenLine && '"'}
            {utterance.content}
            {utterance.isGoldenLine && '"'}
          </span>
        </div>
      </div>
    </div>
  );
}

const PREFIX_LABEL = {
  rebut: "怒怼",
  taunt: "阴阳",
  sneer: "嘲讽",
  mock: "反呛",
  cool: "冷怼",
  remind: "提点",
  agree: "附和",
  reflect: "反思",
};
```

### 8.4 FinalStrategy 卡

```tsx
function FinalStrategyBlock({ strategy, debateId }: Props) {
  const { followCount, viewCount } = fakeFollowCount(debateId, strategy.createdAt);
  const remainingMs = strategy.expiresAt - Date.now();
  const isExpired = remainingMs <= 0;

  return (
    <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-950/[0.15] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">🎯</span>
        <span className="font-semibold">用户策略</span>
        <span className="ml-auto text-xs text-white/50">共识 {strategy.consensusRatio}</span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div>
          <span className="text-white/50">标的：</span>
          <span className="font-mono font-semibold">{strategy.symbol}</span>
          <span className="ml-2 text-white/50">方向：</span>
          <span
            className={`font-semibold ${
              strategy.direction === "long"
                ? "text-emerald-400"
                : strategy.direction === "short"
                  ? "text-rose-400"
                  : "text-white/60"
            }`}
          >
            {strategy.direction === "long"
              ? "多头"
              : strategy.direction === "short"
                ? "空头"
                : "等待"}
          </span>
        </div>
        <div>
          <span className="text-white/50">入场：</span>
          {strategy.entryCondition}
        </div>
        <div>
          <span className="text-white/50">止损：</span>
          <span className="font-mono">${strategy.stopLoss.toLocaleString()}</span>
          <span className="ml-2 text-white/50">止盈：</span>
          {strategy.takeProfit.map((tp, i) => (
            <span key={i} className="ml-1 font-mono">
              ${tp.toLocaleString()}
              {i < strategy.takeProfit.length - 1 && " /"}
            </span>
          ))}
        </div>
        {strategy.dissentNote && (
          <div className="mt-2 text-xs text-white/50">
            <span className="text-violet-400">⚠️ 保留意见：</span>
            {strategy.dissentNote}
          </div>
        )}
      </div>

      {/* 跟单数 + 倒计时 + 跟单按钮 */}
      <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-3 text-xs">
        <span className="text-white/60">👁 {viewCount} 人在看</span>
        <span className="text-white/60">👥 {followCount} 已跟单</span>
        <span className={`ml-auto ${isExpired ? "text-rose-400" : "text-amber-400"}`}>
          ⏱ {isExpired ? "已失效" : `${Math.floor(remainingMs / 60_000)} 分钟后失效`}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          disabled={strategy.direction === "wait" || isExpired}
          onClick={() => handleFollow(strategy, debateId)}
          className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:bg-white/10 disabled:text-white/40"
        >
          {strategy.direction === "wait" ? "等待信号" : isExpired ? "已失效" : "一键跟单 →"}
        </button>
        <button
          onClick={() => handleSkip(debateId)}
          className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white/60 hover:bg-white/[0.08]"
        >
          跳过
        </button>
        <button
          onClick={() => handleSave(strategy)}
          className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white/60 hover:bg-white/[0.08]"
        >
          保存
        </button>
      </div>

      <p className="mt-3 text-[10px] text-white/30">
        ⚠️ 所有策略仅供参考，非投资建议。{strategy.riskNote}
      </p>
    </div>
  );
}
```

---

## 9. Win-Rate 信任锚（H1）+ 复盘 tab（H2）

### 9.1 24h 复盘 cron

```ts
// src/app/api/cron/strategy-replay/route.ts 新建
// 每小时跑一次（Vercel cron），处理 24h 前的策略

export async function GET(request: NextRequest) {
  // verify cron secret
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = Date.now() - 24 * 60 * 60_000;
  const pendingStrategies = await getStrategiesAwaitingReplay(cutoff);

  for (const s of pendingStrategies) {
    const candle = await fetchHistoricalPrice(
      s.symbol,
      s.createdAt,
      s.createdAt + 24 * 60 * 60_000,
    );
    const result = evaluateStrategy(s, candle); // hit_tp / hit_sl / no_trigger
    await saveReplayResult(s.id, result);
  }

  return NextResponse.json({ processed: pendingStrategies.length });
}
```

`vercel.json` 加 cron 配置（**注意：vercel.json 在 ARCHITECTURE.md § 9 禁止路径，需要 ADR 0004 + Dan 批准**）：

```json
{
  "crons": [{ "path": "/api/cron/strategy-replay", "schedule": "0 * * * *" }]
}
```

### 9.2 策略复盘存储

**简化方案**：用 file cache（task-13 模式），存 `.cache/strategies/{id}.json`。task-16 P2 升级到真 DB 时迁移。

```ts
// src/lib/strategyHistory.ts 新建
type StrategyRecord = FinalStrategy & {
  id: string;
  debateId: string;
  createdAt: number;
  replayResult: "hit_tp" | "hit_sl" | "no_trigger" | "pending";
  actualPrice?: { entry: number | null; max: number; min: number };
  participatingAgents: AgentId[]; // R3 共识方
};

// 派别胜率统计
export function computeAgentWinrate(
  agentId: AgentId,
  days: number = 7,
): {
  wins: number;
  losses: number;
  total: number;
  winrate: number;
  avgRoi: number;
} {
  const records = loadRecentStrategies(days);
  const participated = records.filter(
    (r) => r.participatingAgents.includes(agentId) && r.replayResult !== "pending",
  );
  const wins = participated.filter((r) => r.replayResult === "hit_tp").length;
  const losses = participated.filter((r) => r.replayResult === "hit_sl").length;
  // ... avgRoi 计算
}
```

### 9.3 AgentRowCard 升级（加 win-rate 行）

```tsx
<div className="mt-1 flex items-center gap-2 text-xs text-white/60">
  <span>🏆</span>
  <span>
    本周 {wins} 战 {wins} 胜
  </span>
  <span className={winrate >= 50 ? "text-emerald-400" : "text-rose-400"}>({winrate}%)</span>
  <span className="text-white/40">·</span>
  <span>
    ROI {avgRoi >= 0 ? "+" : ""}
    {avgRoi.toFixed(1)}%
  </span>
  <button
    onClick={() => router.push("/zh_CN/agent/replay")}
    className="ml-auto text-violet-400 hover:underline"
  >
    查看复盘 →
  </button>
</div>
```

### 9.4 复盘 tab 页

新建路由 `/zh_CN/agent/replay`：

```tsx
// src/app/[locale]/agent/replay/page.tsx
export default async function ReplayPage() {
  const records = await loadAllStrategies(7);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">📊 AI 复盘 · 近 7 天</h1>

      {/* 派别胜率汇总 */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        {(["alpha", "beta", "gamma"] as const).map((id) => (
          <AgentWinrateCard key={id} agentId={id} stats={computeAgentWinrate(id)} />
        ))}
      </section>

      {/* 历史策略列表 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">所有策略</h2>
        <div className="space-y-2">
          {records.map((r) => (
            <StrategyReplayRow key={r.id} record={r} />
          ))}
        </div>
      </section>
    </main>
  );
}

function StrategyReplayRow({ record }: { record: StrategyRecord }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <span className="font-mono text-sm">{formatDate(record.createdAt)}</span>
      <span className="font-mono text-sm font-semibold">{record.symbol}</span>
      <span
        className={`text-sm ${record.direction === "long" ? "text-emerald-400" : record.direction === "short" ? "text-rose-400" : "text-white/60"}`}
      >
        {record.direction === "long" ? "多" : record.direction === "short" ? "空" : "等"}
      </span>
      <span className="text-xs text-white/50">
        {record.participatingAgents.map((a) => AGENT_PROFILES[a].nickname).join(" + ")}
      </span>
      <span
        className={`ml-auto text-sm font-semibold ${
          record.replayResult === "hit_tp"
            ? "text-emerald-400"
            : record.replayResult === "hit_sl"
              ? "text-rose-400"
              : "text-white/40"
        }`}
      >
        {record.replayResult === "hit_tp" && "✅ +" + computeRoi(record) + "%"}
        {record.replayResult === "hit_sl" && "❌ -" + Math.abs(computeRoi(record)) + "%"}
        {record.replayResult === "no_trigger" && "⚪ 未触发"}
      </span>
    </div>
  );
}
```

---

## 10. PostHog 事件命名

`src/lib/analytics.ts` 中 `ANALYTICS_EVENTS` 数组扩展：

```ts
export const ANALYTICS_EVENTS = [
  // ... task-14 已有
  // task-15 NewsDebate 事件
  "debate_thread_view", // 辩论 thread 进入视口（IntersectionObserver）
  "debate_round_complete", // 一 round 完成（property: round_n, debate_id）
  "strategy_card_view", // 策略卡显示
  "strategy_follow_click", // 跟单按钮点击（property: strategy_id, symbol, direction）
  "strategy_skip_click", // 跳过点击
  "strategy_save_click", // 保存策略点击
  "strategy_share_click", // 分享（P1 用，预留）
  "agent_winrate_click", // 点击 win-rate 跳复盘
  "replay_page_view", // 复盘 tab 浏览
];
```

---

## 11. 文件结构

### 新建（10 个）

```
src/lib/types.ts                                   # 加 NewsDebate / DebateRound / Utterance / FinalStrategy / StrategyRecord
src/lib/api/cryptopanic.ts                         # CryptoPanic API 封装
src/lib/newsTriggers.ts                            # shouldAutoDebate + 关键词
src/lib/debateOrchestrator.ts                      # 3 round 编排（R1 并行 / R2 串行 / R3 meta）
src/lib/fakeFollowCount.ts                         # 伪数算法
src/lib/strategyDeeplink.ts                        # CoinW URL 拼接
src/lib/strategyHistory.ts                         # 策略历史 + win-rate 计算
src/modules/agent-watch/components/NewsDebateCard.tsx
src/modules/agent-watch/components/UtteranceBubble.tsx
src/modules/agent-watch/components/FinalStrategyBlock.tsx
src/app/api/cron/strategy-replay/route.ts          # 24h 复盘 cron
src/app/[locale]/agent/replay/page.tsx             # 复盘 tab
src/modules/agent-watch/components/AgentWinrateCard.tsx
docs/adr/0003-fake-follow-count.md                 # 伪数 ADR
docs/adr/0004-strategy-replay-cron.md              # cron + vercel.json 改动 ADR
```

### 修改

```
src/lib/llmFallbackChain.ts                        # 加 R1/R2/R3 三套 prompt
src/modules/agent-watch/AgentWatchBoard.tsx        # 集成 NewsDebateCard 进 stream
src/modules/agent-watch/components/AgentRowCard.tsx # 加 win-rate 行
src/lib/analytics.ts                               # ANALYTICS_EVENTS 加 9 个事件
src/i18n/types.ts + dicts/*.json                   # i18n 翻译（10 语 fallback 英文 OK）
next.config.mjs                                    # CSP connect-src 加 cryptopanic.com
.env.local.example                                 # 加 CRYPTOPANIC_API_KEY + CRON_SECRET
README.md                                          # env 变量段更新
ARCHITECTURE.md                                    # § 6 性能预算 + § 9 禁止路径补 vercel.json 已 ADR 0004 例外
vercel.json                                        # 新建（ADR 0004 批准后）
package.json                                       # 可能加 zod（用于 LLM JSON 输出 schema 验证）
```

### 派别 IP 配置（i18n）

```ts
// src/lib/agentProfiles.ts 新建
export const AGENT_PROFILES = {
  alpha: {
    id: "alpha",
    nickname: "老 K",
    fullName: "破位猎手",
    handle: "@laoK_breakout",
    color: "#ff5f5f",
    persona: `你是老 K，破位猎手。激进、冲动、爱晒成绩。口头禅："破位才是真信号"、"不破不立"、"破！破！破了再说！"。看不起 Beta（趋势僵尸）和 Gamma（接飞刀大队长）。`,
    catchphrases: [
      "破位才是真信号，盘整就是装死",
      "不破不立，不立不破",
      "我这一把上次 +12%，懂的都懂",
      "破！破！破了再说！",
      "等你看清的时候已经吃饱了",
    ],
    rivalAttitude: {
      beta: "嫌他乌龟、趋势僵尸、机会都错过",
      gamma: "嫌他接飞刀、自杀式抄底",
    },
  },
  beta: {
    id: "beta",
    nickname: "老白",
    fullName: "趋势守正",
    handle: "@laoBai_trend",
    color: "#3a7bff",
    persona: `你是老白，趋势守正。沉稳、嘴硬、爱讲道理。口头禅："趋势是朋友"、"逆势加仓是新手坟墓"、"假突破我见过 100 次"。看不起 Alpha（追高韭菜）和 Gamma（刀口舔血）。`,
    catchphrases: [
      "趋势是朋友，没确认别动",
      "逆势加仓是新手坟墓",
      "回撤都是机会，破位才是危险",
      "不要赢一把就 all-in",
      '你的"破位"我见过 100 次，80 次假突破',
    ],
    rivalAttitude: {
      alpha: "嫌他假突破韭菜、追高总挨刀",
      gamma: "嫌他刀口舔血、底永远在底下",
    },
  },
  gamma: {
    id: "gamma",
    nickname: "老 G",
    fullName: "极端猎手",
    handle: "@laoG_reversal",
    color: "#9b6bff",
    persona: `你是老 G，极端猎手。阴险、毒舌、专挑顶底。口头禅："涨太狠就该跌"、"市场永远反人性"、"老 K 又准备山顶下蛋了"。看不起 Alpha（追高山顶侠）和 Beta（趋势僵尸）。`,
    catchphrases: [
      "涨太狠就该跌，跌太狠就该涨",
      "市场永远反人性",
      "老 K 又准备山顶下蛋了",
      "极端就是反转信号，等失速",
      "你以为的趋势，是顶部最后一根",
    ],
    rivalAttitude: {
      alpha: "嫌他山顶下蛋、追高侠",
      beta: "嫌他趋势僵尸、反应总慢半拍",
    },
  },
} as const;
```

---

## 12. 验收清单

### 12.1 数据接入

- [ ] CryptoPanic API 接入，每 8min 拉新 hot 新闻
- [ ] `shouldAutoDebate` 关键词 + 主流币 + 12h 去重三个条件全实现
- [ ] CSP `connect-src` 加 `https://cryptopanic.com`
- [ ] `.env.local.example` + README + ADR 0003/0004 全齐
- [ ] CRON_SECRET 走 Vercel env，不入 git

### 12.2 辩论引擎

- [ ] R1 并行 3 LLM 调用，互不影响
- [ ] R2 串行调用，每条必须 cite 对方 R1 某句（grep `citedQuote` 字段非空）
- [ ] R3 输出 FinalStrategy 全字段（direction / entry / sl / tp / consensusRatio / dissentNote / riskNote）
- [ ] LLM JSON schema 输出失败时降级到"等待"策略（不让用户白看）
- [ ] 每场辩论 LLM 总调用 ≤ 7 次

### 12.3 派别 IP 综艺感

- [ ] 3 派 nickname / handle / persona 全配置
- [ ] R1 输出可能有招牌话术，但本周内每条话术 ≤ 1 次（Prompt 约束 + 后处理验证）
- [ ] R2 prefix + emoji 必填（grep `prefix: null` 无结果）
- [ ] 金句 `isGoldenLine: true` 渲染特殊样式（金色边框 + 引号包裹）
- [ ] 激烈度 meter 1-5 级根据 R2 互怼次数 + cite 频率计算

### 12.4 用户钩子

- [ ] **H1**：3 张 AgentRowCard 顶部显示 "🏆 本周 X 战 Y 胜（Z%）" + ROI
- [ ] **H1**：win-rate 数据从 strategyHistory 实时计算
- [ ] **H2**：`/zh_CN/agent/replay` 路由可访问，列出近 7 天策略
- [ ] **H2**：每条策略显示 ✅ hit_tp / ❌ hit_sl / ⚪ no_trigger
- [ ] **H3**：策略卡显示 "👁 X 人在看 / 👥 Y 已跟单" 伪数（fakeFollowCount）
- [ ] **H3**：30min 倒计时实时更新（每秒 setInterval 或 useTime hook）
- [ ] **H4**：跟单按钮 `window.open(deeplink, '_blank')` + PostHog `strategy_follow_click` 上报
- [ ] **H4**：URL 暂用 `claw42-todo://placeholder`，TODO 注释提醒等 Dan 给 CoinW 模板
- [ ] **H5**：UtteranceBubble 渲染 emoji + prefix label（"老 K 怒怼 老白：..."）

### 12.5 24h 复盘 cron

- [ ] `vercel.json` 加 cron 配置 `/api/cron/strategy-replay`（每小时）
- [ ] cron route 校验 CRON_SECRET
- [ ] 取 24h 前未复盘的策略，拉历史 K 线判定 hit_tp / hit_sl / no_trigger
- [ ] strategyHistory.ts 写入复盘结果

### 12.6 PostHog

- [ ] 9 个新事件全部加入 `ANALYTICS_EVENTS` 白名单
- [ ] `track('strategy_follow_click', { strategy_id, symbol, direction })` 等关键事件上报
- [ ] dev mode 验证 PostHog 收到事件

### 12.7 ARCHITECTURE.md 同步

- [ ] § 9 禁止路径段加注："vercel.json 改动经 ADR 0004 批准"
- [ ] § 10 升级路径加："task-15 NewsDebate Mode 已落地"

### 12.8 i18n 与文案

- [ ] 10 语 dict 都加 `agent.nickname` / `agent.handle` 等字段
- [ ] zh_CN 用江湖称号（老 K / 老白 / 老 G）
- [ ] 其他 locale 用英文 fallback（"K the Hunter" / "Bai the Trend" / "G the Reversal"）

---

## 13. 提交命令

**3 阶段 commit**（同分支推 3 commit）：

```sh
git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
git checkout -b feature/news-debate-mode-01

# 阶段 1：数据层 + LLM Prompt + 派别 IP
git add src/lib/types.ts \
        src/lib/api/cryptopanic.ts \
        src/lib/newsTriggers.ts \
        src/lib/debateOrchestrator.ts \
        src/lib/fakeFollowCount.ts \
        src/lib/strategyDeeplink.ts \
        src/lib/strategyHistory.ts \
        src/lib/agentProfiles.ts \
        src/lib/llmFallbackChain.ts \
        src/lib/analytics.ts \
        next.config.mjs \
        .env.local.example
git commit -m "feat(debate): news-debate data + orchestration layer (task-15 stage 1)

- CryptoPanic news API integration (8min poll, 200/day rate limit safe)
- Agent IP system: 老 K 破位猎手 / 老白 趋势守正 / 老 G 极端猎手 with personas + catchphrases + rival attitudes
- Debate orchestrator: R1 (parallel) + R2 (serial, must cite) + R3 (meta consensus)
- 7 LLM calls per debate (3+3+1)
- Fake follow/view count algorithm for cold-start phase (covered by ADR 0003)
- Strategy deeplink builder (CoinW URL TODO placeholder)
- Strategy history + agent winrate computation
- 9 new PostHog events (debate_/strategy_/agent_/replay_)
- CSP connect-src adds cryptopanic.com"

# 阶段 2：UI 组件 + 综艺感
git add src/modules/agent-watch/components/NewsDebateCard.tsx \
        src/modules/agent-watch/components/UtteranceBubble.tsx \
        src/modules/agent-watch/components/FinalStrategyBlock.tsx \
        src/modules/agent-watch/components/AgentWinrateCard.tsx \
        src/modules/agent-watch/components/AgentRowCard.tsx \
        src/modules/agent-watch/AgentWatchBoard.tsx \
        src/i18n/types.ts \
        src/i18n/dicts/*.json
git commit -m "feat(debate): news-debate UI + 5 user hooks (task-15 stage 2)

- NewsDebateCard: amber-themed event with news header + intensity meter + 3 rounds + final strategy
- UtteranceBubble: prefix+emoji rendering ('老 K 怒怼 老白：...') + golden-line highlight
- FinalStrategyBlock: H3+H4 hooks (fake view/follow count + 30min countdown + CoinW deeplink button)
- AgentWinrateCard: H1 trust anchor (本周 X 战 Y 胜 Z%)
- AgentRowCard upgraded with winrate row
- AgentWatchBoard integrates NewsDebateCard into existing stream
- i18n 10 locales for agent IPs (zh_CN: 江湖称号, others: English fallback)"

# 阶段 3：复盘 cron + tab + ADR
git add src/app/api/cron/strategy-replay/route.ts \
        src/app/\[locale\]/agent/replay/page.tsx \
        vercel.json \
        docs/adr/0003-fake-follow-count.md \
        docs/adr/0004-strategy-replay-cron.md \
        ARCHITECTURE.md \
        README.md
git commit -m "feat(debate): replay cron + replay tab + ADRs (task-15 stage 3)

- /api/cron/strategy-replay: hourly cron evaluates 24h+ strategies vs actual price (hit_tp / hit_sl / no_trigger)
- /[locale]/agent/replay tab: H2 hook — 7-day strategy history with per-agent winrate cards
- vercel.json adds cron config (covered by ADR 0004 — out-of-spec from ARCHITECTURE.md § 9 forbidden paths, Dan-approved)
- ADR 0003: fake follow/view count for cold-start, switch to real PostHog data in task-16 P2
- ADR 0004: strategy replay cron + vercel.json modification rationale
- README env section updated with CRYPTOPANIC_API_KEY + CRON_SECRET
- ARCHITECTURE.md § 9 footnote added for vercel.json exception"

git push origin feature/news-debate-mode-01
```

PR target：`feature/act1-5-watch-page-01`。

---

## 14. 风险与边界

| 风险                                   | 缓解                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| LLM 输出"假激烈"——只是说大词没具体数据 | Prompt 强制 cite 新闻数据点 + R2 必须 cite 对方原句；后处理验证 quote 长度 ≥ 8 字                                  |
| 关键词命中过严，每天没辩论可看         | Phase 2 加 OR 条件（关键词 OR 涉主流币 OR 24h 涨跌 > 5%）；MVP 仅关键词避免噪音                                    |
| 关键词命中过松，LLM 烧钱               | 单日辩论上限 20 场（hard cap），超过仅入新闻列表不自动辩                                                           |
| 跟单 deeplink 没确认导致跟单按钮跳错   | placeholder URL 先用，跑通流程；待 Dan 给 CoinW 模板替换                                                           |
| 伪数被发现"在看 287 但都是假"          | 真实情况下 fakeFollowCount 算法基于 hash 抖动，不会全 287；前期冷启动用伪数是行业惯例（任何 0→1 产品都这样）       |
| LLM JSON 输出 schema 失败              | zod 校验 + fallback 到"等待"策略，不让用户看到错误                                                                 |
| 24h 复盘 cron 失败                     | 失败的策略 replayResult 保持 'pending'，下次 cron 重试；超过 48h 仍 pending 则记 'no_data'                         |
| Vercel cron 配额（Hobby plan 限制）    | 验证项目 plan；如不够可用 GitHub Actions schedule 替代                                                             |
| 派别人格被 LLM "AI 化"——综艺感丢失     | 给 LLM 5 条招牌话术 few-shot + 性格描述；输出后 grep 检查是否有"作为破位猎手，我认为..."这种 AI 铺垫，命中则重生成 |

---

## 15. 与既有任务关系

**前置依赖**：

- task-12 v2（speechGuard + 4 类事件卡）— stream 框架复用
- task-13（hero daily brief）— 数据 fetch 模式 + file cache 模式复用
- task-14 P0（PostHog / 安全头 / API 限流）— 事件追踪 + CSP 扩展
- task-11 落地（AgentRowCard / Ticker 折叠 / 涨绿跌红）— UI 基础

**作废**：

- task-12 v1（stage mode）—— 早已废止
- task-12 v2 ConflictEvent 触发条件 —— v3 用 NewsDebate 替代（更频繁、更有戏剧性的冲突源）

**保留**：

- task-12 v2 其他 3 类事件（CollectiveEvent / FocusEvent / AgentMessage）—— 继续按价格信号触发
- task-12 v2 speechGuard —— 继续控制单 Agent 发言频率
- task-09 sedimentation —— 历史数据源

**后续**：

- **task-16 P2**：把 fakeFollowCount 切换为真实 PostHog 数据 + Sentry 接入 + CSP enforce 升级 + 高危依赖升级
- **P1 钩子（H6 分享卡 / H7 LIVE 倒计时）** —— 可作为 task-17 单独推

---

## 16. 舞台设计（场景化呈现）

> **本节是 spec 重点**：综艺感不是只在文案里——舞台 / 镜头 / 节奏 / 互动 4 维度都要设计到位。

### 16.1 整体舞台分区（双栏 layout，含新闻流）

```
┌─────────────────────────────────────────────────────────┐
│ Hero · Live · 加密市场                                    │
├─────────────────────────────────────────────────────────┤
│ 🚨 重大插播条（critical 新闻才出现，红色 pulse，可关闭）   │  ← 16.9 新加
├─────────────────────────────────────────────────────────┤
│ 📰 新闻流（横向跑马灯，含 sentiment + currency tag）     │  ← 16.9 新加
│   • 16:45 BTC ETF inflows hit $1.2B record · 🟢 BTC      │
│   • 16:30 Fed dovish hint sparks rally · 🟢 BTC ETH     │
│   • 16:12 Solana mainnet upgrade live · 🟢 SOL          │
├─────────────────────────────────────────────────────────┤
│ Ticker（折叠主流）+ 信号跑马灯 + 3 AgentRowCard           │  ← task-11 已落地
├──────────────────────┬──────────────────────────────────┤
│  🔴 主舞台            │   📜 侧栏（双 tab）              │
│  ━━━━━━━━━━━━━      │  ┌─[历史辩论]──[实时信号]──┐    │
│  当前 LIVE 辩论       │  │                          │    │
│  R1/R2/R3 + Strategy │  │ 18:00 BTC ETF · ✅      │    │
│                      │  │ 17:30 Fed 议息 · ❌      │    │
│  + audience metrics  │  │ 16:45 Solana 升级 · ⚪   │    │
│                      │  └──────────────────────────┘    │
│                      │                                   │
│                      │   📌 本周名场面 · 🏆              │
│                      │   "破！破！破了再说！" — 老 K     │
│                      │                                   │
│                      │   🔜 下场预告                     │
│                      │   FOMC · 22:00（5 分钟）          │
└──────────────────────┴──────────────────────────────────┘
```

**桌面**：左 主舞台 ~65% 宽 / 右 时间流 ~35% 宽
**移动**：单栏纵向，时间流折叠到 "查看历史" 按钮，新闻流跑马灯保留

**主舞台核心约束**：永远只显示"当前一场" 辩论。完成后向时间流推送一条 + 主舞台自动切到下一场（无下场则播预告）。

**信息层级**：新闻流（事件驱动）> Ticker（基础数据）> 信号跑马灯（技术指标）。新闻在用户视线最显眼位置。

### 16.1A 主舞台聊天界面完整 mockup（产品最核心区域）

> **本节是 spec 视觉锚**——所有派别 / 辩论 / 策略元素如何在主舞台一屏呈现。

#### 桌面端完整版（一场辩论从上到下展开）

```
╔════════════════════════════════════════════════════════════════════════╗
║                          🎭 主舞台（Live Stage）                        ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  🔴 LIVE · 18:42:15 · 来源 CoinDesk · 🔥 激烈度 ████░ 4/5  [▶ 重播]    ║  ← 顶部状态栏
║                                                                          ║
║  🎙 BTC spot ETF 单日流入 $1.2B 创新高                                  ║  ← 新闻头
║     🟢 看涨   #BTC #ETH                                  [原文 →]       ║
║                                                                          ║
║ ─────────────────────────────────────────────────────────────────────── ║
║                                                                          ║
║  ┌─🤠 老 K──┐ ┌─🐢 老白─┐ ┌─🦊 老 G──┐                                 ║  ← 派别 mini card
║  │ 🎯 突破派 │ │ 🛡 趋势派 │ │ 🔮 极端派 │   非active 派别淡化 + 灰度    ║    （横向 3 卡）
║  │ 7W·4L 57%│ │ 5W·3L 62%│ │ 6W·6L 50%│                                ║
║  │ ⚡ 发言中 │ │ 👀 围观中 │ │ 🧊 沉默中 │   ← 状态 chip                ║
║  │ 🎯 BTC   │ │ 🎯 ETH   │ │ 🎯 BLEND │                                ║
║  │ 🥊宿敌老G│ │ 🥊宿敌老K│ │ 👑 宿敌王 │   ← 宿敌战绩 chip            ║
║  └──────────┘ └──────────┘ └──────────┘                                ║
║   ↑↑↑ active                                                            ║
║   边框红色 glow                                                         ║
║                                                                          ║
║ ──── 🟠 Round 1 · 独立观点 ────                                         ║  ← Round 横幅
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │ [🤠] 老 K · @laoK_breakout · 18:42:01                            │  ║  ← Utterance 气泡
║  │  ┃ 💥 "ETF 流入是真金白银，破前高就追，不破就别 BB" ⭐ GOLD       │  ║    （Alpha 红色 accent bar）
║  │  ┃ 🎯 BTC                                              👍 12     │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │ [🐢] 老白 · @laoBai_trend · 18:42:03                             │  ║
║  │  ┃ 🧊 单根流量不算趋势，等 5min K 线连续 3 根再说                │  ║   （Beta 蓝色 bar）
║  │  ┃ 🎯 ETH                                              👍 7      │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │ [🦊] 老 G · @laoG_reversal · 18:42:05                            │  ║
║  │  ┃ 😏 "极端流入往往伴随顶部回归，老 K 又准备山顶下蛋"             │  ║   （Gamma 紫色 bar）
║  │  ┃ 🎯 BLEND                                            👍 18 ⭐  │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║ ──── 🔥 Round 2 · 互怼追问 ────                                          ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │ [🤠] 老 K 怒怼老白 · 18:42:08                                    │  ║   ← R2 cite 互怼模板
║  │  ┃ 💢 "你这套'等趋势确认'去年错 8 次，韭菜专用"                  │  ║
║  │  ┃ ↘ cite 老白：单根流量不算趋势                                 │  ║   ← cite 引用条
║  │  ┃ 🥊 老 K vs 老白 · 6:4                                         │  ║   ← 宿敌战绩 chip
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │ [🐢] 老白 提点老 G · 18:42:10                                    │  ║
║  │  ┃ 🧠 "极端论你嘴硬过几次？4/15 那次反弹打你脸"                  │  ║
║  │  ┃ ↘ cite 老 G：极端流入往往伴随顶部回归                         │  ║
║  │  ┃ 🥊 老白 vs 老 G · 5:5                                         │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │ [🦊] 老 G 阴阳老 K · 18:42:12                                    │  ║
║  │  ┃ 😏 "破位侠的勇气我服，止损单准备好了吗？"                     │  ║
║  │  ┃ ↘ cite 老 K：破前高就追                                       │  ║
║  │  ┃ 🥊 老 G vs 老 K · 9:3（老 G 领先）                            │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║ ──── ⚖ Round 3 · 共识收敛 ────                                           ║
║                                                                          ║
║  ⚖ 共识 2:1 · 老 K + 老白 看多 · 老 G 保留意见                          ║
║  🌟 提前共识达成（如适用）                                              ║
║                                                                          ║
║ ─────────────────────────────────────────────────────────────────────── ║
║                                                                          ║
║  ┌──────── 📊 BTC 5min · 近 5 小时 ─────────────  $77,041 ↑+0.31% ┐    ║  ← K 线图
║  │                                                                  │    ║
║  │ $78,500 ╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴ 止盈① +1.6% (绿虚线)         │    ║
║  │                                                                  │    ║
║  │ $77,800        ╱╲                                               │    ║
║  │ $77,200 ━━━━━━━━━━━━━━━━━━━━━━━━━ 入场 (橙实线)               │    ║
║  │ $76,800   ╱╲ ╱  ╲╱╲                                             │    ║
║  │           ╱  ╲     ╲___● ← now                                  │    ║
║  │ $76,500 ╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴ 止损 -0.9% (红虚线)          │    ║
║  │                                                                  │    ║
║  │     16:00    16:30    17:00    17:30    18:00    18:30 (now)    │    ║
║  └──────────────────────────────────────────────────────────────────┘    ║
║                                                                          ║
║  ┌─ 🎯 用户策略 · 共识 2:1 ─────────────────────────────────────────┐  ║
║  │                                                                   │  ║
║  │  标的    BTC                                                      │  ║   ← 策略卡
║  │  方向    🟢 多头跟随                                              │  ║
║  │                                                                   │  ║
║  │  入场    突破 $77,200 + 5min K 线确认                             │  ║
║  │  止损    $76,500   (-0.9%)                                        │  ║
║  │  止盈    $78,500   (+1.6%)  /  $79,200   (+2.5%)                  │  ║
║  │                                                                   │  ║
║  │  ⚠️ 老 G 保留：注意 ETF 流入回吐风险                              │  ║
║  │                                                                   │  ║
║  ├──────────────────────────────────────────────────────────────── ─│  ║
║  │  👁 287 人在看   👥 56 已跟单   ⏱ 28 分钟后失效                  │  ║   ← audience metrics
║  ├──────────────────────────────────────────────────────────────── ─│  ║
║  │                                                                   │  ║
║  │  [🚀 一键跟多 →]   [跳过]   [💾 保存]   [📤 分享]                │  ║   ← 4 个 CTA
║  │                                                                   │  ║
║  │  ⚠️ 所有策略仅供参考，非投资建议                                  │  ║
║  └───────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  💭 我会回来告诉你结果。24h 后见。                                       ║   ← Cliffhanger
║                                                                          ║
║ ─────────────────────────────────────────────────────────────────────── ║
║                                                                          ║
║  🗳 你支持哪派的判断？                                                   ║   ← 投票区
║      [✓ 老 K 31%]  [老白 45%]  [老 G 24%]                               ║   （已投状态）
║                                                                          ║
║  💬 audience（task-17 P1 弹幕条占位）                                    ║
║                                                                          ║
╚════════════════════════════════════════════════════════════════════════╝
```

#### 单条 Utterance 气泡放大图（关键组件）

```
┌──────────────────────────────────────────────────────────────────┐
│  ╭─头像╮  老 K · @laoK_breakout · 18:42:01                       │  ← 头部行
│  │ 🤠 │  ↑                                                       │
│  ╰────╯  情绪表情 emotion=excited                                │
│  ┃                                                                │
│  ┃ 💥 "ETF 流入是真金白银，破前高就追，不破就别 BB"  ⭐ GOLD     │  ← 主体行
│  ┃                                                                │   （金句加金边）
│  ┃ 🎯 BTC                                              👍 12     │  ← 元数据行
│                                                                    │   （标的 + 点赞）
│  ▲ 派别色 accent bar（Alpha 红 / Beta 蓝 / Gamma 紫）            │
└──────────────────────────────────────────────────────────────────┘
                              ↓ Round 2 时多一行
              ↘ cite 对方派别：被引用的原句（淡灰）
              🥊 [我] vs [对方] · 历史战绩
```

**视觉规则**：

- 派别色仅出现在左 2px accent bar + 头像光晕（task-12 v3 U8 落地保留）
- 气泡主体灰白（bg-white/[0.04]）
- 金句 `⭐ GOLD` 标记 → 金色边框 + 内容加引号 + 字号略大
- 点赞数实时（伪数 fakeFollowCount 算法变体）
- emotion 表情每 200ms cross-fade（task-15 § 16.13）

#### 移动端版本（适配 < 640px）

```
╔══════════════════════════════════╗
║ 🔴 LIVE · 18:42 · 🔥 4/5  [↗]   ║
║                                   ║
║ 🎙 BTC ETF 流入 $1.2B 创新高    ║
║ 🟢 #BTC #ETH                     ║
╠══════════════════════════════════╣
║                                   ║
║  ←─── 横向滑动 ───→              ║
║  [🤠 K]  [🐢 白]  [🦊 G]         ║   ← 派别卡缩成头像+nickname
║   active  围观     沉默           ║
║   7-4    5-3       6-6            ║
║                                   ║
║ ── R1 独立观点 ──                ║
║                                   ║
║  [🤠] 老 K · 18:42:01            ║
║  ┃ 💥 "ETF 流入是真金白银..."    ║
║  ┃ 🎯BTC                  👍 12  ║
║                                   ║
║  [🐢] 老白 · 18:42:03            ║
║  ┃ 🧊 单根流量不算趋势...        ║
║  ┃ 🎯ETH                  👍 7   ║
║                                   ║
║  [🦊] 老 G · 18:42:05            ║
║  ┃ 😏 "极端流入往往伴随..."      ║
║  ┃ 🎯BLD                  👍 18  ║
║                                   ║
║ ── R2 互怼 ──                    ║
║  ...                              ║
║                                   ║
║ ── R3 共识 2:1 ──                ║
║                                   ║
║  📊 [BTC 5min K 线 mini]         ║   ← 高度缩到 80px
║                                   ║
║  ┌─ 🎯 策略 · 2:1 ──────────┐   ║
║  │ BTC · 多头                │   ║
║  │ 入场 $77,200 + 确认       │   ║
║  │ 止损 $76,500 (-0.9%)      │   ║
║  │ 止盈 $78,500 / $79,200    │   ║
║  │ 👁 287  👥 56  ⏱ 28m     │   ║
║  │                            │   ║
║  │  [🚀 一键跟多 →]          │   ║
║  │  [跳过] [💾] [📤]         │   ║
║  └───────────────────────────┘   ║
║                                   ║
║  💭 24h 后见                     ║
║                                   ║
║  [🗳 投票]  [📜 历史]  [📰 新闻] ║   ← 底部 tab bar
╚══════════════════════════════════╝
```

**移动端关键差异**：

- 派别 mini card 横向滚动（不全部塞屏幕）
- 头像更小（24px）
- K 线图高度缩到 80px
- 策略卡 1 列布局（不是桌面 2 列）
- 底部固定 tab bar（投票 / 历史 / 新闻），不要侧栏
- audience metrics 单行紧凑（"👁 287 · 👥 56 · ⏱ 28m"）

#### 状态对比：3 种主舞台显示模式

**A. live_in_progress（辩论进行中）**：

```
顶部 chip：  🔴 LIVE · 进行中
内容显示：  R1 utterances 已显示，R2 第 2 条 typing... 第 3 条未出
策略卡：    隐藏（辩论未结束）
audience：  伪数滚动 "👁 245 → 287 →..."
互动按钮：  禁用 / 显示 "辩论中"
背景：      派别色 gradient glow 缓慢呼吸（pulse）
```

**B. live_completed（30min 内有效）**：

```
顶部 chip：  ✅ 已完成 · 28 分钟后失效
内容显示：  R1+R2+R3 全部 + 策略卡 + K 线图
策略卡：    全功能启用
audience：  metrics 实时刷新（每 5s 更新一次伪数）
互动按钮：  全部启用（跟单 / 跳过 / 保存 / 分享）
背景：      静止 + 微弱派别色边缘 highlight
```

**C. expired（30min 已过 / 历史 replay）**：

```
顶部 chip：  🕰 已归档 · 实际播出于 16:45
内容显示：  全部 + 策略卡 + K 线图（K 线显示真实结果，标 ✅ 或 ❌）
策略卡：    跟单按钮变灰 "已失效"；保存仍可用；分享仍可用
audience：  metrics 冻结（不再刷新）
互动按钮：  仅"分享"+"保存"+"查看复盘"启用
背景：      整体淡化 60% + 顶部 amber bar
特殊：      策略卡底部加 "📊 实际结果" 区
                ✅ 命中止盈 +1.7% （hit_tp）
                ❌ 触发止损 -0.9% （hit_sl）
                ⚪ 未触发入场 （no_trigger）
```

#### 派别 mini card 详细图

```
桌面 active 状态（当前发言派别）：

┌─🤠 老 K────────────────────┐  ← 边框红色 + glow + scale-105
│  ╭────╮  老 K              │
│  │ 🤠 │  突破派 · 关键位猎手│
│  ╰────╯                    │
│                            │
│  🏆 本周 7 战 4 胜（57%）  │  ← Win-rate 信任锚
│  ROI +3.2%   [查看复盘 →] │
│                            │
│  🎯 当前关注 BTC           │  ← 当前关注
│  ⚡ 发言中                 │  ← 状态 chip
│                            │
│  🥊 宿敌 老 G · 9:3 落后   │  ← 宿敌战绩 chip
│  💢 被老 G 连击 3 场       │  ← 长期情绪 chip（如适用）
│                            │
└────────────────────────────┘

桌面 idle 状态（其他派别淡化）：

┌─🐢 老白─────────┐  ← opacity 0.4 + grayscale 0.3
│ ╭──╮ 老白       │
│ │🐢│ 趋势派     │
│ ╰──╯           │
│ 5W·3L · 62%   │
│ 🎯 ETH · 围观  │
└─────────────────┘
```

**这张图覆盖了产品的所有核心元素**——任何视觉调整以这张为基准。Codex 实施时按这张 mockup 对照逐一实现。

### 16.2 入场动画（让 LIVE 有"开播感"）

**辩论开播时序**：

```
T+0ms       新闻 chip 从顶部 slide-in
T+300ms     "🔴 LIVE" 标识 fade-in + pulse
T+500ms     舞台背景（派别色 gradient glow）淡入
T+800ms     "Round 1 开始" 字幕条横向滑过
T+1200ms    R1 第 1 条 utterance 滑入（Alpha 先发）
T+2400ms    R1 第 2 条 utterance 滑入（Beta）
T+3600ms    R1 第 3 条 utterance 滑入（Gamma）
T+5000ms    "Round 2" 字幕条滑过
T+5300ms+   R2 三条按 cite 关系 slide-in（参见 16.3）
T+9500ms    "Round 3" 字幕条滑过
T+10000ms   FinalStrategy 卡 fade+scale-in（隆重感）
T+11000ms   audience metrics 数字滚动（"👁 0 → 287"）
```

**关键 CSS keyframes**（`globals.css` 加）：

```css
@keyframes stage-glow-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes round-banner {
  0% {
    opacity: 0;
    transform: translateX(-30px);
  }
  20% {
    opacity: 1;
    transform: translateX(0);
  }
  80% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(30px);
  }
}
@keyframes utterance-slide-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes strategy-card-reveal {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  60% {
    opacity: 1;
    transform: scale(1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes count-up {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### 16.3 镜头调度（Spotlight）

**当前发言派别高亮**：

```tsx
// 主舞台容器
<div className={`stage-container ${activeAgentId ? `spotlight-${activeAgentId}` : ""}`}>
  {/* 3 张派别小卡（侧栏复用 AgentRowCard mini 版）放主舞台顶部 */}
  <div className="mb-3 flex gap-2">
    {AGENTS.map((id) => (
      <AgentMiniCard key={id} agentId={id} active={id === activeAgentId} />
    ))}
  </div>
  {/* 当前 round + utterances */}
  ...
</div>
```

**视觉效果**：

- `active` Agent 卡片：边框派别色 + scale-105 + 派别色 glow
- 非 active Agent 卡片：opacity 0.4 + grayscale 0.3
- 切换有 200ms ease 过渡

**Round 2 cite 触发**："被 cite 派别"卡片**额外震动 1 次**（CSS `animate-shake` 300ms）+ 顶部冒一个气泡 "💢 你被点名了"，0.8s 后消失。

```css
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-3px);
  }
  40%,
  80% {
    transform: translateX(3px);
  }
}
```

### 16.4 节奏控制（Pacing）

**Round 间字幕条**：

```tsx
// RoundBanner.tsx
<div className="round-banner-container my-3" data-round={round.roundNumber}>
  <div className="flex items-center gap-2">
    <span className="font-mono text-xs text-amber-400">━━━━</span>
    <span className="font-semibold">
      Round {round.roundNumber} · {ROUND_TITLE[round.roundType]}
    </span>
    <span className="font-mono text-xs text-amber-400">━━━━</span>
  </div>
</div>
```

`ROUND_TITLE`：

- R1：独立观点（Independent Takes）
- R2：互怼追问（Cross-Fire）
- R3：共识收敛（Consensus）

**辩论过程中"行情插播"**：

辩论进行时如果 ticker price 突变（5 分钟内 ±0.3%），插一条小 chip：

```
🔔 BTC 刚刚 +0.31% / $77,041 — 影响辩论方向？
```

视觉：浅蓝色 chip，在当前 Round 之间插入，0.5s shake 进入。这给用户"实时直播"的感觉，证明 stream 不是录播。

**辩论间隔动画**：

上一场辩论结束 → 主舞台 fade-out 400ms → "🔜 下场预告" 卡片 fade-in 300ms → 倒计时显示（"FOMC 决议 22:00 开播 / 还有 4:32"）→ 倒计时结束新辩论 fade-in。

无下场预告时（cron 还没拉到新新闻）→ 显示"📌 本周名场面"循环播放（高赞金句轮播）。

### 16.5 观众互动（Audience Layer）

**金句点赞**：

```tsx
// UtteranceBubble 内（仅金句）
{
  utterance.isGoldenLine && (
    <button
      onClick={() => handleLikeQuote(utterance.id)}
      className="ml-2 text-xs text-white/50 hover:text-amber-400"
    >
      👍 {likeCount}
    </button>
  );
}
```

点赞数全伪（同 fakeFollowCount 算法）+ 真实点击事件存 PostHog `quote_like_click`。

**Round 3 后投票"哪派最对"**：

```
你支持哪派的判断？
[ 老 K 31% ]  [ 老白 45% ]  [ 老 G 24% ]
```

百分比伪数（hash + 时间衰减），用户点击后变 "✓ 已投老 K"，进 PostHog `audience_vote_click`。

**本周名场面**：

每周服务端跑一次（手动触发或 cron）：抓 utterance 中 isGoldenLine + 点赞数 top 5 → 缓存到 file。侧栏 "📌 本周名场面" 区轮播显示。

### 16.6 场景切换（Stage Transitions）

**有 LIVE / 无 LIVE 状态机**：

| 状态               | 主舞台显示                            | 触发条件                            |
| ------------------ | ------------------------------------- | ----------------------------------- |
| `live_in_progress` | 当前辩论 R1/R2/R3 进行                | 辩论 LLM 正在生成                   |
| `live_completed`   | FinalStrategy 卡（持续 30min 倒计时） | 辩论完成，30min 内                  |
| `between_shows`    | 🔜 下场预告 + 倒计时                  | 上场 30min 后，下场 5min 内即将开始 |
| `idle`             | 📌 本周名场面轮播                     | 无 LIVE 也无近期预告                |
| `replay_mode`      | 用户点侧栏历史辩论后进入"重播"        | 用户主动                            |

状态切换都有 400ms fade 过渡，不是硬切。

**重播模式**：

用户点历史辩论 → 主舞台 fade 替换为该场辩论的全 Replay：

- 入场动画**加速 3x**（不需要再等 12s，2-3s 走完）
- 顶部 chip "🔁 REPLAY · 实际播出于 16:45"
- FinalStrategy 卡显示**真实结果**：✅ hit_tp / ❌ hit_sl / ⚪ no_trigger
- 退出按钮 "← 返回 LIVE"

### 16.7 响应式 + 暗黑场景适配

**桌面**（≥ 1024px）：双栏 60/40
**平板**（640-1023px）：单栏，时间流折叠到 "📜 历史" 按钮（按下展开抽屉）
**移动**（< 640px）：

- 单栏纵向
- 主舞台高度自适应（不强制全屏）
- AgentMiniCard 横向滚动
- 字幕条字号缩小
- audience metrics 简化（只显示 "👁 X / 👥 Y / ⏱ Zm"）

**Reduced motion**（用户系统设置 prefers-reduced-motion）：

- 关闭所有 keyframes 动画（slide / shake / scale）
- 保留 opacity fade（瞬间显示替代滑入）
- audience count 不滚动直接显示

### 16.8 派别 mini card（侧栏 + 主舞台共用）

```tsx
function AgentMiniCard({ agentId, active }: Props) {
  const profile = AGENT_PROFILES[agentId];
  const winrate = computeAgentWinrate(agentId, 7);

  return (
    <div
      className={`flex-1 rounded-xl border p-2.5 transition-all duration-200 ${
        active
          ? `border-[${profile.color}] scale-105 shadow-[0_0_12px_${profile.color}66]`
          : "border-white/[0.08] opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        <AgentAvatar agentId={agentId} className="h-8 w-8" />
        <div>
          <div className="text-xs font-semibold">{profile.nickname}</div>
          <div className="text-[10px] text-white/50">
            {winrate.wins}W{winrate.losses}L · {winrate.winrate}%
          </div>
        </div>
      </div>
    </div>
  );
}
```

主舞台用大版（含 catchphrase）+ 侧栏永远迷你版。

### 16.9 新闻流呈现（4 级 severity × 3 层 UI）

**核心设计原则**：新闻是产品的一等公民，不只是辩论的"触发器"。每条新闻都要在 UI 有可见呈现，按 severity 分层。

#### 16.9.1 4 级 Severity 分级

| Severity        | 触发条件                                                   | 示例                                     | UI 层级                                   |
| --------------- | ---------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| **Critical** 🚨 | 涉主流币 + 5min 内 OR 关键词 hack/SEC reject/FOMC announce | "BTC SEC ETF rejected — outflows likely" | 顶部插播条 + 红色 pulse 闪烁              |
| **High** 🔥     | 涉主流币 + 关键词 ETF/Fed/regulation/launch                | "BTC ETF inflows hit $1.2B record"       | 自动开辩论（已落地）+ 新闻流跑马灯置顶    |
| **Medium** 🟡   | 涉主流/热门币 OR 24h move >5%                              | "Solana mainnet upgrade live"            | 新闻流跑马灯滚动 + "🎙 开辩"按钮          |
| **Low** ⚪      | 其他                                                       | "Project X announces partnership"        | 新闻流跑马灯（淡色）+ 折叠到"📋 更多新闻" |

**算法**：

```ts
// src/lib/newsTriggers.ts 扩展
export function classifyNewsSeverity(news: NewsItem): NewsSeverity {
  const titleLower = news.title.toLowerCase();
  const involvesMajor = news.currencies.some((c) => MAJOR_SYMBOLS.includes(c));

  // Critical: 主流币 + 极强关键词
  const CRITICAL_KW = ["hack", "exploit", "reject", "ban", "crash", "crisis", "announce"];
  if (involvesMajor && CRITICAL_KW.some((kw) => titleLower.includes(kw))) {
    return "critical";
  }

  // High: 主流币 + 高 impact 关键词（已存在 HIGH_IMPACT_KEYWORDS）
  if (involvesMajor && HIGH_IMPACT_KEYWORDS.some((kw) => titleLower.includes(kw.toLowerCase()))) {
    return "high";
  }

  // Medium: 涉主流/热门币 OR 涉及币 24h 涨跌 > 5%
  const involvesHotOrMover = news.currencies.some(
    (c) => HOT_SYMBOLS.includes(c) || tickerCache.get(c)?.change24h > 5,
  );
  if (involvesMajor || involvesHotOrMover) return "medium";

  return "low";
}

// shouldAutoDebate 简化为：
export function shouldAutoDebate(news: NewsItem): boolean {
  return classifyNewsSeverity(news) === "high"; // 仅 high 自动辩论；critical 用插播 + 仍可触发辩论但优先级最高
}
```

#### 16.9.2 重大新闻插播条（Critical Layer）

**触发**：检测到 critical 新闻 → 顶部 fixed banner 滑入：

```tsx
// CriticalNewsBanner.tsx 新建
<div className="animate-pulse-banner fixed inset-x-0 top-16 z-50 border-y border-rose-500/40 bg-rose-950/90 backdrop-blur">
  <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
    <span className="animate-pulse text-lg text-rose-400">🚨</span>
    <span className="text-sm font-semibold">重大新闻</span>
    <span className="text-white/40">·</span>
    <span className="flex-1 truncate text-sm text-white/85">{news.title}</span>
    <span className="shrink-0 text-xs text-white/50">{formatRelativeTime(news.publishedAt)}</span>
    <a
      href={news.url}
      target="_blank"
      rel="noopener"
      className="shrink-0 text-xs text-rose-300 hover:underline"
    >
      原文 →
    </a>
    <button onClick={dismiss} className="shrink-0 text-xs text-white/40 hover:text-white/70">
      ×
    </button>
  </div>
</div>
```

```css
@keyframes pulse-banner {
  0%,
  100% {
    background-color: rgb(76 5 25 / 0.9);
  }
  50% {
    background-color: rgb(120 8 40 / 0.95);
  }
}
```

**生命周期**：

- 出现：fade-in + slide-down 400ms
- 持续：5min 后自动收起，或用户点 × 立即关闭
- 单次：同 newsId 24h 内只插播 1 次（hash 去重）
- 与辩论交互：critical 新闻同时触发辩论 → 主舞台立即切到这场（中断当前进行中辩论，"插播打断"模式）

#### 16.9.3 新闻流跑马灯（High/Medium/Low Layer）

**位置**：在重大插播条下方、Ticker 上方（独立一行）。

```tsx
// NewsFeedTicker.tsx 新建
<div className="relative overflow-hidden border-y border-white/[0.04] bg-white/[0.02] py-2">
  <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12 bg-gradient-to-r from-zinc-950 to-transparent" />
  <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-12 bg-gradient-to-l from-zinc-950 to-transparent" />

  <div className="animate-news-marquee flex gap-6 whitespace-nowrap">
    {newsItems.map((news) => (
      <NewsChip key={news.id} news={news} />
    ))}
    {/* 复制一份保证无缝循环 */}
    {newsItems.map((news) => (
      <NewsChip key={`${news.id}-dup`} news={news} />
    ))}
  </div>
</div>
```

**NewsChip 视觉差异**（按 severity）：

```tsx
function NewsChip({ news }: { news: NewsItem }) {
  const sevStyles = {
    high: "text-amber-300 border-l-amber-400/50",
    medium: "text-white/70 border-l-white/20",
    low: "text-white/40 border-l-white/10",
  };

  return (
    <div
      className={`flex items-center gap-2 border-l-2 pl-3 ${sevStyles[news.severity]} flex-shrink-0`}
    >
      {/* sentiment dot */}
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          news.sentiment === "bullish"
            ? "bg-emerald-400"
            : news.sentiment === "bearish"
              ? "bg-rose-400"
              : "bg-white/30"
        }`}
      />

      {/* time + title */}
      <span className="font-mono text-xs text-white/40">{formatTime(news.publishedAt)}</span>
      <span className="text-sm">{news.titleI18n}</span>

      {/* currency tags */}
      {news.currencies.slice(0, 2).map((c) => (
        <span key={c} className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px]">
          {c}
        </span>
      ))}

      {/* "🎙 开辩" 按钮（仅 medium，high 已自动辩 / low 默认隐藏） */}
      {news.severity === "medium" && (
        <button
          onClick={() => triggerDebate(news.id)}
          className="ml-1 rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/30"
        >
          🎙 开辩
        </button>
      )}
    </div>
  );
}
```

```css
@keyframes news-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
.animate-news-marquee {
  animation: news-marquee 90s linear infinite;
}
.animate-news-marquee:hover {
  animation-play-state: paused;
}
```

**和现有信号跑马灯（task-11 M1）的视觉区分**：

| 维度   | 信号跑马灯（task-11）                     | 新闻流跑马灯（task-15）                                       |
| ------ | ----------------------------------------- | ------------------------------------------------------------- |
| 内容   | 技术信号 NEAR_HIGH/EMA_CROSS/RANGE_CHANGE | 真实新闻标题                                                  |
| 视觉   | 灰白系，带派别色 dot                      | 含 sentiment 色（绿涨/红跌/灰中性）+ severity 色（High 琥珀） |
| 位置   | Ticker 下方                               | 重大插播条下，Ticker **上方**                                 |
| 速度   | 60s 滚一轮                                | 90s 滚一轮（更慢，方便阅读）                                  |
| 交互   | hover 暂停                                | hover 暂停 + 可点"开辩"                                       |
| 信号源 | marketSignals 派生                        | CryptoPanic API                                               |

两条跑马灯 z 轴上下分层，用户能立刻区分"这是数据"vs"这是新闻"。

#### 16.9.4 新闻流的 4 状态机

| 状态             | 触发                 | UI                                           |
| ---------------- | -------------------- | -------------------------------------------- |
| `streaming`      | 8min 拉一次新数据    | 跑马灯滚动                                   |
| `critical_alert` | 检测到 critical 新闻 | 顶部插播条 + 跑马灯标红高亮该条              |
| `paused`         | 用户 hover 跑马灯    | 滚动暂停                                     |
| `idle`           | API 失败 + 无缓存    | 跑马灯显示 "📰 新闻加载中..." 或最后已知列表 |

#### 16.9.5 用户主动开辩（Medium severity）

低 impact 新闻不自动开辩，但用户可点 "🎙 开辩"：

1. 点击 → 弹确认 modal："为这条新闻发起辩论？(消耗 7 LLM 调用)"
2. 确认 → 调用 `debateOrchestrator.startDebate(newsId)` → 主舞台 fade-out 当前辩论 → 切到新辩论
3. PostHog 上报 `debate_user_triggered`（property: news_id, severity）
4. 限频：单 IP 每 10min 最多手动开 2 场（防滥用 LLM）

### 16.10 新闻列表 tab（侧栏第 3 tab）

侧栏除"📜 历史辩论 / 📡 实时信号"外加 "📰 新闻列表" tab：

```tsx
// SidebarNewsTab.tsx 新建
<div className="space-y-2">
  {/* 筛选 chip */}
  <div className="mb-3 flex gap-1.5">
    <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
      全部
    </FilterChip>
    <FilterChip active={filter === "critical"} onClick={() => setFilter("critical")}>
      🚨 重大
    </FilterChip>
    <FilterChip active={filter === "high"} onClick={() => setFilter("high")}>
      🔥 已辩
    </FilterChip>
    <FilterChip active={filter === "medium"} onClick={() => setFilter("medium")}>
      🟡 待辩
    </FilterChip>
  </div>

  {/* 24h 内新闻列表 */}
  {filteredNews.map((news) => (
    <NewsListRow key={news.id} news={news} />
  ))}
</div>
```

每条 NewsListRow：

- 时间 + 标题（截断 1 行）
- sentiment dot + currency tag
- 状态：⚪ 未开辩 / 🟡 已辩论（"查看 →"链接到对应 NewsDebate） / 🚨 重大插播
- 高 impact 新闻已自动开辩 → 标 "🔥 已辩 18:00"

### 16.11 新闻多语标题翻译

**问题**：CryptoPanic 返回英文标题，但 zh_CN / ja_JP / ru_RU 等用户需要本地化标题。

**方案**：LLM 轻量翻译（单条 ~50 tokens）+ 缓存。

```ts
// src/lib/newsTranslate.ts 新建
type NewsTitleI18n = Record<Locale, string>;

const titleCache = new Map<string, NewsTitleI18n>(); // newsId → translations

export async function translateNewsTitle(news: NewsItem, locale: Locale): Promise<string> {
  if (locale === "en_US" || locale === "en_XA") return news.title;

  const cached = titleCache.get(news.id);
  if (cached?.[locale]) return cached[locale];

  const translated = await llmTranslate({
    text: news.title,
    targetLocale: locale,
    context: `crypto news headline, keep symbol abbreviations untranslated`,
  });

  titleCache.set(news.id, { ...(cached ?? {}), [locale]: translated });
  return translated;
}
```

**翻译触发**：

- News chip 渲染时按当前用户 locale 取翻译
- 后台批量翻译：每次 8min 拉新新闻后，对 high/critical 提前翻译 zh_CN + ja_JP + en_US（这 3 语用户最多）
- 其他 locale 用户首次访问时按需翻译 + 缓存

**翻译预算**：8min 拉 ~10 条 high/critical 新闻 × 3 语 = 30 调用 / 8min = 5400 调用/天。每条 ~50 tokens → 270000 tokens/day。deepseek 价格约 ¥1.5/天，可接受。

**降级**：LLM 失败时 fallback 到英文原文，UI 显示一个 "🌐" 标记表示未翻译。

### 16.12 K 线图镜头（主舞台底部 mini chart）

**问题**：用户看完辩论 + 策略卡，但策略说的"突破 $77,200"是数字，**用户看不到价格当前在哪**。需要直观的"看图听辩"。

**设计**：FinalStrategy 卡上方插一个 **mini K 线图**（5min 周期 / 最近 60 根 K 线 / 高度 ~120px）：

```
┌──────────────────────── BTC 5min ────────────┐
│  Price                                        │
│  $78,500 ━━━━━━━━━━━━━━━━━━ ← 止盈 1（淡绿虚线）│
│  $77,800 ┃▌▐▌╲                              │
│  $77,200 ━━━━━━━━━━━━━━━━━━ ← 入场（橙色实线）  │
│  $76,800 ▌╲▌▐                                │
│  $76,500 ━━━━━━━━━━━━━━━━━━ ← 止损（淡红虚线） │
│  $76,000                                      │
│         16:00  16:30  17:00  17:30 (当前 ●)   │
└───────────────────────────────────────────────┘
```

**实现要点**：

```tsx
// src/modules/agent-watch/components/StrategyMiniChart.tsx 新建
import { LineChart, ReferenceLine, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

type Props = {
  symbol: string;
  candles: Candle[]; // 5min 周期 60 根，从 ticker API 取
  strategy: FinalStrategy;
};

export function StrategyMiniChart({ symbol, candles, strategy }: Props) {
  const data = candles.map((c) => ({ ts: c.ts, price: c.close }));

  return (
    <div className="mb-3 rounded-lg bg-white/[0.02] p-3">
      <div className="mb-2 flex items-baseline gap-2 text-xs">
        <span className="font-mono font-semibold">{symbol}</span>
        <span className="text-white/40">5min · 近 5 小时</span>
        <span className="ml-auto font-mono">${data.at(-1)?.price.toLocaleString()}</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <XAxis dataKey="ts" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Line type="monotone" dataKey="price" stroke="#9b6bff" strokeWidth={1.5} dot={false} />
          <ReferenceLine
            y={strategy.takeProfit[0]}
            stroke="#22c55e"
            strokeDasharray="3 3"
            label={{ value: "止盈", position: "right", fontSize: 10 }}
          />
          <ReferenceLine
            y={strategy.entryCondition.price}
            stroke="#f59e0b"
            strokeWidth={1.5}
            label={{ value: "入场", position: "right", fontSize: 10 }}
          />
          <ReferenceLine
            y={strategy.stopLoss}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{ value: "止损", position: "right", fontSize: 10 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**数据源**：`/api/market/ticker` 路由扩展返回 `candles5m`（已有 marketDataCache，加字段）。**首次接入 recharts 库**——bundle 影响 ~80KB gzip，记入 ARCHITECTURE § 6 性能预算。

**实时光标**：`<ReferenceLine x={now} stroke="#fff" strokeOpacity={0.3} />` 显示当前时间位置，每秒更新。

**hover 价格标签**：tooltip 显示具体 OHLC + 距入场距离百分比。

### 16.13 头像情绪表情系统（多套不重复）

**问题**：当前设计只用 8 个 emoji 前缀（💥/😏/💢/🤡/🧊/🧠/🔥/🤔）映射到 8 个动作。用户多看几场就发现"重复"，戏剧感打折。

**设计**：每个派别 × 5 种情绪 = **15 个不重复头像表情**，按 utterance 上下文动态切换。

#### 16.13.1 派别情绪表情池

每派 5 种基础情绪 + 对应头像变体（`public/images/agents/{派别}/{情绪}.png` 共 15 张）：

| 情绪                                      | 老 K 头像    | 老白头像     | 老 G 头像 |
| ----------------------------------------- | ------------ | ------------ | --------- |
| `idle` 待机                               | 戴墨镜淡定脸 | 抱臂沉思脸   | 侧脸阴笑  |
| `excited` 兴奋（金句 / R1 强势观点）      | 张嘴大笑握拳 | 微抬眉自信笑 | 邪魅勾唇  |
| `aggressive` 进攻（怒怼 / 反呛）          | 怒目咬牙     | 皱眉冷脸     | 露齿冷笑  |
| `defensive` 防守（被 cite / 反思）        | 后撤捂脸     | 双手压低姿势 | 摆手撇嘴  |
| `victorious` 胜利（共识赢 / hit_tp 复盘） | 双手叉腰仰头 | 端坐微笑     | 翘脚摆姿  |

**生成方式**：用现有 Agent 头像基底（task-07 落地的 3 张），用 Stable Diffusion / Midjourney 改 5 种情绪表达，导出 PNG 透明背景。

**Codex 实施时**：先用 5 个 emoji 占位（每派别共用 task-07 原头像 + 不同 emoji 背景色滤镜），后续 task-17 由 Dan 提供真实情绪头像替换。

#### 16.13.2 情绪 → 表情映射规则

```ts
// src/lib/agentEmotion.ts 新建
type Emotion = "idle" | "excited" | "aggressive" | "defensive" | "victorious";

const PREFIX_TO_EMOTION: Record<UtterancePrefix, Emotion> = {
  rebut: "aggressive",
  taunt: "aggressive",
  sneer: "aggressive",
  mock: "aggressive",
  cool: "defensive",
  remind: "idle",
  agree: "excited",
  reflect: "defensive",
};

export function pickEmotion(utterance: Utterance, debate: NewsDebate): Emotion {
  // 金句永远 excited
  if (utterance.isGoldenLine) return "excited";

  // R3 共识赢家 victorious
  if (
    utterance.roundNumber === 3 &&
    debate.finalStrategy.consensusAgents.includes(utterance.agentId)
  ) {
    return "victorious";
  }

  // R2 用 prefix 映射
  if (utterance.prefix) return PREFIX_TO_EMOTION[utterance.prefix];

  // R1 默认 excited（独立观点都带派别个性）
  return "excited";
}
```

#### 16.13.3 头像组件升级

```tsx
// AgentAvatar.tsx 升级
type Props = {
  agentId: AgentId;
  emotion?: Emotion; // 默认 'idle'
  size?: number; // 默认 32
  className?: string;
};

export function AgentAvatar({ agentId, emotion = "idle", size = 32, className }: Props) {
  return (
    <Image
      src={`/images/agents/${agentId}/${emotion}.png`}
      alt={`${AGENT_PROFILES[agentId].nickname} ${emotion}`}
      width={size}
      height={size}
      className={className}
      // 切换情绪时 200ms cross-fade
      style={{ transition: "opacity 200ms" }}
    />
  );
}
```

#### 16.13.4 派别 idle 状态变化（时间流粘性）

侧栏 mini card 的头像也用情绪：

- 该派别**正在发言**（utterance 进行中）→ excited
- 该派别**被 cite**（R2 别人提到）→ defensive
- 该派别**保持沉默** > 10min → idle
- 该派别**24h 胜率刚被复盘 hit_tp** → victorious 持续 30min

这让侧栏小卡片"活着"——用户切到其他 tab 回来发现"老 K 兴奋了，发生啥了"会主动看。

### 16.14 弹幕条（仅规划，task-17 实施）

**规划占位**：辩论进行时 + audience metrics 区有"伪用户弹幕"从屏幕侧滑过，5-8 条循环：

```
"老 K 这次稳了！"
"Gamma 又来阴阳"
"我跟了上次 +3.2% 😎"
"Beta 还在等趋势确认"
"老 G 嘴硬"
```

伪弹幕生成基于派别 win-rate + 当前 utterance 内容（LLM 后处理），存 JSON 模板预生成。

**为什么 task-15 不做**：弹幕条工程量大（动画 / 队列 / 不阻挡内容），且非主路径价值。task-17 单独 task。

**spec 占位**：在 `src/modules/agent-watch/components/` 留一个 `DanmuLayer.tsx.todo` 文件，注释说明 task-17 实施。

### 16.15 分享短链（H6 提前到 P0）

**触发**：Dan 把原 P1 规划的分享卡升到 P0（说明社交裂变是核心增长动力）。

**用户路径**：

```
辩论结束 / 看到金句 → 点 "分享" 按钮
  → 生成分享 PNG（含金句 + 策略 + watermark + 二维码）
  → 弹"分享到 X / 复制图片 / 复制链接"3 选项
  → 用户分享 → 别人扫码或点链接回到该辩论 thread（含 deep-link 滚动定位）
```

#### 16.15.1 分享 PNG 生成

```ts
// src/lib/shareImage.ts 新建（用 satori 或 @vercel/og 生成 PNG）
import { ImageResponse } from 'next/og';

export async function generateShareImage(debateId: string): Promise<Response> {
  const debate = await getDebateFromCache(debateId);
  const goldenLine = pickGoldenLine(debate);   // 挑 R2 最有戏的一条

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', padding: 60 }}>
        {/* 上半 — 金句区 */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, color: '#fbbf24' }}>🎙 {AGENT_PROFILES[goldenLine.agentId].nickname}</div>
          <div style={{ fontSize: 56, fontWeight: 700, marginTop: 20, lineHeight: 1.3 }}>
            "{goldenLine.content}"
          </div>
        </div>

        {/* 下半 — 策略 + 二维码 */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#9ca3af' }}>🎯 共识 {debate.judgment.consensusRatio}</div>
            <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>
              {debate.action.symbol} {DIRECTION_ZH[debate.action.direction]}
            </div>
            <div style={{ fontSize: 14, color: '#d1d5db', marginTop: 4 }}>
              {debate.action.entryCondition}
            </div>
          </div>

          <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`https://claw42.ai/zh_CN/agent?debate=${debateId}`)}&size=160x160`} width={160} height={160} />
        </div>

        {/* 右下 watermark */}
        <div style={{ position: 'absolute', bottom: 24, right: 60, fontSize: 14, color: '#6b7280' }}>
          claw42.ai · AI 辩论 · 加密交易决策
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

新增 route：`/api/og/debate/[id]` GET → 返回 PNG Response。

**Bundle 影响**：`@vercel/og` ~150KB（仅 server-side，不进 client bundle）。✅

#### 16.15.2 Deep-link 回流

URL 格式：`https://claw42.ai/{locale}/agent?debate={id}` 或 `#debate-{id}`

watch 页 `useEffect` 监听 `searchParams.debate`：

- 找到该 debate → 主舞台立即切到该辩论（强制 replay 模式）
- 找不到（已过期 24h+）→ 显示 "🕰 这场辩论已归档，查看历史 →"
- 顶部 chip："👋 朋友给你分享了这场辩论"，3s 后自动消失

**Open Graph meta**：每个辩论 share URL 服务端渲染 OG meta，自动从分享 PNG 提取：

```html
<meta property="og:image" content="https://claw42.ai/api/og/debate/{id}" />
<meta property="og:title" content="🎙 {nickname}: {goldenQuote 截前 30 字}" />
<meta property="og:description" content="3 个 AI 辩论 {symbol} 后给出策略 — 共识 {ratio}" />
```

X / Twitter 卡片用 `summary_large_image`，朋友圈直接显示。

#### 16.15.3 分享按钮交互

```tsx
// FinalStrategyBlock 加一个新按钮
<button onClick={() => setShareModalOpen(true)}>📤 分享</button>

<ShareModal>
  <img src={`/api/og/debate/${debateId}`} alt="分享卡" />
  <div className="grid grid-cols-3 gap-2">
    <button onClick={() => shareToX(debateId)}>分享到 X</button>
    <button onClick={() => copyImage(debateId)}>复制图片</button>
    <button onClick={() => copyLink(debateId)}>复制链接</button>
  </div>
</ShareModal>
```

PostHog 事件：`strategy_share_click` (props: debate_id, channel: 'x'|'image'|'link')。

#### 16.15.4 分享统计 → 反向影响舞台

被分享次数 ≥ 5 的辩论 → 时间流加 "🔥 热门分享" 标签 + 在"📌 本周名场面"轮播置顶。

这关闭了"用户分享 → 数据回流 → 平台呈现热点 → 吸引更多用户"的增长闭环。

### 16.16 宿敌系统（Head-to-Head Rivalry）

**核心机制**：3 派两两组合 = 3 对宿敌。每对宿敌维护历史 head-to-head 战绩。

#### 16.16.1 数据模型

```ts
// src/lib/types.ts 加
export type RivalryRecord = {
  pairKey: string; // sort([a, b]).join('-')，如 "alpha-gamma"
  agentA: AgentId;
  agentB: AgentId;
  totalDebatesOpposed: number; // 两派意见相反过的辩论数
  agentAWins: number; // A 对了（hit_tp）+ B 错了（hit_sl 或 no_trigger）
  agentBWins: number;
  ties: number; // 都对 / 都错
  recentWinner: AgentId | null;
  hottestQuote: { agentId: AgentId; content: string; debateId: string } | null;
};
```

#### 16.16.2 宿敌战绩计算

24h 复盘 cron 跑完后追加更新：

```ts
// src/lib/rivalryCompute.ts 新建
export async function updateRivalryAfterReplay(debate: NewsDebate, result: ReplayResult) {
  const pairs: [AgentId, AgentId][] = [
    ["alpha", "beta"],
    ["alpha", "gamma"],
    ["beta", "gamma"],
  ];

  for (const [a, b] of pairs) {
    const aOpined =
      debate.action.consensusAgents.includes(a) || debate.action.dissentAgents.includes(a);
    const bOpined =
      debate.action.consensusAgents.includes(b) || debate.action.dissentAgents.includes(b);
    const aDirection = getAgentFinalDirection(debate, a);
    const bDirection = getAgentFinalDirection(debate, b);

    if (!aOpined || !bOpined || aDirection === bDirection) continue; // 没对立不算

    const record = await loadRivalry(a, b);
    record.totalDebatesOpposed++;

    const aRight = result === "hit_tp" && aDirection === debate.action.direction;
    const bRight = result === "hit_tp" && bDirection === debate.action.direction;

    if (aRight && !bRight) {
      record.agentAWins++;
      record.recentWinner = a;
    } else if (bRight && !aRight) {
      record.agentBWins++;
      record.recentWinner = b;
    } else record.ties++;

    await saveRivalry(record);
  }
}
```

#### 16.16.3 宿敌战绩在 UI 出现的 4 个位置

**A. R2 互怼时**（最戏剧化）：被 cite 的瞬间，cite 方头像旁飘出宿敌 chip：

```
老 K 怒怼老白：你这套"等趋势确认"去年错 8 次，韭菜专用
[宿敌战绩 老 K 5:3 老白 · 上次老白赢]
```

让用户立刻 get "这俩有恩怨"。

**B. 派别 mini card 顶部**（侧栏 + 主舞台）：

显示当前派别的最强宿敌 + 战绩：

```
[老 K 头像]
本周 7 战 4 胜（57%）
🎯 宿敌：老 G · 12:8（领先）
```

**C. 复盘 tab 新增 "宿敌战绩" 子区**：

```
🥊 宿敌战绩 · 近 30 天

老 K vs 老白    ━━━━━━░░  6:4
老 K vs 老 G    ━░░░░░░░  3:9  ← 老 K 节节败退
老白 vs 老 G   ━━━━━░░░  5:5
```

含点击 → 看具体被哪些辩论拉分。

**D. 历史争议辩论高亮**：

时间流里某场辩论是 0:3 全反对（争议大）→ chip 显示 "🥊 争议辩论"。

#### 16.16.4 派别情绪受宿敌影响（持续戏剧）

每派别每天检查一次自己 vs 宿敌的趋势，如果**连续 3 场被同一宿敌打败** → 该派别 emotion 进入 `humiliated`（羞辱）状态：

- mini card 头像换 humiliated 表情（task-17 真图）
- 下次辩论 LLM Prompt 注入 "你最近被 [宿敌] 连续打败 3 场，这次不能输"
- LLM 输出会更强烈反击

反之**连胜 5 场** → `dominant`（统治）状态：

- mini card 加 👑 chip
- LLM Prompt 注入 "你最近大杀四方，可以更狂妄"

这是"派别情绪长期演化"——不是单场辩论的瞬时表情。

### 17.1 多语 IP 表

| Locale    | Alpha                          | Beta                                | Gamma                                 |
| --------- | ------------------------------ | ----------------------------------- | ------------------------------------- |
| **zh_CN** | 老 K · 破位猎手                | 老白 · 趋势守正                     | 老 G · 极端猎手                       |
| **zh_TW** | 老 K · 突破獵手                | 老白 · 趨勢守正                     | 老 G · 極端獵手                       |
| **en_US** | K the Hunter · Breakout Sniper | Bai the Steady · Trend Keeper       | G the Reverser · Extremes Catcher     |
| **ja_JP** | ハンターK · ブレイクアウト     | バイ・ステディ · トレンド守         | リバーサーG · 極端捕獲師              |
| **ru_RU** | К-Охотник · Снайпер прорыва    | Бай-Стабильный · Хранитель тренда   | Г-Реверсер · Ловец крайностей         |
| **uk_UA** | К-Мисливець · Снайпер прориву  | Бай-Стабільний · Хранитель тренду   | Г-Реверсер · Ловець крайнощів         |
| **fr_FR** | K le Chasseur · Tireur d'élite | Bai le Stable · Gardien de tendance | G le Renverseur · Chasseur d'extrêmes |
| **es_ES** | K el Cazador · Francotirador   | Bai el Estable · Guardián           | G el Invertidor · Cazador de extremos |
| **ar_SA** | الصياد ك · قناص الاختراق       | باي الثابت · حارس الاتجاه           | جي العاكس · صياد التطرفات             |
| **en_XA** | K the Hu̬nter · Břeakout        | Bai the Stěady · Trend              | G the Revěrser · Extremes             |

### 17.2 招牌话术 i18n 策略

**首期方案**：

- zh_CN / zh_TW：完整本地化（每派 5 条招牌话术，江湖感）
- en_US：完整本地化（D&D / Western 戏剧风）
- 其他 7 语：**fallback 用 en_US**（不强译，避免文化错位）

**LLM Prompt 多语处理**：

- LLM 调用时根据当前用户 locale 切 prompt 的人设语言
- 输出语言 = 用户 locale（除 ar_SA 用 zh_CN 输出，因为 LLM 中文/英文质量更好；ar_SA UI 文字用 RTL 渲染）
- 例：zh_TW 用户看到的辩论是繁中输出 / en_US 用户看到的是英文输出

**en_US 招牌话术示例**（D&D / Western 风）：

```
K the Hunter:
  - "Breakouts are real, ranges are corpses."
  - "Don't see it 'til it's gone — that's the rule."
  - "Last call: +12% gone, who's still asleep?"
  - "Break, break, break — the rest is noise."
  - "I trade the move, not the wait."

Bai the Steady:
  - "Trend's your friend. Don't fight it."
  - "Counter-trend adds dig graves."
  - "Pullbacks are gifts, not warnings."
  - "Eight out of ten 'breakouts' are fakes."
  - "Wait for confirmation. Always."

G the Reverser:
  - "Too high means coming down. Always."
  - "Markets reward the contrarian."
  - "K's about to lay another egg at the top."
  - "Extreme = reversal. Wait for the slip."
  - "What you call 'trend' is the last candle."
```

### 17.3 派别 nickname 与 i18n 字段

```ts
// src/i18n/types.ts
export type AgentI18n = {
  nickname: string; // "老 K" / "K the Hunter"
  fullName: string; // "破位猎手" / "Breakout Sniper"
  handle: string; // "@laoK" / "@K_breakout"
  catchphrases: [string, string, string, string, string]; // 5 条招牌
  rivalAttitudeBeta: string;
  rivalAttitudeGamma: string;
};

export type Locale =
  | "zh_CN"
  | "zh_TW"
  | "en_US"
  | "ja_JP"
  | "ru_RU"
  | "uk_UA"
  | "fr_FR"
  | "es_ES"
  | "ar_SA"
  | "en_XA";

export type Dict = {
  // ... 已有
  agents: {
    alpha: AgentI18n;
    beta: AgentI18n;
    gamma: AgentI18n;
  };
};
```

### 17.4 编辑流程

- **zh_CN + en_US**：F 直接落 spec（已经在 § 2 + § 17.2 给了文案）
- **zh_TW**：基于 zh_CN 简繁转换 + 个别词调整（"猎手" → "獵手" / "破位" → "突破"）
- **其他 7 语**：用 en_US 作为 fallback 写到 dict（每个 locale 都有该字段，但内容暂取 en_US 副本）
- 后续 task-17 可以做"母语审校"提升其他 locale 的本地化质量

**i18n types.ts 不强制 10 语都填具体 nickname**——按 Dan 之前 i18n 纪律"新增字段先改 types 再改全部 10 个 dict"，dict 字段必填，但内容可以是"K the Hunter"这种英文 fallback。

---

## 18. Dan 自己执行的 3 个流程

### 18.1 CryptoPanic API key 注册（10 分钟）

1. 浏览器打开 https://cryptopanic.com/developers/api/
2. 点 "Sign up free" 按钮注册账号（邮箱 + 密码）
3. 注册后访问 https://cryptopanic.com/developers/api/keys
4. 复制 "Public API key"（一串字母数字 hash）
5. 打开 Vercel dashboard → 找到 `claw42-site` 项目（`agentxmain-collab` account）
6. Settings → Environment Variables → Add new
7. 填：
   - Name: `CRYPTOPANIC_API_KEY`
   - Value: 第 4 步复制的 key
   - Environments: 勾选 `Production` + `Preview`（不勾 Development）
8. Save
9. 触发重新部署（push 任意 commit 或 Vercel dashboard 点 Redeploy）

**验证**：部署完成后访问 `/api/cron/strategy-replay` 返回 401（未授权）→ 正确（说明 env 加载了，cron 走 secret 校验）。

### 18.2 Vercel CRON_SECRET 设置（5 分钟）

1. 终端跑生成随机 secret：

   ```bash
   openssl rand -hex 32
   ```

   得到一串 64 字符的 hex（例如 `a3f9e7b2c8...`）

2. **复制这个 hex**（**不要分享给任何人，包括 Codex、ChatGPT 对话记录**）

3. Vercel dashboard → claw42-site → Settings → Environment Variables → Add new

4. 填：
   - Name: `CRON_SECRET`
   - Value: 第 2 步复制的 hex
   - Environments: **仅勾选 `Production`**（cron 只在 prod 跑，preview 不需要）

5. Save

6. Redeploy

**验证**：用 curl 调 cron endpoint，不带 Authorization 头返回 401，带正确 Authorization: Bearer <secret> 返回 200。

```bash
# 应该 401
curl https://claw42.ai/api/cron/strategy-replay

# 用 secret 应该 200
curl -H "Authorization: Bearer $CRON_SECRET" https://claw42.ai/api/cron/strategy-replay
```

**安全提醒**：CRON_SECRET 只放在 Vercel env，不写进 git / spec / commit message / chat history。如果泄露立即在 Vercel rotate。

### 18.3 vercel.json 改动批准流程

vercel.json 在 `ARCHITECTURE.md § 9 禁止路径` 列表内，本 task 改动需 Dan 显式批准。流程：

1. **Codex 实施 task-15 stage 3 时**：
   - 创建 `vercel.json` 新文件，内容：
     ```json
     {
       "crons": [{ "path": "/api/cron/strategy-replay", "schedule": "0 * * * *" }]
     }
     ```
   - 同时创建 `docs/adr/0004-strategy-replay-cron.md`，含完整 vercel.json 内容 + 改动理由 + 风险
   - commit footer 必带：
     ```
     out-of-spec: vercel.json modification per ADR 0004 (Dan-approved 2026-04-30)
     ```

2. **Dan 收到 PR 后审核**：
   - 看 ADR 0004 内容是否完整
   - 看 commit footer 是否带 `out-of-spec` 标记
   - 看 vercel.json 内容是否仅有 cron 配置（没有顺手改其他配置）
   - 都齐 → merge；缺任一 → 让 Codex 补

3. **如果你想提前批准**（不让 Codex 等）：
   - 直接在派发文本里写 "ADR 0004 已预批准，vercel.json 限改动 cron 配置一项"
   - Codex 实施时按这条预批准 + 必带 footer
   - 这是为了避免 Codex 写好后 Dan 不在线导致 PR 卡住

**ADR 0004 内容模板**（让 Codex 按这个写）：

```markdown
# ADR 0004: Strategy Replay Cron + vercel.json Modification

## Status

Accepted (Dan pre-approved 2026-04-30 per task-15 § 18.3)

## Context

task-15 § 9 H1+H2 win-rate 信任锚 + 复盘 tab 需要 24h 自动复盘策略。Vercel cron 是最简方案。但 vercel.json 在 ARCHITECTURE.md § 9 禁止路径列表内，按 claude-codex-protocol.md v2.3 § 带外授权追溯需 Dan 批准。

## Decision

- 新建 vercel.json，内容仅含 1 条 cron：`/api/cron/strategy-replay` 每小时跑一次
- /api/cron/strategy-replay route 用 CRON_SECRET 校验（Authorization: Bearer <secret>）
- 不顺手改其他 Vercel 配置（routes / headers / rewrites 等）

## Consequences

**优点**：H1/H2 钩子能落地（24h 内每张策略自动复盘）；Vercel native cron 比 GitHub Actions schedule 更稳

**代价**：vercel.json 进入 git → 后续 Vercel dashboard 改 cron 配置会被 vercel.json 覆盖，必须改 git

**不可逆性**：低。删 vercel.json + 删 cron route 即回滚

## 关联

- task-15 § 9 + § 13 stage 3
- ARCHITECTURE.md § 9 禁止路径（vercel.json 列入）
- claude-codex-protocol.md v2.3 § 带外授权追溯
```

---

## 19. 待 Dan 确认 / 提供（最终清单）

| #   | 项                                   | 谁做                         | 时间         | 状态                  |
| --- | ------------------------------------ | ---------------------------- | ------------ | --------------------- |
| 1   | CoinW affiliate URL 模板             | Dan 给                       | 上线前替换   | 暂用 placeholder      |
| 2   | CryptoPanic API key 注册             | Dan 自己跑 § 18.1 流程       | 任何时候     | 待办                  |
| 3   | CRON_SECRET 生成 + 设置              | Dan 自己跑 § 18.2 流程       | 部署 cron 前 | 待办                  |
| 4   | vercel.json 改动批准                 | Dan 在派发 Codex 时预批准    | 派发前确认   | 待办                  |
| 5   | 派别名字最终拍板                     | Dan 在 § 2 + § 17.1 看后确认 | 派发前       | 待办                  |
| 6   | 多语种 nickname 是否要更细           | Dan 看 § 17.1 表             | 派发前       | 待办                  |
| 7   | Critical 关键词清单是否要补          | Dan 看 § 16.9.1 关键词列表   | 派发前       | 待办                  |
| 8   | 翻译预算（每天 270K tokens）能否接受 | Dan 看 § 16.11 成本估算      | 派发前       | 待办                  |
| 9   | 真实情绪头像 PNG（15 张）何时给      | Dan 后续提供                 | task-17      | 待办，先用 emoji 占位 |
| 10  | recharts 库引入（+80KB gzip）OK 吗   | Dan 看 § 16.12 性能权衡      | 派发前       | 待办                  |

---

## 20. Hotpursuit 借鉴（成熟设计模式直接复用）

> Hotpursuit 项目（`职业规划/academy/Ai生态项目/Hotpursuit/`）是 Dan 名下另一个加密信号产品原型，已落地 v1.2.0-rc1。它解决的"信号结构化 + 多消费方分发 + 数据源稳定性"问题和 task-15 高度重叠。直接借鉴**成熟设计模式**，避免重复发明。

### 20.1 SignalCard 六层模型 → 应用到 NewsDebate

Hotpursuit 把"行情/新闻/事件/AI 判断/风险提示"统一成 SignalCard 六层结构。task-15 的 NewsDebate 数据模型按同样思路重构为**六层**：

```ts
// src/lib/types.ts NewsDebate 重构
export type NewsDebate = {
  // 第 1 层：身份
  id: string;
  ts: number;
  status: "in_progress" | "completed";

  // 第 2 层：触发源（新闻 / 用户 / 派别情绪）
  trigger: {
    kind: "news" | "user_initiated" | "faction_mood" | "multi_news_aggregate";
    newsId?: string;
    userId?: string;
    aggregatedNewsIds?: string[];
  };

  // 第 3 层：原始素材（new + 翻译）
  source: {
    title: string;
    titleI18n: Record<Locale, string>;
    url: string;
    sourceName: string;
    sentiment: "bullish" | "bearish" | "neutral";
    severity: NewsSeverity;
    publishedAt: number;
    currencies: string[];
  };

  // 第 4 层：AI 判断（3 派 R1/R2/R3 + 共识比例）
  judgment: {
    rounds: DebateRound[];
    consensusRatio: "3:0" | "2:1" | "1:2" | "0:3";
    intensityScore: 1 | 2 | 3 | 4 | 5;
  };

  // 第 5 层：行动（策略卡）
  action: FinalStrategy;

  // 第 6 层：风险（合规 + 个性化）
  risk: {
    standardDisclaimer: string;
    personalizedNote: string;
    dissentNote: string;
    confidence: "high" | "medium" | "low";
  };
};
```

**好处**：

- 多消费方对齐数据契约（前端 / cron / 复盘 / API）
- 任意一层升级不破坏其他层（如未来加第 7 层"用户跟单结果"也兼容）
- 复用 Hotpursuit 已验证的字段命名 + 边界划分

### 20.2 API Projection 三视图 → 应用到 /api/debates

Hotpursuit 用 `view=user|full|agent` 让同一信号有三种格式。task-15 加同样模式：

```
GET /api/debates/{id}?view=user
  → 给前端：精简字段（无 evidence / 无 LLM raw response）

GET /api/debates/{id}?view=full
  → 给后端 / cron：所有字段

GET /api/debates/{id}?view=agent
  → 给 AI 消费：返回 asPrompt 字段（可直接喂给下游 LLM）+ asFunctionCall
```

```ts
// src/lib/projectDebate.ts 新建
export function projectDebate(debate: NewsDebate, view: 'user' | 'full' | 'agent') {
  switch (view) {
    case 'user':
      return { id: debate.id, source: { title: debate.source.titleI18n[locale], ...}, judgment: stripRawData(debate.judgment), action: debate.action };
    case 'full':
      return debate;
    case 'agent':
      return {
        asPrompt: buildAgentPrompt(debate),
        asFunctionCall: buildFunctionCallSchema(debate),
        meta: { debateId: debate.id, ts: debate.ts },
      };
  }
}
```

**好处**：未来其他 AI 产品（生态合作方）可直接消费 task-15 的 debate 数据当 prompt 输入。

### 20.3 数据源 mock / hybrid / live 三模式 → CryptoPanic 集成

Hotpursuit 的 `SIGNAL_DATA_MODE=mock|hybrid|live`，默认 mock。task-15 的 CryptoPanic 集成同样设计：

```ts
// src/lib/api/cryptopanic.ts
type DataMode = "mock" | "hybrid" | "live";

export async function fetchNews(): Promise<NewsItem[]> {
  const mode = (process.env.NEWS_DATA_MODE ?? "mock") as DataMode;

  if (mode === "mock") return getMockNews(); // 内置 10 条假新闻，开发用

  if (mode === "hybrid") {
    try {
      return await fetchCryptopanic();
    } catch {
      return getMockNews(); // API 失败降级到 mock
    }
  }

  if (mode === "live") {
    return await fetchCryptopanic(); // 失败抛错，要求生产配置健康
  }

  return getMockNews();
}
```

**好处**：dev 环境不消耗 CryptoPanic 200/day 额度；prod 环境 hybrid 模式自动降级；CI / E2E 测试用 mock 隔离。

### 20.4 失败冷却窗口（Failure Cooling）

Hotpursuit：API 连续失败 N 次进入冷却，冷却期不重试避免雪崩。

```ts
// src/lib/utils/failureCooler.ts 新建
class FailureCooler {
  private failures = 0;
  private cooldownUntil = 0;

  async run<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (Date.now() < this.cooldownUntil) return fallback();

    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= 3) {
        this.cooldownUntil = Date.now() + 30 * 60_000; // 冷却 30min
        console.warn("[failureCooler] entering cooldown");
      }
      return fallback();
    }
  }
}

const cryptopanicCooler = new FailureCooler();
export const fetchNewsWithCooler = () => cryptopanicCooler.run(fetchCryptopanic, getMockNews);
```

**好处**：CryptoPanic free tier 限速 / 网络抖动 / API 宕机时自动降级 + 不打爆配额。

### 20.5 RSS 双语标注

Hotpursuit RSS 双语：未启用 LLM 翻译时显示 `英文源：xxx`；启用后真双语字段。

task-15 应用：翻译失败 / 翻译禁用时新闻 chip 前缀显示 🌐 + "EN:"，明确告知用户"这是英文原文"。

### 20.6 NewsDetailModal（点击新闻看详情）

Hotpursuit 已实现 NewsDetailModal 组件——点新闻不跳转，弹模态框看完整内容。

task-15 应用：点跑马灯 chip / 重大插播条 / 列表行 → 弹 NewsDetailModal，含：

- 完整标题（双语）+ summary
- 来源 + 发布时间 + sentiment + 涉及 currencies
- **如已开辩**：显示"🎙 查看辩论 →"按钮跳到对应主舞台
- **未开辩 + medium**：显示"🎙 开辩"按钮
- 原文链接（外开新 tab）

直接复用 Hotpursuit 组件思路（按 ARCHITECTURE § 9 不允许直接 import 跨项目代码，但**模式可借鉴**）。

### 20.7 Observability（JSONL 文件锁 + 大小轮转）

Hotpursuit 写 metrics 到 JSONL，文件锁防并发 + 按大小轮转。

task-15 应用到 LLM 调用日志：

```ts
// src/lib/utils/jsonlLogger.ts 新建
// 写入 .logs/llm-calls.jsonl，每条含 ts / agentId / debateId / round / tokens / provider
// 文件超过 10MB 时 rotate 到 .logs/llm-calls.{yyyymmdd}.jsonl
// 字段过滤：禁止写入 apiKey / authorization 等
```

后续 task-16 P2 接 Sentry / PostHog 时，本地 JSONL 是 fallback + 调试通道。

### 20.8 数据源 verify 命令

Hotpursuit 有 `verify:data-sources` 命令输出 health report。

task-15 加 `npm run verify:news`：

```sh
npm run verify:news
# Output:
# ✅ CryptoPanic API: reachable, 47 hot news in last 24h
# ✅ Translation cache: 234 entries, 89% hit rate
# ⚠️ FailureCooler state: in cooldown (8min remaining)
```

---

## 21. 非线性体验设计（防机械化）

> Dan directive："UI / 交互 / 内容都不要机械化和线性思维"。任何"按固定流程跑"的设计都要重审，看能不能加分支 / 自适应 / 多元入口。

### 21.1 节奏自适应（Adaptive Pacing）

不是所有辩论都按相同 12s 节奏。按 severity + 共识强度动态调整：

| 场景                      | 节奏                                         | 总时长  |
| ------------------------- | -------------------------------------------- | ------- |
| Critical 新闻（重大插播） | **快节奏**（每条 utterance 显示 800ms 间隔） | ~8s     |
| High 共识强（3:0）        | **标准节奏**                                 | ~12s    |
| High 分歧大（1:2 或 0:3） | **慢节奏 + R3 加场**（看下文）               | ~18-25s |
| Medium 用户主动开         | **慢节奏**（每条 1.5s）                      | ~15s    |

```ts
// src/lib/debatePacing.ts
export function getDebatePacing(debate: NewsDebate): PacingConfig {
  const sev = debate.source.severity;
  const ratio = debate.judgment.consensusRatio;

  if (sev === "critical") return { utteranceGap: 800, roundGap: 500, totalEstimateSec: 8 };
  if (ratio === "3:0") return { utteranceGap: 1200, roundGap: 800, totalEstimateSec: 12 };
  if (ratio === "1:2" || ratio === "0:3")
    return { utteranceGap: 1500, roundGap: 1200, totalEstimateSec: 22 };
  return { utteranceGap: 1500, roundGap: 1000, totalEstimateSec: 15 };
}
```

### 21.2 结构可变（Branching）

固定 R1 → R2 → R3 是线性。允许：

| 触发                                               | 结构变体                                                    |
| -------------------------------------------------- | ----------------------------------------------------------- |
| **R3 高分歧（0:3 全反对自己）**                    | 加 **R4 加时辩论**（2 派联手攻击 1 派）+ Dan 后续可手动启用 |
| **R2 后已经达成 3:0 强共识**                       | 跳过 R3 直接出策略，加 "🌟 提前共识" 标签                   |
| **新闻关联其他历史辩论**（同 symbol 24h 内已辩过） | R1 多一句 "上次辩论说 X，但现在情况不同" 的回顾             |
| **派别冲突累积**（连续 3 场同派别保留意见）        | R3 后弹出"📌 历史争议 view" 链接到时间流过滤                |

```ts
// debateOrchestrator.ts 修订
export async function runDebate(news: NewsItem) {
  const r1 = await runRound(1, news);

  // 早判共识
  const earlyConsensus = checkEarlyConsensus(r1);
  if (earlyConsensus === "3:0") {
    return finalizeWithEarlyConsensus(r1, news);
  }

  const r2 = await runRound(2, news, r1);
  const r3 = await runRound(3, news, r1, r2);

  // 触发 R4
  if (r3.consensusRatio === "0:3" && severityIsHigh) {
    const r4 = await runRound(4, news, r1, r2, r3);
    return finalize(r1, r2, r3, r4);
  }

  return finalize(r1, r2, r3);
}
```

### 21.3 多元触发入口

不只是"新闻自动开辩"。**5 种触发源**：

| 入口                      | 触发条件                                 | UI                                        |
| ------------------------- | ---------------------------------------- | ----------------------------------------- |
| **A. 新闻自动**（已设计） | High severity 新闻                       | 新闻流自动滚出 + 主舞台开辩               |
| **B. 用户主动**（已设计） | 用户点 medium 新闻"🎙 开辩"              | 模态框确认 → 主舞台                       |
| **C. 派别情绪累积**       | 某派别 30min 没说话 + 该派别匹配信号出现 | "🤔 老 K 沉默 30min，要冒头了" 提示       |
| **D. 多新闻聚合**         | 30min 内 3 条同 sentiment 同币种新闻     | "📊 合议厅" 模式 — 3 条新闻汇总辩论       |
| **E. 历史复盘触发**       | 24h 复盘后某派别胜率突变（>10% 变化）    | "📈 老白胜率上升，新策略要不要看" 弹 chip |

C/D/E 是**主动钩子**——AI 主动在用户屏幕里制造钩子，而不是等用户来看。

### 21.4 结尾悬念（Cliffhanger）

机械化结尾：策略卡 → 30min 失效 → 没了。

非机械化：策略卡末尾**永远留个钩**：

| 共识 | 钩子文案                                      |
| ---- | --------------------------------------------- |
| 3:0  | "我会回来告诉你结果。24h 后见。" + 24h 倒计时 |
| 2:1  | "{保留派} 不服。等数据告诉我们谁对。"         |
| 1:2  | "{少数派} 跑得了和尚跑不了庙。"               |
| 0:3  | "👀 集体看错？还是市场在骗你？我们等真相。"   |
| wait | "现在不动手不丢人，等到了再说。"              |

24h 后复盘 cron 跑完 → 推送通知（PostHog 或 service worker）："📬 老 K 上次说对了 +1.8%。这次..."

### 21.5 角色互动持续（idle 时间也活）

机械化设计：辩论结束 = 派别也"闭嘴"。

非机械化：**派别在 idle 时也有戏**。

侧栏 mini card 加"派别近况" chip（每派 5min 检查一次更新）：

| 触发                            | chip 文案                  |
| ------------------------------- | -------------------------- |
| 该派别 24h 复盘连胜 ≥ 3         | "🔥 老 K 连胜 3 场"        |
| 该派别 24h 复盘连负 ≥ 2         | "💢 老白被打脸 2 场"       |
| 该派别 5min 没说话 + 别派刚发言 | "🤔 老 G 在围观"           |
| 该派别 历史争议次数 top 1       | "👑 老 G · 本周最大反对派" |

点击 chip → 跳到该派别专属时间流（按 agentId 过滤）。

### 21.6 内容反线性（说人话）

LLM Prompt 里加 **anti-mechanical guidance**：

```
约束（强制，违反则重生成）：
- 禁止以"作为 [派别]，我认为..."开头（AI 套话）
- 禁止"首先...其次...最后"列举式结构
- 禁止"综上所述"、"值得注意的是"等过渡词
- 直接说事 + 引用具体数据 + 派别口吻
- 长短句搭配（连续 2 个 >20 字短句强制插入 1 个 <10 字短句）
- 偶尔可以说粗话 / 口头禅 / 加密圈黑话（如"梭哈"/"接飞刀"/"装死"）
```

**后处理校验**：

```ts
const banned = ["作为", "首先", "其次", "综上", "值得注意"];
function passesAntiAi(content: string): boolean {
  return !banned.some((kw) => content.includes(kw));
}
// 不通过 → 重新调 LLM（最多 retry 1 次，仍不通过则 fallback 到派别 catchphrase 拼接）
```

### 21.7 用户体验的"价值感"四个支点

1. **看得懂**：不要"NEAR_HIGH"用户看不懂——改成"距前高 0.42% 测压中"
2. **记得住**：派别 IP / 金句 / 江湖称号让用户能复述
3. **信得过**：win-rate / 复盘 tab / "AI 上次说对了 +3.2%" 反馈闭环
4. **能行动**：策略卡 + 一键跟单 + 24h 后果跟踪

每个 UI 改动决策都过这 4 支点：**改完是哪一项更强？如果说不清就别改。**

---

## 22. 总览：改动清单（更新到 § 16.12-16.14 + § 20-21）

### 新建组件（task-15 新文件汇总）

```
src/lib/types.ts                                # 六层 NewsDebate（§ 20.1）
src/lib/api/cryptopanic.ts                      # mock/hybrid/live 三模式（§ 20.3）
src/lib/newsTriggers.ts                         # 4 级 severity（§ 16.9.1）
src/lib/newsTranslate.ts                        # LLM 翻译 + 缓存（§ 16.11）
src/lib/debateOrchestrator.ts                   # 7-9 LLM 调用 + R4 加场（§ 21.2）
src/lib/debatePacing.ts                         # 节奏自适应（§ 21.1）
src/lib/agentEmotion.ts                         # 头像情绪映射（§ 16.13）
src/lib/projectDebate.ts                        # API 三视图 projection（§ 20.2）
src/lib/utils/failureCooler.ts                  # 失败冷却（§ 20.4）
src/lib/utils/jsonlLogger.ts                    # JSONL 文件锁 + 轮转（§ 20.7）
src/lib/fakeFollowCount.ts                      # 伪数（§ 6）
src/lib/strategyDeeplink.ts                     # CoinW URL 拼接（§ 7）
src/lib/strategyHistory.ts                      # 策略复盘 + winrate（§ 9）
src/lib/agentProfiles.ts                        # 3 派 IP 配置（§ 2）
src/modules/agent-watch/components/CriticalNewsBanner.tsx  (§ 16.9.2)
src/modules/agent-watch/components/NewsFeedTicker.tsx       (§ 16.9.3)
src/modules/agent-watch/components/NewsDetailModal.tsx      (§ 20.6)
src/modules/agent-watch/components/SidebarNewsTab.tsx       (§ 16.10)
src/modules/agent-watch/components/NewsDebateCard.tsx       (§ 8.2)
src/modules/agent-watch/components/UtteranceBubble.tsx      (§ 8.3)
src/modules/agent-watch/components/RoundBanner.tsx          (§ 16.4)
src/modules/agent-watch/components/StrategyMiniChart.tsx    (§ 16.12)
src/modules/agent-watch/components/FinalStrategyBlock.tsx   (§ 8.4)
src/modules/agent-watch/components/AgentMiniCard.tsx        (§ 16.8)
src/modules/agent-watch/components/AgentWinrateCard.tsx     (§ 9.4)
src/modules/agent-watch/components/AgentTypingIndicator.tsx (§ task-12 v3.2 F4 已落)
src/modules/agent-watch/components/DanmuLayer.tsx.todo      # 占位 task-17（§ 16.14）
src/app/api/cron/strategy-replay/route.ts                   (§ 9.1)
src/app/api/debates/[id]/route.ts                           # GET ?view=user|full|agent
src/app/[locale]/agent/replay/page.tsx                      (§ 9.4)
docs/adr/0003-fake-follow-count.md
docs/adr/0004-strategy-replay-cron.md
docs/adr/0005-recharts-bundle-impact.md                     # § 16.12 recharts +80KB
public/images/agents/{alpha,beta,gamma}/{idle,excited,aggressive,defensive,victorious}.png
                                                            # 共 15 张，task-17 真图替换
```

### 4 阶段 commit（升级版）

| 阶段        | 内容                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage 1** | 数据层（types 六层 / cryptopanic mock-hybrid-live / failureCooler / projection / 派别 Registry / 4 级 severity / pacing / emotion mapping / rivalry）          |
| **Stage 2** | LLM Prompt（A/B/C + R4 加场 + anti-mechanical 后处理 + 翻译 + 派别 IP 文档载入）                                                                               |
| **Stage 3** | UI 组件（NewsDebateCard / Utterance / RoundBanner / MiniChart / FinalStrategy / Mini Cards / Banner / Ticker / Modal / SidebarTab / RivalryChip / ShareModal） |
| **Stage 4** | 复盘 cron + rivalry 计算 + replay tab + 分享 PNG (`/api/og/debate/[id]`) + ADR 0003-0006 + vercel.json + observability JSONL                                   |

PR target 不变：`feature/act1-5-watch-page-01`。

---

## 23. 派别可扩展架构（Faction Registry）

> Dan directive："派别可以有多个，目前三个只是基础三个"。系统设计必须支持加新派别**不改代码**——配置数据驱动。

### 23.1 当前 3 派 + 未来扩展路线

**当前 3 派（MVP，技术分析维度）**：

- 老 K · 破位猎手（突破派）
- 老白 · 趋势守正（趋势派）
- 老 G · 极端猎手（回归派）

3 派同维度差异化（都看价格图），互怼空间在"判断时机"。**长期单一维度太薄**，需要跨维度派别加入。

**Phase 2 候选派别（task-18+ 加入）**：

| 派别提案              | 维度     | 性格设定                 | 触发数据源                         |
| --------------------- | -------- | ------------------------ | ---------------------------------- |
| **老宏 · 宏观大师**   | 宏观经济 | 端正 / 学究气 / 引经据典 | Fed / 监管 / 流动性新闻            |
| **老链 · 链上猎人**   | 链上数据 | 神秘 / 阴谋论 / 数据派   | Whale Alert / 大额转账 / 巨鲸地址  |
| **老情 · 情绪赌徒**   | 市场情绪 | 浮夸 / 情绪化 / 跟风嘲讽 | Fear & Greed / 社交媒体 / KOL 热度 |
| **老空 · 永远的空头** | 反市场   | 阴沉 / 末日论 / 总看跌   | 综合（永远找看空理由）             |

**多派别戏剧效果**：3 → 6 派后辩论复杂度 + 派别联盟 / 站队动态。

### 23.2 Faction Registry 架构

```ts
// src/lib/factionRegistry.ts 新建
export type FactionConfig = {
  id: string;                       // 'alpha' | 'beta' | 'gamma' | 'macro' | 'onchain' | ...
  status: 'active' | 'beta' | 'planned';
  nickname: I18nString;             // {zh_CN: "老 K", en_US: "K the Hunter", ...}
  fullName: I18nString;
  handle: string;                   // @laoK_breakout
  color: string;                    // accent 派别色（hex）
  avatarPath: string;               // /images/agents/{id}/
  ipDocPath: string;                // docs/agent-ip/{id}.md（深度调教文档）
  signalMatchTypes: SignalType[];   // 哪类技术信号触发该派别（如 alpha 匹配 NEAR_HIGH/BREAKOUT）
  newsKeywords: string[];           // 哪类新闻关键词触发该派别（如 macro 匹配 Fed/inflation）
  decisionStyle: {
    aggressiveness: 1-5;             // 入场激进度
    holdingPeriod: 'short' | 'mid' | 'long';
    stopLossWidth: 'tight' | 'normal' | 'wide';
  };
  rivalIds: string[];               // 主要宿敌（用于 R2 优先 cite）
  allyIds: string[];                // 偶尔联盟（用于"两派联手攻击第三派"剧本）
};

export const FACTION_REGISTRY: Record<string, FactionConfig> = {
  alpha:  { id: 'alpha',  status: 'active', /* ... */ rivalIds: ['gamma'], allyIds: ['beta'] },
  beta:   { id: 'beta',   status: 'active', /* ... */ rivalIds: ['alpha'], allyIds: ['gamma'] },
  gamma:  { id: 'gamma',  status: 'active', /* ... */ rivalIds: ['alpha'], allyIds: ['beta'] },
  // 未来扩展
  macro:  { id: 'macro',  status: 'planned', /* ... */ },
  onchain:{ id: 'onchain',status: 'planned', /* ... */ },
};

export function getActiveFactions(): FactionConfig[] {
  return Object.values(FACTION_REGISTRY).filter(f => f.status === 'active');
}
```

### 23.3 调用代码全部走 Registry

任何派别相关代码（debateOrchestrator / agentSpeechGuard / UtteranceBubble / mini card）**绝对不允许 hardcode 'alpha'/'beta'/'gamma'**，全部用 `getActiveFactions()` 遍历。

加新派别只需：

1. 在 FACTION_REGISTRY 加一条配置
2. 写 `docs/agent-ip/{newId}.md` 深度文档
3. 准备 5 张情绪头像 PNG
4. status: 'planned' → 'beta' → 'active' 三阶段灰度
5. 不改任何核心代码

### 23.4 R2 cite 顺序：宿敌优先

R2 LLM Prompt 选择 cite 谁时，按 `rivalIds` 优先级：

- 如果 `rivalIds` 派别 R1 内容存在 → 优先 cite 宿敌
- 否则随机选一派
- `allyIds` 派别**永远不 cite**（联盟内不互怼）

这让"宿敌剧本"自动生效，无需 hardcode。

### 23.5 派别上限（避免辩论过长）

单场辩论参与派别 ≤ 4 个（防止 LLM 调用爆炸）：

```ts
// debateOrchestrator.ts
function selectParticipatingFactions(news: NewsItem): FactionConfig[] {
  const allActive = getActiveFactions();
  if (allActive.length <= 4) return allActive;

  // 按相关度排序：技术信号匹配 + 新闻关键词匹配 + 历史宿敌
  const scored = allActive.map((f) => ({ f, score: relevanceScore(f, news) }));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.f);
}
```

未来 6 派激活时，每场辩论选最相关的 3-4 派出场。

---

## 24. 3 派深度调教（IP 立体化）

> Dan directive："基础三个，都还需要深度调教"。当前 5 条招牌话术 + 性格描述太薄。每派单独一份 IP 文档，从 6 个维度深化。

### 24.1 每派 IP 独立文档

新建 `docs/agent-ip/老K.md` / `老白.md` / `老G.md`，每份按统一模板：

```markdown
# 老 K · 破位猎手

## 1. 角色档案

- **真名 / 别号**：K（Kevin？Killer？— 让用户猜）
- **派别**：突破派 · 关键位猎手
- **江湖地位**：3 年前在 BTC $45K → $69K 那波突破吃饱，立派
- **性格**：激进 / 冲动 / 爱晒成绩 / 嘴硬不认错
- **死穴**：假突破多，止损经常被打
- **得意笑点**：连续抓住几个真突破时

## 2. 派别口诀（10 条招牌话术，分场景）

### 通用招牌（5 条）

1. "破位才是真信号，盘整就是装死"
2. "不破不立，不立不破"
3. "破！破！破了再说！"
4. "等你看清的时候已经吃饱了"
5. "我这一把上次 +12%，懂的都懂"

### 场景化（5 条）

6. **[新闻看涨时]**："消息出来不破前高就是诱多，破了就是真起飞"
7. **[新闻看跌时]**："破不破前低，你看 K 线，不看新闻"
8. **[盘整阶段]**："这种行情就是盘整磨人，磨完就是大行情"
9. **[被打脸时（罕见）]**："假突破而已，止损扛得住，真行情还在后面"
10. **[连胜时]**："我说什么来着？破位就是钱"

## 3. 互动模板（对其他派别）

### vs 老白（最大宿敌）

- 标志互怼："你这套'等趋势确认'去年错 8 次，韭菜专用"
- 阴阳："老白还在等他的趋势，等吧，等到 +50% 你就追了"
- 罕见认同（强趋势确认时）："这次老白说的对，趋势没破"

### vs 老 G（次要对手）

- 标志互怼："极端论我服，但你抄底抄了几次得了？飞刀大队长？"
- 阴阳："老 G 又准备接盘侠了"
- 罕见认同（极端反弹后）："这次老 G 赌对了，但下次未必"

### 联盟（极少）

- vs 老白联手嘲笑老 G 抄底失败时

## 4. 情绪曲线

| 状态          | 触发                | LLM Prompt 注入                         |
| ------------- | ------------------- | --------------------------------------- |
| dominant 👑   | 连胜 5+ 场          | "你最近大杀四方，可以更狂妄"            |
| confident 😎  | 近期胜率 ≥ 60%      | "保持自信但不要过头"                    |
| neutral 😐    | 默认                | （无）                                  |
| humiliated 😔 | 被同一宿敌连败 3 场 | "你最近被 [宿敌] 打败 3 次，这次不能输" |
| desperate 😤  | 近期胜率 ≤ 30%      | "你最近背得很，但派别招牌不能丢"        |

## 5. 决策风格

- **入场激进度**：5/5（满）
- **常用入场**：突破前高 + 5min K 线确认 + 放量
- **常用止损**：前一根 K 线低点（**紧**止损）
- **常用止盈**：前高再 +1.5% / 一旦回撤超过 0.8% 就止盈
- **持仓时长**：短（数小时-1 天）
- **不会做的事**：长线持有 / 抄底 / 横盘加仓

## 6. 角色发展弧线（未来彩蛋）

- 第 1 阶段（当前）：纯破位猎手，不认错
- 第 2 阶段（连续被打脸 10 场后）：偶尔承认假突破存在，开始用 1.5x 止损
- 第 3 阶段（半年后）：会偶尔看趋势辅助，但本质仍是破位派
```

老白 / 老 G 同样写一份。**Codex 实施时**：写好 3 份 IP 文档；LLM Prompt 启动时 `loadIpDoc(agentId)` 把全文作为 persona context 注入（按 prompt token budget 压缩到关键信息）。

### 24.2 IP 文档 vs FACTION_REGISTRY 关系

- `factionRegistry.ts`：**结构化配置**（id / color / decisionStyle / rivalIds 等）—— 给代码用
- `docs/agent-ip/{id}.md`：**叙事化 IP**（背景故事 / 招牌话术 / 互动模板 / 情绪曲线）—— 给 LLM Prompt 用

两者解耦：改 IP 文档不动代码；改代码逻辑不动 IP。

### 24.3 LLM Prompt 注入派别 IP 段

```ts
// src/lib/llmPromptBuilder.ts
import { readFileSync } from "fs";
import path from "path";

const ipDocCache = new Map<string, string>();

export function loadAgentIp(agentId: string): string {
  if (ipDocCache.has(agentId)) return ipDocCache.get(agentId)!;

  const filePath = path.join(process.cwd(), "docs", "agent-ip", `${agentId}.md`);
  const content = readFileSync(filePath, "utf-8");
  // 压缩：只取 § 1 角色档案 + § 2 招牌话术 + § 3 互动模板 + 当前情绪段
  const compressed = extractIpSections(content, ["1", "2", "3", "4"]);

  ipDocCache.set(agentId, compressed);
  return compressed;
}

// LLM Prompt R1 / R2 / R3 都用这个 ip 段做 persona block
const personaBlock = loadAgentIp(agentId);
const fullPrompt = `
${personaBlock}

[当前情绪状态]
你目前是 ${currentEmotion}。${EMOTION_PROMPT_HINT[currentEmotion]}

[本场辩论上下文]
${debateContext}

[本轮任务]
${roundTaskPrompt}
`;
```

### 24.4 深度调教验证机制

每个派别 IP 文档落地后，跑**派别人格自检脚本**：

```sh
npm run verify:agent-ip
```

输出：

```
✅ 老 K：
  - 招牌话术 10 条（5 通用 + 5 场景化）
  - 宿敌互怼模板 vs 老白 / 老 G 各 ≥ 3 条
  - 5 种情绪 prompt 注入
  - 决策风格 6 项参数齐
✅ 老白：...
✅ 老 G：...
```

未来加新派别 → 同样流程跑 verify。

### 24.5 Dan 调教流程

3 派深度调教是**持续工作**，不是一次性。流程：

1. **F 落 IP 模板**（本 spec § 24.1） + 提交 PR
2. **Dan 通读 IP 文档**：根据感觉调"性格 / 招牌话术 / 互动模板"
3. **Dan 提交直接 edit `docs/agent-ip/{id}.md`**（轻改不需要走 ADR，每次 commit 单 PR）
4. **Codex 跑 verify:agent-ip 自检** + LLM 重新载入
5. **F 评审样本**：跑 5 场辩论看 IP 是否准确体现

### 24.6 派别"代言人"用户系统（极远期）

某天用户量大了，可加 "派别代言人" 系统：

- 每派招募 1 个真人 KOL 当"派别代言人"
- 该派 IP 文档由代言人 + AI 联合维护
- 用户可"加入派系" → UI 显示派系徽章 → 主页跟单优先该派

仅占位思路，**task-15 不做**。

---

## 25. 增长闭环图（用户体验视角总览）

把 task-15 所有元素串成完整体验链：

```
🌱 用户首次访问 watch 页
  │
  ▼
🎙 看到 LIVE 辩论（主舞台）+ 重大新闻插播条
  │
  ▼
🤔 被派别 IP 戏剧化吸引（老 K 怒怼老白）
  │
  ▼
🏆 看 win-rate 信任锚（老 K 本周 7 战 4 胜）
  │
  ▼
📊 看复盘 tab（"AI 上次说对了 +3.2%"）
  │
  ▼
🎯 看策略卡（共识 2:1 + 跟单数 287）
  │
  ▼
⏱ 倒计时焦虑（28 分钟后失效）
  │
  ▼
🚀 一键深链跟单（跳 CoinW）→ PostHog strategy_follow_click
  │
  ▼
📤 看到金句 → 分享 PNG → 朋友扫码回流（增长闭环）
  │
  ▼
🥊 看到宿敌战绩（老 K vs 老 G 12:8）→ 关注下场
  │
  ▼
📬 24h 后复盘推送（"老 K 上次说对了"）→ 用户回访
  │
  ▼ （循环）
```

**每个箭头都是一次 PostHog 事件**——可量化漏斗，可优化。

---

_维护者: F_
_创建: 2026-04-30_
_执行者: Codex（3 阶段 commit）_
_基于：task-12 v2 stream redesign + task-13 daily brief + task-14 P0 工程化基线_
_分支: feature/news-debate-mode-01_
_PR target: feature/act1-5-watch-page-01（不变）_
_独立: 不依赖 task-14 P1/P2_
