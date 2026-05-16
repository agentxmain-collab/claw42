# Spec: Watch B.14 — Resident Analysis + Priority Candidate

> **版本**：v1.1（2026-05-17 整合 Codex Round 1 评估，F 双脑判断接受全部建议）
> **作者**：F (Claude session)
> **状态**：v1.1 Draft，待 Dan APPROVED 后派 Codex Stage 0
> **协议**：claude-codex-protocol v2.5（Round 1 后补齐 engineering context）
> **依赖**：B.13 + hotfix-1/2/3/4/5 全 merged（main HEAD `b0a051a`）

---

## v1.1 修订原因（v1.0 → v1.1）

Codex Round 1 评估（PR #108 / commit `8c637c90`）裁决 v1.0 **不建议直接实现**——F 关键架构假设全部 FAIL/PARTIAL：

1. **PM pipeline 不能 generalize 到非 symbol candidate**（Codex first-hand 看代码每行证明）：
   - `pmDecisionPipeline.ts:515-520` 用第一条 signal 推 symbol，否则 fallback `BTC`
   - `pmDecisionPipeline.ts:509-513` 无价格信号时 `currentPrice = 1` 假兜底
   - `pmDecisionPipeline.ts:1233-1260` 无条件组装 trade inputs
   - `tradeDecisionPromptBuilder.ts:20-33` `TradeCardPromptContext` 必填 `symbol` + `currentPrice`
   - `StrategyDecisionRecord` 必含 `symbol`、`id = pm:${symbol}:${now}`
   - 硬塞 `market_overview` 进 pipeline → 假 BTC trade card 或 `currentPrice=1` 假条件
2. **Candidate selector / timeline projection / V9 adapter / V10 UI 全 symbol-first**——`publicTimelineProjection.ts:104-107` 用 `/^[A-Z0-9]{2,12}$/` 过滤会把 `market_overview` key 过滤掉
3. **数据源真实可用性差距**：
   - Vercel env 有：CryptoCompare / CoinGecko / Etherscan / DUNE / DeBank / DeepSeek / Minimax / KV
   - **缺**：CryptoPanic / Twitter/X social / CoinMarketCap / Glassnode / Nansen key
   - CoinW kline 只 BTC/ETH/SOL，不提供 market cap
   - market cap / volume 必须复用 CoinGecko markets，不是 CoinW
4. **Preview cron 不跑（hotfix-2 教训）**：v1.0 §19 T102/T103 写 cron 实装 P0 不合理
5. **3 stage 边界不够**——Codex 建议 4 stage（加 Stage 0 Contract gate）

**Codex 4 个 Product/UX angle F 完全漏看（v1.1 全部纳入）**：

1. 常驻卡**不应输出交易方案**——价值是"今天该不该进入风险"，不是 entry/stop/tp
2. 大盘卡应**影响 symbol selector 权重**（risk-off → 提大币权重），不是两系统独立
3. **Cost cap 进 spec**——resident + symbol topN 在 visit trigger 上不控会爆
4. **History dedupe key 早定**——market_overview 每日 1 / hotspot intraday 多，不能和 symbol 用同 dedupe

**v1.1 关键变更**：

- 3 stage → **4 stage**（Stage 0 Contract gate + Stage 1 Resident + Stage 2 Selector + Stage 3 UI）
- 加 DecisionCandidate contract（不是只加 CandidateType field）
- 加 trade-disabled pipeline branch
- §13 cannot-do 12 → **20 条**（加 8 条新红线）
- Social 维度 P0 → P1（缺 key）
- T102/T103 cron 实装 → cadence policy + manual/refresh/test-clock 验收

---

## § 1 Overview

### 1.1 背景

Dan 2026-05-16 chat 验收 B.13 hotfix 链后给两类反馈：

1. **内容质量**——已 hotfix-5 闭环 ✅
2. **产品架构层新方向**——本 spec 落地

Dan 拍板：

- 用户进站至少有 **每日大盘分析 + 热点分析** 两个常驻
- 币种分析按优先级抓：**大币 → 热门 → 新闻驱动 → 小币**

Dan UI 授权：**决策流多 type 卡片（同区不同样式）**——不另起 panel。

### 1.2 范围（4 件事，v1.1 加 Stage 0 Contract gate）

