# spec-watch-dispatch-console-v3-7-redesign

> **目的**：用 F 9 轮迭代的 v9 简洁版替换 v3.6 当前 Watch 调度台视觉。v3.6 来自 Claude Design 第 1 轮 mockup，Dan 反馈"花哨" / 信息密度过高；v9 = 两 tab + chat-shell + 多 topic + 大策略卡 + 折叠按钮的简洁版本。
>
> **核心约束**：先视觉（pixel-perfect 复刻 v9），后功能。Phase A 视觉重做，Phase B（独立 spec）后续接真数据 / 真 chat / 真跟单。
>
> **设计源**：`/Users/dannybrown/Claude/职业规划/web-dev/dispatch-console-v9.html`（1299 行，pixel-perfect 参考）
>
> **F + Codex 双脑评估已完成**：Codex 评估见 `claude-codex-sync/codex-to-claude.md` 2026-05-12T13:59Z 段。本 spec 已合并 Codex 6 个 angle + Dan Q1-Q4 拍板。

---

## 0. Dan Q1-Q4 拍板（2026-05-12）

| 编号 | 决策                                                                                         |
| ---- | -------------------------------------------------------------------------------------------- |
| Q1   | **不做 mobile** — Phase A 只针对 desktop（≥ 1280px viewport），mobile 后续 phase             |
| Q2   | **字体用 CoinW 现有 stack**（不引 Satoshi from Fontshare CDN），跟 claw42.ai 落地页对齐      |
| Q3   | **v3.6 retire = 立即删除 + git history 留档**（不留 unmounted dead code，git log 是 backup） |
| Q4   | **跟单按钮显示 + 跳转占位**（视觉完整，点击不真执行交易，跳到占位页或弹窗）                  |

---

## 1. 现状盘点

### main HEAD（v3.6 已 merge）

- `061c9c1` style(watch): format dispatch console merge
- `2e65ad8` Merge patch v3.6: Dispatch Console watch shell
- v3.5 + v3.6 都已 merge，baseline gate PASS

### v3.6 当前 staging

- URL: `https://claw42-site-4g65pptxn-agentxmain-collabs-projects.vercel.app`
- 渲染：`src/modules/agent-watch/DispatchConsole.tsx`（来自 Claude Design zip handoff）

### v3.6 残留隐藏 side effects（Codex 发现）

`AgentWatchBoard.tsx` 当前仍在跑 `useAgentAnalysis` + `/api/watch/history` + `liveQueue` 调度 + 补充 chatter timer，即使返回只渲染 DispatchConsole。**v3.7 必须 clean 这些隐藏代码路径**。

### prod 状态

- claw42.ai 仍是 Act1 落地页，v3.6 未上 prod → v3.7 retire v3.6 不影响线上

---

## 2. 变更范围

### 新建

- `src/modules/agent-watch/v9/DispatchConsoleV9.tsx` — v9 整页主组件
- `src/modules/agent-watch/v9/WatchTabs.tsx` — 顶部 tabs 切换
- `src/modules/agent-watch/v9/FlowIntroView.tsx` — Tab 1 流程介绍
- `src/modules/agent-watch/v9/MarketAnalysisView.tsx` — Tab 2 行情分析
- `src/modules/agent-watch/v9/ChatShell.tsx` — 大边界容器
- `src/modules/agent-watch/v9/Topic.tsx` — 单 topic 卡片
- `src/modules/agent-watch/v9/TopicHead.tsx` — topic 头部 + toggle button
- `src/modules/agent-watch/v9/TopicBody.tsx` — chat msgs + stage markers
- `src/modules/agent-watch/v9/TopicStrategy.tsx` — 大策略卡（含跟单按钮）
- `src/modules/agent-watch/v9/MessageBubble.tsx` — 单条 agent 发言
- `src/modules/agent-watch/v9/IntensityBar.tsx` — 激烈度 5 dot
- `src/modules/agent-watch/v9/types.ts` — `DispatchTopic` / `DispatchMessage` / `DispatchStrategy` / `DispatchFlowStage` / `DispatchStageMarker` 等 view-model
- `src/modules/agent-watch/v9/fixtureData.ts` — v9 fixture topics（BTC active / ETH done / SOL pending）
- `src/modules/agent-watch/v9/dispatchConsoleV9.module.css` — v9 scoped CSS（保留 v9 HTML 原 class 名）
- `src/modules/agent-watch/v9/__tests__/DispatchConsoleV9.test.tsx` — 渲染/折叠/tab 切换/keyboard a11y

