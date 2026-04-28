# Codex 对 Task 06 的副审

> 评审者：Codex（OpenAI Codex）
> 评审日期：2026-04-28
> 评审输入：
> - docs/airy-tasks/task-06-history-buffer-and-replay.md（主对象）
> - docs/airy-tasks/task-05-cache-strategy-and-deepseek.md（依赖）
> - docs/codex-specs/spec-act1-5-watch-page-and-hero-injection.md（基础 spec）
> - PR #11 已落地代码

---

## Part A — Task 06 逐节挑刺

### Section 1 — 背景

- **该节核心设计**：把每次成功 LLM batch 从一次性展示改成可回看的轻历史资产，新用户默认看到 60 条，回访用户看到新增提示。
- **风险 / 漏洞**：数量口径不一致。Task 06 说默认 60 条约 1 小时，又写 5 分钟一批 × 12 批 × 3 Agent 约 180 条段，再说 stream 列表用 1-Agent-per-batch 取最新 60（task-06:29-34）。这同时混用了 batch、Agent message、展示条目三个单位。PR #11 的基础 spec 明确每 batch 只有 3 条 stream（act1.5 spec:207-211），当前前端也按 3 条 append（AgentWatchBoard:42-60）。如果 API 返回 60 个 batch，前端实际可展开 180 条消息；如果返回 60 条消息，后端就不该存 AgentAnalysisPayload batch。
- **F 的实现路径是否最优**：否。当前目标成立，但数据单位没锁死，后续实现会在接口层和 UI 层互相误读。
- **改进建议**：先把历史数据单位改成 `HistoryMessageEntry`，字段包含 `id`、`batchTs`、`agentId`、`content`、`tickerSnapshot`、`source`。若继续存 batch，则所有文案都改成 60 个 batch，并把默认量改成 20 个 batch 才接近 1 小时。建议采用消息级 entry，默认 60 条消息，上限 200 条消息。

### Section 2 — 修改清单

- **该节核心设计**：列出后端 buffer、history API、history hook、banner、load more 和 i18n 增量。
- **风险 / 漏洞**：表格写 `types.ts` 加 `HistoryEntry`，但后续 hook 代码直接使用 `AgentAnalysisPayload[]`（task-06:44, task-06:167-172）。这不是小命名差异，而是数据模型冲突。另一个问题是没有列出 `MessageBubble.tsx`，但历史条目的时间显示一定会落到这里；PR #11 当前 `formatTime` 只用本地 `getHours/getMinutes`（MessageBubble:8-13）。
- **F 的实现路径是否最优**：部分。文件范围大体对，但漏了最关键的时间显示组件，也没有把 HistoryEntry 的结构写实。
- **改进建议**：修改清单必须新增 `MessageBubble.tsx` 或新增专用 `HistoryMessageBubble.tsx`。`types.ts` 里明确两层类型：`HistoryBatchEntry` 和 `HistoryMessageEntry`，最终传入 `MessageStream` 的必须是 `AgentWatchMessage[]` 或兼容扩展，而不是 `AgentAnalysisPayload[]`。

### Section 3 — 任务 A：后端 ring buffer

- **该节核心设计**：在 `llmFallbackChain.ts` 中加 200 上限的 in-memory buffer，成功 LLM batch 写入，cache 和 static fallback 不写。
- **风险 / 漏洞**：buffer 存的是 `AgentAnalysisPayload[]`（task-06:63-80），但业务上要的是 200 条评论上限。这个实现实际是 200 个 batch，上限约 600 条 stream message，还附带 heroBubbles 和 coinComments，内存估算会低估。第二个风险是只按最后一个 `ts` 去重（task-06:66-70），如果未来后台 refresh 和同步 refresh 形成交错，非尾部重复不会被去掉。
- **F 的实现路径是否最优**：部分。in-memory ring buffer 符合 Dan 轻实现方向，但 batch 级存储不适合前端需求。
- **改进建议**：`pushHistory` 应在成功 LLM 后把 `value.stream` flatten 成 3 条 message entry，再按 `batchTs-agentId-index` 去重。去重结构用 `Set` 或 `Map` 维护最近 id。若坚持 batch 级，API 要叫 `getHistoryBatches`，并在 route 层做 flatten，避免 UI 直接消费 batch。

