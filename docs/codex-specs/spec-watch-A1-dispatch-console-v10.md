# spec-watch-A1-dispatch-console-v10 (v1.4 · 2026-05-14 四修)

> **A 模块第一个 spec** — claw42 `/zh_CN/agent`（及 9 个其他 locale 同路由）从 v9 dispatch console（Phase B v2.1 实施）升级到 **v10 design**，承载 TradingAgents 11 Agent 6 阶段视觉架构。
>
> **核心约束**：UI only。不动 backend pipeline / Phase B v2.1 立的 payload schema / publicTimelineProjection / v9TopicAdapter。行情分析 panel **消费** Phase B v2.1 adapter 输出（不改 adapter 自身），hero + 流程介绍 panel 是新增静态展示层。
>
> **视觉权威**：`claw42/design-source/v10-dispatch-console-redesign/how-it-works.html`（1660 行 plain HTML/CSS/JS，Claude Design 出图，Dan 2026-05-14 拍板替换 v9）
>
> **架构定位**：A/B 模块拆分中的 A 模块（UI + 对外展示）。B 模块（pipeline 11 角色 backend 升级 + multi-round trace + memory_loop 真实施）由另一 session 并行执行，A1 必须避免和 B 写集冲突（见 § 0.5 A/B 并行 redline）。
>
> **v1.4 四修原因（2026-05-14 深夜 +++）**：Codex 第 4 轮 grep gate 仍命中 4 类 token（v1.3 留在修订原因段 / strike-through 作 audit trail，但 grep gate 严格匹配 string）。v1.4 彻底清除 audit token，**audit trail 单独由 decision-log 维护，spec 保持纯净 source of truth**。本版 token 清零，工程结构 / Tasks / SC / Anti-Rationalization 仍 v1.2 保留。
>
> 历史 changelog（v1.0 → v1.3）：见 `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md` 2026-05-14 各 entry。
>
> **v1.2 二修原因（2026-05-14 深夜）**：Codex 第 2 轮双脑评估（codex-to-claude.md 2026-05-14T21:35）评 v1.1 **方向对但 NO-GO implement**，原因：
>
> - **核心集成矛盾**（MAJOR）：AgentWatchBoard 当前硬编码 import + render DispatchConsoleV9，page.tsx 只渲染 `<AgentWatchBoard />`，**没有注入 V10 的 seam**。v1.1 又禁止 A1 改 AgentWatchBoard.tsx — 矛盾。需要 Dan 拍板 (a) B 先加 seam / (b) A1 owned 微编辑 1 行 / (c) A1 复制 polling（最差）
> - **4 项 STILL_OPEN minor**：AC2 / T032 仍说 30% threshold（应 0.12）/ § 18 grep check 仍引 zh_CN.ts（应 .json）/ § 17 row 1 仍说 12 agent（应 11 active）/ § 9.2 标题 "仅 2 个文件"（实际更多 dict + types.ts）/ § 4 Assumption #2 + § 6.4 还说要改 v9 WatchTabs/MarketAnalysisView（跟 § 0.5 矛盾）/ § 7.5 faceoff 历史描述应标 "未在 A1 使用"
> - **2 项 NEW issues**：v9 ChatShell CSS Module `.root :global(...)` 作用域 — v10 wrapper import 复用 v9 子组件时 styles 可能丢；constellation a11y 决策缺失（aria-hidden 装饰 vs 可交互）
>
> v1.2 修订：全部 minor 修 + 2 项 NEW 加上 + AgentWatchBoard seam 设计加新 Q + Anti-Rationalization 加 2 条覆盖 seam 和 CSS scope。seam 决策已 finalize 见 § 18 resolved 段。
>
> **v1.1 修订原因（2026-05-14）**：Codex 第 1 轮双脑评估（codex-to-claude.md 2026-05-14T20:45）NO-GO v1.0，列 11 项 [SPEC-FEEDBACK]：
>
> 1. A/B 并行 redline 缺失 → Codex 担心 A1 撞 B 写集；加 § 0.5 明确 OK list + Avoid list
> 2. i18n 路径错（spec 写 `.ts`，实际 `src/i18n/dicts/*.json` + `src/i18n/types.ts`）→ 全 spec 修
> 3. 11 vs 12 角色矛盾（hero constellation 实际只 11 个 anode 没 a-mem，a-mem 仅在 stage 6 + chat）→ § 7.2 明确"11 active + memory_loop 仅 flow/chat"
> 4. design source 不在 `origin/main`（当前是 dirty worktree） → 加 T013.5 把 design archive commit 到 main 作为前置
> 5. T042 stale（v9 WatchTabs 已含 `流程介绍 / 行情分析 LIVE` + array.join className）→ 删 T042，改 v10 自建 WatchTabs，不动 v9
> 6. Faceoff class mismatch（CSS 期望 `.fstage4.faceoff`，design HTML 是 `fstage4 debate` 无 faceoff） → 选 design HTML 为权威，spec 改 `fstage4.debate`
> 7. IntersectionObserver 阈值不一致（design `threshold:0.12 + rootMargin:'0px 0px -40px 0px'`，spec 写 30%） → 用 design 为权威
> 8. Static mock market data（design 含静态 BTC/ETH/SOL）混淆 live 表现 → § 7.6 + SC-001 明确 mock data 仅视觉参考，live 用 adapter 输出
> 9. Google Fonts 假设（CoinW prod 可能 block 外部 CDN）→ § 7.1 改用 app font infra，Google Fonts 作 fallback
> 10. Spec § 9 file count 不准（实际 > 13+4，加上 CSS/tests/docs） → § 9 重新 normalize 写集
> 11. Constellation 性能 → § 7.4 + § 11 加 prefers-reduced-motion + RAF/refs 替代 React state + cleanup + hidden pause

---

## 0. 必读纪律

### 0.1 三层防御（每个阶段强制）

- **层 1 跨域刷新**：每个 sub-phase 开始前重新 `cat` design 源（`claw42/design-source/v10-dispatch-console-redesign/how-it-works.html`）和当前 main HEAD v9 React 组件文件（DispatchConsoleV9.tsx / MarketAnalysisView.tsx / MessageBubble.tsx / TopicBody.tsx / WatchTabs.tsx 等），不依赖本 spec 写的类名 / 字段记忆
- **层 2 首件检验**：每个新增组件（Hero / Constellation / FlowPanel / FlowStageCard）实现后先单独 storybook / dev preview 验证视觉，再集成
- **层 3 同根因熔断**：同类视觉漂移（如 spacing / color 偏离 design）连续出现 2 次 → 立即停 + 退到 design tokens 对照表重做，不逐条修

### 0.2 双脑诊断（每个判断点）

凡看 first-hand data 做工程决策：Codex 必须自己下判断 + 写到 codex-to-claude.md，不只是报数据。本 spec § 18 列了必填判断点。

### 0.3 Anti-rationalization

- "Design 已经完整不用细化 spec" → ❌ Codex 不读 design HTML，spec 必须自包含；spec 引用 design 路径但关键 token / class / 行为在 spec 里复述
- "v9 现有组件改改就行不用新组件" → ❌ Constellation / FlowPanel / FlowStageCard 是新组件，不要硬塞进现有 React 树
- "i18n 10 locale 太多先做中英文" → ❌ CLAUDE.md i18n 纪律默认翻全 9 locale（en_XA 占位）
- "11 角色 backend pipeline 还是 7 角色，spec 里写 11 角色矛盾" → ❌ 本 spec 是 UI only，UI 展示 11 角色架构，backend 真实 7 角色由 Phase B adapter 兜底映射；B 模块独立 spec 处理 backend 升级
- "design 用 sentiment_analyst class 但 main HEAD 是 onchain_analyst" → ❌ 已 Codex 实测确认 `.a-sent` class 用于"链上数据分析主管 On-chain"，class 名是 design 历史残留，semantic = onchain，Phase B B.0 立的 schema 不冲突

---

### 0.5 A/B 并行 redline（v1.1 新增 — Codex 实证）

**背景**：Dan 已派另一 session 并行执行 B 模块（pipeline 11 角色 runtime + multi-round trace + memory_loop / partial stage writes / topic ranking / post-trade review/writeback）。A1 与 B 同时编辑同一 repo 时，**任何 v9 共享文件 / lib 文件的写集冲突都会触发 merge 风暴**。

A1 必须严格遵守以下文件 OK / Avoid 边界：

**A1 OK 写集**：

- ✅ `src/modules/agent-watch/v10/**`（v10 全新模块，含组件、CSS Module、hooks、types、staticContent、tests）
- ✅ `src/app/[locale]/agent/page.tsx`（v1.3 修订：**仅** `<AgentWatchBoard />` 改为 `<AgentWatchBoard console={DispatchConsoleV10} />`；page.tsx 其他逻辑不动）
- ✅ `src/i18n/dicts/*.json`（**仅添加** v10 新 key 在 agentWatch.dispatchV10 namespace；不删 / 不改现有 key）
- ✅ `src/i18n/types.ts`（仅添加 v10 类型；不改现有类型）
- ✅ `claw42/docs/codex-specs/spec-watch-A1-*.md`（本 spec 自己）
- ✅ `claw42/design-source/v10-dispatch-console-redesign/**`（design archive，独立 commit）
- ✅ `web-dev/decision-log.md`（追加 entry — 实际路径在 `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`，跟 claw42 平级，**不在** claw42 repo 内）
- ✅ A1 implementation worktree 内自己的临时文件

**A1 Avoid 写集（B 模块占用，A1 不触碰）**：

- ❌ `src/lib/watch/**` 全部（v9TopicAdapter / publicTimelineProjection / followStatsStore / intensityCalculator / topicAggregator / dispatchAgentMapping / safeMessageFormatter / pm_decision payload contract 所有 lib watch 文件）
- ❌ `src/app/api/watch/**`（API routes — timeline / follow-stats / trigger）
- ❌ `src/lib/team/**`（strategyDecisionRecord / tradeDecision / teamRegistry / pmDecisionPipeline）
- ❌ `src/lib/storage/kv-rate-limiter.ts`
- ⚠️ `src/modules/agent-watch/AgentWatchBoard.tsx` — **微编辑例外**（v1.2 F 拍板 Q-A b）：A1 可加 console prop seam（1 import + 1 prop type + 1 JSX 改 Console driven，**5-10 行**），**不动** data fetching / polling / topics 计算 / 其他 B 持有逻辑；B session 已知会，B trajectory 不撞 AgentWatchBoard
- ❌ `src/modules/agent-watch/v9/MarketAnalysisView.tsx`
- ❌ `src/modules/agent-watch/v9/WatchTabs.tsx`（已含正确文案 + array.join className，A1 改 = stale work）
- ❌ `src/modules/agent-watch/v9/MessageBubble.tsx`
- ❌ `src/modules/agent-watch/v9/ChatShell.tsx` / `Topic*.tsx` / `TopicBody.tsx` / `TopicStrategy.tsx`
- ❌ `src/modules/agent-watch/v9/DispatchConsoleV9.tsx`（保留作 reference，A1 merge 后独立 cleanup PR 删除）
- ❌ 现有 v9 module 任何文件（除非 F 显式 freeze B 并 reassign ownership）

**关键 insight**：A 模块**消费** stable `topics` surface（从 AgentWatchBoard 输出的 `DispatchTopic[]`），**不 reach into B internals**。Phase B v2.1 立的 adapter 输出是 stable interface，A1 通过 props 接收 topics 即可，不需要也不允许动 adapter 实现。

**Anti-Rationalization（针对 A/B redline）**：

- "v9 WatchTabs 文案差一点点改一下而已" → ❌ Codex 实测 v9 WatchTabs 已有 `流程介绍` + `行情分析 LIVE` + array.join className（X.1 修过），改 = stale work + 触发 B 模块 merge 冲突。A1 在 v10 内自建 v10/WatchTabs.tsx
- "MarketAnalysisView 只是 header 文案微调" → ❌ 同上，B 模块持有；A1 在 v10 内自建 v10/MarketAnalysisView.tsx（wrapper），通过 children/render prop 注入新 header，**不动 v9 文件**
- "import 路径绕一下少改一处" → ❌ Stable surface 是 AgentWatchBoard 输出的 topics prop，绕开 AgentWatchBoard = 绕开 B 模块的 data flow，禁止

---

## 1. Summary

