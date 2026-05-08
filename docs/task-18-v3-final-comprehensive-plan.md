# task-18 v3.final — 完整方案稿（Claude × Codex 副审用）

> **目的**：v3 / v3.1 / v3.2 反复 patch 暴露出 spec 不够细 → 反复返工。本文档是**整合 + 深化**所有维度的完整方案稿，目标"一次性出齐"，不再 patch。
>
> **流程**：
>
> 1. Claude 主笔本稿（v3.final）— 现在
> 2. Codex 独立副审 → 输出反审意见到 `docs/codex-specs/task-18-v3-final-review.md`
> 3. Dan 仲裁分歧 + 拍板
> 4. Claude 整合反审 → 出 v3.final.locked spec
> 5. Codex 一次性实施修复
>
> **不分阶段**：本稿覆盖 15 个维度，全部一次性实施，不再"先 P1 后 P2"。
>
> **作者**：F (Claude)
> **创建**：2026-05-06
> **副审**：Codex（独立看，不直接 edit 本稿，反审意见独立文件）
> **批准**：Dan

---

## 0. v3.final 范围

涵盖 **15 个产品体验维度** D1-D15。每个维度都有：

- 问题描述
- 修订方案
- 实施细节（代码 / Prompt / UI）
- grep 验证规则
- 验收点

D1-D6 来自 v3.x 已规划 patch（深化 + 整合）；D7-D15 是 v3 落地后暴露的新维度。

---

## 1. D1 — UI 静态文案人性化（v3.2 P1 深化）

### 1.1 全 grep 禁词清单

`src/modules/agent-watch/components/` 内**所有 .tsx 文件 + i18n 10 语 dict**强校验：

```
grep -rEn '在线|刚上线|刚刚|已上线|已加入|已就绪|登录|connect' src/modules/agent-watch/
grep -rEn '在线|刚上线|刚刚|已上线|已加入|已就绪' src/i18n/dicts/
```

**期望命中数 = 0**。

### 1.2 FactionPresenceBar 文案规则

代码模板（精确）：

```tsx
function getFactionStatusText(
  agentId: AgentId,
  lastMsg: ChatMessage | null,
  currentFocus: string | null,
  ticker: TickerSnapshot,
): string {
  const nickname = getNickname(agentId);

  // 优先级 1：刚说完话 (< 60s)
  if (lastMsg && Date.now() - lastMsg.ts < 60_000) {
    return `${nickname} 刚说完话`;
  }

  // 优先级 2：正在 typing
  if (typingState.has(agentId)) {
    return `${nickname} 正在思考`;
  }

  // 优先级 3：有 currentFocus → 派别专属动词
  if (currentFocus) {
    const focusVerbs = {
      alpha: "盯", // 老 K 盯 BTC 5min
      beta: "看", // 老白 看 ETH 趋势
      gamma: "算", // 老 G 算 SOL 极端值
    };
    return `${nickname} ${focusVerbs[agentId]} ${currentFocus}`;
  }

  // 优先级 4：默认（无焦点）— 派别独白动词 + 行情自然描述
  const idleVerbs = {
    alpha: "在等关键位",
    beta: "在看趋势线",
    gamma: "在算波动率",
  };
  return `${nickname} ${idleVerbs[agentId]}`;
}
```

### 1.3 SeedChip 文案

```tsx
function getSeedDescription(seed: ConversationSeed): string {
  switch (seed.kind) {
    case "news":
      return `🔥 ${seed.newsTitle}`; // 不要"事件触发：" 前缀
    case "price_move":
      return `📊 ${seed.symbol} ${seed.changeStr}`; // 不要"信号触发："
    case "replay_review":
      return `📈 ${getNickname(seed.agentId)} 上次说对了`;
    case "history_recall":
      return `🕰 ${seed.daysAgo} 天前的 ${seed.theme}`;
    case "agent_query":
      return `💬 ${getNickname(seed.questionerAgentId)} 问 ${getNickname(seed.targetAgentId)}`;
    case "silence_chitchat":
      return `🌙 ${seed.symbol} 静悄悄`;
  }
}
```

### 1.4 InsufficientConsensus 文案

```tsx
function InsufficientConsensus({ thread, ticker }: Props) {
  const opinions = summarizeOpinions(thread); // 3 派各自的简短判断
  return (
    <div className="...">
      <h3>📌 这场没共识</h3>
      <p>{getRandomLeadingPhrase()}</p>
      {/* "老 K 没把握" / "现在没清晰策略" / "3 派吵起来了" 随机一句 */}
      <ul>
        <li>老 K：{opinions.alpha}</li>
        <li>老白：{opinions.beta}</li>
        <li>老 G：{opinions.gamma}</li>
      </ul>
      <p>看上面讨论自己判断，或者等下一波。</p>
    </div>
  );
}

const LEADING_PHRASES = [
  "老 K 没把握，老白说不准，老 G 也犹豫",
  "现在没清晰策略，3 派各执一词",
  "吵半天没共识，看个体判断",
  "数据不够清晰，3 派分歧大",
  "今天这局太混乱，谁说都没底",
];
```

### 1.5 验收

- [ ] grep `在线|刚上线|刚刚|已上线|已加入|已就绪|登录|connect` in `src/modules/agent-watch/` + `src/i18n/dicts/` = 0
- [ ] FactionPresenceBar 显示 4 优先级动态文案（typing / 刚说话 / 焦点 / 默认）
- [ ] SeedChip 6 种 seed kind 都有 emoji + 自然描述（无"事件触发"/"信号触发"）
- [ ] InsufficientConsensus 含 3 派意见摘要 + 随机 leading phrase（不是固定模板）

---

## 2. D2 — LLM 输出禁词正则（v3.1 R1 + v3.2 P2 整合）

### 2.1 完整 FORBIDDEN_PREFIX_PATTERNS（10 类）

