# B.13 hotfix Task B 双脑诊断报告

Codex time: 2026-05-16 10:55 CST
Base: `origin/main` = `884f9f30bb3e005d60c3cda3875aded73ed46adc`
Scope: diagnosis only; no scripted-output fix implemented in this PR.

## 0. 结论先行

我判断当前 Dan 看到的“脚本化”首要根因不是 Stage 1/2 把真 LLM 替换成 hardcoded 输出，而是：

1. 当前 main preview 的公开 timeline 在 720 分钟窗口内 `events.length=0`。
2. `MarketAnalysisPanel` 在真实 `topics` 为空时直接回落到 `dispatchV10DemoTopics`，所以页面显示的是静态 demo 决策流。
3. Stage 3 的 visible-session refresh 触发又依赖 `topics[0]?.symbol`；当真实 timeline 为空时 `latestRefreshSymbol=null`，前端直接 `return`，因此用户访问不会启动后台 PM run。
4. 我手动 POST `/api/watch/refresh?symbol=BTC&locale=zh_CN` 得到 `status=no_signal`、`refreshStarted=false`，不是 170min lock 抑制。

因果链：`f7119b7` 新增访问触发，但 `AgentWatchBoard.tsx:419-422` 只在已有真实 topic 时触发；真实 timeline 空时，`MarketAnalysisPanel.tsx:336-340` 回落到静态 demo，`demoTopics.ts:110-116` 里的 `BTC 决策流 / 19:06` 就被当成“当前分析”展示。

## 1. Task B.1 hardcoded fallback 判断

First-hand code:

- `src/lib/team/pmDecisionPipeline.ts:228-273` 仍先调用 `generateText(...)`，解析 JSON 后才返回 analyst output。
- `src/lib/team/pmDecisionPipeline.ts:289-335` 的 fallback 只在 LLM 失败、超时或解析失败后使用。
- `de47ba8` Stage 1 把旧 fallback 文案从“暂时不可用，使用中性占位”改成“基于当前已确认信号保持观望...”，并把 `dataStatus` 从 `missing` 改成 `partial`。
- `src/lib/llm/generateText.ts:22-64` 仍走 provider chain，没有 hardcoded analyst output。
- `src/lib/team/evidenceDispatcher.ts:393-400` 只是把公开输出纪律改成“不提 backend connectors / data ingestion / fallback execution”。

判断：Stage 1 没有引入“hardcoded 替代真 LLM”的主路径。它确实隐藏了“数据不可用”的公开表达，会让缺数据时文本更像“强行有话说”，但这不是当前页面脚本化的第一根因。

## 2. Task B.2 recent PM record / telemetry 判断

First-hand KV / API:

- `npx vercel curl /api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720&limit=20` on main preview: `events.length=0`。
- GET `/api/watch/refresh?symbol=BTC&locale=zh_CN`: `status=stale`, `lastDecisionAt=null`, `refreshSource=none`。
- POST `/api/watch/refresh?symbol=BTC&locale=zh_CN`: `status=no_signal`, `refreshStarted=false`。
- Preview KV `readAllDecisionRecords(30, "zh_CN")`: 9 records.
- Latest 3 real PM records:
  - `pm:HYPE:1778850341962`, created `2026-05-15T13:05:41.962Z`, 14 contributors, 14 analystInputs, 6 stageTrace, `modelProvider=deepseek-chat`.
  - `pm:IRYS:1778849597126`, created `2026-05-15T12:53:17.126Z`, same shape.
  - `pm:BILL:1778837879780`, created `2026-05-15T09:37:59.780Z`, same shape.
- Provider telemetry KV: 68 `watch:pm-decision:*` calls in the recent sample, provider split `deepseek-chat=52`, `minimax=16`.
- Newest provider telemetry sample is `2026-05-15T13:07:59.532Z`, before Stage 1 merge time `de47ba8` = `2026-05-15T15:30:10Z`.

判断：

- 这些 older PM records 是真 LLM chain 跑出来的，不是纯 fixture。
- 但 Dan 当前看到的页面不是这些 records，因为 watch history retention 是 12h，而最新 HYPE record 到当前检查时已经超过 12h，公开 timeline 为空。
- 我没有看到 Stage 1 / Stage 2 / Stage 3 merge 之后的新 PM LLM 调用证据。当前现象不能归因于“Stage 2 personality 注入后 LLM 仍脚本”，因为没有 post-Stage2 record 在当前公开 timeline 中展示。
- Latest HYPE raw record 里仍有 “fundamental_analyst 暂时不可用...” 这类旧占位文案，但该 record 生成时间早于 Stage 1 fallback 文案修正，所以它不是 Stage 1 当前代码导致的新输出。

## 3. Task B.3 persistentPersonality 注入判断

First-hand code:

- `809116c` Stage 2 在 14 个 `docs/agent-ip/team/*.md` 顶部都加入了 `## Persistent Personality`。
- 当前 `pmDecisionPipeline.ts:398-404` 的 `buildMemberPrompt()` 会读取 `TEAM_MEMBER_REGISTRY[memberId].promptDocPath` 对应整份 md，并拼到 LLM prompt 最前面。
- `TEAM_MEMBER_REGISTRY` 也有 `persistentPersonality` 字段。

判断：