把 claw42 `/zh_CN/agent`（含 9 个其他 locale）从 v9 dispatch console 升级到 v10 三段式（hero + 流程介绍 + 行情分析），承载 TradingAgents 11 Agent 6 阶段视觉。Hero + 流程介绍是新增静态展示层（含 11 角色 constellation 3D 互动 + 6 阶段流程卡片）；行情分析复用 Phase B v2.1 已实施的 v9TopicAdapter，输出真 LLM rationale 数据。

**用户感知层**：进站看到完整产品故事（"11 个角色 / 6 个阶段 / 每一笔都回灌下一轮"）+ 视觉互动 + 真实 AI 团队运转 chat。

**工程层**：UI 替换 + adapter 不动 + schema 不动。

---

## 1.5 User Stories（v2.5 § 1.5）

### US1 — 用户看完整 AI 团队故事（P1, MVP）

**作为** 一个对 AI trading 好奇但还不信的访客
**我希望** 进 /zh_CN/agent 路由就看到 hero "一笔交易决策 · 11 个角色 · 6 个阶段 协同产出" + 11 个机器人围绕中央 robot 的 constellation + 4 个统计 cell（11 Agents / 6 Stages / 2× Debate / ∞ Memory）
**这样** 我第一眼就知道 claw42 不是单 AI 拍脑袋，是一支专业团队

**Why P1**：转化漏斗第一层。Hero 视觉冲击决定用户是否往下滚 + 决定品牌信任。是这次升级最重要的差异化点。

### US2 — 用户看 6 阶段决策流程（P1, MVP）

**作为** 想了解 claw42 决策机制的访客
**我希望** 点 "流程介绍" tab → 看 6 阶段卡片（信息收集 / 多空辩论 / 交易方案 / 风险审查 / 最终决策 / 复盘沉淀）+ 每阶段角色 + 输入/流程/输出
**这样** 我理解每一步在做什么 + 跟人工 trading 工作流的对应关系

**Why P1**：教育层。让"11 角色"从口号变成可理解的产品事实。是 sales pitch 关键素材。

### US3 — 用户看实时 AI 团队工作（P1, MVP）

**作为** 已经对流程认可的访客
**我希望** 点 "行情分析 LIVE" tab → 看真实 AI 团队正在跑 BTC/ETH/SOL 的决策 chat + 完整 6 阶段消息流 + 策略卡（entry / SL / TP + 跟单按钮）
**这样** 我看到"真在跑"，不是 demo

**Why P1**：转化层。Phase B v2.1 已经接通真 pipeline，本次只是套新外壳。

### US4 — 用户 hover 探索 agent 角色（P2）

**作为** 在 hero 段停留的访客
**我希望** 鼠标 hover 任一 agent robot → 该 robot focus（场景 zoom + 其他 blur + reticle 取景框 + readout 数据 callout 显示 ID/ROLE/STAT）
**这样** 我能逐个理解 11 个角色都是干嘛的

**Why P2**：增强层。提升停留 + 信息密度，但不影响 MVP。

### US5 — 用户跳转到实时分析（P2）

**作为** 看完流程介绍的访客
**我希望** 点流程介绍 footer 的 "查看实时 AI 团队工作 →" CTA → 自动切到 mkt tab + 平滑滚动到 panel 顶
**这样** 我从静态学习无缝过渡到动态产品体验

**Why P2**：流转层。不影响 MVP 但优化体验。

---

## 2. Acceptance Scenarios（v2.5 § 2 — Given-When-Then）

### AC1（US1）— Hero 默认渲染

**Given** 用户访问 `/zh_CN/agent`
**When** 页面加载完成（DOMContentLoaded + React hydration）
**Then**

- 显示 hero 段（双列 grid 1:1.18，min-height 640px）
- 左列：eyebrow `claw 42 · dispatch console` + h1（含 `11 个角色 · 6 个阶段` lime 强调）+ sub + 4 cell meta（11/6/2×/∞）+ 双 tab `流程介绍 active / 行情分析 LIVE`
- 右列：11 个 agent robot constellation + 中央 robot core，sceneBreath 18s + sceneSpin 42s 动画自动启动
- 默认 tab = `流程介绍`，panel-flow active

### AC2（US2）— 流程介绍 tab 6 阶段卡片

**Given** panel-flow 处于 active 状态
**When** 用户向下滚动
**Then**

- 6 个 fstage4 article 按顺序进入 viewport
- 每张 stage 卡 IntersectionObserver 触发 .in-view（**threshold: 0.12 + rootMargin: '0px 0px -40px 0px'**，按 design HTML 实测；90ms stagger）
- 每张含 left side（编号 + 阶段名 + 角色 chip）+ right body（fagent grid + detail panel 输入/流程/输出）
- stage 之间有 stage-connector SVG flowing dashes 衔接
- final stage (PM) 用 lime border，memory stage 用 dashed border

### AC3（US3）— 行情分析 tab 真 pipeline 数据

**Given** 用户切到 `行情分析 LIVE` tab
**When** panel-mkt active
**Then**

- chat-shell-head 显示统计（热点 / 已闭环 / 辩论中 / 起步）
- chat-shell-body 渲染 Phase B v2.1 adapter 输出的 topics（events.length ≥ 1 时）
- 每个 topic 含完整 6 stage msg 流 + topic-strategy 卡 + follow stats
- 兜底：events 空时显示"AI 团队正在等待新热点..."占位

### AC4（US4）— Hero constellation hover focus

**Given** 用户鼠标进入 hero-right 区域
**When** 鼠标距某 agent node 中心 < 160px
**Then**

- 该 agent .anode.is-focus
- .constellation.focused（scene 整体 zoom 1.42x + translate）
- 其他 tier-c blur 4px / tier-b blur 2px / tier-a blur 1px
- 该 agent reticle 取景框淡入（1.8s easing）
- 该 agent readout 数据 callout 淡入（1.7s delay）
- core robot 灰化 opacity:0.32 + blur 1.5px

**SWITCH_HYSTERESIS = 0.78**：切换 focus 需要新距离 < 旧距离 \* 0.78
**Leave grace**：mouseleave 后 320ms 才 releaseFocus

### AC5（US5）— Footer CTA 跳转

**Given** 用户在 panel-flow 滚到底
**When** 点击 `查看实时 AI 团队工作 →` button
**Then**

- panel-mkt 激活
- 平滑滚动到 panel-mkt 顶部（behavior: smooth, block: start）
- panel-flow display: none
- panel-mkt display: block

### AC6 — Legacy 路由兼容（兼容性轴）

**Given** Phase B v2.1 staging URL 用户访问书签
**When** A1 上线后访问 `/zh_CN/agent`
**Then** 旧 URL 不返回 404，自动展示新 v10（不需要 redirect，路由路径不变只是组件树替换）

### AC7 — i18n 10 locale 完整

**Given** 用户切到 `/ja_JP/agent` / `/en_US/agent` 等其他 9 个 locale
**When** 页面加载
**Then** 所有 user-facing 文字本地化（hero / tab / 6 阶段名 / 11 角色名 / footer CTA），不出现 zh_CN 残留 / lorem / missing key

---

## 3. Edge Cases 4 轴（v2.5 § 3）

| 轴           | Edge Case                                                  | 处理                                                                                                     |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Input**    | Phase B adapter 返回 events=[]                             | chat-shell-body 渲染 "AI 团队正在等待新热点..." 占位 + 灰色 icon，保持容器视觉                           |
| **Input**    | constellation 区域宽度 < 400px (rare resize)               | 自动退化为 single-column hero layout（@media max-width:1100px），constellation min-height 440px          |
| **State**    | 用户在 constellation focused 状态切到 mkt tab              | onTabChange 触发 releaseFocus(); 避免 focus state 跨 panel 泄漏                                          |
| **State**    | 用户连续快速切换 tab（< 100ms 间隔）                       | React state 用 useTransition 包装，避免 layout thrash                                                    |
| **State**    | tab 切换中 IntersectionObserver 触发 stage entry animation | 切回 flow tab 时不重复 trigger（io.unobserve 已实施）                                                    |
| **Boundary** | viewport > 2560 (4K)                                       | content max-width 1240 居中，hero-right constellation 不无限放大                                         |
| **Boundary** | viewport < 880 (mobile)                                    | hero 单列 / fstage4 单列 / fagents-N 单列 / topic-strategy 单列（design @media 已写）                    |
| **Boundary** | font-size 用户 OS 设置 1.5x                                | rem-based 字体跟随，但 design 用 px — F 决策：保留 px（设计精度优先），加 a11y warning 文档              |
| **Failure**  | Google Fonts 加载失败 / 慢                                 | font-family fallback chain（Manrope → Noto Sans SC → PingFang SC → 微软雅黑 → system-ui），display: swap |
| **Failure**  | Phase B adapter throw error                                | error boundary 捕获 + chat-shell 渲染 "数据加载中..." retry CTA                                          |
| **Failure**  | IntersectionObserver 浏览器不支持（极老）                  | fallback: 所有 fstage4 立即 .in-view                                                                     |
| **Failure**  | constellation hover JS 出错                                | 不阻塞页面，agent 静态展示无 focus 交互                                                                  |

---

## 4. Assumptions（v2.5 § 4）

显式假设清单：

1. **Phase B v2.1 全部不动** — adapter / projection / pm_decision payload schema / kv-rate-limiter / followStatsStore / safeMessageFormatter / Clock 子组件拆分 / polling 逻辑 全部沿用
2. **v9 React 组件仅 import 复用（不修改）** — v1.2 修订（Codex 第 2 轮）：A1 只 import 复用 v9 内层子组件（如 ChatShell / MessageBubble / TopicBody / Topic / TopicStrategy），**不动** v9 WatchTabs.tsx / MarketAnalysisView.tsx / DispatchConsoleV9.tsx 等 page-level 组件；v10 自建 WatchTabs / MarketAnalysisPanel / DispatchConsoleV10 wrapper。**注意**：v9 子组件用 CSS Module `.root :global(...)` 作用域，v10 wrapper 必须按 § 7.6 处理 CSS scope 避免样式丢
3. **11 角色视觉对应已设计** — design 已 hardcode 11 个 agent class + color + role 文字；spec 不重新定义角色语义
4. **i18n dict 路径**（v1.1 修订 — Codex 实测）— 实际是 `src/i18n/dicts/<locale>.json`（**JSON 不是 TS**），加上 `src/i18n/types.ts` 持类型定义。A1 添加 key 在 `agentWatch.dispatchV10` namespace 下
5. **font 加载策略**（v1.1 修订 — Codex 提示）— **优先用 claw42 app 现有 font infra**（Phase 1 已立的 Next.js font 加载机制，避免 CoinW prod 网络层 block 外部 CDN）；design 引用的 Google Fonts (`fonts.googleapis.com`) 作 fallback 不作主路径。font-family chain 保留 Manrope → Noto Sans SC → PingFang SC → 微软雅黑 → system-ui
6. **设备目标** — 桌面优先（desktop 1440/1280），mobile 退化（375）是次要；Phase B 时 Dan 已拍板"不考虑移动端"，A1 沿用，但 design 已含 mobile 退化 CSS 不删
7. **A11y 标准** — 沿用 v9 a11y semantics（aria-selected / role=tab / role=tabpanel / aria-expanded），新增组件按同标准
8. **跟单按钮** — 沿用 Phase B v2.1 Q4 拍板（占位不真执行交易，POST follow stats）
9. **双 prod 锁定**（constitution v0.1.1 Rule 2 amend，2026-05-14）：
   - Tier 1 真 prod = `ai.coinw.com/claw42`（CoinW GitLab + Jenkins，专用电脑推送，F/Codex 无权限）— A1 不触碰，发布由 Dan 手动推
   - Tier 2 锁定 prod = `claw42.ai`（Vercel agentxmain-collab）— A1 merge 进 main 仅 staging 累积，不带 `--prod`，不上 prod 除非 Dan 明确 release
   - 当前两个 prod 都跑 10 多天前 main HEAD（Phase B v2.1 等改动都未上 prod）— A1 实施期间继续在 GitHub + Vercel preview staging 累积，不变此现状
10. **CoinW GitLab 推送限定专用电脑** — F/Codex 当前工作流不应尝试推 CoinW GitLab；任何 push 尝试立即停 + 报告 + 待 Dan 接管
11. **新视觉权威源** — `claw42/design-source/v10-dispatch-console-redesign/how-it-works.html` 是本次升级唯一视觉权威（spec 引用路径稳定）

---

## 5. Measurable Success Criteria（v2.5 § 5）