### 修改

- `src/modules/agent-watch/AgentWatchBoard.tsx`
  - 改为渲染 `<DispatchConsoleV9 />` 替代 `<DispatchConsole />`
  - **clean 隐藏 side effects**：移除/gate `useAgentAnalysis` + `/api/watch/history` 调用 + `liveQueue` 调度 + 补充 chatter timer（在 v9 fixture-only Phase A 不需要的部分）
  - 保留 `events / evidenceMap / marketSnapshot` 数据 props 透传（即使 v9 fixture-only 也保留接口，方便 Phase B 接真数据）

### 删除（git 删除 + history 留档）

- `src/modules/agent-watch/DispatchConsole.tsx`
- `src/modules/agent-watch/dispatchConsoleData.ts`

### 不动

- `src/lib/watch/publicTimelineProjection.ts`（v3.5 数据桥）
- `src/lib/watch/publicTimelineEvent.ts`
- `src/lib/team/strategyDecisionRecord.ts`
- `STAGING_USE_FIXTURE` env 开关（v3.5 立的，Phase B 接真数据时复用）
- `src/components/agent-watch/DecisionTimeline.tsx` 等 v3.5 process panel 组件（备用 infrastructure，Phase A 不挂载但不删）
- `src/components/agent-watch/TrackRecordWall.tsx` 同上（Phase 6b 复用）

---

## 3. 依赖前置

- main HEAD 含 patch v3.5 + v3.6（已确认 `061c9c1`）
- baseline gate `7ff6afc7eed3646d272dc312d565280ac2840568` 是 main HEAD 的 ancestor
- 主 worktree 当前有 30+ 未提交文件，**v3.7 走独立 feature worktree**（`/tmp/claw42-patch-v37-dispatch-v9-01`），不动主 worktree

---

## 4. 当前状态快照（Codex 实施前必须确认）

- [ ] `git log origin/main --oneline -3` 含 v3.5 + v3.6 merge commits
- [ ] `cat src/modules/agent-watch/AgentWatchBoard.tsx` 当前确含 `useAgentAnalysis` / `/api/watch/history` 等老 side effects（确认范围）
- [ ] `cat src/modules/agent-watch/DispatchConsole.tsx` 行数 + 导出确认（删除前 snapshot）
- [ ] `cat src/modules/agent-watch/dispatchConsoleData.ts` 类型导出 grep（哪些被其他文件 import 必须迁移到 v9 types 或解耦）
- [ ] `grep -rn "from.*agent-watch/DispatchConsole" src/` — 所有 import 点列表（删除前 audit）

---

## 5. 技术上下文

### 5.1 CSS 策略：scoped 包装，不 Tailwind 重写（Codex 核心建议）

**铁律**：保留 v9 HTML 原 class 名 + 原 CSS rules，**不**做 Tailwind utility 近似。v9 是视觉权威。

**实施方式**：

- CSS 体系迁移到 `dispatchConsoleV9.module.css`（CSS module 或 scoped global block）
- v9 HTML 的全局选择器（`html`, `body`, `body::after`, `.view`, `.title` 等）必须 scoped 到 `.dispatch-console-v9` 根
- v9 HTML 内 `body::after` 紫色渐变 → 改为 `.dispatch-console-v9::after` fixed child overlay
- 不引 Satoshi from Fontshare CDN，用 claw42 现有 font stack（Q2 拍板）

### 5.2 View Model 边界（typed）

