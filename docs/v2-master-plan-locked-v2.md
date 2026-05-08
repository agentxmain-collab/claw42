# claw42 v2.0 Master Plan — Locked v2

> **Status**: LOCKED-v2 — Codex 副审 6/6 patch 应用完毕，可进入 task-level 实施
> **Replaces**: `v2-master-plan.md` (locked-v1) — v1 保留作历史 reference
> **Companion**: `codex-specs/v2-master-plan-codex-review.md`（Codex 副审，GO after patch 判断来源）
> **Date**: 2026-05-07

---

## § 0. v1 → v2 变更摘要

| 类别          | 变更                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| 事实修正      | 5 个（Codex 找到，Session C 接受全部）                                                                            |
| 必做 patch    | 6 个（Codex § 6 全部应用）                                                                                        |
| Task 拆分     | 29 主 task → 约 42 subtask（Q-Patch-1 全接受）                                                                    |
| 新增维度      | 第六维（Codex 实施现实）                                                                                          |
| 依赖政策      | Dan 授权 v2.0 项目级豁免，6 包一次性接受（Q-Patch-4 C）                                                           |
| Backfill 处置 | 不进 v2.0 K 线 UI（Q-Patch-3 A），仅作内部分析                                                                    |
| A1 状态       | 占位 URL `https://www.coinw.com/zh_CN/register?r=XXCryptoEN`（Q-Patch-2），实施 No-GO 直到 CoinW 给真版 trade URL |

---

## § 1. Frame / Segments / Metrics（沿用 v1 LOCKED）

**Frame**: claw42 + Hot Pursuit = CoinW 交易转化漏斗
**Core user job**: 来 → 决策 → 去 CoinW 下单
**Core metric**: CoinW 交易转化率（CoinW 后台给数）

**3 segments**: 跟单者 60% / 学习者 25% / 观察者 15%

**4 success metrics**: Agent 累计胜率 > 50%（≥30 次后） / Watch → CoinW 转化率 ≥ 5% / 分享带回 > 月新增 10% / 14 天复盘节奏

**6 锁定决策**: Q1 in-memory + KV / Q2 三件套 / Q3 胜率真实 / Q4 用户分享 / Q5 彻底废弃 llmFallbackChain / Q6 不闭环数据

---

## § 2. Codex 找到的 5 个事实修正

| #   | v1 错的                      | 真实                                                                                                        | 修正动作                                                                                             |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | chatHistoryStore 在 main     | 只在 `feature/watch-chat-immersive-01`                                                                      | T24.1 backfill 数据源依赖 task-18 PR 状态：先合 main，再做 backfill                                  |
| 2   | "5 个 batch" wording         | v1 § 4 / § 9 实际写了 7 个                                                                                  | Batch 6 ops-doc 改"living workstream"贯穿全程；正式 batch = 5（Batch 0-5）                           |
| 3   | Next 14 / React 18 = HP 兼容 | HP 是 Next 15 / React 19                                                                                    | T1 内化时不升级 Next/React，仅 polyfill HP 用到的 React 19 API（如有）；如不兼容则砍掉对应能力或重写 |
| 4   | JSONL = 可观测性             | Vercel serverless 多 instance 下 JSONL 不持久（每 instance 独立写、重启即丢）                               | T32 改为 KV-based metrics + Vercel log drain（如有 Datadog/Logflare）；JSONL 仅作本地/preview 兜底   |
| 5   | T2 = "换 provider"           | HP providers 只输出结构化 JSON，不是 generic text generator；watch + news + translation 用的是 generic text | T2 拆分新增 **T2b: `generateText` adapter**，作为 chat/news/translation 的统一桥梁                   |

---

## § 3. 第六维：Codex 实施现实（新增）

原五维（计算时序 / 同类竞争 / 跨层碰撞 / 修饰叠加 / 人类认知）外补第六维。

**第六维：Codex 实施现实** — 把方案放进真实 Codex 实施流程里看哪步炸。

**检查清单**：

1. **Branch truth**：每个 task 引用的代码现在在哪个分支？main / feature 还是混合？
2. **Dependency policy**：新加的包是否走 `dependency-policy.md` SCA 流程？level A repo 必须走
3. **版本 drift**：source repo 和 target repo 的 Next/React/TS 版本差异是否破坏 import？
4. **Merge topology**：base branch 是否干净？rebase 还是 merge？多 PR 合并顺序？
5. **实际编译**：spec 描述的"copy 5 个文件夹"是否真能编译——依赖链是否齐全？
6. **Provider surface**：source 提供的 API 形态是否真覆盖 target 需要的所有调用模式？

