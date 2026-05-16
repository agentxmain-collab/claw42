# B.13 hotfix-2 Task B 双脑调研报告

Codex time: 2026-05-16 12:05 CST  
Base: `origin/main` = `2bcdc3923ce199d51d7cff10fddf46ae5d472cac`  
Branch: `feature/b13-hotfix2-kill-demo-fallback-diagnose`  
Scope: Task A UI hotfix implemented; Task B diagnosis only, no pipeline / refresh / cron fix.

## 0. 结论先行

Dan 截图里的 BTC / ETH / SOL 不是当前真分析，是 V10 `MarketAnalysisPanel` 的 static demo fallback。Task A 已把这个 fallback 从 V10 挂载路径停掉：真实 `topics` 为空时只显示客观 empty state `工作台启动中，暂无最近决策`，并用灰色 no-data icon / `NO DATA` 标签明确区分“没有真数据”。

Task B 发现比原 spec 更关键的一点：当前不是“LLM 完全没跑”。Preview KV 里已经有 `2026-05-16T03:42:00.550Z` 的 `pm:BILL:1778902920550` 真 PM record，14 个角色 provider telemetry 也显示 `deepseek-chat` 成功调用。但同一个 main preview 的 `/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720` 仍返回 `events=[]`，所以公开 UI 没拿到真分析。也就是说，P0 表象是 demo fallback；下一步根因应同时看 **preview cron 不会跑 + user refresh 触发/投影链路断裂**，不能只改 prompt。

## 1. Task A 实施摘要

- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:335-337`：`resolvedTopics` 只使用传入的 `topics ?? []`，不再回落到 `dispatchV10DemoTopics`。
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:370-377`：空数据渲染 `role=status` 的 no-data empty state。
- `src/modules/agent-watch/v10/DispatchConsoleV10.module.css:1435-1472`：empty state 采用灰色、低对比边框、圆形空状态 icon、`NO DATA` 标签，视觉上区别于真分析卡片。
- 10 locale 更新 `agentWatch.dispatchV10.market.empty`，`zh_CN` 文案为 `工作台启动中，暂无最近决策`，`en_XA` 已覆盖。
- Fixture 文件 `src/modules/agent-watch/v10/demoTopics.ts` 保留；测试里如需 demo，必须显式传入。

## 2. Task B.1 PM no_signal / hardcoded fallback 判断

First-hand code:

- `src/lib/team/pmDecisionPipeline.ts:237-249` 仍先调用 `generateText(...)`，并带 `providerOverride`，不是 hardcoded output。
- `src/lib/team/pmDecisionPipeline.ts:289-335` 的 fallback 只在 LLM 失败、超时或解析失败后使用。
- 现在的 `no_signal` 主要在 PM pipeline 外层：`src/app/api/watch/refresh/route.ts:120-125` 用 candidate reason 分数判断；`src/app/api/watch/refresh/route.ts:218-220` 在 trigger context 不满足时直接返回 `status=no_signal`。
- Cron/trigger 侧另有一层：`src/lib/team/pmDecisionTrigger.ts:209-224` 只有 market alert 或 high news evidence 才继续跑 PM pipeline。

判断：

- Stage 1 没有把真 LLM 主路径替换成 hardcoded 输出。
- `no_signal` 不是 PM 决策内部“90% 观望”分支，而是 refresh / trigger 前置门槛。它会导致 PM pipeline 根本不启动。
- 我手动 GET `/api/watch/refresh?symbol=BTC&locale=zh_CN` 得到 `status=stale, lastDecisionAt=null`；之前 POST BTC 得到 `status=no_signal`，原因是 BTC 当前 24h 约 `+2.14%`，只到 `watch` 级别，不够触发。

## 3. Task B.2 Candidate pool / CoinW filter 判断

First-hand data:

- `src/lib/team/topicSelector.ts:285-292` 不会因为 `execution.watchOnly` 把 candidate 过滤掉，只会把执行能力标注在 candidate 上。
- `src/lib/team/symbolMapping.ts` 当前 `BTC / ETH / SOL / HYPE` executable；`BILL / IRYS` watch-only。
- 实测 preview env 的 market pool 抓取当前走 fallback：`source=fallback`, `isFallback=true`, `error=ticker_unavailable`。pool 里只有 majors：
  - BTC `+2.14%`，severity `watch`
  - ETH `-0.82%`，severity `info`
  - SOL `+4.53%`，severity `alert`
