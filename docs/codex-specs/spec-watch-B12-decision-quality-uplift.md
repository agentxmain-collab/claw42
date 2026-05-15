# spec-watch-B12-decision-quality-uplift (v1.0 · 2026-05-15)

> **B.12 — 决策质量大重构：Typed evidence + Role-specific prompt + Provider routing fix + UI 信息层级化**
>
> 触发：Dan 看 staging preview 真 LLM 决策（BILL 完整 trace）发现 14 角色同质化严重 + UI 信息密 + 字体小。Codex 2026-05-15 grep prep 揭示：claw42 现有 news/market/evidence/public timeline/provider telemetry 框架已存在，**B.12 不是"从零接 evidence"，是"激活已有资产 + 硬化"**。
>
> **核心范围**（6 件事打包）：
>
> - **数据层 Typed evidence context pack**：把现有 evidence 按 role 分类打包（chart 拿 kline+TA / news 拿 news items / 等），不再 14 角色看同一坨 raw evidence
> - **逻辑层 Role-specific prompt routing**：14 角色 system prompt 强约束视角 + 强制 JSON 结构化输出（`direction / confidence / oneLineSummary / detailedRationale`）
> - **Provider routing fix**：修 PM pipeline 把 `teamRegistry.defaultProvider` 传 LLM wrapper（B.10 P2 暴露的 known limit）
> - **数据层 Onchain/Fundamental 接入**：Etherscan + DefiLlama 接入（Dan 提供 key / 公开 API）；evidence schema 留位；未接入的角色（如 fundamental 数据不足时）UI 显示"暂无 X 数据"清晰标识
> - **视觉层 v10 UI 信息层级化**：MessageBubble L1（大字号 direction badge + confidence + oneLineSummary）/ L2（当前字号 detailedRationale）分层；Topic 标题分层短 title + explanation 折叠；展开按钮 layout 修；底部 chip 区域 explanation 重复渲染清理
> - **i18n**：L1 标签（LONG/SHORT/WAIT / 做多/做空/观望 10 locale）+ 角色视角标签 + 数据缺口标签
>
> **不在范围**：
>
> - 新加 LLM provider（Anthropic / OpenAI 留后续 spec，B.10 P2 telemetry 数据出来再决定）
> - Multi-round prompt 大改（保 B.3 schema 已立的 multi-round + dual-shape 兼容；prompt 改约束级别）
> - 真 trade execution / follow-trade 接 CoinW API（B.8 mock 留位，不动）
> - prod 部署（按 Constitution v0.1.2 Rule 2，B.12 完成后 Dan 显式授权才 --prod）
> - v9 视觉权威架构（hero / constellation / flow 视觉 freeze，仅改 MessageBubble + Topic / MarketAnalysisPanel L1/L2 渲染）
>
> **架构定位**：B 模块决策质量大重构 phase。base main HEAD = `2e055b09b1921b147ebb8339aaf8bdc778d6d67a`（B.10 完成后状态）。
>
> **决策档案**：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md` 2026-05-15 entry 含 Dan 看 BILL trace 反馈 + 6 件事整合范围 Dan 拍板。

---

## 0. 必读纪律

### 0.1 三层防御

- **层 1 跨域刷新**：每 sub-phase 开始前 cat 实测主 schema 文件 + adapter 文件（Codex grep prep 已给位置，仍要 re-cat 确认）
- **层 2 首件检验**：第一个 analyst（如 chart analyst）typed evidence + role-specific prompt + L1/L2 渲染落地后端到端跑 1 个 decision 验证，再批量
- **层 3 同根因熔断**：同类 prompt 漂移 / schema 字段缺失连续出现 2 次 → 立即停 + 退到 schema/prompt 对照表重做

### 0.2 双脑诊断

Codex 实施前必须自己下判断 + 写到 codex-to-claude.md（§ 18 列必填判断点）。

### 0.3 Anti-rationalization

- "evidence 接入太复杂顺便砍 onchain" → ❌ Dan 拍 4 类 evidence 都接 + 用 free tier key
- "prompt 改一改就行不用强约束角色视角" → ❌ 当前 14 角色同质化的根因 = prompt 没强约束，必须显式约束"chart analyst 只看 TA 不评 news"
- "L1/L2 分层 UI 是 polish 留 backlog" → ❌ Dan 明确 UI 信息层级化是 B.12 核心范围，不能砍
- "provider routing fix 等 Anthropic key 来一起做" → ❌ DeepSeek + Minimax 当前可调，先修 routing
- "schema 改太大 v2.1 不向后兼容" → ❌ AnalystInputRoundRecord 加新字段必须 v1 / v2 / v2.1 dual-shape 兼容
- "数据缺口角色让它说'数据不足'就行" → ❌ "数据不足"含糊话是当前同质化的根因；缺口要在 evidence 层显式标识 + UI 显示"暂无 X 数据"角色不需自己说

---

## 1. Summary

把 B 模块从"14 角色名义存在 + free-form 文本 + 全角色看同一坨空 evidence + 100% DeepSeek + 决策同质化"演进到"14 角色看 typed role-specific evidence + JSON 结构化输出 direction/confidence/summary/rationale + 真按角色分布走 LLM provider + L1/L2 UI 分层"。

**用户感知层**：

- 扫一眼 14 角色 L1 看 long / short / wait 分布 + confidence + 一句话立场（不读全文就能感知决策气氛）
- 想深究 → 展开 L2 看详细推理
- 数据缺口角色明示"暂无链上数据"（不再含糊 wait）
- Topic 标题简短 + 展开按钮不再重叠
- 多个 provider 跑出真不同视角（不再 100% DeepSeek 同一思维）

---

## 1.5 User Stories

### US-B12-1 — Typed evidence 让角色视角真分化（P1, MVP）

**作为** 看 watch 板的用户
**我希望** chart analyst 显示 TA 角度（K 线 / 量价）/ news analyst 显示新闻 sentiment / onchain 显示链上资金 / fundamental 显示 tokenomics，**不再每个角色都重复"缺基本面 / 缺链上"**
**这样** 14 角色真有视角差异化

### US-B12-2 — L1/L2 信息层级让用户扫读决策（P1）

**作为** 看 14 角色多 round + 多空辩论 + risk review + memory loop 完整 trace 的用户
**我希望** 每条 message 顶部一眼看到 LONG/SHORT/WAIT + confidence + 一句话立场，下方折叠详细推理
**这样** 我能 30 秒扫读决策分布，不用读 14 × 2 round × 5 段全文

### US-B12-3 — Provider 真按角色分布走（P2）

**作为** Dan / F session 想看决策真多样性
**我希望** chart analyst 走 DeepSeek（速度 + 数据感知）/ news analyst 走 Minimax（长文本 sentiment）/ 等按 teamRegistry 配置真分布，不再 100% fallback DeepSeek
**这样** 决策质量来自 LLM diversity，不是单一 model 思维

### US-B12-4 — 数据缺口诚实显示不绕话（P2）

**作为** 看决策的用户
**我希望** 缺 fundamental 数据时直接显示"暂无 fundamental 数据接入"标识，**不让 fundamental analyst 编"基本面缺失"的 wait 决策**
**这样** 我知道哪里是真分析 / 哪里是数据缺口

### US-B12-5 — Topic 标题清晰可读（P1）

**作为** 看 topic 卡片的用户
**我希望** 短标题"BILL 实时行情分析"在顶部 + 长 explanation"本轮优先分析 BILL: 24h波动 / 候选池：趋势加速池"折叠到副标题或展开区
**这样** 不再"标题一坨字 + 展开按钮重叠"

---

## 2. Acceptance Scenarios

### AC-B12-1 — Typed evidence 按 role 分发

**Given** B.12 merge 后，evidence pipeline 跑完
**When** chart analyst 跑 LLM call
**Then** prompt context 仅含 chart-related evidence（kline / TA indicators / volume / 价格） + 角色 system prompt 显式禁止评 news / fundamental
**And** news analyst prompt context 仅含 news evidence（CryptoCompare / CoinGecko news items + sentiment）
**And** onchain analyst prompt context 仅含 onchain evidence（Etherscan + DefiLlama TVL / 协议活动）
**And** fundamental analyst prompt context 仅含 fundamental evidence（DefiLlama protocol revenue + token unlock）

### AC-B12-2 — L1/L2 渲染

**Given** Analyst LLM 输出 JSON `{ direction: "long", confidence: 0.55, oneLineSummary: "趋势加速强势 但缺基本面支撑", detailedRationale: "BILL 24h涨幅..." }`
**When** MessageBubble render
**Then** L1 区域显示：[LONG] badge 绿色 + "0.55" confidence + "趋势加速强势 但缺基本面支撑"（大字号 18-20px + 高对比）
**And** L2 区域显示 detailedRationale 全文（当前字号 14-16px）
**And** L1 + L2 之间有视觉分隔

### AC-B12-3 — Provider routing 真分布

**Given** PM pipeline 跑 24-32 LLM call
**When** Telemetry 聚合
**Then** Provider 分布显示：DeepSeek X% / Minimax Y%（不再 100% DeepSeek）
**And** 每角色按 `teamRegistry.defaultProvider` 配置真路由（如 chart analyst → DeepSeek / news analyst → Minimax）

### AC-B12-4 — 数据缺口诚实显示

**Given** Etherscan key 未配 OR onchain adapter 返空
**When** onchain analyst 跑
**Then** evidence pipeline 检测到 onchain 缺口 → onchain analyst prompt 标记"data_status: missing" → LLM 输出 `{ direction: null, confidence: 0, oneLineSummary: "暂无 onchain 数据" }` （不编 wait 决策）
**And** UI 渲染显示明确缺口 badge（不是 wait + 含糊话）

### AC-B12-5 — Topic 标题分层

**Given** B.5 topicRanking 输出 `{ score, explanation: "本轮优先分析 BILL: 24h波动..." }`
**When** Topic 卡片 render
**Then** 顶部短 title（如"BILL 实时行情分析"由 v9TopicAdapter 从 symbol + 类型 生成）
**And** explanation 折叠到副标题或展开区（默认折叠，点展开按钮显示）
**And** 展开按钮跟标题 layout 不重叠
**And** 底部 chip 区域不再重复 explanation 文本

---

## 3. Edge Cases 4 轴

| 轴       | Edge Case                                                 | 处理                                                                                          |
| -------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Input    | LLM 输出非合法 JSON（free-form 文本回退）                 | Parser try/catch + fallback 把整段当 detailedRationale + L1 显示 "数据解析中" + dev warn      |
| Input    | LLM 输出 confidence > 1 / < 0                             | Clamp 到 [0, 1] + dev warn                                                                    |
| Input    | direction 是 union 之外的值（如 "neutral" / "uncertain"） | 映射到 wait + dev warn                                                                        |
| Input    | evidence 全空（4 类 source 都失败）                       | analyst prompt 标记 all_missing → LLM 输出 null direction + "无 evidence 可分析"（不编 wait） |
| State    | v1 / v2 老 record（没 oneLineSummary 字段）               | adapter dual-shape：v1 record 投到 v2.1 = oneLineSummary = rationale 截断前 50 字             |
| State    | provider 切换中（DeepSeek 暂时 fail，fallback Minimax）   | Telemetry 记录 fallbackCount + actual provider；不影响 L1/L2 渲染                             |
| Boundary | oneLineSummary 超 200 字（LLM 没遵守 length limit）       | 截断 + ellipsis + dev warn                                                                    |
| Boundary | detailedRationale 超 2000 字                              | 截断 + "查看完整" 链接（暂不实施，留 backlog）                                                |
| Failure  | Etherscan API rate limit hit                              | onchain evidence 标 stale + cache last successful → 仍向 prompt 注入但带 cache 标记           |
| Failure  | DefiLlama 返 500                                          | fundamental evidence 标 missing + 同 onchain 处理                                             |
| Failure  | 多个 evidence source 同时失败                             | analyst data_status = partial_missing + 显式 prompt 让 LLM 标识"部分数据缺失"                 |

---

## 4. Assumptions

1. base main HEAD = `2e055b09b1921b147ebb8339aaf8bdc778d6d67a`（B.10 完成后）
2. **已有资产可复用**（Codex grep prep 实测）：
   - News adapter（CRYPTOCOMPARE_API_KEY + COINGECKO_DEMO_KEY 已配）
   - Market adapter
   - Evidence context 框架
   - Public timeline projection
   - Provider telemetry（B.10 P2）
3. **新依赖 API key**（Dan 申请 free tier）：
   - Etherscan API key
   - DefiLlama 无需 key（公开 API）
   - CoinW / Binance kline 无需 key（公开 API）
   - CryptoPanic 可选（news 已够）
4. LLM provider：DeepSeek + Minimax 已配，**不加 Anthropic / OpenAI**（留后续）
5. 14 角色架构（B.2 后 14 真 TeamMember）不动
6. Multi-round schema (B.3 v2) 不动，仅加新字段
7. v9 / v10 视觉权威架构不动；仅改 MessageBubble + Topic / MarketAnalysisPanel 渲染层
8. Constitution v0.1.2 Rule 2 严格执行（preview-only deploy / 不 --prod）
9. main HEAD 推进 = preview deploy（不再误自动 prod，B.10 P0 已修）
10. Dan 申请 key 通过 Vercel UI 配置（不在 chat 明文出现 value）

---

## 5. Measurable Success Criteria

| ID        | 指标                              | 测量方法                                                                                                                                   | 阈值                                                                  |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| SC-B12-1  | Typed evidence 按 role 分发       | grep `evidencePack.chart` / `evidencePack.news` / `evidencePack.onchain` / `evidencePack.fundamental` 字段在 prompt context 真按 role 路由 | 4 类 evidence 真按 role 隔离，0 cross-pollution                       |
| SC-B12-2  | LLM JSON 输出有效率               | Telemetry 记录 JSON parse success                                                                                                          | ≥ 95%（5% 容忍 LLM hallucinate）                                      |
| SC-B12-3  | Provider 分布真按角色             | B.10 telemetry：14 角色 × 24+ LLM call，至少 2 个 provider 真分布                                                                          | DeepSeek 占比 ≤ 80%（之前 100%）                                      |
| SC-B12-4  | 决策同质化下降                    | 比较 BILL 类似 decision 跑 2 次：14 角色 direction + oneLineSummary 差异化                                                                 | direction 至少 3 类（long/short/wait 都有）/ summary 字面重复率 ≤ 60% |
| SC-B12-5  | UI L1/L2 渲染                     | MessageBubble DOM 真分两层 + L1 大字号 + L2 当前字号 + 视觉分隔                                                                            | Playwright snapshot vs spec mock 一致                                 |
| SC-B12-6  | Topic 标题分层 + explanation 去重 | DOM 真分 short title + 折叠 explanation；底部 chip 区域不重复                                                                              | 0 重复 + 展开按钮 layout 不撞                                         |
| SC-B12-7  | 数据缺口诚实显示                  | 缺 onchain key 时 onchain analyst direction = null + UI 显示 "暂无 onchain 数据" badge                                                     | 0 个角色编 wait                                                       |
| SC-B12-8  | i18n 完整                         | 10 locale × （L1 3 标签 + 视角标签 14 + 缺口标签 4）覆盖                                                                                   | 0 missing key                                                         |
| SC-B12-9  | Verify gate                       | typecheck / lint / format / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news           | 全 PASS                                                               |
| SC-B12-10 | 工程量收敛                        | ≤ 8 commit / ≤ 5 AI 天                                                                                                                     | 超 → 停 + 报 F                                                        |
| SC-B12-11 | SPEC-FEEDBACK 收敛                | 第 1 轮 ≤ 2 minor                                                                                                                          | >2 / P1+ → 立即停                                                     |

---

## 6. 现状盘点（Codex 2026-05-15 grep prep 实测）

### 6.1 已有 / 可复用

**Evidence / Data adapter（已实施，B.12 激活 + 硬化）**：

- News adapter 已有 + CRYPTOCOMPARE + COINGECKO_DEMO key 已配
- Market adapter 已有
- Evidence context framework 已实施
- Public timeline projection 已有
- Provider telemetry（B.10 P2 落 main）

**Schema**：

- `StrategyDecisionRecord` schema v2（B.3 multi-round 后）
- `AnalystInputRoundRecord` 字段（current shape Codex 实测确认）
- `DecisionResolutionReason` / `DecisionOutcome` / `MarketDataSource`
- `PublicTimelineEvent.pm_decision.resolution`

**LLM 接入**：

- DeepSeek + Minimax provider 已配（B.10 P1 fix 后）
- Provider chain fallback 逻辑（fallback 当前偏 DeepSeek 是 known limit，B.12 routing fix 修）
- LLM call wrapper

**UI**：

- v10 MarketAnalysisPanel（B.5 / B.8 narrow exception 后）
- MessageBubble（v9 owned，B 模块 narrow exception 经过 B.5 + B.8）
- Topic 渲染

**i18n**：

- agentWatch.dispatchV10.\* namespace（含 outcome / roles / flow / market / placeholder / round / stageStatus / history / followTrade / topicRanking）

### 6.2 B.12 工作（缺口）

**激活 / 硬化**：

- Typed evidence context pack：现有 evidence 按 role 分类打包（不再 14 角色看同一坨）
- Role-specific prompt：14 角色 system prompt 强约束视角 + 强制 JSON
- Provider routing fix：把 `teamRegistry.defaultProvider` 传 LLM wrapper

**新接入（free tier API）**：

- Etherscan API → onchain adapter
- DefiLlama → onchain + fundamental adapter（无需 key）
- CoinW / Binance kline → chart adapter（无需 key）

**Schema 扩展**：

- AnalystInputRoundRecord 加 `direction / confidence / oneLineSummary / detailedRationale / dataStatus`
- v1/v2/v2.1 dual-shape 兼容

**UI 改造**：

- MessageBubble L1/L2 分层渲染
- Topic 标题分层（短 title + 折叠 explanation）
- Topic explanation 重复渲染清理
- 展开按钮 layout 修
- v9 视觉权威架构不动；仅改渲染层

**i18n 新增**：

- L1 标签（LONG/SHORT/WAIT）
- 角色视角标签
- 数据缺口标签（"暂无 onchain 数据" / "暂无 fundamental 数据"）

### 6.3 不动

- v9 / v10 视觉权威架构（hero / constellation / flow 等 layout / class / hero）
- 14 角色架构（B.2 后状态）
- Multi-round schema 主体（B.3 v2 加 v2.1 字段扩展）
- prod 双线（claw42.ai 锁定 b74023a / 不 --prod）
- Anthropic / OpenAI key（不在 B.12 范围）
- B.8 跟单 mock UI（保留 disabled 状态）

---

## 7. 技术上下文

### 7.1 Typed Evidence Context Pack

**当前 state**：

- Evidence 通用 `EvidenceItem[]` 注入所有 14 角色 prompt context
- 全角色看同一坨 evidence dump

**B.12 目标 state**：

- `EvidenceContextPack` typed by role：
  ```ts
  interface EvidenceContextPack {
    chart: ChartEvidence; // kline / TA / volume / price action
    news: NewsEvidence; // news items + sentiment
    onchain: OnchainEvidence; // protocol activity / TVL / wallet flow
    fundamental: FundamentalEvidence; // tokenomics / unlock / revenue
    market: MarketEvidence; // global market context（所有角色共享）
    dataStatus: {
      // 缺口标识
      chart: "ok" | "partial" | "missing";
      news: "ok" | "partial" | "missing";
      onchain: "ok" | "partial" | "missing";
      fundamental: "ok" | "partial" | "missing";
    };
  }
  ```
- Role-specific dispatch：
  - chart_analyst → 仅传 `chart` + `market`
  - news_analyst → 仅传 `news` + `market`
  - onchain_analyst → 仅传 `onchain` + `market`
  - fundamental_analyst → 仅传 `fundamental` + `market`
  - research_lead / risk_lead / pm → 传完整 pack（综合视角）

### 7.2 Role-specific Prompt + JSON Structured Output

**Prompt 改造（每角色）**：

```
[Role: chart_analyst]
System Prompt:
你是 BTC/USDT 交易策略的技术分析师。
你**只看** K 线 / 量价 / TA 指标 / 价格行为。
你**不评论**新闻 / 链上 / 基本面 / 宏观——这些不是你的视角，留给其他分析师。
如果 chart evidence 缺失或不足，**直接说"chart data 不足"**，不要扩展到其他视角。

