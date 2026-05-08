# Spec — Act 1.5 旁观秀页面 + Hero 行情注入 + 4 币点击行情卡

## 目标

一句话：用 LLM 实时分析驱动的 3 Agent 旁观秀页面，叙事 "AI 已经在干活了，你只是还没登录"。同一份 LLM 数据复用到 Hero 机器人嘴里（中文 locale）+ 4 币点击行情卡。

**纯动态生成架构**——不要剧本骨架。每条 Agent 发言必须基于实时行情做真分析。剧本预写文案只在 LLM 全挂 + cache 过期时作末日 fallback。

## 分支策略

```
git fetch origin
git checkout main
git pull origin main
git checkout -b feature/act1-5-watch-page-01
# 实现
git push origin feature/act1-5-watch-page-01
# 开 PR 到 main
```

## 变更范围

### 新建

- `src/app/[locale]/agent/page.tsx` — 旁观秀页面
- `src/app/api/market/ticker/route.ts` — 行情 API（CoinGecko 代理）
- `src/app/api/agents/analysis/route.ts` — LLM 调用 + 多源 fallback chain
- `src/modules/agent-watch/AgentWatchBoard.tsx` — 主容器
- `src/modules/agent-watch/components/TopicHeader.tsx`
- `src/modules/agent-watch/components/AgentSidebar.tsx`
- `src/modules/agent-watch/components/MessageStream.tsx`
- `src/modules/agent-watch/components/MessageBubble.tsx`
- `src/modules/agent-watch/components/TypingIndicator.tsx`
- `src/modules/agent-watch/components/CoinTickerStrip.tsx`
- `src/modules/agent-watch/types.ts`
- `src/modules/agent-watch/skills/alpha.json` / `beta.json` / `gamma.json`（Agent 人设 + fallback 文案池）
- `src/modules/agent-watch/api/llmClient.ts` — fallback chain 封装
- `src/modules/agent-watch/hooks/useAgentAnalysis.ts` — 前端轮询 hook
- `src/modules/landing/HeroScene/components/CoinModal.tsx` — 币种点击 modal
- `src/lib/marketDataCache.ts` — 服务端缓存
- `src/lib/llmFallbackChain.ts` — LLM 调用链（minimax → deepseek → claude haiku）

### 修改

- `src/components/SiteHeader.tsx` — 加 "Agent Live" 菜单项
- `src/modules/landing/HeroScene/RobotLayer.tsx` — speechBubble 中文 locale 优先取动态分析
- `src/modules/landing/HeroScene/CoinsLayer.tsx` — 4 币元素改 onClick 弹 modal
- `src/modules/landing/HeroScene/HeroScene.tsx` — 加 CoinModal 状态管理
- `src/app/[locale]/page.tsx` — 在 ScenariosSection 后加 link 卡引流去 `/agent`
- `src/i18n/types.ts` — 加 `agentWatch.*` + `coinModal.*` + `nav.agentLiveMenuItem` 字段
- `src/i18n/dicts/zh_CN.json` — 完整文案
- `src/i18n/dicts/{其他 9 个}.json` — 仅加结构（占位英文文案，因为 v1 中文 only）

### 不动

- `src/app/globals.css` — 复用现有 card-glow 蓝光体系
- `src/app/[locale]/layout.tsx`
- `src/i18n/locales.ts` / `I18nProvider.tsx`
- 现有 Section（Quickstart / Why / SkillsEco / StartTrade / Disclaimer / ScenariosSection 主体）
- `package.json` — 不新增 React 类依赖；node 端可能需要装 minimax/deepseek/anthropic SDK（具体看 Section 2）

## 技术上下文

