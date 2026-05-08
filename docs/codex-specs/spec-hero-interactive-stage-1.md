# Spec: Hero Interactive Upgrade — Stage 1（Independent PR）

## 目标

把 claw42 主页 Hero 区从静态营销页升级为**互动式产品 demo 入口**，作为 CoinW 转化漏斗第一段。**Stage 1 = UI 框架 + stub 数据**，独立 PR，不依赖 task-18 PR #27 / v2.0 Batch 4。Stage 2（接 chatOrchestrator + affiliate URL）排在 Batch 4 之后，作为 follow-up patch。

**用户体验目标**：

- 用户进 hero → 看到 4 个当日热门币动态（涨大跌小）
- 点击任一币 → 机器人爪子抓币 + 投币 → hero 下方展开 mini player
- mini player 显示 3 Agent 评论 + 1 strategy 卡 + 2 CTA
- 用户决策：继续看 watch 完整讨论 / 直接去 CoinW 注册

---

## § 0. 锁定决策（Q-Hero-1 ~ Q-Hero-8）

| Q   | 决策                                                              |
| --- | ----------------------------------------------------------------- |
| 1   | **D**：Hero 内嵌 mini player（不跳页）                            |
| 2   | **B + 30min**：24h 涨幅 + 24h 成交量加权排序，每 30 分钟刷新      |
| 3   | 涨缩映射函数（四段）—— 见 § 3.2，**Codex 副审环节**               |
| 4   | **A**：mini player = 3 Agent 评论 + 1 strategy 卡 + 2 CTA         |
| 5   | **C**：Hint 文案 + arrow 指向最热币（被动暗示，不 auto-demo）     |
| 6   | **A**：完全独立 mobile 设计（竖排 + 简化动画 + 全屏 mini player） |
| 7   | **C**：用户停留期间币种**不换**（防止刚要点的币消失）             |
| 8   | **C**：独立 PR 现在做，不阻塞 task-18 / Batch 4                   |

---

## § 1. 范围 / 不动

### Stage 1 做的（本 spec）

- HeroScene.tsx 重构：4 币动态 + 涨缩动画 + 抓爪动画
- mini player UI 框架（empty shell + stub 数据填充）
- Hint 文案 + arrow 引导
- 完全独立 mobile 设计
- 4 币热门选择 API（`/api/hero/trending-coins`）
- stub 数据接口（`HeroMiniPlayerData`），Stage 2 替换为真 chatOrchestrator 调用

### Stage 1 不做（留 Stage 2）

- mini player 内容真实生成（chatOrchestrator + 派别 prompt）—— **stub 占位**
- strategy 卡内容真实生成 —— **stub 占位**
- affiliate URL 真实跳转 —— **占位 URL** `https://www.coinw.com/zh_CN/register?r=XXCryptoEN`
- 持久化 user click metrics（这部分等 PostHog / KV metrics 接入）

### 完全不动

- task-18 PR #27 分支代码（互不交叉）
- main 上的 watch 页 + agent-watch 模块
- v2.0 master plan locked-v3
- 主 worktree dirty state

---

## § 2. 数据源 + API

### 2.1 4 币热门选择算法

**新增 API endpoint**：`/api/hero/trending-coins`

**数据源**：CoinGecko `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50` 拉前 50 大币种（main 已有 marketDataCache 部分 wrapper）

**排序公式**：

```typescript
function computeTrendingScore(coin: CoinData): number {
  const priceMomentum = Math.abs(coin.price_change_percentage_24h); // 涨跌幅绝对值
  const volumeBoost = Math.log10(coin.total_volume_24h / 1e6 + 1); // 24h 成交量（百万 USD），log 缓和
  return priceMomentum * 0.6 + volumeBoost * 4; // 涨跌幅占 60%，成交量占 40%
}
```

**取 top 4**，但有 sanity check：

- 排除 stable coins（USDT / USDC / DAI / FDUSD 等，写死黑名单）
- 排除 24h volume < $10M 的（防低流动性币假涨）
- 排除 market cap < $50M 的（防暴跌死币）

