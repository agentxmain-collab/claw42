# claw42 v2.0 Master Plan

> **状态**：LOCKED — 经 PM brainstorming + content-ops（90/100）+ 五维碰撞（7 子 task 补丁）+ Q1-Q6 拍板
> **替代**：Hot Pursuit 交接包的 37 task 提案（content-ops 评分 72/100，被 Variant A 击败）
> **来源**：2026-05-07 Session C 重新评审产出
> **下一步**：Codex 副审本文档（`docs/codex-specs/v2-master-plan-codex-review.md`），副审通过后展开 task-level detailed spec

---

## § 0. 锁定决策清单

### 0.1 Frame 决策

**v2.0 frame**：claw42 + Hot Pursuit 合并后 = **CoinW 的交易转化漏斗**。

```
[流量入口] → [建立信任] → [决策辅助] → [CTA: 去 CoinW 下单] → [完成交易]
```

- **核心 user job**：用户来 → 得到 actionable 交易决策 → 去 CoinW 下单
- **核心 metric**：CoinW 交易转化率（CoinW 后台给数，claw42 不闭环）
- **娱乐感**：体验层 wrapper（让用户来 + 留），不是产品核心

**驳回的 frame**：

- ❌ "AI 圆桌娱乐产品"（Stage 3 中被 Dan 驳回）
- ❌ "三 persona 产品矩阵"（37 task 提案，content-ops 72/100）
- ❌ "Hot Pursuit dashboard 复刻"（30s 轮播 + /signals 信号库列表）

### 0.2 6 个核心决策（Dan 拍板）

| #   | 维度              | 决策                                                                                           |
| --- | ----------------- | ---------------------------------------------------------------------------------------------- |
| Q1  | 持久化模型        | **In-memory + Vercel KV 双写 + env flag**（dev/preview 默认 in-memory；生产 env flag 切换 KV） |
| Q2  | v2.0 功能完备定义 | **三件套**：Agent 实时聊天 + K 线 + Agent 战绩可视化 + 跳转 CoinW 交易                         |
| Q3  | Agent 胜率        | **真实，不 mock**。初期可能很差，作为后续 prompt/数据源调优的核心数据回路                      |
| Q4  | /alpha 定位       | **用户分享自己跟单的交易卡片**（带 referral，不是 KOL 工具）                                   |
| Q5  | LLM provider 合并 | **选项 1 彻底**：废弃 claw42 现有 `llmFallbackChain.ts`，全部走 HP `signal-engine/providers/`  |
| Q6  | 转化数据回流      | **不闭环**。CoinW 后台给数，v2.0 不建埋点系统。后续 v3 视情况补                                |

---

## § 1. User Segments（3 段）

| Segment                | 占比假设 | 路径                                                                |
| ---------------------- | -------- | ------------------------------------------------------------------- |
| **跟单者**（主漏斗）   | 60%      | watch 讨论 → strategy 卡 → affiliate URL → CoinW                    |
| **学习者**（次漏斗）   | 25%      | watch → 点 SignalCard → /signals/[symbol] = K 线 + Agent 战绩可视化 |
| **观察者**（病毒入口） | 15%      | watch → 觉得有趣 → 用户分享卡片 → 朋友带 referral 回流              |

**关键结论**：

- 不开 /signals 信号库列表（学习者通过 [symbol] 单页就够）
- 不开 /alpha KOL 工具（用户分享卡片简化版即可覆盖）
- 不开 /docs UI（无外部用户 + 无法务背书）—— 但**预留后端 user/full/agent view projection**

---

## § 2. Success Metrics（4 条）

| Metric               | 阈值                                      | 说明                         | 数据来源                         |
| -------------------- | ----------------------------------------- | ---------------------------- | -------------------------------- |
| Agent 累计胜率       | > 50%（≥ 30 次预测后）                    | 高于随机基线 = Agent 有价值  | claw42 内部（T25 计算）          |
| Watch → CoinW 转化率 | ≥ 5%（点击 affiliate / 总 Watch session） | 漏斗末端有效                 | **CoinW 后台**（手动看）         |
| 分享带回的二次访问   | > 月新增的 10%                            | 病毒系数 K > 0.1             | claw42 内部（referral 回流统计） |
| 评估节奏             | 14 天复盘                                 | prompt / 数据源 / Agent 调优 | 每 14 天 Dan + Session C         |

---

