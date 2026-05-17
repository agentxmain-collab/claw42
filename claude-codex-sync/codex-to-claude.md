# B.14 Stage 0 Contract Gate 报告

Codex time: 2026-05-16 22:35 CST
Base: `origin/main` = `b0a051a4dd1e1aa7674dd497e83c6bd992ac0801`
Branch: `feature/b14-stage0-contract`
Scope: Stage 0 only. Stage 1 not started in this PR.

## T100 DecisionCandidate + public payload contract

- Added `src/lib/watch/decisionCandidate.ts` with `CandidateType`, `DecisionCandidate`, cadence, canonical score/reason contract, normalization helpers, dedupe key helper, and ordering comparator.
- Added `StrategyDecisionRecord.candidate?: DecisionCandidate` as optional schema extension. Missing candidate data remains a legacy symbol candidate.
- Extended public `pm_decision` payload with optional `candidateType`, `candidateKey`, `displayTitle`, and kept `executable` optional for legacy payloads.
- Projection writes legacy fallback metadata:
  - missing `candidateType` => `symbol`
  - missing `candidateKey` => normalized symbol for symbol records
  - missing `displayTitle` => `<SYMBOL> 实时行情分析`
- Explicit non-symbol candidate projection test covers `market_overview` staying public with `executable=false`.

## T101 Canonical ordering comparator

Implemented canonical comparator order:

1. `market_overview`
2. `hotspot`
3. `symbol`
4. score desc
5. `lastUpdatedAt` desc
6. `candidateKey / recordId / symbol` lexicographic tie

Unit tests cover:

- 3 type ordering.
- same type score priority.
- same type + score uses `lastUpdatedAt`.
- same timestamp uses lexicographic `candidateKey / recordId`.
- final merge path sorts after Map collection, so insertion order is not the final ordering.

## T102 History dedupe key by candidateType

Implemented `publicTimelinePmCandidateKey()` and switched `mergePublicTimelineEvents()` to candidate keys:

- symbol: `${locale}:${symbol}`
- market_overview: `${locale}:market_overview:${YYYY-MM-DD}`
- hotspot: `${locale}:hotspot:${candidateKey}`

Legacy malformed symbol payloads still skip grouping instead of becoming fake symbol records. Non-symbol candidates group by candidate key and do not require a tradable symbol.

## T103 Stage 0 gate

Stage 0 is isolated in this PR. No PM pipeline, evidence dispatcher, refresh, candidate ranking, V10 layout, prod, or cron config changes.

Verification passed:

- `npx vitest run src/lib/watch/__tests__/publicTimelineOrdering.test.ts src/lib/watch/__tests__/topicAggregator.test.ts src/lib/watch/__tests__/publicTimelineProjection.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run verify`
- `npm run verify:a11y`
- `npm run verify:metrics`
- `npm run build`

Note: first `npm run build` was accidentally run in parallel with `verify:a11y`, which starts a Next dev server and writes the same `.next` directory. That caused a transient Next `/_document` ENOENT. I removed the generated `.next` cache and reran build serially; the serial build passed. No source changes were made for that transient cache collision.

`leakCount=0` is preserved by scope: this PR does not touch generation wording / public content guardrails, and `npm run verify` still includes the chat final + public watch pipeline checks.

[DOC-HINT: B.14 Stage 1 should start from this merged contract and reuse DecisionCandidate/publicTimelinePmCandidateKey instead of reintroducing symbol-only keys.]

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

# B.14 Stage 1 Resident Analysis 报告

时间：2026-05-16 23:59 CST  
Branch：`feature/b14-stage1-resident-analysis`  
PR：`https://github.com/agentxmain-collab/claw42/pull/111`  
Base：`origin/main@146ccc3`（B.14 Stage 0 squash 后 main）  
Head commits：

- `d414afba` `feat(watch): add B14 resident candidate pipeline`
- `f3d77b7` `fix(watch): localize resident candidate public labels`

## T201-T207 完成清单

- T201：PM pipeline 加 `candidateType` branch；`market_overview` / pure `hotspot` 走 analysis-only，不生成交易卡。
- T202：实现 `market_overview` daily cadence identity：`market_overview:${locale}:${UTC8 YYYY-MM-DD}`。
- T203：实现 `hotspot` intraday candidate identity：`hotspot:${locale}:${UTC8 hour-window}:...`，并支持 refresh 手动候选。
- T204：refresh / freshness / lock 都按 candidate identity 运作，非 symbol 不再借 BTC/SOL 等假 symbol。
- T205：14 角色可接 resident evidence；非 symbol candidate 跳过 token-specific onchain/fundamental fetch，使用 broad market/news/fear-greed context。
- T206：trade-disabled branch 严禁 entry/stop/tp；无 current price 的 symbol candidate 不再用 `1` 伪造价格。
- T207：真实 preview 触发 3 条新 PM run，raw artifact 已进 repo。

## 关键变更位置

- `src/lib/watch/residentCandidate.ts:12`：10 locale resident / hotspot title 表。
- `src/lib/watch/residentCandidate.ts:81`：`marketOverviewCandidate()` 生成 daily candidateKey + `executable:false`。
- `src/lib/watch/residentCandidate.ts:103`：`hotspotDecisionCandidate()` 生成 intraday candidateKey + executable metadata。
- `src/lib/team/evidenceDispatcher.ts:35`：`EvidenceContextPack` 带 `candidate`。
- `src/lib/team/evidenceDispatcher.ts:152`：resident chart items 从 broad market signals 构造。
- `src/lib/team/evidenceDispatcher.ts:217`：resident news items 使用 broad news evidence。
- `src/lib/team/evidenceDispatcher.ts:460`：non-symbol candidate 只暴露实际存在的 evidence domain，不让缺口变成 public 文案。
- `src/lib/team/pmDecisionPipeline.ts:218`：analysis summary 不再拼内部英文 label。
- `src/lib/team/pmDecisionPipeline.ts:1367`：无 current price 不生成 trade card。
- `src/lib/team/pmDecisionPipeline.ts:1389`：trade-disabled candidate 写 `analysisSummary`。
- `src/app/api/watch/refresh/route.ts:118`：refresh 支持 `candidateType=market_overview|hotspot`。
- `src/app/api/watch/refresh/route.ts:239`：in-flight / cooldown / PM lock 按 candidate identity。

## Verify gate

本地已通过：

- `npx vitest run src/lib/team/__tests__/pmDecisionPipeline.test.ts src/lib/team/__tests__/pmDecisionTrigger.topicSelector.test.ts src/app/api/watch/refresh/route.test.ts src/lib/watch/__tests__/publicTimelineProjection.test.ts src/lib/watch/__tests__/publicTimelineOrdering.test.ts src/lib/watch/__tests__/topicAggregator.test.ts`：6 files / 65 tests pass
- `npm run verify`
  - `format:check`
  - `typecheck`
  - `lint`
  - `verify:agent-ip`
  - `verify:news`
  - `test:news`：6 files / 25 tests pass
  - `test:watch-pipeline`：46 files / 255 tests pass
  - `verify:chat-v3-final`：50/50 pass
- `npm run build`
- `npm run verify:metrics`：2 files / 5 tests pass
- `npm run verify:a11y`：checked routes 0 axe violations
- `git diff --check`

