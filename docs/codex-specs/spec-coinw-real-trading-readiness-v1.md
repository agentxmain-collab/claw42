# Spec: coinw 真下单准备大版本 v1.0

> **版本**：v1.2（2026-05-21 / Codex Stage 0 抓 base 错位 + F 自决方向 2 + base ref 校准 + 文档 drift 清）
> **作者**：F 主笔 + Codex Round 1 9 + Round 2 3 OBJECT + Stage 0 base 校准 + Dan 4 拍板 + Dan 委托方向 2
> **状态**：**v1.2 / READY-FOR-CODEX-RESTART-T000a**（Dan APPROVED + F 自决 base = feature 分支 / Codex 重跑 T000a 起 / 完工后 A/B 线收束 → prod）
> **★ implementation base ref（v1.2 校准）**：spec 基于 `origin/feature/coinw-contract-release`（含 `7da829f` + 后续）/ **不是 origin/main**。Codex Stage 0 first-hand 抓出 `origin/main = 1ad6407` 不含 CoinW scaffold（follow-intents / oauthReadiness / futuresOrderIntent / futuresInstruments / futuresLinks 都只在 feature 分支）。F 自决方向 2：Codex 在 feature worktree 实施 / 完工后 A/B 线收束 merge feature → main → promote prod（详 § 0.7）。
>
> **T000a 第一步必须**在 feature worktree 跑 `git fetch origin && git rev-parse origin/feature/coinw-contract-release` 记录 base sha + 验证 scaffold 在 feature 分支可达
> **协议**：claude-codex-protocol v2.5 19 段
> **依赖**：
>
> - `web-dev/claude-codex-sync/coinw-real-trading-readiness-sync.md` Brief v1.0 final（Round 1-3 收敛）
> - `claw42/docs/project-constitution.md` v0.1.1（7 Rule）
> - `web-dev/methodology/f-protocols.md`（A.4 双轨部署 / A.5 双轨同步 / A.6 Codex 协作）
> - main HEAD `7da829f` release candidate（Brief Evidence 基线 / Codex first-hand source）
> - `web-dev/decision-log.md` 2026-05-21 (晚) 多处 entry（5 方向 / 角色明确 / § A.3 扩展 / Brief APPROVED）

---

## ★ 核心元规则（Brief v1.0 final § 0 同源）

> **CoinW 始终是执行主体 / KYC / 风控 / 资金主体。Claw42 是 AI 分析输入 + 下单意图触发。**
>
> **UI / 文案 / 法务文案 / 详细参数** 仍留 Dan 拍板槽位（按新 § A.3 扩展规则）。
>
> **Dan 已拍 4 项 spec 派工前置决策**（详 § 0.6）：Q1 下单按钮按 candidate 状态分流 / Q2 Lane S provider = CryptoPanic / Q3 Lane S social 权重 cap = 15% / Q4 Env Owner = Dan 自己

---

## § 0.6 ★ Dan 4 拍板（2026-05-21 / 派工前置）

### Q1 下单按钮状态分流（reframe MVP 选型 → candidate state 分流）

A 跳转 vs E/B 真下单**不是 MVP 时间线选型，是按 candidate 状态分流 / 同时存在**：

| Candidate 状态                                                     | 触发模式              | spec 内对应                                                                      |
| ------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------- |
| **无明确可下单策略**：market_overview / hotspot / no-signal symbol | **A 跳转模式**        | T-1 通用入口（generic CoinW futures URL）/ T-2 带交易对深链（pair-specific URL） |
| **已生成明确可下单策略**（含 entry / SL / TP / 仓位）              | **E 或 B 真下单模式** | T-3 代提交（E hosted confirmation handoff 或 B API direct）                      |

含义：

- A 永远存在 / Gate 1 起就开 / 是无策略 candidate 的默认入口
- E/B 按 Gate 升级（Gate 2 = sandbox / Gate 3 = controlled live / Gate 4 = 扩量）
- candidate 状态机决定 UI 走 A 还是 E/B（candidate type 已含 `market_overview` / `hotspot` / `symbol` / strategy.action）
- **E vs B 工程可实现性由 Codex first-hand 评估**（CoinW 有 API）后选 / Stage 0 含此评估

### Q2 Lane S provider = **CryptoPanic**

- 项目 `7da829f:src/lib/news/sourceRegistry.ts` 已有 standby 脚手架
- 接入成本最低 / 快速验证整体链路
- 后续可升级 LunarCrush / X v2（不在本 spec scope，留 v2.0）

### Q3 Lane S Social 权重 cap = **15%**

- 8 维度平均 12.5% / 给社交 15% 不挤压基本盘
- 上限可调（先低后高）/ **永远不能 > 25%**
- `SOCIAL_SCORE_CAP = 0.15` 作配置初值 / 后续 Dan 可调

### Q4 Env / Secret Owner = **Dan 自己（主 Owner）**

- Dan 协调 CoinW 平台对接方 + CoinW 内部安全 / 风控团队
- preview + prod + CoinW dedicated env 全部 Dan 主导
- Codex 不需另外问 owner / 按 Dan 协调路径走

---

## § 0.7 ★ 大版本 base 分支 + A/B 线收束 release 路径（F 2026-05-21 自决方向 2）

### 0.7.1 base 分支决定

- **实施 base = `origin/feature/coinw-contract-release`**（非 `origin/main`）
- 原因：CoinW scaffold（follow-intents / oauthReadiness / futuresOrderIntent / futuresInstruments / futuresLinks）都在 feature 分支 / `origin/main = 1ad6407` 不含
- F 自决（Dan 委托 "你们来定 + A/B 线收束 + 进生产"）

### 0.7.2 漂移同步纪律

Codex 在 feature worktree 实施期间 / 防 feature 与 main 累积漂移：

- **每完成 Stage（Stage 1 / Stage 2 / Stage 3）跑 `git fetch origin && git merge origin/main` 同步主干修复**
- 如冲突 → Codex first-hand 解决（小冲突自决 / 大冲突回报 F）
- Gate 1 启动前必跑一次 feature ↔ main 完整 rebase / 测试 全通过才推 Gate

### 0.7.3 A/B 线收束 release 路径（Dan 拍：完工后进 prod）

```
[NOW] Codex 在 feature worktree 实施 Stage 0-4
  ↓
每 Stage 完成 staging preview → Dan 验收
  ↓
所有 Stage 通过 + Gate 1 准备好 + Dan 显式 release 授权
  ↓
F 出 release 转发段（feature → main merge）
  ↓
Dan 本机 git merge feature/coinw-contract-release → main → push origin/main
  ↓
A/B 线收束完成（feature 分支生命周期结束 / main 含完整大版本）
  ↓
Dan 拍 prod promote 时机 → npx vercel --prod --scope agentxmain-collabs-projects
  ↓
Gate 1 prod 激活（外链 + 无代提交）
  ↓
Gate 2 → 3 → 4 后续按 § 7.4 序列分段
```

### 0.7.4 不破红线

- Constitution Rule 2 v0.1.1：双 prod 保护维持（Tier 1 ai.coinw.com 专用电脑 / Tier 2 claw42.ai vercel）
- 每 Gate 必 Dan 显式授权（commit footer `prod-promotion: Dan directive YYYY-MM-DD`）
- feature 分支期间不上 prod / 不擅自 merge → main

---

## § 1 Overview

### 1.1 背景