| ID     | 指标                                                         | 测量方法                                                                                                          | 阈值                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-001 | 视觉零回归 vs design baseline                                | Playwright screenshot diff at 1440×1000 / 1280×800 desktop / 375×812 mobile                                       | **结构性对照**：class/CSS/layout 0 改动；hero / flow panel 静态部分 mean_abs_rgb < 8；**mkt panel 不做精确文字对照**（live 用 Phase B adapter 真 topics，跟 design 静态 BTC/ETH/SOL mock 必然不同 — design mock 仅视觉参考） |
| SC-002 | constellation hover focus 触发延迟                           | DevTools performance trace + mousemove → focus class apply 间隔                                                   | < 100ms p95                                                                                                                                                                                                                  |
| SC-003 | tab 切换响应                                                 | useState set → DOM repaint 间隔                                                                                   | < 50ms，无 CLS layout shift                                                                                                                                                                                                  |
| SC-004 | stage entry animation 全卡显示完成                           | IntersectionObserver (threshold: 0.12 / rootMargin: '0px 0px -40px 0px') trigger → 第 6 张 .in-view 加 class 完成 | < 800ms（6 × 90ms stagger + 300ms animation 含 buffer）                                                                                                                                                                      |
| SC-005 | 真 pipeline 数据接通                                         | 不带 STAGING_USE_FIXTURE 跑 staging，curl `/api/watch/timeline`                                                   | events.length ≥ 1 + payload 含 symbol + 真 LLM rationale 渲染                                                                                                                                                                |
| SC-006 | i18n 完整                                                    | grep + automated check 10 locale dict 含所有新加 key                                                              | 0 missing key，0 lorem，0 zh_CN 残留                                                                                                                                                                                         |
| SC-007 | Lighthouse perf mobile (graceful 标准，**非 pixel-perfect**) | npm run lighthouse mobile                                                                                         | Performance ≥ 65（hero constellation 3D 动画密集；moblie 验收为"graceful fallback"非"pixel-perfect"，design 自带 @media max-width:880 fallback 启用即可，不强求 desktop 完整动画在 mobile 跑）                               |
| SC-008 | a11y axe violations                                          | npm run verify:a11y                                                                                               | 0 violations                                                                                                                                                                                                                 |
| SC-009 | 工程量收敛                                                   | git commit count + AI 天数                                                                                        | merge 时 ≤ 14 个 commit，≤ 10 AI 天                                                                                                                                                                                          |
| SC-010 | Codex 双脑评估收敛                                           | [SPEC-FEEDBACK] 轮数                                                                                              | ≤ 2 轮收敛到 implement                                                                                                                                                                                                       |

---

## 6. 现状盘点

### 6.1 main HEAD 状态（v1.1 修订 — Codex 实测确认）

- v9 dispatch console 跑在 `/zh_CN/agent` 等 10 locale 路由
- `/[locale]/agent/page.tsx` **只 import AgentWatchBoard**，不直接 import v9 — A1 改 page.tsx 时也通过 AgentWatchBoard 注入
- AgentWatchBoard 通过 `mapPublicTimelineEventsToTopics()` 输出 `topics` 给 DispatchConsoleV9（**这是 A 应该消费的 stable surface**）
- DispatchConsoleV9 props: `topics / initialView / onViewChange / onTopicAction / marketSnapshot`
- MarketAnalysisView props: `topics?: DispatchTopic[]`，fallback `dispatchTopics`，header 文字 hardcoded
- WatchTabs.tsx **已含**：`流程介绍 / 行情分析 LIVE` + array `.filter(Boolean).join(" ")`（X.1 修过）→ **A1 不动 v9 WatchTabs**
- Phase B v2.1 已接 real pipeline (DeepSeek)，events.length=1 验证过
- Phase B B.0 schema 升级：pm_decision payload 含 symbol（required string）
- dispatchAgentMapping.ts 映射 7 TeamMemberId（fundamental / news / chart / onchain / research_lead / risk_lead / pm）到 12 个 DispatchAgentId（含 memory_loop 是 synthetic role，不由 real member 产生）
- safeMessageFormatter + MessageBubble React.memo + DispatchConsoleV9 Clock 拆分都已落地
- i18n dict 实际路径：`src/i18n/dicts/*.json`（JSON 文件，**不是** TS）+ `src/i18n/types.ts`

### 6.2 design 状态（这次任务）

- 视觉权威源：`claw42/design-source/v10-dispatch-console-redesign/how-it-works.html` (1660 行)
- design tokens 全在 :root（13 colors + 2 radius + 1 max + 2 font），跟 v9 完全一致
- 11 个 agent class（含 `.a-sent` 用于"链上数据分析主管 On-chain"，class 名历史残留）
- 6 阶段 fstage4 卡片设计 + stage-connector SVG flowing dashes 衔接
- chat-shell / topic / msg / topic-strategy 复用 v9 class 系统
- 4 个 IIFE JS：constellation hover / stage entry animation / tab toggle / topic collapse

### 6.3 待新增 React 组件

- `Hero.tsx` — 双列 grid 容器
- `HeroLeft.tsx` — eyebrow + h1 + sub + meta + tabs
- `HeroRight.tsx` — constellation 容器
- `Constellation.tsx` — 11 agent 3D 布局 + proximity hover 逻辑
- `AgentNode.tsx` — 单个 agent robot（含 reticle + readout + tip-card）
- `FlowPanel.tsx` — 流程介绍 panel 容器
- `FlowStageCard.tsx` — 6 个 stage 卡片
- `FlowFooterCTA.tsx` — 跳转到 mkt tab 的 CTA
- `Clock.tsx` — 现有（Phase B 拆出）继续用
- `useStageEntryAnimation.ts` — IntersectionObserver hook
- `useConstellationFocus.ts` — proximity hover hook

### 6.4 待修改文件清单（v1.2 修订 — 不动 v9 任何 page-level 组件）

- `src/app/[locale]/agent/page.tsx`：（v1.2 F 拍板 Q-A b 后已 finalize）`<AgentWatchBoard />` → `<AgentWatchBoard console={DispatchConsoleV10} />`；page.tsx 其他逻辑不动
- `src/i18n/dicts/*.json` (10 locale)：仅添加 `agentWatch.dispatchV10` namespace 新 key（不删/改现有 key）
- `src/i18n/types.ts`：仅添加 v10 namespace 类型
- `web-dev/decision-log.md`：追加 spec v1.2 修订 entry

**v1.2 删除 v1.1 stale 待修改项**：

- ~~v9 WatchTabs.tsx~~（v1.1 stale；v9 已含正确文案，A1 在 v10 自建 WatchTabs.tsx）
- ~~v9 MarketAnalysisView.tsx~~（v1.1 stale；A1 在 v10 自建 MarketAnalysisPanel.tsx wrapper）

### 6.5 不动

- v9 dispatch console 现有的 MessageBubble / TopicBody / SafeMessageFormatter / FollowStatsStore / v9TopicAdapter / publicTimelineProjection / pm_decision payload schema 全部不动
- v9 WatchTabs.tsx / MarketAnalysisView.tsx / ChatShell.tsx / Topic\*.tsx 全部不动（A1 在 v10 内自建 wrapper）
- AgentWatchBoard.tsx **仅 A1 owned 微编辑 console seam**（v1.2 F 拍板 Q-A b，§ 9.2 / T043 — 加 console prop type + 1 行 JSX driven），data fetching / polling / topics 计算 / 其他全部不动
- Phase B v2.1 立的 polling / kv-rate-limiter / Clock isolation 不动
- claw42.ai prod / ai.coinw.com/claw42 prod 都不动（constitution v0.1.1 Rule 2）
- 11 个其他工程项目 / pipeline / backend 不动

### 6.6 Top nav 决策（v1.1 新增 — Codex Q9.2）

**Design HTML 含**：`nav.topnav` (position:fixed, height:72px, blur backdrop) + `main{padding-top:72px}` 给 nav 留位

**Next app 现状**：已有 global layout / header pattern（page.tsx 自身不渲染 nav，但 layout.tsx 可能有）

**A1 决策：EXCLUDE design topnav**（推荐）：

- 用 Next app 现有 global header / layout
- A1 page-level **不渲染** `nav.topnav`
- A1 容器（`<main>` 等价物）**不加 padding-top:72px**（global layout 已处理 page padding）
- 视觉上 hero 顶部直接接 global header，不会出现重复 nav

**反推**：design 的 `nav.topnav` 是 standalone HTML preview 自带的页面外壳，不是 claw42 app 需要的层。A1 把 design 视觉权威范围限定在 `<main>` 内（hero + flow + mkt panel 三段），不含 nav。

如 design topnav 内的 `实时分析` 绿点 nav-btn / 语言切换器跟现有 global header 功能重叠 → 由 global header 处理，A1 不重复实现。

---

## 7. 技术上下文（详细）

### 7.1 Design Tokens（v1.1 修订 — Codex Q2 推荐 scoped CSS Module）

**落点决策**：v10 scoped CSS Module，**不进 globals.css**。

原因：design HTML 用了大量通用 selector（`main` / `.hero` / `.topic` / `.title` / `.subtitle` / `.msg` / `.topnav`），如果直接进 globals.css 会跟现有 landing / v9 / global 样式碰撞。

实施方式：单一 `.dispatch-console-v10` root namespace 包裹所有 v10 子组件，所有 design class 都 scoped 在该 namespace 下。Token CSS variable 也定义在 `.dispatch-console-v10` 选择器内（不在 `:root`），避免污染全局。

```css
/* src/modules/agent-watch/v10/DispatchConsoleV10.module.css */
.dispatchConsoleV10 {
  --bg: #000;
  --card: #171717;
  --line: rgba(255, 255, 255, 0.08);
  --line-2: rgba(255, 255, 255, 0.14);
  --fg: #fff;
  --fg-2: #a6a6a6;
  --fg-3: #949494;
  --purple: #5227ff;
  --purple-2: #7c5cff;
  --lime: #d1ff55;
  --err: #e95032;
  --ok: #14a739;
  --warn: #fed500;
  --radius-card: 16px;
  --radius-panel: 24px;
  --content-max: 1240px;
  /* font — v1.1 修订：用 app font infra（如 Next.js next/font），design Manrope 等通过 app font 加载，不直接引用 Google Fonts CDN */
  --font-display: var(--app-font-display, system-ui, sans-serif);
  --font-mono: var(--app-font-mono, ui-monospace, monospace);
}
```

如 v10 需要全局 keyframes（如 `@keyframes pulse`），用 CSS Module `:global()` 语法或独立 CSS file 引入。

### 7.2 11 Agent 角色清单 + class 映射

| Design class | 中文名           | English           | Role code | TeamMemberId（main HEAD 真实）                                                 |
| ------------ | ---------------- | ----------------- | --------- | ------------------------------------------------------------------------------ |
| a-fund       | 基本面研究主管   | Fundamentals      | F         | fundamental_analyst                                                            |
| a-sent       | 链上数据分析主管 | On-chain          | O         | onchain_analyst（class 名历史残留）                                            |
| a-news       | 宏观情报分析师   | News              | N         | news_analyst                                                                   |
| a-tech       | 技术策略主管     | Technical         | T         | chart_analyst（命名 mismatch，adapter 映射）                                   |
| a-bull       | 多头策略师       | Bullish           | ↑         | research_lead（单一 → 渲染为 bullish_researcher）                              |
| a-bear       | 空头策略师       | Bearish           | ↓         | research_lead（同上，渲染为 bearish_researcher）                               |
| a-trade      | 交易策略总监     | Trader            | $         | （pipeline 不存在；Phase B 立的 adapter 从 tradeDecision 派生 trader message） |
| a-aggr       | 收益进攻官       | Aggressive        | A         | risk_lead（单一 → 渲染为 neutral_reviewer 之一）                               |
| a-neut       | 组合平衡官       | Neutral           | N         | risk_lead                                                                      |
| a-cons       | 风险防御官       | Conservative      | C         | risk_lead                                                                      |
| a-pm         | 首席投资官       | Portfolio Manager | PM        | pm                                                                             |
| a-mem        | 策略复盘主管     | Reflection        | ∞         | （pipeline 不存在；UI 静态展示 / Phase B 立 stage-6 永远 pending）             |

**A1 范围**（v1.1 修订 — 解决 11/12 角色矛盾）：