[Role-specific evidence]
{evidencePack.chart 序列化}
{evidencePack.market 序列化}
{dataStatus.chart 标识}

**输出必须严格 JSON 格式**：
{
  "direction": "long" | "short" | "wait" | null,
  "confidence": 0.0 to 1.0,
  "oneLineSummary": "string ≤ 80 字（一句话 TA 立场）",
  "detailedRationale": "string ≤ 500 字（详细 TA 推理）"
}

如果 chart data 不足，输出：
{
  "direction": null,
  "confidence": 0,
  "oneLineSummary": "chart data 不足，无法 TA 判断",
  "detailedRationale": "..."
}
```

类似对 news / onchain / fundamental analyst 强约束。

### 7.3 Provider Routing Fix

**当前 state**：

- PM pipeline 不把 `teamRegistry.defaultProvider` 传 LLM wrapper
- DeepSeek 健康时所有 call 都偏向 DeepSeek（fallback chain）
- Telemetry 实测 100% DeepSeek

**B.12 目标**：

- LLM wrapper 加 `providerOverride` 参数
- PM pipeline 调 LLM wrapper 时传 `providerOverride = teamRegistry[roleId].defaultProvider`
- Fallback chain 仅在 defaultProvider 真失败时才走 next provider（不是默认偏向 DeepSeek）
- Telemetry 记录 attempted provider + final provider 看分布

**Routing table（teamRegistry.defaultProvider 配置）**：

- chart_analyst → deepseek（速度 + 数据感知）
- news_analyst → minimax（长文本 sentiment）
- onchain_analyst → deepseek
- fundamental_analyst → minimax（长 reasoning）
- research_lead → deepseek
- risk_lead → minimax
- pm → deepseek
- bullish_researcher / bearish_researcher / trader / 3 reviewer / memory_loop → 分布配（具体 Codex 自决，目标占比 DeepSeek 60% / Minimax 40%）

### 7.4 Onchain / Fundamental Adapter 接入

**当前 state**：

- Onchain adapter / Fundamental adapter 不存在（或 stub）
- 14 角色看不到 onchain / fundamental evidence → 默认 wait

**B.12 目标**：

- 新建 `src/lib/onchain/etherscanAdapter.ts`（接 Etherscan API）
- 新建 `src/lib/onchain/defillamaAdapter.ts`（接 DefiLlama 公开 API）
- 新建 `src/lib/fundamental/defillamaTokenomicsAdapter.ts`（接 DefiLlama protocol/token unlock）
- 新建 `src/lib/market/coinwKlineAdapter.ts` 或 `binanceKlineAdapter.ts`（chart kline）
- Evidence pipeline 调这些 adapter 填 EvidenceContextPack
- dataStatus 字段反映各 adapter 实际状态（key 缺 → "missing"，rate limit → "stale"，正常 → "ok"）

**Etherscan API call**：

```ts
// src/lib/onchain/etherscanAdapter.ts
async function fetchOnchainEvidence(symbol: string): Promise<OnchainEvidence> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) return { status: "missing", reason: "API key not configured" };
  // call Etherscan API (ethtoken transfers / addresses / etc.)
  // ...
}
```

**DefiLlama API call**（无需 key）：

```ts
// src/lib/onchain/defillamaAdapter.ts
async function fetchProtocolTVL(protocolSlug: string) {
  const res = await fetch(`https://api.llama.fi/protocol/${protocolSlug}`);
  // ...
}
```

### 7.5 Schema 扩展（AnalystInputRoundRecord 加字段）

**当前 v2 shape**：

```ts
interface AnalystInputRoundRecord {
  roundIndex: number;
  direction: "long" | "short" | "neutral"; // 当前枚举
  rationale: string; // 自由文本
  evidenceIds: string[];
  createdAt: string;
}
```

**B.12 v2.1 shape（向后兼容）**：

```ts
interface AnalystInputRoundRecord {
  roundIndex: number;
  direction: "long" | "short" | "wait" | null; // 加 wait + null
  confidence: number; // 新字段 0-1
  oneLineSummary: string; // 新字段 ≤ 80 字
  detailedRationale: string; // 新字段 ≤ 500 字（替代 rationale，但 rationale 保留向后兼容）
  rationale?: string; // legacy 保留
  evidenceIds: string[];
  dataStatus?: "ok" | "partial" | "missing"; // 新字段
  createdAt: string;
}
```

**Dual-shape 兼容**：

- v2 老 record（无 oneLineSummary） → adapter 投到 v2.1 时 `oneLineSummary = rationale.slice(0, 80) + "..."`
- v2.1 新 record 直接读 oneLineSummary

### 7.6 UI 信息层级化（MessageBubble + Topic）

**MessageBubble L1/L2 改造**：

```tsx
// Before（current）
<MessageBubble>
  <Avatar /> <AgentName /> <Timestamp />
  <Content>{message.content}</Content>  {/* 全部 free-form 文本 */}
