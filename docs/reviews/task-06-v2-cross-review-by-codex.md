# Codex 对 task-06 v2 的二次副审

> 评审者：Codex
> 评审日期：2026-04-28
> 评审输入：v2 spec + 一次副审 + Task 05 依赖 + Act 1.5 基础 spec + PR #11 现有代码
> v1 副审：docs/reviews/task-06-cross-review-by-codex.md

---

## Part A — R1-R12 修订验收

### R1 — 数据模型消息级

- v1 副审来源：Part A §1 / §3 / §6 + Part B1
- v2 spec 体现位置：Section 2.1 `HistoryMessageEntry`；Section 4.1 `pushHistoryFromBatch`；Section 5 history API；Section 8 `mergeHistoryAndLive`
- 验收结论：部分修
- 证据：v2 已把历史单位改为消息级 entry（task-06 v2:53-63），后端 flatten `payload.stream` 写入 `historyBuffer`（task-06 v2:130-147），API 返回 `entries`（task-06 v2:246-250），前端把 `HistoryMessageEntry[]` 映射成 `AgentWatchMessage[]`（task-06 v2:433-446）。
- 还有遗漏：类型名没有对齐现有代码。v2 写的是 `TickersPayload` 和 `AgentStreamItem`（task-06 v2:61, 76-77），PR #11 当前真实类型是 `TickerMap` 和 `StreamMessage`（types.ts:16, 26-29）。如果不先改名或补 alias，开工会直接卡在类型层。

### R2 — generatedAt / servedAt 拆分

- v1 副审来源：Part B9 + Part A §5
- v2 spec 体现位置：Section 2.2 字段拆分；Section 4.2 cache hit 只更新 `servedAt`
- 验收结论：部分修
- 证据：v2 明确 `generatedAt` 永不被 cache 改写，`servedAt` 替代旧 `ts`（task-06 v2:70-83）。cache fresh / stale 路径只改 `servedAt`（task-06 v2:197-209），并要求新增判断用 `generatedAt`（task-06 v2:214）。
- 还有遗漏：`generatedAt` 在 `refreshAnalysis` 一进入函数就取值（task-06 v2:173-185），早于取行情、provider 调用、解析和 fallback 链切换。它更像 batch start time，不是 LLM 成功生成时间。建议在 provider 成功解析后再取 `generatedAt`，或把字段命名改成 `batchStartedAt`。

### R3 — historyMessages / liveQueue 分离

- v1 副审来源：Part B1 + Part A §6
- v2 spec 体现位置：Section 8.1 / 8.2
- 验收结论：部分修
- 证据：v2 拆出 `historyMessages` 和 `liveQueue`（task-06 v2:392-398），并明确 `keepFivePerAgent` 只作用于 live 路径（task-06 v2:450-456）。
- 还有遗漏：`mergeHistoryAndLive` 注释说用 `generatedAt + agentId + content` dedup，但实现只按 `liveIds` 过滤（task-06 v2:408-446）。同时 live message 的 id 生成规则没有在 Section 8 写死。PR #11 当前 id 是 `${data.ts}-${item.agentId}-${index}`（AgentWatchBoard.tsx:54）。v2 必须明确 liveQueue 改成 `${latest.generatedAt}-${agentId}-${index}`，否则 history 和 live 可能重复展示。

### R4 — 砍 load more / 数量 / since

- v1 副审来源：Part C 最小可落地
- v2 spec 体现位置：修订记录；修改清单；history API；useAgentHistory；NewContentBanner；提交说明
- 验收结论：完全修
- 证据：v2 明确砍 load more、banner 精确数量、history API `since`（task-06 v2:23, 110-115）。API 注释写不返回 `hasMore`、不接受 `since`（task-06 v2:278），hook 无 `loadMore`（task-06 v2:334），banner 文案固定为有新内容（task-06 v2:572）。
- 还有遗漏：无。由此带来的 banner 点击后刷新历史问题放到 Part B。

### R5 — 砍 IntersectionObserver

