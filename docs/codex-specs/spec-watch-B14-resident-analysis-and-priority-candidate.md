# Spec: Watch B.14 — Resident Analysis + Priority Candidate

> **版本**：v1.0（2026-05-17 起草）
> **作者**：F (Claude session)
> **状态**：Draft, 待 Codex Round 1 评估
> **协议**：claude-codex-protocol v2.5 (19 段)
> **范围**：产品架构层——常驻分析 + 优先级 candidate selector + 决策流多 type 卡片
> **依赖**：B.13 + hotfix-1/2/3/4/5 全 merged（main HEAD `b0a051a`）

---

## § 1 Overview

### 1.1 背景

Dan 2026-05-16 深夜 chat 验收 B.13 hotfix 链后给两类反馈：

1. **内容质量**——已 hotfix-5 闭环（leakCount=0，PR #107）✅
2. **产品架构层新方向**——本 spec 落地

Dan 拍板的新逻辑：

- 用户进站应至少有 **每日大盘分析 + 热点分析** 两个常驻（更新时间可控 + 价值感够 + 稳定）
- 币种分析按优先级抓：**大币 → 热门 → 新闻驱动 → 小币**（不再 long-tail 混排）

Dan UI 授权（chat AskUserQuestion）：**常驻分析作为决策流中特殊卡（同区区分样式）**——不另起 panel。

### 1.2 范围（3 件事）

| 件                                   | 范围                                                                              | 优先级 |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------ |
| **A. 常驻分析新 candidate type**     | `market_overview`（大盘）+ `hotspot`（热点）两种常驻 candidate type，独立 cadence | P0     |
| **B. Candidate selector 优先级评分** | 大币 → 热门 → 新闻驱动 → 小币，废 long-tail 混排，多维度评分                      | P0     |
| **C. 决策流多 type 卡片视觉**        | 决策流卡片支持 3 type（symbol / market_overview / hotspot），同区不同样式         | P0     |

### 1.3 Out-of-Scope（推 B.15+）

- L4 多空辩论戏剧化（bullish/bearish multi-round cross-reference）
- L5 6 阶段仪式感
- 真 follow-trade 接 CoinW API
- Hero / landing page 改动

---

## § 2 In-Scope / Out-of-Scope

### 2.1 In-Scope

**A 常驻分析 candidate type**：

- 新增 schema：`CandidateType = 'symbol' | 'market_overview' | 'hotspot'`
- `market_overview` 内容：当日大盘宏观（BTC.D / 总市值 / Fear&Greed / 跨大类资金流向 / 美股关联）
- `hotspot` 内容：当日热点叙事（trending token / 新闻热度 / 社交关注）
- 独立 cadence：大盘 1 次/日（早 9:00 UTC+8）/ 热点 2-3 次/日
- 复用现有 PM pipeline，14 角色对常驻 candidate 走同样 dispatch
- 常驻 record 写进同 KV namespace，timeline 投影同入口（多 type）

**B Candidate selector 优先级评分**：

- 评分维度（F 草拟初稿，Codex Round 1 可调）：
  - **市值权重**（大币优先）：BTC/ETH/SOL/HYPE 等 market cap top-10 → 高分
  - **24h volume 权重**（流动性优先）：CEX 真 volume 数据
  - **新闻热度权重**（事件驱动优先）：CryptoCompare / 现有 news source 7d 新闻数
  - **用户关注度权重**（社交信号优先，如可获取）
- candidate pool 改为按总分排序 top-N（N 由 Codex Round 1 评估合理值）
- 废 long-tail 随机进 pool 逻辑
- watch-only symbol（如 BILL/IRYS）仅在评分高于阈值时进 pool

**C 决策流卡片多 type 视觉**：

- 卡片视觉同区不同样式：
  - **symbol 卡**：现状不变
  - **market_overview 卡**：badge "大盘" + 不同 accent color + 不显 follow-trade 按钮
  - **hotspot 卡**：badge "热点" + 不同 accent color + 视情况显 follow-trade（如 hotspot 对应具体 symbol 且 executable）