### Section 4 — 任务 B：`/api/agents/history` route

- **该节核心设计**：新增 GET history API，支持 `limit`，nodejs runtime，返回 entries 并加短 CDN cache。
- **风险 / 漏洞**：`getHistory(limit)` 已经把 >200 clamp 到 200，但 route 只对 <=0 返回 400（task-06:123-148），接口行为不透明；客户端不知道请求 260 后被截断。另一个风险是空 buffer 响应带 `s-maxage=30`（task-06:137-140），cold start 后第一个空数组可能被缓存，刚生成 first batch 的用户仍会继续拿空历史。
- **F 的实现路径是否最优**：部分。`runtime = "nodejs"` 是对的，因为 Edge isolate 不适合进程内 buffer；但 CDN cache 对 mutable in-memory buffer 要非常克制。
- **改进建议**：返回字段加 `limit`、`max`、`hasMore`、`oldestTs`、`newestTs`。当 `entries.length === 0` 时设置 `Cache-Control: no-store`，非空时再用 `s-maxage=10, stale-while-revalidate=30`。如果要保留 30 秒缓存，必须在文档里接受 history 会延迟一轮。

### Section 5 — 任务 C：前端 history hook

- **该节核心设计**：新增 `useAgentHistory` 拉 `/api/agents/history`，并在 `useAgentAnalysis` 里加 visibility gap 检测。
- **风险 / 漏洞**：代码片段从 `@/lib/llmFallbackChain` import `AgentAnalysisPayload`（task-06:159-160），但 PR #11 的类型定义在 `src/modules/agent-watch/types.ts`，`llmFallbackChain.ts` 只是 import 它（llmFallbackChain:5-13）。这会直接编译失败。gap 检测也有 race：切回可见时先拿旧 `data.ts` 对比，再启动 polling（task-06:240-256）。如果新数据还没 fetch 回来，banner 不会出现；如果 `data.ts` 是 cache 响应的 served-at 时间，也可能把旧内容误判为新内容。
- **F 的实现路径是否最优**：否。hook 拆分方向对，但关键时序写错，类型 import 也错。
- **改进建议**：`useAgentHistory` 从 `../types` import 类型。`useAgentAnalysis` 不要在 visibility event 当场计算新增；应在切回后强制 fetch，拿到 response 后比较 `generatedAt` 或 `batchTs`，再决定 banner。Task 05 也需要把 `ts` 分成 `generatedAt` 和 `servedAt`，否则 cache 返回时用 `Date.now()` 改写 ts（llmFallbackChain:331-332）会污染新增判断。

### Section 6 — 任务 D：AgentWatchBoard 整合

- **该节核心设计**：在主容器里合并历史和实时 latest，展示 NewContentBanner，并传给 MessageStream。
- **风险 / 漏洞**：当前 PR #11 的 `keepFivePerAgent` 在 state 更新时只保留每 Agent 5 条（AgentWatchBoard:14-22, 50-60）。Task 06 写保留这个逻辑，同时又希望展示 60 条历史（task-06:268-302），两者冲突。更深的问题是 `mergeAndDedup` 返回 `AgentAnalysisPayload[]`（task-06:291-299），而 PR #11 `MessageStream` 接收的是 `AgentWatchMessage[]`（MessageStream:9-15）。这个片段不能直接落地。
- **F 的实现路径是否最优**：否。需要先重写数据管道，再谈 UI 整合。
- **改进建议**：拆成两个层级：`historyMessages` 是消息级数组，最多 200；`liveQueue` 只负责正在打字的 3 条动画。`keepFivePerAgent` 仅用于 live-only 模式，或改成 `keepLatestPerAgent(messages, 50)` 并只在内存保护时触发。`MessageStream` 的 prop 类型扩展为 `{ messages, typingAgent, hasMore, onLoadMore, onJumpToLatest }`，不要传 batch。

### Section 7 — 任务 E：NewContentBanner 组件