- v1 副审来源：Part B5 / B13
- v2 spec 体现位置：Section 9.1；验收 grep
- 验收结论：完全修
- 证据：v2 明确把 `IntersectionObserver` 整体移出实现（task-06 v2:463-468），验收也要求组件内 grep 无输出（task-06 v2:670）。
- 还有遗漏：无。

### R6 — visibility 先 fetch 再判断

- v1 副审来源：Part B6
- v2 spec 体现位置：Section 7.1
- 验收结论：部分修
- 证据：v2 在切回 visible 后强制 fetch `/api/agents/analysis`，拿到 fresh response 后再比较 `fresh.generatedAt > lastSeenGeneratedAtRef.current`（task-06 v2:342-376）。这修掉了 v1 用旧 data 判断的 race。
- 还有遗漏：只更新了 analysis data，没有触发 history refresh。用户点击 banner 时只执行 scroll 和 dismiss（task-06 v2:419-425），如果 `useAgentHistory` 仍是 mount 后一次性拉取（task-06 v2:303-330），列表可能还没有最新历史。

### R7 — history API 缓存策略

- v1 副审来源：Part A §4 + Part B4
- v2 spec 体现位置：Section 5.1
- 验收结论：完全修
- 证据：空 entries 返回 `Cache-Control: no-store`，非空返回 `public, s-maxage=10, stale-while-revalidate=20`（task-06 v2:240-244）。
- 还有遗漏：无。10 秒短缓存符合轻量历史的目标。

### R8 — 时间格式化

- v1 副审来源：Part B7
- v2 spec 体现位置：Section 11.1 / 11.2
- 验收结论：完全修
- 证据：v2 新增 `formatAgentMessageTime(timestamp, locale)`，把 `zh_CN` 转成 `zh-CN` 后走 `Intl.DateTimeFormat`（task-06 v2:584-598），并替换 `MessageBubble` 当前本地 `formatTime`（task-06 v2:604-610）。PR #11 当前确实是手写 `getHours/getMinutes`（MessageBubble.tsx:8-13）。
- 还有遗漏：无。实现时删掉未使用的 `isLocale` import 即可（task-06 v2:581）。

### R9 — 前端类型 import 路径

- v1 副审来源：Part B10
- v2 spec 体现位置：修订记录；Section 6.1；验收 grep
- 验收结论：完全修
- 证据：v2 要求 hook 从模块本地 `../types` import（task-06 v2:289-291），并在验收里要求 hooks 不从 `@/lib/llmFallbackChain` 反向 import（task-06 v2:674）。
- 还有遗漏：无。后端 route 从 `@/lib/llmFallbackChain` import history getter 是合理边界，不属于这个问题。

### R10 — 历史语义为全站 LLM 历史

- v1 副审来源：Part B12
- v2 spec 体现位置：修订记录；Section 2 / 4；显式不动 Hero 行为
- 验收结论：完全修
- 证据：v2 明确历史是全站 LLM 历史，Hero 触发的 batch 也进 buffer（task-06 v2:29）。Section 4 把 `pushHistoryFromBatch` 放在共享 `getAgentAnalysis` 成功路径（task-06 v2:170-190）。基础 spec 也写过 RobotLayer 和旁观页是独立轮询源，但共享 server cache（act1.5 spec:326-351）。
- 还有遗漏：无。这个语义接受后，产品文案不要再说是用户自己的旁观页会话历史。

### R11 — Task 05 前置 grep gate

- v1 副审来源：Part A §12
- v2 spec 体现位置：Section 13
- 验收结论：部分修
- 证据：v2 要求先检查 `FRESH_TTL_MS`、`STALE_TTL_MS`、`backgroundRefreshInFlight`、`visibilitychange`（task-06 v2:647-660）。Task 05 也把这些列入目标和验收（task-05:57-60, 82-105, 195-255, 302-307）。
- 还有遗漏：当前写法是 `grep ... || echo "FAIL"`，不会让脚本失败。人工照做可以停手，但自动 gate 不够硬。建议改成 `grep -q ... || exit 1` 的小脚本。

### R12 — 行为测试不删 env

