# Spec: Watch B.13 Hotfix 2 — Kill Demo Fallback + 根因调研

> **版本**：v1.0（2026-05-16 紧急 hotfix 2）
> **作者**：F (Claude session)
> **状态**：Hotfix Draft，立即派 Codex 双任务
> **协议**：claude-codex-protocol v2.5 + AI-driven paradigm v1.0
> **触发**：B.13 hotfix 1（PR #100）诊断结论 — "脚本化"现象根因 = 720min timeline 空后 V10 fallback 到静态 demo topics。Dan 2026-05-16 chat 拍板 B 方案：紧急关 demo fallback + 同时调研为什么 Stage 1-4 merge 后没新真实 PM record

---

## § 1 Overview

### 1.1 hotfix 1 诊断结论（PR #100 已 merged）

| 发现                                                                     | 证据                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| "脚本化"直接根因 ≠ 170min lock                                           | Codex 手动 refresh BTC 返回 `no_signal` 不是 `locked` |
| 真直接根因 = V10 timeline empty 720 分钟后自动 fallback 静态 demo topics | V10 已有 graceful-degrade 兜底                        |
| 前端 refresh 依赖 `topics[0]?.symbol`，timeline 空时不真触发 PM run      | 死循环：empty → demo → 不触发 → empty                 |
| Stage 1-4 merge 后 12+ 小时无新真 PM record                              | KV/telemetry 真 LLM 调用记录都早于 merge              |

### 1.2 hotfix 2 双任务范围

**Task A — Kill demo fallback（quick fix，Dan 拍板）**：

- V10 timeline 空时**不再 fallback 静态 demo topics**
- 显示明确 empty state："工作台启动中，暂无最近决策"（10 locale）
- 视觉上**和真分析有明确区分**（不能让用户分不清真假）
- 这是产品哲学修正：graceful degrade ≠ 假装有数据

**Task B — 双脑调研为什么 Stage 1-4 merge 后无新真 PM record**：

F 推测 3 个可能根因，Codex 必须 first-hand 查每一项：

1. **Stage 1 PM no_signal 路径过严**：Stage 1 改"PM 不强等 evidence" 后，PM 默认走 `no_signal` 不输出？查 pmDecisionPipeline.ts 最近改动 + 实测一次 PM run 看是否 90% 进 no_signal 分支
2. **Stage 3 candidate pool CoinW filter 过严**：只 BTC/ETH/SOL/HYPE 4 币 executable，candidate selector 是否找不到满足条件的 candidate → 全 no_signal？查 topicSelector.ts + candidate filter 逻辑 + 实测 candidate pool 当前状态
3. **Vercel cron preview 不跑（只 prod 跑）**：`vercel.json` 的 cron `0 */3 * * *` 是否只在 prod project deployment 触发，preview 不跑？查 Vercel 文档 + cron 执行历史 log

**Codex 必须给 (a)(b)(c) 三段 first-hand judgement**：

- (a) 最可能的根因是哪个（含 commit / 文件 / 行号 / 现象因果）
- (b) fix 方向 + 保守/激进/不确定 工作量估算
- (c) F 没问到的 angle

### 1.3 F 想 flag 给 Dan 的产品级问题

Demo fallback 设计本身有 product bug：timeline 空时显示假分析数据 + 无视觉区分。Task A 修这次，但**这个根本设计模式**——graceful degrade 显示假数据——应该在以后的所有 UI 状态机里反思。本 hotfix 不展开 audit 全 graceful path，但 decision-log 留痕作为 future review item。

---

## § 2 In-Scope / Out-of-Scope

### 2.1 Task A In-Scope

**修改文件**（按 V10 demo fallback 实际路径，Codex first-hand 查清）：

- V10 board topics 来源逻辑：timeline 空时**不进 demo topics 分支**
- empty state UI 组件：显示 "工作台启动中，暂无最近决策" + 视觉明确区分（e.g. 灰色 / icon / "no data" 标识）
- 10 locale i18n：empty state 文案翻译（含 en_XA）
- 删除 / 注释 demo topics fixture 数据（如有静态 demo data 文件可清理，但保留 type 定义以备后续调试）

**严格不动**（Task A 不扩范围）：

- backend API `/api/watch/timeline` / `/api/watch/stream` 不动
- `/api/watch/refresh` 不动
- PM pipeline 不动
- evidenceDispatcher 不动
- B.13 Stage 1-4 已 merge 的产品逻辑改进保留
- TeamTrackRecordPanel 已撤（hotfix 1 PR #100 完成）