</MessageBubble>

// After（B.12）
<MessageBubble>
  <Header>
    <Avatar /> <AgentName /> <Timestamp />
  </Header>
  <L1>
    <DirectionBadge direction={direction} />      {/* LONG/SHORT/WAIT 颜色 */}
    <ConfidenceBar value={confidence} />          {/* 0.55 bar visual */}
    <OneLineSummary>{oneLineSummary}</OneLineSummary>  {/* 大字号 18-20px */}
  </L1>
  <Divider />                                       {/* 视觉分隔 */}
  <L2 collapsible>
    <DetailedRationale>{detailedRationale}</DetailedRationale>  {/* 当前字号 14-16px */}
  </L2>
</MessageBubble>
```

**Topic 标题分层**：

```tsx
// Before
<Topic>
  <Title>{symbol + explanation}</Title>   {/* 一坨 */}
  <ExpandButton />                          {/* layout 重叠 */}
  <BottomChip>{explanation}</BottomChip>   {/* 重复 */}
</Topic>

// After
<Topic>
  <Header>
    <ShortTitle>{shortTitle}</ShortTitle>       {/* "BILL 实时行情分析" */}
    <ExpandButton />                              {/* 独立 layout */}
  </Header>
  <SubExplanation collapsed>{explanation}</SubExplanation>  {/* 折叠 */}
  <BottomChip>{intensity + symbol}</BottomChip>             {/* 不再含 explanation */}