- **Hero constellation = 11 个 active decision agent**（**不含 a-mem**）— Codex 实测 design HTML 含恰好 11 个 `.anode` 节点，对应 fund / sent / news / tech / bull / bear / trade / aggr / neut / cons / pm
- **Flow panel stage 6 = a-mem（策略复盘主管 / Reflection / ∞）**— 仅在 flow 流程介绍 panel 第 6 阶段卡片显示，作为 memory_loop 视觉表达
- **Mkt panel chat = 通过 Phase B v2.1 adapter 兜底出 a-mem msg**（adapter 已立 stage-6 永远 pending，A1 不动）

整体：**11 hero + 1 flow-only memory_loop = 12 distinct dispatch agent ID**（但 hero 只渲染 11 个，constellation 不包含 a-mem）。任何"hero 加 a-mem"的扩展属于 design 变更，不是 A1 scope。

Backend 真实角色继续走 Phase B adapter 映射，不动。Trader / Bull / Bear / Aggr / Neut / Cons 在静态 hero + flow panel 是 hard-coded 视觉位置 + 文案，在 mkt panel chat 通过 Phase B adapter 出现。

### 7.3 6 阶段定义 + 视觉对应

| Stage | 中文     | English           | Class                                                                                      | Agent count   | 特殊 layout                                          |
| ----- | -------- | ----------------- | ------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------- |
| 1     | 信息收集 | ANALYSTS          | fstage4                                                                                    | 4 (fagents-4) | parallel grid 4 col                                  |
| 2     | 多空辩论 | RESEARCHERS       | fstage4.debate（v1.1 修订 — design HTML 实测**无** `.faceoff` class，仅 `fstage4 debate`） | 2 (fagents-2) | grid-template-columns: repeat(2, 320px) 双 card 横排 |
| 3     | 交易方案 | TRADER            | fstage4                                                                                    | 1 (fagents-1) | single card                                          |
| 4     | 风险审查 | RISK REVIEW       | fstage4.debate                                                                             | 3 (fagents-3) | 3 col grid                                           |
| 5     | 最终决策 | PORTFOLIO MANAGER | fstage4.final                                                                              | 1 (fagents-1) | lime border + single card                            |
| 6     | 复盘沉淀 | MEMORY LOOP       | fstage4.memory                                                                             | 1 (fagents-1) | dashed border + a-mem                                |

### 7.4 Constellation 3D 布局参数

```ts
// hero-right .constellation container
perspective: 1400px
transform-style: preserve-3d
min-height: 620px (auto-scale)

// scene animations
sceneBreath: 18s infinite (translateZ 0→40→0 + scale 1→1.04→1)
sceneSpin: 42s infinite (rotateY -6°→6°→-6° + rotateX 2°→-1°→2°)

// 3 tier z-depth
tier-a: --tz: 80px,  --size: 60px, --bob: 8px, --dur: 5s   (3 agents: bull / bear / trade — foreground)
tier-b: --tz: 0,     --size: 44px, --bob: 5px, --dur: 5.6s (4 agents: fund / sent / cons / pm — mid)
tier-c: --tz: -80px, --size: 38px, --bob: 3px, --dur: 6.4s (4 agents: news / tech / aggr / neut — background, blur 0.4px, opacity 0.78)

// proximity hover
PICK_RADIUS: 160px
SWITCH_HYSTERESIS: 0.78
mouseleave grace: 320ms
focused scene transform: translate3d(fx, fy*0.7, 220px) scale(1.42)

// v1.1 性能要求（Codex Q4 高风险）
// 1. prefers-reduced-motion: reduce — 关闭 sceneBreath / sceneSpin / chat-arc dashFlow / ring breathing 所有 infinite 动画
// 2. mouse pointer position → constellation CSS variable (--fx / --fy / --ox / --oy) 更新：用 useRef + requestAnimationFrame，**不用 React state**（避免每次 mousemove 触发整树 re-render）
// 3. 节点 centers 测量：只在 mount / resize 时 measure，pointer 处理函数内不做 layout read
// 4. cleanup：所有 event listener 在 useEffect 返回的 cleanup function 中 removeEventListener；leaveTimer / RAF handle 都 cancel
// 5. document.visibilityState === "hidden" 时暂停所有 RAF / setTimeout 动画
// 6. AgentNode + 静态 role array 用 React.memo + module-level constants 避免 11 个 anode 都重 render
// 7. @media max-width:880px design 自带 fallback CSS — flatten 重 connector / 减少 perspective 计算
// 8. A11y 决策（v1.2 新增 — Codex 第 2 轮 NEW issue）：
//    constellation 整体视为**装饰性**视觉，标 aria-hidden="true"。
//    所有 agent role 描述 / 名称 / 能力说明在 flow panel 6 stage 卡片内**accessible 重复出现**（fagent-name / fagent-role / fagent-desc 都是 readable text，无 aria-hidden）。
//    screen reader 用户跳过 constellation 直接读 flow panel，信息完整不丢失。
//    Reticle / readout / tip-card 也都 aria-hidden 装饰。
//    AgentNode 不需要 keyboard focus / tab navigation — 鼠标 proximity hover 是 enhancement，键盘用户从 flow panel 拿同样信息。
//    如未来要加 keyboard explore 模式（每个 agent 可 tab 聚焦看 readout）→ 独立 spec 后续做。

// agent position (left% / top%)
tier-c.a-news: 69% / 19%
tier-c.a-tech: 32% / 21%
tier-c.a-aggr: 61% / 83%
tier-c.a-neut: 8%  / 28%
tier-b.a-fund: 71% / 38%
tier-b.a-sent: 88% / 51% (--tz:-15px)
tier-b.a-cons: 17% / 73% (--tz:-20px)
tier-b.a-pm:   50% / 28% (--tz:20px)
tier-a.a-bull: 20% / 50%
tier-a.a-bear: 69% / 62%
tier-a.a-trade:42% / 71%
```

### 7.5 6 阶段 fagent 位置（流程介绍 panel）

每个 fstage4 的 right body 用 `.fagents` grid 容器：

- `fagents-1`: grid-template-columns: 320px (单 card)
- `fagents-2`: grid-template-columns: repeat(2, 320px) (普通双 card)
- ~~`fagents-2 + faceoff`: grid-template-columns: 1fr 96px 1fr (含 VS 中分)~~ — **A1 未使用**（design HTML 实测 stage 2 是 `fstage4 debate` 无 faceoff，CSS rule `.fstage4.faceoff` 是 design 内未启用的备选样式；A1 stage 2 用普通 `fagents-2` 双列 320px）
- `fagents-3`: grid-template-columns: repeat(3, 1fr) max-width: 820px
- `fagents-4`: grid-template-columns: repeat(4, 1fr)

每个 fagent card 含 fagent-head（avatar 30x30 + name + role mono label）+ fagent-desc 一行说明。

### 7.6 行情分析 panel（v1.1 修订 — 不动 v9，包 v10 wrapper 消费 stable surface）

**A1 不动**：v9 现有 chat-shell / topic / topic-strategy / msg / msg-quote / stage-marker / MarketAnalysisView.tsx 全部不动（B 模块占用）。

**A1 新建**：`v10/MarketAnalysisPanel.tsx`（v10 wrapper）— 接收从 AgentWatchBoard 输出的 `topics: DispatchTopic[]` stable surface 作为 props，渲染时调用 v9 现有 `MarketAnalysisView` 或 `ChatShell` 子组件（**import 复用 + 不修改**）。如 v10 需要 chat-shell-head 文案 / stats 4 项（热点 / 已闭环 / 辩论中 / 起步）变化 → 在 v10 wrapper 内自渲染 head，body 部分（topic list）才用 v9 子组件。

**关键：design HTML 含静态 BTC/ETH/SOL 完整 mock data**（v1.1 修订 — Codex Q9.5）：

- design `chat-shell-body` 内有 3 个 hardcoded topic（BTC SHORT 5% / ETH SHORT 6% +0.8% / SOL LONG 4%），每个含完整 6 stage msg 流 + topic-strategy 卡 + 真实文案
- 这些 mock data **仅作视觉参考**（验证 v10 wrapper 渲染 layout / spacing / 颜色 / 文字层级正确）
- **A1 实施时 live mkt panel 必须用 Phase B v2.1 adapter 输出的真 topics**，不能 hardcode design mock topics
- 验收 SC-001 screenshot diff：mkt panel 区域**不做精确文字对照**（live 跟 design mock 文字必然不同），只对照 **结构 / layout / class / spacing 不变**

如 mkt panel 空（events.length=0），用 Phase B v2.1 已立的 fallback "AI 团队正在等待新热点..." 占位，不显示 design mock data。

**v9 CSS Module scoping 处理（v1.2 新增 — Codex 第 2 轮 NEW issue）**：

v9 ChatShell / Topic / MessageBubble 等子组件的 CSS 写在 `dispatchConsoleV9.module.css` 内，用 `.root :global(...)` 作用域。意思是 v9 那些组件渲染出来的 DOM 含 `.chat-shell` / `.topic` / `.msg` 等全局类名，但实际样式只在父元素含 `dispatchConsoleV9.module.css` 的 `.root` class（即 `v9Styles.root`）时才生效。

如果 v10 MarketAnalysisPanel 简单 `import ChatShell from "../v9/ChatShell"` 后直接渲染，**结构有但样式丢** — 渲染的 DOM 含 chat-shell / topic / msg 类，但因为没有 v9 module root 包裹，CSS 不命中。

**v1.2 决策（preferred）**：v10 MarketAnalysisPanel 内**包一层** v9 module root class

```tsx
// src/modules/agent-watch/v10/MarketAnalysisPanel.tsx
import v9Styles from "../v9/dispatchConsoleV9.module.css";
import ChatShell from "../v9/ChatShell";
import marketStyles from "./MarketAnalysisPanel.module.css";

export function MarketAnalysisPanel({ topics }: Props) {
  return (
    <section className={marketStyles.panel}>
      {/* v10 自建 header（不复用 v9 MarketAnalysisView header） */}
      <header className={marketStyles.header}>...</header>
      {/* v9 子组件包在 v9 root scope 内 */}
      <div className={v9Styles.root}>
        <ChatShell topics={topics} />
      </div>
    </section>
  );
}
```

**备选方案（如 v9 module root 不 export 或 import 冲突）**：

- 选项 (i)：把 v9 chat-shell / topic / msg 等关键 CSS rules **复制** 到 v10 module（增加维护成本，需要 sync v9 升级）
- 选项 (ii)：完全 reuse v9 `MarketAnalysisView`（含 v9 header + ChatShell + 自带 v9 styles root） — 但 design v10 head 文案不同，**接受 v9 header 文案**作为 trade-off
- 选项 (iii)：v10 MarketAnalysisPanel 自实现完整 chat-shell / topic / msg 渲染（**复制** v9 子组件逻辑），不 import v9 — 但 = duplication，违反 DRY

**F 推 preferred 方案**（v9Styles.root wrapper），fallback (ii) 如 wrapper 在 React Module 跨 module CSS import 出问题。

Codex 实施时必须 grep `dispatchConsoleV9.module.css` 看实际是否 export `root` class + 是否所有 `:global()` 规则都在 `.root` 内。如不是，实施前 [SPEC-FEEDBACK]。

### 7.7 文案 i18n 完整集（zh_CN，10 locale 待翻译）

**Top nav**:

- `实时分析` (nav-btn 含 green dot pulse)
- `简体中文` (lang switcher)

**Hero**:

- eyebrow: `claw 42 · dispatch console`
- title: `一笔交易决策 · 11 个角色 · 6 个阶段 协同产出`（accent: `11 个角色 · 6 个阶段`）
- sub: `不是一个 AI 拍脑袋。每一步都有专人，每一次分歧被记录，每一笔结果都回灌下一轮。`
- meta cell 1: `11` `Agents`
- meta cell 2: `6` `Stages` (lime)
- meta cell 3: `2×` `Debate` (purple)
- meta cell 4: `∞` `Memory` (lime)

**Tabs**:

- `流程介绍`
- `行情分析` + `LIVE` badge

**6 阶段** (name / tag / chip / side-chip / fsd-label 三列)：

- 1 信息收集 / ANALYSTS / 并行采集 / 独立简报 · 不互相干扰 / 输入 流程 输出
- 2 多空辩论 / RESEARCHERS / 多轮辩论 / 多轮 debate · 拿出最强论据 / 输入 流程 输出
- 3 交易方案 / TRADER / 综合输出 / 方向 · 时机 · 仓位 · 止损 / 输入 决策 边界
- 4 风险审查 / RISK REVIEW / 三派审查 / 波动 · 流动性 · 相关性 / 维度 流程 输出
- 5 最终决策 / PORTFOLIO MANAGER / 终审裁决 / 批准送执行 · 拒绝落档 / 视角 批准 拒绝
- 6 复盘沉淀 / MEMORY LOOP / 持续沉淀 / cross-run · reflection / 落盘 回灌 复利

