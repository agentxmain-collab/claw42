# Spec: Watch B.13 — Multi-Agent Soul Uplift Umbrella

> **版本**：v1.1（2026-05-15 起草 v1.0 → v1.1 Codex Round 1 反馈整合）
> **作者**：F (Claude session)
> **状态**：v1.1 Draft, 待 Dan APPROVED 后派 Codex 持续 4 stage
> **协议**：claude-codex-protocol v2.5 (19 段) + AI-driven paradigm v1.0
> **承重**：本 spec 是 claw42 "多 Agent 协作 = 产品灵魂" 的总落地，B.13 ~ B.16 全 phase 单 spec batch（Codex 持续开发模式）

---

## v1.1 修订原因（v1.0 → v1.1）

Codex Round 1 评估（codex-to-claude.md lines 9888-10222）给出 4 个 blocking issue，F 双脑判断后全部接受：

1. **Stage 顺序重排**（Codex angle）：role identity 必须早于 `/api/watch/refresh`。refresh 会写新 PM records 进 history wall，identity 没沉淀的话新 records 全是扁平角色，下次 memory loop 喂的就是扁平 baseline。F v1.0 按"产品 vision Layer 1→5"线性排，没考虑写入顺序 contamination。
2. **§9.2 14 角色 TeamMemberId 对齐**（Codex 跨域 first-hand finding）：F v1.0 直接编了 14 个产品 label（Bullish Lead 等）没核对 `src/lib/team/teamRegistry.ts`。Codex 列了真实 14 id 后 v1.1 全表重写。
3. **`/api/watch/refresh` serverless-safe scheduling**：Vercel Edge function 返回 response 后会 kill 后台任务，plain `void triggerPmDecisionPipelineOnce()` 不可靠。v1.1 要求 Next `after()` API / queue / cron handoff。
4. **§10/§11/§12 placeholder 清理**：明确链接到 § 6-§ 9 / § 15 / § 19。

外加 Codex 多个 task 调整接受：T103 P0→P1 audit（claude-haiku 实际已在 resolvePMProviderSelection 实装）/ T208 P1→P0（watch-only safety critical）/ T304+T305 拆紧凑 summary P0 vs hover detail P1 / T401 sample-size aware / i18n 10 locale 全 cover（含 en_XA）/ § 13 加 5 条 cannot-do。

---

## § 1 Overview

### 1.1 背景

B.12 闭环后（决策质量大重构 / DeepSeek 65% Minimax 35% / typed evidence / L1+L2 UI），Dan chat review 发现产品体验和"五轮各角色都说同样的话"没有本质区别。深层根因：**B.0 ~ B.12 都是工程视角（数据流 / schema / provider），缺产品灵魂层**。

Dan 拍板（2026-05-15 chat）：多 Agent 分析协作是整个产品的灵魂，不是装饰。重新设计实施路径，**大批量 = Codex 持续开发，不是分多个 spec 来回扯**。

### 1.2 5 层产品愿景（已落 decision-log 2026-05-15）

| 层                    | 内容                                             | 当前差距                                         |
| --------------------- | ------------------------------------------------ | ------------------------------------------------ |
| L1 Team identity      | 14 角色有持久性格 / 立场 / 语气                  | 角色名一样但 prompt 不喂角色色彩，输出趋同       |
| L2 用户参与           | 用户能看到团队"正在工作"、能跟单、能感知节奏     | 工作台死板 / 缺刷新感知 / follow-trade mock 未上 |
| L3 Memory loop 真学习 | history wall 写出去后回喂给下一轮决策            | history wall 写了，evidence pack 不读            |
| L4 多空辩论戏剧化     | bullish/bearish/PM 之间能看到真观点冲突          | 三段独立报告，缺辩论结构                         |
| L5 6 阶段仪式感       | 数据 → 多空 → 量化 → 复盘 → 决策 → 跟单 完整流程 | 现状是 14 角色平推，无仪式感                     |

### 1.3 本 spec 范围（4 stage，v1.1 顺序重排）

| Stage       | 主题                                                                                                                                                                                                       | 对应层  | 优先级                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| **Stage 1** | 公开体验清理（fallback rationale 不暴露 / dataStatus UI 隐藏 / silent fallback / 9 role → DeepSeek / PM 不强等 / claude-haiku audit）                                                                      | L2      | P0 必须                                                                     |
| **Stage 2** | **Role identity 沉淀**（teamRegistry persistentPersonality + 14 actual TeamMemberId 真实 prompt 注入 + 14 source id 在 UI/dispatch 保留 + oneLineSummary 角色口吻）                                        | L1      | P0 必须，**v1.1 升 Stage 2**（早于 refresh 防新 record 扁平 contamination） |
| **Stage 3** | 决策稳定 + Candidate Execution + Cache+Fetch（CoinW filter + symbolMapping + b74023a stale-while-revalidate 复用 + `/api/watch/refresh` serverless-safe + UI 刷新感知 + watch-only 严格不可 follow-trade） | L2 + L3 | P0 必须                                                                     |
| **Stage 4** | Memory loop 真学习（history wall → memory_loop evidence pack + team track record UI 紧凑 summary + sample-size aware）                                                                                     | L3      | P0 必须                                                                     |

**Stage 顺序变更说明（v1.0 → v1.1）**：

| v1.0 顺序       | v1.1 顺序                              | 原因                                             |
| --------------- | -------------------------------------- | ------------------------------------------------ |
| 1 公开体验      | 1 公开体验                             | 不变                                             |
| 2 Cache+Fetch   | **2 Role identity**（原 v1.0 Stage 4） | refresh 会写新 PM records，identity 必须先沉淀   |
| 3 Memory loop   | **3 Cache+Fetch**（原 v1.0 Stage 2）   | refresh 在 identity 之后写新 records             |
| 4 Role identity | **4 Memory loop**（原 v1.0 Stage 3）   | memory 读 history wall = identity 化后的 records |

**L4 戏剧化 + L5 仪式感**：本 spec **不实现**，留 B.14 / B.15 后续 spec（避免单 spec 过载）。

### 1.4 Codex 持续开发模式（关键约束）

- v1.1 定稿后 Codex 持续 4 stage 实现，不停：
  - 每个 stage 完成 = 自动开下一个 stage
  - 每个 stage 结束写 codex-to-claude.md report，但不等 F response 继续推
  - 每个 stage 单独 PR（不是 4 stage 一个 PR），保持回滚粒度
- F 在每个 stage PR review 时介入审核，但不阻塞 Codex 进入下一 stage 的预设工作
- 4 stage 全部完成预估 **10-15 AI 天**（Codex 单实例，Codex Round 1 估计区间 10-16 days）

---

## § 2 In-Scope / Out-of-Scope

### 2.1 In-Scope

**Stage 1 公开体验清理**：

