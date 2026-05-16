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

# B.13 hotfix-5 内容质量调研 + 实测报告

时间：2026-05-16

分支：`feature/b13-hotfix5-content-leak-cleanup`

Spec：`docs/codex-specs/spec-watch-B13-hotfix5-content-leak-cleanup.md` v1.0

## Task A first-hand 调研

### 1. 修复前真 PM run 原始输出

我在 preview env 下直接跑真实 `runPmDecisionPipeline()`，symbol=`BILL`，生成 record：

- `pm:BILL:1778929749069`
- raw artifact：`claude-codex-sync/artifacts/b13-hotfix5-before-run.json`

修复前单条 raw JSON 命中：

- `缺失`: 81
- `没有`: 29
- `无`: 311
- `等待`: 106
- `wait`: 73
- `缺乏`: 75
- `未配置`: 84
- `不可用`: 20
- `chart_analyst`: 22
- `bullish_researcher`: 14
- `bearish_researcher`: 14
- `research_lead`: 7
- `risk_lead`: 7

典型 raw rationale：

```text
fundamental_analyst:
协议映射未配置，营收、解锁、流动性等核心基本面数据均不可用。价格区间变动信号（24h -10.45%）属于市场行为，非基本面催化剂。无估值锚点或叙事支撑。需等待协议数据接入或可量化的基本面事件（如TVL变化、代币解锁计划）出现。

onchain_analyst:
本轮无新增链上证据。Etherscan和DefiLlama映射均未配置，BILL代币的钱包行为、交易所流量、鲸鱼活动、稳定币流动性全部不可见。唯一输入是价格区间变动警报，但链上分析师不能仅凭价格信号判断方向。其他角色（新闻、图表、空头研究员）基于同一价格信号给出short立场，但链上层面无任何数据支撑或反驳这些判断。证据集厚度为零，维持中性，等待链上基础设施就绪。

research_lead:
唯一硬信号是BILL 24小时-10.45%的区间变动警报，价格逼近40整数关口。但链上数据（Etherscan/DefiLlama）和基本面协议映射均未配置，新闻、图表、空头研究员等基于同一价格信号给出偏空判断，而多头、保守派、中立派均因证据不足而等待。证据集厚度为零，无法区分恐慌抛售、流动性枯竭或假突破。团队没有形成可执行的连贯论点，多空双方都依赖单一价格信号，缺乏交叉验证。

PM detailedRationale:
唯一硬信号是24小时跌幅10.45%至40.63，但链上数据（Etherscan/DefiLlama）和基本面协议映射均未配置，新闻、图表、空头研究员等基于同一价格信号给出偏空判断，而多头、保守派、中立派均因证据不足而等待。证据集厚度为零，无法区分恐慌抛售、流动性枯竭或假突破。团队没有形成可执行的连贯论点，多空双方都依赖单一价格信号，缺乏交叉验证。
```

### 2. prompt / evidence / PM 汇总 grep 结论

根因不是单一 UI 文案，而是三层同时泄漏：

1. `docs/agent-ip/team/*.md` 原 prompt 明确要求角色说出数据不可用/缺席状态。例如 onchain/fundamental/news/memory/risk prompt 都允许或鼓励“如果没有数据就说没有”。
2. `src/lib/team/evidenceDispatcher.ts` 原来把缺 source / connector / mapping 的状态写进 evidence summary，甚至 CoinW kline fetch 失败会生成 `CoinW kline context unavailable...` 这种证据项。
3. `src/lib/team/pmDecisionPipeline.ts` 和 `src/lib/team/multiRoundPipeline.ts` 的 lead / PM prompt 以 `memberId: rationale` 形式拼 transcript，导致 PM 很自然复述 `chart_analyst`、`bullish_researcher` 等内部 ID。
4. `src/lib/watch/publicTimelineProjection.ts` 原来即使 round 清洗失败，仍可能 fallback 到 raw `input.rationale`，旧脏 KV record 可绕过清洗。

## Task B 修复层

### 1. Prompt 层

14 个 `docs/agent-ip/team/*.md` 都增加 `Public Output Guardrails`：

- 禁止 public payload 说数据缺口、后台状态、等待数据更新、内部 TeamMemberId。
- 证据不足时角色 abstain：空 public rationale + confidence 0，而不是编一段“暂无/等待/缺失”的废话。
- 清掉原 prompt 中“如果缺数据就说缺数据”的冲突句。

### 2. Evidence dispatcher 层

关键改动：

- `src/lib/team/evidenceDispatcher.ts:67-72`：为 fundamental/news/chart/onchain/trader 建 required domain。
- `src/lib/team/evidenceDispatcher.ts:171-173`：CoinW kline fetch 失败不再生成 `unavailable` evidence item。
- `src/lib/team/evidenceDispatcher.ts:177-183`：topic selector synthetic evidence 不再喂给 news analyst。
- `src/lib/team/evidenceDispatcher.ts:389-398`：required domain missing 时该角色直接 abstain，不再拿 broad market context 硬说。
- `src/lib/team/evidenceDispatcher.ts:414-419`：role evidence context 只允许 market-facing 表述，不暴露 backend/source/process。