### 2.2 Task B In-Scope（仅调研不 fix）

按 § 1.2 三项 first-hand 查清 + 报告。**仅诊断不实施任何 fix 代码**，fix 等 F + Dan 看完报告后另起 spec。

### 2.3 Out-of-Scope

- B.14 / B.15 暂停（直到 hotfix 2 + 根因 fix 全闭环）
- prod 严禁碰
- 不在本 hotfix 内实施 Task B 任何 fix
- 不 audit 其他 graceful degrade 路径（留 future review）

---

## § 3 Edge Cases

### 3.1 Task A 边界

- demo topics 数据**有没有外部组件依赖**（其他 panel / route）？如有，Codex 报告并提议保留 fixture 仅停止挂载到 V10
- empty state UI 是否需要在中间显示倒计时 / 下次 cron 预估时间？Task A 不做（避免新增需求），Dan 看完 preview 后再决定
- 多 symbol view（如果有）的 empty state 处理同 default tab

### 3.2 Task B 调研失败场景

- 如 Codex 调研 3 项后**找不到明确根因**（可能问题不在推测的 3 个）→ 报告写明"已排除 3 项，疑似在 X / Y"
- 如根因涉及 Vercel cron 配置（项目级 setting） → Codex 报告但不擅自改配置，等 Dan 拍

---

## § 4 Assumptions

1. V10 timeline 空时进入 demo fallback 的代码路径在 V10 board 组件层，不是后端 API 层（hotfix 1 报告已暗示）
2. 关 demo fallback 后 empty state UI 改动属于"撤掉已有 fallback + 替换为 empty state"，**不是新增 panel**，不触发 CLAUDE.md UI 授权规则（按 CLAUDE.md 例外清单"修 bug" + Dan chat 已明确拍板 B 方案 = 已授权）
3. Codex 有能力 first-hand 查 Vercel cron 执行历史（log / dashboard / API）

---

## § 5 Measurable Success Criteria

### 5.1 Task A 验收

- ✅ Vercel preview 打开工作台 → timeline 空时**不再显示 demo topics**
- ✅ Empty state 显示明确 "工作台启动中，暂无最近决策" 类文案（10 locale 含 en_XA）
- ✅ Empty state 视觉和真分析数据**明显区分**（grep V10 board 代码确认）
- ✅ build / typecheck / lint / test 套件全过

### 5.2 Task B 验收

- ✅ Codex 在 `claude-codex-sync/codex-to-claude.md` 写完整诊断报告（commit 进 PR，不只在 worktree）
- ✅ 三项调研每项含 first-hand 数据（commit sha / 文件 / 行号 / 实测结果 / log 摘要）
- ✅ 含 (a)(b)(c) 三段 judgement

---

## § 6 实施流程

### 6.1 单 PR，双 task 并行

1. Codex 拉新 worktree `feature/b13-hotfix2-kill-demo-fallback-diagnose`
2. Task A 关 demo fallback + empty state UI + 10 locale i18n → commit
3. Task B 三项调研报告 → 写到 `claude-codex-sync/codex-to-claude.md` → commit（同 PR）
4. PR 推 → preview → 报告给 F → F 给 Dan 选 fix 方向（基于 Task B 根因）

### 6.2 关键纪律

- 报告必须 commit 进 PR 不只在 worktree（hotfix 1 时报告在 worktree 没 push，本次必须修正）
- Task A 撤回范围严格不扩
- Task B 仅诊断不 fix

---

## § 13 不能做（本 hotfix 范围内）

1. 不能扩 Task A 范围（不动 backend / pipeline / refresh）
2. 不能 Task B 内做 fix（仅诊断）
3. 不能擅自 prod deploy（Constitution Rule 2 v0.1.2）
4. 不能跳过 (a)(b)(c) judgement
5. 不能把诊断报告只留 worktree（必须 commit 进 PR）
6. 不能在 empty state 里展示假数据 / mock data（违反产品哲学修正初衷）
7. 不能改 V10 visual hierarchy / 加新 panel（Task A 严格是"撤 fallback + 替 empty state"）
8. 不能擅自改 Vercel cron 配置（如 Task B 发现是 cron 问题，仅报告等 Dan 拍）

---

## § 14 Constitution 对照检查