- 用当前 selector 本地重放：candidateCount=3，SOL `hasTrigger=true`，BTC/ETH `hasTrigger=false`，3 个都是 executable。

判断：

- “CoinW filter 过严导致找不到 candidate”不是当前主因；当前至少 SOL 可触发。
- 更真实的问题是 market fetch 链路不稳，trending/opportunity 当前被 fallback 掉，导致候选池退化为 BTC/ETH/SOL majors。
- 另一个产品风险：BILL 真 record 是 watch-only symbol，但 V10 如果未来显示 follow button 必须继续遵守 watch-only 禁止跟单。

## 4. Task B.3 Vercel cron preview 判断

First-hand data:

- `vercel.json:2-6` cron 为 `/api/cron/strategy-replay`，schedule `0 */3 * * *`。
- Vercel 官方 Cron Jobs 文档说明 Cron Jobs only run on production deployments；preview deployments 不会自动执行 cron。Source: https://vercel.com/docs/cron-jobs
- `vercel logs --environment preview --query strategy-replay --since 12h` 无 strategy-replay 输出。
- `vercel logs --environment production --query strategy-replay --since 12h` 有 production cron 请求，但当前 prod alias 已 rollback 到老 build，不能代表 main preview 的 B.13 代码会自动跑。

判断：

- 这是核心根因之一：A/B preview 版本不能依赖 Vercel cron 产生新 PM record。
- main preview 上要有真分析，只能靠手动 trigger、用户访问 refresh、或受控 preview seed/diagnostic 触发；不能等 preview cron。

## 5. 新发现：真 record 存在但公开 timeline 仍空

First-hand data:

- `readAllDecisionRecords(1000, "zh_CN")` 读到 10 条 record；Stage 1/2/3/4/hotfix1 之后各至少 1 条。
- 最新 PM record：`pm:BILL:1778902920550`，`createdAt=2026-05-16T03:42:00.550Z`，`analystCount=14`，`tradeDecision.direction=wait`，`modelProvider=deepseek-chat`。
- Provider telemetry KV：`pmCount=130`，Stage 1/2/3/4/hotfix1 后各 24 条 PM telemetry；最新 12 条均为 `watch:pm-decision:*:zh_CN:first`，`finalProvider=deepseek-chat`，`success=true`。
- Watch history KV `claw42:watch:history:v2:zh_CN` 里有 `pm-decision:pm:BILL:1778902920550`，`meta.sourceTrigger=pm_decision`，`recordId=pm:BILL:1778902920550`。
- 本地用当前代码 + preview env 对同一批 KV entries 运行 `filterPublicTimelineEvents(...)`，可以投影出 BILL `pm_decision` event。
- 但 main preview deployment `dpl_WHvLvrSEesuNz7bW2cxB1Krt5Bdo` 上调用 `/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720&limit=100` 仍返回 `events=[]`，`oldestTs=1778898143494`。

判断：

- Dan 当前看不到真分析的原因不止是 demo fallback；公开 timeline route / runtime 侧也存在“有 KV record + 有 watch history entry，但 API 返回空 events”的断裂。
- 这不在 hotfix-2 Task A 允许修复范围内，我没有改 backend / timeline / pipeline。
- 下一张 fix spec 应把这个列为 P0：以同一条 `pm:BILL:1778902920550` 为 fixture，写 route-level regression，证明 timeline API 必须返回 1 个 `pm_decision` event。

## 6. 根因因果链

最可能链路：