```ts
// src/lib/llmFallbackChain.ts 或 src/lib/news/normalizer.ts
export const FORBIDDEN_PREFIX_PATTERNS = [
  // 1. 派别名 + 冒号
  /^(Alpha|Beta|Gamma|老\s?K|老\s?白|老\s?G)[:：]/i,

  // 2. 派别动作词 + 冒号
  /^(突破|破位|趋势|极端|回归|反转|顺势|逆势|追涨|杀跌|盘整|横盘)[:：]/,

  // 3. 派别名词 + 冒号
  /^(突破派|趋势派|回归派|破位派|极端派)[:：]/,

  // 4. 派别名 + 动作 + 冒号
  /^(Alpha|Beta|Gamma|老\s?K|老\s?白|老\s?G)\s*(说|看|认为|分析|视角|观察|复核|提点|怒怼|阴阳|追问|反驳|附议|嘲讽)[:：]/i,

  // 5. "X 视角" / "X 派认为"
  /(突破|趋势|回归|破位|极端|反转)视角[:：]/,
  /(突破派|趋势派|回归派)认为[:：]/,

  // 6. 列举式
  /^(首先|其次|再次|然后|最后|总之|综上)[，,：:]/,

  // 7. 报告式开头
  /^(等待条件|市场摘要|本次摘要|当前判断|核心观点|结论|总结|风险提示)[:：]/,

  // 8. 技术状态词
  /^(实时上下文|上下文|刷新|下一跳|信号触发|事件触发|队列|推送|钩子|回调)[:：]/,

  // 9. 评估前缀
  /^(评估|判断|看法|观点|意见)[:：]/,

  // 10. 技术指标前置（要求融入文字，不允许做开头）
  /^(EMA12\/13|EMA12|EMA13|MACD|RSI|布林|K\s?线)[:：]/,
];
```

### 2.2 sanitize 兜底函数（retry 失败仍违规时强制清洗）

```ts
function stripForbiddenPrefix(content: string): string {
  let cleaned = content.trim();
  for (const re of FORBIDDEN_PREFIX_PATTERNS) {
    cleaned = cleaned.replace(re, "").trim();
  }
  // 二次清洗：删除开头的"操，"/"我看"等如果出现在 sanitize 后（避免"破位：操，"被 strip 后变"操，"重叠）
  return cleaned;
}
```

### 2.3 Validator 函数

```ts
function validateLlmOutput(content: string): { ok: boolean; reason?: string } {
  // 1. 禁词前缀
  for (const re of FORBIDDEN_PREFIX_PATTERNS) {
    if (re.test(content.trim())) {
      return { ok: false, reason: `forbidden_prefix: ${re.source}` };
    }
  }

  // 2. 必含具体数字（D2 既有规则）
  if (!/\d+\.?\d*/.test(content)) {
    return { ok: false, reason: "no_concrete_number" };
  }

  // 3. 必含"所以 X"结论锚（包括方向词约束，见 D6）
  if (!hasConclusionAnchor(content)) {
    return { ok: false, reason: "no_conclusion_anchor" };
  }

  // 4. 方向硬约束（D6）
  if (hasAmbiguousAction(content)) {
    return { ok: false, reason: "ambiguous_action_direction" };
  }

  return { ok: true };
}
```

### 2.4 验收

- [ ] FORBIDDEN_PREFIX_PATTERNS 至少 10 类正则
- [ ] sanitize 兜底函数实现且接入 retry 流程
- [ ] grep 最近 100 条 LLM 输出：上面 10 类前缀**全 0 命中**
- [ ] dev mode 模拟 LLM 输出"破位：BTC..." → 触发 retry → 仍违规 → sanitize 清洗

---

## 3. D3 — 技术 message 自然话（v3.2 P3 深化）

### 3.1 ticker 失败 fallback 模板（5 种轮换）

```ts
const TICKER_FAIL_PHRASES_BY_AGENT: Record<AgentId, string[]> = {
  alpha: [
    "操，BTC 数据没到，等 30 秒",
    "行情卡住了，先停一下",
    "现在拉不到价格，等会儿",
    "数据慢得离谱，看下一跳",
    "服务器抽风了，等 1 分钟再说",
  ],
  beta: [
    "数据还没到，先观察",
    "BTC 价格延迟了，等等",
    "现在拉不到，等数据稳定",
    "行情接口慢，过会儿看",
    "等下一跳价格再判断",
  ],
  gamma: [
    "哼，数据都拉不到，急啥",
    "行情没到，白等了",
    "数据延迟，看着吧",
    "老 K 急啥，等数据",
    "没价格说啥都没用",
  ],
};

// 触发：ticker fetch 失败时
function buildTickerFailFallback(agentId: AgentId): string {
  const pool = TICKER_FAIL_PHRASES_BY_AGENT[agentId];
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### 3.2 LLM Prompt 模板（ticker 拉不到时）

```
[本次任务]
你是 ${nickname}。BTC ticker 数据拉取失败，你需要输出"我在等数据"的自然口语。

[硬约束]
- 1 句话 ≤ 30 字
- 禁用词：实时上下文 / 上下文 / 刷新 / 下一跳 / 信号 / 触发 / 事件 / 队列 / 数据未通过 / 校验失败 / API
- 用：等数据 / 等会儿 / 现在拉不到 / 数据没到 / 行情卡住了
- 派别口吻保持（${persona_summary}）

[5 个反例]
${TICKER_FAIL_PHRASES_BY_AGENT[agentId].map(p => `✅ "${p}"`).join('\n')}