- 移除前端可见的 `dataStatus` / "暂时不可用" / "缺失" 等后台状态露出
- **关键**：`evidenceDispatcher` mandate / data-status text / fallback output text 的 public payload（如 `rationaleByMember` 中 `fundamental_analyst 暂时不可用，使用中性占位继续生成决策`）必须从 generation pipeline 层去除，不能只 hide UI（v1.0 漏点）
- L1 卡片 silent fallback（DeepSeek 失败时 log only / 换 retry，UI 不显错）
- **9 个当前 Minimax-default role 切 DeepSeek**（v1.1 措辞修正：是 9 个 Minimax-default role，不是 9 个 LLM role，pipeline 共 14 角色全在跑 LLM）
- PM trade decision provider audit：`resolvePMProviderSelection` 已 map 到 `claude-haiku`，**移除 `claude-opus` requested wording 误导文本**（v1.1 修正，原 v1.0 误以为没切）
- PM 不强等所有 evidence pack（部分 timeout / 部分 missing 仍允许出决策，evidence rules 层修，不只 PM prompt 改）

**Stage 2 Role identity 沉淀**（v1.1 升 Stage 2）：

- `teamRegistry` 加 `persistentPersonality` 字段：
  ```ts
  interface PersistentPersonality {
    riskBias: "conservative" | "balanced" | "aggressive";
    focusStyle: "data-heavy" | "story-heavy" | "contrarian";
    voiceTone: "terse" | "analytical" | "dramatic" | "skeptical";
  }
  ```
- 14 个实际 `TeamMemberId` 全填（F 在 § 7.2 给出真表，Codex 不自己编）
- 修改 `docs/agent-ip/team/{TeamMemberId}.md`（一文件一角色，14 文件）：每个角色 prompt 顶部注入 persistentPersonality 段
- `oneLineSummary` 字段（B.12 v1.1 已加）真带角色口吻——prompt 顶部强制要求 "speak in your persistent voice"
- **关键**：14 source `TeamMemberId` 在 UI / dispatch payload 必须**全保留**（不能在 v10 visual layer 压缩到 12 角色，否则 `research_lead` 和 `risk_lead` 等 personality 会丢）

**Stage 3 决策稳定 + Candidate Execution + Cache+Fetch**（v1.1 调到 Stage 3）：

- `symbolMapping.ts` 扩展：BTC/ETH/SOL/HYPE/BILL/IRYS 都明确 metadata `{executable: true|false, fallback?: string}`，不依赖 `${symbol}_USDT` 字符串拼接 fallback 当 executable 用
- Candidate pool 过滤逻辑：Execution mode → CoinW filtered，非 executable 标记 watch-only
- 新建 `/api/watch/refresh` endpoint：
  - **POST 为 canonical trigger**（GET 仅 status-only），避免 GET 写状态被 cache/proxy 破坏
  - 输入：symbol / locale
  - 输出 status enum：
    - `cached` — 数据 fresh 够，无新 run 启动
    - `stale` — 检测到 stale 且 refresh 已接受
    - `refreshing` — in-flight lock 存在，已有 run
    - `locked` — cooldown / suppression lock 阻塞新 run
    - `no_signal` — 无 valid candidate / 无 evidence signal
  - **Serverless-safe background execution 必须**：用 Next 14 `after()` API（如可用）/ durable queue handoff / 显式 keep response open 直到 trigger safely scheduled。**禁止** plain `void triggerPmDecisionPipelineOnce()`
- `/api/watch/timeline` + `/api/watch/stream` 保持 read-only（grep 验证无 trigger）
- KV-backed locks（不能只用 process memory，Vercel serverless 不共享内存）：
  - **Lock ordering**（v1.1 新增）：
    1. 先 check in-flight lock（5min KV）
    2. 再 check freshness（lastDecisionAt < 15min → cached）
    3. 再 check cooldown / locale lock（5-10min）
    4. 再 check per-symbol pmDecisionTrigger 170-min suppression lock（已存在 `watch:pm-decision:{locale}:{symbol}`）
    5. 全过才 acquire cooldown/locale lock，accept run；failure 必须 release in-flight lock
- Freshness source：**不假设** `latest_decision:{locale}` key 存在。derive from current strategy records / timeline projection，或新建 materialized freshness key + writer update（v1.1 修正 Codex finding）
- UI 文案：`分析于 X 分钟前` / `新分析进行中` / `完成后自动刷新` / `cached` 状态优雅显示
- 用户访问 `/agent` 时一次 visible-session freshness 触发（session key 含 locale + symbol/window，避免 hidden-tab 重复触发）
- rate limit：refresh path 比 timeline path 严，e.g. 6 req/min/IP，复用 `kv-rate-limiter.ts`
- **watch-only 严格安全**（v1.1 升 P0）：watch-only symbol 必须在 UI 上不能展示 follow-trade affordance（不能让用户错点跟单 unknown long-tail）

**Stage 4 Memory loop 真学习**（v1.1 调到 Stage 4）：

- 新建 `src/lib/team/memoryLoopEvidence.ts`（独立于现有 evidence pack）：
  - **Source**：decision records / history endpoint path（不假设 `history_wall:{symbol}` KV key 存在，v1.1 修正 Codex finding）
  - 复用 `computeTeamWinrates.ts` 纯 aggregator 逻辑（不重写）
  - 输出 schema：
    ```ts
    interface MemoryContext {
      historicalCount: number | null;
      winLossDistribution: { wins: number; losses: number; openTrades: number };
      similarSetups: Array<{
        timestamp: number;
        symbol: string;
        direction: string;
        outcome: string;
      }>;
      lastReviewNotes: string | null;
      sampleSizeCaution: boolean; // v1.1 新增：稀疏样本时 = true
      error?: "kv_unavailable" | "no_history";
    }
    ```
- evidenceDispatcher 集成 memory context：
  - PM role 的 evidence pack 调用 `fetchMemoryContext(symbol)`
  - **关键**：memory context 与现有 evidence 分离（不要 repeat 前 5 轮 evidence），仅注入 memory 独有的"历史 + 复盘"信号
  - prompt source = `docs/agent-ip/team/memory_loop.md`
- PM prompt 10 locale 翻译（v1.1 修正：是 10 locale 含 en_XA）
- Team Track Record UI：
  - **紧凑 summary** = P0（14 角色每个显示样本量 + 简短 win-rate 标签，含 sample-size caution badge）
  - **完整 hover/history** = P1（hover 出更多 history，lazy load）
  - 不抢主决策视觉，折叠 / 侧边 / hover

### 2.2 Out-of-Scope（明确推到 B.14+）

- L4 多空辩论戏剧化 → B.14
- L5 6 阶段仪式感 → B.15
- Real follow-trade 接 CoinW API（当前 mock）→ B.16+
- Cron schedule 调整（当前 `0 */3 * * *` 不动）
- 第三个 LLM provider 接入
- Hero 区 / landing page 改动（Dan 独立处理）
- v10 visual layer 角色数压缩（**v1.1 新增**：保 14 source id 才能映射 personality 不丢）

---

## § 3 Edge Cases（4 轴）