- **该节核心设计**：新增紫色 sticky banner，展示过去 N 分钟新增 M 条，点击跳到最新，30 秒后消失。
- **风险 / 漏洞**：i18n 里设计了 `dismissAriaLabel`（task-06:413-416, 425-428），但组件没有关闭按钮，也没有把 aria label 用到任何可 dismiss 控件（task-06:333-352）。`useEffect` 依赖 `onDismiss`（task-06:327-331），如果父组件 inline 传函数，每次 render 会重置 30 秒 timer。最后，`onJumpToLatest` 无法独立实现，因为当前 `MessageStream` 的 scroll ref 是组件内部状态（MessageStream:16-24），父层拿不到。
- **F 的实现路径是否最优**：部分。视觉方向可用，交互合同不完整。
- **改进建议**：Banner 需要两个动作：主按钮跳到最新，旁边 icon button 关闭。父层用 `useCallback` 稳定 `onDismiss`。`MessageStream` 暴露 `scrollToLatest` 可以通过 prop callback 或 `forwardRef/useImperativeHandle` 实现。无障碍上给主按钮 `aria-live="polite"` 的容器，而不是只靠颜色和动画。

### Section 8 — 任务 F：load more 交互

- **该节核心设计**：在 MessageStream 顶部放 sentinel，用 IntersectionObserver 在用户向上滚到顶部时加载更多历史。
- **风险 / 漏洞**：observer 没设置 `root: containerRef.current`（task-06:375-384），默认观察 viewport，不是内部滚动容器。PR #11 的 MessageStream 是内部 `h-[560px] overflow-y-auto`（MessageStream:27-35），因此 sentinel 在滚动容器内时，默认 root 可能不按预期触发。另一个 race 是初次挂载时滚动条还没被拉到底，sentinel 在顶部已可见，可能连续触发 loadMore，直接拉到 200 条。
- **F 的实现路径是否最优**：否。交互模型对，但 observer 配置缺关键参数。
- **改进建议**：设置 `root: containerRef.current`，并在 `initialScrollDoneRef` 为 true 后才启动 observer。保留一个手动加载更多按钮作为 fallback；按钮可以隐藏在 sentinel 区域，但不能只有 `sr-only` 文案。加载中要加 `loadMoreInFlightRef`，防止重复请求。

### Section 9 — i18n 新字段

- **该节核心设计**：给 banner 和 load more 增加 i18n key，非中文 locale 填英文占位。
- **风险 / 漏洞**：只定义了 `newContent` 和 `dismissAriaLabel`（task-06:413-418），没有 `emptyHistory`、`loadingHistory`、`loadMoreError`、`endOfHistory`。但 Section 4 已经要求 cold start 空 buffer 时前端表现为暂无历史（task-06:145-148），Section 10 也要求 load more 到 200 后停止（task-06:454-458）。没有这些文案，UI 会继续硬编码中文或沉默失败。
- **F 的实现路径是否最优**：部分。新增 key 方向对，但字段集少。
- **改进建议**：补齐 `emptyHistory`、`loadingHistory`、`loadMore`、`loadMoreError`、`endOfHistory`、`newContent`、`dismissAriaLabel`。即使 v1 只有中文页，其他 9 个 dict 也必须完整，否则类型会要求所有 locale 同步。

### Section 10 — 验收

- **该节核心设计**：用 grep、类型构建和四个行为场景验收历史沉淀、banner、fallback 和实例隔离。
- **风险 / 漏洞**：行为测试无法证明目标。场景 A 要求部署后几秒看到约 60 条历史（task-06:454-457），但 Section 4 又承认 cold start 返回空数组，first analysis 后才开始有 1 batch（task-06:145-148）。如果没有预热或 seed，这个验收在新部署后必然失败。场景 C 要删除 Vercel env 触发 static fallback（task-06:467-470），成本很高，也会影响同项目其他预览。
- **F 的实现路径是否最优**：部分。grep 可以保留，行为验收要改成可操作。
- **改进建议**：增加本地可验证的 API contract：启动无历史返回空且 no-store；mock 或临时 dev-only endpoint 不建议上生产，但可以在 unit 脚本里直接调用 `pushHistoryForTest`。Vercel 手动验收改成观察日志和 history entries 的 `source` 字段，不要通过删 env 来测。