| Stage       | 主题                                                                       | 优先级  | AI 天   |
| ----------- | -------------------------------------------------------------------------- | ------- | ------- |
| **Stage 0** | Candidate Contract / Public Payload / Ordering Comparator gate             | P0 必须 | 1       |
| **Stage 1** | Resident Analysis（market_overview + hotspot，trade-disabled branch）      | P0 必须 | 3-5     |
| **Stage 2** | Priority Candidate Selector（CoinGecko + CryptoCompare + executable 权重） | P0 必须 | 2-3     |
| **Stage 3** | Multi-Type Card UI（同区不同样式 + i18n + stability）                      | P0 必须 | 1.5-2.5 |

**总估**：7.5-11.5 AI 天（v1.0 估 9-14 含返工是低估）。

### 1.3 Out-of-Scope（推 B.15+）

- L4 多空辩论戏剧化 → B.15
- L5 6 阶段仪式感 → B.15+
- Real follow-trade 接 CoinW API → B.16+
- Social / CryptoPanic 维度 → 等 Dan 提供 key 后单独 task
- Hero / landing page 改动
- BTC.D / total market cap / US equity correlation adapter（当前无 first-class source）

---

## § 2 In-Scope / Out-of-Scope

### 2.1 Stage 0 — Candidate Contract（v1.1 新加）

**新增 schema contract**：

```ts
type CandidateType = "symbol" | "market_overview" | "hotspot";

interface DecisionCandidate {
  candidateType: CandidateType;
  candidateKey: string; // stable, e.g. "market_overview:daily:zh_CN:2026-05-17"
  symbol?: string; // optional, 仅 candidateType === 'symbol' 或 hotspot+executable
  displayTitle: string; // 用户可见标题，如 "今日大盘综述"
  executable: boolean;
  cadence: "daily" | "intraday" | "event";
  score: number;
  reasons: TopicSelectionReason[];
}
```

**Public payload 扩展**（含 legacy fallback）：

- `candidateType` / `candidateKey` / `displayTitle` / `executable` 加为 optional 字段
- legacy record（缺 candidateType）→ 视为 `symbol`，不丢

**Canonical ordering comparator**（hotfix-4 经验落实）：

1. type priority: `market_overview` → `hotspot` → `symbol`
2. score desc
3. lastUpdatedAt desc
4. candidateKey / recordId 字典序

**禁用**：index / Map iteration / random 作为最终排序依据。

**Stage 0 完成才能进 Stage 1**（gate）——避免 stage 间断裂导致 hotfix-3 hydration 漏洞重演。

### 2.2 Stage 1 — Resident Analysis（v1.1 trade-disabled branch）

- `market_overview` 内容：当日大盘宏观（Fear&Greed 已有 adapter 复用 + CryptoCompare news 7d 高影响 + CoinGecko global market data）
- `hotspot` 内容：当日热点叙事（CoinGecko trending + CryptoCompare 热点 news + 高 volume 跳变）
- **Trade-disabled pipeline branch**：
  - `market_overview` → 必然 trade-disabled，输出 `analysisSummary` 不输出 `tradeDecision`
  - `hotspot` → 若绑定 executable symbol 才走 trade branch，纯叙事热点走 trade-disabled
- **禁止** fallback BTC / `symbol=UNKNOWN` / `currentPrice=1` 假兜底
- Cadence policy（不是 cron 实装）：
  - market_overview：每日 1 次（早 9:00 UTC+8 触发点）
  - hotspot：intraday 2-3 次
- Preview 验收用 manual trigger / refresh trigger / test clock
- Prod cron 如需新增由 Dan 单独授权

### 2.3 Stage 2 — Priority Selector（v1.1 social 降 P1）

评分维度：

- **市值权重**（P0）：CoinGecko markets `market_cap` 字段（复用 `/api/hero/trending-coins` 已用经验）
- **24h volume 权重**（P0）：CoinGecko markets `total_volume` 字段
- **新闻热度权重**（P0）：CryptoCompare 7d article count + source diversity + high-impact count（不假装有 native social）
- **Executable 权重**（P0）：CoinW executable symbol 优先，watch-only 仅高分进 pool（严禁 follow-trade）
- **社交关注度**（P1，缺 key 待 procurement）：除非 Dan 提供 CryptoPanic / X / social API key

实施细节：

- candidate pool 改按总分排序 top-N（Codex Round 1 建议 N=8-12，最终值定稿前 Codex 实测）
- 评分 cache 5min（与 cadence lock 分开 key）
- 数据源全挂 fallback 静态 universe（BTC > ETH > SOL > HYPE 固定序）
- Watch pool 需保留 `marketCapUsd` / `totalVolumeUsd24h` 字段（当前 `marketDataCache.ts:140-166` 丢字段）