❌ "实时上下文还在刷新，所以先等下一跳价格再判断"
❌ "等待信号触发"
❌ "数据未通过校验"
```

### 3.3 InsufficientConsensus 文案规则

见 D1.4。**关键**：每场显示 3 派**当场**意见摘要（不是固定模板），random leading phrase 5 选 1。

### 3.4 验收

- [ ] ticker 失败时 LLM 输出**派别 IP 一致**且**自然话**（grep 5 反例对照）
- [ ] InsufficientConsensus 渲染时 3 派意见摘要**真实从当场聊天提取**（不是 hardcode）
- [ ] LEADING_PHRASES 至少 5 句轮换
- [ ] grep "实时上下文" / "未通过校验" / "信号触发" / "数据延迟" 等 dev 词 = 0

---

## 4. D4 — i18n 10 语同步翻译

```bash
# 验证脚本
grep -rEn '在线|刚上线|刚刚|已上线|实时上下文|信号触发|事件触发|暂不输出策略|未通过校验|数据延迟' src/i18n/dicts/
```

每条命中按 D1/D2/D3 规则翻译。zh_CN / zh_TW 主翻；en_US 翻译；其他 7 语 fallback en_US（task-15 已有策略）。

### 4.1 验收

- [ ] grep 上面命中 = 0
- [ ] 10 语 dict 都通过 typecheck（任何 key 缺失会 TS 报错）

---

## 5. D5 — 链式互动启动（v3.1 R3 深化）

### 5.1 三层强制 hook 启动链

```ts
const FORCE_EXPECTS_REPLY_TURNS = 4; // 前 4 条强制 expectsReply=true
const FORCE_MENTION_TURN_RANGE = [2, 6]; // 第 2-6 条 70% 强制选 mention 类动作
const FORCE_MENTION_PROBABILITY = 0.7;
const MIN_TOTAL_MESSAGES = 6; // 自然结束前的最小条数
const QUIET_STREAK_FOR_END = 5; // 连续 5 条 expectsReply=false 才结束
const MAX_TOTAL_MESSAGES = 20; // 上限
const MAX_RETRY_COUNT_PER_THREAD = 5; // 累计 retry 上限

function applyEarlyPhaseConstraints(msg: ChatMessage, history: ChatMessage[]): ChatMessage {
  const idx = history.length;

  // 强制 expectsReply
  if (idx < FORCE_EXPECTS_REPLY_TURNS) {
    msg.expectsReply = true;
  }

  // 强制 mention（第 2-6 条且非首条 70% 概率）
  const inMentionRange = idx >= FORCE_MENTION_TURN_RANGE[0] && idx <= FORCE_MENTION_TURN_RANGE[1];
  if (inMentionRange && Math.random() < FORCE_MENTION_PROBABILITY) {
    if (!msg.mentioning) {
      // 强制 @ 上一条 message 的 agentId
      msg.mentioning = history[history.length - 1]?.agentId;
    }
  }

  return msg;
}
```

### 5.2 mentioning + citedQuote 联动校验

```ts
function validateChainConstraints(
  msg: ChatMessage,
  history: ChatMessage[],
): { ok: boolean; reason?: string } {
  // 如果 mentioning 非空 → citedQuote 必须非空且 ≥ 5 字
  if (msg.mentioning && (!msg.citedQuote || msg.citedQuote.length < 5)) {
    return { ok: false, reason: "mention_without_quote" };
  }

  // citedQuote 必须真的来自被 @ 派别的某条 message
  if (msg.citedQuote && msg.mentioning) {
    const mentionedMessages = history.filter((m) => m.agentId === msg.mentioning);
    const found = mentionedMessages.some((m) => m.content.includes(msg.citedQuote!.slice(0, 10)));
    if (!found) {
      return { ok: false, reason: "cited_quote_not_in_history" };
    }
  }

  // mentioning 不能 @ 自己
  if (msg.mentioning === msg.agentId) {
    return { ok: false, reason: "self_mention" };
  }

  return { ok: true };
}
```

### 5.3 LLM Prompt 强制 cite 模板

```
[本次任务]
你是 ${nickname}（${agentId}）。
你的动作 = ${action}（${ACTION_DESCRIPTIONS[action]}）

[最近 5 条聊天]
${history.slice(-5).map((m, i) => `[${i+1}] ${getNickname(m.agentId)}: ${m.content}`).join('\n')}

${msg.mentioning ? `
[必须 @ 的派别]
你必须 @ ${getNickname(msg.mentioning)}。在 citedQuote 字段填出对方某句的原话（≤ 30 字）。
content 必须呼应 citedQuote — 不能完全跑题。
` : ''}

[硬约束]
- mentioning 字段：${msg.mentioning ? `"${msg.mentioning}"（已固定）` : '可空可选，只在你显式 @ 时填'}
- citedQuote：${msg.mentioning ? '必填 ≥ 5 字' : '可空'}
- content 1-2 句 ≤ 80 字
- 必含具体数字
- "所以 X" 结论锚（含方向词，见 D6）
```

### 5.4 验收

- [ ] dev mode 跑 10 场 thread：每场 ≥ 6 条 message
- [ ] 每场前 4 条 100% expectsReply=true
- [ ] 每场前 6 条至少 ≥ 2 条 mentioning ≠ null
- [ ] 所有 mentioning ≠ null 的 message 都有 citedQuote ≥ 5 字
- [ ] citedQuote 验证通过（来自被 @ 派别历史 message）

---

## 6. D6 — 方向硬约束（v3.1 R2 深化）

### 6.1 方向词 + 动作词正则

```ts
const ACTION_WORDS_REGEX =
  /(再\s*)?(追|跟|做|动手|干|上车|入场|建仓|加仓|减仓|清仓|抄|砸)(?!\s*(多|空|等|不动|盘))/g;
const ALLOWED_DIRECTIONS = ["多", "空", "等", "不动", "盘"];

function hasAmbiguousAction(content: string): { ambiguous: boolean; offending?: string } {
  const matches = content.matchAll(ACTION_WORDS_REGEX);
  for (const match of matches) {
    return { ambiguous: true, offending: match[0] };
  }
  return { ambiguous: false };
}
```

### 6.2 LLM Prompt 强方向反例

```
[方向硬约束]

❌ "再追"        → 追多还是追空？
❌ "再动手"      → 干啥？
❌ "再干"        → 多还是空？
❌ "再上车"      → 上多还是上空？
❌ "破位就动手"  → 动什么？

✅ "破 80,700 跟空，止损 81,000，止盈 80,200"
✅ "站稳 82,752 追多，目标 83,500"
✅ "现在不动，等回踩 80,500"
✅ "守住 81,500 看多盘"