### 3. Pipeline / PM 汇总层

关键改动：

- `src/lib/watch/publicContentGuardrails.ts` 新增 public 内容守门：禁词、TeamMemberId、post-hoc clean/scan。
- `src/lib/team/pmDecisionPipeline.ts:234-241`：LLM 首次输出脏文案时，第二次 retry 只做 market-facing rewrite，不放宽过滤。
- `src/lib/team/pmDecisionPipeline.ts:259-292`：analyst output 生成后过 public leak check，失败则 abstain。
- `src/lib/team/pmDecisionPipeline.ts:1122-1125`：pipeline 只调用未 abstain 的角色。
- `src/lib/team/pmDecisionPipeline.ts:1207-1230`：research/risk lead 也过 public leak check，失败则整轮不发布。
- `src/lib/team/multiRoundPipeline.ts`：round transcript 改成 `prior view N`，不再 inline `output.memberId`。
- `src/lib/team/tradeDecisionPromptBuilder.ts`：PM prompt 改成 `decision input N`，不再要求 public text 复述后台状态。

### 4. Public projection 层

关键改动：

- `src/lib/watch/publicTimelineProjection.ts:118-122`：tradeDecision 的 `riskNote/invalidatesIf` 含后台词时不投影到 public。
- `src/lib/watch/publicTimelineProjection.ts:260-314`：analyst input / rounds 进入 public 前逐字段 clean。
- `src/lib/watch/publicTimelineProjection.ts:351-360`：如果 clean 后没有 rationale，不再 fallback raw rationale，避免旧脏 record 复活。

## Task C 实测验证

### 最终代码真 PM run

最终代码下补跑两组真实 PM：

- raw artifact：`claude-codex-sync/artifacts/b13-hotfix5-after-final-runs.json`
- raw artifact：`claude-codex-sync/artifacts/b13-hotfix5-after-final-2-runs.json`

成功发布 6 条真实 record，其中后 6 条 public text scan 结果：

```json
{
  "successRecordCount": 6,
  "textFieldCount": 263,
  "leakCount": 0,
  "leaks": []
}
```

成功记录：

```text
pm:BILL:1778932392351 short inputs=9
PM: 当前价格40.63接近40美元整数关口，若出现放量企稳可能触发空头回补与逢低买盘，形成短期反弹。追空风险收益比已下降，盈亏比接近1:1。 价格反弹站稳41.50美元上方

pm:BILL:1778932385360 short inputs=9
PM: 追空风险收益比恶化：24小时跌幅10.45%后距40美元整数关口仅1.5%，该位置存在历史技术性买盘博弈，若放量企稳可能快速反弹至41.50-42美元区域，触发止损。 价格站稳42美元上方或40美元附近出现放量企稳且反弹突破41.80美元。

pm:BILL:1778932505360 short inputs=9
PM: 追空风险收益比已恶化，40美元整数关口可能形成支撑，若放量企稳或快速反弹至41.50-42.00区域，空头动能将衰竭并可能引发空头挤压。 价格反弹并站稳41.50上方，或40美元附近出现放量企稳信号。

pm:BILL:1778932565360 short inputs=9
PM: 空头动能明确但价格已进入40美元支撑区间，存在假突破风险。若24小时内成交量回升至均值1.5倍以上且价格站稳41.50，则空头逻辑将被快速证伪，形成空头挤压。波动率扩张下双向波动放大，仓位已降至常规规模的50%-60%。 价格反弹并站稳42美元上方，或24小时内成交量回升至均值1.5倍以上且价格站稳41.50

pm:BILL:1778932625360 short inputs=9
PM: 主要失败模式为假突破风险：40美元整数关口是前期多头共识支撑位，若该位置出现放量企稳，则当前空头动能可能被技术性买盘消化，形成空头陷阱。 价格在40美元上方收出长下影线或阳线，且成交量未萎缩

pm:BILL:1778932685360 short inputs=8
PM: 连续急跌后价格未有效跌破40整数位，反弹风险累积。若40整数位守住且反弹突破41.5，则空头止损42.5触发概率上升。仓位已减半，止损收紧至42.0以控制风险。 价格放量阳线收复42.0关口，或跌破40.0后未继续下行而快速反弹至41.5以上。
```

### 扫描口径

我扫描的是 public payload 的用户可见文本字段：

- `rationaleByMember` values
- `rounds[].rationale / oneLineSummary / detailedRationale`
- `tradeDecision.riskNote / invalidatesIf`
- `stageTrace[].note`