```ts
// src/modules/agent-watch/v9/types.ts

export type DispatchTopicStatus = "active" | "done" | "pending";

export interface DispatchTopic {
  id: string;
  symbol: string; // "BTC" / "ETH" / "SOL"
  status: DispatchTopicStatus;
  title: string; // "🔥 BTC live market check · BTC 距前低 0.35%..."
  source: string; // "Claw42 TopicGenerator"
  startedAt: string; // "19:22"
  progress: string; // "当前进行到阶段 3" / "28 分钟闭环" / "信息收集中"
  intensity: number; // 1-5
  trigger: {
    ticker: string; // "$BTC"
    text: string; // "Rewards Wallet 多链 swap..."
  };
  stages: DispatchStageMarker[];
  messages: DispatchMessage[];
  strategy: DispatchStrategy;
  defaultCollapsed: boolean; // active=false / done=true / pending=true
}

export interface DispatchStageMarker {
  id: string;
  label: string; // "阶段 1 · 信息收集"
  status: "done" | "active" | "pending" | "final";
}

export interface DispatchMessage {
  id: string;
  stageId: string; // 属于哪个 stage
  agentId:
    | "fundamental_analyst"
    | "sentiment_analyst"
    | "news_analyst"
    | "technical_analyst"
    | "bullish_researcher"
    | "bearish_researcher"
    | "trader"
    | "aggressive_reviewer"
    | "neutral_reviewer"
    | "conservative_reviewer"
    | "portfolio_manager"
    | "memory_loop";
  agentName: string; // "技术分析师"
  agentRole?: string; // "Fundamentals · Round 1 立论"
  time: string; // "19:22"
  dataAge?: string; // "数据 526 秒前"
  mentions: string[]; // ["@看空", "@保守"]
  quote?: { agentName: string; text: string };
  content: string; // 气泡内容，可含 <b> 标签
  typing?: boolean; // 显示 typing 3 dot
}

export interface DispatchStrategy {
  action: "wait" | "long" | "short" | "pending";
  actionLabel: string; // "分析中" / "SHORT 6%" / "PENDING"
  name: string; // "本次决策" / "已开仓" / "尚未决策"
  meta: string; // "3 个阶段已完成 · 交易员正在出方案..."
  entry: string; // "突破 82,041 / 跌破 80,537" / "待定"
  stopLoss: string; // "79,500" / "待定"
  takeProfit: string; // "82,000 / 82,500" / "待定"
  follow: {
    primaryLabel: string; // "我跟了" / "已跟单" / "等待方案"
    primaryDisabled: boolean;
    secondaryLabel: string; // "我没跟" / "查看详情" / "提醒我"
    watchCount: number;
    followCount: number;
    expiryNote?: string; // "30m 后失效"
  };
}

export interface DispatchFlowStage {
  num: 1 | 2 | 3 | 4 | 5 | 6;
  name: string; // "信息收集"
  tag: string; // "ANALYSTS"
  countLabel: string; // "并行采集"
  variant?: "debate" | "final" | "memory";
  agents: { id: string; name: string; role: string; desc: string; avatarClass: string }[];
  detail: { label: string; value: string }[];
  footerChip: string;
}
```

### 5.3 跟单按钮处理（Q4 拍板）

按钮显示但 click 时**不真执行**：

- onClick = navigate to placeholder route（如 `/agent/follow/[topicId]`）或弹 modal 提示"功能开发中，暂不支持执行"
- 占位页内容：感谢提示 + 通知订阅入口 + 回 `/agent` 链接
- 已跟单状态的"已跟单"按钮始终 disabled

### 5.4 AgentWatchBoard 清理 scope（Codex 建议）

`AgentWatchBoard.tsx` 当前在跑的隐藏 side effects 全部移除/gate：

- `useAgentAnalysis` hook 调用
- `/api/watch/history` fetch
- `liveQueue` 调度（如有 polling/timer）
- "补充 chatter" timer

只保留 v3.5 数据 fetch（`/api/watch/timeline` + `STAGING_USE_FIXTURE`）作为 props 透传给 v9（即使 Phase A fixture-only，接口预留 Phase B 用）。

### 5.5 Accessibility 要求（Codex 建议）

v9 HTML 原版 a11y 不达标，React 实施时必须补：

- Tabs 用 `<button>` + `aria-selected` + `role="tab"` + `role="tablist"` + `aria-controls`
- Topic toggle 用 `<button>` + `aria-expanded="true|false"` + `aria-controls`
- Topic body region 用 `role="region"` + `aria-labelledby`
- 键盘支持：Enter / Space toggle，左右箭头切换 tab
- 折叠状态 + 当前 active stage 用 `aria-live="polite"` 通知 screen reader

---

## 6. 具体要求（按 A0-A5 拆分）

### A0 — 视觉源契约 + 决策固定（0 天，本 spec 内）

- v9 HTML 作为视觉权威
- desktop 目标 viewport：1440×1000（主验收）+ 1280×800（边界验收）
- mobile 不做（Q1）
- 字体：CoinW 现有 stack（Q2）

### A1 — Scoped CSS shell（0.75-1.5 AI 天）