### Section 11 — 风险 / 注意

- **该节核心设计**：声明 cold start、多实例不一致、内存、gap 估算和 load more 边界。
- **风险 / 漏洞**：这里把 gap 估算偏高判为 acceptable（task-06:491），但 banner 是用户显式看到的数量，错得太多会伤害信任。Task 05 的 stale 策略会让 fresh 期 5 分钟不调 LLM，stale 期返回旧数据并后台 refresh（task-05:87-105），实际新 batch 节奏不一定是固定 5 分钟。另一个问题是内存估算按每条 AgentAnalysisPayload 约 3KB（task-06:489），但如果 max 是 200 batch，就不是 200 条消息，而是 200 份含 16 条文本的 payload。
- **F 的实现路径是否最优**：否。风险分级偏轻。
- **改进建议**：banner 数量不要估算，改用 `/api/agents/history?since=lastSeenBatchTs` 返回真实新增条数。内存估算按实际数据模型重新算。多实例和 cold start 不阻塞 v1，但必须把首屏文案改成历史正在积累中，避免承诺 1 小时历史。

### Section 12 — 提交

- **该节核心设计**：Task 06 实现继续走 PR #11 feature 分支，提交 history buffer + replay。
- **风险 / 漏洞**：从工程流程看，Task 06 要基于 Task 05 已合并（task-06:7），但提交说明没有强制检查 Task 05 的 cache 常量和 idle detection 已存在。若 Airy 从当前 PR #11 直接做，会在 60 秒 cache 版本上实现历史，随后 Task 05 再改缓存，pushHistory 时序会再次漂移。
- **F 的实现路径是否最优**：部分。实现分支策略服从 PR #11，但缺少前置检查。
- **改进建议**：提交前增加 grep gate：`FRESH_TTL_MS`、`STALE_TTL_MS`、`backgroundRefreshInFlight`、`visibilitychange` 必须存在。若不存在，Task 06 不应开工。

### Section 13 — 副审

- **该节核心设计**：要求本 spec 落地前先做 Codex cross-review。
- **风险 / 漏洞**：副审只写文件路径（task-06:523-527），没有规定副审结论如何回写 Task 06，也没有规定 P0/P1 是否必须修改后才能落地。
- **F 的实现路径是否最优**：部分。副审入口有了，闭环没有。
- **改进建议**：把副审结论设为 gate：P0 必须改 spec，P1 至少确认接受或延后；Part C 的 go/no-go 进入 Task 06 顶部修订记录。否则 review 文件会变成旁路材料。

---

## Part B — 独立补充（F 漏掉的边界）

### B1 — P0：`keepFivePerAgent` 会截断预灌历史

- **位置**：Task 06 Section 6；PR #11 `AgentWatchBoard.tsx`。
- **是否成立**：成立。
- **问题**：当前 `keepFivePerAgent` 每个 Agent 只保留 5 条（AgentWatchBoard:14-22），每次 append 都会应用（AgentWatchBoard:50-60）。如果历史预灌复用同一 state，60 条会被截到最多 15 条。
- **建议**：历史消息和 live typing queue 分离。历史列表不走 `keepFivePerAgent`；live-only 动画层可以保留 5 条上限，或者把上限提升成 `MAX_VISIBLE_HISTORY_MESSAGES = 200`。
- **为什么 F 可能漏掉**：F 把底层数据和展示层状态当成两层，但当前代码没有第二层。
- **是否阻塞 task-06 落地**：阻塞。先改数据流再实现。

### B2 — P1：Task 05 stale-while-revalidate 会稀释 pushHistory 节奏

- **位置**：Task 06 Section 1 / Section 11；Task 05 Section 3。
- **是否成立**：成立。
- **问题**：Task 05 fresh hit 直接返回 cache，不触发 LLM（task-05:87-90）；stale hit 返回 stale，同时后台 refresh（task-05:92-101）。因此 `pushHistory` 只在真正 refresh 成功后触发。低流量场景下，历史累积不是稳定 5 分钟一批。
- **建议**：所有数量展示基于实际 history count，不用 `{minutes}/5min*3` 估算。文档里把 60 条默认理解为最多返回 60 条，而不是保证 1 小时必有 60 条。
- **为什么 F 可能漏掉**：Task 06 先按理想 5 分钟 batch 推导，没把 Task 05 的 stale 命中路径纳入公式。
- **是否阻塞 task-06 落地**：不阻塞，但会影响 banner 和验收。