**典型失败案例**（本次撞到的）：master plan v1 假设 `chatHistoryStore` 在 main，实际在 feature 分支 → T24.1 数据源前提崩。

**已知风险（标记不解）**：

- 任何 cross-repo task 都先做 branch truth audit（grep + git log）再写 task spec
- 任何新依赖先过 dependency-policy（除 Q-Patch-4 已豁免的 6 包）
- 任何"参考 X repo 的 Y 实现"先看版本号

---

## § 4. 重新拆分的 Task List（约 42 subtask，5 batch + ops workstream）

### Batch 0：HP 归档 + 工程基础（无依赖，立即并发）

| ID  | 内容                                                     |
| --- | -------------------------------------------------------- |
| T36 | Hot Pursuit README 加归档 banner                         |
| T37 | v1.4 Batch 1 worktree 标终止                             |
| T28 | Web Vitals 上报（CLS/LCP/FCP/TTFB/INP）                  |
| T29 | a11y WCAG AA + axe-core verify + ar_SA RTL 测试          |
| T31 | Error Boundary + 全局错误埋点                            |
| T32 | metrics: KV-based + Vercel log drain（JSONL 仅本地兜底） |

### Batch 1A：基础底座（依赖 Batch 0，可与 Batch 1B 并发）

| ID                 | 内容                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- |
| T1-core            | SignalEngine + data-sources + types compile in claw42（按 Codex § 2 文件清单内化） |
| T1-observability   | metric sink + JSONL 本地兜底 + KV 持久注释                                         |
| T1-auth-projection | 仅当后端 view projection 路由开放时启用（v2.0 默认不启用）                         |
| T4-core            | SignalEngine 测试覆盖（vitest）                                                    |

### Batch 1B：KV 抽象（依赖 Batch 0，可与 Batch 1A 并发）

| ID   | 内容                                 |
| ---- | ------------------------------------ |
| T1.1 | KV lock 抽象（SETNX with TTL）+ 测试 |
| T1.2 | KV rate-limiter / quota store + 测试 |

### Batch 2：LLM 抽象统一（依赖 Batch 1A）

| ID  | 内容                                                                             |
| --- | -------------------------------------------------------------------------------- |
| T2a | provider config + shared provider interface（基于 HP `signal-engine/providers`） |
| T2b | **generic `generateText` adapter**（chat/news/translation 桥梁，关键新增）       |
| T2c | structured signal provider integration                                           |
| T2d | migrate import sites + delete `llmFallbackChain.ts`（main 2 处 + feature 6 处）  |
| T3  | /api/agents/analysis 改造调 SignalEngine 做 grounding                            |

### Batch 3：Agent 历史预测系统（依赖 Batch 2）

| ID     | 内容                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T24.2  | **prediction schema first**（prompt_version + data_source_snapshot + model_version 全字段）                                                              |
| T24    | live prediction recorder（每次 agents/analysis 后 hook 写 KV+log drain）                                                                                 |
| T25    | 真实胜率计算（按 prompt_version 分桶）                                                                                                                   |
| T24.1a | backfill **dry-run audit**（用 feature 分支 chatHistoryStore，输出 confidence report，**不写**）                                                         |
| T24.1b | 高置信度导入（仅 strategy-level，标 `record_source=backfill` + `backfill_confidence` + `derived_from_thread_id`）—— **不进 v2.0 UI 展示**（Q-Patch-3 A） |

### Batch 4：UI 升级（依赖 Batch 3）

| ID         | 内容                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| task-18-v2 | 接 SignalEngine grounding（保留派别人设 + 11 ChatActions + chatOrchestrator）+ UI 暴露 evidence panel                          |
| T5         | TopicHeader 显示 MajorEvent                                                                                                    |
| T9         | MessageStream 加证据展开 + 重新分析                                                                                            |
| T13a       | K-line shell + 数据 loader（lightweight-charts 接入）                                                                          |
| T13b       | prediction marker model（仅展示真实新预测，backfill 不展示）                                                                   |
| T13c       | tooltip + detail panel + mobile + RTL 处理                                                                                     |
| T13d       | chart a11y + screenshot/browser verification                                                                                   |
| T26a       | performance query layer                                                                                                        |
| T26b       | Agent 主页 UI                                                                                                                  |
| T26.1      | multi-dimension performance display + sample-size + disclaimer                                                                 |
| A1a        | affiliate URL builder（实施 No-GO 直到 CoinW 给真 trade URL；占位 URL 用 `https://www.coinw.com/zh_CN/register?r=XXCryptoEN`） |
| A1b        | redirect endpoint + click metric                                                                                               |
| A1c        | health check（accept 2xx/3xx，不 spam trading URL）                                                                            |
| A1d        | CTA wiring（每个 SignalCard / strategy 卡 / Agent 主页接 redirect endpoint）                                                   |
| A1.1       | segment entry points UX design（3 segment 入口设计）                                                                           |