1. Preview cron 不会自动运行；production cron 现在又在 rollback 老 build 上，不能给 main preview 补新 B.13 PM record。
2. 用户访问 refresh 在空 timeline 场景依赖 symbol / trigger threshold；BTC 这类非 alert 标的会 `no_signal`，而 preview 不会靠 cron 补偿。
3. 手动触发后确实生成了 `pm:BILL:1778902920550`，14 角色 LLM 成功，但公开 timeline API 仍返回 `events=[]`，说明投影/route/runtime 还有断裂。
4. V10 旧代码在 `topics=[]` 时回落到 `dispatchV10DemoTopics`，把数据断裂伪装成 BTC/ETH/SOL 当前决策，造成 Dan 截图里的假分析。

## 7. Fix 方向建议

保守，0.5-1 AI 天：

- 保持本 PR 的 demo fallback kill。
- 追加 route-level test：给 watch history + decision record 写入同一 `recordId`，`/api/watch/timeline` 必须返回 `pm_decision`。
- 修 timeline route / payload 的 runtime 断裂，直到 preview API 能返回 BILL event。

中等，1-2 AI 天：

- 空 timeline 时，AgentWatchBoard 不再依赖 `topics[0]`，改从 candidate pool 或 server-side `/api/watch/refresh` 自选 candidate。
- `/api/watch/refresh` 返回 `candidate`, `hasTriggerReason`, `cooldown/lock` 的 public-safe 状态，UI 显示“正在检查新机会 / 暂无触发信号”。
- 手动 preview trigger 工具化，不走 prod cron。

激进，3-5 AI 天：

- 建立 preview-safe orchestrator：进入 `/agent` 后 server-side refresh audit、candidate selection、waitUntil PM run、timeline SSE、empty-state status 全链路可观测。
- 将 market fetch fallback、news fetch fallback、provider telemetry、timeline projection 做一个 admin-only diagnostics endpoint，避免每次靠临时脚本查 KV。

## 8. F 没问到的 angle

1. **Task B 原 spec 只问“为什么没有 PM record”，但实测已经有 PM record；真正 P0 是“record 没进 public timeline / UI”。**
2. **Preview cron 是设计上不会跑**，所以所有“对外预发”如果要真数据，必须定义 preview trigger 机制，不能沿用 production cron 假设。
3. **Market pool 现在退化到 fallback majors**，即使修了 timeline，也可能长期只出现 BTC/ETH/SOL，和 Dan 要的真实 topic 丰富度不一致。
4. **BILL 这条真记录仍大量暴露 missing/onchain/fundamental 文案**，Stage 1 的“后台状态不展示”没有在所有角色 public rounds 中完全达成；这应另列内容质量修复，不要混进 hotfix-2。
5. **执行中发现一次 Vercel CLI 在无 `.vercel/project.json` 的 temp worktree 里自动创建了错误项目**，我已删除该临时项目并恢复正确 `.vercel/project.json`。后续所有 Vercel 命令必须先校验 project binding。

[DOC-HINT: next B.13 fix spec should target public timeline projection/runtime mismatch and preview-safe refresh trigger before prompt/personality changes.]

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

# B.13 hotfix-3 调研 + 实测报告

时间：2026-05-16
分支：`feature/b13-hotfix3-timeline-projection-watch-only`
base：`69554abad83f148f864e48dea5598f2e498c1622`（hotfix-2 merged main）

## 1. Task A first-hand 调研结论

代码路径：

- `/api/watch/timeline` 入口：`src/app/api/watch/timeline/route.ts:52` 调 `buildWatchTimelinePayload()`
- payload builder：`src/lib/watch/publicTimelinePayload.ts:58-91` 读 `getWatchHistory()`，再用 `filterPublicTimelineEvents()` 投影；同时把 `readAllDecisionRecords()` 建成 `decisionRecordsById`
- projection：`src/lib/watch/publicTimelineProjection.ts:165-193` 的 `pmDecisionPayload()` 只要求 entry 是 `chat_thread`、meta 有 `recordId`，没有 watch-only / executable filter

KV 实测（preview env，未输出 secret value）：

- `USE_PERSISTENT_KV=true`，`STAGING_USE_FIXTURE=<unset>`，`VERCEL_ENV=preview`
- `readAllDecisionRecords(1000, "zh_CN")` 返回 10 条旧记录；BILL 有 2 条
- 最新 BILL：`pm:BILL:1778902920550`
  - `createdAt=2026-05-16T03:42:00.550Z`
  - `schemaVersion=2`
  - `recordSource=live`
  - `tradeDecision.direction=wait`
  - `analystInputs=14`
  - round count = 25
  - `stageTrace` 六段全 `done`
  - record 自身没有 `executable` / `execution` 字段
  - `resolveSymbolMapping("BILL").execution.executable=false`