### 2.4 Stage 3 — Multi-Type Card UI（v1.1 视觉同区不同样式）

- 卡片视觉：
  - **symbol 卡**：现状不变
  - **market_overview 卡**：badge "大盘" + 不同 accent color + **不显** follow-trade
  - **hotspot 卡**：badge "热点" + 不同 accent color + 视情况显 follow-trade
- 排序：canonical comparator（Stage 0 落实）
- 10 locale i18n badge 文案（含 en_XA）
- Follow-trade strict gate：仅 `candidateType === 'symbol'` && `executable === true` 才渲染
- responsive + a11y axe 0 violations
- 5 次刷新 hash 稳定（hotfix-4 经验）

### 2.5 Out-of-Scope

- 已列 § 1.3

---

## § 3 Edge Cases（4 轴）

### 3.1 输入轴

- 常驻 candidate 当日生成失败 → UI 显示前日 record（带 "前日数据" badge）
- 评分维度数据缺失 → 跳过该维度，剩余归一化
- candidate pool top-N 全 watch-only（极端）→ 仍保 executable token 占位（fallback BTC）

### 3.2 状态轴

- 常驻当日已存在 record → visit refresh 不重跑（cadence-based dedupe）
- 新 candidate type 写 KV 但 timeline projection 未识别 → **Stage 0 contract gate 兜底**（hotfix-3 漏洞不重演）
- 优先级评分 cache 5min vs cadence lock key 分开避免 race
- **History dedupe key 早定**（v1.1 新加）：
  - symbol: `${locale}:${symbol}`
  - market_overview: `${locale}:market_overview:${YYYY-MM-DD}`
  - hotspot: `${locale}:hotspot:${candidateKey}` 含时间窗

### 3.3 边界轴

- 常驻 candidate 14 角色全 abstain → record 标 `no_signal` + UI "今日大盘无显著信号"
- timeline events 含多 type + 同 timestamp → canonical comparator 严格 tie-breaker
- 常驻 cadence 撞 visit-trigger → dedupe 一致（cadence lock + per-candidate lock）

### 3.4 失败轴

- 常驻 cron 不跑（preview）→ visit-trigger refresh 链路兜底（manual trigger 测试）
- 评分 API 超时 → fallback 静态 universe
- 多 type 视觉 break responsive → a11y 测试覆盖
- **Cost cap 触发**（v1.1 新加）→ 暂停新 trigger + 报警 telemetry

---

## § 4 Assumptions（v1.1 修正）

1. **PM pipeline 不能直接 generalize 非 symbol candidate**——Stage 0 contract + Stage 1 trade-disabled branch 是先决条件
2. **14 角色 prompt 复用身份层不复用 trade prompt**——按 candidateType 分支
3. **CryptoCompare 提供 news count / source diversity 近似热度**，无 native social/vote
4. **CoinGecko markets 提供 market cap / 24h volume**（不是 CoinW kline）
5. **Social/user attention 当前不可用**（缺 CryptoPanic / X / social key），列 P1 backlog
6. **Preview cron 不跑**（hotfix-2 已知），cadence 验收用 manual/refresh/test-clock
7. **Fear & Greed adapter 已存在**（`src/lib/api/fearGreed.ts`），PM evidence pack 未接入，Stage 1 可接入
8. **CoinW kline 仅 BTC/ETH/SOL**，HYPE/BILL/IRYS 等无 kline 数据

---

## § 5 Measurable Success Criteria（v1.1 4 stage）

### 5.1 Stage 0 Contract gate

- ✅ `DecisionCandidate` interface + `CandidateType` union 实装
- ✅ Public payload 含 optional `candidateType / candidateKey / displayTitle / executable`
- ✅ Legacy record fallback test（缺 candidateType → 视为 symbol，不丢）
- ✅ Canonical ordering comparator 单元测试覆盖 type priority + score desc + lastUpdatedAt desc + id 字典序 + 禁用 random/index/Map iter
- ✅ Stage 0 单 PR 独立 merge

### 5.2 Stage 1 Resident