**刷新策略**：

- 服务端 cache 30 分钟（KV-based metrics 已就位，`hero:trending:${YYYY-MM-DD-HH-30}` key）
- cache miss → 实时调 CoinGecko → 写 KV
- cache hit → 直接返回

**Q-Hero-7 用户停留不换币的实现**：

- 客户端首次拉 4 币后写 sessionStorage（`hero_trending_session_v1`）
- 整个 session 期间不重新拉（即使 30 min 刷新）
- 用户**主动 reload 页面** 才拉新数据

### 2.2 mini player 数据接口（stub vs real）

```typescript
// src/modules/landing/HeroScene/types/mini-player.ts

export interface HeroMiniPlayerData {
  symbol: string;
  agentMessages: AgentMessage[]; // 3 条
  strategyCard: StrategyCard;
  coinwAffiliateUrl: string; // 已带 referral code
  generatedAt: number;
}

export interface AgentMessage {
  agentId: "alpha" | "beta" | "gamma";
  content: string;
  timestamp: number;
}

export interface StrategyCard {
  direction: "long" | "short" | "wait";
  symbol: string;
  reason: string; // 短句 1-2 行
  confidence: number; // 0-1
}

// Stage 1: stub 实现
export async function fetchHeroMiniPlayerData(symbol: string): Promise<HeroMiniPlayerData> {
  // STAGE 1 STUB: 返回 hardcoded 示例数据
  // STAGE 2 TODO: 替换为 chatOrchestrator + strategy synthesis
  return STUB_DATA[symbol] ?? generateGenericStub(symbol);
}
```

`STUB_DATA` 为每个常见 symbol 准备一组示例 mini player 数据（BTC / ETH / SOL / NIL 等 10 个常见币种），让用户点击后看到合理示例。

**Stage 2 切换点**：替换 `fetchHeroMiniPlayerData` 内部实现为真 chatOrchestrator 调用。**外部接口契约不变**，所以 Stage 1 上线代码可零改动接 Stage 2。

---

## § 3. UI / 动画

### 3.1 4 币布局

**Desktop**：

- 4 币环绕中央机器人（左上 / 右上 / 左下 / 右下）
- 每币 base 尺寸 80px × 80px
- 浮动微动效（已有 framer-motion 实现，保留）

**Mobile**（新增独立设计）：

- 4 币竖排在 hero 下方，2x2 grid
- 每币 base 尺寸 56px × 56px
- 中央机器人尺寸缩到 50%
- 抓爪动画简化为缩放 + 闪光，不真伸"爪子"

### 3.2 涨缩映射函数（**Codex 副审环节**）

```typescript
// src/modules/landing/HeroScene/utils/priceMovementToScale.ts

export function priceMovementToScale(changePercent24h: number): number {
  const sign = changePercent24h >= 0 ? 1 : -1;
  const abs = Math.abs(changePercent24h);

  // 段 1: |Δ| ≤ 5%（基线，无视觉变化）
  if (abs <= 5) return 1.0;

  // 段 2: 5-20%（线性，从 0% 到 +10% 缩放）
  if (abs <= 20) {
    const factor = ((abs - 5) / 15) * 0.1;
    return 1 + sign * factor;
  }

  // 段 3: 20-50%（线性，从 +10% 到 +30%）
  if (abs <= 50) {
    const factor = 0.1 + ((abs - 20) / 30) * 0.2;
    return 1 + sign * factor;
  }

  // 段 4: 50%+（log 趋近上限 +50%）
  const factor = Math.min(0.5, 0.3 + 0.2 * Math.log10(abs / 50));
  return 1 + sign * factor;
}
```

**关键样本**：

- +5% → 1.00（基线）
- +10% → 1.033
- +20% → 1.10
- +50% → 1.30
- +100% → ~1.36
- +127%（NIL） → ~1.38
- +500% → 1.50（硬上限）
- -50% → 0.70
- -90% → ~0.65（log 缓和）