### 3.1 输入轴

- **symbol 不在 CoinW 4 币种**：candidate pool 仍可保留 watch-only signal，UI **严格** mark "non-executable"（v1.1 加强）
- **/api/watch/refresh 被 bot / 高频 abuse**：rate limit 6 req/min/IP + KV-backed 5-min in-flight lock + per-symbol 170-min suppression 共同兜底
- **locale 不在 10 个支持中**：fallback en_US，不抛错
- **memory_loop 历史样本 = 0**（新 symbol）：return `{historicalCount: 0, sampleSizeCaution: true, message: "first-time analysis"}`，PM prompt 显式 "no historical baseline"
- **memory_loop 历史样本 < 5**（v1.1 新增，sparse history 关键）：`sampleSizeCaution: true`，UI 显示 "首周样本不足，胜率仅供参考"

### 3.2 状态轴

- KV lock 已存在 → return `{status: refreshing, refreshStarted: false}`
- last decision <15min → return `{status: cached, lastDecisionAt}`，不触发
- 15min < last decision < 170min → 进入 stale 区，进 § 7.x lock ordering 5 步检查
- provider 全部失败 → refresh 不触发新 run，UI 显示最后一次 cached state（不弹错）
- memory_loop KV / records 读失败 → `{error: 'kv_unavailable'}`，PM prompt fallback "memory unavailable, decide based on current evidence only"
- **fallback rationale 流入 public payload**（v1.1 新增）→ generation pipeline 必须在 evidenceDispatcher / 角色 prompt 层就用专业措辞 produce 公共版本，不让 `暂时不可用` 等 backend 措辞进 `rationaleByMember`

### 3.3 边界轴

- 同 locale 10 个 user 访问 → 单 KV-backed in-flight lock 兜底，仅第一个 trigger，其他 `{status: refreshing}`
- PM run 跑到 Vercel 函数超时（Edge 30s 限制） → 必须 `after()` / queue handoff（v1.1 修正 fire-and-forget 不可靠）
- persistentPersonality 字段缺失某角色 → fallback generic prompt，不抛错（Stage 2 全填后理论不应发生）
- v10 visual layer 12 角色 vs team 14 member → UI/dispatch payload 必须保 14 source `TeamMemberId`，否则 personality 在 visual map 丢失（v1.1 新增）

### 3.4 失败轴

- `/api/watch/refresh` 5xx → UI 不弹错，timeline 自然 fallback cached display
- memory_loop evidence 计算超时（>5s） → PM 跳过 memory context 段，正常出决策
- persistentPersonality 注入 token 超 LLM 上限 → truncate persistentPersonality 段，保 core prompt
- track record UI 数据为空 → 显示 "first-week" placeholder + sample caution，不显空 win-rate
- after() API 不可用（Next < 14 / runtime 不支持） → spec 必须明示降级路径或显式声明限制（v1.1 新增）

---

## § 4 Assumptions

1. **CoinW kline 长期稳定**：BTC/ETH/SOL/HYPE 4 币种 kline API 不会突然 deprecate
2. **DeepSeek 容量稳定**：本 spec 把 9 Minimax-default role 切 DeepSeek 后，单 provider QPS 不撞 rate limit
3. **Minimax timeout 25s 已稳**（B.12 已 raise），PM trade decision 走 claude-haiku 后 Minimax 量大幅下降
4. **KV (Upstash) latency 可控**：refresh endpoint 写 lock 应 <200ms，否则用户体验差
5. **persistentPersonality 注入 token 成本**：每个 role prompt 加 80-150 tokens，14 角色 × per-run = ~1500 extra tokens，可接受
6. **b74023a stale-while-revalidate 是架构灵感不是机械复用**：不会 import b74023a 旧代码，按 pattern 写新代码（Codex Round 1 已警告不要直接 reconnect `/api/agents/analysis`）
7. **Next 14 `after()` API 在 Vercel 当前 runtime 可用**（v1.1 新增）：Codex Stage 3 实施前必须验证。如不可用，降级用 queue / cron handoff（必须显式选择，不可继续 fire-and-forget）

---

## § 5 Measurable Success Criteria

### 5.1 Stage 1 公开体验

- ✅ 工作台 V10 任何位置不出现 "暂时不可用" / "缺失" / "dataStatus" 文本
- ✅ `rationaleByMember` 公共 payload 中无 backend fallback 措辞（grep `暂时不可用` in production payload = 0 hit）
- ✅ DeepSeek 单 role 单次失败时，UI 不弹错，silent retry / fallback
- ✅ PM trade decision 实测 provider = `claude-haiku`（grep + telemetry 双验证，移除 `claude-opus` requested 误导 wording）
- ✅ 14 角色 teamRegistry.ts 默认 provider：当前 9 Minimax-default 改为 deepseek，5 个 DeepSeek-default 保持 deepseek（仅 PM trade decision 实际跑 claude-haiku via providerOverride）
- ✅ PM 不强等：evidence rules 层修，部分 timeout / missing domain 不强制 `wait`

### 5.2 Stage 2 Role identity

- ✅ `teamRegistry` 含 `persistentPersonality` 字段
- ✅ **14 actual TeamMemberId**（`fundamental_analyst`, `news_analyst`, ..., `memory_loop`）每个填 persistentPersonality（按 § 7.2 表）
- ✅ 14 个 `docs/agent-ip/team/{TeamMemberId}.md` 文件 prompt 顶部注入 persistentPersonality 段
- ✅ `oneLineSummary` 在新一轮 PM run 后，14 角色输出**可区分**（人工评审 14 条能猜对角色 ≥ 10/14）
- ✅ Stage 2 完成后立即触发一次 PM run，新 records 写入 history wall 时是 identity-rich 而非 flat（v1.1 新增验收点）
- ✅ UI / dispatch payload 保 14 source `TeamMemberId`（不在 v10 visual layer 压缩）

### 5.3 Stage 3 Cache+Fetch

- ✅ `symbolMapping.ts` 含 BTC/ETH/SOL/HYPE/BILL/IRYS 6 个 mapping + executable metadata
- ✅ `/api/watch/refresh` endpoint 上线，POST 触发 / GET 状态查询，返回 5 status enum 之一
- ✅ Serverless-safe scheduling 实装（`after()` API 或 queue handoff，禁止 plain fire-and-forget）
- ✅ 用户访问 `/agent` 时一次 freshness 触发（非每次 mount），UI 显示 `分析于 X 分钟前`
- ✅ 同 locale 5 分钟内重复触发 → 第二次返回 `{status: refreshing}` 不触发新 PM run
- ✅ Lock ordering 5 步严格（in-flight → freshness → cooldown → per-symbol → acquire），grep 单元测试覆盖
- ✅ Candidate pool 非 executable symbol 标记 watch-only，UI 严格不可 follow-trade（grep follow button render 条件）
- ✅ KV-backed lock 实际写入 Upstash KV（不是 process memory），单元测试 confirm

### 5.4 Stage 4 Memory loop