- `claw42:watch:history:v2:zh_CN` 有 4 条 entry，其中 1 条 public/high pm entry：
  - `pm-decision:pm:BILL:1778902920550`
  - `meta.sourceTrigger=pm_decision`
  - `meta.recordId=pm:BILL:1778902920550`
  - `meta.visibility=public`
  - `meta.importance=high`

判断：

- F 的推测「candidate selector 允许 watch-only，但 timeline projection 过滤 watch-only」没有被实测支持。当前 projection 没有 executable/watch-only filter，本地用同一份 preview KV 跑 `buildWatchTimelinePayload()` 能投出 BILL event。
- 真缺口是 public payload 没带 `executable`，UI 只能靠 `symbolMapping` 兜底识别 watch-only；这不满足 Dan 对「watch-only / 不可跟单」的显式展示和 strict safety gate 要求。
- 远端 hotfix-2 preview 用 `vercel curl` 实测也已返回 event，不再是 `events=[]`：
  - before Task A fix: events=1，`BILL` event 存在，但 `payload.executable=<missing>`
  - HYPE 触发后：events=2，`HYPE` + `BILL` 都存在，但旧部署仍 `payload.executable=<missing>`

## 2. Task A fix 实施方向

已实施：

- `src/lib/watch/publicTimelineEvent.ts`：给 `pm_decision` public payload 增加 legacy-safe `executable?: boolean`
- `src/lib/watch/publicTimelineProjection.ts`：projection 输出 `executable`，优先读未来 record explicit field，否则 fallback 到 `symbolMapping.ts`
- `src/lib/watch/v9TopicAdapter.ts`：topic execution 优先消费 `payload.executable`，旧 payload 再 fallback 到 `symbolMapping`
- `src/lib/watch/v9TopicAdapter.ts`：watch-only topic 的 `strategy.follow.primaryDisabled=true`
- `src/modules/agent-watch/AgentWatchBoard.tsx`：primary follow action 再加一道 `topic.execution?.executable === true` gate
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx` 既有 badge mount 保留；badge 文案改为明确 `watch-only / 不可跟单`
- `src/modules/agent-watch/v9/dispatchConsoleV9.module.css`：badge 从 lime 改成灰色 + `!` icon，和可跟单 CTA 视觉区分
- 10 locale 更新 `watchOnlyLabel`，含 `en_XA`

本地复测（同 preview KV）：

- `buildWatchTimelinePayload()` events=2
- `pm:HYPE:1778908242659` → `executable=true`
- `pm:BILL:1778902920550` → `executable=false`

工作量判断：

- 保守 fix 已完成，约 0.5 AI 天范围。
- 不需要改 candidate ranking，不需要改 PM pipeline，不需要改 evidence/memory backend。

## 3. Task B preview-trigger 链路实测

代码链路：

- visible-session trigger：`src/modules/agent-watch/AgentWatchBoard.tsx:419-453`
  - `topics[0]?.symbol` 存在才触发
  - session key：`freshness-trigger-${locale}-${symbol}`
  - POST `/api/watch/refresh?symbol=...&locale=...`
- refresh route：`src/app/api/watch/refresh/route.ts:151-258`
  - rate limit → in-flight → freshness → cooldown → per-symbol PM lock → `loadTriggerContext()`
  - `route.ts:238-256` 使用 `waitUntil(triggerPmDecisionPipelineOnce(...))`，不是 plain `void`

远端 preview 实测：

- `GET /api/watch/refresh?symbol=BILL&locale=zh_CN`
  - `status=stale`
  - `lastDecisionAt=2026-05-16T03:42:00.550Z`
  - `refreshSource=records`
- `POST /api/watch/refresh?symbol=BILL&locale=zh_CN`
  - `status=locked`
  - 原因：KV 里 `watch:pm-decision:zh_CN:BILL` locked=true
  - 没进入 waitUntil
- `POST /api/watch/refresh?symbol=HYPE&locale=zh_CN`
  - 返回 `refreshStarted=true`
  - 75 秒后 KV 新增 `pm:HYPE:1778908242659`
  - watch history 新增对应 public/high pm entry
  - timeline projection events 从 1 变 2

判断：

- preview env 的 `/api/watch/refresh` + `waitUntil(triggerPmDecisionPipelineOnce(...))` 实际能跑完并写 KV。
- 当前可见问题不是 waitUntil 不工作，而是锁/冷却语义会让用户看到 `locked`，以及空 timeline 时 `topics[0]` 不存在会导致 visible-session trigger 根本不触发。这一点属于后续 spec，应另起，不在 hotfix-3 修。
- Vercel preview cron 不跑仍成立，所以 preview 只有 user-trigger 或手动 trigger 能产生新 record。

## 4. F 没问到的 angle

1. `/api/watch/refresh` 的 freshness 读 timeline 时没有传 `decisionRecordsById`，因此 timeline fallback 会把 pm event symbol 投成 `UNKNOWN`；当前 freshness 还能靠 records path 正确识别 BILL/HYPE，但 timeline-only 场景有隐患。
2. `checkLock()` 对 KV lock 不返回 expiresAt，UI 拿到 `locked` 时 `nextAllowedAt=null`，用户无法知道多久后能刷新。
3. `AgentWatchBoard` 只从已有 topic 派生 refresh symbol；如果真的零 record，hotfix-2 empty state 下不会触发新分析。这个是比 watch-only projection 更大的下一步入口问题。
4. `sourceChain.ts` 本地 tsx import 会触发 RSS adapter `source.id` undefined 报错，但远端 route 能跑。需要后续单独查本地脚本/runtime import 差异，不应混入本 hotfix。

## 5. 验证

已跑并通过：

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npx vitest run src/lib/watch/__tests__/publicTimelineProjection.test.ts src/lib/watch/__tests__/v9TopicAdapter.test.ts src/modules/agent-watch/__tests__/followTradeDisabled.test.tsx src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx`
  - 4 files passed
  - 51 tests passed
