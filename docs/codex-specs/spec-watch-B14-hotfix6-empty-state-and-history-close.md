# Spec: Watch B.14 Hotfix 6 — Empty State 真因 + 决策历史关闭按钮

> **版本**：v1.0（2026-05-17 下午紧急 hotfix）
> **作者**：F
> **状态**：Hotfix Draft，立即派 Codex
> **触发**：Dan preview 验收 B.14 反馈两个问题
>
> - "进去后只有工作台启动中，暂无最近决策，什么都没有"
> - "查看决策历史缺少关闭按钮"

---

## § 1 Overview

### 1.1 Dan 反馈

B.14 全 4 stage merged + Codex 实测时报告 `eventsLength=3` / 首条 market_overview。但 Dan 5/17 下午打开 preview 实际看到：

- **空白 empty state**（"工作台启动中，暂无最近决策"——hotfix-2 关 demo fallback 后的兜底文案）
- **决策历史 panel 缺关闭按钮**

### 1.2 F vs Codex 实测时间差异

Codex Stage 1 实测在 5/17 凌晨/午（merge 时窗口），Dan 实测 5/17 下午。几小时差距可能导致 record 状态变化。

### 1.3 双脑诊断范围（仅诊断 + bug fix，不扩范围）

- Task A 调研 "进站空白" 真因（first-hand 必查）
- Task B 修 "决策历史关闭按钮"（bug fix，CLAUDE.md UI 授权例外清单内）

---

## § 2 In-Scope / Out-of-Scope

### 2.1 Task A — 调研 "进站空白" 真因

**F 推测 4 个可能根因（Codex first-hand 必须逐一验证）**：

| 推测                                                                                | first-hand 验证方法                                                                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| (a) Stage 1 cadence policy 实装了但 visit-trigger 没真触发 PM run                   | 实测 preview 端 visit-trigger → 看 `/api/watch/refresh` 调用 + waitUntil 是否真 schedule market_overview / hotspot PM run |
| (b) Codex Stage 1 实测 3 条 record 在凌晨/午写入，到下午被 freshness/staleness 过滤 | 查 KV 当前 record state + freshness threshold 配置 + timeline projection filter 逻辑                                      |
| (c) Stage 2 cost cap 过严挡住触发                                                   | 实测 cost cap 触发条件 + visit trigger 命中 cap 概率                                                                      |
| (d) Cadence policy 在 preview 模式下根本没跑过（visit-trigger 是唯一路径但被锁死）  | 查 vercel preview deployment 日志 + KV pmDecisionLock 状态                                                                |

**Codex 报告必须含**：

- 各推测验证结果（pass / fail / 不适用）
- 真因 first-hand 因果链
- fix 方向 + 工作量估算

**Fix 实施**（基于真因）：

- 不擅自加新机制（hotfix 链经验：F 推测命中率 30%，Codex first-hand 真因 + 最小改动）
- 重启 cadence policy / 调 freshness threshold / 修 cost cap / 修 trigger 链路—— Codex 实测后决定哪一处修

### 2.2 Task B — 决策历史关闭按钮

- first-hand 定位 "决策历史" panel/drawer/modal 实际组件
- 检查 close affordance 缺失原因（Stage 3 改 V10 视觉漏 + 还是历史一直就缺）
- 加关闭按钮（按现有 V10 视觉风格，不擅自重构 panel）
- a11y：Esc 键也关闭 + close button aria-label 10 locale i18n

**CLAUDE.md UI 授权确认**：

- 加关闭按钮 = bug fix（panel 渲染缺失 affordance），属 CLAUDE.md 例外清单"修 bug"
- 不重构 panel 整体 layout
- 不改 panel 内容 / 数据源

### 2.3 Out-of-Scope

- 不动 B.13 / hotfix-1/2/3/4/5 / B.14 Stage 0/1/2/3 已 merged 改动
- 不擅自改 candidate / pipeline / projection
- 不引入新 panel / section
- 不上 prod
- 不擅自改 Vercel cron 配置

---

## § 3 Edge Cases

### 3.1 Task A

- 多根因叠加可能（如 c + d 同时）→ 报告分层 + 逐层 fix
- 真因不在 4 推测内（hotfix 链经验：F 推测 30%）→ Codex 自主补充第 5 类
- 修完后立即跑 visit-trigger 验证至少 1 条新 record 写入 + timeline 显示

### 3.2 Task B

- 决策历史在多 type 卡（symbol / market_overview / hotspot）都有 → 关闭按钮 3 type 全 cover
- 移动端 vs 桌面端关闭按钮位置（responsive 不同）→ 都覆盖

---

## § 4 Assumptions

1. F 推测 4 根因里至少 1 个命中（hotfix 链经验 30% 命中率，可能要补充第 5 类）
2. 决策历史 close button 是 missing affordance bug，不是被刻意去除
3. Codex first-hand 实测能复现 Dan 看到的 empty state