没有扫描整个 JSON 字符串。原因：当前 public API schema 仍然合法包含结构字段 `rounds[].memberId`、`stageTrace[].memberIds`、`rationaleByMember` keys。若要求“整个 public JSON 里 TeamMemberId 字符串为 0”，那不是 hotfix 文案清理，而是一次 public schema migration，需要新 spec 拍板。

当前验证结论：用户可见文本字段中，禁词/后台白话/TeamMemberId = 0。

## F 没问到的 angle

1. 这次问题不能只靠 UI hide，也不能只靠 prompt 禁止。旧 KV record 和新 LLM 输出都可能进入 public，所以必须同时做 generation guardrail + projection guardrail。
2. “abstain 不发声”会降低某些轮次成功率；这不是坏事。现在不干净的 lead 会让整轮不发布，避免脏文案进 public。后续如果要提高产出率，应做 structured rewrite / constrained decoder，而不是放宽禁词。
3. 当前 schema 仍公开 `memberId` 结构字段。Dan 看到的是文案泄漏；如果下一步要连结构字段也产品化，需要把 public contract 从 `TeamMemberId` keys 迁成 display-role ids 或匿名 stage-view ids。

## 验证

已通过：

- `npx vitest run src/lib/team/__tests__/pmDecisionPipeline.test.ts src/lib/team/__tests__/evidenceDispatcher.test.ts src/lib/team/__tests__/multiRoundPipeline.test.ts src/lib/watch/__tests__/publicTimelineProjection.test.ts`
- `npm run verify`
  - `format:check`
  - `typecheck`
  - `lint`
  - `verify:agent-ip`
  - `verify:news`
  - `test:news`
  - `test:watch-pipeline`：46 files / 249 tests pass
  - `verify:chat-v3-final`：50/50 pass
- `npm run verify:a11y`：checked routes 0 axe violations
- `npm run verify:metrics`：2 files / 5 tests pass
- `npm run build`

待 PR 后继续：Vercel preview，不带 `--prod`。

[DOC-HINT: B.14 public schema cleanup should decide whether public JSON may expose TeamMemberId as structural keys; hotfix-5 only guarantees user-visible text fields are clean.]

---

# B.14 Round 1 评估

时间：2026-05-16
评估对象：`docs/codex-specs/spec-watch-B14-resident-analysis-and-priority-candidate.md` v1.0
base：`b0a051a4dd1e1aa7674dd497e83c6bd992ac0801`
结论：**不建议 v1.0 直接进入实现。需要 F 出 v1.1 后再派 Stage 1。**

## Intake 判断

来源按 Claude/F spec intake 处理，不按直接执行命令处理。本轮只评估，不实施。

Constitution 对照：

- Rule 1 部署身份：PASS。已核对 GitHub repo `agentxmain-collab/claw42`、Vercel project `claw42-site`、scope `agentxmain-collabs-projects`。
- Rule 2 生产保护：PASS。本任务无 prod 动作。
- Rule 3 视觉与品牌：PASS with caveat。Dan 授权的是“决策流同区多 type 卡”，不能扩成新 panel 或 V10 layout 重构。
- Rule 4 数据与 schema：**VIOLATION in v1.0 spec**。v1.0 要加 `CandidateType`，但没有列完整 schema write set 与 legacy fallback。
- Rule 5 AI / 行情诚实性：**VIOLATION in v1.0 spec**。非 symbol candidate 仍走 trade-decision schema 会制造假交易语义。
- Rule 6 协作闭环：PASS。本报告写回 sync。
- Rule 7 验证门槛：PARTIAL。v1.0 有 SC，但缺 preview cron 不跑时的机械验收替代路径。

## First-Hand 事实

### 1. PM pipeline 不能直接 generalize 到非 symbol candidate

v1.0 §2.1 写“复用现有 PM pipeline，14 角色对常驻 candidate 走同样 dispatch”。代码事实不支持直接复用。

- `src/lib/team/pmDecisionPipeline.ts:68-76` 的 `PmDecisionPipelineInput` 只有 `recentMarketSignals / recentNewsEvidence / locale / now`，没有 `candidateType` 或 `candidateKey`。
- `src/lib/team/pmDecisionPipeline.ts:515-520` 用第一条 market signal 或 news symbol 推出 `symbol`，否则 fallback `"BTC"`。
- `src/lib/team/pmDecisionPipeline.ts:509-513` 在没有价格信号时把 `currentPrice` fallback 成 `1`。
- `src/lib/team/pmDecisionPipeline.ts:1233-1260` 进入 PM trade-decision 阶段时无条件组装 trade inputs。
- `src/lib/team/tradeDecisionPromptBuilder.ts:20-33` 的 `TradeCardPromptContext` 必填 `symbol` + `currentPrice`。
- `src/lib/team/tradeDecisionPromptBuilder.ts:77-143` 明确要求输出 `TradeDecision` JSON：entry / stopLoss / takeProfit / positionSizing。
- `src/lib/team/pmDecisionPipeline.ts:617-738` 写出的 `StrategyDecisionRecord` 必含 `symbol`，`id` 也是 `pm:${symbol}:${now}`。
- `src/lib/team/pmDecisionPipeline.ts:1025-1048` public payload 只写 `kind: "pm_decision"` + `symbol` + `tradeDecision`。