- ✅ `memoryLoopEvidence.ts` 新文件存在 + export 函数 + return schema 符合 § 2.1 描述（含 `sampleSizeCaution`）
- ✅ Source 用 decision records / history endpoint，不假设 `history_wall:{symbol}` KV key
- ✅ PM prompt 在 evidence dispatch 时包含 memory context 段，与现有 evidence 分离（不 repeat 前 5 轮）
- ✅ PM prompt 10 locale 翻译（含 en_XA）
- ✅ Team track record UI 紧凑 summary 上线，14 角色每个显示 sample size + win-rate + caution badge（sparse history 时）
- ✅ Hover detail（P1）lazy load history（如时间允许在 Stage 4 内交付，否则推 B.14）
- ✅ Win-rate 计算复用 `computeTeamWinrates.ts`（不重写）

### 5.5 全局 / Provider 分布

- ✅ B.13 全 stage 完成后 Provider telemetry：DeepSeek ≥ 85%，claude-haiku ~10%，Minimax ≤ 5%
- ✅ KV 月度成本不超 B.12 基线 +30%
- ✅ Vercel function invocations 不超 B.12 基线 +50%

---

## § 6 Stage 1 实现详情（公开体验清理）

### 6.1 任务列表 T###

- T101 [P0] 移除 V10 board 所有 dataStatus / "暂时不可用" / "缺失" UI 露出
- T102 [P0] **generation pipeline 层**修 fallback rationale public 暴露：`evidenceDispatcher` mandate / data-status text / 角色 prompt fallback wording 改为专业措辞（v1.1 修正 — 不只是 UI 隐藏，是 pipeline 修生成内容）
- T103 [P1 audit] PM trade decision provider audit：confirm `resolvePMProviderSelection` 已 map claude-haiku，移除 `claude-opus` requested 误导 wording（v1.1 修正：原 P0 → P1，因实际已实装）
- T104 [P0] teamRegistry 9 个当前 Minimax-default role 改 deepseek（v1.1 修正措辞：是"当前 9 Minimax-default"，不是"9 LLM role"）
- T105 [P0] PM 不强等 evidence pack：evidence rules 层 + PM prompt 双修

### 6.2 关键文件

- `src/modules/agent-watch/components/DispatchConsoleV10.tsx` — UI 露出清理
- `src/modules/agent-watch/AgentWatchBoard.tsx` — 错误处理 silent 化
- `src/lib/team/evidenceDispatcher.ts`（或 B.12 实装实际路径）— mandate / data-status text 改专业措辞
- `src/lib/team/teamRegistry.ts` — 9 个 Minimax-default 改 deepseek
- `src/lib/llm/generateText.ts` — providerOverride 已实装（B.12 v1.1），audit claude-haiku branch
- `src/lib/team/pmTradeDecision.ts`（或 B.12 spec 实际位置）— `resolvePMProviderSelection` audit
- `src/i18n/dicts/*` — 移除 "暂时不可用" / "缺失" 相关 key（10 个 locale 同步含 en_XA）
- `docs/agent-ip/team/*.md`（14 文件）— 各角色 prompt fallback wording 改专业措辞

### 6.3 Anti-Rationalization（Stage 1）

| 逃逸路径                                   | 为什么不行                                                                                                                               | 正确做法                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 只在 UI 层隐藏 dataStatus，不修 generation | Codex 实测发现 `rationaleByMember` 已含 `暂时不可用` backend 措辞——这是写进 history wall 的，UI 隐藏掉但 history wall 仍是 contamination | 必须修 generation pipeline（evidenceDispatcher / 角色 prompt fallback 文案） |
| Silent fallback = 把错误吞掉不记录         | 错误必须 log，只是 UI 不弹                                                                                                               | log 到 console.error + Sentry（如有），UI 显示 last cached state             |
| PM 不强等 = 直接 skip 所有 evidence        | 不强等 ≠ 不读，是允许部分 timeout                                                                                                        | 设 evidence pack timeout（e.g. 5s），timeout 后 PM 用已收到的部分决策        |
| T103 既然已 resolve haiku 就跳过           | wording 误导仍在 UI / log，需 audit + clean                                                                                              | audit 实测 + 移除 `claude-opus` requested 文本                               |

---

## § 7 Stage 2 实现详情（Role identity，v1.1 升 Stage 2）

### 7.1 任务列表 T###

- T201 [P0] `src/lib/team/teamRegistry.ts` 扩 schema 加 `persistentPersonality`：
  ```ts
  interface PersistentPersonality {
    riskBias: "conservative" | "balanced" | "aggressive";
    focusStyle: "data-heavy" | "story-heavy" | "contrarian";
    voiceTone: "terse" | "analytical" | "dramatic" | "skeptical";
  }
  ```
- T202 [P0] 14 个 actual `TeamMemberId` persistentPersonality 全填（F 在 § 7.2 给出真表，**Codex 严格按表填，不自己编**）
- T203 [P0] 修改 `docs/agent-ip/team/{TeamMemberId}.md` 14 文件：每个角色 prompt **顶部**注入 persistentPersonality 段：

  ```
  ## 你的持续性格

  - 风险偏好：{{riskBias}}
  - 思考风格：{{focusStyle}}
  - 语气风格：{{voiceTone}}

  重要：你输出的 oneLineSummary 和 detailedRationale 必须保持上述持续性格。
  不要为了"客观"而抹平角色色彩。在多空辩论 / 复盘 / 数据解读中坚持这套定位。
  ```

- T204 [P0] `oneLineSummary` 角色口吻验证：Stage 2 完成后立即触发一次 PM run，新 records 写入 history wall 时是 identity-rich 而非 flat
- T205 [P0] UI / dispatch payload 保 14 source `TeamMemberId`（不在 v10 visual layer 压缩到 12 visual roles）
- T206 [P0] 人工评审 14 条 oneLineSummary 能猜对角色 ≥ 10/14

### 7.2 14 角色 persistentPersonality 真表（v1.1 用 actual TeamMemberId）

| TeamMemberId            | 中文 display     | riskBias     | focusStyle  | voiceTone  |
| ----------------------- | ---------------- | ------------ | ----------- | ---------- |
| `fundamental_analyst`   | 基本面研究主管   | balanced     | data-heavy  | analytical |
| `news_analyst`          | 宏观情报分析师   | balanced     | story-heavy | terse      |
| `chart_analyst`         | 技术策略主管     | balanced     | data-heavy  | terse      |
| `onchain_analyst`       | 链上数据分析主管 | balanced     | data-heavy  | terse      |
| `research_lead`         | 策略研究主管     | balanced     | story-heavy | analytical |
| `risk_lead`             | 风控总监         | conservative | data-heavy  | analytical |
| `pm`                    | 首席投资官       | balanced     | data-heavy  | analytical |
| `bullish_researcher`    | 多头研究总监     | aggressive   | story-heavy | dramatic   |
| `bearish_researcher`    | 空头研究总监     | conservative | contrarian  | skeptical  |
| `trader`                | 交易策略总监     | balanced     | data-heavy  | terse      |
| `aggressive_reviewer`   | 收益进攻总监     | aggressive   | story-heavy | dramatic   |
| `neutral_reviewer`      | 组合平衡总监     | balanced     | contrarian  | analytical |
| `conservative_reviewer` | 风险防御总监     | conservative | data-heavy  | skeptical  |
| `memory_loop`           | 策略复盘总监     | balanced     | contrarian  | skeptical  |