含"追/做/动手/干/上车/入场/建仓"等动作词时，必须紧跟"多/空/等/不动/盘"。
不带方向 = 用户读不懂 = 你输出无效。
```

### 6.3 strategy 卡 UI 方向 chip

```tsx
const DIRECTION_CHIP = {
  long: { color: "text-emerald-400", icon: "🟢", label: "多头" },
  short: { color: "text-rose-400", icon: "🔴", label: "空头" },
  wait: { color: "text-amber-400", icon: "⚪", label: "等待" },
};

<div className={`text-2xl font-bold ${DIRECTION_CHIP[strategy.direction].color}`}>
  {DIRECTION_CHIP[strategy.direction].icon} {DIRECTION_CHIP[strategy.direction].label} ·{" "}
  {strategy.symbol}
</div>;
```

### 6.4 验收

- [ ] grep ACTION_WORDS_REGEX 在最近 100 条 message 中 = 0 命中
- [ ] strategy 卡顶部明确方向 chip（多/空/等 三色 + emoji）
- [ ] dev mode 模拟 LLM 输出"再追" → 触发 retry → 仍违规 Agent 沉默

---

## 7. D7 — 内容戏剧化（真聊天的灵魂）— **新增维度**

### 7.1 派别专属 few-shot（每派 5+ 条理想发言）

```ts
// src/lib/agentDialogueExamples.ts 新建
export const AGENT_DIALOGUE_FEW_SHOTS: Record<AgentId, string[]> = {
  alpha: [
    "操，BTC 这破位简直假得离谱，5min 放量但价格才 80,946，再观察 30 秒",
    "破 81,500 我跟多，止损 81,200。你们要等趋势确认就慢慢等",
    "老白又开始扯趋势了，去年这时候你说看多被打脸 3 次，记得吗？",
    "等 EMA 共振？等到花儿都谢了。我盯放量，破位就追多",
    "@老 G 你又在等极端值，BTC 现价 81,665 你想等到 70k 是吧？",
  ],
  beta: [
    "BTC 趋势没坏，80,500 是关键支撑，回撤都是机会",
    "EMA12/13 还没共振，先看不动手，仓位别加",
    "@老 K 你这破位玩了多少次假突破了，止损单都被打成筛子",
    "稳一点，BTC 没站稳 81,500 我不追多。别急",
    "老 G 极端值再不来，你就要踏空了。等也是有成本的",
  ],
  gamma: [
    "BTC 现价 81,665 离 24h 高点才 0.3%，急啥，等失速",
    "@老 K 你又准备山顶下蛋？1.8% 涨幅 5min 拉的，这种我反手砸空",
    "极端涨速 = 顶部信号。所以等失速做空，破 80,500 跟空",
    "老白稳是稳，可是稳到趋势都走完了。我要的是反转点",
    "BTC 这位置不上不下，5min 都磨 20 分钟了。所以等 81,500 假突破做空",
  ],
};
```

### 7.2 派别签名词 grep 验证

每派 LLM 输出**应该出现**的签名词：

```ts
const FACTION_SIGNATURE_WORDS: Record<AgentId, string[]> = {
  alpha: ["破", "追", "操", "冲", "5min", "关键位", "放量", "破位"],
  beta: ["等", "看", "稳", "趋势", "EMA", "回撤", "共振", "别"],
  gamma: ["极端", "失速", "反转", "砸", "空", "假", "顶", "哼"],
};

// 每条 message 至少含 1 个签名词
function hasSignature(content: string, agentId: AgentId): boolean {
  return FACTION_SIGNATURE_WORDS[agentId].some((w) => content.includes(w));
}
```

不含签名词 → retry。

### 7.3 黑话 / 口语词鼓励

LLM Prompt 加：

```
[允许 + 鼓励的黑话 / 口语]
✅ 操 / 妈的 / 草 / 卧槽 / 蛇精病（情绪表达）
✅ 韭菜 / 接飞刀 / 抄底 / 梭哈 / 上车 / 下车 / 山顶下蛋（币圈黑话）
✅ 等死人 / 急啥 / 服了 / 离谱 / 真服了（吐槽）
✅ 难得 / 这次老 X 说对了（认同时的反差）

[禁]
❌ 脏话攻击（傻逼 / 滚 / 死 等）
❌ 政治 / 宗教 / 性话题
❌ 涉及具体真人（不能 @ 真实 KOL）
```

### 7.4 验收

- [ ] LLM 输出 100 条样本：每派签名词命中率 ≥ 80%
- [ ] LLM Prompt 含 5 条/派 few-shot
- [ ] grep 黑话词出现率 ≥ 30%（每 10 条至少 3 条带黑话或情绪词）
- [ ] grep 脏话攻击词命中 = 0

---

## 8. D8 — 节奏感（typing 时长按 ChatAction 变化）— **新增维度**

### 8.1 typing 时长公式

```ts
const TYPING_DURATION_BY_ACTION: Record<ChatAction, [number, number]> = {
  // [min ms, max ms]
  open: [800, 1500], // 开场，中等速度
  rebut: [1500, 3000], // 反驳要思考
  agree: [400, 1000], // 附议快
  question: [1200, 2500], // 追问要琢磨
  taunt: [500, 1500], // 嘲讽快（脱口而出）
  derail: [600, 1200], // 跑题随性
  refocus: [1000, 2000], // 拉回要权衡
  comment: [800, 1800], // 自由评论中等
  react: [200, 600], // 短反应快（"草"/"卧槽"）
  concede: [2500, 4000], // 让步慢（情绪反转）
  gloat: [800, 1500], // 嘚瑟中速
};

function getTypingDuration(action: ChatAction): number {
  const [min, max] = TYPING_DURATION_BY_ACTION[action];
  return min + Math.random() * (max - min);
}
```

### 8.2 派别个性微调

```ts
const FACTION_TYPING_MULTIPLIER: Record<AgentId, number> = {
  alpha: 0.8, // 老 K 急性子，typing 短
  beta: 1.2, // 老白稳，typing 长
  gamma: 1.0, // 老 G 标准
};