### B3 — P1：Vercel serverless lifecycle 会让 ring buffer 随实例消失

- **位置**：Task 06 Section 4 / Section 11。
- **是否成立**：成立，但具体 idle threshold 需 Dan 确认当前 Vercel 计划。
- **问题**：in-memory buffer 只存在于当前函数实例。实例 idle、冷启动、并发扩容、部署都会清空或分裂 buffer。Task 06 承诺新用户首次看到 1 小时历史（task-06:3），但 Section 11 又接受 cold start 空数组（task-06:485-487），两者冲突。
- **建议**：v1 可以接受 in-memory，但首屏承诺要降级为已有历史会自动补齐。cold start 时返回静态 seed 或直接展示 live first batch，不要显示空白。seed 不能写入历史，只做首屏补位。
- **为什么 F 可能漏掉**：F 把实例隔离判为用户无害，但忽略了首访密度这个核心目标。
- **是否阻塞 task-06 落地**：不阻塞轻沉淀方案，阻塞新用户必见 1 小时历史的表述。

### B4 — P1：`/api/agents/history` 的 nodejs runtime 正确，但 CDN cache 要重新定

- **位置**：Task 06 Section 4。
- **是否成立**：部分成立。
- **问题**：`export const runtime = "nodejs"` 是正确选择（task-06:120），Edge isolate 不适合进程内 buffer。问题在 `s-maxage=30` 会缓存空历史或旧历史（task-06:137-140）。对于每实例 mutable state，过强 CDN cache 会让用户看不到刚生成的 batch。
- **建议**：保持 nodejs。空历史 `no-store`，非空历史短缓存 5-10 秒即可。不要把 ISR 当成跨实例同步，它只会缓存响应，不会合并各实例内存。
- **为什么 F 可能漏掉**：F 想减少 API 压力，但 history API 本身不调 LLM，压力主要是序列化和传输，不是 provider 成本。
- **是否阻塞 task-06 落地**：不阻塞，但缓存策略需改。

### B5 — P1：IntersectionObserver 在内部滚动容器中缺 `root`

- **位置**：Task 06 Section 8；PR #11 `MessageStream.tsx`。
- **是否成立**：成立。
- **问题**：当前 MessageStream 的实际滚动区域是内部 div（MessageStream:27-35）。Task 06 的 observer 只设置 rootMargin（task-06:377-384），没有把 root 指向滚动容器。移动端 Safari 和桌面浏览器都可能按 viewport 判定，导致顶部 sentinel 行为不稳。
- **建议**：`new IntersectionObserver(callback, { root: containerRef.current, rootMargin: "160px 0px 0px 0px" })`。再加手动加载按钮和 `loadMoreInFlightRef`。
- **为什么 F 可能漏掉**：示例代码保留了 `containerRef`，但没有真正传进 observer。
- **是否阻塞 task-06 落地**：阻塞 load more 的可靠性。

### B6 — P1：新内容 banner 的可见性 race

- **位置**：Task 06 Section 5.2 / Section 7；Task 05 Section 4。
- **是否成立**：成立。
- **问题**：切回 tab 时立即拿旧 `data` 算 gap（task-06:240-252），然后才 startPolling。若 polling 之后才拿到新 batch，banner 不出现。反过来，如果 cache 响应用当前时间覆盖 `ts`，可能显示不存在的新内容。
- **建议**：切走时记录 `lastSeenGeneratedAt`。切回后执行一次 fetch，fetch resolve 后比较 response 的 `generatedAt`。若想显示数量，调用 history since API 取真实新增 count。
- **为什么 F 可能漏掉**：F 复用了 Task 05 的 visibilitychange 框架，但新增提示需要等请求完成后再判断。
- **是否阻塞 task-06 落地**：不阻塞 history，阻塞 banner 正确性。