**v1.1 关键修正（vs v1.0）**：v1.0 表用产品 label（Bullish Lead / Quant Trader / PM Reviewer 等）和 actual `TeamMemberId` 不匹配，Codex Round 1 调研得到真 id 后 F 全表重写。**Codex 严格按本表填，不可改 mapping、不可改字段值**。

### 7.3 关键文件

- `src/lib/team/teamRegistry.ts` — schema 扩 + 14 角色填
- `docs/agent-ip/team/*.md`（14 文件）— prompt 顶部注入
- `src/modules/agent-watch/components/*.tsx` — UI/dispatch payload 保 14 source id
- `src/modules/agent-watch/dispatch/*.ts`（visual layer mapping） — 不能压缩 14 → 12

### 7.4 Anti-Rationalization（Stage 2）

| 逃逸路径                                     | 为什么不行                                                                | 正确做法                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Codex 自编 persistentPersonality 替 § 7.2 表 | F 已经定，Codex 仅执行                                                    | 严格按 § 7.2 表填，不可改                                                             |
| Prompt 注入加在角色 prompt 中段 / 尾部       | 顶部注入才有持续效应（LLM 注意力 primacy）                                | 必须顶部                                                                              |
| 14 → 12 visual role 压缩时 personality 丢失  | research_lead / risk_lead 在 v10 visual layer 没独立 visual id 会被 merge | dispatch payload 保 14 source id，visual layer 仅做 display fold-up，personality 不丢 |
| oneLineSummary 只翻译角色名不改语气          | 角色名一样但 voice 同质化 = 又回到产品同质化                              | T206 必须人工评审 ≥ 10/14 能猜对                                                      |
| 14 角色不全填                                | 缺一个 = 该角色 prompt 缺 persistent                                      | 14/14 全填，缺即不通过                                                                |

---

## § 8 Stage 3 实现详情（Cache+Fetch + Candidate Execution，v1.1 调到 Stage 3）

### 8.1 任务列表 T###

- T301 [P0] symbolMapping.ts 扩展 BTC/ETH/SOL/HYPE/BILL/IRYS + executable metadata
- T302 [P0] Candidate pool 过滤逻辑：Execution mode → CoinW filter，非 executable 标记 watch-only
- T303 [P0] 新建 `src/app/api/watch/refresh/route.ts`：
  - **POST canonical trigger**，GET status-only
  - 输入 query: `symbol`, `locale`
  - 输出：`{status, lastDecisionAt, nextAllowedAt, refreshStarted, refreshSource}` (5 status enum)
  - **Serverless-safe scheduling**：用 Next 14 `after()` API（如可用）或 queue handoff，**禁止** plain `void triggerPmDecisionPipelineOnce()`
  - **Lock ordering 5 步**：
    1. rate limit check（6 req/min/IP，复用 `kv-rate-limiter.ts`）
    2. in-flight lock check (5min KV) → 已锁 return `{status: refreshing}`
    3. freshness check (< 15min) → return `{status: cached}`
    4. cooldown / locale lock check (5-10min) → 已锁 return `{status: locked}`
    5. per-symbol pmDecisionTrigger 170min lock check → 已锁 return `{status: locked}`
    6. 全过 → acquire cooldown + in-flight lock → schedule background trigger (after/queue) → return `{status: stale, refreshStarted: true}`
    7. failure → release in-flight lock
- T304 [P0] `/api/watch/timeline` + `/api/watch/stream` 保持 read-only（grep + 单元测试确认）
- T305 [P0] V10 board mount 时 fire 一次 visible-session freshness 触发：
  - `useEffect` on mount + visibility change
  - sessionStorage key = `freshness-trigger-{locale}-{symbol}`，避免 hidden-tab 重复触发
  - 不每次 polling 触发
- T306 [P0] UI 文案 i18n 10 locale 全 cover（含 en_XA）：
  - `analyzedAgo` (e.g. "分析于 5 分钟前")
  - `newAnalysisRunning` (e.g. "新分析进行中")
  - `autoRefreshOnComplete` (e.g. "完成后自动刷新")
  - `cachedStateLabel` (e.g. "缓存数据")
- T307 [P0] KV-backed lock 实装：
  - `setKvLock(key, ttlMs)`
  - `checkKvLock(key)`
  - `releaseKvLock(key)`（fire-and-forget 完成后释放 in-flight lock）
  - 复用 `kv-lock.ts` 基础
- T308 [P0] **watch-only safety**（v1.1 升 P0）：watch-only symbol UI marker + follow-trade button 严格不渲染
- T309 [P0] Freshness source derive：从 strategy records / timeline projection derive，或新建 materialized freshness key + writer update。**禁止假设** `latest_decision:{locale}` 已存在
- T310 [P0] Single freshness derivation 单元测试 + 5 status enum 单元测试

### 8.2 b74023a 灵感 vs 不复用

- ✅ 复用 pattern：cache-first + background fetch + debounce + visible freshness state
- ❌ 不复用机械：不要让 V10 重连 `/api/agents/analysis`
- ✅ 新写 `/api/watch/refresh` 作为 dedicated freshness trigger layer
- ✅ V10 保持 timeline-driven

### 8.3 Anti-Rationalization（Stage 3）

| 逃逸路径                                         | 为什么不行                                                 | 正确做法                                                          |
| ------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| 在 `/api/watch/timeline` 内部加 trigger          | timeline 是 read-only display source                       | 新建 `/api/watch/refresh`，明确分离读写                           |
| `void trigger()` fire-and-forget                 | Vercel serverless 函数 response 后被 kill，后台任务不可靠  | 必须 `after()` API / queue / cron handoff                         |
| Lock 只用 process memory                         | Vercel serverless 不共享内存                               | 必须 Upstash KV 写 lock，TTL 自动过期                             |
| Lock ordering 随意                               | 顺序错会出现 deadlock 或重复 trigger                       | 严格按 § 8.1 T303 5 步顺序                                        |
| GET 写 refresh state                             | cache/proxy 破坏，GET 应 idempotent                        | POST canonical trigger，GET 仅 status                             |
| Freshness 假设 `latest_decision:{locale}` 已存在 | 当前 source 是 strategy records / timeline，不一定有该 key | derive from records，或新建 materialized key + writer 更新        |
| 每次 visible 都触发 refresh                      | UI polling 30s 会重复触发，超 rate limit                   | session-level dedupe + sessionStorage 标记 + symbol/window 分粒度 |
| 把 long-tail symbol 直接从 candidate pool 移除   | 用户可能想 watch BILL/IRYS 长尾                            | 保留 pool + executable: false + UI 严格不可 follow-trade          |
| watch-only symbol 仍渲染 follow button           | safety critical，错点会发起跟单 unknown long-tail          | follow-trade 按钮 render 条件 grep watch-only flag                |