### Batch 5：分流 + 病毒（依赖 Batch 4）

| ID       | 内容                                                      |
| -------- | --------------------------------------------------------- |
| T22      | 主页三入口分流（按 segment 不是 persona）                 |
| T21      | Today Brief 卡（60 字 LLM 简报，走 T2b generateText）     |
| T17-简化 | /alpha 用户分享卡片（带 referral）                        |
| T20-简化 | Web Share API + clipboard fallback + referral query param |

### Ops workstream（贯穿全程，每 batch 完成后 update）

| ID      | 内容                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------- |
| ops-doc | operational dashboard + 决策树（胜率 < 50% 怎么办 / 转化率 < 5% 怎么办 / 分享率 < 10% 怎么办） |

---

### Subtask 总数核对

| Batch    | Subtask 数     |
| -------- | -------------- |
| Batch 0  | 6              |
| Batch 1A | 4              |
| Batch 1B | 2              |
| Batch 2  | 5              |
| Batch 3  | 5              |
| Batch 4  | 14             |
| Batch 5  | 4              |
| Ops      | 1（贯穿）      |
| **合计** | **41 subtask** |

---

## § 5. 依赖政策处理（Q-Patch-4 C）

**Dan 授权 v2.0 项目级豁免**：以下 6 包不走单独 [DEPENDENCY-CHANGE-REQUEST]，作 v2.0 一揽子接受。

| 包                          | 用途                                 | 引入 task              |
| --------------------------- | ------------------------------------ | ---------------------- |
| `lightweight-charts@^5.2.0` | K 线图                               | T13a                   |
| `@vercel/kv`                | KV cache + lock + rate-limit         | T1.1 / T1.2 / T32      |
| `web-vitals`                | Web Vitals 上报                      | T28                    |
| `axe-core`                  | a11y 自动验证                        | T29                    |
| `vitest`                    | 单测框架（dev）                      | T4-core                |
| `playwright`（dev）         | E2E（v3+ 启用，v2.0 安装但不强制跑） | T29 / T30（推迟到 v3） |

**v2.0 范围内新增的其他包**仍走标准 dependency-policy SCA 流程。

**v2.x 后**回到标准流程（豁免仅限 v2.0 第一期）。

---

## § 6. v2.0 不做的事（永久限制 + 范围外）

### 永久限制（Codex 副审标记，机制就位前 No-GO）

| 项                               | No-GO 条件                              | 解锁条件                                               |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| A1 真实 affiliate URL 切换       | CoinW 没给确认的 trade URL template     | CoinW 内部确认完整模板（含 symbol/side/leverage 参数） |
| 官方 backfilled win-rate 进 K 线 | backfill 置信度 + provenance 机制未就位 | T24.1a audit 报告 + Dan 决策展示规则                   |

### 范围外（v2.0 永久不做）

| 项                                        | 理由                                               |
| ----------------------------------------- | -------------------------------------------------- |
| /signals 信号库 dashboard                 | 学习者走 /signals/[symbol] 即可                    |
| /signals/[id] 单信号详情                  | 通过 evidence panel 展示                           |
| /docs 公开 API UI                         | 无外部用户 + 无法务背书；后端 view projection 预留 |
| /alpha KOL Canvas + LLM Caption           | Q4 简化为用户分享卡片                              |
| anchor-integration-pack                   | v3+                                                |
| 30s 主题轮播                              | chatOrchestrator 已有 cooldown + breaking_news     |
| cross-agent diversity check（cosine 70%） | 派别人设 + 11 ChatActions 自然区分                 |
| Agent 学习史 v2.1 mock 数据               | Q3 真实数据；T24.1 backfill 不进 UI                |
| 完整 PostHog 转化埋点                     | Q6 CoinW 后台给数                                  |
| OpenAPI auto SDK                          | 无外部 SDK 用户                                    |
| vector.dev → Prometheus + Grafana         | v3+                                                |