function getFinalTypingDuration(action: ChatAction, agentId: AgentId): number {
  return getTypingDuration(action) * FACTION_TYPING_MULTIPLIER[agentId];
}
```

### 8.3 验收

- [ ] grep `TYPING_DURATION_BY_ACTION` 11 个 action 都有时长配置
- [ ] dev mode 验证：react 类 message typing < 800ms / concede 类 > 2000ms
- [ ] 派别 multiplier 生效：老 K typing 短 / 老白长

---

## 9. D9 — Visual Flow（聊天 UI 视觉细节）— **新增维度**

### 9.1 同派别连续合并气泡

```tsx
function ChatMessageBubble({ message, previousMessage }: Props) {
  const sameAgent = previousMessage?.agentId === message.agentId;
  const continueGap = sameAgent && message.ts - previousMessage.ts < 10_000; // 10s 内同派别 = 合并

  return (
    <div className={`flex gap-3 ${continueGap ? "mt-1" : "mt-4"}`}>
      {/* 头像：合并模式不显，独立模式显 */}
      {continueGap ? (
        <div className="w-10 shrink-0" /> // 占位空白
      ) : (
        <AgentAvatar agentId={message.agentId} className="h-10 w-10" />
      )}

      <div className="flex-1">
        {/* 头部信息：合并模式不显 */}
        {!continueGap && (
          <div className="mb-1 flex items-baseline gap-2">
            <span className={`font-semibold ${getFactionColor(message.agentId)}`}>
              {getNickname(message.agentId)}
            </span>
            <ActionBadge action={message.action} />
            <span className="font-mono text-xs text-white/40">{formatTime(message.ts)}</span>
            <span className="text-xs text-white/30">数据 {dataAgeLabel(message)} 前</span>
          </div>
        )}

        {/* replyTo 引用块 */}
        {message.replyTo && message.citedQuote && (
          <CiteIndicator citedQuote={message.citedQuote} mentionedAgent={message.mentioning} />
        )}

        {/* 主体气泡 */}
        <div className={`rounded-xl px-4 py-2.5 ${getFactionBg(message.agentId)}`}>
          <span>{renderMentionHighlights(message.content, message.mentioning)}</span>
        </div>
      </div>
    </div>
  );
}
```

### 9.2 mention 高亮渲染

```tsx
function renderMentionHighlights(content: string, mentioning: AgentId | null): JSX.Element {
  if (!mentioning) return <>{content}</>;
  const nickname = getNickname(mentioning);
  const parts = content.split(nickname);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className={`font-semibold ${getFactionColor(mentioning)}`}>@{nickname}</span>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}