---

## § 5 Measurable Success Criteria

### 5.1 Task A

- ✅ Codex 报告含 4 推测验证结果 + 真因因果链
- ✅ Fix 完后 preview 打开看到至少 1 条真分析 record（非 empty state）
- ✅ market_overview + hotspot + 优先级币种 candidate 至少 1 类显示
- ✅ 5 次刷新稳定（hotfix-4 教训持续）
- ✅ leakCount=0 维持（hotfix-5 红线）

### 5.2 Task B

- ✅ 决策历史关闭按钮渲染（grep + 截图 verify）
- ✅ 点击关闭 + Esc 键都关闭
- ✅ aria-label 10 locale i18n
- ✅ 3 type 卡（symbol / market_overview / hotspot）全 cover

### 5.3 全局

- ✅ Raw artifact + 报告 commit 进 PR
- ✅ Prod 未动

---

## § 6 实施流程

### 6.1 单 PR 双 task

1. Codex 拉新 worktree（**先校验 `.vercel/project.json` 存在 + scope/project 匹配**，N=2 提前固化纪律）
2. Task A 调研 → 报告 commit → fix 实施
3. Task B 修 close button → grep + 截图 verify
4. PR 推 → preview → 给 F → F 给 Dan 验收

---

## § 13 不能做

1. 不按 F 推测盲修（先 Task A first-hand 实测）
2. 不动 B.13 / hotfix-1/2/3/4/5 / B.14 Stage 0-3 已 merged 改动
3. 不擅自加新 panel / section（CLAUDE.md UI 授权红线）
4. 不重构决策历史 panel 整体 layout（仅加 close button）
5. 不擅自改 Vercel cron / prod
6. 不修完不实测就 ship（必须 5 次刷新稳定 verify）
7. 维持 leakCount=0 / canonical ordering / strict gate / 14 source TeamMemberId / executable filter / cost cap 所有红线
8. Codex 动 `npx vercel` 前先校验 `.vercel/project.json` 存在（N=2 提前固化）

---

## § 14 Constitution 对照

| Rule           | Check                                                 | 答   |
| -------------- | ----------------------------------------------------- | ---- |
| Rule 1 部署    | preview only                                          | PASS |
| Rule 2 v0.1.2  | preview free / prod 不动                              | PASS |
| Rule 3 视觉    | bug fix close button 属 UI 授权例外 + 调研空白不动 UI | PASS |
| Rule 4 schema  | 不动 schema                                           | PASS |
| Rule 5 AI 诚实 | leakCount=0 维持                                      | PASS |
| Rule 6 协作    | 单 PR + 调研 + bug fix + F 双脑                       | PASS |
| Rule 7 验证    | § 5 含 measurable + 实测 + 截图                       | PASS |

---

## § 16 老板简报

claw42 工作台 B.14 升级后两个紧急修复。本次做了啥：之前升级完用户打开工作台看到空白页面"工作台启动中"，没看到任何分析卡——调研真因并修通让用户进站直接看到大盘 / 热点 / 优先级币种分析。同时决策历史面板之前缺少关闭按钮，这次补上 + 加键盘 Esc 关闭支持。修完多次刷新稳定后才算完。

---

## § 17 Anti-Rationalization

| 逃逸路径                                   | 为什么不行                                 | 正确做法                                           |
| ------------------------------------------ | ------------------------------------------ | -------------------------------------------------- |
| 按 F 推测 4 根因盲修                       | hotfix 链 5 次教训：F 推测 30% 命中        | Codex first-hand 实测 4 推测各自验证再修           |
| Codex 实测时 3 条 record 写过 = 系统没问题 | Dan 看到的是真 empty state，状态变化未追踪 | 必须实测 Dan 看到时间窗口 + KV 当前状态            |
| 决策历史关闭按钮 = 顺手"优化" panel 整体   | 只允许补 missing affordance                | 不动 panel 内容 / 整体 layout                      |
| 修完不 5 次刷新 verify                     | hotfix-4 教训                              | 必须 5 次刷新 + a11y 测试                          |
| Cost cap 一刀降到 0 让所有 trigger 都过    | 违背 spec § 13 #18 设计意图                | 修 cost cap 必须保留产品 vision 限制，调阈值不调关 |

---

## § 18 Decision-Log 联动

完成后追加：

```
[2026-05-17 晚] [架构] B.14 hotfix-6：empty state 真因 + 决策历史关闭按钮
[2026-05-17 晚] [流程] Codex first-hand 4 推测验证 + 真因因果链
```

---

## § 19 Tasks 索引（v1.0 + v1.1 追加 Task C/D）

### v1.0 原 Task A + B