**Codex 副审要求**：实施前先 review 这个函数，给出反馈：

1. 四段切分是否合理？是否要调阈值（5%/20%/50%）？
2. log 上限 50% 是否够（视觉上 1.5x 撑得下么）？
3. ease-out 动画必须的：尺寸变化用 `transition: { type: 'spring', damping: 20, stiffness: 200 }` 还是 `{ duration: 0.6, ease: 'easeOut' }`？
4. 是否要给极端跌幅（< -90%）特殊处理（如灰度 + 闪烁警告）？

**Codex 副审反馈方式**：实施前在 `docs/codex-specs/spec-hero-interactive-stage-1-codex-review.md` 写副审意见，**有反对意见**回报 Session C，无反对直接实施。

### 3.3 抓爪动画（Desktop）

```
帧 0.0s：用户点击币
帧 0.0-0.5s：被点击币高亮（glow + scale 1.05）+ 同时并行触发 fetchHeroMiniPlayerData
帧 0.5-1.5s：机器人伸出爪子（绝对定位 SVG path，从机器人胸口长出到币位置）
帧 1.5-2.0s：爪子抓住币，币 + 爪子一起飞回机器人胸口（投币动画）
帧 2.0-2.5s：机器人胸口闪光（投币成功）+ Hero 高度 expand 动画启动
帧 2.5-3.5s：mini player UI 从下方滑入（slide up + fade in）
帧 3.5s+：mini player 内容渲染（如果 LLM 还在 fetch，显示 "Agent 正在分析..." spinner）
```

**性能要求**：

- 抓爪动画用 framer-motion + GPU transform（不 layout reflow）
- prefers-reduced-motion 时整个动画压缩到 0.5s（直接 fade in mini player）

### 3.4 mini player 布局

**Desktop（hero 内嵌，hero 高度 expand）**：

```
┌────────────────────────────────────────────────┐
│                                                │
│      [机器人图标，已抓住 BTC]                   │
│                                                │
│  💬 alpha: $BTC 距前低 0.36%, 下方止损单密集    │
│  💬 beta:  @alpha 这点先别急, 等下根确认        │
│  💬 gamma: @beta 我倾向看回归, 极端区域见底     │
│                                                │
│  ┌─────────────────────────────┐              │
│  │ 📊 Strategy: 多 BTC          │              │
│  │ 入场: 67,200 / 止损: 66,800  │              │
│  │ 信心: ●●●○○ 60%              │              │
│  └─────────────────────────────┘              │
│                                                │
│  [去看完整讨论 →]   [去 CoinW 多 BTC →]       │
│                                                │
└────────────────────────────────────────────────┘
```

**Mobile（全屏覆盖）**：

```
┌──────────────┐
│ [×] 关闭       │
│                │
│ [机器人 + BTC] │
│                │
│ alpha: ...     │
│ beta: ...      │
│ gamma: ...     │
│                │
│ ┌──────────┐ │
│ │ 多 BTC    │ │
│ └──────────┘ │
│                │
│ [完整讨论 →]   │
│ [去 CoinW →]  │
└──────────────┘
```

### 3.5 Hint 文案（Q-Hero-5 C）

Desktop：

- 文案 "👇 点击任意币种听 AI Agent 即时分析"（在 4 币上方居中，淡灰色小字）
- arrow 指向最热币（用 framer-motion drawing animation 画一条虚线箭头）

Mobile：

- 文案换位置（4 币竖排上方）
- arrow 简化为 "tap 任意币种" 的 hover-style hint

### 3.6 主页文案保留

- "遇见你的 AI 交易伙伴"（H1）
- "全球首个专注加密货币交易的 AI Agent 竞技养成生态"（subtitle）
- 现有 CTA "立即开始" + "API 文档"

mini player 的 CTA 是**新增**的，不替代现有 CTA。

---

## § 4. CTA 设计

### 4.1 mini player 内的 2 个 CTA