**11 角色 fagent-desc**:

- 基本面研究主管 / Fundamentals / F: `财务 / 内在价值 / red flags`
- 链上数据分析主管 / On-chain / O: `地址行为 / 资金流 / 链上活跃度`
- 宏观情报分析师 / News / N: `全球新闻 / 宏观 / 事件`
- 技术策略主管 / Technical / T: `MACD / RSI / 价格模式`
- 多头策略师 / Bullish / ↑: `立论看多 / 守住牛市观点`
- 空头策略师 / Bearish / ↓: `立论看空 / 守住熊市观点`
- 交易策略总监 / Trader / $: `综合简报 + 辩论 → 可执行方案`
- 收益进攻官 / Aggressive / A: `高仓位 / 追求最大收益`
- 组合平衡官 / Neutral / N: `平衡仓位 / 风险均衡`
- 风险防御官 / Conservative / C: `低仓位 / 守住下行风险`
- 首席投资官 / Portfolio Manager / PM: `全组合视角 · 二元裁决`
- 策略复盘主管 / Reflection / ∞: `每次决策都让系统更聪明`

**Footer CTA**:

- `每一步都有专人 · 每一次分歧被记录 · 每一笔结果被复盘`
- `查看实时 AI 团队工作 →`

**Chat-shell head**:

- title: `AI 团队工作台`
- sub: `实时交易决策流 · 自动更新`
- stats: `热点` / `已闭环` / `辩论中` / `起步`

---

## 8. 数据流（不动 Phase B）

```
现状（Phase B v2.1 已 merge）保持不动：
[real LLM provider (DeepSeek)]
   ↓
pmDecisionPipeline.ts (7 个 LLM 调用)
   ↓
StrategyDecisionRecord (KV per locale)
   ↓
publicTimelineProjection.ts → PublicTimelineEvent (含 payload.symbol)
   ↓
/api/watch/timeline (Phase B v2.1)
   ↓
v9TopicAdapter.ts mapPublicTimelineEventsToTopics()
   ↓
DispatchTopic[] → MarketAnalysisView (chat-shell)

A1 新增（hero + 流程介绍）：
[hard-coded static content]
   ↓
i18n dict (10 locale)
   ↓
Hero / FlowPanel / FlowStageCard 组件渲染
（无后端调用）
```

---

## 9. 变更范围（v1.1 重写 — 严格按 § 0.5 A/B redline）

### 9.1 新建（A1 OK 写集）

**v10 组件（核心）**：