### B7 — P2：历史 entries 的 timezone / locale 显示需要替换当前 `formatTime`

- **位置**：Task 06 Section 2 / Section 9；PR #11 `MessageBubble.tsx`。
- **是否成立**：成立。
- **问题**：当前时间显示用 `date.getHours()` 和 `getMinutes()` 拼 `HH:mm`（MessageBubble:8-13）。这对 zh_CN 可接受，但 Task 06 给其他 9 个 dict 加字段（task-06:433），未来若开放非中文，会出现 locale 不一致。
- **建议**：新增 `formatAgentMessageTime(ts, locale)`，内部用 `Intl.DateTimeFormat(locale.replace("_", "-"), { hour: "2-digit", minute: "2-digit" })`。v1 中文页也可先接入，成本低。
- **为什么 F 可能漏掉**：Task 06 只看新增 i18n 文案，没扫现有时间格式。
- **是否阻塞 task-06 落地**：不阻塞 v1 中文页，建议同批改。

### B8 — P2：buffer 序列化和 GC 风险现实可控，但边界要写清

- **位置**：Task 06 Section 3 / Section 11。
- **是否成立**：部分成立。
- **问题**：`historyBuffer.push()` 后 `slice(-200)` 每次创建新数组（task-06:71-74）。在 Task 05 后实际 refresh 频率很低，这不是现实 P0。但如果当前 PR #11 的 60 秒 cache 版本直接落地，或多个入口同时触发分析，GC 压力和序列化体积会上升。
- **建议**：如果 buffer 存消息级 200 条，slice 成本可忽略。若存 batch 级，改成 fixed-size ring 指针或至少按消息级 flatten 后存。文档要写明 Task 05 是前置条件。
- **为什么 F 可能漏掉**：F 用 5 分钟一批估算，却又没在执行 gate 里强制 Task 05 已存在。
- **是否阻塞 task-06 落地**：不阻塞，前提是改成消息级 entry。

### B9 — P0：`source: "cache"` + `ts: now` 会污染新增逻辑

- **位置**：Task 06 Section 5.2；PR #11 `llmFallbackChain.ts`。
- **问题**：当前 cache hit 返回 `{ ...liveCache.value, source: "cache", ts: now }`（llmFallbackChain:331-332）。Task 05 示例也沿用这个模式（task-05:87-101）。这会把同一份内容伪装成新 batch。
- **建议**：payload 加 `generatedAt` 和 `servedAt`。历史、去重、banner 一律用 `generatedAt`。`servedAt` 只用于调试和 cache 观察。
- **为什么 F 可能漏掉**：Task 06 用 ts 既当生成时间又当响应时间。

### B10 — P0：`useAgentHistory` 的类型来源会导致编译失败

- **位置**：Task 06 Section 5.1；PR #11 `types.ts` / `llmFallbackChain.ts`。
- **问题**：`AgentAnalysisPayload` 从 `@/lib/llmFallbackChain` import（task-06:159-160），但该文件没有 export 这个 type；它从 `@/modules/agent-watch/types` import（llmFallbackChain:5-13）。
- **建议**：所有前端 hook 从 `../types` 或 `@/modules/agent-watch/types` import。不要从 lib 反向 import 类型，避免前端 bundle 拉入服务端实现。
- **为什么 F 可能漏掉**：示例代码为了方便引用后端 payload，绕过了现有模块边界。

### B11 — P1：history API 缺 since 查询，banner 无法给真实新增数

- **位置**：Task 06 Section 4 / Section 7。
- **问题**：route 只有 `limit`（task-06:123-136），banner 却要显示过去 X 分钟新增 Y 条（task-06:341-351）。没有 `since`，只能估算。估算在 Task 05 cache 下会偏离。
- **建议**：新增 `GET /api/agents/history?since=<batchTs>`，返回 `{ count, entries, newestTs }`。banner 用 count，点击 banner 再 append entries 或 scroll。
- **为什么 F 可能漏掉**：F 先从 preload 角度设计 API，后把 banner 复用同一个 estimate。

### B12 — P1：Hero 页面也会写历史，需明确是否接受