- 建 `v9/` 目录 + `dispatchConsoleV9.module.css`
- 移植 v9 :root tokens / topbar / tabs / 全局 layout / fadeInUp 动画
- 所有 v9 全局选择器 scoped 到 `.dispatch-console-v9` 根
- 验证：no global leakage（落地页 Act1 视觉不变）

### A2 — FlowIntroView（1-1.5 AI 天）

- 6 stage horizontal cards（v4 layout：左侧 stage info + 右侧 agents grid + stage detail）
- 11 角色 fixture data（基本面/情绪/新闻/技术/看多/看空/交易员/激进/中立/保守/PM/memory）
- a11y：Tabs 控件 semantics

### A3 — MarketAnalysisView / ChatShell / Topic 卡片（1.5-2.5 AI 天）

- chat-shell 大边界容器（含 head + body）
- body height: calc(100vh - 280px) + min-height: 480px + overflow-y: auto + scrollbar 样式化
- Topic 卡（独立 border + neutral 配色 + 状态色仅体现在内部 live-tag pill）
- TopicHead 含 LIVE 红点 + 标题 + 原文链接 + 激烈度 + 触发 chip + 收起/展开 按钮（86×36 大按钮，含"收起"/"展开"文字 + ▾ 箭头）
- TopicBody 含 chat msgs（avatar + 名 + @mention 红标签 + 引用块 + typing 3 dot）
- 折叠/展开：点击 topic-head 整体 toggle，键盘 Enter/Space 支持
- 默认折叠规则：active 展开 / done 折叠 / pending 折叠
- Topic 之间用渐变虚线 separator（含中央 dot）
- TopicStrategy 大策略卡（lime 3px left accent border + 14px 主字段 + 醒目跟单按钮）
- 跟单按钮 onClick → 跳转占位页（Q4）

### A4 — Entry 集成 + AgentWatchBoard 清理（0.75-1.25 AI 天）

- `AgentWatchBoard.tsx` 替换渲染入口为 `<DispatchConsoleV9 />`
- 移除/gate 老 side effects（`useAgentAnalysis` / `/api/watch/history` / `liveQueue` / 补充 chatter timer）
- **删除** `DispatchConsole.tsx` + `dispatchConsoleData.ts`（git 删除）
- grep 所有引用点 audit，确保删除后没有 broken import

### A5 — 验证 + staging（1-1.5 AI 天）

- `npx tsc --noEmit` / `npm run lint` / `MINIMAX_API_KEY=dummy DEEPSEEK_API_KEY=dummy npm run build` / `npm run verify:a11y` / `npm run verify:metrics` / `npx vitest run` 全过
- 自己跑 `npx vercel` 部署 staging（带 `STAGING_USE_FIXTURE=true` runtime env）
- 自己跑 `vercel curl` 验证 `/api/watch/timeline` 仍返回 6 key rationaleByMember
- 自己跑浏览器截图对照 v9 standalone HTML（desktop 1440×1000 + 1280×800）
- 报告 preview URL + 视觉对照结果 + 任何 intentional 非 pixel-perfect 的 a11y 改动

---

## 7. 验收标准

### 编译 / Lint / Build

- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run lint` PASS
- [ ] `npm run build` PASS（带 dummy LLM API keys）
- [ ] `npm run verify:a11y` PASS（0 axe violations + 新增 a11y 标准达标）
- [ ] `npm run verify:metrics` PASS
- [ ] `npx vitest run` PASS

### 视觉对照（Codex 自己跑）

- [ ] desktop 1440×1000 截图 vs v9 standalone HTML 像素级一致（允许字体微差异）
- [ ] desktop 1280×800 截图 layout 不破坏
- [ ] Tab 1（流程介绍）6 stage horizontal layout 与 v9 一致
- [ ] Tab 2（行情分析）chat-shell + 3 个 topic（active/done/pending）+ 大策略卡 + 跟单按钮 与 v9 一致
- [ ] 折叠/展开交互工作（active 默认展开，done/pending 默认折叠）
- [ ] 跟单按钮点击跳转占位（Q4）

### 行为 / 集成

- [ ] AgentWatchBoard 老 side effects 已 clean（grep 确认 `useAgentAnalysis` / `/api/watch/history` 不再调用）
- [ ] v3.6 `DispatchConsole.tsx` + `dispatchConsoleData.ts` 已删除
- [ ] no broken import（`grep -rn "DispatchConsole" src/` 0 个 stale 引用）
- [ ] 落地页 Act1 视觉不变（global CSS no leakage）
- [ ] staging API `/api/watch/timeline` 仍返回正确 events.length + 6 key rationaleByMember

### A11y

- [ ] Tabs 含 `role="tab"` + `aria-selected` + 键盘左右箭头切换
- [ ] Topic toggle 含 `aria-expanded` + 键盘 Enter/Space toggle
- [ ] Topic body 含 `role="region"` + `aria-labelledby`
- [ ] LIVE / active 状态变化用 `aria-live="polite"`

### Staging

- [ ] `npx vercel`（不带 `--prod`）部署带 `STAGING_USE_FIXTURE=true` runtime env
- [ ] preview URL 给 F 审核 + Dan 浏览器验收

---

## 8. 约束

- **不动 prod claw42.ai**
- **不动主 worktree**（主 worktree 仍有 30+ 未提交 v2 时代 WIP，独立 feature worktree 跑 v3.7）
- **不引新依赖**（package.json 不新增 framer-motion / react-flow / external font CDN）
- **不引 Satoshi from Fontshare**（Q2）
- **跟单按钮不真执行**（Q4）
- **mobile 不做**（Q1）
- 主 worktree v2 时代 WIP 清理 → 独立 task，不在 v3.7 范围
- 任何冲突 / 权限错 / push 失败 → 立即停 + 报告，不硬跑

---

## 9. 拆 commit 顺序建议

1. A1 — scoped CSS shell + v9 root + topbar + tabs + fadeInUp 动画
2. A2 — FlowIntroView 6 stages
3. A3.1 — ChatShell + Topic + TopicHead（含 toggle）
4. A3.2 — TopicBody + MessageBubble + IntensityBar + stage markers
5. A3.3 — TopicStrategy（含跟单按钮 + 占位跳转）
6. A4.1 — AgentWatchBoard 替换 + side effects clean
7. A4.2 — delete v3.6 DispatchConsole.tsx + dispatchConsoleData.ts + grep audit
8. A5 — 测试 + verify gate + staging deploy

每 commit 跑 `tsc --noEmit` + `npm run build` PASS。

---

## 10. 工作量预估（Codex 校准）

| Phase A sub                                      | 时间          |
| ------------------------------------------------ | ------------- |
| A0 视觉源契约                                    | 0（决策固定） |
| A1 scoped CSS shell                              | 0.75-1.5      |
| A2 FlowIntroView                                 | 1-1.5         |
| A3 MarketAnalysisView + ChatShell + Topic        | 1.5-2.5       |
| A4 entry 集成 + AgentWatchBoard 清理 + v3.6 删除 | 0.75-1.25     |
| A5 验证 + staging                                | 1-1.5         |
| **总计**                                         | **5-8 AI 天** |

（F 原估 7-12 AI 天，Codex 校准 5-8 因走 scoped CSS 转换不重写 Tailwind）

---

## 11. Phase B（独立 spec，本 spec 不实施）

Phase B 范围（待 Phase A 完成 + 老板验收后启动）：

- 真 chat 数据流（接 publicTimelineProjection 输出 → 转 Topic.messages）
- 多 topic 动态生成（PM decision 聚合规则）
- Intensity 激烈度算法（severity + agent 分歧度）
- 跟单按钮真接 CoinW API（合规 + 授权流程 + 法律 review）
- 实时更新（polling / WebSocket）
- 真 chat orchestrator + speaker turns + reply/mention（spec-4 Round 5 立的设计）
- mobile responsive（Q1 deferred）
- Phase 6a 11 角色架构升级

依赖 Phase 6a 启动后才能完整接入真数据流。

---

## 老板简报

这一版把 Watch 调度台从"花哨密度高"的版本换成"两 tab 简洁版"：流程介绍 tab 让用户看懂 11 角色 6 阶段怎么协作，行情分析 tab 让用户看 AI 团队正在分析的热点（多个独立卡片 + 实时辩论 + 大策略卡 + 跟单按钮）。当前是视觉层落地（数据用演示样本），跟单按钮先做成"点了告诉你功能开发中"，后续再接真实交易系统。

下一步是把团队真实输出接进来（多空辩论 / 风险审查 / PM 决策的真 LLM 输出 → 直接灌进每个 topic 卡片），那个会单独立 spec 推进。
