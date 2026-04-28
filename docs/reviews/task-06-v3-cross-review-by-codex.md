# Codex 对 task-06 v3 的三次副审

> 评审者：Codex
> 评审日期：2026-04-28
> v1 副审：docs/reviews/task-06-cross-review-by-codex.md
> v2 副审：docs/reviews/task-06-v2-cross-review-by-codex.md
> 收口判断：本次为最后一轮副审，结论必须明确 go/no-go

---

## Part A — V1-V8 修订收口验收

### V1 — 类型名对齐（TickerMap / StreamMessage）

- v2 副审来源：B1 / D1（P0 编译挂）
- v3 体现位置：Section 2.1 / 2.2 / 2.3
- 验收结论：完全修
- 证据：v3 的 `HistoryMessageEntry.tickerSnapshot` 已用 `TickerMap`（task-06 v3:76-83），`AgentAnalysisPayload.tickers` 和 `stream` 已用 `TickerMap` / `StreamMessage[]`（task-06 v3:91-100），并写明 `StreamMessage` 保持现状（task-06 v3:106-108）。PR #11 当前真实类型也正是 `TickerMap` 和 `StreamMessage`（types.ts:16, 26-29）。
- 还有遗漏：无。修订记录里“`TickerMap` → `TickerMap`”写法有点绕，但正文已对齐。

### V2 — locale 解构

- v2 副审来源：B6 / D4（P0 编译挂）
- v3 体现位置：Section 8 `AgentWatchBoard` snippet
- 验收结论：完全修
- 证据：v3 已把 `const { t } = useI18n()` 改为 `const { t, locale } = useI18n()`，随后才计算 `isZh`（task-06 v3:417-419）。PR #11 当前只解构 `t`（AgentWatchBoard.tsx:25-28），v3 对这个差异有明确修正。
- 还有遗漏：无。

### V3 — generatedAt 取值时机

- v2 副审来源：B2 / D3（字段语义）
- v3 体现位置：Section 4.2
- 验收结论：完全修
- 证据：v3 不再在 `refreshAnalysis` 函数开头取 `generatedAt`，而是在 provider 返回文本、`parseAnalysisJson` 成功之后取值（task-06 v3:198-208）。这避开了 provider 超时或 fallback 切换导致的时间偏早问题。PR #11 provider timeout 是 5 秒（llmFallbackChain.ts:17, 222-229），所以这个修订有实际意义。
- 还有遗漏：无。`validateAnalysis` 若失败会进 catch，当前 `generatedAt` 不会进入成功 payload。

### V4 — useAgentHistory refreshHistory

- v2 副审来源：B3 / D2（用户可见）
- v3 体现位置：Section 6.1；Section 8.1 banner 触发和点击
- 验收结论：部分修
- 证据：v3 给 `AgentHistoryState` 增加 `refreshHistory`（task-06 v3:320-325），返回 `fetchHistory`（task-06 v3:327-355），并在 `hasNewContent` 变 true 和用户点击 banner 时刷新 history（task-06 v3:429-432, 462-470）。
- 还有遗漏：Section 6.1 的 import 只写了 `useEffect, useState`，但正文使用了 `useRef` 和 `useCallback`（task-06 v3:312, 331, 333）。如果照 spec 复制，`useAgentHistory.ts` 会直接编译失败。这是 P0。

### V5 — liveQueue id 规则

- v2 副审来源：B4（dedup）
- v3 体现位置：Section 8.1
- 验收结论：完全修
- 证据：v3 明确 liveQueue id 必须用 `${latest.generatedAt}-${item.agentId}-${index}`（task-06 v3:437-445），不再沿用 PR #11 的 `${data.ts}-${item.agentId}-${index}`（AgentWatchBoard.tsx:54）。这让 history entry 和 live entry id 能对齐。
- 还有遗漏：实现时要把现有逐条 typing timer 中的 append 也改成这个 id。v3 注释已经点明“现有时序保留”，足够执行。

### V6 — MessageStream forwardRef 保留 autoScroll

- v2 副审来源：B5（行为退化）
- v3 体现位置：Section 9.2
- 验收结论：部分修
- 证据：v3 明确要求保留 PR #11 的 `autoScroll`、用户上滑暂停、底部“回到最新”按钮，只增补 `useImperativeHandle`（task-06 v3:515-560）。PR #11 当前这些逻辑在 `MessageStream.tsx:16-24, 52-63`。
- 还有遗漏：示例代码把 `ref` 放在一个 `div` 上（task-06 v3:549-554），但 PR #11 实际是外层 card + 内层 scroll container，真正的滚动 ref 在内层（MessageStream.tsx:27-35）。实现时必须把 imperative handle 绑到现有内层滚动容器，不能按示例简化 DOM。

### V7 — grep gate 硬退出

- v2 副审来源：R11 / Part E
- v3 体现位置：Section 13
- 验收结论：完全修
- 证据：v3 增加 `set -e`，每个 grep 都改成 `grep -q ... || { echo ...; exit 1; }`（task-06 v3:716-725），不再只是打印 FAIL。
- 还有遗漏：无。