GitHub PR checks（commit `f3d77b7`）：

- `verify` PASS
- `deploy preview` PASS
- `Vercel` PASS
- `Vercel Preview Comments` PASS

## Preview 实测

正确 preview URL：

- `https://claw42-site-mjbdrq9kx-agentxmain-collabs-projects.vercel.app`
- Vercel deployment：`dpl_9X1yx1pARwn8vqw8u1DUoxKepqZ8`
- Target：`preview`

触发结果：

```json
[
  {
    "locale": "zh_CN",
    "request": "/api/watch/refresh?candidateType=market_overview&locale=zh_CN&testNow=1779008400000",
    "response": {
      "status": "stale",
      "symbol": "MARKET",
      "candidateType": "market_overview",
      "candidateKey": "market_overview:zh_CN:2026-05-17",
      "displayTitle": "今日大盘综述",
      "refreshStarted": true
    }
  },
  {
    "locale": "ja_JP",
    "request": "/api/watch/refresh?candidateType=market_overview&locale=ja_JP&testNow=1779008460000",
    "response": {
      "status": "stale",
      "symbol": "MARKET",
      "candidateType": "market_overview",
      "candidateKey": "market_overview:ja_JP:2026-05-17",
      "displayTitle": "マーケット概況",
      "refreshStarted": true
    }
  },
  {
    "locale": "en_US",
    "request": "/api/watch/refresh?candidateType=hotspot&locale=en_US&candidateKey=hotspot:manual:stage1:f3d77b7:1&displayTitle=Market%20Narrative%20Watch&testNow=1779008520000",
    "response": {
      "status": "stale",
      "symbol": "HOTSPOT",
      "candidateType": "hotspot",
      "candidateKey": "hotspot:manual:stage1:f3d77b7:1",
      "displayTitle": "Market Narrative Watch",
      "refreshStarted": true
    }
  }
]
```

Timeline verify 摘要：

```json
[
  {
    "locale": "zh_CN",
    "recordId": "pm:MARKET:1779008400000",
    "candidateType": "market_overview",
    "candidateKey": "market_overview:zh_CN:2026-05-17",
    "displayTitle": "今日大盘综述",
    "executable": false,
    "tradeDecision": false,
    "stageTrace": "analyst_inputs:done,research_lead:done,risk_lead:done,trade_decision:done,record_write:done,public_timeline:done",
    "textLeak": false
  },
  {
    "locale": "ja_JP",
    "recordId": "pm:MARKET:1779008460000",
    "candidateType": "market_overview",
    "candidateKey": "market_overview:ja_JP:2026-05-17",
    "displayTitle": "マーケット概況",
    "executable": false,
    "tradeDecision": false,
    "stageTrace": "analyst_inputs:done,research_lead:done,risk_lead:done,trade_decision:done,record_write:done,public_timeline:done",
    "textLeak": false
  },
  {
    "locale": "en_US",
    "recordId": "pm:HOTSPOT:1779008520000",
    "candidateType": "hotspot",
    "candidateKey": "hotspot:manual:stage1:f3d77b7:1",
    "displayTitle": "Market Narrative Watch",
    "executable": false,
    "tradeDecision": false,
    "stageTrace": "analyst_inputs:done,research_lead:done,risk_lead:done,trade_decision:done,record_write:done,public_timeline:done",
    "textLeak": false
  }
]
```

Raw artifacts：

- `claude-codex-sync/artifacts/b14-stage1/timeline-zh_CN-market-overview-f3d77b7.json`
- `claude-codex-sync/artifacts/b14-stage1/timeline-ja_JP-market-overview-f3d77b7.json`
- `claude-codex-sync/artifacts/b14-stage1/timeline-en_US-hotspot-f3d77b7.json`
- `claude-codex-sync/artifacts/b14-stage1/verification-summary-f3d77b7.json`

Leak scan 口径：扫描用户可见文本字段（`analysisSummary` / `rationaleByMember` values / `summaryByMember` values / `rounds` rationale fields / `tradeDecision` public text / `stageTrace.note`），3 条新 target record 均为 `textLeak=false`。

## First-hand finding

第一次在 clean worktree 跑 `npx vercel --scope agentxmain-collabs-projects --yes` 时，因为该 worktree 没有 `.vercel/project.json`，Vercel CLI 自动 link/创建了错误的新项目 `claw42-b14-stage1-resident-analysis`，并在该错误项目内生成了一次 deployment。该 deployment 没有触碰 `claw42.ai`，但这是 Deployment Identity Gate 的真实风险点。

已修正本 worktree 的 `.vercel/project.json` 指向正确项目：

- `projectName=claw42-site`
- `projectId=prj_UjubflJkr8XJFUm36cUmoLCl3NrH`
- `orgId=team_URED5oO6s2OI5bakH3FJUQpC`

后续所有实测均使用正确 preview `claw42-site-mjbdrq9kx-...`。建议之后任何新 worktree 先复制/校验 `.vercel/project.json`，再允许远程 preview。

## 下一 Stage 依赖

Stage 2 Priority Candidate Selector 可以继续，依赖已满足：

- Stage 0 candidate contract 已在 main。
- Stage 1 已支持 resident candidate identity / refresh / timeline projection / analysis-only record。
- `market_overview` 和 pure `hotspot` 已能进入 public timeline 且不显示 trade card。

无需要 F/Dan 决策的 blocker。

[DOC-HINT: Before any future `npx vercel` from a fresh worktree, copy or verify `.vercel/project.json` against deployment-identity-registry.md to avoid accidental project creation.]

---

# B.14 Stage 2 Priority Selector 报告

时间：2026-05-17

Base：`160e280b6f3ae13ddd114744114d65e84c1f7a6d`

Branch：`feature/b14-stage2-priority-selector`

## T301-T304 完成清单

- T301a：`src/lib/marketDataCache.ts` 保留 CoinGecko `market_cap` / `total_volume`，写入 `CoinTickerEntry.marketCapUsd` / `totalVolumeUsd24h`；majors / trending / opportunity 三类池均可携带 metadata。
- T301b：`src/lib/team/topicSelector.ts` 增加 7d news heat 评分：article count + source diversity + high-impact count；不引入 CryptoPanic / social 假数据。
- T301c：仅保留 `social` hook 位，score 固定 0；等待 Dan procurement。
- T302：selector 分数新增市值、24h volume、新闻热度、可执行性四维；watch-only 仍可进 pool，但 executable 权重更高。
- T303：selector 自动模式加 5min cache；数据全空时 fallback 固定 universe `BTC > ETH > SOL > HYPE`。
- T304：`triggerPmDecisionPipelineOnce` 用户访问触发增加 cost cap：最多 3 个 symbol candidate；resident 仍按 per-candidate route 1 个；新增 `candidate_cost_cap_applied` audit event。

## 测试覆盖

- `src/lib/team/__tests__/topicSelector.test.ts`
  - 市值维度独立排序
  - 24h volume 维度独立排序
  - 7d CryptoCompare-style news heat：article count / source diversity / high-impact count
  - executable / watch-only metadata
  - data-source-missing neutral + finite score
  - 5min cache
  - static fallback universe
- `src/lib/team/__tests__/pmDecisionTrigger.topicSelector.test.ts`
  - visit trigger cost cap telemetry
  - top-ranked topic selection 不破坏
  - scheduled batch 仍能跑完整 pool