- v1 副审来源：Part A §10
- v2 spec 体现位置：Section 14
- 验收结论：完全修
- 证据：v2 行为测试改成检查 `/api/agents/history`、history entry `source`、cache hit 不进 history、切回 banner 和 empty history（task-06 v2:680-707）。不再要求删除 Vercel env；Task 05 原文里仍有删除 env 的测试（task-05:315-322），但 v2 没继承这个做法。
- 还有遗漏：无。

---

## Part B — Regression 检查

### B1 — P0：v2 引入了不存在的类型名

- 检查对象：数据模型重写。
- 判断：有 regression。
- 证据：v2 使用 `TickersPayload`、`AgentStreamItem`（task-06 v2:61, 76-77），PR #11 现有类型是 `TickerMap`、`StreamMessage`（types.ts:16, 26-29）。
- 影响：实现者按 spec 复制会编译失败，或临时新增重复类型，造成 API payload 和 UI 类型分叉。
- 建议：统一用现有 `TickerMap` / `StreamMessage`，或者在 `types.ts` 明确 `type TickersPayload = TickerMap`，但不要两套名字并存。

### B2 — P1：`generatedAt` 取值时机不是生成完成时刻

- 检查对象：`generatedAt / servedAt` 新字段。
- 判断：有 regression。
- 证据：`generatedAt = Date.now()` 放在 `refreshAnalysis` 开头（task-06 v2:173-185），provider 调用可能失败并切换，也可能耗时 5 秒。基础代码有 5 秒 provider timeout（llmFallbackChain.ts:17, 222-229）。
- 影响：banner 新增判断、history 排序、TTL 都会使用偏早时间。偏差不一定大，但字段语义会变脏。
- 建议：把 `generatedAt` 放在 `parseAnalysisJson` 和 `validateAnalysis` 成功之后，`servedAt` 可以同一刻或响应返回前取值。

### B3 — P1：banner 点击不会刷新 history

- 检查对象：visibility fetch + NewContentBanner + useAgentHistory。
- 判断：有 regression。
- 证据：`useAgentHistory` 只在 mount 时拉一次（task-06 v2:303-330）。切回 tab 后 analysis fetch 只 `setData(fresh)`（task-06 v2:356-364）。banner 点击只 scroll + dismiss（task-06 v2:419-425）。
- 影响：用户看到有新内容，点击后可能只是滚到旧列表底部，看不到新 batch。
- 建议：`useAgentHistory` 返回 `refreshHistory`；当 `hasNewContent` 为 true 或用户点击 banner 时，先刷新 history，再 scroll 到最新。

### B4 — P1：liveQueue id 规则没写实，dedup 可能失效

- 检查对象：`mergeHistoryAndLive`。
- 判断：有 regression。
- 证据：v2 的 dedup 实现按 `liveIds` 过滤（task-06 v2:433-446），但 liveQueue append 处只写“现有 PR #11 typing 动画时序逻辑”（task-06 v2:400-406）。PR #11 当前 live id 来自 `${data.ts}-${item.agentId}-${index}`（AgentWatchBoard.tsx:54）。
- 影响：如果 liveQueue 继续用旧 `data.ts` 或 `Date.now()` 派生 id，history entry 与 live entry id 不一致，同一条消息会重复。
- 建议：在 Section 8 直接写明 liveQueue message id 必须使用 `${latest.generatedAt}-${agentId}-${index}`。

### B5 — P1：forwardRef 重写可能丢掉现有 auto-scroll 行为

- 检查对象：`MessageStream` 暴露 `scrollToLatest`。
- 判断：有 regression 风险。
- 证据：v2 forwardRef 示例只展示容器和 `scrollToLatest`（task-06 v2:470-500），但 PR #11 当前还有 `autoScroll` 状态、用户上滑后不强制滚到底、手动“回到最新”按钮（MessageStream.tsx:16-24, 52-63）。
- 影响：如果照 snippet 重写，用户上翻历史时可能被新消息拉回底部，或者丢掉已有的回到最新按钮。
- 建议：保留当前 `autoScroll` 逻辑，只在同一个 ref 上增补 `useImperativeHandle`。