</Topic>
```

### 7.7 i18n 新增 namespace

```json
"agentWatch.dispatchV10": {
  "direction": {
    "long": "做多",
    "short": "做空",
    "wait": "观望",
    "null": "数据不足"
  },
  "roleViewpoint": {
    "chart_analyst": "技术 / TA 视角",
    "news_analyst": "新闻 / Sentiment 视角",
    "onchain_analyst": "链上视角",
    "fundamental_analyst": "基本面视角",
    // ... 14 角色
  },
  "dataGap": {
    "missing_onchain": "暂无链上数据接入",
    "missing_fundamental": "暂无基本面数据接入",
    "missing_news": "暂无新闻数据",
    "missing_chart": "暂无 K 线数据"
  }
}
```

---

## 8. 数据流（B.12 完成后）

```
[base: 2e055b09 B.10 完成]

Cron `/api/cron/strategy-replay`
   ↓
gatherEvidence (B.12 改造)
   ├─ fetchChartEvidence(symbol)      ← CoinW / Binance kline
   ├─ fetchNewsEvidence(symbol)       ← CRYPTOCOMPARE + COINGECKO（已有）
   ├─ fetchOnchainEvidence(symbol)    ← Etherscan + DefiLlama（B.12 新接）
   ├─ fetchFundamentalEvidence(symbol) ← DefiLlama tokenomics（B.12 新接）
   └─ fetchMarketEvidence              ← Market adapter（已有）
   ↓