- ✅ market_overview cadence policy 实装 + manual/refresh/test-clock 验收
- ✅ hotspot cadence policy + 同上
- ✅ Trade-disabled pipeline branch：market_overview 无 `tradeDecision` 输出
- ✅ 严禁 fallback `BTC` / `currentPrice=1` 假兜底（grep + 单元测试）
- ✅ 14 角色对 resident 走 trade-disabled prompt branch
- ✅ ≥3 次实测真 PM run（market_overview / hotspot 各 ≥1 次）+ raw artifact commit
- ✅ leakCount=0 维持（hotfix-5 红线）

### 5.3 Stage 2 Selector

- ✅ 4 维度评分函数 + 单元测试（市值 / volume / 新闻 / executable，social P1 暂缺）
- ✅ CoinGecko markets `market_cap` + `total_volume` 字段保留进 watch pool
- ✅ CryptoCompare 7d count / source diversity / high-impact count scoring
- ✅ Cache 5min + fallback 静态 universe
- ✅ Top-N 排序测试

### 5.4 Stage 3 UI

- ✅ 决策流卡片 3 type 渲染分支（grep）
- ✅ market_overview / hotspot accent + badge
- ✅ Follow-trade strict gate：`candidateType === 'symbol'` && `executable === true`
- ✅ 10 locale i18n（含 en_XA）
- ✅ 排序按 Stage 0 canonical comparator
- ✅ 5 次刷新 hash 稳定 + a11y axe 0 + raw artifact

### 5.5 全局（hotfix 链积累纪律）

- ✅ leakCount=0 维持
- ✅ 每 stage ≥3 次实测真 PM run + raw artifact commit 进 PR
- ✅ Cost cap：每 visit trigger 不超 1 resident + 3 symbol candidate

---

## § 6 实施流程

### 6.1 派工模型

Stage 0 Contract gate 单 PR 先 merge → Stage 1 / 2 / 3 依次单 PR。每 stage 完成后报告 + raw artifact commit 进 PR。

### 6.2 PAUSE 触发场景

- 任何 § 13 cannot-do 违反
- 数据源真实查证后不可用（CoinGecko / CryptoCompare endpoint 变化）
- Vercel runtime 限制
- UI 改动超出 Dan 拍 "决策流多 type 同区不同样式" 范围

---

## § 13 不能做（v1.1 12 → 20 条）

继承 hotfix 链积累红线 + Codex Round 1 新加 8 条：

1. 不动 hotfix-5 内容质量约束（leakCount=0 维持）
2. 不动 hotfix-4 去重 + stable order 逻辑
3. 不动 hotfix-3 hydration 多机制
4. 不动 hotfix-2 demo fallback 关闭
5. 不动 hotfix-1 撤面板（不复活 TeamTrackRecordPanel）
6. 不擅自加新 panel / 重构 V10 board layout
7. 不擅自改 prod（Constitution Rule 2 v0.1.2）
8. 不引入第 3 个 LLM provider
9. 不加 `void trigger()` fire-and-forget（必须 waitUntil）
10. 不擅自改 Vercel cron 配置
11. 不 inline TeamMemberId（hotfix-5 红线）
12. Follow-trade 按钮 strict gate（market_overview 严禁渲染）
13. **不得把 `market_overview` / pure `hotspot` 当假 symbol 写进 trade-decision branch**（v1.1 新加）
14. **不得用 `symbol=BTC` / `symbol=UNKNOWN` / `currentPrice=1` 兜底生成常驻 trade card**
15. **不得让 `market_overview` 进入 executable / follow-trade resolver**
16. **不得依赖 preview cron 作为 B.14 cadence 验收**
17. **不得在无 social API key 时把 social score 作为 P0 验收项**
18. **不得每次用户访问触发 resident + full symbol pool**——必须 per-candidate cadence/cooldown/cost cap
19. **不得修改 public payload shape 而没有 legacy fallback**
20. **不得用 index / Map iteration / random 作为最终排序依据**

---

## § 14 Constitution 对照

| Rule            | Check                                                     | 答   |
| --------------- | --------------------------------------------------------- | ---- |
| Rule 1 部署身份 | preview only                                              | PASS |
| Rule 2 v0.1.2   | preview free / prod 不动                                  | PASS |
| Rule 3 视觉品牌 | Dan 已授权"决策流多 type 同区不同样式"，不重构 layout     | PASS |
| Rule 4 schema   | Stage 0 contract gate + legacy fallback                   | PASS |
| Rule 5 AI 诚实  | leakCount=0 维持 + 不生成假 trade card                    | PASS |
| Rule 6 协作闭环 | Codex Round 1 完成 + F 双脑接力 v1.1                      | PASS |
| Rule 7 验证     | § 5 measurable + 实测稳定性 + raw artifact + Stage 0 gate | PASS |