---

## § 9 Stage 4 实现详情（Memory loop 真学习，v1.1 调到 Stage 4）

### 9.1 任务列表 T###

- T401 [P0] 新建 `src/lib/team/memoryLoopEvidence.ts`：
  - export `fetchMemoryContext(symbol: string): Promise<MemoryContext>`
  - **Source**：decision records / history endpoint（如 `decision-history` route），**不假设** `history_wall:{symbol}` KV key
  - 复用 `computeTeamWinrates.ts` 纯 aggregator（不重写）
  - 输出 schema 含 `sampleSizeCaution: boolean`（v1.1 新增）
- T402 [P0] evidenceDispatcher 集成 memory context：
  - PM role 的 evidence pack 调用 `fetchMemoryContext(symbol)`
  - **关键**：memory context 与现有 evidence 分离段，不 repeat 前 5 轮 evidence
  - PM prompt template 加 memory context 段（natural language）
- T403 [P0] PM prompt 10 locale 翻译（含 en_XA），prompt source = `docs/agent-ip/team/memory_loop.md`
- T404 [P0] **Team Track Record 紧凑 summary UI**（v1.1 拆分）：
  - 新建 `src/modules/agent-watch/components/TeamTrackRecordPanel.tsx`
  - 紧凑展示：14 角色每行 = 头像 + 名 + 样本量 + last5_winrate% + lifetime_winrate% + sample caution badge（sparse history 时）
  - 折叠 / 侧边 / hover，**不抢主视觉**
- T405 [P1] Track record UI hover detail：lazy load 完整 history（如时间允许 Stage 4 内交付，否则推 B.14）
- T406 [P1] team_winrates KV 缓存 5min，跳过 hot recompute
- T407 [P1] memory regression tests：sample-size sparse 场景测试（HYPE 1 record / 新 symbol 0 record 等）

### 9.2 关键文件

- `src/lib/team/memoryLoopEvidence.ts` — 新建
- `src/lib/team/evidenceDispatcher.ts` — 集成 memory context 段
- `docs/agent-ip/team/memory_loop.md` — memory_loop 角色 prompt 更新
- `src/i18n/dicts/*` — 10 locale memory context 段翻译
- `src/modules/agent-watch/components/TeamTrackRecordPanel.tsx` — 新建紧凑 summary
- `src/lib/team/computeTeamWinrates.ts` — 复用 aggregator 逻辑（不重写）

### 9.3 Anti-Rationalization（Stage 4）

| 逃逸路径                                             | 为什么不行                                                       | 正确做法                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| 把 evidence dispatcher 直接改成全角色读 memory       | 仅 PM 读，其他角色读不对应                                       | 只在 PM evidence pack 内集成 memory context                         |
| memory context 写死中文                              | 10 locale 都要（含 en_XA）                                       | i18n 同步处理                                                       |
| track record UI 抢主视觉                             | 决策才是主体                                                     | 折叠 / 侧边 / hover 出，不打断决策阅读                              |
| 重写 winrate 计算逻辑                                | `computeTeamWinrates.ts` 已存在（B.7）                           | 必须复用，不重写                                                    |
| 把 legacy records 算作 team track record win         | Codex 实测确认 `computeTeamWinrates` 已 exclude legacy，原因充分 | 紧凑 summary 仅算 non-legacy；如要包含 legacy 必须独立 labeling     |
| Sparse history（HYPE 1/8 records）不显 caution badge | 1 sample 显 100% win 误导用户                                    | sample-size aware，sparse 时显 "首周样本不足，胜率仅供参考" caution |
| 假设 `history_wall:{symbol}` KV key 已存在           | 真实 source 是 decision records / history endpoint               | 通过 history endpoint / decision records 取，不假设 KV key          |

---

## § 10 § 11 § 12（v1.1 明确合并）

按 claude-codex-protocol v2.5 协议，§ 10/§ 11/§ 12 在 umbrella spec 内**明确合并**到其他段落：

- **§ 10 测试策略** → 各 Stage T### 内含单元测试 task（T310 / T407 等）+ § 5 验收 + § 15 checklist
- **§ 11 部署计划** → 4 个独立 PR + 各 stage 在 Vercel preview 拿 URL 给 Dan 验收 + Constitution Rule 2 v0.1.2 严格执行（preview 自由 / prod 等 Dan 显式授权）
- **§ 12 时间估算** → § 1.4 / Codex Round 1 估计区间 10-15 AI 天

如 Codex Round 2 评估发现 § 10/§ 11/§ 12 单独段必须立，再 v1.2 加。

---

## § 13 不能做（冻结清单，v1.1 扩展）

1. **不能 reconnect `/api/agents/analysis` 作为 V10 数据源**（Codex 明确警告，会让 cost 失控）
2. **不能动 cron `0 */3 * * *` schedule**（本 spec 仅做 visit-trigger 层）
3. **不能引入第三个 LLM provider**
4. **不能在 `/api/watch/timeline` 或 `/api/watch/stream` 内加 trigger**
5. **不能合并 4 个 stage 为单 PR**（4 stage 4 PR，回滚粒度）
6. **不能改 NewsItem schema / SourceRegistry / Win-rate 计算公式**（Constitution Rule 4 冻结项）
7. **不能擅自 prod deploy**（Constitution Rule 2 v0.1.2 严格执行：Dan chat 显式授权才推）
8. **不能修改 § 7.2 14 角色 persistentPersonality 真表**——Codex 仅执行，不编
9. **不能 process-memory-only lock**（Vercel serverless 不共享内存）
10. **不能改 i18n 默认策略**（10 locale 含 en_XA 同步，不能只翻部分）
11. **不能 plain fire-and-forget background task** — Vercel 函数 response 后会 kill，必须 `after()` / queue / cron handoff
12. **不能让 backend fallback rationale 流入 public payload**（如 `暂时不可用，使用中性占位继续生成决策`）
13. **不能把 `${symbol}_USDT` fallback 字符串拼接当 CoinW executable**——必须真 metadata `{executable: true}` 标记
14. **不能把 legacy records 算作 team track-record win**——`computeTeamWinrates` 已 exclude legacy，原因充分
15. **不能把 role prompts 从 `docs/agent-ip/team/*.md` 移走**——prompt 唯一权威源
16. **不能在 v10 visual layer 12 visual roles 压缩 14 source `TeamMemberId`**——personality 必须在 14 source id 全保留
17. **不能让 watch-only symbol 渲染 follow-trade 按钮 / 跟单 affordance**——safety critical
18. **不能假设 `latest_decision:{locale}` 或 `history_wall:{symbol}` KV key 已存在**——必须从 strategy records / timeline / decision-history endpoint derive