### V8 — empty/loading i18n 替换点

- v2 副审来源：B7 / D5
- v3 体现位置：Section 12
- 验收结论：部分修
- 证据：v3 定义了 `emptyHistory` / `loadingHistory`（task-06 v3:674-696），并点名替换 `MessageStream.tsx` 空态和 `AgentWatchBoard.tsx` loading 态（task-06 v3:702-708）。PR #11 当前硬编码分别在 `MessageStream.tsx:37-40` 和 `AgentWatchBoard.tsx:92-94`。
- 还有遗漏：v3 没写 `MessageStream` 如何拿到 `t`。可选做法是组件内 `useI18n()`，或由 `AgentWatchBoard` 通过 prop 传入空态文案。直接写 `t.agentWatch.emptyHistory` 会编译失败。

---

## Part B — V 修订有没有撞坏 R1-R12

### R1 — 消息级历史

- 判断：仍成立。
- 证据：V1 只修正类型名，没有把数据模型退回 batch 级。`HistoryMessageEntry`、`pushHistoryFromBatch` 和 history API 仍按消息级工作（task-06 v3:76-83, 151-168, 269-274）。
- 风险：无新增冲突。

### R2 — generatedAt / servedAt 拆分

- 判断：仍成立，并被 V3 加强。
- 证据：payload 仍保留 `generatedAt` / `servedAt`（task-06 v3:91-100），cache hit 仍只更新 `servedAt`（task-06 v3:220-233）。V3 把 `generatedAt` 后移到 parse 成功之后（task-06 v3:198-208）。
- 风险：无新增冲突。

### R3 — historyMessages / liveQueue 分离

- 判断：仍成立。
- 证据：v3 仍分离 `historyMessages` 和 `liveQueue`（task-06 v3:421-427），`keepFivePerAgent` 只作用于 live（task-06 v3:495-501）。
- 风险：V5 的 `newMessages` 示例没有展示如何接入现有 timer append。实现时要把 id 规则落到真正的 `setLiveQueue` 里。

### R6 — visibility 先 fetch 再判断

- 判断：方向仍成立，但实现片段还有状态捕获风险。
- 证据：v3 仍先 fetch `/api/agents/analysis`，再比较 `fresh.generatedAt` 和 `lastSeenGeneratedAtRef`（task-06 v3:371-405）。
- 风险：片段里切走时读的是闭包里的 `data`（task-06 v3:397-400）。如果实现放在只初始化一次的 effect 中，`data` 可能是旧值。建议新增 `latestGeneratedAtRef`，每次 data 更新时同步，visibility handler 只读 ref。

### R8 — 时间格式化

- 判断：仍成立。
- 证据：v3 保留 `formatAgentMessageTime(timestamp, locale)` 和 `Intl.DateTimeFormat`（task-06 v3:633-668）。
- 风险：`import { isLocale }` 未使用（task-06 v3:638）。这不是 R8 撞坏，但实现时应删除。

### R9 — 前端类型 import 路径

- 判断：仍成立。
- 证据：`useAgentHistory` 仍从 `../types` import `HistoryMessageEntry`（task-06 v3:312-314），没有回退到 `@/lib/llmFallbackChain`。
- 风险：V4 的 React hook import 缺失不属于 R9 反向 import 问题，但会造成编译失败。

### R10 — 全站 LLM 历史

- 判断：仍成立。
- 证据：push 仍放在共享 `llmFallbackChain` 成功路径（task-06 v3:191-213），并且修改清单写明 Hero 行为只做 type 字段适配、不改行为（task-06 v3:138）。Act 1.5 基础 spec 也说明 Hero 和旁观页共享 server cache（act1.5 spec:326-351）。
- 风险：无新增冲突。

### R11 — Task 05 前置 gate

- 判断：仍成立，并被 V7 加强。
- 证据：v3 的 gate 检查 `FRESH_TTL_MS`、`STALE_TTL_MS`、`backgroundRefreshInFlight`、`visibilitychange`，且任一缺失直接 exit 1（task-06 v3:716-728）。Task 05 原始目标也正是这些点（task-05:57-60, 82-105, 195-255）。
- 风险：无新增冲突。

---

## Part C — V3 引入的新问题（regression 检查）

### C1 — P0：`useAgentHistory` 缺 React hook imports

- 检查对象：V4 `refreshHistory()` 设计。
- 判断：新增 regression。
- 证据：v3 Section 6.1 import 只有 `useEffect, useState`（task-06 v3:312），但代码使用 `useRef` 和 `useCallback`（task-06 v3:331-347）。
- 影响：按 spec 实现会编译失败。
- 修订指引：改成 `import { useCallback, useEffect, useRef, useState } from "react";`。

### C2 — P1：visibility handler 可能读不到最新 data