**CTA 1: "去看完整讨论"**

- 目标：引流到 watch 页（漏斗中段）
- URL：`/agent?symbol=${symbol}&from=hero` 或 `/[locale]/agent?symbol=${symbol}&from=hero`
- 埋点（Stage 2 接 PostHog）：`hero_cta_watch_click`
- Stage 1：直接 `<Link>` 跳转，不带埋点

**CTA 2: "去 CoinW {action} {symbol}"**

- 目标：引流到 CoinW 注册（漏斗末端）
- URL：`https://www.coinw.com/${userLocale}/register?r=XXCryptoEN&utm_source=claw42_hero&utm_campaign=${symbol}`
- 注：`utm_*` 参数 CoinW 后台是否解析待定，加上无害；referral code `XXCryptoEN` 是 Dan 给的占位
- Locale 路径映射：
  - claw42 zh_CN → CoinW `/zh_CN/`
  - claw42 zh_TW → `/zh_TW/`
  - claw42 en_US → `/en_US/`
  - claw42 ja_JP → `/ja_JP/`
  - claw42 ru_RU → `/ru_RU/`
  - claw42 uk_UA → `/uk_UA/`
  - claw42 fr_FR → `/fr_FR/`
  - claw42 es_ES → `/es_ES/`
  - claw42 ar_SA → `/ar_SA/`
  - claw42 en_XA → `/en_US/`（fallback）

### 4.2 CTA 文案 i18n

按 Q3 决策"用户分享"的 user job，CTA 措辞应该是**注册型**（不是交易型）：

- zh_CN: "去 CoinW 开户交易 BTC →"（不要写"多 BTC"，因为是去 register 不是直接 trade）
- en_US: "Open CoinW Account & Trade BTC →"
- ja_JP / ru_RU / uk_UA / fr_FR / es_ES：i18n 译文（10 语言全覆盖，CoinW 都有对应 locale 站）
- ar_SA：RTL 处理 `dir="rtl"`

---

## § 5. 文件结构（新建 + 修改）

### 新建

```
src/modules/landing/HeroScene/
├── HeroSceneInteractive.tsx         (新主组件，替代 HeroScene.tsx)
├── components/
│   ├── TrendingCoinSlot.tsx         (单币槽位，含涨缩动画)
│   ├── ClawAnimation.tsx            (抓爪 SVG + framer-motion)
│   ├── HeroMiniPlayer.tsx           (mini player 容器)
│   ├── MiniAgentMessage.tsx         (单条 Agent 评论)
│   ├── MiniStrategyCard.tsx         (strategy 卡)
│   ├── HeroCTAButtons.tsx           (mini player 内的 2 CTA)
│   └── HintArrow.tsx                (指向最热币的箭头)
├── hooks/
│   ├── useTrendingCoins.ts          (拉 /api/hero/trending-coins + sessionStorage 缓存)
│   └── useMiniPlayer.ts             (state: idle / picking / loading / shown)
├── utils/
│   ├── priceMovementToScale.ts      (涨缩映射函数)
│   └── computeTrendingScore.ts      (排序公式)
├── data/
│   └── stub-mini-player-data.ts     (Stage 1 占位数据，10 常见 symbol)
└── types/
    ├── mini-player.ts               (HeroMiniPlayerData 类型)
    └── trending-coin.ts             (CoinData 类型)

src/app/api/hero/
└── trending-coins/
    └── route.ts                     (新 API endpoint)
```

### 修改

```
src/app/[locale]/page.tsx            (替换 <HeroScene> 为 <HeroSceneInteractive>)
src/i18n/dicts/{zh_CN, en_US, ...}.json  (10 locale 加 hero.miniPlayer.* / hero.cta.* 字段)
package.json                          (无新依赖)
```

### 不动

```
src/modules/landing/HeroScene/HeroScene.tsx  (保留作 fallback，env flag HERO_INTERACTIVE_ENABLED 控制)
```

