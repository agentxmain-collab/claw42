# Claw42 历史后端资产盘点

> 盘点时间：2026-05-13
>
> 盘点基线：`feature/watch-real-topic-content` at `2617294`
>
> 目标：在清理历史分支前，确认哪些后端资产已经进入当前 V9 基线，哪些还值得抽取，哪些应该只归档不再合并。

## 结论

历史分支里确实有后端资产，但大部分关键资产已经通过 PR 进入当前基线。后续不要再整体 merge 老分支，应该按模块抽取。

当前值得继续推进的只有三类：

1. CoinW PATH/basePath 支持：来自本地 `/tmp/claw42-basepath` dirty worktree，需要整理成干净 commit。
2. Topic selection/ranking 增强：当前已有 `src/lib/topicGenerator.ts`，但仍偏简单，缺少“为什么选择这个 topic”的公开解释和多因子排序。
3. Stage/focus detector 思路：来自 `origin/feature/act1-5-watch-stage-mode-01` 的 `focusEventDetector.ts` / `agentViewGenerator.ts`，只能抽算法思想，不能照搬 UI/agent 命名。

## 当前已在 V9 基线中的资产

| 资产                          | 当前路径                                                                                          | 来源线索                                                                                        | 处理                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 多源新闻链路                  | `src/lib/news/sourceChain.ts`, `src/lib/news/sourceRegistry.ts`, `src/lib/news/adapters/*`        | task-17 / task-18 后已进入当前基线；与 `origin/feature/news-source-multi-chain-01` 关键文件一致 | 保留当前实现，不从历史分支覆盖                 |
| News verify gate              | `scripts/verify-news.mjs`                                                                         | task-17 后进入当前基线                                                                          | 保留                                           |
| Chat orchestration            | `src/lib/chatOrchestrator.ts`, `src/lib/chatHistoryStore.ts`, `src/app/api/watch/stream/route.ts` | task-18 后进入当前基线                                                                          | 保留；如果要做阶段流式写入，应基于当前实现改造 |
| Daily brief                   | `src/app/api/daily-brief/route.ts`, `src/lib/dailyBrief.ts`                                       | task-13 后进入当前基线                                                                          | 保留；暂不纳入 V9 主线                         |
| Watch decision pipeline       | `src/lib/team/*`, `src/lib/watch/*`, `src/app/api/watch/timeline/route.ts`                        | PR #71-#81                                                                                      | 保留；这是 V9 真实 pipeline 的当前权威实现     |
| LLM/provider/storage 基础设施 | `src/lib/llm/*`, `src/lib/storage/*`, `src/lib/signal-engine/*`                                   | v2 backend PR #34-#53                                                                           | 保留；历史分支里的旧版本不能覆盖               |

## 候选抽取资产

### 1. CoinW PATH/basePath 支持

来源：

- 本地 worktree：`/tmp/claw42-basepath`
- 分支：`feature/coinw-claw42-basepath`
- 状态：dirty，未形成可追溯 commit

关键文件：

- `src/lib/basePath.ts`
- `src/app/page.tsx`
- `next.config.mjs`
- `src/app/layout.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/manifest.ts`
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/components/SiteHeader.tsx`
- `src/components/LocaleDropdown.tsx`
- watch/API/image/link 调用点

推荐动作：

1. 基于当前 V9 分支手工移植。
2. 保留当前 V9 的 header active state 和页面布局。
3. 只增加 basePath-aware URL 处理。
4. 同时验证两种模式：
   - root mode：`claw42.ai`
   - path mode：`NEXT_PUBLIC_BASE_PATH=/claw42`, `NEXT_PUBLIC_SITE_URL=https://ai.coinw.com/claw42`

不要直接 merge `/tmp/claw42-basepath`，因为它与当前 `SiteHeader.tsx` 有冲突，也包含一些与 V9 定版无关的页面/字体改动。

### 2. Topic selection/ranking 增强

当前状态：

- 当前基线已有 `src/lib/topicGenerator.ts`。
- 它能从 signal / top mover / majors fallback 生成内部 topic。
- 但仍存在产品层缺口：排序因子太少、解释不足、source 文案仍偏内部化。

可复用资产：

- `src/lib/news/sourceChain.ts`
- `src/lib/news/sourceRegistry.ts`
- `src/lib/news/newsEvidence.ts`
- `src/lib/news/newsEvidenceStore.ts`
- `src/lib/watch/topicAggregator.ts`
- `src/lib/topicGenerator.ts`

推荐动作：

新增一个小而独立的 selector/ranker，而不是替换现有 generator：

- 输入：CoinW coin pool、market signals、news evidence、recent public timeline。
- 输出：selected symbol/topic、score breakdown、public explanation、evidence ids。
- 接入点：PM decision trigger 前，或 `topicGenerator.ts` 内部拆分。
- 测试重点：有新闻、有强行情、无新闻、冷却时间、重复 topic、fallback。

这一步符合既定约束：“改内容/数据，不改 V9 板式”。

### 3. Stage/focus detector 思路

来源分支：

- `origin/feature/act1-5-watch-stage-mode-01`

候选文件：

- `src/lib/focusEventDetector.ts`
- `src/lib/agentViewGenerator.ts`

判断：

- 这两个文件不在当前 V9 基线里。
- 代码依赖旧的 `alpha/beta/gamma` agent、旧 `AgentCardView`、旧 stage UI 类型。
- 不适合直接复制。

可复用思路：

- 多个 symbol 同时出现同类 signal -> collective event。
- major symbol + alert signal -> high severity event。
- 多个 agent 对同一 symbol 给出相反方向 -> conflict event。
- signal type -> primary analyst 的路由思想。

推荐动作：

等 topic ranking 做完后，只抽规则思想，重新写成 V9/Phase B schema 下的 `topicFocus` 或 `stageState` helper。不要引回旧 UI 类型。

## 不建议抽取的资产

| 分支/资产                                      | 原因                                   |
| ---------------------------------------------- | -------------------------------------- |
| `origin/codex/dispatch-console-handoff`        | 已被 v3.7/v9 重做替代                  |
| 老 `AgentWatchBoard` / stage UI / chat UI      | 会破坏当前 V9 定版板式                 |
| `origin/feature/news-debate-mode-01` UI 层     | 已过时，且叙事结构与当前公开 V9 不一致 |
| `origin/preview/watch-chat-immersive-01` UI 层 | 只保留后端/guardrail 经验，不合 UI     |
| old faction/persona copy                       | 与当前职能名称体系冲突                 |
| 历史 docs/review branches                      | 作为归档证据保留，不作为代码来源       |

## 推荐实施顺序

1. 先固化 CoinW PATH/basePath 支持，让 `main` 具备正式环境 + CoinW path 双模式能力。
2. 将 `feature/watch-real-topic-content` rebase/merge 到带 basePath 的基线上。
3. 新建 topic selector/ranker 小补丁，增强真实 topic 选择解释。
4. 再评估 stage/focus detector 思路是否值得重写进 V9 schema。
5. 最后清理历史分支和老 PR。

## 清理前保留规则

任何历史分支删除前，必须满足至少一个条件：

- 已 merged into `origin/main`。
- 对应资产已经在本文档中标记为“当前已在 V9 基线中”。
- 已导出 patch/bundle 归档。
- 已明确标记为“不建议抽取”。

不要删除：

- `origin/main`
- `origin/feature/watch-real-topic-content`
- 当前整理分支，直到本文档被合并或另行归档