## § 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│ UI Layer                                                  │
│  ├─ /                  (主页 + Today Brief + 三入口分流)  │
│  ├─ /agent             (Watch 页 IM 化 + 实时讨论)        │
│  ├─ /signals/[symbol]  (K 线 + Agent 战绩可视化)          │
│  ├─ /agents/[id]       (Agent 主页 + 胜率 + 历史)         │
│  └─ /share/[id]        (用户分享卡片 + referral)          │
├──────────────────────────────────────────────────────────┤
│ Application Layer                                         │
│  ├─ chatOrchestrator   (task-18 升级，接 SignalEngine)    │
│  ├─ predictionTracker  (T24-T26)                          │
│  ├─ winRateCalculator  (T25 真实胜率)                     │
│  └─ affiliateRouter    (A1 CTA 拼接 + env config)         │
├──────────────────────────────────────────────────────────┤
│ Domain Layer                                              │
│  ├─ SignalEngine       (HP 内化，T1)                      │
│  ├─ data-sources       (CoinGecko + CryptoCompare + RSS)  │
│  ├─ llm/providers      (5 家统一抽象，废弃旧 fallback)    │
│  └─ chatGuardrails     (task-18 已实现，保留)             │
├──────────────────────────────────────────────────────────┤
│ Infrastructure Layer                                      │
│  ├─ In-memory cache + Vercel KV 双写（Q1）                │
│  ├─ Distributed lock (KV SETNX, T1.1)                     │
│  ├─ KV-based rate-limiter (T1.2)                          │
│  ├─ JSONL metrics + 轮转 (T32)                            │
│  └─ Web Vitals + Error Boundary + a11y (T28/T29/T31)      │
└──────────────────────────────────────────────────────────┘
```

---

## § 4. Task List（29 个，6 batch）

### Batch 0：工程基础（5 task，立即并发，无依赖）

| Task    | 内容                                            | 来源        |
| ------- | ----------------------------------------------- | ----------- |
| T28     | Web Vitals 上报（CLS/LCP/FCP/TTFB/INP）         | HP 资产复用 |
| T29     | a11y WCAG AA + axe-core verify + ar_SA RTL 测试 | HP 资产复用 |
| T31     | Error Boundary + 全局错误埋点                   | HP 资产复用 |
| T32     | metrics + JSONL log rotate                      | HP 资产复用 |
| T36/T37 | Hot Pursuit 仓库归档 + Batch 1 worktree 标终止  | HP 交接     |

### Batch 1：基础底座（4 task，依赖 Batch 0）

| Task     | 内容                                                                       | 来源             |
| -------- | -------------------------------------------------------------------------- | ---------------- |
| T1       | SignalEngine + data-sources + observability + auth + storage 内化到 claw42 | HP 主资产        |
| **T1.1** | **distributed lock pattern (KV SETNX with TTL)**                           | **五维碰撞补丁** |
| **T1.2** | **migrate HP rate-limiter from file-based to KV-based**                    | **五维碰撞补丁** |
| T4       | SignalEngine 测试覆盖（vitest）                                            | HP 复用          |

### Batch 2：LLM 抽象统一（3 task，依赖 Batch 1）

| Task       | 内容                                                                                                                       | 来源    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | ------- |
| T2         | **彻底废弃 `llmFallbackChain.ts`**，全部走 HP `signal-engine/providers/`（5 家：minimax/deepseek/claude/anthropic/openai） | Q5 决策 |
| T3         | /api/agents/analysis 改造调 SignalEngine + 新 LLM 抽象                                                                     | HP 改造 |
| T2-migrate | 改造 watch 页（main 分支已有 chatOrchestrator）让其走新 LLM 抽象                                                           | Q5 衍生 |

### Batch 3：Agent 历史预测系统（4 task，依赖 Batch 2）

| Task      | 内容                                                                                                | 来源                         |
| --------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| T24       | Agent 历史预测记录系统（每次评论后 hook 写 JSONL）                                                  | HP 概念 + claw42 实施        |
| **T24.1** | **backfill historical predictions from chatHistoryStore**（解 Day 0 裸奔）                          | **五维碰撞补丁 P0 critical** |
| **T24.2** | **prediction schema with prompt_version + data_source_snapshot + model_version**（version pinning） | **五维碰撞补丁**             |
| T25       | 真实胜率计算（按 prompt_version 分桶）                                                              | 升级版                       |

### Batch 4：UI 升级（8 task，依赖 Batch 2+3）

| Task       | 内容                                                                                                                       | 备注                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| task-18-v2 | task-18 不推翻，**接 SignalEngine grounding**（UI 暴露 evidence panel + 保留派别人设 + 11 ChatActions + chatOrchestrator） | task-18 升级，非推翻  |
| T5         | TopicHeader 显示 MajorEvent                                                                                                | HP 复用               |
| T9         | MessageStream 加证据展开 + 重新分析                                                                                        | HP 复用               |
| T13-改     | **/signals/[symbol] = K 线（lightweight-charts）+ Agent 历史预测标记 + hover tooltip**                                     | **核心信任表达**      |
| T26        | Agent 主页（/agents/[id]，胜率 + 历史预测 + 多维度）                                                                       | HP 概念 + claw42 实施 |
| **T26.1**  | **multi-dimension performance display + disclaimer + 累计样本数**（解金融认知陷阱）                                        | **五维碰撞补丁**      |
| A1         | affiliate URL CTA（每个 SignalCard / strategy 卡 / Agent 主页加"去 CoinW 多 BTC"按钮，带 affiliate code）                  | 漏斗末端补丁          |
| **A1.1**   | **segment entry points UX design**（三 segment 入口设计）                                                                  | **五维碰撞补丁**      |

### Batch 5：分流 + 病毒（4 task，依赖 Batch 4）

| Task     | 内容                                                                             | 备注                                 |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------ |
| T22      | 主页三入口分流（散户 → /agent / 学习者 → /signals/[symbol] / 观察者 → 引导分享） | 改 §0 描述：3 segment 不是 3 persona |
| T21      | 主页 Today Brief 卡（60 字 LLM 简报）                                            | HP 复用                              |
| T17-简化 | /alpha 简化版（用户分享自己跟单交易卡片，带 referral）                           | Q4 简化                              |
| T20-简化 | Web Share API + 一键复制 + referral query param                                  | Q4 简化                              |

### Batch 6：ops + 收尾（1 task，全程）

| Task        | 内容                                                                                                                   | 备注                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **ops-doc** | **operational dashboard + 决策树**（给 Dan 14 天复盘用：胜率 < 50% 怎么办 / 转化率 < 5% 怎么办 / 分享率 < 10% 怎么办） | **五维碰撞补丁 P0** |

---

### Task 总数核对

| Batch    | Task 数     | 备注                   |
| -------- | ----------- | ---------------------- |
| Batch 0  | 5           | 工程基础               |
| Batch 1  | 4           | 含 2 个五维碰撞子 task |
| Batch 2  | 3           | Q5 选项 1              |
| Batch 3  | 4           | 含 2 个五维碰撞子 task |
| Batch 4  | 8           | 含 3 个五维碰撞子 task |
| Batch 5  | 4           | Q4 简化版              |
| Batch 6  | 1           | ops-doc                |
| **合计** | **29 task** | 主 22 + 五维碰撞子 7   |

---

## § 5. Hot Pursuit 资产去向

| 资产                                               | 去向                                               | 浪费率 |
| -------------------------------------------------- | -------------------------------------------------- | ------ |
| `src/lib/signal-engine/`                           | T1 内化                                            | 0%     |
| `src/lib/data-sources/`                            | T1 内化                                            | 0%     |
| `src/lib/observability/`                           | T1 内化                                            | 0%     |
| `src/lib/auth/` (api-guard / quota / rate-limiter) | T1 内化（T1.2 改 KV）                              | 5%     |
| `src/lib/storage/` (file-lock / jsonl-writer)      | T1 内化（T1.1 加 KV lock）                         | 10%    |
| 6 层 SignalCard 类型                               | 后端保留，UI 不暴露 6 层细节                       | 0%     |
| MajorEventHero                                     | T5 TopicHeader                                     | 30%    |
| DailyBriefSection                                  | T21 Today Brief 卡                                 | 20%    |
| SignalCardStream / SignalCardItem                  | **不复用**（不开 /signals 信号库）                 | 100%   |
| SignalDetailModal                                  | **不复用**（学习者走 /signals/[symbol] K 线页）    | 100%   |
| dashboard 主路径                                   | **完全砍**                                         | 100%   |
| /docs (中英 + OpenAPI)                             | **后端 view projection 保留，UI 不开放**（v2.5+）  | 50%    |
| anchor-integration-pack                            | **不做**（v3+）                                    | 100%   |
| LLM providers (4 家 + budget + cache)              | T2 全量内化（Q5 选项 1）                           | 0%     |
| Web Vitals / a11y / Error Boundary                 | T28/T29/T31 资产复用                               | 0%     |
| 测试套件（vitest + Playwright + axe-core）         | 部分内化（vitest 必做，Playwright/axe 走 T29/T30） | 30%    |

**总浪费率**：约 25-30%（比交接包估算的 30-40% 略低，因为 LLM providers 全用了）。

---

## § 6. 五维碰撞已知风险（不解决，仅标记）

| #   | 风险                                 | 触发条件                                      | 应对预案                                                            |
| --- | ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------- |
| 1   | SignalEngine 多 instance 重复计算    | Vercel 高并发同 symbol                        | T1.1 distributed lock + 接受短暂偶发；KV SETNX with TTL             |
| 2   | chatOrchestrator 弱一致              | 多 instance 同 thread 写入                    | timestamp 排序兜底 + master instance 选举（KV-based）               |
| 3   | ar_SA RTL 在 K 线/Agent 主页排版破损 | ar_SA 用户进 v2.0                             | T29 测试覆盖；破损就 ar_SA fallback en（按 task-18 locked Q4 决策） |
| 4   | affiliate 中间层不可控               | CoinW 改 URL / cookie 失败                    | affiliate URL 走 env config + 健康监控；数据回流靠 CoinW 后台       |
| 5   | Agent prompt 改动让胜率不可比        | t1 预测 + t1+24h prompt 改 + t1+72h 算胜率    | T24.2 schema with version pinning，胜率按 prompt_version 分桶       |
| 6   | T24 backfill 历史数据准确性          | chatHistoryStore 数据格式不全 / 时间戳不准    | T24.1 实施时验证 backfill 准确率 ≥ 80%；不达标只用真实新预测        |
| 7   | Dan 认知负担                         | 22 主 task + 7 子 task + 4 metric + 3 segment | ops-doc 一页纸 cheatsheet + 决策树                                  |

---

## § 7. v2.0 不做的事（明确边界）

| 项                                               | 不做 | 理由                                                              |
| ------------------------------------------------ | ---- | ----------------------------------------------------------------- |
| /signals 信号库列表（dashboard 形态）            | ❌   | 学习者走 /signals/[symbol] 就够；列表是 HP dashboard 思维         |
| /signals/[id] 单信号详情页                       | ❌   | 信号细节通过 watch 页 evidence panel + /signals/[symbol] K 线展示 |
| /docs 公开 API 文档 UI                           | ❌   | 无外部用户 + 无法务背书；后端 view projection 预留                |
| /alpha KOL 工具（Canvas 自动配图 + LLM Caption） | ❌   | Q4：用户分享卡片简化版即可                                        |
| anchor-integration-pack                          | ❌   | v3+ 后做（外部用户进来后）                                        |
| 30s 主题轮播                                     | ❌   | chatOrchestrator 已有 cooldown + breaking_news 触发，更智能       |
| cross-agent diversity check（cosine 70%）        | ❌   | task-18 已有派别人设 + 11 ChatActions，不需要相似度算法           |
| Agent 学习史 v2.1 mock 数据展示                  | ❌   | Q3：胜率必须真实；T24.1 backfill 解决 Day 0 数据不足              |
| 完整 PostHog 转化埋点系统                        | ❌   | Q6：CoinW 后台给数；v2.0 不闭环                                   |
| OpenAPI auto-generated SDK                       | ❌   | 无外部 SDK 用户                                                   |
| vector.dev → Prometheus + Grafana                | ❌   | v3+；JSONL metrics + 14 天复盘节奏够用                            |

---

## § 8. v2.0 上线后评审节奏

| 时间点                | 评审内容                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Day 0（v2.0 上线）    | 烟雾测试：watch 页 + /signals/[symbol] K 线 + affiliate URL 跳转能跑                       |
| Day 14（第 1 次复盘） | Agent 胜率初步数据（T24.1 backfill + 14 天真实积累） / 转化率（CoinW 后台手动看） / 分享率 |
| Day 30（第 2 次复盘） | 胜率统计意义（≥ 30 次预测） / 多 instance 数据竞争是否真发生 / 3 segment 实际分布          |
| Day 60（第 3 次复盘） | affiliate 数据回流是否打通 / 用户分享带回率 / 是否要做 v2.5（/docs API 开放）              |
| Day 90（季度复盘）    | Agent prompt 调优后胜率提升曲线 / 是否启动 v3.0 规划                                       |

---

## § 9. 实施顺序（按依赖批次并发）

```
Batch 0  (T28/T29/T31/T32/T36/T37) ┐
                                    ├─→ 立即并发（5 PR）