判断：`market_overview` 如果硬塞现有 pipeline，会被强行变成 BTC 或 UNKNOWN 的 trade card；如果没有价格，会进入 `currentPrice=1` 的假条件。这不是 prompt wording 能解决的，需要先扩 candidate contract，并给常驻分析一个非交易 / trade-disabled 分支。

### 2. 14 角色 prompt 已有身份层，但仍是交易/单标的语境

- 14 个 `docs/agent-ip/team/*.md` 都有 hotfix-5 的 public wording guardrail。
- `src/lib/team/evidenceDispatcher.ts:32-40` 的 `EvidenceContextPack` 仍以 `symbol` 为中心。
- `src/lib/team/evidenceDispatcher.ts:223-240` 会按单个 normalized symbol 拉 chart/news/onchain/fundamental/memory。
- `src/lib/team/evidenceDispatcher.ts:50-73` 的 role-domain/abstain 逻辑按 symbol evidence 判断。
- `src/lib/team/evidenceDispatcher.ts:75-103` 的 mandate 可以支撑“角色视角”，但 trader / pm / chart 等角色仍偏交易。
- `src/lib/team/teamRegistry.ts:3-17` 当前 14 个 `TeamMemberId` 完整存在，`src/lib/team/teamRegistry.ts:41-254` 全部 `defaultProvider: "deepseek"`，identity 层已稳定。

判断：14 角色可以复用“角色身份”，不能复用“同一 trade prompt”。v1.1 应把 prompt 分支写成：

- `symbol`：现有 trade-decision pipeline。
- `market_overview`：macro/session brief，禁止 entry/stop/tp，输出 `tradeDecision: null` 或新增 `analysisSummary`。
- `hotspot`：若绑定 executable symbol 才允许 trade branch；若只是叙事热点，则按 trade-disabled analysis branch。

### 3. Candidate selector 现在只有 symbol，不支持 candidate type

- `src/lib/team/topicSelector.ts:7` 的 `TopicReasonKind` 只有 `news | market | momentum | pool | memory`。
- `src/lib/team/topicSelector.ts:20-33` 的 `PmDecisionTopicCandidate` 只有 `symbol / execution / score / reasons`，没有 `candidateType`。
- `src/lib/team/topicSelector.ts:120-137` 的 candidate 来源是 pool symbol、news symbol、market signal symbol，fallback `BTC`。
- `src/lib/team/topicSelector.ts:247-301` 最终按 `score` 排序；只用 `Number.EPSILON` 把原 index 塞进分数，缺严格 tie-breaker contract。
- `src/lib/team/topicSelector.ts:330-355` selection evidence public summary 固定写“本轮优先分析 ${topic.symbol}”。

判断：v1.0 “新增 CandidateType”不能只改 type。需要新增中心对象，例如：

```ts
type CandidateType = "symbol" | "market_overview" | "hotspot";

interface DecisionCandidate {
  candidateType: CandidateType;
  candidateKey: string; // stable, e.g. market_overview:daily:zh_CN:2026-05-16
  symbol?: string;
  executable: boolean;
  cadence: "daily" | "intraday" | "event";
  score: number;
  reasons: TopicSelectionReason[];
}
```

### 4. Public timeline / topic adapter / V10 UI 都是 symbol-first

- `src/lib/watch/publicTimelineEvent.ts:57-74` 的 `pm_decision` payload 有 `symbol`，没有 `candidateType`。
- `src/lib/watch/publicTimelineProjection.ts:104-107` 只接受 `/^[A-Z0-9]{2,12}$/`，`market_overview` 这种 key 会被过滤。
- `src/lib/watch/publicTimelineProjection.ts:176-205` / `208-244` projection 只推导 `symbol / executable / tradeDecision`。
- `src/lib/watch/publicTimelineOrdering.ts:20-24` dedupe key 是 `${locale}:${symbol}`。
- `src/lib/watch/topicAggregator.ts:14-23` 的 group 只有 `symbol`，无 candidate type。
- `src/lib/watch/topicAggregator.ts:81-124` 如果 symbol 是 `UNKNOWN` 直接跳过；如果用 pseudo-symbol，又会按 symbol 聚合。
- `src/modules/agent-watch/v9/types.ts:133-160` 的 `DispatchTopic` 没有 candidate type。
- `src/lib/watch/v9TopicAdapter.ts:268-310` 的 stage copy 是交易阶段语义；`src/lib/watch/v9TopicAdapter.ts:482-545` 会按 trade decision 生成 trader / PM 消息。
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:93-101` 现在按 `topicRanking.score desc || original index` 排序，和 v1.0 “常驻置顶 + timestamp desc”不一致。
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:258-285` follow-trade hidden 只看 `watchOnly`，没有 `market_overview` strict gate。