- 排序：常驻卡置顶（market_overview 第一 / hotspot 第二）+ 币种卡按 timestamp desc
- 10 locale i18n badge 文案（含 en_XA）

### 2.2 Out-of-Scope

- L4 多空辩论戏剧化（推 B.15）
- L5 6 阶段仪式感（推 B.15+）
- candidate 用户加权 / 反对（推 B.17）
- 真 follow-trade 接 CoinW API（推 B.16+）

---

## § 3 Edge Cases（4 轴）

### 3.1 输入轴

- **常驻 candidate 当日生成失败**：UI 显示前日 record（带 "前日数据" badge）+ trigger retry
- **优先级评分维度数据缺失**（如 news 数据源挂）：评分跳过该维度，剩余维度归一化
- **candidate pool top-N 全 executable**：不混 watch-only，OK
- **candidate pool top-N 全 watch-only**（极端场景）：仍保 executable token 占位（fallback BTC）

### 3.2 状态轴

- **常驻 candidate 已存在当日 record**：visit refresh trigger 不重跑（cadence-based dedupe）
- **新 candidate type 写入 KV 但 timeline projection 未识别**：避免 hotfix-3 hydration 漏洞重演，本 spec 必须含 timeline projection 多 type 测试
- **优先级评分 cache 5min**：避免 every-request 计算撞 rate limit

### 3.3 边界轴

- **常驻 candidate 14 角色全 abstain**（罕见）：record 标 `no_signal` + UI 显示 "今日大盘无显著信号"
- **timeline events 含常驻 + 多币种 + 同 timestamp**：排序 tie-breaker 严格（type priority desc → lastUpdatedAt desc → id 字典序）
- **常驻 cadence 撞 cron 间隔**：cron 触发 + visit-trigger 触发要 dedupe 一致

### 3.4 失败轴

- **常驻 candidate cron 不跑**（Vercel preview 限制，hotfix-2 已知）：visit-trigger refresh 链路兜底
- **优先级评分 API（market cap / volume）超时**：fallback 静态 universe 排序（BTC > ETH > SOL > HYPE 固定序）
- **多 type 卡片视觉 break responsive**：a11y 测试 + responsive breakpoint 测试覆盖

---

## § 4 Assumptions

1. 现有 PM pipeline / 14 角色 prompt 能 generalize 到非 symbol candidate（大盘 / 热点），需 prompt 模板调整
2. CryptoCompare news source 含足够热度数据支持优先级评分
3. CoinW kline / market cap / volume API 可用作优先级 input
4. Codex Round 1 first-hand 调研后确认或修正上述假设

---

## § 5 Measurable Success Criteria

### 5.1 A 常驻

- ✅ schema `CandidateType` 含 3 值
- ✅ market_overview 常驻当日跑 1 次（cadence test）
- ✅ hotspot 常驻当日跑 2-3 次（cadence test）
- ✅ 常驻 record 写 KV + timeline projection 通过（hotfix-3 hydration 漏洞不重演）

### 5.2 B 优先级

- ✅ candidate selector 评分函数实装 + 单元测试覆盖 4 维度
- ✅ candidate pool top-N 按总分排序（test verify N records 按分排）
- ✅ 优先级评分 cache 5min（avoid hot recompute）
- ✅ 数据源全挂时 fallback 静态 universe

### 5.3 C 视觉

- ✅ 决策流卡片支持 3 type（grep render 条件）
- ✅ 同区不同样式（grep accent / badge）
- ✅ market_overview / hotspot 卡不显 follow-trade 按钮
- ✅ 10 locale i18n badge 文案 + en_XA
- ✅ responsive + a11y axe 0 violations
- ✅ 排序 tie-breaker 严格（hotfix-4 经验）

### 5.4 全局（hotfix 链积累纪律）