---

## § 14 Constitution 对照检查

| Rule                   | Check                                                                                                                  | 答                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Rule 1 部署身份        | 4 stage 全 preview，prod 等 Dan chat 授权才推                                                                          | **PASS** preview 不需授权                                                                |
| Rule 2 生产保护 v0.1.2 | 全 preview，prod 不动                                                                                                  | **PASS** 仅 preview                                                                      |
| Rule 3 视觉与品牌      | UI 改动仅在 V10 board 内部，不动 Hero / brand                                                                          | **PASS** 不触发                                                                          |
| Rule 4 数据与 schema   | teamRegistry / evidence pack 是 active schema，扩字段 OK；NewsItem / Win-rate 公式 / SourceRegistry 冻结，本 spec 不动 | **PASS** 扩 active schema，不动冻结项                                                    |
| Rule 5 AI 诚实性       | Provider 失败 / KV 失败 / memory loop 失败 / persistentPersonality 缺失 / after() 不可用，每条都有 fallback            | **PASS** § 3.4 列全（含 v1.1 新增 after() 降级路径）                                     |
| Rule 6 协作闭环        | Codex Round 1 已评估 + F 整合 v1.1 + 双脑判断留痕；Codex Round 2 可选                                                  | **PASS** v1.1 已整合 Round 1                                                             |
| Rule 7 验证门槛        | § 12 验收完整？UI 改动有 screenshot 路径？埋点 PostHog event？                                                         | **PASS** § 5 含 measurable，UI screenshot 在 staging preview 验，Provider telemetry 已有 |

---

## § 15 验收 Checklist

- [ ] § 5.1 Stage 1 全部 6 项 ✅
- [ ] § 5.2 Stage 2 Role identity 全部 6 项 ✅（v1.1 升 Stage 2）
- [ ] § 5.3 Stage 3 Cache+Fetch 全部 8 项 ✅（v1.1 调到 Stage 3）
- [ ] § 5.4 Stage 4 Memory loop 全部 7 项 ✅（v1.1 调到 Stage 4，紧凑 summary P0 + hover P1）
- [ ] § 5.5 全局 / Provider 分布 3 项 ✅
- [ ] Constitution § 14 7 条 PASS
- [ ] § 13 不能做清单 18 条 0 违反（v1.1 从 10 条扩到 18 条）
- [ ] 4 个独立 PR，4 stage 分别 squash merge 到 main
- [ ] 每个 stage 在 vercel preview 拿 URL 给 Dan 验收
- [ ] Provider telemetry 数据落 KV 可查询
- [ ] decision-log.md 4 stage 完成各加一条 entry

---

## § 16 老板简报

claw42 工作台决策能力本周升级。

本次做了啥：

- 工作台不再露 "暂时不可用" / "缺失" 等后台字眼，用户进站直接看团队决策结论，体验干净。
- 14 位 Agent 团队带上持续性格——保守派始终保守、激进派始终激进、复盘官始终爱抬杠，决策有戏剧张力不再千篇一律。
- 用户访问工作台会触发"新分析进行中"的可视刷新，看得到团队在为你工作，而不是死板的固定快照。
- 团队历史战绩在工作台显示，每位 Agent 的过往胜率一目了然，样本不足时会明确提示用户"首周参考"。

后续规划：接下来推多空辩论戏剧化（多空两派当面对线）和 6 阶段决策仪式感（数据→辩论→量化→复盘→决策→跟单完整流程），让"多 Agent 协作"成为 claw42 的杀手锏。

---

## § 17 Anti-Rationalization 总表（v1.1 扩展）

| 逃逸路径                                                                       | 为什么不行                                                           | 正确做法                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| F 估错 stage 边界，Codex 自作主张拆                                            | 4 stage 已定，拆边界=破回滚粒度                                      | Codex Round 1 提议合并/拆分，F 决策；Round 2 同                          |
| Codex 跳过 Round 1/2 直接实现                                                  | 协议要求 evaluation pass 才动手                                      | F 收 Codex Round 1 report 后 v1.1（已完成），如需 Round 2 类同           |
| 觉得 4 stage 太多，先做 1+2                                                    | Dan 明确"大批量 = Codex 持续开发"                                    | 4 stage 必须全跑，单 PR 单 stage                                         |
| persistentPersonality 注入 token 怕超限就 skip                                 | 容易 prompt 退化到原版                                               | truncate 不 skip，保 voice 核心                                          |
| memory loop evidence pack 偷懒读现有 evidence                                  | 现有 evidence 是 raw data，memory 是 derived insight                 | 必须新建 memoryLoopEvidence.ts                                           |
| 把 dataStatus 字段彻底从 schema 删                                             | backward compat 破坏                                                 | schema 留字段，UI 不读                                                   |
| `/api/watch/refresh` 把 timeline 数据一起返回                                  | 违反 read/write 分离原则                                             | refresh 只返 freshness 状态                                              |
| symbolMapping 加 BILL/IRYS 但不 mark watch-only                                | safety critical，会让 follow-trade 跟入 unknown long-tail            | executable: false metadata 严格 mark                                     |
| 14 角色 voice 复制粘贴同样描述                                                 | 角色色彩抹平 = 又回到产品体验同质化原因                              | § 7.2 14 行各不同，Codex 严格按表                                        |
| **v1.1 新增**：identity 在 v10 visual layer 12 角色压缩丢失                    | research_lead / risk_lead 等 personality 会被 merge 丢               | dispatch payload 保 14 source TeamMemberId，visual layer 仅 display fold |
| **v1.1 新增**：fallback rationale 通过 generation pipeline 流入 public payload | UI 隐藏 ≠ history wall 干净，下次 memory loop 喂的就是 contamination | T102 修 evidenceDispatcher / 角色 prompt fallback wording 改专业措辞     |
| **v1.1 新增**：plain `void trigger()` fire-and-forget                          | Vercel 函数 response 后 kill，trigger 不可靠                         | `after()` / queue / cron handoff，spec 必须明示                          |
| **v1.1 新增**：先做 refresh 再做 identity                                      | refresh 写新 records 没 identity，memory loop 喂扁平 baseline        | v1.1 stage 顺序：identity 升 Stage 2 早于 refresh                        |
| **v1.1 新增**：legacy records 算作 win 拉高紧凑 summary win-rate               | `computeTeamWinrates` 已 exclude legacy 原因充分                     | 严格 exclude legacy；如需含 legacy 必须独立 labeling                     |
| **v1.1 新增**：sparse history（HYPE 1 record）不 sample-caution badge          | 1 sample 100% win 视觉欺骗                                           | sampleSizeCaution 字段 + UI 显式 "首周样本不足"                          |

---

## § 18 Decision-Log 联动

本 spec 全 stage 完成后，`web-dev/decision-log.md` 添加 entry：