判断：Stage 3 UI 不是独立尾部小改，它依赖 Stage 1 的 public payload contract。v1.1 必须把 canonical ordering function 和 legacy fallback 写清楚，否则 hotfix-4 的 duplicate/order 问题会重演。

### 5. 数据源真实可用性

Vercel env（不输出 value）：

- Preview + Production 已有：`CRYPTOCOMPARE_API_KEY`、`COINGECKO_DEMO_KEY`、`ETHERSCAN_API_KEY`、`DUNE_API_KEY`、`DEBANK_ACCESS_KEY`、`DEEPSEEK_API_KEY`、`MINIMAX_API_KEY`、KV vars。
- Production 额外有：`CRON_SECRET`。
- 未见：`CRYPTOPANIC_API_KEY`、Twitter/X/social API key、CoinMarketCap key、Glassnode key、Nansen key。

代码事实：

- `src/lib/news/sourceRegistry.ts:34-48` CryptoCompare 是 active primary；但 `fields.sentimentNative/currenciesNative/votesNative` 都是 false。
- `src/lib/news/adapters/cryptocompare-adapter.ts:32-47` CryptoCompare article 只映射 title/url/source/currencies/sentiment-from-text/publishedAt。
- `src/lib/news/sourceRegistry.ts:63-74` CryptoPanic 是 standby，能提供 currencies/votes native，但 env 缺 `CRYPTOPANIC_API_KEY`。
- `src/lib/marketDataCache.ts:27-31` 已用 CoinGecko simple/trending/markets endpoint。
- `src/lib/marketDataCache.ts:140-166` 当前 `CoinTickerEntry` 只保留 symbol/name/price/change24h/category，丢掉 market cap / total volume。
- `src/lib/marketDataCache.ts:202-237` opportunity pool 从 CoinGecko markets top100 来，但只按 24h change 取候选。
- `src/lib/marketDataCache.ts:33-35` CoinW kline 只覆盖 BTC/ETH/SOL，不能支撑 HYPE/BILL/IRYS，也不提供 market cap。
- `src/app/api/hero/trending-coins/route.ts:21-33` 已有可复用的 CoinGecko markets fields：`market_cap / total_volume / price_change_percentage_24h`。
- `src/app/api/hero/trending-coins/route.ts:108-127` 已有基于 volume + market cap 的过滤/score 经验。
- `src/lib/api/fearGreed.ts:1-46` 已有 Fear & Greed adapter，但当前 PM evidence pack 未接入。
- 未找到 BTC dominance / total crypto market cap / US equity correlation 的现成 adapter。

判断：

- News 热度：可用 CryptoCompare “7d count / source diversity / high impact count”近似，不能声称有 native social heat。
- Market cap / 24h volume：不是 CoinW kline 提供；应复用 CoinGecko markets path 或抽出 shared market universe adapter。
- 社交数据：当前不可用。除非 Dan 申请 CryptoPanic 或 X/social API，否则 v1.1 应把 social dimension 降 P1/backlog，不能列 P0 硬验收。
- 大盘宏观：Fear & Greed 可用；BTC.D / total market cap / US equity correlation 当前没有 first-class source。

### 6. Cron / cadence 在 preview 下不能按 v1.0 验收

- `vercel.json:1-7` 只有 `/api/cron/strategy-replay`，schedule `0 */3 * * *`。
- `src/app/api/cron/strategy-replay/route.ts:47-152` cron 会跑 news/debate/PM batch，`trigger=now` 则单次 PM。
- `src/app/api/watch/refresh/route.ts:1` 已用 `waitUntil`。
- `src/app/api/watch/refresh/route.ts:151-258` 是 visit-trigger path，但当前 GET/POST 都要求 `symbol`，没有 `candidateType`。
- `src/app/api/watch/refresh/route.ts:159-218` lock ordering 是 rate limit → in-flight → freshness → cooldown → pmDecisionLock → hasTrigger。
- `src/app/api/watch/refresh/route.ts:238-256` 用 `waitUntil(triggerPmDecisionPipelineOnce(...symbol...))`，仍是 symbol path。

判断：B.14 resident cadence 不能靠“新增 cron”在 preview 验收；v1.0 已承认 preview cron 限制，但 §19 T102/T103 仍写 cron 实装 P0。v1.1 应改为：