- ✅ leakCount=0（hotfix-5 禁止清单 + TeamMemberId 在 public 0 次）继续维持
- ✅ ≥3 次实测真 PM run + raw artifact commit 进 PR
- ✅ 多次实测稳定性（5 次 fetch / 5 次刷新 hash 稳定）

---

## § 6 实施流程

### 6.1 派工模型

Codex Round 1 评估 spec → F 双脑判断 + 定稿 v1.1 → Codex 持续 3 stage 开发：

- Stage 1：A 常驻 candidate type（含 schema + cadence + KV write + timeline projection 通过）
- Stage 2：B 优先级评分（含 4 维度评分 + cache + fallback）
- Stage 3：C 多 type 视觉 + i18n + 验收套件

每 stage 单 PR / preview / 实测稳定性 / artifact commit 进 PR。

### 6.2 PAUSE 触发场景

- 任何 § 13 cannot-do 违反
- Vercel runtime 限制（如新 candidate type 撞 cron / refresh / KV 限制）
- 数据源（市值 / volume / news）真实查证不可用
- UI 改动超出 Dan 拍 "决策流多 type" 范围

---

## § 13 不能做（冻结清单）

1. 不动 hotfix-5 内容质量约束（leakCount=0 维持，禁止清单 + TeamMemberId 不能复活到 public payload）
2. 不动 hotfix-4 去重 + stable order 逻辑
3. 不动 hotfix-3 hydration 多机制
4. 不动 hotfix-2 demo fallback 关闭（empty state 保留）
5. 不动 hotfix-1 撤面板（不复活 TeamTrackRecordPanel）
6. 不擅自加新 panel / 重构 V10 board layout（决策流多 type 是 Dan 已授权范围，超出必须问）
7. 不擅自改 prod（Constitution Rule 2 v0.1.2）
8. 不引入第 3 个 LLM provider
9. 不加 `void trigger()` fire-and-forget（必须 waitUntil，hotfix-3 经验）
10. 不擅自改 Vercel cron 配置（如发现需新 cron 报告 Dan，不擅自加）
11. 不在 evidence dispatcher / PM 汇总 inline TeamMemberId（hotfix-5 红线）
12. 多 type 卡片 follow-trade 按钮 strict gate（market_overview 严禁渲染）

---

## § 14 Constitution 对照

| Rule            | Check                                      | 答   |
| --------------- | ------------------------------------------ | ---- |
| Rule 1 部署身份 | 全 preview，prod 不动                      | PASS |
| Rule 2 v0.1.2   | preview free / prod 显式授权               | PASS |
| Rule 3 视觉品牌 | 决策流多 type Dan 已授权（chat 拍 B 方案） | PASS |
| Rule 4 schema   | 新 candidate type 属 active schema 扩展    | PASS |
| Rule 5 AI 诚实  | hotfix-5 leakCount=0 维持                  | PASS |
| Rule 6 协作闭环 | Codex Round 1 + F 双脑接力                 | PASS |
| Rule 7 验证     | § 5 measurable + 实测稳定性 + raw artifact | PASS |

---

## § 15 验收 Checklist

- [ ] § 5.1 A 常驻 4 项 ✅
- [ ] § 5.2 B 优先级 4 项 ✅
- [ ] § 5.3 C 视觉 6 项 ✅
- [ ] § 5.4 全局 3 项 ✅
- [ ] Constitution § 14 PASS
- [ ] § 13 cannot-do 12 条 0 违反
- [ ] 3 stage 3 独立 PR / preview / 实测稳定性 / raw artifact
- [ ] Dan preview 验收通过

---

## § 16 老板简报

claw42 工作台产品架构升级。本次做了啥：用户进站直接看到两个常驻分析卡——每日大盘分析（早上一次定时更新）+ 当日热点叙事（白天 2-3 次更新），价值感够、节奏稳定。同时币种分析按优先级抓——大币 / 热门 / 新闻驱动优先，长尾小币只在评分高时进。卡片同区分三种样式：大盘卡 / 热点卡 / 币种卡，用户一眼区分类型，但视觉统一不乱。后续规划：架构层稳定后推多空辩论戏剧化（多空两派当面对线）+ 6 阶段决策仪式感。