## Verify gate

- `npm run format:check`：PASS
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npx vitest run src/lib/team/__tests__/topicSelector.test.ts src/lib/team/__tests__/pmDecisionTrigger.topicSelector.test.ts`：30/30 PASS
- `npm run test:watch-pipeline`：261/261 PASS
- `npm run test:news`：25/25 PASS
- `npm run verify:agent-ip`：PASS
- `npm run verify:news`：PASS（env warnings 维持既有：CryptoCompare / CoinGecko / CryptoPanic key 未在 local shell 暴露）
- `npm run verify:chat-v3-final`：50/50 PASS
- `npm run verify:metrics`：5/5 PASS
- `npm run verify:a11y`：0 violations
- `npm run build`：PASS；首次 build 在 stale `.next` 下触发 Next `/_document` cache error，`rm -rf .next` 后 clean build PASS。

## Raw artifact

- `claude-codex-sync/artifacts/b14-stage2/selector-sample.json`

Artifact 内容包括：

- selector Top 排序样例
- 4 维 scoreBreakdown
- watch-only BILL 入池但不可执行
- visit trigger cost cap 截断结果
- static fallback universe
- public content guardrail `leakCount=0`

## First-hand finding

- CoinGecko `coins/markets` live check 返回 `market_cap` / `total_volume` / `price_change_percentage_24h` 字段，T301a 端点可用。
- CryptoCompare 没有 native social/vote，本阶段只使用进入 `NewsEvidence` 后的 article count / source diversity / high-impact count。
- 现有 refresh path 仍使用 `reason.kind === "news" | "market"` 判定 trigger，所以 Stage 2 没有重命名触发 reason kind；新增维度进入 scoreBreakdown 和 public selection evidence，但不破坏旧触发逻辑。

## Preview

- PR：`https://github.com/agentxmain-collab/claw42/pull/112`
- Preview URL：`https://claw42-site-chz7ga7ko-agentxmain-collabs-projects.vercel.app`
- Vercel deployment：`dpl_8TaVwwer9TwUjXHJECMqhYXcCwiX`
- Target：`preview`
- Inspect：READY

Preview 保护状态：普通 `curl` 返回 401（Vercel protection），`vercel curl` 验证通过。

`vercel curl /api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720`：

```json
{
  "events": 3,
  "keys": [
    "events",
    "evidenceMap",
    "hasMore",
    "locale",
    "nextPollMs",
    "oldestTs",
    "servedAt",
    "windowMinutes"
  ]
}
```

PR checks：

- `verify`：PASS
- `deploy preview`：PASS
- `Vercel`：PASS
- `Vercel Preview Comments`：PASS

[DOC-HINT: Stage 2 intentionally preserves `reason.kind === "news" | "market"` trigger semantics while extending selector scoring dimensions.]

# B.14 Stage 3 Multi-Type Card UI Report

Date: 2026-05-17

## Scope

Stage 3 PR: https://github.com/agentxmain-collab/claw42/pull/113

Base: `896bfd4c2a38995c43e3087a6b3eea41236c5773` (B.14 Stage 2 squash)

Code commit: `8228809 feat(watch): render B14 multi-type decision cards`

## T401-T405 Completion

- T401: v10 decision-flow cards now branch by `candidateType` through `symbol` / `market_overview` / `hotspot` class names and rendering.
- T402: market overview / hotspot badges added with subtle type accents:
  - `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`
  - `src/modules/agent-watch/v10/DispatchConsoleV10.module.css`
  - 10 locale i18n keys under `agentWatch.dispatchV10.market.candidateBadges`
- T403: follow-trade primary affordance now renders only when `candidateType === "symbol" && execution.executable === true`; market overview / hotspot render watch-only copy and never render the primary follow button.
- T404: v10 topic ordering now uses Stage 0 `compareDecisionCandidateOrder` with type priority -> score desc -> lastUpdatedAt desc -> candidate key / record id.
  - `src/modules/agent-watch/v9/types.ts` adds optional `lastUpdatedAt`
  - `src/lib/watch/v9TopicAdapter.ts` passes through existing `group.latestAt`
- T405: raw artifact includes 5 preview fetch hashes, 5 local browser refresh hashes, responsive screenshots, a11y result, and leak scan.

## Tests / Gates

- `npx vitest run src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx`: 7/7 PASS
- `npx vitest run src/lib/watch/__tests__/publicTimelineOrdering.test.ts src/lib/watch/__tests__/topicAggregator.test.ts src/lib/watch/__tests__/v9TopicAdapter.test.ts`: 44/44 PASS
- `npx vitest run src/modules/agent-watch/__tests__/followTradeDisabled.test.tsx src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx`: 10/10 PASS
- `npm run test:watch-pipeline`: 264/264 PASS
- `npm run test:news`: 25/25 PASS
- `npm run format:check`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run verify:agent-ip`: PASS
- `npm run verify:news`: PASS (local env warnings for API keys remain existing behavior)
- `npm run verify:chat-v3-final`: 50/50 PASS
- `npm run verify:metrics`: 5/5 PASS
- `npm run verify:a11y`: 0 axe violations
- `npm run build`: PASS after a clean standalone run. First attempt was invalid because I ran build concurrently with a11y/dev server and `.next` had concurrent writes; after `rm -rf .next`, build passed.

## Preview

- Preview URL: https://claw42-site-git-feature-b14-3229f2-agentxmain-collabs-projects.vercel.app
- Deployment ID: `dpl_6EXn19TKkngagg7Xwwgoj2vpfZD1`
- Canonical URL: https://claw42-site-fx32ebn8z-agentxmain-collabs-projects.vercel.app
- Inspect target: `preview`
- Inspect status: READY

普通 `curl` 仍受 Vercel protection 返回 401；`vercel curl` 通过。

## Raw Artifacts

- `claude-codex-sync/artifacts/b14-stage3/timeline-stability-and-leak-scan.json`
- `claude-codex-sync/artifacts/b14-stage3/browser-refresh-responsive.json`
- `claude-codex-sync/artifacts/b14-stage3/desktop-1440.png`
- `claude-codex-sync/artifacts/b14-stage3/desktop-1280.png`
- `claude-codex-sync/artifacts/b14-stage3/mobile-390.png`

Preview timeline 5-fetch stability:

- `zh_CN`: 5/5 stable, order hash `5e8f2e377b6c8449`, events = 3
  - `market_overview:pm:MARKET:1778922000000:watch`
  - `symbol:pm:BILL:1778936451988:watch`
  - `symbol:pm:HYPE:1778926716595:exec`
- `en_US`: 5/5 stable, order hash `a3fa0c999c0fa39e`, events = 1
  - `hotspot:pm:HOTSPOT:1778925600000:watch`

Leak scan:

- `zh_CN`: user-visible text fields = 62, `leakCount=0`
- `en_US`: user-visible text fields = 89, `leakCount=0`

Browser refresh / responsive:

- Local build URL: `http://127.0.0.1:3214/zh_CN/agent`
- 5/5 browser refresh stable, hash `1df0e6b186276363`
- 1440x1000 / 1280x800 / 390x900: no horizontal overflow