### B6 — P0：`AgentWatchBoard` 示例里 `locale` 未定义

- 检查对象：数据流分层示例。
- 判断：有 regression。
- 证据：v2 snippet 写 `const { t } = useI18n(); const isZh = locale === "zh_CN";`（task-06 v2:388-393），但没有从 `useI18n` 解构 `locale`。PR #11 当前也只解构了 `t`（AgentWatchBoard.tsx:25-28）。
- 影响：按 snippet 实现会直接编译失败。
- 建议：改成 `const { t, locale } = useI18n();`，或继续依赖 middleware 保证 `/agent` 只在 `zh_CN` 可访问，不在组件里重复判 locale。

### B7 — P2：新增 empty/loading i18n key 但组件使用点没写清

- 检查对象：i18n 和空历史状态。
- 判断：有 regression 风险。
- 证据：v2 新增 `emptyHistory`、`loadingHistory`（task-06 v2:615-640），但 Section 8 的 UI 片段没有使用它们（task-06 v2:414-429）。PR #11 当前空态和 loading 仍是硬编码中文（MessageStream.tsx:37-40, AgentWatchBoard.tsx:92-94）。
- 影响：类型和字典加了，但 UI 仍可能保留硬编码，和 v2 的多语字典要求不一致。
- 建议：在 Section 8/9 明确 `MessageStream` 或 `AgentWatchBoard` 接收 empty/loading 文案。

---

## Part C — 砍掉项清理验收

### load more / hasMore

- 判断：清干净。
- 扫描结果：v2 只在“砍掉”“无 loadMore”“grep 无输出”语境里出现相关词（task-06 v2:110-112, 278, 334, 670-671）。没有实现路径要求 `loadMore` 或 `hasMore`。

### IntersectionObserver

- 判断：清干净。
- 扫描结果：v2 只保留删除说明和负向 grep（task-06 v2:24, 463-468, 670）。没有要求出现 observer。

### Banner 数量和 `{count}` 占位符

- 判断：清干净。
- 扫描结果：banner 文案固定为有新内容（task-06 v2:572, 630-636）。`{count}` 只出现在负向 grep 验收里（task-06 v2:672），不是文案字段。
- 说明：history API 返回 `count`（task-06 v2:246-250）是 API metadata，不等于 banner 显示数量。可以保留。

### API `since` 参数

- 判断：清干净。
- 扫描结果：v2 明确不接受 `since`（task-06 v2:114, 278, 760）。没有 route 代码要求读取 `since`。

### `/agent/archive` 页面

- 判断：清干净。
- 扫描结果：只在显式不在范围中出现（task-06 v2:115）。没有新增 route 或链接。

### `{count}` / `{minutes}` 文案占位符

- 判断：清干净。
- 扫描结果：v2 验收要求 zh_CN 字典 grep 无输出（task-06 v2:672）。正文没有要求新增 `{minutes}`。

### `dismissAriaLabel`

- 判断：清干净。
- 说明：这个字段不是残留。v2 banner 有关闭按钮，且使用 `aria-label={t.agentWatch.banner.dismissAriaLabel}`（task-06 v2:556-563），所以保留合理。

---

## Part D — v1 副审未覆盖但 v2 需要补的点

### D1 — P0：新类型命名需要一次性对齐

v1 副审指出过 import 来源问题，但没有覆盖 v2 新增的 `TickersPayload` / `AgentStreamItem` 命名。现在这是一个新的落地阻断。建议把 R1/R2 里的所有示例代码改成现有真实类型名，避免实现者自己猜。

### D2 — P1：history refresh 合同缺失

v1 副审只要求砍数量和 load more，没有覆盖“有新内容”后如何把新 history 拉进列表。v2 现在有 banner，但没有给 `useAgentHistory` refresh API。这个问题会直接影响用户点击后的可见结果。

### D3 — P1：`generatedAt` 字段语义和取值位置需要绑定

v1 副审只要求拆分 `generatedAt` / `servedAt`，没有审到取值位置。v2 当前把它放在 provider 调用前，会让字段名和语义不一致。实现前应修正。

### D4 — P0：`locale` 示例变量缺失