- 结构上，persistentPersonality 注入是生效的。
- 但 14 份 md 多数仍紧跟着 `prompt placeholder`，实际角色“魂”的强度很弱。即使有 post-Stage2 真 record，也可能只能轻微改变口吻，不能单靠三行 metadata 让 14 个角色显著分化。
- 目前没有 post-Stage2 PM record 可做肉眼样本判断，这是诊断限制。

## 4. Task B.4 refresh + waitUntil / lock 判断

First-hand code:

- `/api/watch/refresh/route.ts:151-258` 实现 POST。
- `route.ts:159-218` 顺序为 rate limit → in-flight lock → freshness → cooldown → pm-decision lock → trigger context。
- `route.ts:238-256` 使用 `waitUntil(triggerPmDecisionPipelineOnce(...))`，不是 plain `void trigger()`。
- `pmDecisionTrigger.ts:19` 的 per-symbol PM lock 是 170min；`pmDecisionTrigger.ts:235-252` 只有进入真实 candidate 后才 acquire。
- `AgentWatchBoard.tsx:419-422` 只有 `topics[0]?.symbol` 存在才执行 refresh。

判断：

- waitUntil 链路代码上是正确的。
- 本次不是 95% user-trigger 被 170min lock 抑制；我手动 POST BTC 返回 `no_signal`，没有进入 lock。
- 更大的 bug 是空 timeline 时根本没有 `latestRefreshSymbol`，所以真实用户访问 `/agent` 不会触发 refresh。与此同时 v10 market panel 自己用 demo topics 补画面，造成“页面看起来有当前分析，但后台其实没有触发”的错觉。

## 5. 根因因果链

Primary causal chain:

1. `884f9f3` 当前 main 的 12h watch history 无公开 pm_decision：timeline API `events.length=0`。
2. `src/modules/agent-watch/AgentWatchBoard.tsx:419-422` 以 `topics[0]?.symbol` 作为 refresh source；topics 为空时直接返回。
3. `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:336-340` 对空 topics 使用 `dispatchV10DemoTopics`。
4. `src/modules/agent-watch/v10/demoTopics.ts:110-116` 静态写死 `BTC 决策流`、`19:06` 等信息。
5. 用户看到的是 demo，而不是近期 LLM PM record，于是感知为“又回到脚本”。

Secondary contributing chain:

1. `de47ba8` Stage 1 让 prompt 不许公开提 backend / data ingestion / fallback，产品上是对的，但会降低“诚实暴露缺数据”的可见度。
2. `809116c` Stage 2 personality 只是 metadata + placeholder prompt，角色分化强度不足。
3. B.12/B.13 真实 PM records 仍多为 wait，且有旧 fallback 占位残留；即使修了触发，若 evidence 不足和 role prompt 仍弱，输出仍可能偏机械。

## 6. Fix 方向建议

保守方案，0.5-1 AI 天：

- 禁止 market panel 在 production-like preview 下显示 `dispatchV10DemoTopics` 作为“当前分析”。空 timeline 应显示“暂无决策更新 / 新分析进行中 / 刷新触发中”。
- refresh source 不依赖 `topics[0]`，改从 candidate pool / last selected symbol / URL param 派生一个 symbol。
- 保留 existing layout，不加新 panel。

中等方案，1-2 AI 天：

- `/api/watch/refresh` 增加 status body，返回 `no_signal` 的具体原因摘要（不展示 backend 错误，只供 UI 决定“正在等待信号”）。
- AgentWatchBoard 空 timeline 时仍触发一次 candidate refresh；UI 显示“正在检查新机会”，完成后 SSE/timeline 自动刷新。
- Demo topics 只用于 local dev / story fixture，不进入对外 preview。

激进方案，3-5 AI 天：

- 建立明确的 “empty state → candidate selection → background PM run → partial stages → final record” 状态机。
- cron + user visit 共用 candidate audit，UI 能显示“本次为什么没有新分析”。
- 把 14 角色 prompt placeholder 全部替换为有示例、有禁止句式、有角色记忆边界的强 prompt。

不确定项：

- 是否允许 user visit 在空 timeline 时触发真实 PM run，需要 Dan/F 判断成本上限和防刷策略。
- 如果要让每次外部预览都有内容，可能需要“staging seed record”而不是 demo topics；这涉及数据策略，不建议 Codex 自行决定。

## 7. F 没问到的 angle

1. **Demo fallback 混入真实工作台是产品级风险**：它让内部评审误以为“当前分析正在跑”，但实际是静态样例。建议所有 demo topics 在对外 preview 环境加硬 gate。
2. **12h watch history retention 与 170min PM lock / cron 频率不匹配**：真实 record 超过 12h 后 UI 立刻空窗，但 PM lock/candidate 逻辑并不保证马上补新 record。
3. **team-track backend 用旧 records 算出“7 决策 / 0%”会放大误解**：即使本 PR 撤 panel，backend 仍保留；未来若再展示必须区分“样本来自 5 天前旧记录”。
4. **provider telemetry 只有 cron `trigger=now` response 暴露 summary，普通 UI path 不容易诊断**：后续可考虑只读 admin diagnostics endpoint，但需要权限保护。

## 8. Task A note

本 PR 同时按 spec 撤回 TeamTrackRecordPanel UI：删除组件、移除 v10 market mount、移除前端 fetch 和 props、删除 panel-only i18n keys。`/api/watch/team-track-record`、`memoryLoopEvidence.ts`、`computeTeamWinrates.ts` 保留。

[DOC-HINT: B.13 follow-up fix spec should target empty-timeline refresh source and demo-topic gating before changing prompts.]