Note: remote browser access is protected by Vercel authentication, so browser refresh/responsive verification used the same local production build; preview API stability used protected `vercel curl`.

## First-hand Finding

- Stage 0 comparator already sorted public timeline events, but v10 `MarketAnalysisPanel` re-sorted topics by ranking score and original render index. Stage 3 fixes that presentation-layer drift by reusing the canonical comparator.
- The old v10 demo-topic test assumed missing `execution` still renders the disabled follow button. The Stage 3 safety gate intentionally requires explicit `execution.executable === true`; the test now creates an explicit executable symbol topic for that path.
- No changes were made to PM pipeline, evidence dispatcher, candidate selector, refresh, hydration, or timeline projection.

[DOC-HINT: Stage 3 uses `DispatchTopic.lastUpdatedAt` as a presentation adapter pass-through so v10 can reuse the Stage 0 canonical comparator without touching backend projection.]

# B.14 hotfix-6 调研 + 实施报告

Date: 2026-05-17

Branch: `feature/b14-hotfix6-empty-state-history-close`
Base: `origin/main` at `8b12dcb211d92a885550079d47187b582d65df8f`
Preview used for remote verification: `https://claw42-site-nbsuj60c4-agentxmain-collabs-projects.vercel.app`

## Task A Empty State

First-hand root cause:

1. The empty public timeline could not schedule a resident refresh from the browser. `AgentWatchBoard.tsx` only posted `/api/watch/refresh` when `topics[0]?.symbol` existed. With `events.length=0`, `topics=[]`, so the visible-session trigger never fired.
2. The refresh status API misclassified a future-dated resident record as fresh. On the pre-fix preview, `/api/watch/refresh?candidateType=market_overview&locale=zh_CN` returned `cached` with `lastDecisionAt=2026-05-17T09:00:00.000Z`, while `/api/watch/timeline?...windowMinutes=720` was served at `2026-05-17T02:46:46.815Z` and returned `events=0`. The future record was hidden by timeline's `event.ts < before` filter but still blocked refresh freshness.

F's four guesses:

- Guess 1, visit-trigger did not schedule market_overview / hotspot: **PASS, partial**. Route can schedule when called, but the UI did not call it when timeline was empty.
- Guess 2, old records aged out or were staleness-filtered: **PASS, refined**. The immediate blocker was a future-dated record being treated as fresh while timeline filtered it out.
- Guess 3, Stage 2 cost cap blocked the trigger: **FAIL for the observed empty state**. Direct resident refresh does not use the symbol top-N cost cap. Parallel manual probes can hit cooldown locks, but that was not Dan's empty-state path.
- Guess 4, preview cadence / pmDecisionLock locked the pipeline: **FAIL for the observed empty state**. The route reported freshness from records, not a pmDecisionLock-only condition; preview cron is not required for visible-session refresh.

F did not ask but matters:

- A partial PM record can be written before final public timeline completion. That is acceptable for hotfix-6 as long as public projection remains stable, but it needs a separate follow-up if `risk_lead` / `trade_decision` repeatedly remains pending.
- Public text leak scan must distinguish natural-language text from schema IDs. The artifact scans user-visible text fields and excludes structural `memberId` / `recordId` fields from leak counting.

Fix implemented:

- `src/modules/agent-watch/AgentWatchBoard.tsx:41-42,100,114,420-501`
  - Tracks when timeline has loaded.
  - If there is no topic after load, posts `/api/watch/refresh?candidateType=market_overview&locale=...`.
  - Keeps symbol refresh behavior unchanged when topics exist.
- `src/lib/watch/decisionFreshness.ts:9-10,94-96`
  - Ignores records/timeline candidates more than 2 minutes in the future so a future-dated record cannot block refresh while timeline hides it.
- `src/lib/watch/__tests__/decisionFreshness.test.ts`
  - Adds regression coverage for future-dated records not counting as fresh.

Remote verification:

- Pre-fix preview: timeline 720min returned `events=0`; refresh GET returned `cached` against future `lastDecisionAt=2026-05-17T09:00:00.000Z`.
- Fixed preview: 5 consecutive timeline fetches all returned `events=1`, stable order hash `pm-decision:pm:MARKET:1778987147313`.
- Fixed preview content leak scan on captured public text fields: `leakCount=0`.

## Task B History Close

First-hand root cause:

- The history panel did have an implicit close action via the old collapse button, but no explicit close affordance / aria label.
- During local browser verification the fixed overlay close button was still intercepted by the site header after only raising z-index; the panel lived under a parent stacking context. Portaling the overlay to `document.body` fixed the click target without changing the panel layout.

Fix implemented:

- `src/modules/agent-watch/v9/HistoryWall.tsx:1-2,8-14,63-70,85-101,172`
  - Adds Esc close.
  - Adds explicit close button with localized `aria-label`.
  - Portals the overlay to `document.body` to avoid header stacking interception.
- `src/modules/agent-watch/v9/HistoryWall.module.css:20-28,83-98`
  - Raises overlay z-index and styles the close affordance without changing drawer layout.
- `src/i18n/types.ts` and 10 locale dictionaries
  - Adds `agentWatch.dispatchV10.history.close_aria`.
- `src/modules/agent-watch/v9/__tests__/HistoryWall.test.tsx`
  - Covers close aria label and button symbol.

Browser verification:

- Local route: `http://127.0.0.1:3037/zh_CN/agent`
- Desktop `1440x1000`: close button visible, click-close PASS, Esc-close PASS, axe violations 0.
- Mobile `390x844`: close button visible, click-close PASS, Esc-close PASS, axe violations 0.

## Raw Artifacts

- `claude-codex-sync/artifacts/b14-hotfix6/empty-state-refresh-remote-evidence.json`
- `claude-codex-sync/artifacts/b14-hotfix6/history-close-visual-a11y.json`
- `claude-codex-sync/artifacts/b14-hotfix6/history-closed-zh_CN-1440.png`
- `claude-codex-sync/artifacts/b14-hotfix6/history-open-zh_CN-1440.png`
- `claude-codex-sync/artifacts/b14-hotfix6/history-closed-zh_CN-390.png`
- `claude-codex-sync/artifacts/b14-hotfix6/history-open-zh_CN-390.png`

## Verify Status

- `npx vitest run src/lib/watch/__tests__/decisionFreshness.test.ts src/modules/agent-watch/v9/__tests__/HistoryWall.test.tsx src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx src/app/api/watch/refresh/route.test.ts` PASS
- `npx vitest run src/modules/agent-watch/v9/__tests__/HistoryWall.test.tsx` PASS after portal change
- `npm run verify` PASS
  - `format:check` PASS
  - `typecheck` PASS
  - `lint` PASS
  - `verify:agent-ip` PASS
  - `verify:news` PASS
  - `test:news` PASS, 25 tests
  - `test:watch-pipeline` PASS, 265 tests
  - `verify:chat-v3-final` PASS, 50 synthetic threads
- `npm run build` PASS
- `npm run verify:a11y` PASS, 0 axe violations on checked routes
- `npm run verify:metrics` PASS, 5 tests

[DOC-HINT: hotfix-6 keeps refresh resident-trigger-only for empty timelines; it does not change PM pipeline, candidate ranking, cron, or production deployment topology.]

# B.14 hotfix-6 v1.1 调研 + 实施报告