Batch 1  (T1/T1.1/T1.2/T4) ─────────┘
                ↓
Batch 2  (T2/T3/T2-migrate) ────────→ 等 T1 合并后并发（3 PR）
                ↓
Batch 3  (T24/T24.1/T24.2/T25) ────→ 等 T2-T3 合并后并发（4 PR）
                ↓
Batch 4  (task-18-v2/T5/T9/T13-改/T26/T26.1/A1/A1.1) ──→ 等 Batch 3 后大并发（8 PR）
                ↓
Batch 5  (T22/T21/T17-简化/T20-简化) ──→ 等 Batch 4 合并后并发（4 PR）

Batch 6  (ops-doc) ─────────────────→ 全程跟随（每个 batch 完成后 update）
```

**关键观察**：

- AI 不会因为并发变慢，工作量按"逻辑依赖"算
- 5 batch 串行 + batch 内 PR 并发
- 每个 PR 独立 commit + 独立 verify + 独立 review
- 总 PR 数 = 29

---

## § 10. Codex 副审指令

### 10.1 阅读顺序

1. 本文档（v2-master-plan.md）—— 决策来源 + 锁定的方案 A
2. Hot Pursuit 交接包（`/Users/dannybrown/Claude/职业规划/academy/Ai生态项目/Hotpursuit/docs/superpowers/specs/2026-04-27-handoff-to-session-c.md`）—— 历史 reference，非 ground truth
3. Hot Pursuit 37 task list（同目录 `2026-04-27-claw42-v2-fusion-task-list.md`）—— 已被 content-ops 否决（72/100）的对比基准
4. claw42 现有代码（`/Users/dannybrown/Claude/职业规划/web-dev/claw42/src/`）
5. Hot Pursuit 现有代码（`/Users/dannybrown/Claude/职业规划/academy/Ai生态项目/Hotpursuit/src/`）

### 10.2 副审要回答的 7 个问题

**Q-Codex-1**：5 个 batch 切分是否合理？是否有应该并发但被串行化的，或反之？

**Q-Codex-2**：T1（SignalEngine 内化）的具体范围——`src/lib/` 下哪些子目录必须内化，哪些可以"按需引用"不内化？给出文件清单。

**Q-Codex-3**：Q5 选项 1（彻底废弃 `llmFallbackChain.ts`）的工作量评估——claw42 main 分支有多少处引用 `llmFallbackChain`？feature/watch-chat-immersive-01 分支引用情况？迁移路径是否需要兼容期？

**Q-Codex-4**：T24.1 backfill historical predictions 的可行性——`chatHistoryStore`（main 分支已实现）的数据 schema 是否含足够信息倒推"Agent 在 t1 时刻预测了什么方向"？如果数据不全，backfill 准确率能到多少？

**Q-Codex-5**：T13-改（K 线 + Agent 战绩可视化）的实施细节——`lightweight-charts` 已是 HP 依赖；claw42 main 是否已用？K 线上叠加 Agent 预测点的常见 UX pattern 是什么？hover tooltip 在 RTL（ar_SA）下排版怎么处理？

**Q-Codex-6**：A1 affiliate URL CTA 的实现细节——CoinW affiliate URL 当前 format 是什么？env config 应该放哪？health check 监控的实现路径？

**Q-Codex-7**：五维碰撞清单（§ 6）是否有遗漏？特别是：

- 是否漏掉了第六维（Codex 的视角）？
- 已知风险 #1-7 中哪些被低估？
- 哪个 task 的复杂度被我低估了？

### 10.3 副审输出格式

副审产出落到：`docs/codex-specs/v2-master-plan-codex-review.md`

输出结构：

- § 1 Review Scope
- § 2 Q-Codex-1 ~ Q-Codex-7 逐一回答
- § 3 我看到但 Master Plan 漏的维度
- § 4 建议的 batch / task 顺序调整
- § 5 建议的 task 拆分调整
- § 6 全局判断：GO / GO after patch / NO-GO

### 10.4 不能做的事

- ❌ 临场补 task（要补先和 Session C 通气）
- ❌ 改 § 0 决策清单（Q1-Q6 已 Dan 拍板，副审不能驳回这些）
- ❌ 用 37 task 提案的逻辑反驳（content-ops 已经评分否决）
- ❌ 用真名 `Mike`（用 `Dan`）

### 10.5 决策清单冻结

§ 0 锁定决策（Q1-Q6）+ § 1 user segments + § 2 success metrics 是 LOCKED——副审不能驳回这些。可以质疑的：

- § 4 task list 的拆分粒度
- § 6 已知风险的漏判
- § 9 实施顺序

---

## § 11. 文档元信息

- **创建**：2026-05-07 by Session C
- **基于**：
  - PM brainstorming（产品方向 + user job 校准）
  - content-ops 9 专家面板（Variant A 90/100）
  - 五维碰撞测试（7 个新增子 task）
  - Dan 拍板 Q1-Q6
- **决策版本**：locked-v1
- **下次允许变更**：Codex 副审反馈整合后形成 locked-v2，或 v2.0 上线后 14 天复盘暴露重大盲区
- **冻结清单**：§ 0 决策 / § 1 segments / § 2 metrics / § 7 不做的事

---