| Rule                   | Check                                                          | 答   |
| ---------------------- | -------------------------------------------------------------- | ---- |
| Rule 1 部署身份        | 全 preview，prod 不动                                          | PASS |
| Rule 2 生产保护 v0.1.2 | 仅 preview                                                     | PASS |
| Rule 3 视觉与品牌      | empty state 替 demo fallback = 撤已有，不新增；Dan chat 已授权 | PASS |
| Rule 4 数据与 schema   | 不动 schema                                                    | PASS |
| Rule 5 AI 诚实性       | 修产品哲学层 "不显示假数据"                                    | PASS |
| Rule 6 协作闭环        | 单 PR + 诊断报告 + F 双脑接力                                  | PASS |
| Rule 7 验证门槛        | § 5 含 measurable，preview URL 拿 Dan 验收                     | PASS |

---

## § 16 老板简报

claw42 工作台紧急修复 2。本次做了啥：之前工作台在没有最新分析数据时会自动显示一批"演示版本"的假分析内容，且看起来和真分析没区别，容易误导用户。现在改成清晰的空状态提示"工作台启动中，暂无最近决策"，让用户一眼看出是否有真分析。同时调研为什么最近 12 小时没有产生新的真实 AI 团队分析——三个可能原因正在排查中，调研完出修复方案。后续规划：根因修完后，B.14 / B.15 多 Agent 戏剧化和仪式感工作恢复推进。

---

## § 17 Anti-Rationalization

| 逃逸路径                              | 为什么不行                               | 正确做法                                           |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| Task A 顺手把 V10 layout 整体重构     | 范围严格"撤 fallback 替 empty"，不动其他 | grep V10 board 改动文件，确认仅 demo fallback 相关 |
| Task B 找到根因后直接 fix             | 仅诊断，fix 等 Dan 拍                    | 报告 + (a)(b)(c)，不动代码                         |
| Empty state 文案设计成"乐观" / 营销腔 | 用户需要事实，不是营销                   | 直接"工作台启动中，暂无最近决策"类客观陈述         |
| 把诊断报告只写 worktree 不 commit     | hotfix 1 已暴露此问题                    | 报告 commit 进 PR，main worktree 可见              |
| 把 demo fallback fixture 数据彻底删   | 后续调试 / 文档可能需要                  | 保留 type 定义 + 数据文件，仅停 V10 挂载           |

---

## § 18 Decision-Log 联动

本 hotfix 完成后 decision-log 追加：

```
[2026-05-16 晚 +] [产品] B.13 hotfix-2：关 demo fallback + Empty state 显示客观陈述
[2026-05-16 晚 +] [架构] Codex 双脑调研 Stage 1-4 merge 后无新真 PM record 三可能根因报告
[future] [架构] Codex 报告读完后 F + Dan 拍 fix 方向 + 起新 spec 实施根因 fix
```

---

## § 19 Tasks 索引

| Task  | Priority | Story                                                                             |
| ----- | -------- | --------------------------------------------------------------------------------- |
| T-A.1 | P0       | 定位 V10 demo fallback 代码路径（first-hand 查）                                  |
| T-A.2 | P0       | 撤 timeline 空时 demo fallback 分支                                               |
| T-A.3 | P0       | 实装 empty state UI 组件 + 视觉明确区分                                           |
| T-A.4 | P0       | 10 locale i18n 文案（含 en_XA）"工作台启动中，暂无最近决策"                       |
| T-A.5 | P0       | demo fixture 数据保留 + 仅停 V10 挂载                                             |
| T-A.6 | P0       | build / typecheck / lint / test 套件全过                                          |
| T-B.1 | P0       | first-hand 查 PM no_signal 路径过严（Stage 1 改动后实测 PM run 概率分布）         |
| T-B.2 | P0       | first-hand 查 candidate pool CoinW filter 过严（topicSelector + filter 逻辑实测） |
| T-B.3 | P0       | first-hand 查 Vercel cron preview 是否真跑（cron 执行 log / dashboard）           |
| T-B.4 | P0       | 报告含 (a) 最可能根因因果链 (b) fix 方向 + 工作量 (c) F 没问到的 angle            |
| T-B.5 | P0       | 报告 commit 进 PR（不只 worktree）                                                |

P0 = 11 / 总 11 tasks。

---

_版本：v1.0 (2026-05-16 晚紧急 hotfix-2)_