Date: 2026-05-17

Branch: `feature/b14-hotfix6-v11-state-hotspot`
Base: `origin/main` at `012feaed9661fe9c527e610bca31fee8ce4f47f4`
Implementation commit: `cdddcb5ff2b58b015b50917f031f2ed3589dc3d3`

Preview:

- Ready deployment: `https://claw42-site-mcqigt5dj-agentxmain-collabs-projects.vercel.app`
- Branch alias: `https://claw42-site-git-feature-b14-60432e-agentxmain-collabs-projects.vercel.app`
- Deployment id: `dpl_F9jKdkCvEjNYuGPLaxuWwonzjFxA`
- Temporary share URL: `https://claw42-site-mcqigt5dj-agentxmain-collabs-projects.vercel.app/?_vercel_share=1jkPRcIam1Smg1WUOWOHCfoIiqzcn4KC`
- Note: two direct local CLI deploy attempts stuck in Vercel `UNKNOWN`; Git branch preview produced the ready build. Prod was not touched.

## Task A Empty State

v1.0 root cause remains valid:

- Empty timeline previously did not schedule a resident refresh because `AgentWatchBoard` only posted `/api/watch/refresh` when `topics[0]?.symbol` existed.
- Future-dated records could be considered fresh while timeline projection filtered them away.

v1.1 regression check:

- The ready preview `zh_CN` timeline now returns a real public record, not empty state.
- 10 consecutive protected preview API fetches were stable: `eventsLength=1`, key `hotspot:pm:HOTSPOT:1778992128320:热点叙事追踪`, hash `e1ffdbaf9f779c5d`.
- The first cold fetch immediately after the final report-only deploy briefly included one older legacy `MARKET` record once; a warmed 10-fetch run was stable. Raw artifact notes this explicitly.
- `en_US` currently has no record in KV and remains stable empty; this is data availability, not the original zh_CN empty-state bug path.

## Task B History Close

v1.0 fix remains valid and was not changed in v1.1:

- History drawer has explicit close button, Esc close, localized aria label, and portal layering.
- v1.1 changes do not touch `HistoryWall`.

## Task C Hotspot Count vs Visible Card

F guesses checked first-hand:

- (a) V10 hotspot render branch missing: **FAIL**. `MarketAnalysisPanel` already had `candidate-hotspot` class and hotspot badge handling.
- (b) Timeline projection filtered hotspot: **FAIL for current preview**. Manual `/api/watch/refresh?candidateType=hotspot&locale=zh_CN` produced a public hotspot record that projected through `/api/watch/timeline`.
- (c) Header number source wrong: **PASS**. Header label `热点` used `resolvedTopics.length`, so a single `market_overview` card rendered as "热点 1".
- (d) Comparator hid hotspot: **FAIL**. Current API returned a single visible hotspot record; no pagination/ordering hiding was involved.
- (e) Fifth root cause: **PASS**. Visible-session refresh targeted only one candidate path. With a resident card present it used pseudo-symbol `MARKET`/first topic behavior and did not explicitly backfill missing hotspot.

Fix:

- `src/modules/agent-watch/AgentWatchBoard.tsx:80-123,474-565`
  - Added `resolveVisibleSessionRefreshTarget`.
  - Fill order is now `market_overview` first, then missing `hotspot`, then real symbol topics.
  - It no longer treats pseudo resident symbols as normal symbol refreshes.
  - Locked/refreshing responses no longer permanently burn the session key; they schedule a bounded retry.
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:471-508`
  - Header `热点` count now derives from actual hotspot topics, not total cards.
- Tests:
  - `src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts`
  - `src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx:177-226`

Preview verification:

- Live protected API: `zh_CN` has `eventsLength=1`, `candidateType=hotspot`, `displayTitle=热点叙事追踪`.
- Browser mocked-stream verification on the ready preview: header text `热点 1 / 已闭环 1 / 辩论中 2 / 起步 0`; visible card titles `今日大盘综述`, `热点叙事追踪`, `BTC 决策流`; hotspot check PASS.

## Task D Controlled State Reset

F guesses checked first-hand:

- (a) `events.map` key was index: **FAIL**. V10 already used `key={topic.id}`.
- (b) SSE/refresh replaces the event array and re-renders the list: **PASS as a stressor**, not sufficient root cause alone.
- (c) Freshness state remounts the whole board: **FAIL**. It re-renders but does not intentionally remount the board.
- (d) Scroll position had no restoration: **PASS**.
- (e) Expanded/collapsed state was not explicitly keyed by record id: **PASS**. It lived inside each card and initialized from `topic.defaultCollapsed`, so remount/new record identity could reset user state.

Fix:

- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:127-200,467-491,518-556`
  - Added record-id keyed collapse state reconciliation.
  - Added record-id keyed scroll anchor capture/restore on topic order changes.
  - Card wrapper keeps `key={topic.id}` and now also exposes `data-topic-card-id={topic.id}` for scroll anchoring.
- Tests:
  - `src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx:317-362` verifies expanded state follows the same record after reorder.

10-update UI verification:

- Browser test used the real ready preview shell with a controlled EventSource payload containing 3 cards.
- After expanding the third card (`BTC 决策流`) and scrolling to it, 10 stream emits with alternating input order kept:
  - `aria-expanded=true` after all 10 emits
  - `scrollTop=1089` before and after, delta `0`
  - rendered title order stable: `今日大盘综述` → `热点叙事追踪` → `BTC 决策流`

## Raw Artifacts

- `claude-codex-sync/artifacts/b14-hotfix6-v11/api-v11-timeline-10-fetch-stability.json`
- `claude-codex-sync/artifacts/b14-hotfix6-v11/api-v11-visible-leak-scan.json`
- `claude-codex-sync/artifacts/b14-hotfix6-v11/browser-v11-state-hotspot.json`
- `claude-codex-sync/artifacts/b14-hotfix6-v11/browser-v11-state-hotspot-1440.png`

Visible text leak scan:

- `zh_CN` preview user-visible text fields scanned: 54
- `leakCount=0`

## Verify Status