claw42 prod (`b74023a` PR #63) 是演示模式（follow-trade disabled / 文案"演示模式：当前不会真实下单"）。release candidate 分支 `feature/coinw-contract-release` (含 `7da829f`) 已含部分 CoinW scaffold（follow-intents disabled-only endpoint / futuresOrderIntent builder / oauthReadiness model / futuresInstruments fetch / futuresLinks URL builder / beta leverage cap），但**真实订单提交路径未实现** + **scaffold 不在 `origin/main`**（详 § 0.7 base 分支决定）。

### 1.2 大版本目标

claw42 从"演示 AI 工具"升级为"**第三方 AI 决策辅助 + 真实下单触发**"——用户在 claw42 看 AI 分析 → 通过 CoinW 平台完成真实下单。

### 1.3 三 Lane 并行结构

| Lane                                     | scope                                                                                                                                 | 独立性                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Lane S · Social 数据维度重新引入**     | provider 选型 + 数据源 contract + 归一化 + 缓存 + neutral fallback + 重新加入 TopicReasonKind / labels / order / breakdown / 更新测试 | 完全独立 / 不阻塞交易 beta                                |
| **Lane R · Fallback / Readiness 硬前置** | 6 来源 fallback taxonomy + UI 透明 + 文案槽位（Dan + 法务）                                                                           | 真实订单硬前置 / Lane T 中 T-3 依赖                       |
| **Lane T · Trade CTA 三能力分离**        | T-1 通用入口 / T-2 带交易对深链 / T-3 Claw42 代提交订单                                                                               | T-1/T-2 + Direction A 可早走 / T-3 (E/B) 必须 Lane R 冻结 |

### 1.4 生产激活 Gate 1-4

| Gate   | scope                                                                               |
| ------ | ----------------------------------------------------------------------------------- |
| Gate 1 | T-1 + T-2 + Direction A（外链 + 无代提交）+ Lane R UI 透明                          |
| Gate 2 | Direction E test mode / order intent test mode（CoinW hosted confirmation sandbox） |
| Gate 3 | Controlled live submission（白名单 / 限额 / 灰度）                                  |
| Gate 4 | 扩大 live submission                                                                |

每 Gate 必 Dan 显式授权 + 独立验收 + 独立回滚。Lane S 单独走 prod release（不绑大版本 gate）。

---

## § 2 In-Scope

### 2.1 Stage 0 — spec readiness 前置（P0 STOP gate）

**T000a · scaffold readiness audit**（Codex Round 1 OBJECT 1 整合 - 必须 Stage 0 第一项执行）：

source baseline: `origin/feature/coinw-contract-release`（含 `7da829f` + 后续）/ **不是 origin/main**（详 § 0.7）；实施前在 feature worktree 跑 `git fetch origin && git rev-parse origin/feature/coinw-contract-release` 记录 base sha + verify scaffold 在 feature 分支可达。

| Capability                       | 当前实现                                                                         | 缺口 / 不得误判                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/api/watch/follow-intents`      | POST 已建，限流、body parse、CoinW futures intent draft、readiness response 已有 | 固定 disabled；无 token/session；无 submit；无 callback/status pipeline；不能称为 test/live |
| `CoinWFuturesOrderMode`          | `disabled \| test \| live` 三档 type 已有                                        | `live` 当前仍 blocked；`test` 仅 readiness true，不等于已提交订单                           |
| `coinWOAuthReadiness()`          | 校验 OAuth env + test account + order mode                                       | 只读 env，不做 OAuth handshake，不保存 token                                                |
| `buildCoinWFuturesOrderIntent()` | 生成 `intentId/expiresAt/coinwRequest`，含 `/v1/perpum/order` body               | 只生成 draft；无签名、nonce、replay protection、audit store                                 |
| futures instruments              | `/v1/perpum/instruments` fetch + 10min memory cache + static fallback            | static fallback 只能用于 preview/analysis，不得作为 live submission 事实                    |
| futures links                    | pair-specific template + generic futures fallback                                | generic fallback 不是可下单深链；watch-only/non-symbol 不能伪装为可下单                     |
| beta leverage cap                | `COINW_FUTURES_BETA_MAX_LEVERAGE` route cap 已有                                 | 仅 cap leverage；不等于完整风控                                                             |

**readiness mode 定义**：

- `disabled`: 可生成 intent draft / 可跳 CoinW 页面 / 不能 test 或 live submit
- `test`: OAuth env + test account + mode=test 齐备；只能进入 CoinW test / sandbox / hosted confirmation 链路
- `live`: 仅 Dan 显式 prod 授权 + Gate 3/4 条件满足后允许；当前代码对 live 明确 blocking，不能绕过

**grep verify**：

- `rg -n "mode: \"disabled\"|coinw_real_submission_not_enabled" src/app/api/watch/follow-intents/route.ts`
- `rg -n "CoinWFuturesOrderMode|live_order_submission_requires_separate_release|realSubmissionEnabled" src/lib/coinw/oauthReadiness.ts`
- `rg -n "endpoint: \"/v1/perpum/order\"|INTENT_TTL_MS|thirdOrderId" src/lib/coinw/futuresOrderIntent.ts`
- `rg -n "COINW_FUTURES_STATIC_FALLBACK|COINW_FUTURES_INSTRUMENTS_TTL_MS" src/lib/coinw/futuresInstruments.ts`

**T000b · 6 Ledger PENDING gate clear**（Dan）：

- Env / Secret ownership 完整路径（CoinW trading env 表 A 9 项 + Lane S provider matrix 表 B 6 provider）
- preview / prod Vercel env + CoinW dedicated prod env + owner + rotation 流程
- 法务文案 owner + 流程

**T000c · Direction 选型 Dan 拍**：

- MVP 选 Direction A 单走 / 还是 A + E 同步推进 / 或其他
- 见 § 18 Open Questions

### 2.2 Stage 1 — Lane S 实施（P0）

待 Stage 0 / Dan 拍 Lane S provider 后展开。Tasks 见 § 11。

### 2.3 Stage 2 — Lane R 实施（P0，Lane T 硬前置）

待 Stage 0 / Codex first-hand verify 当前 6 类失败状态表现后展开。Tasks 见 § 11。

### 2.4 Stage 3 — Lane T 实施（P0）

按 Dan 拍 Direction MVP 选型展开。Tasks 见 § 11。

### 2.5 Stage 4 — Gate 1-4 gated production activation（P0）

每 Gate 独立验收 + 独立回滚 + Dan 显式授权。详 § 7 Detailed Design。

### 2.6 Out-of-Scope（红线，不可碰）

- ❌ 不动 `teamRegistry.ts` 14 TeamMemberId（Constitution Rule 4）
- ❌ 不动现有 hotfix 1-7 红线（leakCount=0 / canonical / waitUntil / per-symbol watch-only gate）
- ❌ 不擅自动 `oauthReadiness.ts:43-52` live submission separate release 拦截（Gate 3 前不破）
- ❌ 不擅自上 prod（Constitution Rule 2 v0.1.1 + 每 Gate Dan 显式授权）
- ❌ 不擅自填具体 UI / 文案 / 视觉（按新 § A.3 扩展规则全部 Dan 拍）
- ❌ 不评估法务 / 合规（Dan + 法务负责）
- ❌ 不绑 B.15 多空辩论真实现 / C 线 UI Uplift v1 / C-Series 4 spec（独立 spec）
- ❌ 不动 xxcrypto-gtm（冻结）

---

## § 3 Edge Cases（4 轴枚举）

### 3.1 输入轴

- Lane S provider 数据格式异构（CryptoCompare / CoinGecko / CryptoPanic / X v2 / 其他）→ 归一化层 fallback
- CoinW order intent body 字段缺失（pair / leverage / size 等）→ Lane R disabled / fallback 路径
- 用户从 demo mode 历史 record 触发 follow-trade → 防误显示为可执行（Brief § 5 hidden gap）

### 3.2 状态轴

- Gate 1 → Gate 2 切换中 follow-intents route mode 从 disabled → test → live → 4 状态回流（success / reject / expired / cancel）
- Lane R 状态机 6 类失败可能同时触发优先级
- Lane S provider 限流 / 失败 fallback 到 neutral

### 3.3 边界轴

- watch-only symbol（未上 coinw）仍 T-1 通用入口可用 / T-2 / T-3 不可用（hotfix-5 红线保留）
- non-symbol candidate（market_overview / hotspot）vs symbol candidate 不能共用同一种订单入口合同（Brief § 5 hidden gap）
- iframe / Direction C 撞 CSP / frame policy / CoinW 自身嵌入限制

### 3.4 失败轴

- Direction E hosted confirmation 4 状态全 fail → rollback to Gate 1
- Lane S provider 全 fail → social=null / neutral fallback / 不阻塞 PM run
- CoinW API 失败 vs cache stale fallback 同时触发 → 优先级决策（Lane R 状态机）
- KYC 未通过 / 风控拦截 / 限额超 → UI 透明展示（不假装"分析中"）

---

## § 4 Assumptions

1. Brief v1.0 final 已 Dan APPROVED → 三 Lane / Direction 5 方向 / Gate 1-4 / 6 Ledger 架构冻结
2. Codex first-hand 提供所有 Evidence 类事实（F 不重新 verify，按角色明确）
3. CoinW 平台对接方案（A / E / B / D / C）由 Codex 工程视角 + Dan 协调
4. 法务 / 合规由 Dan 处理 / F 不评估
5. 大版本 release candidate 仍走双 prod 模式（claw42.ai Vercel + ai.coinw.com CoinW Jenkins）/ 完工后 A/B 线收束 merge feature → main → prod（详 § 0.7）
6. base ref = `origin/feature/coinw-contract-release`（v1.2 校准 / 非 origin/main，因 scaffold 在 feature 分支）/ Codex 每 Stage 完成跑 `git merge origin/main` 防漂移

---

## § 5 Measurable Success Criteria

### 5.1 Lane S

- TopicReasonKind 重新含 social / PUBLIC_REASON_LABELS / ORDER / scoreBreakdown 同步加 social
- social 测试断言 "scoreBreakdown 不含 social" 已撤掉 / 新断言 "social provider neutral fallback 不阻塞 PM run"
- provider 选型 1 个 active（待 Dan 拍）+ neutral fallback 实装
- 9 维度评分体系无 social 权重独占（social ≤ X% / Dan 拍 X）

### 5.2 Lane R

- 6 来源 fallback taxonomy 完整枚举 + 状态机覆盖测试 100%
- UI 透明展示 6 类状态（badge / banner / empty state / disclaimer 位置 Dan 拍）
- error / fallback / degraded state Codex first-hand verify 后产出现状报告 + spec gap 列

### 5.3 Lane T

- T-1 通用入口 / T-2 带交易对深链 / T-3 代提交三能力独立实装 + 测试覆盖
- canRenderFollowTrade strict gate 仍生效（hotfix-5 红线维持）
- Direction E 5 协议点实装 + Gate 1→2 验收 4 状态回流 sandbox pass
- Direction A 跳转测试 pair-specific + 通用 fallback 双路径覆盖

### 5.4 Gate 1-4

- 每 Gate 独立 staging 验收 checklist
- 每 Gate 独立 rollback 命令 + 验证
- 每 Gate Dan 显式授权 留痕（commit footer `prod-promotion: Dan directive YYYY-MM-DD`）
- Gate 1 → 2 → 3 → 4 验收 case 全 pass 才推进下 Gate

### 5.5 6 Ledger

- 5 项 ✅ filled / Env / Secret PENDING gate clear（Dan 拍 + 实装）→ 才进 Lane T (E/B) 派工

### 5.6 红线维持

- leakCount=0 / canonical ordering / waitUntil / hotfix-5 per-symbol watch-only gate / 14 TeamMemberId / topicSelector type 合同全维持
- Constitution Rule 1-7 § 14 Check 全 PASS

---

## § 6 Implementation Stages

详见 § 2 Stage 0-4。

依赖序：

- **Stage 0 STOP gate**（spec readiness + 6 Ledger PENDING clear + Direction Dan 拍）→ 必须先通过
- **Stage 1 (Lane S) + Stage 2 (Lane R) 真并行** → Codex first-hand 推进
- **Stage 3 (Lane T)** → T-1/T-2/A 可与 Stage 2 并行 / T-3 (E/B) 必须 Stage 2 完成
- **Stage 4 Gate 1-4 序列**：Gate 1 完成 → Gate 2 sandbox → Gate 3 controlled live → Gate 4 扩大

---

## § 7 Detailed Design

### 7.1 Lane S Detailed Design（Codex Round 1 OBJECT 2 整合）

#### Provider comparison（不预填价格 / 不预选 Dan 槽位 / 来源 5 vendor-doc live check）

| Provider      | 当前项目状态       | 可用信号                                                              | 工程判断                                           |
| ------------- | ------------------ | --------------------------------------------------------------------- | -------------------------------------------------- |
| CryptoCompare | active news source | news article count / source diversity / high impact；非 social-native | 保留为 news baseline，不当 social provider         |
| CryptoPanic   | standby scaffold   | currencies + votes native（按 repo registry）；需 key 验证字段 / 限流 | 最小接入成本候选，但必须先 live key test           |
| X API v2      | 未接入             | public metrics 可派生 engagement；mention search 需计划 / 权限        | 能给真实社交热度，但成本 / 限流 / 查询语义风险最高 |
| LunarCrush    | 未接入             | crypto social metrics vendor；字段需 key / live test                  | 专业 social provider 候选，不在 spec 写死字段名    |
| Santiment     | 未接入             | social trends / social volume / sentiment ratio 方向                  | 专业数据候选，适合后续高质量信号，不作为快速默认   |

source: CryptoCompare `https://min-api.cryptocompare.com/data/v2/news/?lang=EN` / CryptoPanic `https://cryptopanic.com/developers/api/` / X API v2 `https://docs.x.com/x-api/fundamentals/data-dictionary` / LunarCrush `https://lunarcrush.com/developers/docs` / Santiment `https://academy.santiment.net/`

#### Normalized social contract

```ts
export type SocialSignalProviderId = "cryptopanic" | "x_v2" | "lunarcrush" | "santiment";

export interface SocialSignalObservation {
  provider: SocialSignalProviderId;
  candidateKey: string;
  symbol?: string;
  observedAt: string;
  windowStart: string;
  windowEnd: string;
  mentionCount?: number;
  uniqueAuthorCount?: number;
  engagementScore?: number;
  sentimentScore?: number; // normalized -1..1
  confidence: number; // 0..1
  sourceRefs: string[];
  rawRef?: string;
}

export interface SocialSignalAggregate {
  candidateKey: string;
  symbol?: string;
  cacheVersion: string;
  observedAt: string;
  providerIds: SocialSignalProviderId[];
  mentionScore: number;
  engagementScore: number;
  sentimentScore: number;
  confidence: number;
  dataStatus: "ok" | "missing" | "stale" | "provider_error";
}
```

#### Cache version 约束（防 § 5 hidden gap "social 延迟改 ranking" 碰撞）

- raw / aggregate cache TTL ≤ PM run freshness window
- 每 PM run 接收**不可变** social snapshot + version
- provider 延迟到达不可改变已完成 PM run 的 ranking

### 7.2 Lane R Detailed Design（Codex Round 1 OBJECT 3 整合）

#### 6 source-layer failure kinds

```ts
export type TradingReadinessFailureKind =
  | "analysis_data_degraded"
  | "instrument_unavailable"
  | "auth_account_not_ready"
  | "user_risk_confirmation_required"
  | "submission_mode_blocked"
  | "exchange_network_or_result_failed";

export type TradingReadinessSeverity = "info" | "degraded" | "blocked" | "error";

export interface TradingReadinessState {
  kind: TradingReadinessFailureKind;
  severity: TradingReadinessSeverity;
  blocking: boolean;
  retryable: boolean;
  source:
    | "analysis_pipeline"
    | "coinw_instrument"
    | "oauth_readiness"
    | "user_confirmation"
    | "order_submission"
    | "exchange_result";
  code: string;
  i18nKey: string;
  observedAt: string;
  technicalDetails?: Record<string, string | number | boolean | null>;
}
```

#### Transition matrix

| From     | To       | Allowed trigger                               | Notes                        |
| -------- | -------- | --------------------------------------------- | ---------------------------- |
| unknown  | checking | page load / status poll / submit attempt      | no public copy until checked |
| checking | ok       | all required source checks pass               | ok can be cached briefly     |
| checking | degraded | analysis / source stale but non-blocking      | no fake confidence copy      |
| checking | blocked  | instrument / auth / user / mode blocks action | CTA must not submit          |
| checking | error    | CoinW / network / result failed               | retryable depends code       |
| degraded | checking | refresh / retry                               | can recover                  |
| blocked  | checking | env / auth / user action changed              | no auto live promotion       |
| error    | checking | retry / backoff                               | audit previous error         |

#### UI transparent-layer slot types（不填具体文案 / 不拍位置 / 按新 § A.3 Dan 拍）

- card-level status badge
- panel-level readiness banner
- empty-state reason slot
- CTA disabled reason slot
- detail / audit drawer reason slot

#### i18n key namespace（只定义槽位）

- `agentWatch.tradeReadiness.states.<kind>.label`
- `agentWatch.tradeReadiness.states.<kind>.detail`
- `agentWatch.tradeReadiness.states.<kind>.action`
- `agentWatch.tradeReadiness.modes.disabled|test|live`

10 locale keys 必须存在，但 value strings 由 Dan + 法务 owned。

#### Tests

- unit：taxonomy mapper from existing route / readiness / instrument errors
- contract：`/api/watch/follow-intents/status` returns typed state without secret values
- contract：`/api/watch/follow-intents` unsupported symbol / rate limit / disabled paths map to correct kind
- UI：non-symbol / watch-only cannot render submit-capable CTA
- e2e：6 states can be rendered without layout break and without public content leak

### 7.3 Lane T 实现细节（Codex Round 1+ 待填，按 Dan 拍 Direction 选型）

**T-1 通用入口**：

- 已存在（pair 缺失 fallback CoinW futures 通用页）
- 本 spec 内不动 / 仅 verify 文案 / disclaimer 槽位

**T-2 带交易对深链**：

- 已存在（`buildCoinWFuturesTradeUrl` pair-specific）
- 本 spec 内 verify canRenderFollowTrade strict gate 维持 + pair 传递正确

**T-3 Claw42 代提交订单**：

- **Direction E hosted confirmation handoff** 协议级实装（Brief § 7.5 5 协议点）：
  - 协议点 1：CoinW 接收 intent 入口形式（URL deep link / POST handoff / SDK bridge）—— Codex 调研 + Dan + CoinW 对接方拍
  - 协议点 2：intent 签名规范（HMAC / nonce / TTL / replay protection）—— Codex 工程设计
  - 协议点 3：CoinW 端校验流程 —— CoinW 平台合同
  - 协议点 4：回流机制（callback / status poll / webhook）—— Codex + CoinW 协议设计
  - 协议点 5：audit 持久化（intent + orderId 映射）—— Codex 实装 + 与 decision-log 关系
- **Direction B API direct from Claw42**（Gate 4 扩大后考虑）：
  - 补齐 token / session / order-submit / status pipeline（现有 scaffold 缺）
  - 撤销 `oauthReadiness.ts:43-52` live submission separate release 拦截（Gate 3 拍后）
  - 安全 / 状态 / 权限 / 审计完整 audit

### 7.4 Gate 1-4 Activation Design（Codex Round 1 OBJECT 5 整合）

**关键纪律**：不新增能绕过 `oauthReadiness` 的隐形开关 / 在现有 mode 上叠加 trade gate + feature flag。

| Gate       | Entry condition                                                                             | Runtime config                                                                        | Acceptance                                                                                                       | Rollback                                                                |
| ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Gate 1** | Lane R typed readiness contract + T-1 / T-2 external / deep link ready；无 order submission | `COINW_FUTURES_ORDER_MODE=disabled` / optional `COINW_TRADE_GATE=gate1`               | all executable symbol cards deep-link correctly；non-symbol / watch-only 不 submit；follow-intents 返回 disabled | set gate/mode back to disabled and verify no submit path                |
| **Gate 2** | CoinW test account + hosted confirmation / test contract available                          | `COINW_FUTURES_ORDER_MODE=test` / `COINW_TRADE_GATE=gate2` / test account env present | 4 status paths pass：confirmed/submitted / rejected / expired / cancelled；audit rows written                    | return mode to disabled；verify status endpoint shows blocked           |
| **Gate 3** | controlled live approval + allowlist / cap + monitoring                                     | `COINW_FUTURES_ORDER_MODE=live` / `COINW_TRADE_GATE=gate3` / allowlist + cap env / KV | allowlisted test users only；max leverage cap active；live error rate under threshold；rollback drill pass       | flip to gate2 or gate1；inspect no new live submit after rollback       |
| **Gate 4** | Gate 3 stable + Dan explicit production expansion                                           | `COINW_TRADE_GATE=gate4`；live mode remains explicit                                  | scaled metrics green；audit export available；on-call / runbook ready                                            | promote previous production deployment or disable live env and redeploy |

#### Monitoring event names

- `coinw_trade_cta_click`
- `coinw_intent_created`
- `coinw_handoff_opened`
- `coinw_handoff_callback_confirmed`
- `coinw_handoff_callback_rejected`
- `coinw_handoff_callback_expired`
- `coinw_handoff_callback_cancelled`
- `coinw_order_submit_error`
- `coinw_gate_rollback`
- `trade_readiness_state_rendered`

#### Mechanical thresholds

- Gate 1：submit-capable events must be 0
- Gate 2：synthetic confirmed / rejected / expired / cancelled paths must be 100% covered
- Gate 3：任 signature replay accepted = hard fail / 任 non-allowlisted live submit = hard fail / missing audit row = hard fail
- Gate 4：same hard fails as Gate 3 plus daily audit export check

### 7.5 Direction E Protocol Design（Codex Round 1 OBJECT 4 整合 / 协议级工程细节）

#### Protocol point 1: entry form

Engineering recommendation order:

1. **URL deep link with signed compact token** —— 如 CoinW 支持 tokenized hosted confirmation
2. **Server-to-server POST handoff** 返回 CoinW hosted confirmation URL —— 如 payload 太大或不可 URL-visible
3. **SDK bridge** —— 仅当 CoinW 提供官方 JS/SDK 合同

spec 必须标 exact entry form 为 **待 CoinW 平台合同**。Claw42 不能 invent receiving endpoint。

#### Protocol point 2: signature / nonce / TTL / replay protection

- **Signature**：HMAC-SHA256 over canonical JSON 或 canonical query string
- **Payload minimum**：`intentId` / `recordId` / `coinwPair` / `direction` / `orderType` / `quantity` / `leverage` / `marginMode` / optional price / TP / SL / `iat` / `exp` / `nonce` / `kid` / `payloadHash`
- **Nonce**：至少 128-bit random / base64url 或 hex encoded
- **TTL**：align with existing order intent TTL `10 * 60_000` 除非 CoinW requires shorter
- **Replay defense**：KV / Redis key `coinw:intent:nonce:<nonceHash>` with TTL > signature TTL / atomic set-if-not-exists before accepting callback / status
- **Key rotation**：含 `kid` / 不在 repo / sync / logs 存原始 secret

#### Protocol point 3: CoinW validation flow

**待 CoinW 平台合同**：

- 如何 CoinW verifies `kid` / signature
- CoinW pull full payload from Claw42 或 receives full payload in handoff
- User login / KYC / risk confirmation sequence
- Error code taxonomy + retry policy

#### Protocol point 4: return path

Preferred hierarchy：

1. CoinW callback / webhook to Claw42 status endpoint for final state
2. Status poll endpoint if webhook not available
3. User return URL as UX convenience only / **不是 source of truth**

**Status enum 必须覆盖**：`created` / `opened` / `confirmed` / `submitted` / `rejected` / `expired` / `cancelled` / `failed`

#### Protocol point 5: audit persistence

Persist 1 audit row per intent：

- `intentId` / `recordId` / candidate metadata / symbol-pair / source decision id / user-session pseudonymous id / gate / mode / createdAt / expiresAt
- `payloadHash` / `signatureKid` / `nonceHash` / handoffUrl hash-ref / CoinW callback status / CoinW order id (如返回) / reject-error code / callbackAt
- 链接到 existing decision record / decision-log by `recordId` —— 不复制完整 strategy text

---

## § 8 Variables / Constants（Codex Round 1 OBJECT 7 整合）

值分三类：工程安全默认可填 / Dan-CoinW-法务待拍不可填 / provider live test 后填。

### Lane S

- `SOCIAL_SIGNAL_WINDOW_MS` — social aggregation window / 值待 provider 选型
- `SOCIAL_SIGNAL_CACHE_TTL_MS` — raw / aggregate cache TTL / 必须短于或等于 PM run freshness window
- `SOCIAL_SIGNAL_CACHE_VERSION_PREFIX`
- `SOCIAL_NEUTRAL_FALLBACK`
- `SOCIAL_PROVIDER_IDS`
- `SOCIAL_SCORE_CAP` — **Dan 拍 / 不预填百分比**
- `SOCIAL_PROVIDER_TIMEOUT_MS`

### Lane R

- `TRADING_READINESS_STATE_VERSION`
- `TRADING_READINESS_FAILURE_KINDS`
- `TRADING_READINESS_SEVERITIES`
- `FALLBACK_TAXONOMY_TYPES`
- `READINESS_STATUS_CACHE_TTL_MS`

### Lane T

- existing `INTENT_TTL_MS = 10 * 60_000` should be exported or mirrored as `INTENT_SIGNATURE_TTL_MS`
- `INTENT_NONCE_BYTES = 16` minimum
- `INTENT_REPLAY_LOCK_TTL_MS`
- `COINW_TRADE_GATE`
- `COINW_ORDER_INTENT_AUDIT_VERSION`
- `COINW_HANDOFF_STATUS_VALUES`
- `COINW_HANDOFF_SIGNATURE_ALG = "HMAC-SHA256"`
- `COINW_HANDOFF_KID_ENV`

### Existing env names to preserve

- `COINW_FUTURES_API_BASE_URL`
- `NEXT_PUBLIC_COINW_FUTURES_URL`
- `NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE`
- `COINW_OAUTH_CLIENT_ID`
- `COINW_OAUTH_CLIENT_SECRET`
- `COINW_OAUTH_REDIRECT_URI`
- `COINW_OAUTH_AUTHORIZE_URL`
- `COINW_OAUTH_TOKEN_URL`
- `COINW_OAUTH_SCOPES`
- `COINW_FUTURES_TEST_ACCOUNT_ID`
- `COINW_FUTURES_ORDER_MODE`
- `COINW_FUTURES_BETA_MAX_LEVERAGE`

---

## § 9 Files Touched（Codex Round 1 OBJECT 8 整合）

### 9.1 New files

| File                                                         | Owner    |
| ------------------------------------------------------------ | -------- |
| `src/lib/social/socialSignalTypes.ts`                        | LaneS    |
| `src/lib/social/socialSignalNormalizer.ts`                   | LaneS    |
| `src/lib/social/socialSignalCache.ts`                        | LaneS    |
| `src/lib/social/adapters/<selectedProvider>SocialAdapter.ts` | LaneS    |
| `src/lib/social/__tests__/*.test.ts`                         | LaneS    |
| `src/lib/coinw/tradeReadinessState.ts`                       | LaneR    |
| `src/lib/coinw/orderIntentSignature.ts`                      | LaneT-3E |
| `src/lib/coinw/orderIntentAuditStore.ts`                     | LaneT-3E |
| `src/app/api/watch/follow-intents/callback/route.ts`         | LaneT-3E |
| `src/lib/coinw/__tests__/orderIntentSignature.test.ts`       | LaneT-3E |

### 9.2 Modified files

| File                                                             | Owner                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/team/topicSelector.ts`                                  | LaneS                                                              |
| `src/lib/team/__tests__/topicSelector.test.ts`                   | LaneS                                                              |
| `src/lib/team/__tests__/pmDecisionTrigger.topicSelector.test.ts` | LaneS                                                              |
| `src/lib/news/sourceRegistry.ts`                                 | LaneS only if selected provider belongs in registry                |
| `src/app/api/watch/follow-intents/route.ts`                      | LaneR + LaneT                                                      |
| `src/app/api/watch/follow-intents/status/route.ts`               | LaneR + LaneT                                                      |
| `src/lib/coinw/oauthReadiness.ts`                                | LaneR + Gate                                                       |
| `src/lib/coinw/futuresOrderIntent.ts`                            | LaneT                                                              |
| `src/lib/coinw/futuresInstruments.ts`                            | LaneR safety only                                                  |
| `src/lib/coinw/futuresLinks.ts`                                  | LaneT-1 / T-2 only                                                 |
| `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`            | LaneR / T UI slot only                                             |
| `src/modules/agent-watch/v9/TopicStrategy.tsx`                   | LaneR / T compatibility only                                       |
| `src/i18n/types.ts` + `src/i18n/dicts/*.json`                    | LaneR slots only / final copy Dan + 法务                           |
| `package.json`                                                   | only if selected provider requires SDK and Dan approves dependency |

### 9.3 Do not touch without new explicit spec

- `src/lib/team/teamRegistry.ts`
- `docs/agent-ip/team/*.md`
- PM prompt / personality files unrelated to social signal contract
- candidate ranking beyond controlled social field addition
- production deployment config / Vercel project binding
- any prod alias / rollback / promote command

---

## § 10 Migration / Compatibility

- Lane S 新数据维度 → backward compat（neutral fallback 时 social=null / 不破现有 topic 渲染）
- Lane R 状态机 → 渐进 rollout（先加 UI 层 / 后接 backend 状态映射）
- Lane T Direction E → 与现有 T-1/T-2 并存（不互斥）
- Gate 1-4 用 env flag 控制 mode（disabled / test / live）+ feature flag 灰度

---

## § 11 Tasks 索引

按 v2.5 T###[P?][Story?] 格式。本 v0.1 阶段是骨架，Codex Round 1+ 填具体 task。

### Stage 0 — Contract audit / stop gate

- **T000a [P0][scaffold][6Ledger]** scaffold readiness audit
  - files：无 code change / 写报告进 spec / sync only
  - acceptance：capability / gap table completed / base sha recorded
  - grep：`rg -n "coinw_real_submission_not_enabled|CoinWFuturesOrderMode|INTENT_TTL_MS|COINW_FUTURES_STATIC_FALLBACK" src`

- **T000b [P0][6Ledger]** env / secret ownership confirmation gate
  - files：no code until owner resolved
  - acceptance：all env names from `docs/coinw-integration-requirements.md:337-350` mapped to preview / prod / CoinW-dedicated owner

- **T000c [P0][direction]** Dan / CoinW decision slots
  - acceptance：social provider / social cap / Direction MVP / Direction E protocol point 1 / legal copy owner marked decided 或 deferred

### Stage 1 — Lane S social controlled reintroduction

- **T101a [P0][LaneS]** add social signal types / normalizer
  - files：`src/lib/social/socialSignalTypes.ts`, `src/lib/social/socialSignalNormalizer.ts`
  - acceptance：normalized contract supports mention / sentiment / engagement and missing / stale / error status

- **T101b [P0][LaneS]** provider adapter skeleton for Dan-selected provider only
  - files：`src/lib/social/adapters/<provider>SocialAdapter.ts`
  - acceptance：no unselected provider code path active

- **T101c [P0][LaneS]** cache + cacheVersion
  - files：`src/lib/social/socialSignalCache.ts`
  - acceptance：PM selector receives immutable social snapshot / version per run

- **T102a [P0][LaneS]** add `social` to TopicReasonKind / breakdown / order
  - files：`src/lib/team/topicSelector.ts`
  - grep：`rg -n '"social"|scoreBreakdown|PUBLIC_REASON_ORDER' src/lib/team/topicSelector.ts`

- **T102b [P0][LaneS]** tests
  - files：`src/lib/team/__tests__/topicSelector.test.ts`, provider tests
  - acceptance：neutral fallback public reason absent / provider-backed social changes ranking only when provider data ok

### Stage 2 — Lane R readiness / fallback taxonomy

- **T201a [P0][LaneR]** typed readiness model
  - files：`src/lib/coinw/tradeReadinessState.ts`
  - acceptance：6 failure kinds + severity / blocking / retryable / source fields

- **T201b [P0][LaneR]** map existing route / readiness / instrument errors
  - files：`src/app/api/watch/follow-intents/route.ts`, `src/app/api/watch/follow-intents/status/route.ts`, `src/lib/coinw/oauthReadiness.ts`
  - acceptance：no secret values in response

- **T202a [P0][LaneR]** UI slot wiring without final copy / placement
  - files：`src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`, `src/modules/agent-watch/v9/TopicStrategy.tsx`, `src/i18n/types.ts`, `src/i18n/dicts/*.json`
  - acceptance：keys exist in 10 locale / final strings 仅 placeholders 直到 Dan + 法务

- **T202b [P0][LaneR]** contract / unit / e2e tests
  - files：follow-intents tests, MarketAnalysisPanel tests
  - acceptance：unsupported instrument / auth missing / disabled / live blocked / rate limit all map to correct state

### Stage 3 — Lane T trade path

- **T301a [P0][LaneT-1][LaneT-2]** audit external / deep link behavior
  - files：`src/lib/coinw/futuresLinks.ts`, `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`
  - acceptance：generic external link vs pair deep link separated in code / tests

- **T301b [P0][LaneT-2]** executable-only pair deep link
  - acceptance：non-symbol / watch-only cannot receive pair-specific deep link

- **T303a [P0][LaneT-3E]** signed intent payload builder
  - files：`src/lib/coinw/orderIntentSignature.ts`, `src/lib/coinw/futuresOrderIntent.ts`
  - acceptance：HMAC / kid / nonce / exp / payloadHash unit-tested

- **T303b [P0][LaneT-3E]** replay lock / audit store
  - files：`src/lib/coinw/orderIntentAuditStore.ts`, `src/lib/storage/*`
  - acceptance：same nonce cannot be accepted twice

- **T303c [P0][LaneT-3E]** callback / status route draft
  - files：`src/app/api/watch/follow-intents/callback/route.ts`, `src/app/api/watch/follow-intents/status/route.ts`
  - acceptance：confirmed / rejected / expired / cancelled statuses covered

- **T303d [P0][LaneT-3E]** CoinW validation contract checklist / test fixture（Codex Round 2 OBJECT 2 加）
  - files：spec / sync 文档 + 后续 contract test fixture
  - acceptance：CoinW 验证流程 5 项契约确认（kid / signature / payload pull-or-push / login-KYC-risk sequence / error taxonomy retry policy）/ sandbox test fixture 4 状态全覆盖
  - 备注：spec task only until CoinW contract details are known

- **T303e [P0][LaneT-3E]** audit persistence + intent / order mapping acceptance（Codex Round 2 OBJECT 2 加）
  - files：`src/lib/coinw/orderIntentAuditStore.ts` audit row schema + 与 `decision-log` 关系测试
  - acceptance：1 audit row per intent / 含 § 7.5 Protocol point 5 所有字段 / `recordId` 链接 decision record / 不复制完整 strategy text / 监管审计字段全
  - 备注：spec task only until CoinW contract details are known

- **T304a [P1][LaneT-3B]** API direct submit design only
  - acceptance：no live direct submit implementation before Dan / CoinW contract

### Stage 4 — Gate activation and verification

- **T401 [P0][Gate1-4]** feature / env gate
  - files：`src/lib/coinw/tradeGate.ts`, `src/lib/coinw/oauthReadiness.ts`
  - acceptance：mode / gate cannot bypass disabled / live block

- **T402 [P0][Gate1-4]** metrics events
  - files：existing metrics / telemetry layer
  - acceptance：event names emitted in test harness / no secret / user PII

- **T403 [P0][Gate1-4]** rollback drill docs / tests
  - acceptance：Gate 1 disabled rollback and Gate 2 test rollback mechanically verified

### Global verify per PR

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm run test:watch-pipeline`
- `npm run verify:execution-safety`
- `npm run verify:a11y`
- `npm run verify:metrics`
- leak guard：public payload contains no `TeamMemberId` / `memberId` / backend status wording

P0 = ~17 sub-task / P1 = 2 / 总 ~19 task

---

## § 12 Workload Estimate

按 AI 驱动范式 v1.0 双时钟纪律——不承诺分钟数。

- 时钟 A（AI 连续推进）：Stage 0 STOP gate → Stage 1/2 并行 → Stage 3 → Stage 4 顺序
- 时钟 B（真实世界）：依赖 Dan 拍板节奏 + Codex 派工窗口 + CoinW 对接方反馈节奏 + 法务文案节奏

---

## § 13 Cannot-Do（红线，不可碰）

1. **不动 14 TeamMemberId / teamRegistry.ts**（Constitution Rule 4）
2. **不动 hotfix 1-7 红线**：leakCount=0 / canonical ordering / waitUntil / per-symbol watch-only gate
3. **不动 Constitution Rule 2 v0.1.1**：每 Gate prod 激活必 Dan 显式授权
4. **不擅自破 `oauthReadiness.ts:43-52` live submission separate release 拦截**（Gate 3 拍前）
5. **不擅自填具体 UI / 文案 / 视觉**（按新 § A.3 扩展）
6. **不评估法务 / 合规**（Dan + 法务）
7. **不擅自起其他 spec**（C 线 UI / B.15 / C-Series 独立 spec）
8. **不擅自把 Lane S social 数据当真实"驱动因素"展示**（待 provider 接入 + Dan 拍权重后才能）
9. **不擅自把 Direction E 协议点跳过任何一个**（5 点全到位才进 Gate 2）
10. **不擅自把 6 Ledger PENDING gate 跳过**（Env / Secret ownership 未拍 / Lane T E/B 不可派工）
11. **不擅自打开 Gate 4** 前未完成 Gate 1 → 2 → 3 序列
12. **不擅自把 mock-db hybrid fallback 当 live mode 数据**（live mode 切换后 mock 残留需明示策略）

---

## § 14 Constitution Check（claw42 v0.1.1 7 Rule 逐条）

| Rule                      | Check Question                                                                    | 答                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule 1 部署身份           | 本 spec 触发 push / PR / vercel deploy？                                          | **N/A**（v0.1 DRAFT 不派工）→ 派工时 Codex 必须 gh + vercel whoami                                                                                                       |
| Rule 2 v0.1.1 生产保护    | 触发 prod 改动？                                                                  | **PASS**（不上 prod；每 Gate 激活 Dan 显式授权；staging only DRAFT 阶段）                                                                                                |
| Rule 3 视觉与品牌权威     | `Claw 42` / `claw42` 不得混 / 既有 v9/task 视觉权威                               | **PASS**（不动品牌名 / 不动 v9 task；视觉部分留 Dan 拍）                                                                                                                 |
| Rule 4 数据与 schema 纪律 | NewsItem schema / SourceRegistry / 14 TeamMemberId / Win-rate / Agent IP 等不可动 | **PASS** 14 TeamMemberId 不动 / **PARTIAL** topicSelector type 加 social（Lane S）—— Codex Round 1 OBJECT 9 同意 PARTIAL 前提是配 Constitution amend + 白名单，详 § 14.1 |
| Rule 5 AI / 行情诚实性    | safety 降级优先于"完整输出"                                                       | **PASS** Lane R 6 类 fallback + UI 透明 = Rule 5 增强项                                                                                                                  |
| Rule 6 协作闭环           | sync READ + writeback + 副审 / 轻审                                               | **PASS** Brief Round 1-3 + spec Round 1-2 multi-round 已走                                                                                                               |
| Rule 7 验证门槛           | § 12 验收 + § 5 SC + screenshot / preview + PostHog event                         | **PARTIAL**（SC 已起 / Codex Round 1 填具体测试已落 § 11 / PostHog event 已落 § 7.4 10 events / 派工时实测验证）                                                         |

### § 14.1 Rule 4 PARTIAL handling（Codex Round 1 OBJECT 9 整合）

**Codex judgment**：**PARTIAL is correct**，不是 VIOLATION，仅当 spec v0.2 加 controlled-extension clause。

**Required operation**：

1. **Amend `docs/project-constitution.md` v0.1.x Rule 4 加 narrow whitelist**：
   - `TopicReasonKind` 仅可通过 approved spec 扩展为 verified external data dimension
   - extension 必须含：provider contract / neutral fallback / public reason gating / score cap / tests / rollback
   - extension 不得 add / rename TeamMemberId 或 public agent identity

2. **Add regression tests**：
   - no provider / missing data → `social === 0` AND public payload no social reason
   - provider error / stale → no public social reason
   - selected provider ok → social reason can appear with cacheVersion + sourceRefs

3. **Keep status PARTIAL** 直到 constitution amend lands；amend + tests pass 后 Rule 4 becomes PASS for Lane S

---

## § 15 Risk Register

| 风险                                                     | 概率 | 影响 | 缓解                                                          |
| -------------------------------------------------------- | ---- | ---- | ------------------------------------------------------------- |
| Lane S provider 单点故障（API 挂 / 涨价 / 政策变）       | MED  | MED  | neutral fallback + 多 provider 备选                           |
| Direction E hosted confirmation 4 状态回流 case 漏       | MED  | HIGH | T303d sandbox case 全覆盖 + rollback to Gate 1                |
| Env / Secret 泄露（COINW_OAUTH_CLIENT_SECRET / API key） | LOW  | HIGH | 不进 repo / sync / 独立 secret store + rotation               |
| Gate 3 controlled live submission 用户错单               | MED  | HIGH | 限额 + 白名单 + 风控 + 用户确认 + audit log                   |
| hotfix 链 regression                                     | LOW  | HIGH | spec § 13 cannot-do 红线 + Codex Round 1+ verify              |
| social 权重过大挤掉 news / market                        | MED  | MED  | T105 Dan 拍 social 权重 cap                                   |
| CoinW 平台对接方案变动（API breaking change）            | MED  | HIGH | T303a 调研含 stability assessment + Gate 4 前 sandbox 长 soak |
| 大版本 release 复合风险                                  | HIGH | HIGH | Gate 1-4 分段激活 / 每 Gate 独立回滚                          |

---

## § 16 老板简报

claw42 真下单大版本工程文档（v1.0 final）。基于已 Dan 拍板的 Brief 全面规划，把"接入 CoinW 真实下单"拆成三条并行工作线——社交媒体数据接入、错误兜底机制、下单按钮三档能力。三条线汇成一个大版本代码包，但生产环境不一次激活，分四个阶段开关——先开纯跳转、再开沙盒确认、再开受限真实下单、最后扩大。每个阶段必须你亲自拍板才推。法务文案、用户感知文字、第三方对接方案、密钥归属由你协调。Codex 工程师已经填完具体实施细节（两轮副审 9→3 OBJECT 收敛）。下一步：等你拍真派工时机。

---

## § 17 Anti-Rationalization

| 逃逸路径                                                   | 为什么不行                                                                         | 正确做法                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| "Lane S provider 选型 F 自己工程视角排序"                  | F 不 first-hand / Codex 工程评估角色                                               | T101 Codex first-hand 调研 + vendor-doc live check                   |
| "Direction E 协议点 5 个跳过 1-2 个先 sandbox 测"          | 5 点都到位才能 Gate 2 验收                                                         | T303a-e 5 task 全完成才推 Gate 2                                     |
| "Env / Secret ownership 派工时再补"                        | 6 Ledger PENDING gate 是硬前置                                                     | T000b STOP gate 必 Dan 拍 + 实装才推 Lane T (E/B)                    |
| "Gate 4 直接上 / 跳过 Gate 1-3"                            | gated 是 Constitution + oauthReadiness 代码自带能力                                | Gate 1→2→3→4 序列必 Dan 显式授权                                     |
| "Lane S social 权重 F 拍 X%"                               | 用户感知 + 评分体系是产品决策 / Dan 拍                                             | T105 Dan 拍 cap + spec 内不预填                                      |
| "v1.0 final spec 直接派 Codex 实施 / 跳 Stage 0 STOP gate" | Stage 0 T000a/b/c 必先通过（worktree base sha verify + Env owner + Direction MVP） | Stage 0 STOP gate 必 Dan 拍 + Codex 验完才推 Stage 1+                |
| "spec § 9 Files Touched 已列就是 lock"                     | Codex Round 1 已给 owner Lane 但具体改动行需实施时验                               | F 不擅自 lock files / Codex 派工时按 § 9 owner Lane 边界             |
| "spec 内 UI placement 写 'badge 在 topic-strategy 右上'"   | 用户感知部分按 § A.3 Dan 拍                                                        | spec 内只列槽位类型 / 不预填具体位置                                 |
| "F 整合 Codex Round 时把 first-hand source 当 F grep 实测" | 角色明确 / F 永远 second-hand                                                      | spec 内所有 Evidence 标 "Codex first-hand verify @ Round N OBJECT M" |

---

## § 18 Open Questions（待 Dan 拍 / 实施时 Codex 调研 + 对接方反馈）

1. **Lane S provider 选型**（Dan 拍）：CryptoCompare standby 激活 / CryptoPanic standby 激活 / X v2 接入 / Lunarcrush / Santiment / 其他
2. **Lane S social 权重 cap**（Dan 拍）：X% (避免挤掉 news / market)
3. **Direction MVP 选型**（Dan 拍）：A 单走 / A + E 并行推进 / 其他
4. **Direction E 协议点 1 入口形式**（Codex 调研 + Dan + CoinW 对接方）：URL deep link / POST handoff / SDK bridge / 其他
5. **Env / Secret ownership 路径**（Dan）：preview / prod Vercel env + CoinW dedicated prod env + owner + rotation
6. **法务文案 owner + 流程**（Dan）：disclaimer / 风险揭示 / ToS / KYC 流程文案
7. **UI 透明层 placement**（Dan 拍）：6 类 fallback 状态 badge / banner / empty state / disclaimer 具体位置
8. **Gate 1-4 序列激活时机**（Dan）：每 Gate 触发条件 + 灰度策略
9. **是否需 Constitution v0.1.x amend**（Dan）：真下单 release 流程 / Gate 序列 / Env / Secret ownership 是否进 Rule 8 新加
10. **是否需 Session A 跨域协调**（Dan）：CoinW 法务 / 风控 / 平台对接是否需 Session A 中转
11. **PostHog event mapping**（Codex + Dan）：Gate 1-4 各阶段 user behavior tracking event 定义

---

## § 19 Decision-Log Reference

本 spec 关联 `web-dev/decision-log.md` 多处：

- 2026-05-21 (晚) "Brief v1.0 final Dan APPROVED → 起 spec v0.1"
- 2026-05-21 (晚) "Dan 角色明确：Codex 负责 first-hand + 实施 / F 负责讨论任务路径"
- 2026-05-21 (晚) "F-Codex handoff 机制 Dan 拍方向 A"
- 2026-05-21 (晚) "coinw 真下单准备：5 真问题 Dan 拍板方向"
- 2026-05-21 (晚) "§ A.3 UI 授权规则扩展：文案也必须 Dan 确认"
- 2026-05-21 (晚) "F 评审 3 处理解偏差 + coinw 真实下单背景补充"
- 2026-05-21 (晚) "Codex C4 验证完成 + 双脑碰撞收敛：PR #188 未完全收口"

后续 spec v0.2 / v1.0 升级 + 派工实施 + Gate 1-4 激活时机 等动作必须回看 decision-log + 同步追加。

---

## 附录 A · Brief v1.0 final 关联段索引

| Brief 段                                                          | spec 关联段                         |
| ----------------------------------------------------------------- | ----------------------------------- |
| § 0 大版本叙事                                                    | § 1.2 / § 1.3 / § 1.4               |
| § 1 当前状态（基线拆分）                                          | § 2.1 T000a                         |
| § 1.5 现有 CoinW scaffold                                         | § 2.1 T000a + § 7.3 T-3             |
| § 2 三 Lane 结构                                                  | § 2.2-§ 2.4 + § 11 Stage 1-3 task   |
| § 2.5 Gate 1-4                                                    | § 2.5 + § 7.4 + § 11 Stage 4 task   |
| § 3 不做清单                                                      | § 13 cannot-do                      |
| § 4 6 Ledger（含 § 4.1 CoinW env + § 4.2 Lane S provider matrix） | § 2.1 T000b + § 18 Q5               |
| § 5 五维碰撞（含 5 hidden gap）                                   | § 3 Edge Cases + § 15 Risk Register |
| § 7.2 Direction 5 方向排序                                        | § 2.1 T000c + § 7.3 + § 18 Q3       |
| § 7.5 Direction E 5 协议点                                        | § 7.3 T-3 + § 7.5 + § 11 T303a-e    |
| § 9 待 Dan 拍板槽位                                               | § 18 Open Questions                 |

---

## § 20 spec 收敛路径 / 后续 step

```
[NOW] spec v0.1 落档 (F 主笔骨架)
   ↓
[NEXT] Codex Round 1 副审填工程细节 (Stage 0 T000a scaffold audit / § 7 Detailed Design / § 11 Tasks 细化 / § 8 const)
   ↓
[STEP 2] F 整合 Round 1 → spec v0.2
   ↓
[STEP 3] Codex Round 2 verify v0.2 + 新 OBJECT (如有)
   ↓
[STEP 4] 收敛 → spec v1.0 final + Dan APPROVED 派工
   ↓
[STEP 5] Stage 0 STOP gate 通过 (Dan 拍 T000b + T000c)
   ↓
[STEP 6] Lane S + Lane R 并行实施 (Codex 派工)
   ↓
[STEP 7] Lane T 实施 (按 Dan 拍 Direction 选型)
   ↓
[STEP 8] Gate 1 → 2 → 3 → 4 分段激活 (每 Gate 必 Dan 显式授权)
```

每 step 事件触发 / 不写时间评估。

---

_创建时间: 2026-05-21 (晚)_
_版本: spec v1.0 final / Codex Round 1 + Round 2 全整合 + F v0.3 small fix / AWAITING-DAN-APPROVAL_
_F 主笔 + Codex Round 1-2 副审（教科书收敛 9 → 3 → 0）_

---

## § 22 Round 1 → v0.2 整合摘要

| OBJECT                                               | 状态        | 整合位置                                                                                         |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| R1-1 T000a scaffold readiness audit 硬表             | ✅ RESOLVED | § 2.1（Capability 表 / readiness mode 定义 / grep verify）                                       |
| R1-2 Lane S social 重新引入 contract                 | ✅ RESOLVED | § 7.1（Provider comparison 5 候选 / Normalized social contract types / Cache version 约束）      |
| R1-3 Lane R typed state contract + transition matrix | ✅ RESOLVED | § 7.2（6 failure kinds / Severity / Transition matrix / UI slot types / i18n namespace / Tests） |
| R1-4 Direction E 协议级设计                          | ✅ RESOLVED | § 7.5（5 协议点 entry form / signature / CoinW validation / return path / audit persistence）    |
| R1-5 Gate 1-4 entry / 验收 / rollback / 监控         | ✅ RESOLVED | § 7.4（4 Gate table + 10 monitoring events + mechanical thresholds）                             |
| R1-6 Tasks sub-task 拆分                             | ✅ RESOLVED | § 11（Stage 0-4 共 ~19 sub-task / files + acceptance + grep gate）                               |
| R1-7 Constants 命名                                  | ✅ RESOLVED | § 8（Lane S / R / T const + existing env names）                                                 |
| R1-8 Files Touched owner Lane                        | ✅ RESOLVED | § 9（New / Modified / Do not touch 三档 + owner Lane）                                           |
| R1-9 Rule 4 PARTIAL + Constitution amend             | ✅ RESOLVED | § 14.1（Constitution amend whitelist + regression tests + 升 PASS 条件）                         |

### 收敛信号

- Round 1 = 9 OBJECT 全 ACCEPT 0 DISPUTE
- Round 2 预期 = ≤3 OBJECT（整合质量 verify + 可能少量路径深入）
- Round 3 / Dan APPROVED → 派工实施

---

## § 23 Codex Round 2 OBJECT 容器（audit trail / 3 OBJECT 全 RESOLVED-IN-v1.0）

Round 2 status: **AWAITING-F-INTEGRATION-ROUND-3 → RESOLVED-IN-v1.0**（3 OBJECT 全部整合完成 / 详 § 25 Round 2 RESOLVED summary）

收敛信号 = 3 OBJECT（9 → 3 单调下降）/ Q1-Q6 verify 大方向 PASS / 3 OBJECT 全是整合质量问题（非工程取舍）/ Codex 建议 v0.3 small fix 后推 v1.0 final / 不需 Round 4

> **审计纪律**：本段保留 Codex Round 2 原 OBJECT 全文 + 各条原 `status: AWAITING-F-INTEGRATION` 字段未改，作 audit trail。实际整合状态见 § 25 RESOLVED 摘要 + spec 主体（已落 3 fix）。

### Round 2 verify summary

**Q1 — 9 OBJECT integration quality**：R1-1 → R1-9 的主体内容均已落入 v0.2 对应章节：§ 2.1 capability/readiness audit、§ 7.1 Lane S contract、§ 7.2 Lane R typed fallback、§ 7.4 Gate 1-4、§ 7.5 Direction E、§ 8 constants、§ 9 files、§ 11 task split、§ 14.1 Rule 4 PARTIAL handling 均可 first-hand 对到 spec 主体。Round 2 仅发现 3 个收口级问题，见下方 OBJECT。

**Q2 — cross-reference consistency**：主体 cross-reference 大体成立，但 `T303a-e` 被多处引用，而 § 11 当前只有 `T303a-c`；§ 14 表格被 § 14.1 插入打断；§ 21 audit trail 位于 § 24 后且保留 `AWAITING-F-INTEGRATION` 原状态，和“全 RESOLVED-IN-v0.2”标题存在读者歧义。

**Q3 — hidden gap check**：未发现三 Lane 互不依赖纪律、hotfix 红线、Constitution Rule 1-7 的新实质性破坏；但 § 14 表格断裂会削弱 Constitution gate 的机械可读性，Direction E task mapping 不完整会影响后续执行拆分。

**Q4 — missed OBJECT details**：未发现 R1 suggested-content 的业务内容丢失；遗漏集中在文档整合形态和任务编号一致性，而不是新增 scope。

**Q5 — convergence signal**：v0.2 不建议直接推 v1.0 final；建议 F 做 v0.3 small fix，一次修下面 3 OBJECT 后可进入 Dan APPROVED / implementation intake，不需要 Round 4 深审。

**Q6 — implementation base sha verify**：T000a 的第一步是清晰可执行的：当前 spec 已明确本地 worktree 落后 25 commits，实施必须先 `git fetch origin && git rev-parse origin/main`，以 origin/main 最新 SHA 作为真实 base；这能避免把旧本地 `8380caa` 当实施基线。

### Codex Round 2 OBJECT 1 - §14 Constitution table is interrupted by §14.1

priority: HIGH
type: 整合偏差
target-section: § 14 / § 14.1
content: § 14 的 Rule 1-4 table 在 Rule 4 后被 `### § 14.1` 插入打断，随后 Rule 5-7 仍以 table row 形式继续出现。Markdown 结构上 Rule 5-7 不再属于同一张表，影响 Protocol v2.5 §14 Constitution gate 的机械可读性和审核完整性。First-hand source：`spec-coinw-real-trading-readiness-v1.md` lines around § 14 show Rule 5/6/7 rows after § 14.1 body.
suggested-fix: Move § 14.1 after the complete Rule 1-7 table, or keep Rule 4 row as `**PARTIAL** ... see § 14.1` and place the full § 14.1 block below Rule 7. The final § 14 table should remain one contiguous Rule 1-7 table.
status: AWAITING-F-INTEGRATION

### Codex Round 2 OBJECT 2 - Direction E task references say T303a-e but §11 only defines T303a-c

priority: HIGH
type: 整合偏差
target-section: § 7.5 / § 11 / § 17 / Appendix A
content: v0.2 correctly keeps Direction E as 5 protocol points in § 7.5, but task references are inconsistent: § 17 says `T303a-e 5 task 全完成才推 Gate 2`, Appendix A maps `§ 7.5 Direction E 5 协议点` to `§ 11 T303a-e`, while § 11 currently defines only `T303a`, `T303b`, `T303c` plus `T304a`. This creates an implementation handoff gap: Gate 2 can appear satisfied without an explicit task for CoinW-side validation contract and/or audit mapping coverage.
suggested-fix: Either add explicit `T303d` / `T303e` entries under Stage 3 to map all 5 Direction E protocol points, or change every `T303a-e` reference to the actual `T303a-c + § 7.5 protocol checklist` model. Preferred small fix: add `T303d [P0][LaneT-3E] CoinW validation contract checklist / test fixture` and `T303e [P0][LaneT-3E] audit persistence + intent/order mapping acceptance`, both as spec tasks only until CoinW contract details are known.
status: AWAITING-F-INTEGRATION

### Codex Round 2 OBJECT 3 - Round 1 audit/status ordering has stale state text

priority: MED
type: 整合偏差
target-section: § 16 / § 17 / § 18 / § 20 / § 21 / § 24
content: The v0.2 body still contains several stale v0.1/Round 1 phrases after integration: § 16 calls the doc `v0.1 起草版` and says the next step is for Codex to fill implementation details; § 17 says status is `AWAITING-CODEX-ROUND-1`; § 18 says `待 Codex Round 1+`; § 21 appears after § 24 and each original OBJECT still says `status: AWAITING-F-INTEGRATION` even though the § 21 heading and § 22 summary say all 9 were resolved. This is not a scope problem, but it can confuse final approval state.
suggested-fix: For v0.3, update stale status language to v0.2/Round 2 finalization, or explicitly label § 21 as raw Round 1 audit trail whose original status fields are preserved verbatim. Prefer ordering the doc as § 21 audit trail → § 22 integration summary → § 23 Round 2 → § 24 convergence update, or retitling § 21 as an appendix after § 24 if F wants audit trail at the end.
status: AWAITING-F-INTEGRATION

---

## § 24 spec 收敛路径更新

```
[DONE] spec v0.1 落档 (F 主笔骨架)
[DONE] Codex Round 1 副审 9 OBJECT (handoff 方向 A / 直接写 web-dev mount)
[DONE] F 整合 Round 1 → spec v0.2 (9 段 suggested-content 直接落主体)
[DONE] Codex Round 2 verify v0.2 → 3 OBJECT (9 → 3 单调下降收敛 / 全整合质量问题非工程取舍)
[DONE] F v0.3 small fix → v1.0 final (本次 / § 14 表格连续 + T303d/e 加 + stale 文字清)
   ↓
[NEXT] Dan APPROVED v1.0 final → 派工实施
   ↓
[STEP 5] Stage 0 STOP gate（T000a worktree base sha verify + T000b Env owner + T000c Dan 拍板）
   ↓
[STEP 6] Lane S + Lane R 并行实施 / Lane T-1/T-2/A 早走
   ↓
[STEP 7] Lane T-3E (Direction E) 实施 / 协议点 1 待 CoinW 合同
   ↓
[STEP 8] Gate 1 → 2 → 3 → 4 分段激活（每 Gate Dan 显式授权 + 独立验收 + 独立回滚）
```

每 step 事件触发 / 不写时间评估。

---

## § 25 Round 2 → v1.0 整合摘要

| OBJECT                                           | 状态        | F 整合动作                                                                                                                                                       |
| ------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-1 § 14 Constitution table 被 § 14.1 打断      | ✅ RESOLVED | § 14 表格连续 Rule 1-7 / § 14.1 移到 Rule 7 后                                                                                                                   |
| R2-2 Direction E 引用 T303a-e 但 § 11 只 T303a-c | ✅ RESOLVED | § 11 加 T303d（CoinW validation contract checklist / test fixture）+ T303e（audit persistence + intent/order mapping acceptance）                                |
| R2-3 stale v0.1 / Round 1 / AWAITING 文字        | ✅ RESOLVED | § 16 老板简报改 v1.0 final / § 17 改 Stage 0 STOP gate / § 18 改"待 Dan 拍 + Codex 调研" / § 21 + § 23 加 audit trail discipline 段说明 status 字段保留 verbatim |

**收敛曲线**：Round 1 = 9 / Round 2 = 3 / 整合 fix = 3 直接处理 → v1.0 final（不需 Round 4）

### 收敛信号

- spec Round 1 = 9 OBJECT 全 ACCEPT 0 DISPUTE
- spec Round 2 = 3 OBJECT 全 ACCEPT 0 DISPUTE（整合质量收口）
- F v0.3 = 3 fix 全完成 → v1.0 final
- 待 Dan APPROVED → 派工实施

---

---

## § 21 Codex Round 1 OBJECT 容器（audit trail / 9 OBJECT 原状态字段保留 verbatim）

Round 1 status: **AWAITING-F-INTEGRATION-ROUND-2 → RESOLVED-IN-v0.2**（全部 9 OBJECT 整合完成，详 § 22 RESOLVED summary）

> **审计纪律**：本段保留 Codex Round 1 原 OBJECT 全文 + 各条原 `status: AWAITING-F-INTEGRATION` 字段未改，作 audit trail。实际整合状态见 § 22 RESOLVED 摘要 + spec 主体 § 0-§ 20 各对应段（已落 9 OBJECT suggested-content）。

Round 1 scope: Codex 已完整读 spec v0.1 19 段 + 附录 A、Brief v1.0 final 全文，并基于 `7da829f` release-candidate source 做 first-hand grep。注意：当前本地 `claw42` worktree 的 `main` 为 `8380caa` 且 behind `origin/main` 25 commits；本轮工程细节以 Brief 指定的 `7da829f` 为事实基线，v0.2 整合前必须在干净 worktree 重新确认 implementation base。

Convergence baseline: **Round 1 OBJECT count = 9**

### Codex Round 1 OBJECT 1 - T000a scaffold readiness audit 需要落成硬表

priority: HIGH
type: 工程细节填充
target-section: § 2.1 / § 7.3 / § 11
content: Brief § 1.5 的 scaffold 清单和 `7da829f` 当前代码基本一致，但 spec v0.1 还没有把"已有能力"和"缺口"落成可执行审计表。first-hand source: `/api/watch/follow-intents` 当前只 parse request → build intent → read readiness → 固定返回 `mode: "disabled"` + `reason: "coinw_real_submission_not_enabled"`，不提交订单；`oauthReadiness` 已有 `disabled | test | live` 三档，但 `live` 被 `live_order_submission_requires_separate_release` 拦截；`futuresOrderIntent` 可生成 `/v1/perpum/order` request body；`futuresInstruments` 有 10min cache + static fallback；`futuresLinks` 有 pair deep link + generic fallback。source: `7da829f:src/app/api/watch/follow-intents/route.ts:112-140`, `7da829f:src/lib/coinw/oauthReadiness.ts:1-55`, `7da829f:src/lib/coinw/futuresOrderIntent.ts:25-66/127-202`, `7da829f:src/lib/coinw/futuresInstruments.ts:17-31/114-163`, `7da829f:src/lib/coinw/futuresLinks.ts:14-25`, `docs/coinw-integration-requirements.md:337-350`。
suggested-content:

```markdown
#### T000a scaffold readiness audit（必须在 Stage 0 第一项执行）

source baseline: `7da829f` release candidate；实施前在干净 worktree 重新跑 `git fetch origin && git rev-parse origin/main` 并记录 base sha。

| Capability                       | 当前实现                                                                         | 缺口 / 不得误判                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `/api/watch/follow-intents`      | POST 已建，限流、body parse、CoinW futures intent draft、readiness response 已有 | 固定 disabled；无 token/session；无 submit；无 callback/status pipeline；不能称为 test/live |
| `CoinWFuturesOrderMode`          | `disabled                                                                        | test                                                                                        | live` 三档 type 已有 | `live` 当前仍 blocked；`test` 仅 readiness true，不等于已提交订单 |
| `coinWOAuthReadiness()`          | 校验 OAuth env + test account + order mode                                       | 只读 env，不做 OAuth handshake，不保存 token                                                |
| `buildCoinWFuturesOrderIntent()` | 生成 `intentId/expiresAt/coinwRequest`，含 `/v1/perpum/order` body               | 只生成 draft；无签名、nonce、replay protection、audit store                                 |
| futures instruments              | `/v1/perpum/instruments` fetch + 10min memory cache + static fallback            | static fallback 只能用于 preview/analysis，不得作为 live submission 事实                    |
| futures links                    | pair-specific template + generic futures fallback                                | generic fallback 不是可下单深链；watch-only/non-symbol 不能伪装为可下单                     |
| beta leverage cap                | `COINW_FUTURES_BETA_MAX_LEVERAGE` route cap 已有                                 | 仅 cap leverage；不等于完整风控                                                             |

readiness mode 定义：

- `disabled`: 可以生成 intent draft / 可以跳 CoinW 页面 / 不能 test 或 live submit。
- `test`: OAuth env + test account + mode=test 齐备；只能进入 CoinW test / sandbox / hosted confirmation 链路。
- `live`: 仅在 Dan 显式 prod 授权 + Gate 3/4 条件满足后允许；当前代码对 live 明确 blocking，不能绕过。

grep verify:

- `rg -n "mode: \"disabled\"|coinw_real_submission_not_enabled" src/app/api/watch/follow-intents/route.ts`
- `rg -n "CoinWFuturesOrderMode|live_order_submission_requires_separate_release|realSubmissionEnabled" src/lib/coinw/oauthReadiness.ts`
- `rg -n "endpoint: \"/v1/perpum/order\"|INTENT_TTL_MS|thirdOrderId" src/lib/coinw/futuresOrderIntent.ts`
- `rg -n "COINW_FUTURES_STATIC_FALLBACK|COINW_FUTURES_INSTRUMENTS_TTL_MS" src/lib/coinw/futuresInstruments.ts`
```

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 2 - Lane S social 数据源与 scoring 设计要从"可缺省中立"开始

priority: HIGH
type: 工程取舍 / 工程细节填充
target-section: § 7.1 / § 8 / § 9 / § 11
content: `7da829f` 当前 selector 已彻底无 social：`TopicReasonKind` 只有 8 项，`PUBLIC_REASON_LABELS/ORDER` 与 `scoreBreakdown` 均不含 social，测试还断言 `scoreBreakdown` 不含 social。Lane S 因此是受控重新引入，不是打开旧字段。provider live check 结论：CryptoCompare 当前项目 endpoint 可用但只是 news source；CryptoPanic repo 已有 standby scaffold 且 registry 标注 currencies/votes native，但自动访问 developer docs 被 403/unauth API 404，需带 key 验；X API v2 官方 data dictionary 有 `public_metrics`，可做 engagement/mention 派生但不自带 crypto sentiment；LunarCrush 官方 docs 可访问但字段需 key/live test 核实；Santiment 官方 Academy/SanAPI 文档明确有 Social trends/Social volume/Sentiment Ratio 方向，适合专业社交指标候选。source: `7da829f:src/lib/team/topicSelector.ts:8-16/106-126/401-412/605-648`, `7da829f:src/lib/team/__tests__/topicSelector.test.ts:130/524-525`, `7da829f:src/lib/news/sourceRegistry.ts:34-74/119-129`, official sources: `https://min-api.cryptocompare.com/data/v2/news/?lang=EN`, `https://cryptopanic.com/developers/api/`, `https://docs.x.com/x-api/fundamentals/data-dictionary`, `https://lunarcrush.com/developers/docs`, `https://academy.santiment.net/`。
suggested-content:

````markdown
### § 7.1 Lane S Detailed Design

#### Provider comparison（不预填价格 / 不预选 Dan 槽位）

| Provider      | 当前项目状态       | 可用信号                                                            | 工程判断                                         |
| ------------- | ------------------ | ------------------------------------------------------------------- | ------------------------------------------------ |
| CryptoCompare | active news source | news article count/source diversity/high impact；非 social-native   | 保留为 news baseline，不当 social provider       |
| CryptoPanic   | standby scaffold   | currencies + votes native（按 repo registry）；需 key 验证字段/限流 | 最小接入成本候选，但必须先 live key test         |
| X API v2      | 未接入             | public metrics 可派生 engagement；mention search 需计划/权限        | 能给真实社交热度，但成本/限流/查询语义风险最高   |
| LunarCrush    | 未接入             | crypto social metrics vendor；字段需 key/live test                  | 专业 social provider 候选，不在 spec 写死字段名  |
| Santiment     | 未接入             | social trends / social volume / sentiment ratio 方向                | 专业数据候选，适合后续高质量信号，不作为快速默认 |

#### Normalized social contract

```ts
export type SocialSignalProviderId = "cryptopanic" | "x_v2" | "lunarcrush" | "santiment";

export interface SocialSignalObservation {
  provider: SocialSignalProviderId;
  candidateKey: string;
  symbol?: string;
  observedAt: string;
  windowStart: string;
  windowEnd: string;
  mentionCount?: number;
  uniqueAuthorCount?: number;
  engagementScore?: number;
  sentimentScore?: number; // normalized -1..1
  confidence: number; // 0..1
  sourceRefs: string[];
  rawRef?: string;
}

export interface SocialSignalAggregate {
  candidateKey: string;
  symbol?: string;
  cacheVersion: string;
  observedAt: string;
  providerIds: SocialSignalProviderId[];
  mentionScore: number;
  engagementScore: number;
  sentimentScore: number;
  confidence: number;
  dataStatus: "ok" | "missing" | "stale" | "provider_error";
}
```

#### Topic selector changes

- `TopicReasonKind`: add `"social"` after `"news"` and before `"executable"`（social 是 attention/evidence，不是 execution gate）。
- `TopicScoreBreakdown`: initialize `social: 0`.
- `PUBLIC_REASON_LABELS.social`: key placeholder only；具体 public 文案等 Dan + 法务。
- `PUBLIC_REASON_ORDER`: insert `"social"` after `"news"` so public driver summary can mention it only when positive and provider-backed.
- `selectionCacheKey`: include `socialAggregate.cacheVersion` / `observedAt`，防止 social 延迟到达后 ranking 无声漂移。
- `buildTopicSelectionEvidence`: only include social reason if `dataStatus === "ok"` and score > 0；missing/stale/provider_error 不得生成 public reason。

#### Scoring rebalance rule

不预填 social 权重百分比。先落 `socialScore = 0` neutral fallback + cap constant，占位等 Dan 拍。上线前必须跑 fixture 比较，确保 social 不能单独挤掉 market/news/executable 三类硬信号。

#### Tests

- 更新现有 `scoreBreakdown not.toHaveProperty("social")` 为 controlled extension tests。
- 新增 neutral fallback：无 social provider 时 `social === 0` 且 public reason 不含 social。
- 新增 provider-backed fixture：social positive score 可影响排序，但 cacheVersion 固定时排序稳定。
- 新增 stale/provider_error：不进入 public reasons，不改变 PM run cache silently。
````

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 3 - Lane R fallback/readiness 要定义来源层状态机，不能只做 UI 文案

priority: HIGH
type: 工程细节填充 / 风险点
target-section: § 7.2 / § 8 / § 9 / § 11
content: 当前 6 类失败状态已经散落在不同层：follow-intents route 有 rate limit / request too large / invalid request / unsupported symbol；oauthReadiness 有 OAuth missing、test account missing、submission disabled、live requires separate release；futuresInstruments fetch 失败会 console warn 并走 static fallback；public timeline projection 会过滤不可执行 symbol record；v10/v9 的交易入口对 watch-only/non-symbol 呈现方式不一致。Lane R 必须先冻结 typed state contract，再让 UI/文案承接；具体文案和位置仍留 Dan + 法务。source: `7da829f:src/app/api/watch/follow-intents/route.ts:101-145`, `7da829f:src/lib/coinw/oauthReadiness.ts:31-55`, `7da829f:src/lib/coinw/futuresInstruments.ts:143-155`, `7da829f:src/lib/watch/publicTimelineProjection.ts:236-324`, `7da829f:src/modules/agent-watch/v10/MarketAnalysisPanel.tsx:432-490`, `7da829f:src/modules/agent-watch/v9/TopicStrategy.tsx:44-104`。
suggested-content:

````markdown
### § 7.2 Lane R Detailed Design

#### 6 source-layer failure kinds

```ts
export type TradingReadinessFailureKind =
  | "analysis_data_degraded"
  | "instrument_unavailable"
  | "auth_account_not_ready"
  | "user_risk_confirmation_required"
  | "submission_mode_blocked"
  | "exchange_network_or_result_failed";

export type TradingReadinessSeverity = "info" | "degraded" | "blocked" | "error";

export interface TradingReadinessState {
  kind: TradingReadinessFailureKind;
  severity: TradingReadinessSeverity;
  blocking: boolean;
  retryable: boolean;
  source:
    | "analysis_pipeline"
    | "coinw_instrument"
    | "oauth_readiness"
    | "user_confirmation"
    | "order_submission"
    | "exchange_result";
  code: string;
  i18nKey: string;
  observedAt: string;
  technicalDetails?: Record<string, string | number | boolean | null>;
}
```

#### Transition matrix

| From     | To       | Allowed trigger                          | Notes                        |
| -------- | -------- | ---------------------------------------- | ---------------------------- |
| unknown  | checking | page load / status poll / submit attempt | no public copy until checked |
| checking | ok       | all required source checks pass          | ok can be cached briefly     |
| checking | degraded | analysis/source stale but non-blocking   | no fake confidence copy      |
| checking | blocked  | instrument/auth/user/mode blocks action  | CTA must not submit          |
| checking | error    | CoinW/network/result failed              | retryable depends code       |
| degraded | checking | refresh / retry                          | can recover                  |
| blocked  | checking | env/auth/user action changed             | no auto live promotion       |
| error    | checking | retry/backoff                            | audit previous error         |

#### UI transparent-layer slot types（不填具体文案 / 不拍位置）

- card-level status badge
- panel-level readiness banner
- empty-state reason slot
- CTA disabled reason slot
- detail/audit drawer reason slot

#### i18n key namespace（只定义槽位）

`agentWatch.tradeReadiness.states.<kind>.label`
`agentWatch.tradeReadiness.states.<kind>.detail`
`agentWatch.tradeReadiness.states.<kind>.action`
`agentWatch.tradeReadiness.modes.disabled|test|live`

10 locale keys must exist, but value strings stay Dan + legal owned.

#### Tests

- unit: taxonomy mapper from existing route/readiness/instrument errors.
- contract: `/api/watch/follow-intents/status` returns typed state without secret values.
- contract: `/api/watch/follow-intents` unsupported symbol/rate limit/disabled paths map to correct kind.
- UI: non-symbol/watch-only cannot render submit-capable CTA.
- e2e: 6 states can be rendered without layout break and without public content leak.
````

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 4 - Direction E 需要协议级设计，不能只写"handoff"

priority: HIGH
type: 工程细节填充 / 工程取舍
target-section: § 7.3 / § 7.5 / § 11
content: Direction E 是工程上最值得并行准备的中长期路径，但它需要清楚协议边界：Claw42 只生成 signed order intent，CoinW 负责登录/KYC/用户最终确认/真实提交。当前 scaffold 已有 intent draft 和 `expiresAt`，但没有签名、nonce、replay protection、CoinW callback/status、audit persistence。source: `7da829f:src/lib/coinw/futuresOrderIntent.ts:25-66/68-83/127-202`, `7da829f:src/app/api/watch/follow-intents/route.ts:112-140`, `7da829f:src/lib/coinw/oauthReadiness.ts:40-52`。
suggested-content:

```markdown
### § 7.5 Direction E Protocol Design

#### Protocol point 1: entry form

Engineering recommendation order:

1. URL deep link with signed compact token if CoinW supports tokenized hosted confirmation.
2. Server-to-server POST handoff returning a CoinW hosted confirmation URL if payload is too large or must not be URL-visible.
3. SDK bridge only if CoinW provides an official JS/SDK contract.

Spec must mark exact entry form as **待 CoinW 平台合同**. Claw42 cannot invent the receiving endpoint.

#### Protocol point 2: signature / nonce / TTL / replay protection

- Signature: HMAC-SHA256 over canonical JSON or canonical query string.
- Payload minimum: `intentId`, `recordId`, `coinwPair`, `direction`, `orderType`, `quantity`, `leverage`, `marginMode`, optional price/TP/SL, `iat`, `exp`, `nonce`, `kid`, `payloadHash`.
- Nonce: at least 128-bit random, base64url/hex encoded.
- TTL: align with existing order intent TTL `10 * 60_000` unless CoinW requires shorter.
- Replay defense: KV/Redis key `coinw:intent:nonce:<nonceHash>` with TTL > signature TTL; atomic set-if-not-exists before accepting callback/status.
- Key rotation: include `kid`; never store raw secret in repo/sync/logs.

#### Protocol point 3: CoinW validation flow

待 CoinW 平台合同：

- How CoinW verifies `kid/signature`.
- Whether CoinW pulls full payload from Claw42 or receives full payload in handoff.
- User login/KYC/risk confirmation sequence.
- Error code taxonomy and retry policy.

#### Protocol point 4: return path

Preferred hierarchy:

1. CoinW callback/webhook to Claw42 status endpoint for final state.
2. Status poll endpoint if webhook not available.
3. User return URL as UX convenience only; not source of truth.

Status enum must cover at least: `created`, `opened`, `confirmed`, `submitted`, `rejected`, `expired`, `cancelled`, `failed`.

#### Protocol point 5: audit persistence

Persist an audit row per intent:

- `intentId`, `recordId`, candidate metadata, symbol/pair, source decision id, user/session pseudonymous id, gate, mode, createdAt, expiresAt.
- `payloadHash`, `signatureKid`, `nonceHash`, handoffUrl hash/ref, CoinW callback status, CoinW order id if returned, reject/error code, callbackAt.
- link to existing decision record / decision-log by `recordId`, not by copying full strategy text.
```

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 5 - Gate 1-4 要写 entry condition、验收、回滚和监控指标

priority: HIGH
type: 工程细节填充
target-section: § 7.4 / § 11 / § 12
content: Brief 已定 gated activation，但 spec v0.1 还缺可机械验收的 Gate 条件。当前代码天然支持 Gate 1/2 前置：`COINW_FUTURES_ORDER_MODE=disabled` 返回 disabled；`test` 只让 readiness true；`live` 仍 blocked。建议不要新增一个能绕过 `oauthReadiness` 的隐形开关，而是在现有 mode 上叠加 trade gate/feature flag。source: `7da829f:src/lib/coinw/oauthReadiness.ts:27-55`, `7da829f:src/app/api/watch/follow-intents/status/route.ts:1-10`, `7da829f:src/app/api/watch/follow-intents/route.test.ts:21-105`。
suggested-content:

```markdown
### § 7.4 Gate 1-4 Activation Design

| Gate   | Entry condition                                                                         | Runtime config                                                                      | Acceptance                                                                                                           | Rollback                                                                |
| ------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Gate 1 | Lane R typed readiness contract + T-1/T-2 external/deep link ready; no order submission | `COINW_FUTURES_ORDER_MODE=disabled`; optional `COINW_TRADE_GATE=gate1`              | all executable symbol cards deep-link correctly; non-symbol/watch-only never submit; follow-intents returns disabled | set gate/mode back to disabled and verify no submit path                |
| Gate 2 | CoinW test account + hosted confirmation/test contract available                        | `COINW_FUTURES_ORDER_MODE=test`; `COINW_TRADE_GATE=gate2`; test account env present | 4 status paths pass: confirmed/submitted, rejected, expired, cancelled; audit rows written                           | return mode to disabled; verify status endpoint shows blocked           |
| Gate 3 | controlled live approval + allowlist/cap + monitoring                                   | `COINW_FUTURES_ORDER_MODE=live`; `COINW_TRADE_GATE=gate3`; allowlist/cap env/KV     | allowlisted test users only; max leverage cap active; live error rate under threshold; rollback drill pass           | flip to gate2 or gate1; inspect no new live submit after rollback       |
| Gate 4 | Gate 3 stable + Dan explicit production expansion                                       | `COINW_TRADE_GATE=gate4`; live mode remains explicit                                | scaled metrics green; audit export available; on-call/runbook ready                                                  | promote previous production deployment or disable live env and redeploy |

Monitoring event names:

- `coinw_trade_cta_click`
- `coinw_intent_created`
- `coinw_handoff_opened`
- `coinw_handoff_callback_confirmed`
- `coinw_handoff_callback_rejected`
- `coinw_handoff_callback_expired`
- `coinw_handoff_callback_cancelled`
- `coinw_order_submit_error`
- `coinw_gate_rollback`
- `trade_readiness_state_rendered`

Mechanical thresholds:

- Gate 1: submit-capable events must be 0.
- Gate 2: synthetic confirmed/rejected/expired/cancelled paths must be 100% covered.
- Gate 3: any signature replay accepted = hard fail; any non-allowlisted live submit = hard fail; missing audit row = hard fail.
- Gate 4: same hard fails as Gate 3 plus daily audit export check.
```

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 6 - § 11 Tasks 需要按 Lane + Gate 拆成可验收 sub-task

priority: HIGH
type: 工程细节填充
target-section: § 11
content: spec v0.1 的 §11 需要补到可执行粒度：每个 task 要带 tag、文件路径、acceptance、grep gate。以下拆法遵守三 Lane：Lane S 独立；Lane R 是 T-3 前置；Lane T-1/T-2 可早走；Lane T-3E/B 需要 Gate 控制。不能把 UI 文案/placement、social 权重、Direction 最终拍板写死。
suggested-content:

```markdown
## § 11 Tasks（Codex Round 1 proposed decomposition）

### Stage 0 - Contract audit / stop gate

- T000a [P0][scaffold][6Ledger] scaffold readiness audit
  - files: no code change; write report into spec/sync only
  - acceptance: capability/gap table completed; base sha recorded
  - grep: `rg -n "coinw_real_submission_not_enabled|CoinWFuturesOrderMode|INTENT_TTL_MS|COINW_FUTURES_STATIC_FALLBACK" src`
- T000b [P0][6Ledger] env/secret ownership confirmation gate
  - files: no code until owner resolved
  - acceptance: all env names from `docs/coinw-integration-requirements.md:337-350` mapped to preview/prod/CoinW-dedicated owner
- T000c [P0][direction] Dan/CoinW decision slots
  - acceptance: social provider, social cap, Direction MVP, Direction E protocol point 1, legal copy owner marked decided or deferred

### Stage 1 - Lane S social controlled reintroduction

- T101a [P0][LaneS] add social signal types/normalizer
  - files: `src/lib/social/socialSignalTypes.ts`, `src/lib/social/socialSignalNormalizer.ts`
  - acceptance: normalized contract supports mention/sentiment/engagement and missing/stale/error status
- T101b [P0][LaneS] provider adapter skeleton for Dan-selected provider only
  - files: `src/lib/social/adapters/<provider>SocialAdapter.ts`
  - acceptance: no unselected provider code path active
- T101c [P0][LaneS] cache + cacheVersion
  - files: `src/lib/social/socialSignalCache.ts`
  - acceptance: PM selector receives immutable social snapshot/version per run
- T102a [P0][LaneS] add `social` to TopicReasonKind / breakdown / order
  - files: `src/lib/team/topicSelector.ts`
  - grep: `rg -n '"social"|scoreBreakdown|PUBLIC_REASON_ORDER' src/lib/team/topicSelector.ts`
- T102b [P0][LaneS] tests
  - files: `src/lib/team/__tests__/topicSelector.test.ts`, provider tests
  - acceptance: neutral fallback public reason absent; provider-backed social changes ranking only when provider data ok

### Stage 2 - Lane R readiness/fallback taxonomy

- T201a [P0][LaneR] typed readiness model
  - files: `src/lib/coinw/tradeReadinessState.ts`
  - acceptance: 6 failure kinds + severity/blocking/retryable/source fields
- T201b [P0][LaneR] map existing route/readiness/instrument errors
  - files: `src/app/api/watch/follow-intents/route.ts`, `src/app/api/watch/follow-intents/status/route.ts`, `src/lib/coinw/oauthReadiness.ts`
  - acceptance: no secret values in response
- T202a [P0][LaneR] UI slot wiring without final copy/placement
  - files: `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`, `src/modules/agent-watch/v9/TopicStrategy.tsx`, `src/i18n/types.ts`, `src/i18n/dicts/*.json`
  - acceptance: keys exist in 10 locale; final strings may be placeholders only after Dan/legal
- T202b [P0][LaneR] contract/unit/e2e tests
  - files: follow-intents tests, MarketAnalysisPanel tests
  - acceptance: unsupported instrument/auth missing/disabled/live blocked/rate limit all map to correct state

### Stage 3 - Lane T trade path

- T301a [P0][LaneT-1][LaneT-2] audit external/deep link behavior
  - files: `src/lib/coinw/futuresLinks.ts`, `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`
  - acceptance: generic external link vs pair deep link separated in code/tests
- T301b [P0][LaneT-2] executable-only pair deep link
  - acceptance: non-symbol/watch-only cannot receive pair-specific deep link
- T303a [P0][LaneT-3E] signed intent payload builder
  - files: `src/lib/coinw/orderIntentSignature.ts`, `src/lib/coinw/futuresOrderIntent.ts`
  - acceptance: HMAC, kid, nonce, exp, payloadHash unit-tested
- T303b [P0][LaneT-3E] replay lock/audit store
  - files: `src/lib/coinw/orderIntentAuditStore.ts`, `src/lib/storage/*`
  - acceptance: same nonce cannot be accepted twice
- T303c [P0][LaneT-3E] callback/status route draft
  - files: `src/app/api/watch/follow-intents/callback/route.ts`, `src/app/api/watch/follow-intents/status/route.ts`
  - acceptance: confirmed/rejected/expired/cancelled statuses covered
- T304a [P1][LaneT-3B] API direct submit design only
  - acceptance: no live direct submit implementation before Dan/CoinW contract

### Stage 4 - Gate activation and verification

- T401 [P0][Gate1-4] feature/env gate
  - files: `src/lib/coinw/tradeGate.ts`, `src/lib/coinw/oauthReadiness.ts`
  - acceptance: mode/gate cannot bypass disabled/live block
- T402 [P0][Gate1-4] metrics events
  - files: existing metrics/telemetry layer
  - acceptance: event names emitted in test harness; no secret/user PII
- T403 [P0][Gate1-4] rollback drill docs/tests
  - acceptance: Gate 1 disabled rollback and Gate 2 test rollback mechanically verified

Global verify per PR:

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm run test:watch-pipeline`
- `npm run verify:execution-safety`
- `npm run verify:a11y`
- `npm run verify:metrics`
- leak guard: public payload contains no `TeamMemberId` / `memberId` / backend status wording.
```

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 7 - § 8 Variables / Constants 应先列命名，不急着填商业参数

priority: MED
type: 工程细节填充
target-section: § 8
content: spec v0.1 的 constants 段应先冻结命名和 owner，值分三类：工程安全默认可填、Dan/CoinW/法务待拍不可填、provider live test 后填。特别是 social 权重、UI 文案、真实 live gate 不能由 Codex 预填。
suggested-content:

```markdown
## § 8 Variables / Constants（Codex Round 1 proposed）

### Lane S

- `SOCIAL_SIGNAL_WINDOW_MS` — social aggregation window；值待 provider 选型。
- `SOCIAL_SIGNAL_CACHE_TTL_MS` — raw/aggregate cache TTL；必须短于或等于 PM run freshness window。
- `SOCIAL_SIGNAL_CACHE_VERSION_PREFIX`
- `SOCIAL_NEUTRAL_FALLBACK`
- `SOCIAL_PROVIDER_IDS`
- `SOCIAL_SCORE_CAP` — Dan 拍，不预填百分比。
- `SOCIAL_PROVIDER_TIMEOUT_MS`

### Lane R

- `TRADING_READINESS_STATE_VERSION`
- `TRADING_READINESS_FAILURE_KINDS`
- `TRADING_READINESS_SEVERITIES`
- `FALLBACK_TAXONOMY_TYPES`
- `READINESS_STATUS_CACHE_TTL_MS`

### Lane T

- existing `INTENT_TTL_MS = 10 * 60_000` should be exported or mirrored as `INTENT_SIGNATURE_TTL_MS`.
- `INTENT_NONCE_BYTES = 16` minimum.
- `INTENT_REPLAY_LOCK_TTL_MS`
- `COINW_TRADE_GATE`
- `COINW_ORDER_INTENT_AUDIT_VERSION`
- `COINW_HANDOFF_STATUS_VALUES`
- `COINW_HANDOFF_SIGNATURE_ALG = "HMAC-SHA256"`
- `COINW_HANDOFF_KID_ENV`

### Existing env names to preserve

- `COINW_FUTURES_API_BASE_URL`
- `NEXT_PUBLIC_COINW_FUTURES_URL`
- `NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE`
- `COINW_OAUTH_CLIENT_ID`
- `COINW_OAUTH_CLIENT_SECRET`
- `COINW_OAUTH_REDIRECT_URI`
- `COINW_OAUTH_AUTHORIZE_URL`
- `COINW_OAUTH_TOKEN_URL`
- `COINW_OAUTH_SCOPES`
- `COINW_FUTURES_TEST_ACCOUNT_ID`
- `COINW_FUTURES_ORDER_MODE`
- `COINW_FUTURES_BETA_MAX_LEVERAGE`
```

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 8 - § 9 Files Touched 要按 owner Lane 标出新建/修改/不动

priority: MED
type: 工程细节填充
target-section: § 9
content: 当前 spec 只写了高层方向，不足以防越界。建议在 §9 明确文件 owner，尤其要保护 hotfix 1-7 / B.13 / B.14 红线，不让 Lane S 社交数据和 Lane T 真下单互相污染。
suggested-content:

```markdown
## § 9 Files Touched（Codex Round 1 proposed）

### New files

| File                                                         | Owner    |
| ------------------------------------------------------------ | -------- |
| `src/lib/social/socialSignalTypes.ts`                        | LaneS    |
| `src/lib/social/socialSignalNormalizer.ts`                   | LaneS    |
| `src/lib/social/socialSignalCache.ts`                        | LaneS    |
| `src/lib/social/adapters/<selectedProvider>SocialAdapter.ts` | LaneS    |
| `src/lib/social/__tests__/*.test.ts`                         | LaneS    |
| `src/lib/coinw/tradeReadinessState.ts`                       | LaneR    |
| `src/lib/coinw/orderIntentSignature.ts`                      | LaneT-3E |
| `src/lib/coinw/orderIntentAuditStore.ts`                     | LaneT-3E |
| `src/app/api/watch/follow-intents/callback/route.ts`         | LaneT-3E |
| `src/lib/coinw/__tests__/orderIntentSignature.test.ts`       | LaneT-3E |

### Modified files

| File                                                             | Owner                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/team/topicSelector.ts`                                  | LaneS                                                              |
| `src/lib/team/__tests__/topicSelector.test.ts`                   | LaneS                                                              |
| `src/lib/team/__tests__/pmDecisionTrigger.topicSelector.test.ts` | LaneS                                                              |
| `src/lib/news/sourceRegistry.ts`                                 | LaneS only if selected provider belongs in registry                |
| `src/app/api/watch/follow-intents/route.ts`                      | LaneR + LaneT                                                      |
| `src/app/api/watch/follow-intents/status/route.ts`               | LaneR + LaneT                                                      |
| `src/lib/coinw/oauthReadiness.ts`                                | LaneR + Gate                                                       |
| `src/lib/coinw/futuresOrderIntent.ts`                            | LaneT                                                              |
| `src/lib/coinw/futuresInstruments.ts`                            | LaneR safety only                                                  |
| `src/lib/coinw/futuresLinks.ts`                                  | LaneT-1/T-2 only                                                   |
| `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`            | LaneR/T UI slot only                                               |
| `src/modules/agent-watch/v9/TopicStrategy.tsx`                   | LaneR/T compatibility only                                         |
| `src/i18n/types.ts` + `src/i18n/dicts/*.json`                    | LaneR slots only; final copy Dan/legal                             |
| `package.json`                                                   | only if selected provider requires SDK and Dan approves dependency |

### Do not touch without new explicit spec

- `src/lib/team/teamRegistry.ts`
- `docs/agent-ip/team/*.md`
- PM prompt/personality files unrelated to social signal contract
- candidate ranking beyond controlled social field addition
- production deployment config / Vercel project binding
- any prod alias / rollback / promote command
```

status: AWAITING-F-INTEGRATION

### Codex Round 1 OBJECT 9 - § 14 Rule 4 PARTIAL 可接受，但必须配 Constitution amend / 白名单

priority: MED
type: 工程取舍 / 风险点
target-section: § 14
content: 我同意 spec 当前把 Rule 4 标为 PARTIAL，而不是 VIOLATION，前提是 social 作为"受控 topic reason 扩展"处理：不改 14 TeamMemberId，不改 public role identity，不让 missing social 进入 public reason，不让 social 权重绕过 executable/market/news 的安全边界。若没有白名单和测试，social 重新引入会踩 hotfix-7 "fake social" 红线。source: `7da829f:src/lib/team/topicSelector.ts:8-16/401-412`, `7da829f:src/lib/data/__tests__/mock-db.test.ts:5-10`, `7da829f:src/lib/team/__tests__/topicSelector.test.ts:130/524-525`。
suggested-content:

```markdown
### § 14 Rule 4 PARTIAL handling

Codex judgment: **PARTIAL is correct**, not VIOLATION, only if spec v0.2 adds a controlled-extension clause.

Required operation:

1. Amend `docs/project-constitution.md` v0.1.x Rule 4 with a narrow whitelist:
   - `TopicReasonKind` may be extended for a verified external data dimension only through an approved spec.
   - The extension must include provider contract, neutral fallback, public reason gating, score cap, tests, and rollback.
   - The extension must not add/rename TeamMemberId or public agent identity.
2. Add regression tests:
   - no provider / missing data => `social === 0` and public payload has no social reason.
   - provider error/stale => no public social reason.
   - selected provider ok => social reason can appear, with cacheVersion and sourceRefs.
3. Keep status PARTIAL until constitution amend lands; after amend + tests pass, Rule 4 becomes PASS for Lane S.
```

status: AWAITING-F-INTEGRATION