```
[2026-MM-DD] [架构] B.13 multi-agent soul uplift 4 stage 闭环（v1.1 重排顺序）
决策：Stage 1-4 全 PR merged，多 Agent 协作产品灵魂 5 层中 L1 + L2 + L3 落地
理由：Dan 2026-05-15 chat "多 Agent 分析协作是整个产品的灵魂" 重新定义产品方向
v1.0 → v1.1 反转 stage 顺序：role identity 早于 refresh + 14 actual TeamMemberId 对齐 + serverless-safe scheduling
影响：
- Provider 分布 DeepSeek ≥ 85% / claude-haiku ~10% / Minimax ≤ 5%
- 工作台用户进站感知"团队正在工作"，dataStatus / "暂时不可用" 等后台字眼移除（generation pipeline 层修，非 UI 隐藏）
- 14 角色带 persistent personality（actual TeamMemberId），oneLineSummary 真带角色色彩
- Memory loop 闭环：strategy records → memoryLoopEvidence → PM prompt
- /api/watch/refresh serverless-safe（after()/queue）+ 5 status enum + KV-backed lock 5 步 ordering
- 14 source TeamMemberId 在 dispatch payload 保留（v10 visual layer 仅 fold display）
- B.14 L4 多空辩论 / B.15 L5 6 阶段仪式感 接下来推
源：spec-watch-B13-multi-agent-soul-uplift.md v1.1 / Codex Round 1 评估 codex-to-claude.md lines 9888-10222 / 4 PR squash sha
```

每 stage 单独 merge 时也加一条 sub-entry。

---

## § 19 Tasks 索引（v1.1 调整后）

| Task | Stage           | Priority     | Story                                                                      |
| ---- | --------------- | ------------ | -------------------------------------------------------------------------- |
| T101 | 1 公开体验      | P0           | UI dataStatus 清扫                                                         |
| T102 | 1 公开体验      | P0           | **generation pipeline 修 fallback rationale public 暴露**（v1.1 措辞强化） |
| T103 | 1 公开体验      | **P1 audit** | PM trade decision claude-haiku audit（v1.1 P0 → P1）                       |
| T104 | 1 公开体验      | P0           | 9 Minimax-default role → DeepSeek（v1.1 措辞修正）                         |
| T105 | 1 公开体验      | P0           | PM 不强等 evidence（rules 层 + prompt 双修）                               |
| T201 | 2 Role identity | P0           | teamRegistry persistentPersonality schema                                  |
| T202 | 2 Role identity | P0           | 14 actual TeamMemberId 全填（按 § 7.2）                                    |
| T203 | 2 Role identity | P0           | docs/agent-ip/team/\*.md 14 文件顶部注入 persistent                        |
| T204 | 2 Role identity | P0           | Stage 2 完成立即触发 PM run + history wall 验证 identity-rich              |
| T205 | 2 Role identity | P0           | UI / dispatch payload 保 14 source TeamMemberId                            |
| T206 | 2 Role identity | P0           | oneLineSummary 角色口吻人工评审 ≥ 10/14                                    |
| T301 | 3 Cache+Fetch   | P0           | symbolMapping 含 executable metadata                                       |
| T302 | 3 Cache+Fetch   | P0           | Candidate pool Execution mode filter                                       |
| T303 | 3 Cache+Fetch   | P0           | /api/watch/refresh + serverless-safe + 5 status enum + 5 步 lock           |
| T304 | 3 Cache+Fetch   | P0           | timeline/stream read-only 验证                                             |
| T305 | 3 Cache+Fetch   | P0           | V10 mount visible-session freshness trigger                                |
| T306 | 3 Cache+Fetch   | P0           | UI 文案 10 locale i18n（含 en_XA）                                         |
| T307 | 3 Cache+Fetch   | P0           | KV-backed lock 实装（复用 kv-lock.ts）                                     |
| T308 | 3 Cache+Fetch   | **P0**       | watch-only safety UI marker + follow-trade 严禁渲染（v1.1 P1 → P0）        |
| T309 | 3 Cache+Fetch   | P0           | Freshness source derive from records/timeline（不假设 KV key）             |
| T310 | 3 Cache+Fetch   | P0           | 5 status enum + lock ordering 单元测试                                     |
| T401 | 4 Memory loop   | P0           | memoryLoopEvidence.ts 新建（含 sampleSizeCaution）                         |
| T402 | 4 Memory loop   | P0           | evidenceDispatcher 集成 memory context（与现有 evidence 分离）             |
| T403 | 4 Memory loop   | P0           | memory_loop prompt 10 locale 翻译                                          |
| T404 | 4 Memory loop   | P0           | **紧凑 summary** TeamTrackRecordPanel + sample-caution badge（v1.1 拆分）  |
| T405 | 4 Memory loop   | P1           | Hover detail lazy load（如时间允许 Stage 4 否则推 B.14）                   |
| T406 | 4 Memory loop   | P1           | team_winrates KV 缓存 5min                                                 |
| T407 | 4 Memory loop   | P1           | Memory regression tests（sparse sample 场景）                              |

**v1.1 task 统计**：

- Stage 1：5 个（4 P0 + 1 P1 audit）
- Stage 2：6 个（全 P0）
- Stage 3：10 个（全 P0）
- Stage 4：7 个（4 P0 + 3 P1）

总：**28 tasks**（22 P0 + 1 P1 audit + 5 P1）。

Codex Round 2（如有）可建议合并 / 拆分。

---

## v1.1 决策留痕

**v1.0 → v1.1 接受全部 Codex Round 1 反馈**（F 双脑判断 0 push back）：

| Codex 建议                           | F 判断 | 落实位置                                 |
| ------------------------------------ | ------ | ---------------------------------------- |
| Stage 顺序：identity 早于 refresh    | 接受   | § 1.3 reorder + § 7 / § 8 / § 9 内容互换 |
| § 9.2 → § 7.2 14 actual TeamMemberId | 接受   | § 7.2 重写 14 行真表                     |
| /api/watch/refresh serverless-safe   | 接受   | § 8.1 T303 + § 13 #11                    |
| § 10/§ 11/§ 12 placeholder           | 接受   | § 10/§ 11/§ 12 明确合并链接              |
| T103 P0 → P1 audit                   | 接受   | § 6.1 + § 19                             |
| T208 P1 → P0 watch-only safety       | 接受   | § 8.1 T308 + § 19                        |
| T304 紧凑 summary + hover 拆分       | 接受   | § 9.1 T404 + T405                        |
| T401 sample-size aware               | 接受   | § 9.1 T401 + schema sampleSizeCaution    |
| i18n 10 locale 含 en_XA              | 接受   | § 5 + § 6.2 + § 8.1 T306 + § 9.1 T403    |
| § 13 加 5 条 cannot-do               | 接受   | § 13 从 10 条扩到 18 条                  |

---

_版本：v1.1 (2026-05-15 Codex Round 1 反馈整合，F 双脑判断接受全部建议)_
_下一步：派 Codex Round 2 评估（可选）→ Dan APPROVED → Codex 持续开发 4 stage_