- `.vercel/project.json` verified before deploy: `projectId=prj_UjubflJkr8XJFUm36cUmoLCl3NrH`, `orgId=team_URED5oO6s2OI5bakH3FJUQpC`, `projectName=claw42-site`
- `npx vitest run src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts`: PASS, 14 tests
- `npm run format:check`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test:watch-pipeline`: PASS, 272 tests
- `npm run verify`: PASS
- `npm run verify:metrics`: PASS, 5 tests
- `npm run verify:a11y`: PASS, 0 axe violations on checked routes
- `npm run build`: PASS after clean standalone run. A previous parallel build with a11y/dev server was invalid because `.next` had concurrent writes.

## First-hand Finding

- Vercel protected preview is accessible via the temporary `_vercel_share` URL or `vercel curl`; ordinary curl still sees Vercel Authentication.
- The direct local `npx vercel` deploy path produced two `UNKNOWN` deployments with no logs. Pushing the feature branch let GitHub-Vercel integration build normally and should be preferred for this project when local deploy hangs.
- The current `zh_CN` live KV only has one hotspot record. The 3-card scroll/expand verification therefore used a controlled browser stream against the real preview shell rather than pretending live KV had three records.

[DOC-HINT: hotfix-6 v1.1 changes only resident refresh target selection and v10 presentation state; it does not change PM pipeline, projection sorting/dedupe, candidate ranking, cron, or production deployment topology.]

# B.15 公共阶段状态机稳定化实施报告

Date: 2026-05-17

## Scope

Dan 验收反馈：行情分析详情里阶段 3 缺失、阶段 4 已出现，且卡片刷新/进度观感仍像跳动。Codex 先做 first-hand 判断后执行：根因不是 v10 layout，而是内部 PM pipeline trace 顺序（`risk_lead` 在 `trade_decision` 前后更新）直接透出到 public payload / v9 adapter，导致公开六阶段仪式被内部执行顺序污染。

本 PR 只修公共阶段显示契约：

- 新增 `src/lib/watch/publicDecisionStageContract.ts`
  - 定义公开顺序：信息收集 → 多空辩论 → 交易方案 → 风险审查 → record/public audit facts。
  - 无可渲染 trade card 时，公开进度最多到阶段 3；内部 `risk_lead` progress/done 只作为“阶段 3 进行中”的信号，不让 UI 跳到阶段 4。
  - `record_write` / `public_timeline` 保留真实 done，作为审计事实，不影响前端可见阶段。
- `src/lib/watch/publicTimelineProjection.ts`
  - PM public payload 出口统一调用公共阶段契约。
- `src/lib/watch/v9TopicAdapter.ts`
  - 删除 adapter-local partial trace 归一化，复用同一公共阶段契约。
- Tests:
  - 新增 `src/lib/watch/__tests__/publicDecisionStageContract.test.ts`
  - 增补 `src/lib/watch/__tests__/publicTimelineProjection.test.ts`
  - `package.json` 将新契约测试加入 `test:watch-pipeline`。

## First-hand Preview Verification

PR: https://github.com/agentxmain-collab/claw42/pull/118

Branch preview:

- Preview: https://claw42-site-git-feature-b15-b01ced-agentxmain-collabs-projects.vercel.app
- Share `/zh_CN/agent`: https://claw42-site-git-feature-b15-b01ced-agentxmain-collabs-projects.vercel.app/zh_CN/agent?_vercel_share=rx6zvUzHN1ilXWthxWC9c8nu33awQAUB

Live preview API check:

- `GET /api/watch/timeline?windowMinutes=720&limit=100&locale=zh_CN`: 200
- Current live record: `candidateType=market_overview`, `recordId=pm:MARKET:1778997450335`
- Stage trace after contract normalization:
  - `analyst_inputs: done`
  - `research_lead: done`
  - `risk_lead: pending`
  - `trade_decision: in_progress`
  - `record_write: done`
  - `public_timeline: done`

This confirms the public API no longer presents risk review as active before a renderable trade plan exists.

## Verify Status

Local gates:

- `npx vitest run src/lib/watch/__tests__/publicDecisionStageContract.test.ts`: PASS, 4 tests
- `npx vitest run src/lib/watch/__tests__/publicTimelineProjection.test.ts src/lib/watch/__tests__/v9TopicAdapter.test.ts src/modules/agent-watch/v9/__tests__/TopicBody.test.tsx`: PASS, 53 tests
- `npx vitest run src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts`: PASS, 15 tests
- `npm run verify`: PASS, includes 48 watch/pipeline test files and 279 tests
- `npm run verify:metrics`: PASS, 5 tests
- `npm run verify:a11y`: PASS, 0 axe violations on checked routes
- `npm run build`: PASS after clean standalone run

Remote PR gates:

- `verify`: PASS
- `deploy preview`: PASS
- `Vercel`: READY

## Notes

- No PM pipeline, candidate selector, refresh, hydration, timeline dedupe/order, or v10 layout changes.
- No production deployment. This is preview/main-line stabilization only.

[DOC-HINT: B.15 centralizes the public decision stage contract; future PM trace consumers should call `publicDecisionStageContract` rather than reconstructing stage order locally.]

# B.16 实时列表稳定化实施报告

Date: 2026-05-17

## Scope

Dan 验收反馈：行情分析卡片会在刷新时消失后再出现，展开/滚动状态也会被新一轮实时更新打断。Codex first-hand 查到两个 UI/data reconciliation 漏点：

- `AgentWatchBoard.tsx` 的 timeline stream / poll 都走 `replace`，如果某次实时 payload 短暂为空，会把已经展示的非空列表替成 empty state。
- `MarketAnalysisPanel.tsx` 的折叠状态、React key、滚动锚点都绑定 `topic.id`。当前 `topic.id = recordId`，同一 candidate 生成新 record 后会被 React 当成新卡片，导致收起/展开和滚动锚点失效。

## Changes

- `src/modules/agent-watch/AgentWatchBoard.tsx`
  - 新增 `reconcileTimelineEventsForDisplay()`。
  - `replace` payload 为空且当前会话已有非空 events 时，保留上一份非空 display snapshot；初始加载仍允许真实 empty state。
  - 空 replace 不清空已有 evidenceMap，避免卡片文本/引用随空包闪断。
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`
  - 新增 `topicDisplayIdentity()`：优先使用稳定 candidate identity（symbol / candidateType + candidateKey），最后才退回 record id。
  - 折叠 state、React key、scroll anchor 统一使用 display identity，避免同一候选换 record 后 remount。
- Tests:
  - `src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts`
  - `src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx`

## Verify Status

Local gates:

- Red test observed first: missing `reconcileTimelineEventsForDisplay` / `topicDisplayIdentity` caused the new tests to fail.
- `npx vitest run src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts src/modules/agent-watch/v10/__tests__/MarketAnalysisPanel.test.tsx`: PASS, 17 tests
- `npm run verify`: PASS
- `npm run verify:metrics`: PASS, 5 tests
- `npm run verify:a11y`: PASS, 0 axe violations on checked routes
- `npm run build`: PASS after clean standalone run. One earlier build attempt was invalid because it ran in parallel with the a11y dev server and both wrote `.next`.

## Notes

- No PM pipeline, candidate selector, refresh endpoint, timeline projection, Vercel cron, visual layout, or production deployment changes.
- This patch intentionally does not resurrect demo data. If first load truly has no public records, the empty state remains.

[DOC-HINT: B.16 stabilizes realtime list reconciliation by preserving the last non-empty display snapshot during transient empty replaces and by using candidate-level UI identity for v10 topic state.]

# B.17 真分析链路可靠性实施报告

Date: 2026-05-17

## Scope

Dan 要求 B17-B20 顺序推进。Codex 先按 B17 查当前 main preview 的真分析链路，不直接假设“没有真分析”。

First-hand 结果：

- main HEAD `87f56ad78874befddc84c5e750bb874e0aba0265` 的 preview `/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720&limit=20` 已返回真实 `pm_decision` records。
- 当前 visible records 包含 `market_overview` 与 `hotspot`，且 payload 有真实 `rationaleByMember` / `rounds` / `stageTrace`，不是 demo fallback。
- 真断点在下一步 symbol 分析：`AgentWatchBoard.resolveVisibleSessionRefreshTarget()` 在已有大盘 + 热点、但没有 symbol card 时返回 `null`；同时 `/api/watch/refresh` 只接受指定 `symbol` 或 resident candidate，`candidateType=symbol` 无 symbol 会返回 400。因此工作台会停在大盘/热点，不会继续让后端自动选优先级币种。