---

## § 17 Anti-Rationalization

| 逃逸路径                                               | 为什么不行                              | 正确做法                                                                 |
| ------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------ |
| Codex Round 1 评估时按 F 推测盲 PASS                   | hotfix 链 5 次 F 推测命中率约 30%       | first-hand 调研 + 主动修正 F 假设                                        |
| spec 太大塞 L4 戏剧化进 B.14                           | B.13 4 stage 塞太满后 5 次 hotfix 教训  | L4 推 B.15，B.14 仅产品架构层                                            |
| 常驻 candidate 14 角色 prompt 直接套现有 symbol prompt | 大盘 / 热点和单币种思考模式不同         | prompt 模板按 type 分支，Codex Round 1 评估                              |
| 优先级评分维度 F 拍死                                  | 数据源真实可用性未知                    | Codex Round 1 first-hand 查 CryptoCompare / volume / market cap 真实接口 |
| 多 type 卡视觉趁机重构 V10 board                       | 超出 Dan 授权范围                       | 严格"同区不同样式"，整体 layout 不动                                     |
| stage 间不实测稳定性                                   | hotfix-4 教训：跑 verify ≠ 多次刷新稳定 | 每 stage 实测 5 次 fetch / 5 次刷新                                      |
| 用 void trigger() / 自创 wait                          | hotfix-3/5 红线                         | waitUntil + 禁止清单兜底                                                 |
| follow-trade 按钮在 market_overview 卡渲染             | safety critical                         | strict gate + 单测覆盖                                                   |

---

## § 18 Decision-Log 联动

完成后追加：

```
[2026-MM-DD] [架构] B.14 闭环：market_overview + hotspot 常驻 + 优先级评分 + 多 type 卡
[2026-MM-DD] [流程] Codex Round 1 评估（F 推测 vs Codex first-hand 修正点）
```

---

## § 19 Tasks 索引（Codex Round 1 评估时可调整）

| Task | Stage    | Priority | Story                                                       |
| ---- | -------- | -------- | ----------------------------------------------------------- |
| T101 | 1 常驻   | P0       | schema CandidateType 扩 3 值                                |
| T102 | 1 常驻   | P0       | market_overview cron + cadence 实装                         |
| T103 | 1 常驻   | P0       | hotspot cron + cadence 实装                                 |
| T104 | 1 常驻   | P0       | 14 角色 prompt 模板按 candidate type 分支                   |
| T105 | 1 常驻   | P0       | timeline projection 多 type 通过 + 实测 ≥3 次               |
| T106 | 1 常驻   | P0       | 实测真 PM run for 常驻 + raw artifact commit                |
| T201 | 2 优先级 | P0       | candidate selector 4 维度评分函数                           |
| T202 | 2 优先级 | P0       | 数据源接入（market cap / volume / news / 社交）             |
| T203 | 2 优先级 | P0       | 评分 cache 5min + fallback 静态 universe                    |
| T204 | 2 优先级 | P0       | 评分单元测试 + 数据源挂 fallback 测试                       |
| T301 | 3 视觉   | P0       | 决策流卡片 3 type 渲染分支                                  |
| T302 | 3 视觉   | P0       | market_overview / hotspot accent + badge                    |
| T303 | 3 视觉   | P0       | 10 locale i18n badge（含 en_XA）                            |
| T304 | 3 视觉   | P0       | follow-trade 按钮 strict gate（market_overview 不渲染）     |
| T305 | 3 视觉   | P0       | 排序 tie-breaker（type priority → lastUpdatedAt desc → id） |
| T306 | 3 视觉   | P0       | 多次刷新稳定性实测 + a11y axe 0 + raw artifact              |

P0 = 16 / 总 16。

---

_版本：v1.0 (2026-05-17 起草，B.13 hotfix 链 5 次教训积累后第一个新 phase spec)_
_下一步：派 Codex Round 1 评估_