- `src/modules/agent-watch/v10/Hero.tsx`
- `src/modules/agent-watch/v10/HeroLeft.tsx`
- `src/modules/agent-watch/v10/HeroRight.tsx`
- `src/modules/agent-watch/v10/Constellation.tsx`
- `src/modules/agent-watch/v10/AgentNode.tsx`（含 React.memo）
- `src/modules/agent-watch/v10/FlowPanel.tsx`
- `src/modules/agent-watch/v10/FlowStageCard.tsx`
- `src/modules/agent-watch/v10/StageConnector.tsx`（v1.1 新增，复用 6 次）
- `src/modules/agent-watch/v10/FlowFooterCTA.tsx`
- `src/modules/agent-watch/v10/WatchTabs.tsx`（v1.1 新增 — v10 自建，**不动 v9 WatchTabs**）
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`（v1.1 新增 — v10 wrapper，import 复用 v9 子组件如 ChatShell / MessageBubble 但不修改它们）
- `src/modules/agent-watch/v10/DispatchConsoleV10.tsx`（page entry，组合所有 v10 子组件 + 通过 props 接收 AgentWatchBoard 输出的 topics）

**v10 CSS Module（scoped，按 § 7.1）**：

- `src/modules/agent-watch/v10/DispatchConsoleV10.module.css`（含 tokens + root namespace）
- `src/modules/agent-watch/v10/Hero.module.css`
- `src/modules/agent-watch/v10/Constellation.module.css`
- `src/modules/agent-watch/v10/FlowPanel.module.css`

**v10 hooks**：

- `src/modules/agent-watch/v10/useConstellationFocus.ts`（含 RAF + refs + visibility pause）
- `src/modules/agent-watch/v10/useStageEntryAnimation.ts`（threshold 0.12 / rootMargin '0px 0px -40px 0px'）
- `src/modules/agent-watch/v10/useReducedMotion.ts`（prefers-reduced-motion 检测）

**v10 静态数据 + 类型**：

- `src/modules/agent-watch/v10/types.ts`（v10 新增类型；import 复用 v9 `DispatchTopic` 等公开类型，不重复定义）
- `src/modules/agent-watch/v10/staticContent.ts`（11 角色 + 6 阶段 i18n key 引用 + 视觉位置常量）

**测试**：

- `src/modules/agent-watch/v10/__tests__/Hero.test.tsx`
- `src/modules/agent-watch/v10/__tests__/Constellation.test.tsx`
- `src/modules/agent-watch/v10/__tests__/AgentNode.test.tsx`
- `src/modules/agent-watch/v10/__tests__/FlowStageCard.test.tsx`
- `src/modules/agent-watch/v10/__tests__/WatchTabs.test.tsx`
- `src/modules/agent-watch/v10/__tests__/useConstellationFocus.test.ts`
- `src/modules/agent-watch/v10/__tests__/useStageEntryAnimation.test.ts`

**文档**：

- `claw42/docs/v10-component-spec.md`（v10 component 内部 API，给后续维护者）

**Design source archive**（v1.1 新增 — Codex Rule 3 要求进 origin/main）：

- `claw42/design-source/v10-dispatch-console-redesign/CLAUDE-DESIGN-README.md`
- `claw42/design-source/v10-dispatch-console-redesign/how-it-works.html`
- `claw42/design-source/v10-dispatch-console-redesign/how-it-works-v1-long.html`
- `claw42/design-source/v10-dispatch-console-redesign/how-it-works-v13-simple.html`
- `claw42/design-source/v10-dispatch-console-redesign/screenshots/*.png`

### 9.2 修改（最小化范围 — page.tsx + AgentWatchBoard 1 行 seam + i18n add / 不动 v9 / 不动 lib）

- `src/app/[locale]/agent/page.tsx`：**仅** 把 `<AgentWatchBoard />` 改为 `<AgentWatchBoard console={DispatchConsoleV10} />`（加 console prop 注入；不改 page.tsx 其他逻辑）
- `src/modules/agent-watch/AgentWatchBoard.tsx`（**v1.2 F 拍板 Q-A b — A1 owned 微编辑例外**）：
  - 加 1 个 prop type `console?: React.ComponentType<DispatchConsoleV9Props>`
  - 1 行 JSX：把硬编码 `<DispatchConsoleV9 ... />` 改为 `<Console ... />` 其中 `const Console = props.console ?? DispatchConsoleV9`
  - 共 5-10 行改动，**不动** data fetching / polling / topics 计算 / 任何 B 持有逻辑
  - B session 已通过 decision-log 知会（2026-05-14 深夜 ++ entry）
- `src/i18n/dicts/*.json` (10 个 locale)：**仅添加** v10 新 key 在 `agentWatch.dispatchV10` namespace 下（不删 / 不改现有 key）
- `src/i18n/types.ts`：**仅添加** v10 namespace 类型
- `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（v1.3 修订：**绝对路径** — 实际在 web-dev/ 下跟 claw42 平级，不在 claw42 repo 内；不可作为 spec § 9.2 git-tracked 修改文件，仅作为 F session 维护的跨 spec 历史档案）：追加 A1 spec 各版本修订 entry

### 9.3 删除（无）

A1 不删任何文件。DispatchConsoleV9.tsx 保留作 reference，cleanup 是 A1 merge 后独立 PR。

### 9.4 不动（硬约束 — v1.1 扩充，对照 § 0.5 Avoid 写集）

**B 模块持有（A1 不触碰）**：

- `src/lib/watch/v9TopicAdapter.ts`
- `src/lib/watch/publicTimelineProjection.ts`
- `src/lib/watch/followStatsStore.ts`
- `src/lib/watch/intensityCalculator.ts`
- `src/lib/watch/topicAggregator.ts`
- `src/lib/watch/dispatchAgentMapping.ts`
- `src/lib/watch/safeMessageFormatter.ts`
- `src/lib/watch/publicTimelineEvent.ts`（pm_decision payload contract）
- `src/lib/team/strategyDecisionRecord.ts`
- `src/lib/team/tradeDecision.ts`
- `src/lib/team/teamRegistry.ts`
- `src/lib/team/pmDecisionPipeline.ts`
- `src/lib/storage/kv-rate-limiter.ts`
- `src/app/api/watch/timeline/route.ts`
- `src/app/api/watch/follow-stats/route.ts`
- `src/app/api/watch/trigger/route.ts`
- ~~`src/modules/agent-watch/AgentWatchBoard.tsx`~~（v1.2 F 拍板改为 A1 owned 微编辑例外，见 § 9.2 / T043 — 仅加 console prop seam 5-10 行；data fetching / polling / topics 计算仍不动）

**v9 module（A1 import 复用但不修改）**：

- `src/modules/agent-watch/v9/DispatchConsoleV9.tsx`（保留作 reference）
- `src/modules/agent-watch/v9/MarketAnalysisView.tsx`
- `src/modules/agent-watch/v9/WatchTabs.tsx`（**已含 `流程介绍 / 行情分析 LIVE` + array.join className，A1 不动**）
- `src/modules/agent-watch/v9/MessageBubble.tsx`
- `src/modules/agent-watch/v9/ChatShell.tsx`
- `src/modules/agent-watch/v9/TopicBody.tsx`
- `src/modules/agent-watch/v9/TopicStrategy.tsx`
- `src/modules/agent-watch/v9/Topic*.tsx`
- `src/modules/agent-watch/v9/types.ts`
- `src/modules/agent-watch/v9/dispatchConsoleV9.module.css`
- v9 其他全部组件

**Prod 双不动**：

- Tier 1 真 prod `ai.coinw.com/claw42`（10 多天前发布版本，CoinW GitLab + Jenkins 通道，F/Codex 不触碰，不尝试推 CoinW GitLab）
- Tier 2 锁定 prod `claw42.ai`（Vercel agentxmain-collab，10 多天前版本，A1 实施期间不带 `--prod`，merge 进 main 仅 staging 累积）

**其他**：

- 主 worktree 30+ WIP（按 CLAUDE.md / Phase B 立的纪律）
- globals.css / 其他 page route 不动

---

## 10. 依赖前置

- Phase B v2.1 已 merge main HEAD (commit `1ad8c01`)
- design 视觉源 archive 完成（`claw42/design-source/v10-dispatch-console-redesign/`）
- main HEAD 干净（gitDirty=0），feature worktree `/tmp/claw42-spec-A1-dispatch-v10`
- 跑工程的 chromium / Playwright / vitest / verify:a11y 工具链就绪（继承 Phase B v2.1 实施期间已装的）

---

## 11. Tasks（v2.5 § 11 — `T###[P?][Story?]` 颗粒度）

### Phase 0 — Setup（共享基础）

- [ ] T000 [P] **3 个 docs/archive 文件 commit 到 `origin/main`**（v1.3 修订 — Codex 第 3 轮发现 constitution 也不在 main）：
  - `claw42/design-source/v10-dispatch-console-redesign/` 整目录（CLAUDE-DESIGN-README.md + how-it-works.html + 2 v iteration + screenshots/）
  - 本 spec 文件本身（`claw42/docs/codex-specs/spec-watch-A1-dispatch-console-v10.md`）
  - **`claw42/docs/project-constitution.md` v0.1.1**（含 Amendment 历史段；当前在 dirty worktree 不在 main）
  - **先 push 让 implementation worktree clean checkout 能拿到三者**（Codex Rule 3 NEEDS REVISION 解决）
- [ ] T001 创建 feature worktree `/tmp/claw42-spec-A1-dispatch-v10`，branch `feature/spec-a1-dispatch-console-v10`（从 T000 push 后的 origin/main 拉）
- [ ] T002 跑 baseline gate（tsc / lint / vitest / verify:a11y / verify:metrics / format:check）确认起点干净
- [ ] T003 [P] grep main HEAD 实际 v9 React 组件文件路径 + 当前 props 接口（双脑诊断 — Codex 已 grep 过，complete grep check in § 18 implementation-before）
- [ ] T004 [P] grep i18n dict 实际路径 + types.ts schema：`ls src/i18n/dicts/*.json` + `cat src/i18n/types.ts` 确认 dispatchV10 namespace 加在哪
- [ ] T005 确认 app font infrastructure 路径（Next.js next/font，layout.tsx 或 \_app.tsx 内引入），v10 Manrope / Noto Sans SC / JetBrains Mono 通过 app font 加载

### Phase 1 — Foundational（阻塞前置）

- [ ] T010 实施 `src/modules/agent-watch/v10/DispatchConsoleV10.module.css`（按 §7.1 scoped CSS Module + tokens 在 `.dispatchConsoleV10` namespace 内，**不进 globals.css**）
- [ ] T011 [P] 实施 `src/modules/agent-watch/v10/staticContent.ts`（**11 hero agents + 1 memory_loop flow-only** 数据 + i18n key 引用）
- [ ] T012 [P] 实施 `src/modules/agent-watch/v10/types.ts`（v10 新增类型 + 复用 v9 `DispatchTopic` 等公开类型）
- [ ] T013 [P] 添加 i18n dict 新 key — 在 `src/i18n/dicts/*.json` 10 个 locale 的 `agentWatch.dispatchV10` namespace 下加 hero / 6 stage / 11 role / footer / chat-shell stats 等新 key（zh_CN 完整，按 §7.7；其他 9 locale 翻译见 Phase 6）
- [ ] T014 [P] 添加 `src/i18n/types.ts` 内 dispatchV10 namespace 类型定义

**Checkpoint**: tokens module + staticContent + types + i18n dict skeleton 落盘 → 下游组件可开始

### Phase 2 — User Story 1 P1（Hero + constellation）

- [ ] T020 [P] [US1] 实施 `Hero.tsx` + `Hero.module.css`（双列 grid 容器，按 §7.4）
- [ ] T021 [P] [US1] 实施 `HeroLeft.tsx`（eyebrow + h1 + sub + meta + tabs，复用 WatchTabs）
- [ ] T022 [P] [US1] 实施 `HeroRight.tsx`（constellation 容器 wrapper）
- [ ] T023 [US1] 实施 `Constellation.tsx` + `Constellation.module.css`（3D scene + 3 tier 布局，按 §7.4 + 视觉源 CSS direct copy）
- [ ] T024 [US1] 实施 `AgentNode.tsx`（单个 agent + reticle + readout + tip-card，按 design class 命名）
- [ ] T025 [US1] 实施 `useConstellationFocus.ts` hook（proximity hover + hysteresis 0.78 + 320ms leave grace，按 §7.4 + design source JS direct port）
- [ ] T026 [P] [US1] 单测 `Constellation.test.tsx` + `AgentNode.test.tsx` + `useConstellationFocus.test.ts`
- [ ] T027 [US1] 视觉验证：local preview hero 段对照 design baseline 截图（mean_abs_rgb < 8）

**Checkpoint**: US1 可视化通过 — Hero 段渲染完整，constellation 11 agent 都显示 + hover focus 工作

### Phase 3 — User Story 2 P1（Flow Panel 6 stage）

- [ ] T030 [P] [US2] 实施 `FlowPanel.tsx` + `FlowPanel.module.css`
- [ ] T031 [P] [US2] 实施 `FlowStageCard.tsx`（含 fstage4-side + fstage4-body + stage-connector，按 §7.5）
- [ ] T032 [US2] 实施 `useStageEntryAnimation.ts` hook（IntersectionObserver **threshold: 0.12 + rootMargin: '0px 0px -40px 0px'** + 90ms stagger，按 design HTML 实测）
- [ ] T033 [P] [US2] 实施 `FlowFooterCTA.tsx`（switch-to-debate button，触发 tab 切换 + smooth scroll）
- [ ] T034 [P] [US2] 单测 6 个 stage 渲染 + entry animation order

**Checkpoint**: US2 可视化通过 — 6 stage 卡片按顺序进入 viewport 时 fade-in

### Phase 4 — User Story 3 P1（行情分析 panel 集成 — v1.1 重写）

- [ ] T040 [P] [US3] 实施 `v10/WatchTabs.tsx`（**新建**，不动 v9 WatchTabs — v9 已含正确文案 + array.join className）
- [ ] T041 [US3] 实施 `v10/MarketAnalysisPanel.tsx`（**v10 wrapper** — import 复用 v9 `MarketAnalysisView` 或 `ChatShell` 子组件作为内层 topic 渲染，外层 v10 自渲染 chat-shell-head 文案 + stats 4 项）
- [ ] T042 [US3] 实施 `v10/DispatchConsoleV10.tsx` page entry — 组合 Hero + v10 WatchTabs + FlowPanel + v10 MarketAnalysisPanel；props 接收 `topics: DispatchTopic[]` (从 AgentWatchBoard 输出)
- [ ] T043 [US3] 改 `src/modules/agent-watch/AgentWatchBoard.tsx`（**A1 owned 微编辑** by Q-A b 拍板）— 加 `console?: React.ComponentType<DispatchConsoleV9Props>` prop type + 1 行 JSX `<Console ...>` driven by props.console ?? DispatchConsoleV9；data fetching / polling / topics 计算全部不动
- [ ] T043.5 [US3] 改 `src/app/[locale]/agent/page.tsx` — `<AgentWatchBoard />` → `<AgentWatchBoard console={DispatchConsoleV10} />`（page.tsx 其他逻辑不动）
- [ ] T044 [US3] 验证：跑现有 staging 真 pipeline → /zh_CN/agent 加载 → AgentWatchBoard 输出 topics → V10 渲染 → mkt panel 显示真 LLM rationale（不显示 design 静态 BTC/ETH/SOL mock 文字）

**Checkpoint**: US3 通过 — /zh_CN/agent 路由完整渲染三段（hero + flow + mkt），mkt 用 Phase B v2.1 真 pipeline 数据 + 不动 v9 任何文件

### Phase 5 — User Story 4 P2 + US5 P2 + 兼容性

- [ ] T050 [US4] constellation focus 状态在 tab 切换时 release（onTabChange 副作用）
- [ ] T051 [US5] FlowFooterCTA 触发 tab 切换 + smooth scroll 到 panel-mkt
- [ ] T052 旧 URL 兼容验证（AC6） — Phase B v2.1 staging URL 重新访问不 404

### Phase 6 — i18n 10 locale 翻译

- [ ] T060 [P] zh_TW 翻译（繁体）
- [ ] T061 [P] en_US 翻译
- [ ] T062 [P] ja_JP 翻译
- [ ] T063 [P] ko_KR 翻译（如有）
- [ ] T064 [P] ru_RU / uk_UA / fr_FR / es_ES / ar_SA 各 locale 翻译
- [ ] T065 en_XA 伪本地化占位（按 v3 立的机制）

### Phase 7 — Polish + Verify

- [ ] T070 跑 `npx tsc --noEmit`
- [ ] T071 跑 `npm run lint`
- [ ] T072 跑 `npx vitest run`（173+ tests + 新加 ≥ 30 tests 全过）
- [ ] T073 跑 `npm run build`
- [ ] T074 跑 `npm run verify:a11y`（0 axe violations）
- [ ] T075 跑 `npm run verify:metrics`
- [ ] T076 跑 `npm run verify:chat-v3-final`（v3.5 Chat Authenticity Boundary 50/50 PASS）
- [ ] T077 跑 `npm run format:check`（防 Phase B 时 PR 卡 CI 的同样 drift）
- [ ] T078 Playwright screenshot diff vs design baseline（desktop 1440 + 1280 + mobile 375）
- [ ] T079 第一次 staging deploy（带 STAGING_USE_FIXTURE=true）— 验证 fixture 模式 v10 完整渲染
- [ ] T080 第二次 staging deploy（不带 STAGING_USE_FIXTURE）— 验证真 pipeline 接通无回归
- [ ] T081 报告 codex-to-claude.md：commit list / verify gate / screenshot diff / staging URL / 双脑判断回答

---

## 12. 约束

- **UI only** — 不动 backend pipeline / Phase B v2.1 schema / publicTimelineProjection
- **不动 v9 module 现有组件**（MessageBubble / TopicBody / safeMessageFormatter 等）— 只新增 v10 模块
- **不动双 prod**（constitution v0.1.1 Rule 2）：
  - Tier 1 `ai.coinw.com/claw42`（CoinW GitLab + Jenkins，专用电脑发布，F/Codex 不触碰，**禁止尝试推 CoinW GitLab**）
  - Tier 2 `claw42.ai`（Vercel agentxmain-collab，禁用 `--prod` flag，仅 staging preview）
- **不动主 worktree 30+ WIP**
- **不动 v9 scoped CSS**（按 constitution Rule 3）
- **i18n 默认翻全 9 locale**（不向 Dan 问）
- **跟单按钮占位**（Phase B Q4 拍板沿用）
- **Format:check 不绕过**（constitution 沿用，预先在 Phase 7 跑过）
- **任何 schema 字段 / 文件路径不一致** → [SPEC-FEEDBACK]，不自行猜
- **任何 prod 触碰 / CoinW GitLab push 尝试 / squash merge 阻塞** → 立即停 + 报告，不绕过
- **release / 上 prod 由 Dan 单独指令**：A1 spec 不绑 release 流程，merge main 后等 Dan 决定是否走 release（Tier 2 走 vercel --prod / Tier 1 由 Dan 手动专用电脑推 CoinW GitLab）

---

## 13. 不能做清单（v2.5 § 13）

- ❌ 不能升级 pmDecisionPipeline / strategyDecisionRecord schema / publicTimelineEvent schema（B 模块独立 spec）
- ❌ 不能改 11 角色 backend 真实定义（B 模块独立 spec）
- ❌ 不能改跟单按钮真接 CoinW API（独立 spec + 法务依赖）
- ❌ 不能改 design tokens 值（按视觉权威源 :root 一字不改 copy）
- ❌ 不能用 Tailwind utility 替代 design class（design 是 plain CSS class，按原命名保留）
- ❌ 不能整套替换 v9（v9 chat-shell / msg / topic 部分是 v10 mkt panel 复用基础）
- ❌ 不能 hard-code 时间戳 / 价格数字到 hero / flow panel（这些是 mkt panel 真 pipeline 才有）
- ❌ 不能在 hero / flow 引入跟单 / 真 KV 调用（这些是静态展示层）

---

## 14. Constitution 对照检查（v2.5 § 14，对照 `claw42/docs/project-constitution.md` **v0.1.1** 7 Rule）

| Rule   | 内容                                       | 本 spec 评估                                                                                                                                                                                                                                                                                     | 状态 |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Rule 1 | 部署身份与环境（deployment identity gate） | 按 deployment-identity-registry 走 `agentxmain-collab` + Vercel `claw42-site` + 不带 --prod；preview only；**不尝试推 CoinW GitLab**（专用电脑限定）                                                                                                                                             | PASS |
| Rule 2 | 生产保护（v0.1.1 amend — 双发布线）        | **双 prod 都不触碰**：(a) Tier 1 `ai.coinw.com/claw42` (CoinW GitLab + Jenkins) — F/Codex 无权限，A1 不尝试推；(b) Tier 2 `claw42.ai` (Vercel agentxmain-collab) — A1 实施期间禁用 `--prod` flag，merge 进 main 仅 staging preview 累积；(c) release / 上 prod 由 Dan 单独指令，不绑 A1 实施周期 | PASS |
| Rule 3 | 视觉与品牌权威                             | 新视觉权威源 `claw42/design-source/v10-dispatch-console-redesign/how-it-works.html` archive 落 git；品牌名 `claw42`（technical） / `Claw 42`（public）分离规则继承；v9 existing scoped CSS 不动                                                                                                  | PASS |
| Rule 4 | 数据与 schema 纪律                         | Phase B v2.1 立的 pm_decision payload + publicTimelineEvent schema 不动；v9TopicAdapter 不动；NewsItem / SourceRegistry 不触碰                                                                                                                                                                   | PASS |
| Rule 5 | AI / 行情诚实性                            | hero / flow panel 是静态展示层，不涉及实时价格；mkt panel 直接复用 Phase B v2.1 safeMessageFormatter + 数据降级路径不动                                                                                                                                                                          | PASS |
| Rule 6 | 协作闭环                                   | 本 spec 走 Codex 双脑评估 + sync READ + writeback；副审五维（见 § 18）必填；遵循 [SPEC-FEEDBACK] 三档仲裁                                                                                                                                                                                        | PASS |
| Rule 7 | 验证门槛                                   | § 11 Phase 7 跑 tsc / lint / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / format:check + screenshot diff + 2 次 staging deploy（不带 STAGING_USE_FIXTURE / 带 STAGING_USE_FIXTURE 各一次）；§ 5 Measurable SC 10 项可测；埋点：本 spec UI only 不涉及 PostHog event    | PASS |

**无 Violation。无 N/A 例外。**

**v0.1.1 amend 影响 spec 范围**：Rule 2 双发布线认知已写入 § 4 Assumption #9-#10 + § 9.4 不动清单 + § 12 约束。Codex 实施前必读 `claw42/docs/project-constitution.md` v0.1.1（含 Amendment 历史段）+ `web-dev/decision-log.md` 2026-05-14 (晚 +) entry 全文。

---

## 15. Phase B 之后剩余 work（独立 spec）

本 spec 不做但需要后续推进：

- **A 模块后续**：mobile responsive（v9 desktop-only，design 已含 mobile fallback CSS 待 polish）/ tablet 优化 / SEO 优化 / Open Graph image
- **B 模块**：pipeline 升级输出 multi-round debate trace + record schema 加 `rounds: []` + 11 角色真后端实施
- **B 模块**：memory_loop 真实施（暴露 record.resolvedAt / resolvedOutcome 到 publicTimelineEvent payload）
- **B 模块**：跟单按钮真接 CoinW API（法务依赖 + 用户授权）
- **跨模块**：实时更新升级（polling → SSE / WebSocket）+ typing 真信号

---

## 16. 老板简报（v2.5 § 16，硬性必带）

把"AI 团队"产品故事升级到完整版：进站第一眼看到完整 11 个角色围绕中央 robot 的 3D 互动场景 + 一笔交易决策的 6 阶段全流程（信息收集→多空辩论→交易方案→风险审查→最终决策→复盘沉淀）。每个阶段每个角色干什么都说清楚，鼠标 hover 任一角色直接显示信息卡。

下面是已经接通的真实 AI 团队工作 chat（Phase B 接通的，没动），用户能看到 BTC/ETH/SOL 的实时 AI 决策对话。

视觉只换外壳，底下数据真实运转不变。不上正式版，先跑迭代版让你和评审看。

---

## 17. Anti-Rationalization 表（v2.5 § 17，硬性必带）

| 逃逸路径                                                                 | 为什么不行                                                                                                                                                                                                                                   | 正确做法                                                                                                                                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 觉得 hero 太复杂砍掉 constellation 3D                                    | 这是这次升级的核心差异化点，砍掉 = 失去转化层视觉冲击                                                                                                                                                                                        | 严格按 design 实施，constellation **11 active hero agents**（无 a-mem；a-mem 仅 flow stage 6 + chat）+ reticle + readout + tip-card                                           |
| 觉得 11 角色文案太多简化为 4 个 analyst                                  | 11 角色是 TradingAgents 决策架构核心叙事，简化 = 失去差异化故事                                                                                                                                                                              | 11 角色完整展示在 hero constellation + 流程介绍 flow panel + 行情分析 chat                                                                                                    |
| 觉得 6 阶段 stage-connector SVG 太装饰可省                               | stage-connector 是节奏感关键（视觉上让 6 阶段串成流水线），省了 = 6 张孤立卡片                                                                                                                                                               | 严格按 design 实施 stage-connector SVG flowing dashes + nodule                                                                                                                |
| 觉得 i18n 9 locale 全翻译太花时间先做中英文                              | CLAUDE.md i18n 纪律 + Phase B v2.1 已实施 10 locale，A1 残缺 = 用户路由 404 体验                                                                                                                                                             | 默认翻全 9 locale（en_XA 占位），按 v3 立的 dict 路径                                                                                                                         |
| 觉得视觉权威 design HTML 已经 archive，spec 可以简略不复述 design tokens | Codex 不读 design HTML，spec 自包含原则；只引用 design 路径但关键 token / class / size / animation timing 必须 spec 内复述                                                                                                                   | spec § 7.1-§ 7.7 完整列 design tokens + class 映射 + 3 tier 参数 + 文案                                                                                                       |
| 觉得跟 Phase B v2.1 adapter 集成已经做过不用再验证                       | 真 pipeline 接通是 SC-005 硬指标，UI 替换可能破坏 adapter 注入                                                                                                                                                                               | Phase 7 T080 必须不带 STAGING_USE_FIXTURE 跑第二次 staging deploy                                                                                                             |
| 觉得 sentiment_analyst class 跟 main HEAD onchain 冲突需要先改 schema    | Phase B B.0 立的 schema 已稳定，design 用 `.a-sent` class 但 semantic = onchain（class 名是 design 历史残留），不是真冲突                                                                                                                    | adapter 端继续走 dispatchAgentMapping.ts（onchain_analyst → "链上数据分析主管" 映射），class 名不冲突就行                                                                     |
| 觉得 prod claw42.ai 也该一起更新到 v10                                   | 按 constitution v0.1.1 Rule 2 + 双轨纪律，**双 prod 都锁定**（Tier 1 ai.coinw.com + Tier 2 claw42.ai），必须 Dan 明确 release 指令；A1 只做迭代版 staging 累积                                                                               | A1 merge 进 main = GitHub + Vercel preview URL 给 Dan / 评审看，prod 等下一波 release 单独决策                                                                                |
| 觉得 ai.coinw.com 是 CoinW 域不归 A1 管                                  | 错。ai.coinw.com/claw42 是 claw42 真 prod（Tier 1），受 constitution v0.1.1 全权约束                                                                                                                                                         | A1 spec § 9.4 不动清单 + § 12 约束都已明确 Tier 1 不触碰；任何 push 尝试立即停 + 报告                                                                                         |
| 觉得既然 Codex 没权限推 CoinW GitLab，所以 Rule 2 跟 A1 无关             | 错。Rule 2 是负面约束（不能触碰），即使没权限也要在 spec 中明示 "不尝试" + Anti-Rationalization 反复强化                                                                                                                                     | A1 § 14 Rule 2 评估明示双 prod 都不触碰；§ 12 约束加 "禁止尝试推 CoinW GitLab"                                                                                                |
| 觉得 main HEAD 跟 prod 一致所以不会有意外                                | 错。main HEAD 跟两个 prod 实际差 13 commit（Phase B v2.1 全部改动都未上 prod），main HEAD 当前是迭代版状态，不是 prod 镜像                                                                                                                   | 实施 / 验证时不假设"main = prod"，staging URL 和 prod URL 表现可能完全不同                                                                                                    |
| 觉得 v9 module 既然要被替代干脆删了不留                                  | A1 merge 之后 v9 可能还有其他 module / route 引用，删了破坏链路；A1 只改 page.tsx import + 添加 v10 模块                                                                                                                                     | v9 module 保留作 reference，cleanup PR 是 A1 merge 后独立做                                                                                                                   |
| 觉得 stage-connector 在小屏隐藏简单点没必要保留                          | @media max-width 880 design 已经给了 mobile 退化（fstage4 单列），stage-connector 顺势 display:none 即可                                                                                                                                     | 严格按 design @media 实施，不自行简化                                                                                                                                         |
| 觉得 i18n dict 实际 `.ts` 或者 `.json` 不重要，写代码时再决定            | Codex 实测 i18n 是 `.json` + types.ts，spec v1.0 错写 `.ts`；implementer 凭 spec 实施会建错文件破坏现有 dict 系统                                                                                                                            | spec v1.1 § 4.4 + § 6.1 + § 7.7 + T013 全部明确 `.json` 路径 + types.ts                                                                                                       |
| 觉得 v9 WatchTabs 文案不对要改                                           | Codex 实测 v9 WatchTabs **已含** `流程介绍 / 行情分析 LIVE` + array.join className（X.1 修过），v1.0 T042 是 stale work；改 v9 = 触发 B 模块 merge 冲突                                                                                      | v1.1 删 T042，A1 自建 v10/WatchTabs.tsx 不动 v9                                                                                                                               |
| 觉得 hero constellation 应该含 12 个机器人（含 memory_loop）             | Codex grep design HTML 实测 hero 只 11 个 `.anode`，**没有 a-mem**；a-mem 仅在 stage 6 + chat messages 出现                                                                                                                                  | spec v1.1 § 7.2 明确"11 hero active + 1 flow-only memory_loop"                                                                                                                |
| 觉得 design HTML stage 2 含 `.faceoff` class 用 VS 中分 layout           | Codex 实测 stage 2 实际 class 是 `fstage4 debate`（无 faceoff），但 CSS 含 `.fstage4.faceoff` 规则未使用                                                                                                                                     | spec v1.1 § 7.3 选 design HTML 为权威，stage 2 用普通 fagents-2 双列横排                                                                                                      |
| 觉得 IntersectionObserver threshold 30% 跟 design 0.12 差不多            | Codex 实测 design 是 `threshold: 0.12 + rootMargin: '0px 0px -40px 0px'`，与 30% 不同；实施时阈值漂移会影响 UX 节奏                                                                                                                          | spec v1.1 § 7.4 + SC-004 改用 design 实际值                                                                                                                                   |
| 觉得 design mkt panel 静态 BTC/ETH/SOL mock 是真实文案 / 可直接显示      | Codex 提示 design mock 是视觉参考，live 必须用 Phase B v2.1 真 adapter 输出；如 hardcode mock 会 leak design assumptions 到 prod                                                                                                             | spec v1.1 § 7.6 + SC-001 明确 mock 仅视觉参考，screenshot diff 不对照 mkt 文字                                                                                                |
| 觉得 design 引用 Google Fonts 直接用 CDN 即可                            | CoinW prod 网络层可能 block 外部 CDN（已知 CoinW 风控限制），且 Next app 已有 font infra                                                                                                                                                     | spec v1.1 § 4.5 + § 7.1 改用 app font infra，Google Fonts 作 fallback                                                                                                         |
| 觉得 design source HTML 本地有就够，spec 引用路径就行                    | Codex 实测 `git ls-tree origin/main` **不含** design archive 也不含本 spec 文件；clean implementation worktree checkout 会拿不到视觉权威源                                                                                                   | spec v1.1 T000 优先 commit design archive + 本 spec 到 origin/main，再 implementation worktree clean checkout                                                                 |
| 觉得 v10 跟 v9 是同一个 module，改改 v9 现有组件就行                     | Codex 强调 A/B 并行执行，B 持有所有 v9 现有 lib + module 文件写权限，A1 改 v9 文件 = 跟 B 写集冲突 → merge 风暴                                                                                                                              | spec v1.1 § 0.5 A/B redline 严格列 OK + Avoid 写集，A1 只在 v10/\*\* 新建，page.tsx 仅 import swap，i18n 仅 add key                                                           |
| 觉得 topnav 跟 global header 重叠也没事，design 写了就实现               | Next app 已有 global layout 处理 header，A1 重复实现 nav 会出现两个 header 视觉撞                                                                                                                                                            | spec v1.1 § 6.6 决策 EXCLUDE design topnav，用 global header                                                                                                                  |
| 觉得 page.tsx import swap 就能注入 V10（v1.1 说法）                      | **Codex 第 2 轮发现**：AgentWatchBoard 当前**硬编码** import + render DispatchConsoleV9，page.tsx 只渲染 `<AgentWatchBoard />`，**没有 V10 注入 seam**。v1.1 的 "page.tsx import swap" 在 main HEAD 不可行                                   | **v1.2 F 拍板 Q-A (b)**：A1 owned 微编辑 AgentWatchBoard 1 行加 console prop seam（§ 9.2 + T043）；page.tsx 改为 `<AgentWatchBoard console={DispatchConsoleV10} />`（T043.5） |
| 觉得 v10 import 复用 v9 ChatShell 就能跑（结构 + 样式都自动有）          | **Codex 第 2 轮发现**：v9 ChatShell 用 `dispatchConsoleV9.module.css` 的 `.root :global(...)` scope，子组件渲染的 `.chat-shell` / `.topic` / `.msg` 等 class 必须在 `v9Styles.root` 包裹下才生效；v10 wrapper 不包 root → 结构有但**样式丢** | v1.2 § 7.6 决策：v10 MarketAnalysisPanel 内层用 `<div className={v9Styles.root}>` 包裹 v9 子组件，fallback 整段 reuse MarketAnalysisView 接受其 header                        |

---

## 18. Codex 双脑判断点（v1.1 状态 — 第 1 轮全部 resolved）

按 CLAUDE.md 双脑诊断纪律，Codex 已在 2026-05-14T20:45 第 1 轮评估完成 Q1-Q9 + 8 个 extra angles。下方保留作历史索引；spec v1.1 已并入所有决策。

### ✅ Q1 resolved — v10 模块路径

**Codex 推荐**：`src/modules/agent-watch/v10/`（独立 folder，不 rename v9，不 flat 平级）。v1.1 § 9.1 已实施。

### ✅ Q2 resolved — design tokens 落点

**Codex 推荐**：scoped v10 CSS Module，`.dispatch-console-v10` root namespace，**不进 globals.css**。v1.1 § 7.1 已实施。

### ✅ Q3 resolved — WatchTabs 改 vs 重建

**Codex 推荐**：v10 自建 `v10/WatchTabs.tsx`，**不动** v9 WatchTabs（v9 已含 `流程介绍 / 行情分析 LIVE` + array.join，A1 改 = stale）。v1.1 § 9.1 + T040 已实施。

### ✅ Q4 resolved — Constellation 性能（高风险）

**Codex 建议**：(1) prefers-reduced-motion (2) pointer var 通过 refs + RAF（不用 React state）(3) cleanup all listeners (4) visibility hidden 暂停 (5) AgentNode + role array React.memo (6) <=880px design fallback flatten。v1.1 § 7.4 + T026 / useReducedMotion 已实施。

### ✅ Q5 resolved — stage-connector SVG

**Codex 推荐**：inline component 复用 5-6 次（bundle 成本可接受，sprite/dataurl 增加复杂度无显著收益）。v1.1 § 9.1 加 `StageConnector.tsx`。

### ✅ Q6 resolved — i18n 策略

**Codex 推荐**：

- 路径修正：`src/i18n/dicts/*.json`（JSON，不是 TS）+ `src/i18n/types.ts`
- Namespace：`agentWatch.dispatchV10`
- 翻译：spec v1.1 给 zh_CN 完整 + en_US 模板；其他 8 locale 由 Codex 实施时翻译；en_XA 维持 pseudo placeholder
  v1.1 § 7.7 + T013 已实施。

### ✅ Q7 resolved — AgentNode React.memo

**Codex 推荐**：yes，memoize AgentNode + 静态 role array module-level。v1.1 § 9.1 + § 7.4 已实施。

### ✅ Q8 resolved — Mobile responsive 范围

**Codex 推荐**：实施 design 自带 `@media max-width:1100 / 880` fallback，acceptance 定义为 "graceful mobile" 不是 "pixel-perfect"。v1.1 SC-007 阈值改 ≥ 65。

### ✅ Q9 resolved — extra angles（Codex 找出 8 个）

1. 11 vs 12 角色矛盾 → § 7.2 修
2. Topnav include/exclude → § 6.6 决策 EXCLUDE
3. Faceoff class mismatch → § 7.3 / § 7.5 修 design HTML 为权威
4. IntersectionObserver 阈值 → § 7.4 / SC-004 改 0.12 + rootMargin
5. Static mock market data → § 7.6 + SC-001 修
6. External font (Google Fonts) → § 4.5 + § 7.1 改 app font infra
7. Spec file-count mismatch → § 9.1 重写
8. Spec source reproducibility → T000 加 design archive commit 到 origin/main

### ✅ Q-A（v1.2 resolved — F 自主拍板 (b) by Dan 2026-05-14 "别给我说技术，优先推 A，能部署预发"）

**F 拍板 = 方案 (b) A1 owned 微编辑 AgentWatchBoard 1 行**

理由：

- B 线 144 commit 当前 trajectory 0 touch AgentWatchBoard.tsx（B 同步实测）→ 物理位置 merge 冲突风险极低
- A1 不阻塞 B 节奏（B long-running stack 没明确 timeline）
- 5-10 行改动 = console child prop seam（presentation 决策，归 A 责任）
- 部署预发最快路径

**实施细节**：A1 在 AgentWatchBoard.tsx 加：

- 1 个新 prop `console?: React.ComponentType<DispatchConsoleV9Props>`（default = V9）
- 1 行 JSX：把硬编码 `<DispatchConsoleV9 ... />` 改为 `<Console ... />` 其中 `Console = props.console ?? DispatchConsoleV9`
- 不动 data fetching / polling / topics 计算 / 其他全部 B 持有逻辑

A1 page.tsx 仅改：`<AgentWatchBoard console={DispatchConsoleV10} />`

**B session 知会**：A1 实施期间 B 仍可在 lib 层继续做 144 commit + 后续 commit，物理不撞 AgentWatchBoard.tsx。万一 B 后续要改 AgentWatchBoard 内部 → 协调（但 trajectory 看不会）。

### ✅ Q-B（v1.2 resolved — F 自主拍板 (X)）：A1 时间窗口

**F 拍板 = 方案 (X) A1 在 origin/main 当前 HEAD 上 fork 实施，不等 B 144 commit merge**

理由：

- B 144 commit 是 data layer truthfulness hardening，不改 DispatchTopic[] shape contract
- A1 视觉层不依赖 B hardening
- 等 B merge 阻塞 A1 进度太重，B 没明确 timeline
- 都在 staging 累积，release 时一起协调（双轨纪律）

### ~~实施前最后一道 grep check 段~~

下面 § 18 末尾的 grep check 清单仍生效。Codex 第 3 轮实施前必跑。

**问题**：Codex 第 2 轮实测 `origin/main` 上 AgentWatchBoard 硬编码 import + render `DispatchConsoleV9`，page.tsx 只 `<AgentWatchBoard />`，**没有任何 seam 让 page.tsx 注入 V10**。v1.1 spec 说 "page.tsx import swap" 在当前 main HEAD **不可行**。

**3 个方案**：

**方案 (a) — B 先加 injection seam**（Codex preferred）

- B 模块在 AgentWatchBoard 加一个 prop `console: React.ComponentType<DispatchConsoleV9Props>` 默认 V9 fallback
- A1 不动 AgentWatchBoard，page.tsx 通过 prop 注入 V10
- 优：A/B 边界最干净，A1 不破坏 redline
- 劣：A1 阻塞在 B PR 完成，B 节奏不在 F 控制

**方案 (b) — A1 owned 微编辑 AgentWatchBoard**（F 推）

- A1 owns AgentWatchBoard 的 1 行 import + 1 行 JSX prop driven console child（共 ~5-10 行改动）
- A1 不动 AgentWatchBoard 的 data fetching / polling / topics 计算（B 持有的核心 logic）
- § 0.5 A/B redline 加例外条款：AgentWatchBoard.tsx 的"console 子组件 prop seam"是 A1 owned 显示层决策
- 优：A1 不阻塞 B，merge 冲突低（5-10 行）
- 劣：A1 跟 B 同时编辑同一文件 → 潜在 merge 冲突；A/B 边界模糊一点

**方案 (c) — A1 复制 polling/data flow 自建 page-entry**（Codex worst）

- A1 V10 直接挂 page.tsx 不通过 AgentWatchBoard
- A1 V10 内部复制 AgentWatchBoard 的 fetch + polling + adapter 调用
- 优：完全独立，零 B 模块依赖
- 劣：重复实现 B 工作 + 维护两份；B 模块 polling 升级时 A1 同步成本高；违反 DRY

### F 推荐方案 (b)

理由：

- A1 不阻塞 B 进度（节奏可控）
- 5-10 行 merge 冲突风险低（B 改 AgentWatchBoard 的 data path 部分，A1 改 console child prop seam，物理上不同位置）
- 仍守住 A/B redline 精神（其他 v9 文件 + lib + api 全不动，AgentWatchBoard 仅 console 子组件 prop driven 是 presentation seam）

### Q-A / Q-B 决策已 finalize（resolved）

Dan 2026-05-14 chat "别给我说技术，优先 A，能部署预发" → F 自主拍 Q-A (b) + Q-B (X)。详见上方 ✅ Q-A / ✅ Q-B resolved 段；spec § 9.2 + § 11 T043 + T043.5 已 finalize；§ 17 Anti-Rationalization 对应条已标 resolved。

---

### 实施前最后一道 grep check（v1.2 — Codex 已完成第 2 轮）

Codex 实施前最后一次跑：

- [ ] `cat src/modules/agent-watch/v9/DispatchConsoleV9.tsx` 确认当前 props 接口
- [ ] `cat src/modules/agent-watch/v9/MarketAnalysisView.tsx` 确认当前 topics prop + chat-shell-head 文案
- [ ] `cat src/modules/agent-watch/v9/WatchTabs.tsx` 确认 tab 实现 + active class（特别 X.1 改过的 array.join className）
- [ ] `cat src/app/[locale]/agent/page.tsx` 确认 page 引用 V9 的位置
- [ ] `cat src/i18n/dicts/zh_CN.json` 确认 i18n key 结构 + 现有 agentWatch / watch / agent 相关 key（v1.2 修订：是 .json 不是 .ts）+ `cat src/i18n/types.ts` 确认 namespace 类型
- [ ] `grep -rn ".a-sent\|.a-onchain" src/modules/agent-watch/v9/` 确认 onchain class 用法
- [ ] `cat src/lib/watch/dispatchAgentMapping.ts` 确认 7 TeamMemberId → 12 DispatchAgentId 映射 + 12 角色 enum
- [ ] `cat claw42/docs/project-constitution.md` 重读 7 Rule **v0.1.1**（必须读 Amendment 历史段 — Rule 2 双发布线 amend）
- [ ] `cat claw42/design-source/v10-dispatch-console-redesign/how-it-works.html` design 视觉权威源（1660 行 plain HTML）— 全文 cat 不靠摘要

如任一项与 spec 不一致 → 写 [SPEC-FEEDBACK] 到 codex-to-claude.md，**不**自行猜。

---

## 19. decision-log 联动（v2.5 § 19）

本 spec 起草触发 `web-dev/decision-log.md` 同步更新：

- [ ] 追加 2026-05-14 entry：A 模块第一个 spec A1 起草，UI only 替换 v9，视觉权威源 archive 位置，跟 Phase 6a 原计划的拆分（A / B 模块）

Codex 实施前 / 任何拍板节点都先读 decision-log（按 CLAUDE.md ★ 决策档案先行硬性规则）。

---

## 工作量预估

| Phase    | sub                                                          | 时间（AI 天）  |
| -------- | ------------------------------------------------------------ | -------------- |
| 0        | Setup（worktree + baseline gate + Codex grep）               | 0.25           |
| 1        | Foundational（tokens + staticContent + types + dict 初始化） | 0.5-1          |
| 2        | US1 Hero + Constellation 3D（核心难度）                      | 2-3            |
| 3        | US2 Flow Panel 6 stage + connector                           | 1-1.5          |
| 4        | US3 MarketAnalysisView 集成（轻改）                          | 0.5            |
| 5        | US4/US5 + 兼容性                                             | 0.5            |
| 6        | i18n 9 locale 翻译                                           | 1-1.5          |
| 7        | Polish + Verify + 双 staging                                 | 1.5-2          |
| **总计** |                                                              | **7-10 AI 天** |

比 decision-log 2026-05-12 原 Phase 6a 估的 20-30 AI 天少 13-23 天 —— **因为 A/B 拆分把 backend 升级（multi-round trace + 11 角色 pipeline + memory loop 真实施）剥到 B 模块独立 spec**。A1 只做 UI 层。

---

## 关联资产

- 视觉权威源：`claw42/design-source/v10-dispatch-console-redesign/how-it-works.html`
- 项目宪法：`claw42/docs/project-constitution.md` **v0.1.1**（v1.3 修订 — 双发布线 amend；T000 必须先 commit 到 origin/main）
- 决策档案：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（v1.3 修订：绝对路径；含 2026-05-12 TradingAgents 11 角色拍板 + 2026-05-14 v2.5 全局推广 + A1 v1.0-v1.3 各轮修订）
- 前置 spec：`claw42/docs/codex-specs/spec-watch-phase-b-real-agent-pipeline.md` v2.1（已 merge commit `1ad8c01`）
- claude-codex-protocol v2.5（cwc-protocols plugin 0.7.1 加载）

---

_v1.0 起草：2026-05-14 F session_
_等 Codex 节奏更新同步（A/B 模块编号 / spec 命名约定确认）后可能微调 spec 编号_
_下一动作：Dan review → 派 Codex 双脑评估 → SPEC-FEEDBACK 收敛 → implement_