## Changes

- `src/modules/agent-watch/AgentWatchBoard.tsx`
  - 当大盘和热点都存在但没有 symbol card 时，visible-session refresh 改为请求 `candidateType=symbol`。
  - 这个请求不硬编码 BTC；只要求服务端选择优先级币种。
- `src/app/api/watch/refresh/route.ts`
  - 新增 server-selected priority symbol refresh：`POST /api/watch/refresh?candidateType=symbol&locale=...`。
  - 复用现有 `selectPmDecisionTopics()` / `triggerPmDecisionPipelineOnce()` 的 symbol 选择与 cost cap，不改候选排序。
  - freshness 判断改为“是否已有任意真实 symbol 决策在 15 分钟内”，不会把 `MARKET` / `HOTSPOT` resident record 当成 symbol freshness。
- Tests:
  - `src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts`
  - `src/app/api/watch/refresh/route.test.ts`

## Verify So Far

- Red test observed first:
  - visible-session target returned `null` for market+hotspot/no-symbol.
  - refresh API returned `400` for `candidateType=symbol` with no explicit symbol.
- Green after implementation:
  - `npx vitest run src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts`: PASS, 7 tests
  - `npx vitest run src/app/api/watch/refresh/route.test.ts`: PASS, 8 tests
  - `npx tsc --noEmit --pretty false`: PASS

## First-Hand Judgement

B17 不应该回滚到 demo，也不该在前端写死 BTC。当前正确修复是补上“用户访问后服务端自动选 symbol”的缺口，让 B14 的大盘/热点 resident cards 后面能继续自然长出优先级币种分析。该改动不触碰 PM pipeline、candidate ranking、timeline projection、V10 layout、prod 或 cron。

[DOC-HINT: B17 closes the resident-to-symbol refresh gap by allowing candidateType=symbol without a client-chosen symbol; future work should keep client display identity separate from server topic selection.]

# B.18 决策公开摘要质量实施报告

Date: 2026-05-17

## Scope

Dan 要求 B17-B20 顺序推进。B18 按“决策质量增强”先查当前 main preview 的真实 public payload，而不是直接改 prompt。

First-hand 结果：

- B17 main preview `/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720&limit=20` 返回真实 `pm_decision`，不是 demo fallback。
- 当前 `market_overview` payload 的 `analysisSummary` 是 PM 长墙文，重复拼接 research/risk 段，公开 payload 和后续 UI 入口都过长。
- V9 adapter 对 analysis-only resident card 的 `explanation` 优先拿第一条 evidence summary；当前第一条 evidence 是 “OpenAI partners with Malta...”，会把无关新闻放到“今日大盘综述”卡片解释里。

## Changes

- `src/lib/watch/publicContentGuardrails.ts`
  - 新增 `cleanPublicAnalysisSummary()`。
  - 去掉重复标题前缀（如 `今日大盘综述:` / `热点叙事追踪:` / `{SYMBOL} 实时行情分析:`）。
  - 对公开摘要做首句优先 + 120 字上限兜底，避免 PM wall text 进入公开卡片。
- `src/lib/watch/publicTimelineProjection.ts`
  - PM public payload 出口统一清洗 `analysisSummary`。
  - 对 stream projection 与 direct record projection 同时生效。
- `src/lib/watch/v9TopicAdapter.ts`
  - analysis-only records 优先用 cleaned `analysisSummary` 作为 topic explanation / trigger text。
  - 避免无关 evidence summary 抢占 resident card 的公开解释。
- Tests:
  - `src/lib/watch/__tests__/publicTimelineProjection.test.ts`
  - `src/lib/watch/__tests__/v9TopicAdapter.test.ts`

## Verify Status

- Red test observed first:
  - public projection 原样发布 PM wall text。
  - v9 adapter 对 analysis-only record 使用 unrelated evidence summary。
- `npx vitest run src/lib/watch/__tests__/publicTimelineProjection.test.ts src/lib/watch/__tests__/v9TopicAdapter.test.ts`: PASS, 54 tests
- `npm run verify`: PASS
- `npm run verify:metrics`: PASS, 5 tests
- `npm run verify:a11y`: PASS, 0 axe violations on checked routes
- `npm run build`: PASS

## Notes

- 没动 PM pipeline / evidenceDispatcher / prompt / candidate ranking / refresh / hydration / V10 layout / prod。
- 这是 public projection + adapter quality patch：先把真实分析公开出口变干净、短、相关，再继续 B19 memory loop。

[DOC-HINT: B18 routes analysis-only cards through concise cleaned `analysisSummary`; future prompt work can improve source text, but public projection should continue enforcing a short user-facing summary boundary.]

# B.19 Memory loop 真学习实施报告

Date: 2026-05-17

## Scope

B19 按“Memory loop 真学习”处理 B18 preview 暴露出的 memory_loop 公开输出问题。先查真 payload：VVV symbol record 已是真 PM record，但 memory_loop 输出了“历史决策库中无 VVV 的过往记录 / 样本量为零 / 初始记忆种子”这类后台状态文案。

## Root Cause

- `src/lib/team/memoryLoopEvidence.ts` 把 unresolved open records 也纳入 memory context；这会让当前未闭环决策被当作“学习样本”。
- `src/lib/team/evidenceDispatcher.ts` 对 `no_history` / `kv_unavailable` 仍生成 `memory` evidence item，导致 memory_loop 角色有机会把“无历史样本”写进公开 rationale。
- `docs/agent-ip/team/memory_loop.md` 仍允许“no historical baseline 时写当前决策应 seed 什么”，与 hotfix-5 的公开输出纪律冲突。
- `src/lib/watch/publicContentGuardrails.ts` 之前没有覆盖 legacy memory no-history 变体，例如“历史决策库中无 / 样本量为零”。

## Changes

- `src/lib/team/memoryLoopEvidence.ts`
  - 只用 `resolvedAt + resolvedOutcome` 都存在的 resolved records 作为 memory learning samples。
  - unresolved open record 不再算历史样本；返回 `no_history`。
  - no-history prompt 改成内部 abstain 指令：不要从未闭环 case seed 公开 memory note。
- `src/lib/team/evidenceDispatcher.ts`
  - memory context 为 `no_history` / `kv_unavailable` / `historicalCount=0` 时不生成 public memory evidence item。
  - memory_loop mandate 改为只在 resolved samples 存在时发声，否则 silent abstain。
- `docs/agent-ip/team/memory_loop.md`
  - 去掉“无历史时 seed 当前决策”的公开输出路径。
- `src/lib/watch/publicContentGuardrails.ts`
  - 增加 legacy memory no-history / zero-sample 中英禁词兜底。
- Tests:
  - `src/lib/team/__tests__/memoryLoopEvidence.test.ts`
  - `src/lib/team/__tests__/evidenceDispatcher.test.ts`
  - `src/lib/watch/__tests__/publicTimelineProjection.test.ts`

## Verify Status

- Red tests observed first:
  - unresolved open record 被记入 `historicalCount=1`。
  - memory_loop no-history 仍出现 `### memory evidence`。
  - public projection 没过滤“历史决策库中无 / 样本量为零”。