```

### 9.3 cite 引用块视觉

```tsx
function CiteIndicator({ citedQuote, mentionedAgent }: Props) {
  return (
    <div className="mb-1 ml-2 border-l-2 border-white/[0.08] pl-3">
      <div className="text-xs text-white/40">
        ↘ {getNickname(mentionedAgent)}：{citedQuote}
      </div>
    </div>
  );
}
```

### 9.4 ActionBadge

```tsx
const ACTION_BADGES: Record<ChatAction, { icon: string; label: string; color: string }> = {
  rebut: { icon: "💥", label: "反驳", color: "text-rose-400" },
  agree: { icon: "🤝", label: "附议", color: "text-emerald-400" },
  question: { icon: "❓", label: "追问", color: "text-amber-400" },
  taunt: { icon: "😏", label: "阴阳", color: "text-violet-400" },
  concede: { icon: "😔", label: "让步", color: "text-blue-400" },
  gloat: { icon: "😎", label: "嘚瑟", color: "text-amber-400" },
  derail: { icon: "🤷", label: "跑题", color: "text-white/50" },
  refocus: { icon: "🎯", label: "拉回", color: "text-cyan-400" },
  comment: { icon: "", label: "", color: "" }, // 普通评论不显 badge
  react: { icon: "", label: "", color: "" }, // 短反应不显
  open: { icon: "🔥", label: "开场", color: "text-orange-400" },
};
```

### 9.5 验收

- [ ] 同派别 10s 内连续 message 不重复显头像
- [ ] 不同派别间距 mt-4 / 同派别合并间距 mt-1
- [ ] mention 派别名高亮显示（@老白 红色）
- [ ] replyTo 时显 ↘ 引用块（缩进 + 引用条 + 半透明）
- [ ] ActionBadge 9 种映射（rebut/agree/question/taunt/concede/gloat/derail/refocus/open）

---

## 10. D10 — 策略卡渐入时机 — **新增维度**

### 10.1 thread 结束 → strategy 渐入流程

```ts
async function finalizeThread(thread: ChatThread): Promise<void> {
  // 1. thread 标记为 completing
  thread.status = "completing";
  await persist(thread);

  // 2. 显示 "💭 老 K 总结中..." 占位（meta agent typing）
  showMetaTypingPlaceholder(thread.id);
  await sleep(1500); // 让用户注意到"在总结"

  // 3. 调 synthesizeStrategy
  thread.strategy = await synthesizeStrategy(thread.messages);

  // 4. 移除 typing placeholder
  hideMetaTypingPlaceholder(thread.id);

  // 5. fade-in 策略卡（200ms ease-out + scale 0.95→1）
  thread.status = "completed";
  await persist(thread);

  // 6. 自动滚动到策略卡
  scrollToElement(`strategy-${thread.id}`, { behavior: "smooth" });

  // 7. 高亮 1.5s（pulse 边框）
  highlightElement(`strategy-${thread.id}`, { duration: 1500 });
}
```

### 10.2 验收

- [ ] thread 结束前 1.5s 显示"💭 总结中..." typing
- [ ] strategy 卡 fade-in 200ms（不是突然 pop）
- [ ] 自动滚动到策略卡
- [ ] 1.5s pulse 边框高亮

---

## 11. D11 — 状态机视觉 — **新增维度**

### 11.1 thread 状态枚举

```ts
type ThreadStatus = "active" | "completing" | "completed";
```

### 11.2 视觉状态规则

```tsx
function ChatThreadRenderer({ thread }: { thread: ChatThread }) {
  return (
    <div className={`
      mb-8 transition-opacity duration-500
      ${thread.status === 'completed' ? 'opacity-80' : ''}
    `}>
      {/* SeedChip — thread 顶部一次显示 */}
      <SeedChip seed={thread.seed} status={thread.status} />

      {/* 链式 messages */}
      {thread.messages.map(msg => <ChatMessageBubble ... />)}

      {/* meta typing placeholder（仅 completing 状态） */}
      {thread.status === 'completing' && <MetaTypingPlaceholder />}

      {/* 策略卡 / InsufficientConsensus（仅 completed 状态） */}
      {thread.status === 'completed' && (
        thread.strategy ? <FinalStrategyBlock /> : <InsufficientConsensus />
      )}

      {/* 完成分隔线 */}
      {thread.status === 'completed' && (
        <div className="my-6 flex items-center gap-3 text-xs text-white/40">
          <span className="flex-1 border-t border-white/[0.06]" />
          <span>📌 这场聊完了</span>
          <span className="flex-1 border-t border-white/[0.06]" />
        </div>
      )}
    </div>
  );
}
```

### 11.3 下场预告 chip

如果有下一场（cron 已生成 / 用户主动触发）：

```tsx
{
  nextThreadPreview && (
    <div className="my-4 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-4 py-2 text-sm">
      🔥 下一场即将开始：{nextThreadPreview.seed}
    </div>
  );
}
```

### 11.4 验收

- [ ] thread.status 三状态各有视觉差异
- [ ] completing 状态显 meta typing placeholder
- [ ] completed 状态显策略卡 + 完成分隔线 + opacity 80%
- [ ] 下场预告 chip 在 thread 之间显示（如有）

---

## 12. D12 — 冷启动种子数据（首次部署兜底）— **新增维度**

### 12.1 种子数据 schema

```ts
// src/lib/seedChatThreads.ts 新建
export const SEED_CHAT_THREADS: ChatThread[] = [
  {
    id: "seed-001",
    seed: { kind: "news", newsTitle: "BTC ETF 流入创单日新高 $1.2B" },
    messages: [
      // 12-15 条高质量 message — 由 F 在 Dan 协助下手写
      // 包含 mention / cite / 各种 action / 黑话 / 情绪
    ],
    strategy: { direction: "long", symbol: "BTC" /* ... */ },
    status: "completed",
    createdAt: Date.now() - 86400_000 * 2, // 2 天前
    completedAt: Date.now() - 86400_000 * 2,
  },
  // 2 场更多 sample
];
```

### 12.2 加载逻辑

```ts
// src/lib/chatHistoryStore.ts
async function loadInitialThreads(): Promise<ChatThread[]> {
  const persisted = await loadPersistedThreads({ limit: 3 });
  if (persisted.length === 0) {
    return SEED_CHAT_THREADS; // 首次部署 / 数据库空时用 seed
  }
  return persisted;
}
```

### 12.3 内容标准

3 场 sample 必须涵盖：

- **场 1**：高共识（3:0 多头）+ strategy long
- **场 2**：分歧大（1:2）+ strategy 仍出 + dissentNote
- **场 3**：无共识 → InsufficientConsensus

每场必须含：

- ≥ 12 条 message
- ≥ 4 条带 mention + citedQuote
- ≥ 2 个金句（isGoldenLine=true）
- 至少 1 个跑题（derail）+ 拉回（refocus）
- 派别黑话 + 情绪词
- 真实价格数字

### 12.4 写作分工

- F (Claude) 起草 3 场 sample 草稿
- Dan 审 + 修改语气（让派别 IP 真"立"起来）
- Codex 实施时直接用 SEED_CHAT_THREADS 常量

### 12.5 验收

- [ ] SEED_CHAT_THREADS 至少 3 场，schema 完整
- [ ] 首次部署（fileCache 空）→ 用户进页面立刻看到 3 场 sample
- [ ] persisted 数据 ≥ 3 场后 → 不再用 seed（fallback 逻辑生效）

---

## 13. D13 — 长会话疲劳 — **新增维度**

### 13.1 折叠机制

thread `messages.length > 8` 时默认显前 6 条 + 折叠按钮：

```tsx
function ChatMessagesList({ messages }: Props) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_DEFAULT = 6;
  const showCollapse = messages.length > 8;

  const displayed = expanded || !showCollapse ? messages : messages.slice(0, VISIBLE_DEFAULT);
  const hidden = messages.length - displayed.length;

  return (
    <div>
      {displayed.map(msg => <ChatMessageBubble ... />)}

      {!expanded && showCollapse && (
        <button onClick={() => setExpanded(true)} className="...">
          展开剩余 {hidden} 条 ↓
        </button>
      )}
    </div>
  );
}
```

### 13.2 跳过看策略按钮

thread 顶部加（仅 completed 状态）：

```tsx
{
  thread.status === "completed" && thread.strategy && (
    <button
      onClick={() => scrollToElement(`strategy-${thread.id}`)}
      className="text-xs text-white/50 hover:text-white/80"
    >
      💡 不想看吵架，直接看策略 →
    </button>
  );
}
```

### 13.3 验收

- [ ] thread 长 > 8 条默认折叠到 6 条
- [ ] 折叠按钮 click 展开
- [ ] completed thread 顶部有"直接看策略"按钮
- [ ] PostHog 事件：chat_thread_collapse_expand / chat_thread_skip_to_strategy

---

## 14. D14 — 派别个性化语气更深 — **新增维度**

参见 D7 的 few-shot + 签名词机制。**额外细化**：

### 14.1 派别 LLM Prompt 完整模板（每派独立）

```ts
const PERSONA_PROMPTS: Record<AgentId, string> = {
  alpha: `
你是老 K，破位猎手。

[性格]
- 急性子，话快
- 暴脾气但骨子里看准就上
- 爱晒成绩，嘴硬不认错
- 看见趋势派老白慢吞吞就嫌弃
- 看见极端派老 G 抄底就嘲讽

[口头禅 + 黑话池]
- "破！" "破位才是真信号" "操"
- "等死人" "你这趋势论错过几次"
- "山顶下蛋" "接飞刀"

[禁]
- 不说"突破视角："/"破位:"等报告前缀
- 不说"基于派别分析"等 AI 套话
- 不超 80 字
`,
  beta: `
你是老白，趋势守正。

[性格]
- 沉稳，话不多但有分量
- 嘴硬，喜欢讲道理
- 看见破位侠老 K 急冲就摇头
- 看见极端派老 G 反人性就提醒

[口头禅 + 黑话池]
- "趋势是朋友" "等确认" "稳一点"
- "EMA 共振" "回撤都是机会"
- "韭菜专用" "假突破我见过 100 次"

[禁]
- 同 alpha 禁词
`,
  gamma: `
你是老 G，极端猎手。

[性格]
- 阴险，毒舌
- 专挑顶底，反市场
- 看见破位派老 K 追高就预言被打脸
- 看见趋势派老白慢就嘲讽僵尸

[口头禅 + 黑话池]
- "涨太狠就该跌" "等失速" "反人性"
- "顶部信号" "反手砸空"
- "山顶下蛋" "趋势僵尸"

[禁]
- 同 alpha 禁词
`,
};
```

### 14.2 验收

- [ ] LLM 调用时按 agentId 取对应 PERSONA_PROMPTS 注入
- [ ] 每派签名词命中率 ≥ 80%（D7 验收复用）
- [ ] dev mode 查 100 条样本：3 派语气**明显差异**（人工评估）

---

## 15. D15 — 性能与成本上限 — **新增维度**

### 15.1 LLM 调用上限

```ts
const PERFORMANCE_LIMITS = {
  MAX_LLM_CALLS_PER_THREAD: 25, // 单 thread LLM 调用上限（含 retry）
  MAX_RETRY_PER_THREAD: 5, // 单 thread 总 retry 上限
  MAX_LLM_CALLS_PER_MINUTE_GLOBAL: 30, // 全局每分钟 LLM 调用上限
  MAX_THREADS_PER_DAY: 50, // 每天最多 50 场 thread
  MAX_TOKEN_PER_MESSAGE: 200, // 每条 LLM 输出 token 上限
};