- `npm run test:watch-pipeline`
  - 46 files passed
  - 243 tests passed
- `npm run test:news`
  - 6 files passed
  - 25 tests passed
- `npm run test:kv-lock`
  - 13 tests passed
- `npm run test:kv-rate-limiter`
  - 7 tests passed
- `npm run test:kv-quota`
  - 8 tests passed
- `npm run verify:agent-ip`
- `npm run verify:news`
- `npm run verify:chat-v3-final`
  - 50/50 synthetic threads PASS
- `npm run verify:metrics`
  - 2 files / 5 tests passed
- `npm run verify:llm-providers`
- `npm run verify:llm-generate-text`
- `npm run build`
- `npm run verify:a11y`
  - checked routes 0 axe violations

[DOC-HINT: B.13 follow-up should fix empty-timeline refresh symbol derivation and lock nextAllowedAt before changing candidate ranking.]

---

# B.13 hotfix-3 post-merge projection fallback 修正

时间：2026-05-16

PR #102 squash merge 后，我在 main preview `dpl_HFvR9yHYV7ReHdgHb9htrKha9exL` 上补跑 `vercel curl`，发现一个原报告没有覆盖到的真实远端断裂：

- `/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720&limit=100`
  - returned events=1
  - event id = `pm-decision:pm:BILL:1778902920550`
  - `payload.executable=false` 已生效
  - 但 `payload.symbol=UNKNOWN`
  - `payload.rounds` 缺失

本地同一份 preview KV + 当前代码能投出：

- `pm:HYPE:1778908242659` → `symbol=HYPE` / `executable=true` / `rounds=25`
- `pm:BILL:1778902920550` → `symbol=BILL` / `executable=false` / `rounds=25`

判断：