- 检查对象：R6 + V4 后的切回提示链路。
- 判断：仍有用户可见风险。
- 证据：切走时用 `data?.generatedAt` 写入 `lastSeenGeneratedAtRef`（task-06 v3:397-400），但 snippet 没规定 effect dependency 或 latest ref。Task 05 的 visibility snippet 也是一次性注册 handler（task-05:208-264）。
- 影响：如果 handler 捕获的是旧 data，切回后 `lastSeenGeneratedAtRef` 为空，banner 不显示。
- 修订指引：在 hook 内新增 `latestGeneratedAtRef`，每次 `setData(payload)` 后同步；hidden 时记录这个 ref，而不是闭包 data。

### C3 — P1：MessageStream 示例和现有 DOM 结构不完全一致

- 检查对象：V6 `forwardRef + useImperativeHandle`。
- 判断：新增实现风险。
- 证据：PR #11 现有组件是外层 card，内层 scroll div 持有 ref（MessageStream.tsx:27-35）。v3 示例把 ref 和 onScroll 放在一个简化 div（task-06 v3:549-554）。
- 影响：按示例重写会改变 DOM 层级，可能丢掉外层视觉容器或内层滚动行为。
- 修订指引：保留 `MessageStream.tsx` 的外层 card 和内层 scroll div，只把原来的 `ref` 改名为 `containerRef`，再用 `forwardRef` 暴露 `scrollToLatest`。

### C4 — P2：NewContentBanner 片段仍带未使用 import

- 检查对象：banner 点击 async 刷新链路。
- 判断：小回归风险。
- 证据：v3 仍 import `useCallback`（task-06 v3:571-572），但组件内没有使用。项目要求跑 `npm run lint`（package.json:5-10；task-06 v3:745-748）。
- 影响：如果 lint 规则把 unused import 当 error，会卡验收。就算当前规则不拦，也会增加无意义噪音。
- 修订指引：删掉 `useCallback` import；父组件如需稳定回调用 `useCallback`，在 `AgentWatchBoard` 里处理。

### C5 — P2：V8 替换点不够可执行

- 检查对象：empty/loading i18n。
- 判断：可实现，但还要补一句合同。
- 证据：v3 只说替换为 `t.agentWatch.emptyHistory`（task-06 v3:702-708），没有说明 `MessageStream` 内部调用 `useI18n` 还是通过 props 接收文案。
- 影响：实现者可能在 `MessageStream` 直接引用未定义 `t`。
- 修订指引：推荐给 `MessageStream` 新增 `emptyLabel` prop，由 `AgentWatchBoard` 统一从 `useI18n` 传入。

---

## Part D — 落地评估（最终 go/no-go）

### 最终判断：NO-GO

v3 的方向已经接近可实现，但当前不能直接交实现。原因很明确：V4 引入的 `useAgentHistory` 示例缺 `useRef/useCallback` import，这是 P0 编译问题；同时切回提示仍有读旧 data 的风险，会影响这次 task 的核心用户可见功能。

阻塞清单：

1. P0：`useAgentHistory` import 必须补 `useCallback`、`useRef`。
   修订片段：`import { useCallback, useEffect, useRef, useState } from "react";`
2. P1：`useAgentAnalysis` visibility handler 不要读闭包 `data`。
   修订片段：新增 `latestGeneratedAtRef`；每次拿到 payload 后写 `latestGeneratedAtRef.current = payload.generatedAt`；hidden 时记录该 ref。
3. P1：`MessageStream` forwardRef 必须绑定现有内层 scroll div，不改外层 card DOM。
   修订片段：保留 PR #11 的外层 `<div className="card-glow ...">`，只把内层 `ref` 换成 `containerRef`，imperative handle 用这个 ref。
4. P2：删 `NewContentBanner` 的未使用 `useCallback` import。
5. P2：V8 明确 `MessageStream` 空态文案传入方式，建议 `emptyLabel` prop。

### 实现执行建议

Codex 实现工时估算：4-6 小时编码，1-2 小时本地和 preview 行为验证。若先按上面 5 条修正文档，后续实现不需要第四轮副审，直接按修正后的清单执行。

三段 commit 拆分：

1. 后端合同 commit：更新 `types.ts`、`llmFallbackChain.ts`、analysis route、history route，并同步所有 `ts` consumer 到 `generatedAt/servedAt`，确保 `npx tsc --noEmit` 可过。
2. Watch UI commit：新增 `useAgentHistory`、更新 `useAgentAnalysis` 的 visibility/latest ref、重构 `AgentWatchBoard` history/liveQueue、增补 `MessageStream` imperative handle、新增 `NewContentBanner`。这一段也必须独立编译。
3. 文案收尾 commit：新增 `formatAgentMessageTime`、更新 `MessageBubble`、i18n types/dicts、empty/loading 文案替换，跑完整 build/lint。

必须跑的自动化校验：

- Task 05 grep gate：`FRESH_TTL_MS` / `STALE_TTL_MS` / `backgroundRefreshInFlight` / `visibilitychange`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- 负向 grep：`IntersectionObserver`、`loadMore|hasMore`、`{count}|{minutes}`、前端 hook 反向 import `@/lib/llmFallbackChain`

如果 Dan 决定不再改 spec、直接进入实现，也可以由 Codex 在实现时按上面 5 条修正。但按本副审的收口口径，v3 原文结论是 **NO-GO**。