- Next.js 14 App Router
- React 18
- Tailwind 3.4
- TypeScript 5
- framer-motion ^11
- 现有 i18n 走 `useI18n()` hook，10 个 locale
- 视觉骨架：card-glow + bg-[#111] + border-white/10 + rounded-2xl + 蓝光呼吸
- 参考实现：`xxcrypto-gtm/src/modules/agent-chatroom/`（人设 Skills JSON 模式 + chatroom UI）和 `xxcrypto-gtm/src/app/api/openclaw/generate/route.ts`（minimax 接入）
- **Codex 必须先 read** `xxcrypto-gtm/src/modules/agent-chatroom/skills/cwclaw-alpha.json` 等三份 Skills JSON 作为人设结构参考

### 环境变量（Vercel 上配）

```
MINIMAX_API_KEY        # primary LLM
MINIMAX_MODEL          # 默认 MiniMax-Text-01
MINIMAX_ENDPOINT       # 默认国际版
DEEPSEEK_API_KEY       # secondary LLM
ANTHROPIC_API_KEY      # tertiary LLM (Haiku)
COINGECKO_API_KEY      # 可选，free tier 不强制
```

PR 描述里**必须提醒 Dan** 在 Vercel Dashboard 配齐这 5 个 env var。

### 禁用清单

- ❌ 剧本驱动模式（xxcrypto-gtm 的 ScriptBeat[] 不复用，beat-by-beat 时序逻辑不要）
- ❌ 不接 OAuth，不接 CoinW 真实 API
- ❌ 不做用户输入框 / 发言交互（v1 用户只看 + 点赞）
- ❌ 新依赖（minimax / deepseek / anthropic SDK 必须用现成的，三家官方都有 npm 包）
- ❌ localStorage / sessionStorage 在主流程里
- ❌ 用户消息上传到 LLM（v1 没有用户消息）

---

## Section 1 — 实时行情 API 后端

### 路由

`src/app/api/market/ticker/route.ts` (GET)

### 职责

- 从 CoinGecko 拉 BTC/ETH/SOL/USDT 当前价 + 24h 涨跌幅
- 服务端缓存 30 秒
- 返回 JSON

### CoinGecko 端点

```
https://api.coingecko.com/api/v3/simple/price
  ?ids=bitcoin,ethereum,solana,tether
  &vs_currencies=usd
  &include_24hr_change=true
```

free tier 限频 30 req/min。30s 缓存意味着每分钟最多 2 次实际调用，安全。

### 缓存实现

`src/lib/marketDataCache.ts` 用简单 Map + TTL：

```ts
type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;
  const fresh = await fetcher();
  cache.set(key, { value: fresh, expiresAt: Date.now() + ttlMs });
  return fresh;
}
```

注：Vercel serverless 实例可能多个且无共享内存——cache 命中率取决于实例分布，但绝对不会比无缓存差。生产监控发现命中率低再考虑 Vercel KV / Upstash。v1 不优化。

### 响应格式

```json
{
  "ts": 1712345678901,
  "tickers": {
    "BTC": { "price": 67432.12, "change24h": 2.14 },
    "ETH": { "price": 3187.45, "change24h": -0.82 },
    "SOL": { "price": 145.67, "change24h": 4.53 },
    "USDT": { "price": 1.0001, "change24h": 0.01 }
  }
}
```

### 错误处理

- CoinGecko 5xx / 超时 5s → 返回 `{ error: "ticker_unavailable", staleTickers?: <last-known> }`
- 前端拿 staleTickers 兜底显示 + 标记"⏳ 数据延迟"
- 如果连 stale 都没有 → 用 `src/modules/agent-watch/skills/fallback-tickers.json` 写死的兜底数据（带时间戳标"参考价"）

---

## Section 2 — Agent 分析 LLM 后端

### 路由

`src/app/api/agents/analysis/route.ts` (GET)

### 职责

- 拉最新行情（先调 Section 1 内部函数，不重新 fetch CoinGecko）
- 调 LLM 生成 batch 输出（见下方 schema）
- 服务端缓存 60 秒
- 失败走 fallback chain
- 返回 JSON

### LLM 调用链（fallback chain）

实现在 `src/lib/llmFallbackChain.ts`：

```
primary:   minimax (model: MiniMax-Text-01)
secondary: deepseek (model: deepseek-chat)
tertiary:  anthropic claude haiku (model: claude-haiku-4-5-20251001)

每个 provider:
  - 调用超时 5s
  - 网络错 / 401 / 429 / 5xx → 切下一个
  - JSON 解析失败 → 切下一个

全部失败:
  - 用上一次成功 cache（最长 5 分钟内有效）
  - cache 也过期 → 用末日静态 fallback（见 Section 7）
```

每次调用记录到 console.warn 让 Vercel logs 能查到 fallback 触发。

### Batch Prompt 设计

每次调用一次 LLM，单次输出 JSON 含 16 条文本。Prompt 模板：

````
你扮演 3 个加密交易 Agent 同时点评当前市场。每个 Agent 人设见下方。

## 当前行情数据
BTC $67,432 +2.1%  ETH $3,187 -0.8%  SOL $145 +4.5%  USDT $1.00 +0.01%

## Agent 人设

### Alpha（激进派）
{读取 src/modules/agent-watch/skills/alpha.json 的 persona + style + framework}

### Beta（稳健派）
{读取 beta.json}

### Gamma（套利派）
{读取 gamma.json}

## 输出格式（严格 JSON，不加任何 markdown 代码块）

{
  "stream": [
    { "agentId": "alpha", "content": "<Alpha 当前对市场的 1-2 句点评，<=50字，基于上述行情真分析>" },
    { "agentId": "beta",  "content": "<Beta 当前对市场的 1-2 句点评>" },
    { "agentId": "gamma", "content": "<Gamma 当前对市场的 1-2 句点评>" }
  ],
  "heroBubbles": [
    "<Hero 机器人嘴里说的短句 1，<=40 字，行情相关>",
    "<Hero 机器人嘴里说的短句 2>",
    "<Hero 机器人嘴里说的短句 3>"
  ],
  "coinComments": {
    "BTC":  { "alpha": "<对 BTC 的点评>", "beta": "<>", "gamma": "<>" },
    "ETH":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "SOL":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "USDT": { "alpha": "<>", "beta": "<>", "gamma": "<>" }
  }
}

硬性规则:
- 全部中文输出
- 直接输出 JSON，不加 ```json``` 代码块
- 每条点评必须基于上面给的实时行情数据，不要泛泛而谈
- 禁用词: 综上所述、值得注意的是、赋能、leverage、moreover
- 禁止 markdown 格式
````

### 响应格式

返回给前端的是 LLM JSON output 加上 metadata：

```json
{
  "ts": 1712345678901,
  "ttl": 60,
  "source": "minimax" | "deepseek" | "claude" | "cache" | "static-fallback",
  "tickers": { /* 同 ticker API 的 tickers */ },
  "stream": [
    { "agentId": "alpha", "content": "..." },
    { "agentId": "beta",  "content": "..." },
    { "agentId": "gamma", "content": "..." }
  ],
  "heroBubbles": [ "...", "...", "..." ],
  "coinComments": { /* 同上 */ }
}
```

### 缓存周期

- LLM 输出缓存 60 秒（前端 1 min/轮 polling 与之匹配）
- 末日 fallback 缓存 5 分钟（避免 LLM 全挂时每分钟跑一遍全部 fallback chain）
- ticker 缓存 30 秒

### 单次成本估算

- input ~600 tokens（含 prompt 模板 + 3 Agent 人设摘要 + 当前行情）
- output ~800 tokens（16 条文本 JSON）
- minimax abab 价格按 ¥0.01/1k tokens 估算 → 单次 ¥0.014
- 1 min/轮 × 24h × 30 days = 43200 次/月 → 约 **¥600/月**
- Dan 已确认 minimax 成本可承担

---

## Section 3 — 旁观秀页面 `/agent`

### 路由

`src/app/[locale]/agent/page.tsx`

### 页面结构（自上而下）

```
┌──────────────────────────────────────────────────┐
│ SiteHeader（复用现有 Navbar，已加 Agent Live 菜单项） │
├──────────────────────────────────────────────────┤
│ <CoinTickerStrip />                              │
│   BTC $67,432 +2.1% │ ETH $3,187 -0.8% │ ...    │
├──────┬───────────────────────────────────────────┤
│      │ <TopicHeader>                             │
│ Side │   实时市场旁观  ·  3 Agent 自动分析       │
│ bar  │   "AI 已经在干活了，你只是还没登录"        │
│      │                                           │
│ Alpha├───────────────────────────────────────────┤
│ Beta │ <MessageStream>                           │
│ Gamma│   Alpha 09:03  BTC 突破 67k...           │
│      │   Beta  09:03  等回踩 65800 再说...       │
│      │   Gamma 09:04  Binance-OKX 价差 0.12%... │
│      │   <TypingIndicator>...</>                 │
│      │                                           │
│      │ <BottomCTA>                               │
│      │   登录后让 Agent 替你下单 →                 │
│      │ </BottomCTA>                              │
└──────┴───────────────────────────────────────────┘
```

### 主容器 `AgentWatchBoard.tsx`

- 调用 `useAgentAnalysis()` hook 拿数据 + 1 min 轮询
- 组装顶部 ticker / sidebar / stream / bottom CTA
- 全宽，max-w-7xl mx-auto，h 充满（min-h-[calc(100vh-72px)]）

### 时序逻辑

- 数据每 60s 轮询一次 `/api/agents/analysis`
- 拿到新 stream 后 → 把 3 条新消息按顺序 append 到 messageList，每条之间 800ms 间隔，期间显示 TypingIndicator
- 同一 agentId 在屏幕上有最多 5 条历史消息（旧的 fade 出 + 删除），保持页面"活的"
- 用户停在页面 N 分钟后，旧消息逐步 fade 掉，新消息源源补进来

### Sidebar 状态指示

- "思考中" - 黄色点动画（TypingIndicator 触发时）
- "发言中" - 绿色点（消息正在 append 时）
- "静默" - 灰色点（无活动 > 5s）

### 视觉

- card-glow 蓝光骨架，bg-[#111]，border-white/10，rounded-2xl
- 复用现有 ChatPreviewCard（src/modules/landing/ScenariosSection.tsx 里）的气泡风格作参考
- 蓝光呼吸 + 紫光 hover

### 移动端

- < 768px：Sidebar 收成顶部 3 个小 chip 横排
- MessageStream 占满宽度

### Bottom CTA

"登录后让 Agent 替你下单"——link 到一个静态页面 `/agent/register`（v1 不存在，先用 `#` 占位 + tooltip "敬请期待"，等 OAuth 集成阶段再接）

---

## Section 4 — Hero speechBubble 中文 locale 注入

### 现状

`src/modules/landing/HeroScene/RobotLayer.tsx` 内 SpeechBubble 子组件 hover 触发，从 `t.hero.speechBubble`（14 条静态）随机选一条。

### 修改

RobotLayer 加 `useAgentAnalysis()` 拿 heroBubbles。

逻辑：

```ts
const { data, locale } = useAgentAnalysis();
const isZh = locale === "zh_CN";
const dynamicPool = isZh && data?.heroBubbles?.length ? data.heroBubbles : null;
const staticPool = t.hero.speechBubble;

// hover 时随机：
const pool = dynamicPool ?? staticPool;
const line = pool[Math.floor(Math.random() * pool.length)];
```

行为：

- 中文 locale + LLM 数据可用 → 用动态 3 条
- 中文 locale + LLM 数据失败 → fallback 静态 14 条
- 非中文 locale → 不调 useAgentAnalysis（节省后端调用），直接用静态 14 条

注：RobotLayer 不在 `/agent` 页面挂载（HeroScene 只在 `/{locale}/`），所以 RobotLayer 调 useAgentAnalysis 是独立的轮询源——和旁观秀页面的轮询互不干扰，但可以共享 server cache。

---

## Section 5 — Hero 4 币点击 Modal

### 现状

`src/modules/landing/HeroScene/CoinsLayer.tsx` 4 个币（BTC/ETH/SOL/USDT）只有 hover parallax + glow。CoinItem 已经有 `onMouseEnter` / `onMouseLeave`。

### 修改

- CoinItem 加 `onClick` → 通过 props 回调上抛到 HeroScene
- HeroScene 持有 `selectedCoin` state（'BTC' | 'ETH' | 'SOL' | 'USDT' | null）
- 点击币 → setSelectedCoin(symbol) → 渲染 `<CoinModal symbol={selectedCoin} />`
- 关闭 modal → setSelectedCoin(null)

### CoinModal 组件

新建 `src/modules/landing/HeroScene/components/CoinModal.tsx`：

视觉：

- 全屏遮罩 `bg-black/70 backdrop-blur-sm z-[100]`
- 中央卡片 `bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md card-glow`
- ESC + 外点击 + 右上 X 按钮关闭
- framer-motion fade-in / scale 0.95 → 1

内容：

```
[BTC icon 大图] Bitcoin (BTC)
$67,432.12  ▲ 2.14% (24h)

— Alpha：BTC 突破 67k 但资金费率偏高，警惕假突破
— Beta：等 65800 回踩，不追
— Gamma：Binance-OKX 价差 0.12%，套利可开

[关闭] [去旁观秀听他们继续聊 →]
```

数据来源：useAgentAnalysis() 拿到的 coinComments[symbol]

- 中文 locale + 数据可用 → 显示 3 Agent 各一句
- 数据失败 → 显示静态 fallback（每币 × 3 Agent = 12 条 fallback）
- 非中文 locale → 仅显示价格 + 涨跌，不显示 Agent 分析（v1 限制）

价格显示：

- 数据可用 → 显示 ticker
- ticker 失败 → 显示 "—" + tooltip "行情数据获取中"

### Coin item onClick 行为

- 桌面：点击触发 modal，hover 行为保留
- 移动：tap 触发 modal（CoinsLayer 当前的 onTouchStart 监听如果有就保留）

无障碍：

- modal 加 `role="dialog"` `aria-modal="true"` `aria-labelledby="coin-modal-title"`
- ESC 关闭后焦点回到点击的 coin

---

## Section 6 — Navbar 入口 + 主页 link 卡

### Navbar 加 "Agent Live" 菜单项

`src/components/SiteHeader.tsx` 在 logo 右侧加：

```tsx
<a
  href={`/${locale}/agent`}
  className="hidden h-11 items-center rounded-full px-4 text-sm font-semibold text-white/80 transition-all hover:bg-white/[0.08] hover:text-white md:inline-flex"
>
  <span className="relative flex items-center gap-2">
    <span className="bg-cw-green h-2 w-2 animate-pulse rounded-full" />
    {t.nav.agentLiveMenuItem}
  </span>
</a>
```

绿色脉动小圆点暗示"实时直播"。

中文 "实时旁观"，英文 "Agent Live"，其他语言可以用英文 fallback。

### 主页 ScenariosSection 后插 link 卡

在 `src/app/[locale]/page.tsx` 的 ScenariosSection 之后、WhySection 之前插入：

```tsx
<motion.a
  href={`/${locale}/agent`}
  whileHover={{ y: -4 }}
  className="mx-auto block max-w-7xl px-6 py-8 md:px-12 lg:px-20"
>
  <div className="card-glow flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-[#111] p-6 md:p-10">
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="bg-cw-green h-2 w-2 animate-pulse rounded-full" />
        <span className="text-cw-green text-xs font-semibold uppercase tracking-wider">
          {t.agentWatch.linkCardLiveBadge}
        </span>
      </div>
      <h3 className="mb-2 text-2xl font-bold text-white md:text-3xl">
        {t.agentWatch.linkCardTitle}
      </h3>
      <p className="text-sm text-gray-400 md:text-base">{t.agentWatch.linkCardDesc}</p>
    </div>
    <span className="text-3xl">→</span>
  </div>
</motion.a>
```

文案（中文）：

- linkCardLiveBadge: "● LIVE"
- linkCardTitle: "3 个 Agent 正在分析行情"
- linkCardDesc: "未登录也能看，进直播间听 Alpha / Beta / Gamma 现场点评"

---

## Section 7 — Fallback 静态文案池（末日兜底）

### Skills JSON 结构

参考 `xxcrypto-gtm/src/modules/agent-chatroom/skills/cwclaw-alpha.json`，每个 Agent 一份：

`src/modules/agent-watch/skills/alpha.json`:

```json
{
  "id": "claw42-alpha",
  "displayName": "Alpha",
  "tagline": "激进派 · 短周期突破猎手",
  "color": "#ff6b6b",
  "persona": "你是 Alpha，激进派交易 Agent，偏好短周期突破策略。语气果断带点江湖气，敢于下判断。每句不超过 50 字。",
  "style": {
    "tone": "果断、直接、有江湖气",
    "maxLength": 50,
    "bannedPhrases": ["综上所述", "值得注意的是", "赋能", "leverage"],
    "examples": [
      "BTC 突破 67k 但资金费率抬头，假突破风险高",
      "止损 66500 止盈 68800 仓位 30% 突破再加",
      "ETH 跑不赢 BTC 别浪费仓位"
    ]
  },
  "analyticalFramework": {
    "coreLogic": [
      "突破方向 + 资金费率印证 + 短周期成交量",
      "止损紧 止盈分批 仓位灵活",
      "趋势没确认前不全仓"
    ]
  },
  "fallbacks": {
    "stream": [
      "BTC 走势偏多但资金费率偏高，先看回踩",
      "ETH 突破后量缩，注意洗盘",
      "SOL 单边强势可继续持有",
      "...（共 30 条静态 fallback，行情中性，不依赖具体价格）"
    ],
    "heroBubbles": [
      "盯紧资金费率，突破才是真突破",
      "回踩到位再上车，不追高",
      "短周期看突破，长周期看趋势"
    ],
    "coinComments": {
      "BTC": "突破靠资金费率确认，仓位别太重",
      "ETH": "ETH 跟 BTC 跑，独立机会少",
      "SOL": "SOL 弹性大，短打更适合",
      "USDT": "稳定币不动，看波动币"
    }
  }
}
```

Beta（稳健派）和 Gamma（套利派）类似结构，人设不同：

- **Beta**：稳健、克制、控回撤优先；语气冷静；常说"等回踩"/"分仓"
- **Gamma**：精准、简洁、关注跨市场价差；常说"价差 X%"/"套利窗口"

### Fallbacks 数量要求

每个 Agent JSON 必须包含：

- `fallbacks.stream`: 30 条行情中性短句
- `fallbacks.heroBubbles`: 10 条 Hero 用短句
- `fallbacks.coinComments`: 4 币各 1 条点评（共 4 条）

3 Agent × (30+10+4) = 132 条 fallback 文案。Codex 按 Alpha 范例风格生成 Beta / Gamma 对应内容。

### 用法

- LLM 全挂 + cache 过期 → `src/lib/llmFallbackChain.ts` 返回 `{ source: "static-fallback", stream: [随机抽 3 条 from fallbacks.stream], heroBubbles: [...], coinComments: {...} }`
- 前端拿到 `source: "static-fallback"` 时**可以**显示一个小提示 "行情服务暂时降级"（不强制，看视觉决定）

---

## Section 8 — i18n

### types.ts 新增

```ts
nav: {
  switchLangToEn: string;
  switchLangToZh: string;
  agentLiveMenuItem: string; // 新增
}
agentWatch: {
  // 新增整块
  pageTitle: string;
  pageSubtitle: string;
  pageHeroTagline: string;
  sidebarStatus: {
    thinking: string;
    speaking: string;
    idle: string;
  }
  bottomCta: string;
  linkCardLiveBadge: string;
  linkCardTitle: string;
  linkCardDesc: string;
  fallbackNotice: string;
}
coinModal: {
  // 新增整块
  closeAriaLabel: string;
  goToWatchCta: string;
  loadingPrice: string;
  agentCommentMissing: string; // 非中文 locale 时显示
}
```

### 10 dict 文案

- `zh_CN.json`：完整中文文案
- 其他 9 语：结构 key 全加，文案用**英文 fallback**（v1 仅中文动态分析；非中文用户访问 `/agent` 页面看到英文 UI 但 LLM 内容会是 fallback 静态英文——但这超 v1 范围，所以非中文用户访问 `/agent` 页面应该看到一个 banner "Currently optimised for Chinese; English experience coming soon"，不阻塞访问）

简化方案：v1 非中文用户访问 `/agent` 页面会被中间件重定向到 `/{locale}/` 主页（不显示 `/agent` 路由）。

- `src/middleware.ts` 加规则：path 命中 `/agent` 但 locale 不是 zh_CN → 重定向 `/{locale}/`
- 这样非中文 i18n 完全不需要 agentWatch 块——更省

**采用简化方案**：v1 仅 zh_CN 能访问 `/agent`，其他 locale 重定向回主页。i18n types.ts 加字段（required），但其他 9 语用空字符串占位（types.ts 用 ?: optional 也行，但保持类型一致更好）。

### Hero 注入的 i18n 影响

RobotLayer 已经用 `t.hero.speechBubble`，本 spec 不改 hero i18n（不动 14 条静态，只在中文 locale 加 dynamic 优先逻辑）。

---

## 验收标准

### 编译 / 类型

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误
- [ ] `git diff --name-only main..HEAD` 显示文件数和"变更范围"一致（约 25-30 个文件）

### 文件 / Grep 验证

- [ ] `src/app/[locale]/agent/page.tsx` 存在
- [ ] `src/app/api/market/ticker/route.ts` 存在
- [ ] `src/app/api/agents/analysis/route.ts` 存在
- [ ] `src/lib/llmFallbackChain.ts` 含 `minimax` / `deepseek` / `claude` 三个 provider 实现
- [ ] `src/modules/agent-watch/skills/{alpha,beta,gamma}.json` 三份存在，每份至少 30 条 stream fallback
- [ ] `grep "ScriptBeat\|scriptEngine" src/modules/agent-watch/` 无输出（确认没复用剧本驱动模式）
- [ ] `grep "agentLiveMenuItem" src/i18n/types.ts` 有
- [ ] `grep "agentWatch" src/i18n/dicts/zh_CN.json` 有完整 8 字段

### 功能（中文 locale 桌面）

- [ ] 访问 `/zh_CN/agent` 页面正常加载
- [ ] 顶部 ticker 显示 4 币当前价 + 24h 涨跌色（涨绿跌红）
- [ ] Sidebar 3 Agent 卡片显示 Alpha/Beta/Gamma 头像 + tagline + 状态点
- [ ] MessageStream 在页面挂载 ~3s 内出现首批 3 条消息
- [ ] 每 60s 收到新一批 3 条消息，旧消息保留 ≤5 条/Agent
- [ ] TypingIndicator 在新消息出现前 ~800ms 显示
- [ ] Hero 机器人 hover → 中文 locale 看到的 speechBubble 部分来自动态分析（可通过 console.log 数据来源验证）
- [ ] 点击 Hero 任一币 → modal 弹出 → 显示价格 + 3 Agent 点评
- [ ] modal ESC 关闭、外点击关闭、X 按钮关闭都生效
- [ ] Navbar 显示 "实时旁观" 菜单项 + 绿色脉动点
- [ ] 点击菜单项跳到 `/agent`
- [ ] 主页 ScenariosSection 之后有一张 link 卡引流到 `/agent`

### 功能（非中文 locale）

- [ ] 访问 `/en_US/agent` 重定向到 `/en_US/`（非中文 locale 不开放旁观秀）
- [ ] Hero 机器人 hover 仅显示静态 14 条
- [ ] 4 币点击 modal 仅显示价格，不显示 Agent 分析（fallback 文案 "Agent commentary available in Chinese only"）

### LLM Fallback chain

- [ ] 关 `MINIMAX_API_KEY` env → 服务自动用 deepseek，console 显示 fallback 触发
- [ ] 关 `MINIMAX_API_KEY` + `DEEPSEEK_API_KEY` → 用 anthropic claude
- [ ] 三个全关 → 用 cache（5min 内）→ 然后 static fallback → 页面仍能渲染（不白屏）

### 性能

- [ ] 行情 API 30s 缓存命中（连续两次请求间隔 < 30s 不命中 CoinGecko）
- [ ] LLM API 60s 缓存命中（连续两次间隔 < 60s 不调 LLM）
- [ ] 旁观秀页面 LCP < 2.5s（Lighthouse 桌面）

### 移动端

- [ ] 旁观秀页面 mobile 布局：Sidebar 收顶部、Stream 满宽
- [ ] CoinModal 在 mobile 居中、不溢出 viewport
- [ ] Navbar "实时旁观" 在 mobile 收进 Drawer / 隐藏（spec 不要求 v1 mobile 完整菜单，可以 hidden md:inline-flex）

### 无障碍

- [ ] CoinModal 有 role="dialog" + aria-modal + aria-labelledby
- [ ] ESC 关闭后焦点回 trigger
- [ ] Sidebar 状态点不依赖颜色（额外加文字"思考中"等）

### 边界

- [ ] 不引入 Anthropic SDK 以外的新依赖（minimax / deepseek 用 fetch 直调，不引 SDK）
- [ ] 不修改 globals.css
- [ ] 不修改其他 Section 组件主体（ScenariosSection / WhySection / 等）
- [ ] 不接触 OAuth / CoinW API
- [ ] 不做用户输入框 / 发言交互

---

## 约束

- LLM prompt 每次都注入当前实时行情数据（让分析真和行情挂钩，不是泛泛而谈）
- LLM 输出严格 JSON，不带 markdown 代码块包裹
- LLM 调用超时 5s，超时立即切下一个 provider
- 全部 fallback 都失败时不报错不白屏，用 `static-fallback` source 优雅降级
- skills/\*.json 里的 fallbacks.stream 至少 30 条/Agent，行情中性（不能写"BTC 当前 67k"这种依赖具体价格的）
- 中英文混排时按中文标点（，。！？），不要全角句号 + 半角逗号混用
- ticker 涨跌色用 cw-green / cw-red token，不要硬编码 text-green-500
- 不要给概念加引号或粗体强调（CWC 写作规范）

---

## 提交与 PR

1. 从 main 拉 `feature/act1-5-watch-page-01`
2. 实现 + 自测（中文 locale 桌面 / 非中文 redirect / mobile / LLM fallback chain）
3. 测试三个 LLM provider 都关掉时的 graceful degrade
4. 写 PR 描述提醒 Dan 在 Vercel 配 5 个 env var
5. Commit message：

   ```
   feat(act1-5): 3-agent watch page + hero analysis injection + coin modal

   - New route /{locale}/agent with 3-agent live commentary stream
   - LLM fallback chain: minimax → deepseek → claude haiku → static
   - Reuse same LLM batch output to inject hero speechBubble (zh_CN only)
   - Coin click modal showing 3-agent commentary per coin
   - Server-side cache: ticker 30s, LLM 60s
   - Skills JSON with persona + 30+10+4 fallback per agent
   - Non-zh_CN locales redirected from /agent to home (v1 chinese-only)
   ```

6. Push + 开 PR 到 `main`

## 有疑问不要猜

- minimax / deepseek API endpoint 不确定 → 看 xxcrypto-gtm `src/app/api/openclaw/generate/route.ts` 里 minimax 现成实现，deepseek 看官方文档 `https://api.deepseek.com/chat/completions`
- LLM 输出 JSON 解析失败 → 切下一个 provider，不要尝试修复 JSON
- CoinGecko 限频 429 → 不重试，直接返回 staleTickers
- skills/{}.json fallback 文案不知道写什么 → 按 Alpha 范例风格 + Beta/Gamma 人设描述生成，每条 ≤50 字、行情中性、避免具体数字
- middleware redirect 不工作 → 检查 `src/middleware.ts` 现有 locale 检测逻辑，不要自己另写一套

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Codex_
_基于: main（最新含 PR #9 merge）_
_配套: spec-act1-5-agent-avatars.md（Agent 头像生成 spec）_