- Task A 第一轮 fix 只解决了 `executable` 字段和 follow gate，但没有完全兜住远端 history event 缺 record hydration 的情况。
- 这仍是 timeline projection 断裂，不是 PM pipeline 问题。
- 保守修法是让 public timeline 变成 `history + StrategyDecisionRecord` 双源：history event 正常走原路径；如果 history event 缺 record hydration，或 history 缺漏最新 record，则用真实 strategy record backfill public pm event。

本 follow-up 修正：

- `src/lib/watch/publicTimelineProjection.ts`
  - 增加 `symbolFromRecordId()`，支持 `pm:BILL:...` 这类 record id fallback，避免投成 `UNKNOWN`
  - 增加 `projectDecisionRecordToPublicEvent(record)`，可直接从真实 `StrategyDecisionRecord` 生成 public `pm_decision` event
- `src/lib/watch/publicTimelinePayload.ts`
  - 读取 `readAllDecisionRecords()` 后生成 record backfill events
  - 与 history projection merge
  - history event 缺 symbol / rounds / tradeDecision 时，用 record event 替换
  - 按窗口、locale、before/since、limit 过滤，不引入 mock / fixture
- `src/lib/watch/__tests__/publicTimelineProjection.test.ts`
  - 增加 recordId symbol fallback 测试
  - 增加 direct strategy record projection 测试

本地复测（preview KV）：

- `buildWatchTimelinePayload()` events=2
- HYPE = executable true / rounds 25
- BILL = executable false / rounds 25

已补跑并通过：

- `npm run typecheck`
- `npm run lint`
- targeted vitest：4 files / 53 tests passed

[DOC-HINT: if future preview still shows no topics, next fix should target empty-state refresh trigger symbol sourcing, not re-enable demo fallback.]

---

# B.13 hotfix-3 targeted hydration 补丁

时间：2026-05-16

PR #103 merge 后再测 main preview，发现 `symbolFromRecordId()` 已把 BILL 从 `UNKNOWN` 修回 `BILL`，但 `rounds=0`，说明 timeline 函数里 history event 已恢复 symbol，但仍没有拿到完整 record hydration。

同一个 deployment 上：

- `GET /api/watch/refresh?symbol=HYPE&locale=zh_CN`
  - `refreshSource=records`
  - `lastDecisionAt=2026-05-16T05:10:42.659Z`
- `GET /api/watch/timeline?...`
  - 返回 BILL event
  - `symbol=BILL`
  - `executable=false`
  - `rounds=0`

判断：

- refresh route 的按 symbol record 读取是可用的。
- timeline route 只靠 `readAllDecisionRecords()` 做全量索引，在远端函数里仍可能拿不到完整 hydration。
- 最小修法是在 timeline projection 发现 PM event 缺 rounds / tradeDecision 时，按 event symbol 做 targeted `readDecisionRecords(symbol, 20, locale)`，再 backfill。

已实施：

- `src/lib/watch/publicTimelinePayload.ts`
  - 增加 `symbolsNeedingRecordHydration()`
  - 增加 targeted `readDecisionRecords(symbol, 20, locale)` fallback
  - targeted records 与全量 index merge 后再生成 record backfill events
  - 不改 pipeline / refresh / evidence / candidate ranking

本地 preview KV 复测：

- `buildWatchTimelinePayload()` events=2
- HYPE = `symbol=HYPE` / `executable=true` / `rounds=25`
- BILL = `symbol=BILL` / `executable=false` / `rounds=25`

已补跑并通过：

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- targeted vitest：4 files / 53 tests passed
- `npm run build`

[DOC-HINT: if remote timeline still fails hydration after targeted read, next diagnostic should compare Vercel function env for timeline vs refresh routes.]

---

# B.13 hotfix-3 known-symbol hydration 补丁

时间：2026-05-16

PR #104 merge 后继续测 PR preview：

- BILL 已恢复为 `symbol=BILL` / `executable=false` / `rounds=25`
- HYPE 仍未进入 timeline
- `GET /api/watch/refresh?symbol=HYPE&locale=zh_CN` 仍能看到 `refreshSource=records` 和 `lastDecisionAt=2026-05-16T05:10:42.659Z`

判断：