v2 Section 8 新加了 `isZh` 判断，但没有定义 `locale`。这不是产品问题，是可复制代码片段会失败的问题。建议改示例，或删掉组件内 `isZh`，只依赖 middleware。

### D5 — P2：空态文案要落到具体组件

v2 已经补了 `emptyHistory` / `loadingHistory`，但没有指定替换 PR #11 哪些硬编码文案。建议在修改清单里点名 `MessageStream.tsx` 空态和 `AgentWatchBoard.tsx` loading 态。

---

## Part E — 实现可行性

### Task 05 grep gate

方向正确，能挡住大部分错序开工。PR #11 当前代码仍是 60 秒 cache（llmFallbackChain.ts:15-17）、没有 `backgroundRefreshInFlight`，`useAgentAnalysis` 也没有 `visibilitychange`（useAgentAnalysis.ts:38-56）。所以 task-05 没合时，这个 gate 会暴露问题。

但 gate 写法不够硬。`grep ... || echo "FAIL"` 只会打印，不会停止后续命令。建议改成：

```sh
grep -q "FRESH_TTL_MS" src/lib/llmFallbackChain.ts || exit 1
grep -q "STALE_TTL_MS" src/lib/llmFallbackChain.ts || exit 1
grep -q "backgroundRefreshInFlight" src/lib/llmFallbackChain.ts || exit 1
grep -q "visibilitychange" src/modules/agent-watch/hooks/useAgentAnalysis.ts || exit 1
```

### Commit 拆分判断

v2 的 8 个改动点高耦合，不能拆成完全独立的小提交。`AgentAnalysisPayload` 从 `ts` 改成 `generatedAt/servedAt` 会同时影响后端、hook、Hero、CoinModal、AgentWatchBoard 和消息 id。

可接受的拆法：

1. 后端合同提交：types、`llmFallbackChain`、analysis route、history route，顺手更新所有旧 `ts` consumer 到可编译状态。
2. Watch UI 提交：`useAgentHistory`、`useAgentAnalysis` banner state、`AgentWatchBoard` 分层、`MessageStream` ref、`NewContentBanner`。
3. 文案和收尾提交：`formatAgentMessageTime`、i18n、空态/loading 文案、grep/build 修复。

第一提交必须保证全仓类型能过。不能先只改 types，再把 UI 留到下一提交。

### 工时估算

- Codex 接：4-6 小时实现，另加 1-2 小时 preview 行为验证。
- Airy 接：1-1.5 天更稳，因为要跨后端 cache、前端动画、i18n 和浏览器可见性时序。
- 不确定性来源：Task 05 是否已经真实合并到 PR #11，以及 Vercel preview 上多实例 / cache 行为是否复现本地。

---

## Part F — 最终建议

- v2 落地评估：微调后落地。
- 判断：不需要重设。v2 已把 v1 的核心 P0 基本修到正确方向：消息级历史、时间语义拆分、live/history 分层、砍复杂 load more。但还不能直接开工，因为存在 2 个会编译失败的问题和 3 个会影响用户可见结果的问题。

必须修复清单：

1. 把 `TickersPayload` / `AgentStreamItem` 改成当前真实类型，或在 `types.ts` 明确 alias。
2. 把 `generatedAt` 改为 provider 成功解析后的时间，或改字段名。
3. `useAgentHistory` 暴露 refresh，并在 banner 显示或点击时刷新 history。
4. 固定 liveQueue id 规则：`${latest.generatedAt}-${agentId}-${index}`。
5. 修 `AgentWatchBoard` snippet 里的 `locale` 未定义。
6. 把 task-05 grep gate 改成失败即退出。
7. 明确空态/loading i18n 替换 PR #11 硬编码文案。

Airy vs Codex：

建议 Codex 接核心实现，Airy 做文案、QA 和 preview 行为验收。理由不是能力问题，而是改动横跨 API payload、server cache、React state merge、动画滚动和 i18n，最怕半途出现编译断层。Codex 更适合一次性把类型链路打通；Airy 可以在实现后按场景跑验收并补充体验细节。