- `npx vitest run src/lib/team/__tests__/memoryLoopEvidence.test.ts src/lib/team/__tests__/evidenceDispatcher.test.ts src/lib/watch/__tests__/publicTimelineProjection.test.ts`: PASS, 34 tests
- `npm run verify`: PASS, 286 watch/pipeline tests included
- `npm run verify:metrics`: PASS, 5 tests
- `npm run build`: PASS
- `npm run verify:a11y`: PASS, 0 axe violations on checked routes

## Notes

- 没动 PM pipeline / candidate ranking / refresh / hydration / V10 layout / prod。
- B19 让 memory_loop 只基于已闭环历史产生公开价值；没有 resolved memory 时不发声，避免“无历史 / 样本量为零 / 等待数据”再次进入公开卡片。

[DOC-HINT: B19 treats memory_loop as resolved-history-only public learning; unresolved current records must not seed public memory rationale.]

# B.20 CoinW 执行前安全检查实施报告

Date: 2026-05-17

## Scope

B20 不接真实 CoinW 下单；按执行前检查先收紧边界，确保当前工作台只保留“演示/统计”行为，不让 market_overview / hotspot / watch-only symbol 走到任何跟单执行入口。

First-hand 结果：

- 当前代码没有真实 CoinW order / trade API route；`/api/watch/follow-stats` 只记录匿名 watch/follow 统计。
- V10 已要求 `candidateType === "symbol" && execution.executable === true` 才展示 primary follow 按钮，但按钮仍是 disabled 演示模式。
- V9 `TopicStrategy` 原本只看 `watchOnly`，没有显式要求 `candidateType === "symbol"`；`AgentWatchBoard.handleTopicAction()` 原本也只看 `execution.executable`，没有显式拒绝 non-symbol topic。
- 当前还缺真实执行的 hard prerequisites：CoinW OAuth / scope、server-only CoinW trading adapter、sandbox、order receipt store、clientOrderId reconciliation、kill switch、合规确认。

## Changes

- `src/modules/agent-watch/v9/TopicStrategy.tsx`
  - primary follow 按钮改为只在 symbol candidate 且没有 watch-only / non-executable metadata 时渲染；legacy fixture 仍只显示 disabled 演示按钮。
  - non-symbol topic 即使 payload 错标 `executable=true`，也只显示 watch-only / 不可跟单。
- `src/modules/agent-watch/AgentWatchBoard.tsx`
  - primary action handler 增加 non-symbol 拒绝条件，防止程序化调用绕过 UI。
- `src/lib/watch/v9TopicAdapter.ts`
  - adapter 层把 non-symbol topic 强制视为 non-executable，避免 market_overview / hotspot 继承错误 payload executable。
- `scripts/verify-execution-safety.mjs`
  - 新增执行安全机器检查：校验 v9/v10 follow gate、客户端只写 `/api/watch/follow-stats`、不存在 CoinW/order/trade execution API route、架构/需求文档仍在。
- `package.json`
  - 新增 `npm run verify:execution-safety` 并纳入 `npm run verify`。
- Tests:
  - `src/modules/agent-watch/__tests__/followTradeDisabled.test.tsx`
  - `src/lib/watch/__tests__/v9TopicAdapter.test.ts`

## Verify Status

- Red test observed first:
  - v9 strategy / adapter 没有强制 non-symbol follow gate。
- `npx vitest run src/modules/agent-watch/__tests__/followTradeDisabled.test.tsx src/lib/watch/__tests__/v9TopicAdapter.test.ts`: PASS, 35 tests
- `npm run verify:execution-safety`: PASS
- `npm run verify`: PASS, now includes execution-safety gate
- `npm run verify:metrics`: PASS, 5 tests
- `npm run build`: PASS
- `npm run verify:a11y`: PASS, 0 axe violations on checked routes

## Readiness Judgement

当前只能进入“执行前安全准备”状态，不能进入真实 CoinW execution。下一阶段若要真接，必须先单独 spec 处理 OAuth 授权、CoinW adapter、订单回执、对账、sandbox、kill switch 和合规审批；本阶段只确保 public preview 不会误给用户真实跟单能力。

[DOC-HINT: B20 adds a machine execution-safety gate; real CoinW execution remains blocked until OAuth, adapter, receipts, reconciliation, sandbox, kill switch, and compliance are implemented in a separate approved spec.]

# B.21 Memory learning 跨标的闭环样本实施报告

Date: 2026-05-17

## Scope

Dan 要求先补剩余 1/2/4。B21 对应“真正的 Memory learning”：保留 B19 的安全边界（未闭环不发声），但让 memory loop 在当前 symbol 没有已闭环样本时，可以读取全局已闭环决策作为“跨标的形态记忆”。

## First-hand 判断

- B19 后 `fetchMemoryContext()` 只读当前 symbol 的 records；VVV 等新 symbol 没有 resolved history 时，memory_loop 会直接 no-history abstain。
- `decisionRecordStore.readAllDecisionRecords()` 已存在，可以按 locale 读取全局 strategy records，不需要新建 history wall key 或猜 KV key。
- 安全边界必须保留：legacy record / unresolved open record 不能进入 memory learning；跨标的样本只能作为弱 pattern memory，不能当成当前 symbol 的证明。

## Changes

- `src/lib/team/memoryLoopEvidence.ts`
  - `MemoryContext` 增加 `symbolHistoricalCount` / `crossSymbolHistoricalCount` / setup `relation`。
  - 当前 symbol 已闭环样本少于阈值时，从 `readAllDecisionRecords()` 补跨标的已闭环样本。
  - Prompt 增加 current-symbol samples、cross-symbol samples、cross-symbol resolved lessons 警示。
- `src/lib/team/evidenceDispatcher.ts`
  - timeout fallback 补齐新增 memory context 字段。
- `docs/agent-ip/team/memory_loop.md`
  - 明确 current-symbol 是直接记忆，cross-symbol 是更弱的形态记忆，不能当同 symbol 证明。
- Tests:
  - `src/lib/team/__tests__/memoryLoopEvidence.test.ts`
  - 新增跨 symbol resolved 样本可用、unresolved / legacy 不可用的覆盖。

## Verify Status

- Red test observed first:
  - 当前 symbol 无 closed history 时，cross-symbol resolved record 没被使用，仍返回 `error=no_history`。
- `npx vitest run src/lib/team/__tests__/memoryLoopEvidence.test.ts`: PASS, 6 tests
- `npx vitest run src/lib/team/__tests__/memoryLoopEvidence.test.ts src/lib/team/__tests__/evidenceDispatcher.test.ts`: PASS, 11 tests
- `npm run verify`: PASS, 291 watch/pipeline tests included
- `npm run verify:metrics`: PASS, 5 tests
- `npm run build`: PASS
- `npm run verify:a11y`: PASS, 0 axe violations on checked routes

## Notes

- 没动 PM pipeline / candidate ranking / refresh / hydration / V10 layout / prod。
- 这一步让 memory_loop 能开始复用跨标的已闭环经验，但仍不会从未 resolved 的当前 case 中“自学”或输出后台状态。

[DOC-HINT: B21 expands memory_loop from same-symbol-only history to resolved cross-symbol pattern memory while preserving the unresolved-record abstain boundary.]