---

## § 15 验收 Checklist

- [ ] § 5.1 Stage 0 5 项 ✅
- [ ] § 5.2 Stage 1 7 项 ✅
- [ ] § 5.3 Stage 2 5 项 ✅
- [ ] § 5.4 Stage 3 6 项 ✅
- [ ] § 5.5 全局 3 项 ✅
- [ ] Constitution § 14 PASS
- [ ] § 13 cannot-do 20 条 0 违反
- [ ] 4 stage 4 独立 PR / preview / 实测 / raw artifact
- [ ] Dan preview 验收通过

---

## § 16 老板简报

claw42 工作台产品架构升级（Round 1 评估后版本）。本次做了啥：用户进站直接看到两个常驻分析卡——每日大盘分析（早上一次更新）+ 当日热点叙事（白天 2-3 次更新），价值感够、节奏稳定。币种分析按优先级抓——大币 / 热门 / 新闻驱动优先，长尾小币只在评分高时进。卡片同区分三种样式：大盘卡 / 热点卡 / 币种卡，用户一眼区分类型，视觉统一。关键澄清：大盘 / 热点卡**不输出具体交易方案**——它告诉你"今天该不该进入风险市场 / 哪条叙事值得盯"，币种卡才有跟单入口。后续规划：架构稳定后推多空辩论戏剧化 + 6 阶段决策仪式感。

---

## § 17 Anti-Rationalization（v1.1 加 Codex 4 个 angle）

| 逃逸路径                                        | 为什么不行                                                        | 正确做法                                                |
| ----------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Codex 按 v1.1 spec 盲实施不 first-hand 验证     | Round 1 已证 F 推测命中率 30%                                     | 每 stage 起步 first-hand 调研 → 实测稳定性              |
| spec 大塞 L4 戏剧化进 B.14                      | hotfix 链 5 次教训                                                | L4 推 B.15                                              |
| 常驻卡输出 entry/stop/tp                        | 大盘/热点价值不是交易方案                                         | trade-disabled branch + § 13 #13/#14/#15 红线           |
| 大盘卡 / symbol selector 两系统独立             | risk-off 信号不传递浪费                                           | Stage 2 selector 读 market_overview 输出调权重          |
| 每 visit trigger 跑 resident + full symbol pool | 成本爆炸                                                          | per-candidate cadence + cooldown + cost cap（§ 13 #18） |
| history dedupe key 不分 type                    | market_overview 每日 1 / hotspot 多次 / symbol 长期—— 同 key 混乱 | 分 type dedupe key（§ 3.2 已列）                        |
| 数据源用 fallback BTC / currentPrice=1          | hotfix-3/4/5 教训 + trade card 假语义                             | § 13 #14 红线 + 单元测试覆盖                            |
| Social 维度强行做 P0                            | 无 key 硬做会假装有数据                                           | 降 P1 等 Dan procurement                                |
| Preview cron 不跑就放弃 cadence 验收            | hotfix-2 教训                                                     | manual / refresh / test-clock 验收（§ 13 #16）          |
| Stage 1 / 3 不等 Stage 0 contract               | hotfix-3 hydration 漏洞重演                                       | Stage 0 gate 单 PR 先 merge                             |
| Public payload shape 改但无 legacy fallback     | 老 record 丢                                                      | § 13 #19 红线                                           |
| 排序用 index / random / Map iter                | hotfix-4 教训                                                     | canonical comparator + § 13 #20 红线                    |

---

## § 18 Decision-Log 联动

完成后追加：

```
[2026-MM-DD] [架构] B.14 4 stage 闭环：DecisionCandidate contract + resident analysis + priority selector + multi-type card
[2026-MM-DD] [流程] Codex Round 1 评估 F 全接受 0 push back（命中 F 5 个 FAIL/PARTIAL 假设 + 4 个 Product/UX angle）
[2026-MM-DD] [流程] AI 天估调整为 7.5-11.5（含返工真实 9-14）
```

---

## § 19 Tasks 索引（v1.1 重组）