env flag `HERO_INTERACTIVE_ENABLED=true` 启用新版，false fallback 老版。**Stage 1 上线时默认 false**，A/B 测试 ready 后翻 true。

---

## § 6. 性能预算

| 项                                         | 预算                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `/api/hero/trending-coins` 响应时间        | < 200ms（cache hit）/ < 1500ms（cache miss + CoinGecko fetch） |
| Hero 首屏 LCP（不含 trending coins fetch） | < 2.5s（已是 Web Vitals 标准）                                 |
| 4 币 涨缩动画 FPS                          | ≥ 60fps（GPU transform，不 reflow）                            |
| 抓爪动画总时长                             | 1.5s（不含 mini player 渲染）                                  |
| mini player 完整渲染（含动画）             | < 3.5s（含 LLM stub fetch）                                    |
| 客户端 JS bundle 增量                      | < 30KB gzipped（不引入新外部依赖）                             |

---

## § 7. i18n 字段（10 locale）

```json
{
  "hero": {
    "miniPlayer": {
      "loadingAnalysis": "Agent 正在分析...",
      "strategyDirection": {
        "long": "做多",
        "short": "做空",
        "wait": "观望"
      },
      "confidence": "信心",
      "entry": "入场",
      "stop": "止损",
      "target": "目标"
    },
    "cta": {
      "watchFull": "去看完整讨论 →",
      "openCoinwAccount": "开通 CoinW 账户 →",
      "openCoinwAccountWithSymbol": "开通 CoinW 账户交易 {symbol} →"
    },
    "hint": {
      "tapAnyCoin": "👇 点击任意币种听 AI Agent 即时分析",
      "tapAnyCoinMobile": "Tap 任意币种"
    },
    "miniPlayerClose": "关闭"
  }
}
```

10 locale 全覆盖：zh_CN / zh_TW / en_US / ja_JP / ru_RU / uk_UA / fr_FR / es_ES / ar_SA / en_XA。

en_XA 用伪本地化（已有 pattern）。

---

## § 8. 验收标准

### 8.1 功能验收

- [ ] Desktop：访问主页，看到 4 个币环绕机器人，每币按 24h 涨跌幅有视觉缩放
- [ ] Mobile：访问主页，看到 4 币 2x2 竖排，机器人尺寸缩小
- [ ] 点击任一币 → 抓爪动画播放完整 → mini player 滑入显示 stub 数据
- [ ] mini player 内 3 条 Agent 评论 + 1 strategy 卡 + 2 CTA 都渲染
- [ ] CTA 1 跳 `/agent?symbol=X&from=hero`
- [ ] CTA 2 跳 CoinW register URL（带 r=XXCryptoEN，按 user locale 选 path）
- [ ] 用户停留期间币种不换（reload 页面才换）
- [ ] env flag `HERO_INTERACTIVE_ENABLED=false` 时 fallback 到老 HeroScene

### 8.2 数据验收

- [ ] `/api/hero/trending-coins` 返回 4 币（不含 stable）
- [ ] 排除 < $10M 24h volume 的币
- [ ] cache 30 min（验证 KV `hero:trending:*` key）
- [ ] CoinGecko cache miss 时 fallback 到上次 cache 数据 + 显示 stale 标识

### 8.3 视觉验收

- [ ] 涨 50% 的币明显大（约 1.30x）
- [ ] 跌 50% 的币明显小（约 0.70x）
- [ ] 极端值 NIL +127% 不撑爆 layout（约 1.38x）
- [ ] 抓爪动画流畅（60fps）
- [ ] prefers-reduced-motion: reduce 时动画压缩到 0.5s

### 8.4 i18n 验收

- [ ] 10 locale 全覆盖 hero 相关字段
- [ ] ar_SA RTL 布局正确（mini player 文字方向 + arrow 翻转）
- [ ] en_XA 显示伪本地化字符
- [ ] CTA URL locale path 映射正确

### 8.5 可观测性

- [ ] verify:a11y 跑通（mini player 焦点管理 + aria-label 完整）
- [ ] tsc + lint + build 全绿
- [ ] Web Vitals 不退化（LCP / CLS / INP）