- cadence policy + lock key 先落在 code。
- preview 验收用 manual trigger / refresh trigger / test clock。
- prod cron schedule 如需新增或改动，列为 Dan 单独授权项，不放在 Codex 自行实施范围。

## F 假设逐条裁决

| 假设                                                             | 裁决             | 理由                                                                                                                          |
| ---------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PM pipeline / 14 角色 prompt 可 generalize 到非 symbol candidate | **FAIL / P0**    | pipeline、record、projection、trade schema 全 symbol-first；会把非 symbol 变成 BTC/UNKNOWN trade card。                       |
| prompt 模板按 candidate type 分支容易实装                        | **PARTIAL / P1** | 可实装，但不是只改 docs prompt；需要 `PmDecisionPipelineInput`、evidence pack、trade decision branch、public payload 一起改。 |
| CryptoCompare 可支持 news heat                                   | **PARTIAL / P1** | 可用 article count/source count 近似；没有 native votes/social heat。                                                         |
| market cap / 24h volume 可用                                     | **PARTIAL / P1** | 可从 CoinGecko markets 复用；当前 watch pool 丢字段，CoinW kline 不提供 market cap。                                          |
| 社交数据可用                                                     | **FAIL / P1**    | 未见 social API key；CryptoPanic standby 但 key 未配置。                                                                      |
| Stage 1/2/3 边界合理                                             | **PARTIAL / P1** | 需要在 Stage 1 前增加 contract/schema gate；否则 Stage 3 无法独立稳定。                                                       |

## Stage 边界评估

建议 v1.1 改为 4 个 stage，而不是 3 个：

1. **Stage 0 Candidate Contract / Projection Contract**：新增 `CandidateType`、`DecisionCandidate`、public payload optional `candidateType/candidateKey/displayTitle`、legacy fallback、canonical order key。1 AI 天。
2. **Stage 1 Resident Analysis**：market_overview/hotspot cadence policy、refresh/manual trigger、trade-disabled pipeline branch、raw artifact。3-5 AI 天。
3. **Stage 2 Priority Candidate Selector**：CoinGecko market cap/volume + CryptoCompare news count + executable/watch-only weighting + cache/fallback。2-3 AI 天；如硬做 social API，变 4-5 AI 天且需要 Dan 申请 key。
4. **Stage 3 Multi-Type Card UI**：badge/accent/sorting/follow strict gate/i18n/a11y/5-refresh hash。1.5-2.5 AI 天。

全 spec 预计：**7.5-11.5 AI 天**。如果 v1.0 直接开干，返工风险高，实际更接近 9-14 AI 天。

最高风险 stage：**Stage 1 / Resident Analysis**。原因不是 prompt 难，而是它同时跨 PM pipeline、trade schema、strategy record、public timeline projection、refresh trigger、KV cadence lock。任何一层继续用 symbol fallback 都会产出“假 BTC / 假 trade card”。

## §13 Cannot-Do 漏项

v1.0 的 12 条不够，建议 v1.1 增加：

1. 不得把 `market_overview` / `hotspot` 当作假 symbol 写进 trade-decision path。
2. 不得用 `currentPrice=1` 或 `symbol=BTC` 兜底生成常驻 trade card。
3. 不得让 `market_overview` 进入 executable / follow-trade resolver。
4. 不得依赖 preview cron 作为验收机制；preview 只能用 manual/refresh/test clock 验收 cadence policy。
5. 不得在无 social key 时把 social score 当作 P0 数据源；缺源只能 neutralize，不输出“社交缺失”。
6. 不得每次用户访问触发 resident + full symbol pool；必须有 per-candidate cadence/cooldown/cost cap。
7. 不得修改 public payload shape 而没有 legacy record fallback。
8. 不得在 resident card 中恢复 hotfix-5 禁词或后台状态。
9. 不得恢复 demo fallback topic 来填充 resident card。
10. 不得用 Map iteration / index / random 作为最终排序依据。

## §19 16 个 P0 task 评估