| Task      | Stage      | Priority | Story                                                                              |
| --------- | ---------- | -------- | ---------------------------------------------------------------------------------- |
| **T100**  | 0 Contract | P0       | DecisionCandidate + CandidateType + public payload optional 字段 + legacy fallback |
| **T101**  | 0 Contract | P0       | Canonical ordering comparator + tie-breaker + 禁用 random/index/Map iter 单测      |
| **T102**  | 0 Contract | P0       | History dedupe key by candidateType 设计                                           |
| **T103**  | 0 Contract | P0       | Stage 0 单 PR + verify gate + 文档明示后续 stage 依赖                              |
| **T201**  | 1 Resident | P0       | PM pipeline candidateType branch（symbol / market_overview / hotspot）             |
| **T202**  | 1 Resident | P0       | Trade-disabled branch：market_overview 无 tradeDecision 输出                       |
| **T203**  | 1 Resident | P0       | market_overview cadence policy + manual/refresh/test-clock trigger                 |
| **T204**  | 1 Resident | P0       | hotspot cadence policy + 同上                                                      |
| **T205**  | 1 Resident | P0       | 14 角色 prompt 按 candidateType 分支（trade-disabled 时不出 entry/stop/tp）        |
| **T206**  | 1 Resident | P0       | Fear & Greed adapter 接入 evidence pack                                            |
| **T207**  | 1 Resident | P0       | 实测 ≥3 次真 PM run + raw artifact + leakCount=0 verify                            |
| **T301a** | 2 Selector | P0       | CoinGecko market cap / volume 字段保留进 watch pool                                |
| **T301b** | 2 Selector | P0       | CryptoCompare 7d news count / source diversity / high-impact scoring               |
| **T301c** | 2 Selector | **P1**   | CryptoPanic / social score（等 Dan 提供 key）                                      |
| **T302**  | 2 Selector | P0       | 4 维度评分函数 + executable 权重 + 单元测试                                        |
| **T303**  | 2 Selector | P0       | Cache 5min + fallback 静态 universe + data-source-missing neutral 测试             |
| **T304**  | 2 Selector | P0       | Cost cap：visit trigger 不超 1 resident + 3 symbol candidate                       |
| **T401**  | 3 UI       | P0       | 决策流卡片 3 type 渲染分支                                                         |
| **T402**  | 3 UI       | P0       | market_overview / hotspot accent + badge（10 locale i18n 含 en_XA）                |
| **T403**  | 3 UI       | P0       | Follow-trade strict gate（仅 symbol+executable 渲染）                              |
| **T404**  | 3 UI       | P0       | 排序按 Stage 0 canonical comparator                                                |
| **T405**  | 3 UI       | P0       | 5 次刷新 hash 稳定 + a11y axe 0 + responsive + raw artifact                        |

P0 = 21 / P1 = 1 / 总 22 tasks。

---

## v1.1 决策留痕

**Codex Round 1 → v1.1 接受清单**（F 双脑判断 0 push back）：

| Codex 建议                                                 | F 判断 | 落实位置                                                             |
| ---------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| Stage 数 3 → 4（加 Stage 0 Contract gate）                 | 接受   | § 1.2 + § 6 + § 19 T100-T103                                         |
| DecisionCandidate contract（不是只 CandidateType field）   | 接受   | § 2.1 + T100                                                         |
| Trade-disabled pipeline branch                             | 接受   | § 2.2 + T201/T202                                                    |
| Public payload legacy fallback                             | 接受   | § 2.1 + T100 + § 13 #19                                              |
| Canonical ordering comparator + 禁用 random/index/Map iter | 接受   | § 2.1 + T101 + § 13 #20                                              |
| Social 维度 P0 → P1                                        | 接受   | § 2.3 + T301c                                                        |
| Cron 实装 → cadence policy + manual/refresh/test-clock     | 接受   | § 2.2 + T203/T204 + § 13 #16                                         |
| §13 cannot-do +8 条                                        | 接受   | § 13 #13-#20                                                         |
| AI 天估调整 7.5-11.5                                       | 接受   | § 1.2                                                                |
| Product/UX 4 angle                                         | 接受   | § 17 Anti-R + § 3.2 + § 13 #18 + Stage 2 selector 读 market_overview |
| Cost cap 进 spec                                           | 接受   | T304 + § 13 #18                                                      |
| History dedupe key 早定                                    | 接受   | § 3.2                                                                |

---

_版本：v1.1 (2026-05-17 Codex Round 1 全接受整合)_
_下一步：Dan APPROVED v1.1 → 派 Codex Stage 0 Contract gate 实施 → 4 stage 串行_