| Task  | Priority | Story                                                                                      |
| ----- | -------- | ------------------------------------------------------------------------------------------ |
| T-A.1 | P0       | first-hand 实测 visit-trigger + waitUntil 是否真 schedule market_overview / hotspot PM run |
| T-A.2 | P0       | 查 KV 当前 record state + freshness threshold + projection filter                          |
| T-A.3 | P0       | 实测 cost cap 触发条件 + visit trigger 命中 cap 概率                                       |
| T-A.4 | P0       | 查 vercel preview deployment 日志 + KV pmDecisionLock 状态                                 |
| T-A.5 | P0       | 报告 4 推测验证结果 + 真因因果链 + commit 进 PR                                            |
| T-A.6 | P0       | fix 真因 + 实测 ≥1 条 record 显示 + 5 次刷新稳定                                           |
| T-B.1 | P0       | 定位决策历史 panel/drawer 实际组件                                                         |
| T-B.2 | P0       | 加 close button + Esc 键 + aria-label 10 locale                                            |
| T-B.3 | P0       | 3 type 卡全 cover close button                                                             |
| T-B.4 | P0       | grep + 截图 verify + a11y axe 0                                                            |

### v1.1 追加 Task C + D（Dan 2026-05-17 晚补充截图反馈）

**Task C — 热点卡未显示但顶部状态栏说有 1 个**

Dan 截图：顶部 "热点 1 / 已闭环 0 / 辩论中 1 / 起步 0"，但 UI 主体只 1 个 market_overview 卡。

F 推测可能根因（Codex first-hand 验证）：

- (a) Stage 3 multi-type 渲染 conditional 漏 hotspot 分支
- (b) hotspot record 写了但 timeline projection 把它 filter（hotfix-3 hydration 漏洞延伸？）
- (c) 顶部状态栏数字 hardcoded 不反映 events 真实数量（数据 OK / 显示 bug）
- (d) Canonical comparator 让 hotspot 排到分页/可视区外
- (e) 第 5 类可能根因（Codex first-hand 自主补充）

| Task  | Priority | Story                                                                  |
| ----- | -------- | ---------------------------------------------------------------------- |
| T-C.1 | P0       | first-hand 查 timeline events 是否含 hotspot record（grep + KV state） |
| T-C.2 | P0       | 查 V10 multi-type 渲染条件是否覆盖 hotspot 分支                        |
| T-C.3 | P0       | 查顶部状态栏数字 source（events derived vs hardcoded）                 |
| T-C.4 | P0       | fix 真因 + 实测 hotspot 卡可见 + 顶部状态栏与 events 一致              |

**Task D — UI controlled state 自动 reset bug（hotfix-4 延伸）**

Dan：

- "不知道什么机制在刷新，收起的回自动打开"
- "看第三条突然刷新后回到第一条"

F 推测：hotfix-4 排序 key + 去重修了**数据层稳定**，但 UI 端 **controlled state（展开/折叠/滚动位置）没绑定到 stable record key** → SSE/refresh 推送时整 list re-render → React reconciler 把组件全 unmount/remount → state 丢

F 推测可能根因（Codex first-hand 验证）：

- (a) `events.map` 用 `index` 作为 React key（hotfix-4 修过排序但 UI key 没改？）
- (b) SSE stream 收到新事件时整个 events array 引用变化 → 即使 key 稳定也触发 reconciler 重渲染部分子树
- (c) Freshness 状态变化（cached → refreshing → stale）导致整个 board re-mount
- (d) Scroll position 没用 `scroll-restoration` / `scrollIntoView` 保持
- (e) 展开/折叠 state 存在父组件而非按 record id 隔离

| Task  | Priority | Story                                                                  |
| ----- | -------- | ---------------------------------------------------------------------- |
| T-D.1 | P0       | first-hand 查 V10 events.map React key 当前是 record.id 还是 index     |
| T-D.2 | P0       | 查展开/折叠 state 存储位置 + 是否按 record id 隔离                     |
| T-D.3 | P0       | 查 SSE stream / refresh trigger 时 events array 引用变化模式           |
| T-D.4 | P0       | 查 scroll position 保持机制（如有）                                    |
| T-D.5 | P0       | fix 真因（key 改 record.id + state 隔离到子组件 + scroll restoration） |
| T-D.6 | P0       | 实测：连续 SSE / refresh 多次后展开 state + 滚动位置稳定（10 次以上）  |
| T-D.7 | P0       | 单元测试：reorder events 后 expand state 仍跟随原 record               |

P0 = 10 + 11 = **21**。

### Task 实施顺序

Task A / C 同根因相关（都涉及 events / timeline 数据层），Codex 一并 first-hand 调研。
Task B / D 同 UI 层，一并 fix。
单 PR 全包。

---

_版本：v1.0 (2026-05-17 紧急 hotfix-6)_