- targeted hydration 只补了 history 已出现的 symbol；如果某个真实 record 已写入 KV records 但 history entry 缺失，timeline 仍然看不到。
- 当前 watch universe 已在 `symbolMapping.ts` 中维护，包含 HYPE / BILL / IRYS / BTC / ETH / SOL / USDT。
- 在不改 candidate ranking、不动 pipeline、不加 mock 的前提下，timeline 可以按 known symbol universe 做 targeted `readDecisionRecords()`，把真实 records 补进 public timeline。

已实施：

- `src/lib/watch/publicTimelinePayload.ts`
  - 引入 `knownSymbolMappings()`
  - targeted hydration symbols = history 缺 hydration 的 symbols + known symbol universe
  - 仍然只从真实 decision record store 读取，不引 fixture / demo fallback

本地 preview KV 复测：

- `buildWatchTimelinePayload()` events=2
- HYPE = `symbol=HYPE` / `executable=true` / `rounds=25`
- BILL = `symbol=BILL` / `executable=false` / `rounds=25`

[DOC-HINT: once a proper decision-record index scan is reliable in Vercel timeline functions, known-symbol targeted hydration can be narrowed back down.]

---

# B.13 hotfix-4 调研 + 实测报告

时间：2026-05-16

## Task A / B first-hand 根因

Dan 看到的“两条 BILL”不是同一个 `recordId` 重复，也不是 React `key=index`。我在 hotfix-3 preview `https://claw42-site-6d5dnjv1v-agentxmain-collabs-projects.vercel.app` 连续拉 `/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720&limit=100`，API 本身返回 3 条：

1. `BILL:pm:BILL:1778923198583:1778923198583`
2. `HYPE:pm:HYPE:1778908242659:1778908242659`
3. `BILL:pm:BILL:1778902920550:1778902920550`

5 次结果完全一致，说明“顺序跳动”不是这条 API 的直接表现；真实重复层在 public workbench timeline / topic projection：720min 窗口把同一 symbol 的多次历史 PM record 都带给工作台，而工作台应该每个 symbol 只显示最新一条，历史记录应该走 decision-history。

代码实测：

- `src/lib/watch/publicTimelinePayload.ts:80-107` 原本只按 `recordId` 合并 backfill，无法去掉同 symbol 多轮历史 record。
- `src/lib/watch/topicAggregator.ts:81-124` 原本同 symbol 超过 30min 会拆成多个 topic card。
- `src/modules/agent-watch/AgentWatchBoard.tsx:100-105` primary 60min + fallback 720min append 后也可能把同 symbol 旧 record 带回 state。
- 排序层多处只有 `b.ts - a.ts`，缺 record/event id tie-breaker。

## Fix 实施位置

- 新增 `src/lib/watch/publicTimelineOrdering.ts:3-45`
  - `comparePublicTimelineEvents()` = `ts desc` + `recordId/event id` 字典序 tie-breaker。
  - `mergePublicTimelineEvents()` = PM decision 按 `locale+symbol` 只保留排序后的第一条；非 PM event 按 `event.id` 去重。
- `src/lib/watch/publicTimelinePayload.ts:103-106,196-200`
  - timeline payload backfill 统一走 `mergePublicTimelineEvents()`，API 层先稳定去重。
- `src/lib/watch/topicAggregator.ts:81-124`
  - topic 聚合层防御性保证同 locale+symbol 只产出一个 public card；30min 内仍保留 `decisionsInWindow`。
- `src/modules/agent-watch/AgentWatchBoard.tsx:65-66,100-105`
  - client replace/append 也用同一 stable merge，避免 primary+fallback/SSE 合并后复现旧 symbol。
- `src/lib/watch/v9TopicAdapter.ts:753-764`
  - ranking 分数和时间完全相同才用 stable event id tie-breaker，避免 topic order 依赖 Array/Map 迭代。

没有改 PM pipeline / evidenceDispatcher / memoryLoopEvidence / candidate ranking；watch-only follow gate 没动。

## Task C 多次实测

### 修复前 API（hotfix-3 preview，全 KV 状态）

`zh_CN` 5 次均为：