| Task                                | 评估              | 建议                                                                                    |
| ----------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| T101 schema CandidateType           | P0 合理但不完整   | 扩成 `DecisionCandidate` + public payload + adapter type + legacy fallback。            |
| T102 market_overview cron + cadence | P0 名称不合理     | 改为 cadence policy + manual/refresh/test-clock trigger；新增 prod cron 只能 Dan 授权。 |
| T103 hotspot cron + cadence         | P0 名称不合理     | 同 T102。                                                                               |
| T104 prompt type branch             | P0 合理但范围低估 | 不只是 prompt；还要 pipeline branch、trade-disabled output、evidence context。          |
| T105 timeline projection multi type | P0 合理           | 必须覆盖 `projectDecisionRecordToPublicEvent` + `topicAggregator` + `v9TopicAdapter`。  |
| T106 true PM run raw artifact       | P0 合理           | 但常驻 analysis branch 应先通过 unit + dry-run，避免 25 calls/candidate 浪费。          |
| T201 selector 4 dims                | P0 需调整         | Social 降 P1；market cap/volume/news/executable 可 P0。                                 |
| T202 data source                    | 拆分              | CoinGecko/CryptoCompare P0；social/CryptoPanic P1，需要 key。                           |
| T203 cache 5min                     | P0 合理           | 加 key 设计：candidate score cache 与 cadence lock 分开。                               |
| T204 tests                          | P0 合理           | 加 data-source-missing neutral score test。                                             |
| T301 3 type render                  | P0 合理           | 依赖 Stage 0 payload。                                                                  |
| T302 accent + badge                 | P0 合理           | 不改 layout。                                                                           |
| T303 i18n 10 locale                 | P0 合理           | 含 `en_XA`。                                                                            |
| T304 follow strict gate             | P0 合理           | 条件应是 candidateType 不是 symbol，或 executable 不为 true 时不渲染。                  |
| T305 tie-breaker                    | P0 合理但需前置   | 放入 canonical ordering util，不能只在 V10 排序。                                       |
| T306 stability/a11y/raw             | P0 合理           | 保留。                                                                                  |

## Product / UX Angle

F 没问到的关键 angle：

1. **常驻卡不一定应该输出交易方案**。大盘/热点的用户价值是“今天该不该进入风险市场 / 哪条叙事值得盯”，不是硬给 entry/stop/tp。
2. **大盘卡应影响 symbol selector 权重**。例如 market_overview 为 risk-off 时，symbol selector 应提高 executable 大币权重、降低 long-tail 机会池，而不是两个系统独立。
3. **cost cap 要进 spec**。当前一个 candidate 可能触发 14 角色多轮 + PM；resident 2-3 卡 + symbol topN 如果在 visit trigger 上不控，会把 B.13 的 refresh 成本问题放大。
4. **history dedupe key 要早定**。`market_overview` 是每日一个 record，`hotspot` 是 intraday 多个，不能和 symbol 的 `${locale}:${symbol}` 用同一 dedupe 语义。
5. **market_overview 的证据源缺口不能显示给用户**。继承 hotfix-5 规则，缺 BTC.D / US equity 只能在内部 telemetry 中体现，public 文案必须只基于已有证据输出。

## 建议 v1.1 修改 diff