---

## § 9. Codex 实施流程（含副审环节）

### 9.1 派发顺序

```
Step 1: Codex 副审涨缩函数（§ 3.2）
  - 落副审 docs/codex-specs/spec-hero-interactive-stage-1-codex-review.md
  - 给 Session C 反馈意见
  - 等 Session C 接受/调整后进 Step 2

Step 2: 实施
  - worktree 模式（/tmp/claw42-hero-stage1）
  - 临时切 agentxmain-collab
  - 按 § 5 文件结构落地
  - tsc + lint + build + verify:a11y 全绿
  - push + 开 PR

Step 3: cleanup + 切回原账号
```

### 9.2 副审环节具体内容

Codex 副审涨缩函数时回答 4 个问题：

1. 四段切分（5%/20%/50%）合理吗？是否要调阈值？
2. log 上限 50% 视觉撑得下吗？
3. ease-out 动画用 spring 还是 easeOut 时长？
4. 极端跌幅（< -90%）是否要特殊视觉处理（灰度 / 闪烁）？

副审输出格式：

```markdown
# Codex Stage 1 Review

## Q1 四段切分

[GO / GO with adjustment / NO-GO 原因]

## Q2 上限

[同上]

## Q3 动画

[推荐 spring / easeOut + 具体参数]

## Q4 极端跌幅

[GO / 推荐 X 处理]

## 实施建议

[补丁 list]
```

副审通过后 Codex 直接进入实施（不等 Session C 二次确认，除非有 NO-GO）。

---

## § 10. 不能做 / 失败处理

### 不能做

- ❌ 修改 task-18 PR #27 任何代码
- ❌ 修改 v2.0 master plan 文档
- ❌ 引入新外部依赖（lightweight-charts / 任何新包）
- ❌ Force push
- ❌ Commit 到 main
- ❌ 用真名 Mike
- ❌ 让 Hero 改动撞 main 已合的 web-vitals / a11y / error-boundary 代码（独立 module）
- ❌ Stage 1 接真 chatOrchestrator（必须 stub，留 Stage 2）

### 失败处理

- **CoinGecko API rate limit**：30min cache 应能挡，但 rate limit 时 fallback 到上次 cache + 显示 stale 标识；cache 都没有时显示 4 个 hardcoded 默认币（BTC/ETH/SOL/USDT）
- **`fetchHeroMiniPlayerData` symbol 没有 stub 数据**：用 `generateGenericStub(symbol)` 生成通用 stub
- **抓爪动画在某浏览器不流畅**：framer-motion 已是跨浏览器，问题罕见。若发生：fallback 到 fade in（无爪子动画）
- **i18n 漏字段**：Codex 必须为所有 10 locale 加全字段，缺一停下报回
- **Codex 副审涨缩函数 NO-GO**：报回 Session C，等新方案

---

## § 11. Stage 2 预告（不在本 spec）

Stage 2 在 Batch 4 task-18-v2 完成后启动。范围：

- 替换 `fetchHeroMiniPlayerData` stub → 真 chatOrchestrator + strategy synthesis
- 替换 hardcoded 占位 referral code → env config 化（Dan 拍板真版 code）
- 接 PostHog 埋点（`hero_cta_*` 事件）
- 用户停留时间分析（KV metrics）

Stage 2 spec 单独文档，不在本 spec 范围。

---

## § 12. 文档元信息

- **创建**：2026-05-08 by Session C
- **基础**：Q-Hero-1~8 + DeepSeek V4 Flash + 阶段化策略（Dan 8 May 拍板）
- **决策版本**：stage-1-locked
- **冻结清单**：§ 0 决策清单 + § 4.1 affiliate URL 模板（待 CoinW 真版替换）+ § 6 性能预算
- **下次允许变更**：(a) Codex 副审涨缩函数有 NO-GO / (b) 实施暴露不可行 / (c) Stage 2 启动时回写

---