---

## § 7. v2.0 评审节奏（修正：Day 0-30 K 线"裸"是预期，不是 bug）

| 时间点 | 评审内容                                            | Day 0-30 预期                                                            |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Day 0  | 烟雾测试：watch + /signals/[symbol] + affiliate URL | K 线无 Agent 战绩点（**预期，因 Q-Patch-3 A**）                          |
| Day 14 | 第 1 次复盘                                         | Agent 真实预测累计 ~14 天，胜率初步数据但样本不足                        |
| Day 30 | 第 2 次复盘                                         | ≥ 30 次预测达统计意义，K 线开始有 Agent 战绩点；多 instance 数据竞争实证 |
| Day 60 | 第 3 次复盘                                         | affiliate 数据回流（CoinW 后台手动看）+ 用户分享带回率                   |
| Day 90 | 季度复盘                                            | Agent prompt 调优后胜率提升曲线 + v3.0 启动决策                          |

---

## § 8. Codex 第二次派发指令

### 8.1 阅读顺序

1. **本文档（v2-master-plan-locked-v2.md）** — 主决策来源
2. `v2-master-plan.md`（v1） — 历史 reference，冲突时以 v2 为准
3. `codex-specs/v2-master-plan-codex-review.md` — Codex 副审，已整合到 v2
4. claw42 现有代码 + Hotpursuit 现有代码

### 8.2 实施约束

| 约束                               | 说明                                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **A1 实施 No-GO**                  | A1a-A1d 写代码可以，但 affiliate URL 用占位 `https://www.coinw.com/zh_CN/register?r=XXCryptoEN`。Dan 拿到 CoinW 真版 trade URL 后再切换 |
| **官方 backfilled win-rate No-GO** | T24.1a audit dry-run 必跑 + 报告输出；T24.1b 仅写 backfill 数据带标签，**不进 K 线 UI 展示**                                            |
| **Branch reality**                 | 每个 task 实施前先 audit 引用代码在哪个分支（main / feature）                                                                           |
| **Dependency policy**              | § 5 列的 6 包直接用，其他新包走 dependency-policy.md                                                                                    |
| **task-18 PR #27**                 | 验收后合 main → Batch 4 task-18-v2 从 main 拉新分支（不基于 feature 分支）                                                              |

### 8.3 派发 prompt（一段，给 Codex）

```
项目：claw42 v2.0 实施
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Reference：/Users/dannybrown/Claude/职业规划/academy/Ai生态项目/Hotpursuit

阅读顺序：
  1. claw42/docs/v2-master-plan-locked-v2.md（主决策，按 § 4 batch 实施）
  2. claw42/docs/v2-master-plan.md（v1 历史 reference）
  3. claw42/docs/codex-specs/v2-master-plan-codex-review.md（你副审）

任务：按 § 4 拆分后的 41 subtask 实施。Batch 0 + Batch 1A + Batch 1B 立即并发，每个 subtask 一个独立 commit + 独立 verify。完成 Batch 5 后整体一个 PR 进 main。

实施约束（不可绕过）：
  - A1 affiliate URL 占位 https://www.coinw.com/zh_CN/register?r=XXCryptoEN，env config 化等 Dan 给真 URL
  - T24.1b backfill 数据带标签写入但 **不进 K 线 UI**
  - Branch reality audit：每个 task 实施前 grep 引用代码确认分支
  - 6 包依赖政策已豁免（lightweight-charts / @vercel/kv / web-vitals / axe-core / vitest / playwright）
  - 不用真名 Mike，用 Dan
  - JSONL 不当生产持久存储，metrics 走 KV + log drain

完成 Batch 0 / Batch 1A / Batch 1B 后停下等审，不要直接进 Batch 2。
```

---

## § 9. 文档元信息

- **创建**：2026-05-07 by Session C
- **基础**：v1（PM brainstorming 90 + 五维碰撞 + Q1-Q6）+ Codex 副审 GO after patch
- **决策版本**：locked-v2
- **冻结清单**：§ 1（Frame/Segments/Metrics）+ § 2（5 事实修正）+ § 5（依赖豁免清单）+ § 6（永久限制）
- **下次允许变更**：(a) Batch 0/1A/1B 实施后发现新事实错误 / (b) CoinW 给真 affiliate URL → 解锁 A1 / (c) v2.0 上线 14 天复盘暴露重大盲区

---