- **位置**：Task 06 Section 3；PR #11 Hero 注入。
- **问题**：PR #11 的 Hero 中文 locale 也调用 `useAgentAnalysis`（act1.5 spec:326-355；RobotLayer 当前逻辑也使用该 hook）。如果 pushHistory 在 `getAgentAnalysis` 成功路径，用户只访问首页也会积累 `/agent` 历史。这可能是好事，也可能让旁观页历史里出现用户没进入旁观页时生成的内容。
- **建议**：明确历史是全站 Agent 分析历史，而非旁观页会话历史。如果只要旁观页历史，history push 不能放在全局 `getAgentAnalysis`，需要 route 参数或调用来源。
- **为什么 F 可能漏掉**：F 把 LLM batch 当全站公共资产，但文案写的是旁观秀页面历史。

### B13 — P2：load more 后滚动位置需要保持，否则用户会跳位

- **位置**：Task 06 Section 8；PR #11 `MessageStream.tsx`。
- **问题**：向上加载更老消息时，如果直接 `setMessages([...older, ...current])`，滚动高度增加，浏览器会把用户视口推离原位置。Task 06 只写触发加载，没写 scrollTop 补偿。
- **建议**：加载前记录 `prevScrollHeight` 和 `prevScrollTop`，渲染后设置 `scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop`。否则用户每次加载都会被拉到更老位置或弹回。
- **为什么 F 可能漏掉**：F 关注触发方式，没覆盖 prepend 列表的 scroll anchoring。

---

## Part C — 最终建议（Codex 给 Dan）

### Go / No-go 判断

**结论：微调后落地。**

不建议按当前 Task 06 原文直接开工。方向是对的：轻沉淀、in-memory、单时间线、banner 都符合 Act 1.5 的轻量目标。但当前 spec 有 3 个会直接打断实现的 P0：数据单位错、`keepFivePerAgent` 截断历史、`ts` 语义污染新增判断。修完这 3 个，再让 Airy 或 Codex 实现。

### 最高优先级修订

1. **先改数据模型**：把历史从 `AgentAnalysisPayload[]` 改成消息级 `HistoryMessageEntry[]`。对应 Part A Section 1 / 3 / 6，Part B1。
2. **处理 `keepFivePerAgent` 冲突**：历史流和 live typing queue 分层，或取消历史路径上的 5 条上限。对应 Part A Section 6，Part B1。
3. **拆分 `generatedAt` 和 `servedAt`**：history 去重、merge、banner 都用 `generatedAt`。对应 Part A Section 5，Part B6 / B9。
4. **修正 history API**：支持 `limit` + `since`，返回 `hasMore`、`newestTs`、`oldestTs`，空历史 no-store。对应 Part A Section 4，Part B4 / B11。
5. **重写 load more 交互细节**：IntersectionObserver 设置 root，初始滚到底后再观察，加手动 fallback 和 scrollTop 补偿。对应 Part A Section 8，Part B5 / B13。

### Task 05 和 Task 06 的顺序

建议 **Task 05 先于 Task 06**。原因很简单：Task 06 的历史累积频率、banner 数量、pushHistory 时机都依赖 Task 05 的 fresh/stale 语义。若先做 Task 06，会按当前 60 秒 cache 版本写出一套逻辑；Task 05 合并后又要重调。

执行顺序建议：

1. Task 05 合并，确认 `FRESH_TTL_MS`、`STALE_TTL_MS`、`backgroundRefreshInFlight`、`visibilitychange` 存在。
2. 修改 Task 06 spec，解决上面 5 条最高优先级修订。
3. 再实现 Task 06。实现 PR 描述里要写清 v1 是 per-instance light history，不承诺跨实例 1 小时完整历史。

### 最小可落地版本

如果要快速推进，建议砍掉两项复杂度：

- v1 先不做自动 banner 数量估算，只做切回后若 `newestTs > lastSeenGeneratedAt` 显示有新内容，点击回到最新。
- v1 的 history API 只返回最多 60 条消息，不做 200 条 load more。等真实流量确认用户会回看，再加 load more。

这样可以把第一版从 8 个改动点压到 4 个：消息级 buffer、history API、预灌 history、live/history merge。风险低很多。