function checkLlmRateLimit(): { allowed: boolean; waitMs?: number } {
  const recent = countLlmCallsInLastMinute();
  if (recent >= PERFORMANCE_LIMITS.MAX_LLM_CALLS_PER_MINUTE_GLOBAL) {
    return { allowed: false, waitMs: 60_000 - getOldestCallAgeInMinute() };
  }
  return { allowed: true };
}
```

### 15.2 PostHog 监控事件

```ts
ANALYTICS_EVENTS = [
  // ... 已有
  "chat_thread_started",
  "chat_thread_completed",
  "chat_thread_llm_total_calls", // properties: total_calls, retry_count, duration_ms
  "chat_thread_llm_quota_alert", // 接近上限时触发
  "chat_thread_synthesis_failed", // strategy 校验失败 → InsufficientConsensus
  "chat_thread_skipped_to_strategy", // D13 按钮
  "chat_thread_collapse_expand", // D13 折叠展开
];
```

### 15.3 成本预算估算

按 DeepSeek 当前价格（~¥0.5 / M tokens 输入，¥1.5 / M tokens 输出）：

- 单 thread 平均 10 条 message × 200 tokens 输出 + 5 retry × 200 tokens = 3000 tokens 输出 ≈ ¥0.0045
- 50 thread/天 × ¥0.0045 = **~¥0.23 / 天**
- 月度 ~¥7

可控。

### 15.4 验收

- [ ] PERFORMANCE_LIMITS 5 个常量定义且接入流程
- [ ] LLM 调用上限触发时 thread 强制结束（不再 retry）
- [ ] 7 个新 PostHog 事件全部入 ANALYTICS_EVENTS 白名单
- [ ] dev mode 模拟单 thread > 25 LLM 调用 → 强制截断

---

## 16. 综合验收清单（所有 15 维度）

### 文案层（D1-D4）

- [ ] grep dev 术语 = 0（"在线/刚上线/实时上下文/信号触发"等）
- [ ] FORBIDDEN_PREFIX_PATTERNS 至少 10 类正则
- [ ] LLM 输出禁词命中 = 0（最近 100 条样本）
- [ ] i18n 10 语 dict 同步翻译

### 互动层（D5-D6）

- [ ] 单 thread ≥ 6 条 message
- [ ] 前 6 条至少 ≥ 2 条 mentioning ≠ null
- [ ] mentioning 必有 ≥ 5 字 citedQuote 且来自历史
- [ ] 含动作词必带方向（多/空/等/不动）

### 内容深度（D7 + D14）

- [ ] 每派 5+ 条 few-shot
- [ ] 派别签名词命中率 ≥ 80%
- [ ] 每 10 条至少 3 条带黑话 / 情绪词

### 节奏（D8）

- [ ] typing 时长按 11 个 action 分档
- [ ] 派别 multiplier 生效

### 视觉（D9 + D10 + D11）

- [ ] 同派别 10s 内合并气泡
- [ ] mention 高亮 + ↘ cite 引用块
- [ ] strategy 渐入流程（typing 1.5s → fade-in → 滚动 → pulse）
- [ ] thread 状态 3 档视觉差异
- [ ] "📌 这场聊完了"分隔线

### 兜底（D12 + D13）

- [ ] SEED_CHAT_THREADS 3 场 sample（首次部署兜底）
- [ ] 长 thread > 8 条折叠到 6 条
- [ ] completed thread 顶部"直接看策略"按钮

### 性能（D15）

- [ ] PERFORMANCE_LIMITS 5 个上限
- [ ] 7 个 PostHog 监控事件
- [ ] dev 模拟超限 → 强制截断

---

## 17. 给 Codex 的副审请求

**任务**：独立评审本 v3.final 完整方案稿，输出反审意见到 `docs/codex-specs/task-18-v3-final-codex-review.md`，**不直接 edit 本稿**。

### 17.1 关键评审问题（请逐一回答）

1. **D5 链式互动启动**：FORCE_EXPECTS_REPLY_TURNS=4 / FORCE_MENTION_PROBABILITY=0.7 / MIN_TOTAL_MESSAGES=6 这套参数你判断够强吗？还会出"3 条独白后结束"的退化吗？

2. **D7 派别 few-shot**：每派 5 条样本是否够多？是否需要更多样本（10+）才能稳定 LLM 输出？

3. **D8 节奏 typing 时长**：11 个 action 分档时长（200-4000ms）是否合理？有没有体感问题（react 200ms 太快用户错过 / concede 4000ms 太慢用户失耐心）？

4. **D9 Visual Flow 同派别合并**：10s 阈值是否合理？合并后头部信息少 → 用户判断派别是否有困难？

5. **D10 策略卡渐入**：1.5s typing placeholder + 200ms fade + auto-scroll + 1.5s pulse 是否过度？

6. **D12 SEED_CHAT_THREADS**：3 场 sample 的内容标准（D12.3）是否覆盖足够场景？有没有遗漏的对话模式？

7. **D15 性能上限**：MAX_LLM_CALLS_PER_THREAD=25 / MAX_LLM_CALLS_PER_MINUTE_GLOBAL=30 是否过紧 / 过松？

8. **整体优先级**：15 个维度全做是否过度设计？哪些可以合并 / 推迟？

9. **遗漏维度**：你看 v3.x preview 后有没有发现本稿没覆盖的体验问题？

10. **实施顺序**：建议先做哪些维度？哪些维度可以独立 commit？

### 17.2 副审格式

请按以下格式输出 `docs/codex-specs/task-18-v3-final-codex-review.md`：

```markdown
# task-18 v3.final Codex 副审意见