```json
{
  "count": 3,
  "seq": [
    "BILL:pm:BILL:1778923198583:1778923198583",
    "HYPE:pm:HYPE:1778908242659:1778908242659",
    "BILL:pm:BILL:1778902920550:1778902920550"
  ],
  "hash": "QklMTDpwbTpCSUxMOjE3Nzg5MjMxOTg1ODM6MTc3ODkyMzE5ODU4M3xIWVBFOnBtOkhZUEU6MTc3ODkwODI0MjY1OToxNzc4OTA4MjQyNjU5fEJJTEw6cG06QklMTDoxNzc4OTAyOTIwNTUwOjE3Nzg5MDI5MjA1NTA="
}
```

`en_US` 5 次均为 `count=0 / seq=[] / hash=""`。

### 修复后 API（prebuilt preview）

Preview URL: `https://claw42-site-9nmo848gu-agentxmain-collabs-projects.vercel.app`

`zh_CN` 5 次均为：

```json
{
  "count": 2,
  "seq": ["HYPE:pm:HYPE:1778908242659:1778908242659", "BILL:pm:BILL:1778902920550:1778902920550"],
  "hash": "SFlQRTpwbTpIWVBFOjE3Nzg5MDgyNDI2NTk6MTc3ODkwODI0MjY1OXxCSUxMOnBtOkJJTEw6MTc3ODkwMjkyMDU1MDoxNzc4OTAyOTIwNTUw"
}
```

`en_US` 5 次均为 `count=0 / seq=[] / hash=""`。

注意：prebuilt/feature preview 的 data env 与 hotfix-3 main preview 不完全一致，`decision-history?symbol=BILL` 只读到更早 record；但代码级 regression 已覆盖“两个 BILL 同时出现时保留最新 BILL”的真实 full-KV shape。合并 main 后建议再用 main preview 复测一次 full-KV 数据。

### UI 多次刷新

使用 protection-bypass share link 后 Playwright 连续刷新 5 次：

- `zh_CN/agent`: 5/5 都是 `HYPE=1, BILL=1`，页面 text hash 全一致 `5a6e5pe25YiG5p6QCueugOS9k+S4reaWhwpDTEFX`。
- `en_US/agent`: 5/5 都是 `HYPE=0, BILL=0, empty=1`，页面 text hash 全一致 `QWdlbnQgTGl2ZQpFbmdsaXNoCkNMQVcgNDIgwrcg`。
- 截图：
  - `/tmp/claw42-hotfix4-ui/zh_CN-1.png`
  - `/tmp/claw42-hotfix4-ui/zh_CN-5.png`
  - `/tmp/claw42-hotfix4-ui/en_US-1.png`
  - `/tmp/claw42-hotfix4-ui/en_US-5.png`

## 验证

已通过：

- `npx vitest run src/lib/watch/__tests__/publicTimelineOrdering.test.ts src/lib/watch/__tests__/topicAggregator.test.ts src/lib/watch/__tests__/publicTimelineProjection.test.ts src/lib/watch/__tests__/v9TopicAdapter.test.ts`
- `npm run verify`
- `npm run build`
- `npx vercel build --yes --scope agentxmain-collabs-projects`
- `npx vercel deploy --prebuilt --yes --scope agentxmain-collabs-projects`

补充：第一次普通 `npx vercel` 生成的 `https://claw42-site-ju564r5jx-agentxmain-collabs-projects.vercel.app` 卡在 `UNKNOWN / Deployment is building`，已停止本地 CLI 等待；未用于验收。

## F 没问到的 angle

Vercel preview 的数据一致性现在有一层隐患：旧 main preview 能读到 `pm:BILL:1778923198583`，feature/prebuilt preview 没读到同一条。这不是本次 duplicate/order bug 的根因，但会影响 Dan 用不同 preview URL 做肉眼验收时的观感。建议 hotfix-4 merge 后，用 main HEAD preview 再跑同一套 5 次 API + UI 刷新，确认它在 full preview KV 上保留最新 BILL 而不是旧 BILL。

[DOC-HINT: future B.13 stage gates should record the exact preview URL lineage and data env, because branch preview / prebuilt preview / main preview may not expose identical KV state.]