```diff
diff --git a/docs/codex-specs/spec-watch-B14-resident-analysis-and-priority-candidate.md b/docs/codex-specs/spec-watch-B14-resident-analysis-and-priority-candidate.md
@@
- > **协议**：claude-codex-protocol v2.5 (19 段)
+ > **协议**：claude-codex-protocol v2.5 (Round 1 后补齐 §7-§12 engineering context)
@@
- - 复用现有 PM pipeline，14 角色对常驻 candidate 走同样 dispatch
+ - 复用 14 角色身份与多轮框架，但 PM pipeline 必须先加 candidate-type 分支：
+   - `symbol`：沿用现有 trade-decision branch
+   - `market_overview`：trade-disabled resident analysis branch，不生成 entry/stop/tp
+   - `hotspot`：若绑定 executable symbol 才走 trade branch；纯叙事热点走 trade-disabled branch
+ - 禁止把 resident candidate fallback 成 BTC / UNKNOWN / currentPrice=1 trade card
@@
- - 新增 schema：`CandidateType = 'symbol' | 'market_overview' | 'hotspot'`
+ - 新增 schema contract：
+   - `CandidateType = 'symbol' | 'market_overview' | 'hotspot'`
+   - `DecisionCandidate = { candidateType, candidateKey, symbol?, displayTitle, executable, cadence, score, reasons }`
+   - public payload 加 optional `candidateType / candidateKey / displayTitle / executable`
+   - legacy record fallback：缺 candidateType 的旧 record 视为 `symbol`
@@
- - 评分维度：
-   - 市值权重
-   - 24h volume 权重
-   - 新闻热度权重
-   - 用户关注度权重
+ - 评分维度：
+   - 市值权重：P0，复用 CoinGecko markets；当前 watch pool 需保留 `marketCapUsd`
+   - 24h volume 权重：P0，复用 CoinGecko markets；当前 watch pool 需保留 `totalVolumeUsd24h`
+   - 新闻热度权重：P0，CryptoCompare 7d count/source diversity/high-impact count 近似
+   - 用户/社交关注度：P1，除非 Dan 先提供 CryptoPanic 或 social API key
+   - executable 权重：P0，CoinW executable symbol 优先；watch-only 只能高分展示，严禁跟单
@@
- - 排序：常驻卡置顶（market_overview 第一 / hotspot 第二）+ 币种卡按 timestamp desc
+ - 排序必须使用 canonical comparator：
+   1. candidate type priority: market_overview → hotspot → symbol
+   2. score desc where available
+   3. lastUpdatedAt desc
+   4. candidateKey / recordId 字典序
+ - 禁止 index / Map iteration / random 进入最终排序。
@@
- - 常驻 candidate cron 不跑（Vercel preview 限制，hotfix-2 已知）：visit-trigger refresh 链路兜底
+ - Preview cron 不作为验收机制：cadence 用 manual trigger / refresh trigger / test clock 验证。
+ - 如需新增/修改 production cron schedule，必须 Dan 单独授权；Codex 不擅自改 `vercel.json`。
@@
- 1. 现有 PM pipeline / 14 角色 prompt 能 generalize 到非 symbol candidate（大盘 / 热点），需 prompt 模板调整
- 2. CryptoCompare news source 含足够热度数据支持优先级评分
- 3. CoinW kline / market cap / volume API 可用作优先级 input
+ 1. 现有 PM pipeline 不能直接 generalize 到非 symbol candidate；v1.1 必须先加 candidate contract + trade-disabled branch
+ 2. CryptoCompare 可支持 news-count/source-diversity 近似热度，但无 native social/vote 字段
+ 3. market cap / 24h volume 来源是 CoinGecko markets，不是 CoinW kline；CoinW kline 当前只覆盖 BTC/ETH/SOL
+ 4. social/user attention 当前无可用 key；列 P1/backlog 或 procurement
@@
- ## § 13 不能做（冻结清单）
+ ## § 13 不能做（冻结清单）
@@
 12. 多 type 卡片 follow-trade 按钮 strict gate（market_overview 严禁渲染）
+13. 不得把 `market_overview` / pure `hotspot` 当作假 symbol 写入 trade-decision branch。
+14. 不得用 `symbol=BTC`、`symbol=UNKNOWN` 或 `currentPrice=1` 为常驻卡生成假 trade card。
+15. 不得依赖 preview cron 作为 B.14 cadence 验收。
+16. 不得在无 social API key 时把 social score 作为 P0 验收项。
+17. 不得每次用户访问触发 resident + full symbol pool；必须有 per-candidate cadence/cooldown/cost cap。
+18. 不得修改 public payload shape 而没有 legacy fallback。
+19. 不得恢复 demo fallback topic。
+20. 不得使用 index / Map iteration / random 作为最终排序依据。
@@
- - Stage 1：A 常驻 candidate type（含 schema + cadence + KV write + timeline projection 通过）
- - Stage 2：B 优先级评分（含 4 维度评分 + cache + fallback）
- - Stage 3：C 多 type 视觉 + i18n + 验收套件
+ - Stage 0：Candidate/Public Payload/Ordering contract（先行 gate，单 PR）
+ - Stage 1：Resident analysis branch + cadence policy + refresh/manual trigger（单 PR）
+ - Stage 2：Priority candidate selector（CoinGecko + CryptoCompare + executable weighting；social P1）（单 PR）
+ - Stage 3：Multi-type card UI + i18n + stability verification（单 PR）
@@
- | T101 | 1 常驻 | P0 | schema CandidateType 扩 3 值 |
+ | T100 | 0 Contract | P0 | DecisionCandidate + public payload + DispatchTopic + canonical comparator + legacy fallback |
+ | T101 | 1 常驻 | P0 | PM pipeline candidateType branch；resident trade-disabled output |
@@
- | T102 | 1 常驻 | P0 | market_overview cron + cadence 实装 |
- | T103 | 1 常驻 | P0 | hotspot cron + cadence 实装 |
+ | T102 | 1 常驻 | P0 | market_overview cadence policy + manual/refresh/test-clock trigger |
+ | T103 | 1 常驻 | P0 | hotspot cadence policy + manual/refresh/test-clock trigger |
@@
- | T202 | 2 优先级 | P0 | 数据源接入（market cap / volume / news / 社交） |
+ | T202a | 2 优先级 | P0 | CoinGecko market cap / volume 字段保留 + scoring |
+ | T202b | 2 优先级 | P0 | CryptoCompare news-count/source-diversity scoring |
+ | T202c | 2 优先级 | P1 | CryptoPanic/social score，等待 env/key |
```

## 收敛建议

Round 1 判定：**[SPEC-FEEDBACK] > 2 且含 P0，不进入 implement。**

建议 F 出 v1.1 时先修 5 件事：

1. 加 Stage 0 contract，明确 `DecisionCandidate` / public payload / DispatchTopic / ordering comparator。
2. 把“复用 PM pipeline”改成“复用 14 角色身份 + 新增 candidate-type branch”。
3. 把 social score 从 P0 降到 P1，除非 Dan 提供 CryptoPanic/social key。
4. 把 cron 实装改成 cadence policy + preview-safe manual/refresh/test-clock 验收；prod cron 另等 Dan 授权。
5. 给 cost cap / lock key / top-N 写硬规则。

[DOC-HINT: none]