## 1. 评审问题 1-10 逐一回答

...

## 2. 我看到但 Claude 漏的维度

...

## 3. 我建议的实施顺序

...

## 4. 我建议的参数调整

...

## 5. 全局判断

- v3.final 整体方向 ✅ / ❌ / 需调整
- 哪些维度必做 / 可砍 / 可推迟
- 一次性出齐 vs 拆 commit 我的建议
```

### 17.3 副审完成后流程

1. Codex 输出 review.md
2. F 整合反审意见 + Dan 仲裁分歧
3. F 更新本稿 → v3.final.locked
4. Codex 一次性实施修复

---

## 18. 文件结构（v3.final 实施时新建 / 修改）

### 新建

```
src/lib/agentDialogueExamples.ts                        # D7 few-shot
src/lib/seedChatThreads.ts                              # D12 sample 种子数据
src/lib/typingDurationCalculator.ts                     # D8 节奏公式
src/lib/personaPrompts.ts                               # D14 派别 LLM Prompt
src/lib/chatPerformanceLimits.ts                        # D15 上限常量
src/modules/agent-watch/components/MetaTypingPlaceholder.tsx     # D10
src/modules/agent-watch/components/CiteIndicator.tsx             # D9
src/modules/agent-watch/components/ActionBadge.tsx               # D9
src/modules/agent-watch/components/ChatMessagesList.tsx          # D13 折叠
src/modules/agent-watch/components/ThreadCompletionDivider.tsx   # D11
src/modules/agent-watch/components/NextThreadPreview.tsx         # D11
docs/codex-specs/task-18-v3-final-codex-review.md       # Codex 副审输出位置
```

### 修改

```
src/lib/llmFallbackChain.ts          # D2 禁词正则 + sanitize 兜底 + D6 方向校验
src/lib/chatOrchestrator.ts          # D5 强制 hook + D8 typing 时长 + D15 性能上限
src/lib/news/normalizer.ts           # D2 禁词复用
src/lib/strategyValidator.ts          # D6 方向校验扩展
src/lib/chatHistoryStore.ts           # D12 SEED 加载逻辑
src/lib/analytics.ts                 # D15 7 个新事件
src/modules/agent-watch/components/Stream.tsx                    # D5/D9/D11 多模块整合
src/modules/agent-watch/components/ChatMessageBubble.tsx          # D7/D9 全重写
src/modules/agent-watch/components/FactionPresenceBar.tsx         # D1
src/modules/agent-watch/components/SeedChip.tsx                   # D1/D11
src/modules/agent-watch/components/InsufficientConsensus.tsx       # D1/D3
src/modules/agent-watch/components/FinalStrategyBlock.tsx          # D6 方向 chip + D10 渐入
src/i18n/types.ts + dicts/*.json                                   # D4 10 语
```

---

## 19. 分支与提交

**分支**：`feature/watch-chat-immersive-01`（同 v3 分支，加 commit）

**提交策略**（Codex 副审后定）：

- 选项 A：单 commit 出齐（commit message 长但易回滚）
- 选项 B：按维度组分多 commit（D1-D4 文案 / D5-D6 互动 / D7-D8 戏剧+节奏 / D9-D11 视觉 / D12-D13 兜底 / D14-D15 IP+性能）

我倾向 B（多 commit），便于追踪和 partial revert。Codex 副审请提建议。

---

## 20. 待 Dan 确认 / Codex 副审

| #   | 项                                 | 谁判断                         |
| --- | ---------------------------------- | ------------------------------ |
| 1   | D7-D11 + D14 全做                  | ✅ Dan 已确认                  |
| 2   | D12 SEED_CHAT_THREADS 3 场 sample  | ✅ Dan 已确认（A）             |
| 3   | D13 折叠 + 跳过看策略              | ✅ Dan 已确认（A）             |
| 4   | D15 性能监控                       | ✅ Dan 已确认（A）             |
| 5   | 完整方案碰撞稿走 sync 协议         | ✅ Dan 已确认（A）             |
| 6   | 17.1 评审问题 1-10                 | 🔍 Codex 副审                  |
| 7   | 提交策略 A vs B                    | 🔍 Codex 副审建议 + Dan 拍板   |
| 8   | SEED_CHAT_THREADS 3 场 sample 草稿 | 📝 F 起草 + Dan 修改           |
| 9   | 实施时机                           | 等 Codex 副审 + Dan 拍板后启动 |

---

_v3.final 完整方案稿_
_Claude 主笔: 2026-05-06_
_Codex 副审: 待启动_
_Dan 拍板: 待 Codex 副审完成_
_实施: 待 v3.final.locked 出后启动_