EvidenceContextPack typed by role + dataStatus
   ↓
pmDecisionPipeline.runMultiRound (B.3 已立)
   ├─ for each role in 14 角色：
   │   ├─ dispatchEvidenceByRole(role, pack)  ← 仅传 role-specific evidence
   │   ├─ buildRoleSpecificPrompt(role, evidence) ← 强约束视角 + 强制 JSON
   │   ├─ llmCall({ providerOverride: teamRegistry[role].defaultProvider }) ← B.12 routing fix
   │   └─ parseJSON → { direction, confidence, oneLineSummary, detailedRationale }
   ↓
StrategyDecisionRecord v2.1 (含新字段)
   ↓
publicTimelineProjection (v2.1 dual-shape 投影)
   ↓
v9TopicAdapter (renders new fields)
   ↓
AgentWatchBoard / v10 MarketAnalysisPanel
   ├─ Topic 短 title + 折叠 explanation
   └─ DispatchConsoleV9 / V10
       └─ MessageBubble (L1/L2 分层)
           ├─ L1: DirectionBadge + Confidence + OneLineSummary
           └─ L2: DetailedRationale
```

---

## 9. 变更范围

### 9.1 新建

- `src/lib/onchain/etherscanAdapter.ts`
- `src/lib/onchain/defillamaAdapter.ts`
- `src/lib/fundamental/defillamaTokenomicsAdapter.ts`
- `src/lib/market/coinwKlineAdapter.ts`（或 binanceKlineAdapter.ts，Codex 自决）
- `src/lib/team/evidenceDispatcher.ts`（role-specific dispatch logic）
- `src/lib/team/prompts/*.ts`（如不存在，Codex 实测决定）—— 14 角色 system prompt + 强约束模板
- Tests for above

### 9.2 修改（关键文件）

- `src/lib/team/strategyDecisionRecord.ts` —— AnalystInputRoundRecord 加 direction/confidence/oneLineSummary/detailedRationale/dataStatus 字段（v2.1 schema）
- `src/lib/team/pmDecisionPipeline.ts` —— 集成 evidenceDispatcher + role-specific prompt + providerOverride
- `src/lib/team/llmProviderRouter.ts`（或类似 wrapper，Codex grep 确认位置） —— 加 `providerOverride` 参数支持
- `src/lib/watch/publicTimelineProjection.ts` —— 处理 v2.1 新字段 + dual-shape 兼容
- `src/lib/watch/v9TopicAdapter.ts` —— 映射新字段到 DispatchMessage
- `src/modules/agent-watch/v9/MessageBubble.tsx` —— L1/L2 分层渲染
- `src/modules/agent-watch/v9/Topic.tsx` —— 标题分层 + explanation 去重
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx` —— **narrow v10 exception（B.5 已立）**，topicRanking-related 展开按钮 layout 修
- `src/i18n/dicts/*.json` 10 locale —— 加 direction / roleViewpoint / dataGap namespaces
- `src/i18n/types.ts` —— Dict 类型扩展

### 9.3 删除

- 无（保留 legacy `rationale` 字段 + v2 shape 兼容）

### 9.4 不动

- v9 / v10 视觉权威架构（hero / constellation / flow 主体 layout）
- 14 角色架构（B.2 后状态）
- B.1 冻结的 writer / cron（除 v2.1 schema 跟随 pipeline 改）
- prod 双线（claw42.ai 锁定 b74023a 不动）
- Anthropic / OpenAI key（不在范围）
- B.8 跟单 mock UI（保留 disabled）
- 主 worktree WIP

---

## 10. 依赖前置

- main HEAD `2e055b09` 含 B.10 完成 ✓
- Vercel env：CRYPTOCOMPARE_API_KEY / COINGECKO_DEMO_KEY / DEEPSEEK_API_KEY / MINIMAX_API_KEY 已配 ✓
- Vercel env：**ETHERSCAN_API_KEY**（Dan B.12 实施前申请 + Codex 配 env）✓ 待办
- DefiLlama / CoinW / Binance 无需 key
- baseline verify gate 全过 ✓
- 干净 worktree `/tmp/claw42-b12-decision-quality` 从 origin/main checkout

---

## 11. Tasks

### Phase 0 — Setup + grep verify

- [ ] T-B12-001 worktree `/tmp/claw42-b12-decision-quality` + branch `feature/spec-b12-decision-quality-uplift` base `2e055b09`
- [ ] T-B12-010 [P] 实测 grep verify Codex grep prep（重新 cat 关键文件）：
  - news adapter / market adapter / evidence framework 当前 shape
  - llmProviderRouter / pmDecisionPipeline 当前实现
  - MessageBubble / Topic 当前渲染 layout
  - i18n dispatchV10 当前 namespace
- [ ] T-B12-011 双脑判断 Q-B12.1~Q-B12.6 写 codex-to-claude.md
- [ ] T-B12-012 等 Dan 配 ETHERSCAN_API_KEY 进 Vercel env（如未配 → onchain adapter 跑 missing 状态）

### Phase 1 — Schema + Evidence pipeline 改造

- [ ] T-B12-020 `strategyDecisionRecord.ts` AnalystInputRoundRecord v2.1：加 direction/confidence/oneLineSummary/detailedRationale/dataStatus 字段
- [ ] T-B12-021 Schema dual-shape 兼容：v1 / v2 老 record 投到 v2.1 时 oneLineSummary 自动填充逻辑
- [ ] T-B12-022 publicTimelineProjection v2.1 兼容
- [ ] T-B12-023 EvidenceContextPack typed 定义 + role-specific dispatch logic
- [ ] T-B12-024 evidenceDispatcher.ts 实现：按 role 隔离 evidence 子集

### Phase 2 — Onchain / Fundamental / Chart adapter 新接

- [ ] T-B12-030 etherscanAdapter.ts 接 Etherscan API（如 key 缺 → return missing 状态）
- [ ] T-B12-031 defillamaAdapter.ts 接 DefiLlama TVL / 协议活动（无需 key）
- [ ] T-B12-032 defillamaTokenomicsAdapter.ts 接 DefiLlama token unlock / revenue（无需 key）
- [ ] T-B12-033 coinwKlineAdapter.ts 接 CoinW 公开 kline（如 fail fallback binanceKlineAdapter）
- [ ] T-B12-034 evidence pipeline 集成 4 类新 adapter

### Phase 3 — LLM Prompt + Provider routing fix

- [ ] T-B12-040 14 角色 system prompt 强约束（chart 只 TA / news 只 macro / 等）+ 强制 JSON 结构化输出
- [ ] T-B12-041 LLM wrapper 加 providerOverride 参数支持
- [ ] T-B12-042 pmDecisionPipeline 调 LLM wrapper 时传 teamRegistry[role].defaultProvider
- [ ] T-B12-043 teamRegistry defaultProvider 表配置（chart→deepseek / news→minimax / 等，Codex 自决具体配置，目标 DeepSeek ≤ 80%）
- [ ] T-B12-044 JSON parse + fallback handling（非合法 JSON → fallback 把整段当 detailedRationale）

### Phase 4 — UI 信息层级化

- [ ] T-B12-050 MessageBubble L1/L2 分层渲染：DirectionBadge + ConfidenceBar + OneLineSummary（L1）+ DetailedRationale 折叠（L2）
- [ ] T-B12-051 Topic 标题分层：short title + 折叠 explanation；展开按钮 layout 修
- [ ] T-B12-052 v10 MarketAnalysisPanel narrow exception：topicRanking-related 区域 explanation 重复渲染清理
- [ ] T-B12-053 视觉细节：字号 / spacing / 颜色（L1 大字号高对比 / L2 当前字号）
- [ ] T-B12-054 数据缺口 badge UI：缺 X 数据时显示 "暂无 X 数据接入" 标识

### Phase 5 — i18n + Tests

- [ ] T-B12-060 [P] i18n 10 locale 加 direction / roleViewpoint / dataGap namespaces
- [ ] T-B12-061 vitest 单测：JSON parse / dual-shape 兼容 / evidence dispatcher / provider routing
- [ ] T-B12-062 integration test：完整 pipeline run 验证 typed evidence 真按 role 隔离 + JSON 输出 + provider 分布

### Phase 6 — Verify + Staging + 报告

- [ ] T-B12-070 全 verify gate（typecheck / lint / format / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news）
- [ ] T-B12-071 staging preview deploy（preview only / 不 --prod）+ trigger cron 跑 1 条 PM decision
- [ ] T-B12-072 telemetry 验证：provider 分布（DeepSeek ≤ 80%） + JSON parse success ≥ 95%
- [ ] T-B12-073 视觉 verify：preview URL 看 14 角色 L1/L2 分层 + Topic 标题分层 + 数据缺口 badge
- [ ] T-B12-074 PR + squash merge（**不 --prod**）+ phase gate
- [ ] T-B12-075 报告 codex-to-claude.md + decision-log 联动 entry

---

## 12. 约束

- 全程不动 v9 / v10 视觉权威架构（仅改 MessageBubble + Topic + MarketAnalysisPanel 渲染层 narrow exception）
- 全程不动 prod 双线（preview only / 不 --prod）
- 全程不动主 worktree
- B.1 冻结的 writer / cron 仅在 schema v2.1 跟随 pipeline 改时改字段；不动 resolution 逻辑
- 不加 Anthropic / OpenAI provider（留后续）
- transient HTTP 502/503/504/timeout → retry 1-2 次；真阻塞 → 立即停 + 报告
- ETHERSCAN_API_KEY 未配 → onchain adapter 跑 missing 状态（不阻塞 B.12 实施）
- ≤ 8 commit / ≤ 5 AI 天，超 → 停 + 报 F
- LLM 输出非 JSON → fallback 不 crash + dev warn
- main HEAD 推进 = preview deploy（B.10 P0 已修，不再误自动 prod）

---

## 13. 不能做清单

- ❌ 不能改 v9 / v10 视觉权威架构（hero / constellation / flow / 整体 layout）
- ❌ 不能 force-push / rewrite main history
- ❌ 不能 --prod / 不能 vercel promote prod / 不能推 CoinW GitLab
- ❌ 不能动 claw42.ai 当前 production alias（保 b74023a）
- ❌ 不能动主 worktree 30+ WIP
- ❌ 不能加 Anthropic / OpenAI provider（B.12 范围）
- ❌ 不能砍 onchain / fundamental adapter 接入（Dan 拍 4 类 evidence 都接）
- ❌ 不能让数据缺口角色编 wait 决策（强约束 prompt 让 LLM 输出 null direction）
- ❌ 不能跳过 v2.1 schema dual-shape 兼容（v1/v2 老 record 必须能投到 v2.1）
- ❌ 不能 hardcode 任何新中文（i18n 完整性）
- ❌ 不能跳过 SC-B12-4 决策同质化下降验证

---

## 14. Constitution 对照检查（v0.1.2 7 Rule）

| Rule                    | 状态        | 评估                                                                                                                                           |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule 1 部署身份         | PASS        | preview only / 走 agentxmain-collab                                                                                                            |
| Rule 2 生产保护 v0.1.2  | PASS        | 不 --prod / 不动 claw42.ai prod alias / B.10 P0 已切 main→preview only                                                                         |
| Rule 3 视觉品牌权威     | CONDITIONAL | v9/v10 主架构不动；MessageBubble + Topic + MarketAnalysisPanel 渲染层 narrow exception（B.5/B.8 立的模式 + B.12 扩展）—— 每改动 grep gate 验证 |
| Rule 4 数据 schema 纪律 | CONDITIONAL | AnalystInputRoundRecord 加新字段（v2.1 兼容 v1/v2） + EvidenceContextPack 新 type —— 显式声明 + dual-shape 兼容 + decision-log 联动            |
| Rule 5 AI / 行情诚实性  | PASS        | 数据缺口诚实显示（不让 LLM 编 wait），强约束 prompt + dataStatus 字段                                                                          |
| Rule 6 协作闭环         | PASS        | Codex 双脑评估 + sync READ/writeback + grep gate                                                                                               |
| Rule 7 验证门槛         | PASS        | 全 verify gate + telemetry 实测 + staging preview 视觉验证                                                                                     |

**Rule 3 / Rule 4 CONDITIONAL 说明**：B.12 narrow exception 跟 B.5 / B.8 同模式（仅 narrow-scoped 改动 MarketAnalysisPanel + 主体不动）+ schema v2.1 加字段（不破 v2）—— 在 § 0.5 redline + § 9 变更范围显式声明。

---

## 15. Worktree

- Codex 实施 worktree：`/tmp/claw42-b12-decision-quality`
- base HEAD：`2e055b09b1921b147ebb8339aaf8bdc778d6d67a`
- branch：`feature/spec-b12-decision-quality-uplift`
- PR base：`main`
- 不动：主 worktree
- 决策档案：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`
- Constitution：`docs/project-constitution.md` v0.1.2

---

## 16. 老板简报

claw42 watch 板"14 个 AI 角色决策"目前看起来每个角色都在重复同样的话（缺数据 / 等等）。这次大改造解决三个深层问题：

第一，每个角色现在拿到属于自己视角的数据（技术分析师只看 K 线 / 新闻分析师只看新闻 / 链上分析师只看链上 / 等等），不再每个角色都看同一坨原始信息。

第二，强制每个角色输出格式化结果（看多/看空/观望 + 信心度 + 一句话立场 + 详细推理），用户能扫一眼看到 14 个角色的立场分布，想深究再展开看详细分析。

第三，让不同角色真的用不同 AI 模型（DeepSeek / Minimax 分布走），不再 100% 单一模型。

同时修界面：标题太长 + 信息太密 + 展开按钮重叠的问题，分层重新设计：标题简短 + 折叠详细解释 + 每条消息上方放醒目立场摘要，下方折叠详细推理。

新接两个数据源（链上数据 / 基本面数据）—— 用免费的 Etherscan + DefiLlama，需要 Dan 申请免费 key（5 分钟）。

不上正式版，迭代版预发演示后 Dan 决定何时上 prod。

---

## 17. Anti-Rationalization

| 逃逸路径                                             | 为什么不行                                                                               | 正确做法                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 觉得 evidence 接入太复杂顺便砍 onchain               | Dan 拍 4 类 evidence 都接 + free tier 简单                                               | 严格 4 类全接，缺 key 时 missing 状态显式                   |
| 觉得 prompt 改一改不用强约束角色视角                 | 当前同质化的根因 = prompt 没强约束；不强约束改了也是表面                                 | 14 角色 system prompt 显式禁止跨视角评论                    |
| 觉得 L1/L2 UI 分层留 backlog 先做后端                | Dan 明确 UI 信息层级化是 B.12 核心；不分层数据再好用户也看不下去                         | UI 分层跟数据改造同步落地                                   |
| 觉得 provider routing 等 Anthropic key 一起做        | DeepSeek + Minimax 已配可调，先修当前 routing fix                                        | B.12 修 routing + 用现有 2 provider；Anthropic 留后续       |
| 觉得 JSON 输出 LLM 不一定听话顺便 fallback free-form | 必须强约束 + parse fallback 但不能让 free-form 成默认                                    | strict prompt + try/catch parse + 95% 成功率 SC             |
| 觉得数据缺口让 LLM 自己说"数据不足"就行              | LLM 自己说"数据不足"会扩展到其他视角扯（chart analyst 说"基本面缺失"）—— 当前根因        | dataStatus 字段 + UI badge 显式 + prompt 强约束角色不评跨域 |
| 觉得 schema v2.1 加字段顺便 deprecate rationale      | 老 record 还存在；deprecate 破 dual-shape                                                | rationale 保留 legacy / 新字段并存                          |
| 觉得 narrow v10 exception 既然已经开了顺便改 hero    | narrow 是仅 follow-related / topicRanking-related / 现在 explanation 去重；不是 v10 全开 | grep gate 验证 narrow exception 仅涉及对应行                |
| 觉得 14 角色 prompt 太多懒得全写                     | 14 角色全是 B.12 范围；少 1 角色 prompt 不强约束 = 该角色仍同质化                        | 14 角色 prompt 全实施 + 测试覆盖                            |
| 觉得 Etherscan key Dan 没给就先 skip onchain         | Dan 申请 free tier 5 分钟即可 + missing 状态 fallback 不阻塞                             | T-B12-012 等 key + adapter 仍实施（key 缺时 missing 状态）  |
| 觉得 prod 已修拓扑可以顺便 --prod 看效果             | Constitution Rule 2 v0.1.2 严格 / claw42.ai 锁 b74023a 不动                              | preview only / 等 Dan 显式 chat 授权才动 prod               |

---

## 18. 双脑判断点

### Q-B12.1: News / Market / Evidence framework 当前实测 shape

- `cat src/lib/news/` / `src/lib/market/` / `src/lib/evidence/`（Codex 实测真正位置）
- 给最少改动方案：如何把现有 evidence 升级为 typed EvidenceContextPack

### Q-B12.2: LLM wrapper providerOverride 实施位置

- `cat src/lib/team/llmProviderRouter.ts`（或 Codex 实测真正 wrapper 位置）
- providerOverride 加在哪一层（wrapper / pipeline / provider chain）

### Q-B12.3: 14 角色 prompt 文件位置 + 当前 prompt 通用度

- `cat src/lib/team/prompts/`（如存在）/ 或 grep `system_prompt` / `systemPrompt` 在 lib/team/
- 当前 prompt 是统一模板还是已经 per-role 差异化

### Q-B12.4: Schema v2.1 dual-shape 兼容设计

- AnalystInputRoundRecord v1 / v2 / v2.1 三态 dual-shape 投影逻辑
- oneLineSummary 自动填充策略（rationale 截断 / 直接 fallback）

### Q-B12.5: MessageBubble L1/L2 改造 narrow exception 边界

- `cat src/modules/agent-watch/v9/MessageBubble.tsx`
- L1/L2 改造是否触 v9 视觉权威 / 还是仅渲染逻辑（B owned）
- v10 MarketAnalysisPanel narrow exception（B.5 + B.8 + B.12 第 3 类）grep gate 范围

### Q-B12.6: Etherscan / DefiLlama / CoinW kline adapter 实现细节

- Etherscan API rate limit 处理（5 calls/sec）
- DefiLlama 哪些 endpoint 覆盖 onchain + fundamental
- CoinW vs Binance kline 优先级 + fallback
- adapter cache 策略（TTL / Redis）

### 每 phase 必填实施前 grep check

- [ ] `cat src/lib/team/strategyDecisionRecord.ts` 看 v2 schema
- [ ] `cat src/lib/team/pmDecisionPipeline.ts` 看 multi-round 实施
- [ ] `cat src/lib/team/teamRegistry.ts` 看 defaultProvider 字段是否存在
- [ ] `cat src/lib/team/llmProviderRouter.ts`（或同等位置）看 wrapper
- [ ] `cat src/lib/news/` ls + cat 主文件 看 news adapter 现状
- [ ] `cat src/lib/market/` ls 看 market adapter
- [ ] `cat src/lib/evidence/` ls 看 evidence framework
- [ ] `cat src/modules/agent-watch/v9/MessageBubble.tsx`
- [ ] `cat src/modules/agent-watch/v9/Topic.tsx`
- [ ] `cat src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`
- [ ] `cat src/i18n/types.ts | grep -A 50 dispatchV10`
- [ ] `vercel env ls preview --scope agentxmain-collabs-projects` 看 ETHERSCAN_API_KEY 状态
- [ ] `cat docs/project-constitution.md` v0.1.2 7 Rule

如任一不一致 → [SPEC-FEEDBACK]，立即停 + 报 F。

---

## 19. decision-log 联动

- 2026-05-15（已加）: B.10 全 phase 完成 + 三层模型 + telemetry
- 2026-05-15（待 F 追加）: B.12 spec v1.0 起草 + Dan 拍 6 件事整合 + free tier key 申请清单
- B.12 完成后（Codex 触发 F 追加）: B.12 完成 + provider 分布数据 + 14 角色差异化 verify + decision quality 提升对照

---

## 工作量预估

| Phase                                                                 | 时间（AI 天）                                 |
| --------------------------------------------------------------------- | --------------------------------------------- |
| 0 Setup + grep verify + 双脑判断 + 等 ETHERSCAN key                   | 0.5（含 Dan 申请 key 时间）                   |
| 1 Schema + Evidence pipeline 改造                                     | 1                                             |
| 2 Onchain / Fundamental / Chart adapter 新接                          | 1-1.5                                         |
| 3 LLM Prompt + Provider routing fix                                   | 1-1.5                                         |
| 4 UI 信息层级化（MessageBubble L1/L2 + Topic + v10 narrow exception） | 1                                             |
| 5 i18n + Tests                                                        | 0.5                                           |
| 6 Verify + staging + 报告                                             | 0.5                                           |
| **总计**                                                              | **5-6 AI 天** + Dan 申请 ETHERSCAN key 5 分钟 |

---

## 关联资产

- 前置 spec：B.10 完成（PR #94 + B.10 P0/P1/P2 闭环）
- 前置：A1 + B 系列全 phase merge + 三层模型严格状态
- Codex 2026-05-15 grep prep report（codex-to-claude.md 4757+ entry）
- Constitution：`claw42/docs/project-constitution.md` v0.1.2
- Decision-log：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md` 2026-05-15 entries
- Free tier API：Etherscan / DefiLlama / CoinW / Binance / CryptoPanic

---

_v1.0 起草：2026-05-15 04:00 CST F session_
_起草前置：Codex 2026-05-15 grep prep 颠覆"从零接 evidence"假设 + Dan 看 BILL trace 拍 6 件事整合范围 + Dan 拍"全部一起做" + free tier key 申请清单_
_下一动作：Dan 申请 ETHERSCAN_API_KEY 进 Vercel env + 派 Codex 第 1 轮双脑评估 + 串行实施_
