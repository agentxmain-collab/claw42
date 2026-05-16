# Spec: Watch B.13 Hotfix 4 — Duplicate Dedupe + Stable Order

> **版本**：v1.0（2026-05-16 深夜紧急 hotfix 4）
> **作者**：F (Claude session)
> **状态**：Hotfix Draft，立即派 Codex
> **协议**：claude-codex-protocol v2.5
> **触发**：Dan 2026-05-16 chat preview 验收发现 "工作台中两个同样的 BILL 分析，而且顺序在不断跳动"

---

## § 1 Overview

### 1.1 Dan 实测反馈

- **重复 record**：工作台显示两条 BILL 分析（同一币种重复，应只一条）
- **顺序跳动**：events 顺序在每次刷新 / SSE 推送时变动

F hotfix-3 派工时 Codex 报告"events.length=2 / HYPE+BILL 各一条"，实测和 Dan 看到的状态不一致。可能：

- Codex 实测窗口和 Dan 现在 KV 状态不同
- UI 渲染层 duplicate（数据 OK / render bug）
- hydration race 后 events 内容变成 BILL+BILL

### 1.2 F 推测可能根因（Codex first-hand 必须验证 / 修正）

**重复 record 推测**：

- hotfix-3 PR #103 (history 缺 record backfill) + PR #104 (targeted hydrate) + PR #105 (universe 扩展) 三机制 **race 重复 hydrate** 同一 record
- 缺去重逻辑（按 record id / symbol+timestamp 去重）

**顺序跳动推测**：

- events 排序 key 不稳定（timestamp 缺失 fallback random / Map 迭代顺序非确定）
- `/api/watch/stream` SSE 重复推送 hydrated record
- client 端 events 累加无去重

**Codex 必须 first-hand 实测后再修，不要按 F 推测盲修**（hotfix-1/2/3 三次 F 推测都被部分修正）。

### 1.3 元层观察 — F 必须 confess

连续 4 次 hotfix 暴露 B.13 Stage 1-4 merge 时验收门槛过松：

- 写完 task 跑 verify 套件全过 ≠ Dan 真打开 preview 看正常
- Stage 验收漏一层"打开 preview 看实际效果 + 多次刷新看稳定性"
- F 派工 spec 验收 § 5 多偏静态测试（grep / unit test）少偏交互测试

本次 hotfix-4 完成后立 future 规则：每个 stage 验收必含"preview 多次刷新 / 多 symbol / 多 locale" 交互稳定性测试，不只 unit / build 通过。

---

## § 2 In-Scope / Out-of-Scope

### 2.1 Task A — 调研 + 修 duplicate record

**调研（first-hand 必查）**：

1. `/api/watch/timeline` 当前实际返回（多次调用看 events 数量 / symbol 分布 / record id 是否重复）
2. hotfix-3 hydration 三机制（#103/#104/#105 backfill / targeted / universe）的去重逻辑
3. UI render 层（V10 board / MarketAnalysisPanel）events map 是否按 key 去重

**修复**：

- 在 timeline projection / hydration 层加去重（按 record id / symbol+round 等稳定 key）
- 或在 UI render 层加 key-based dedupe
- 视 Codex first-hand 判断在哪层修最合适

### 2.2 Task B — 调研 + 修 unstable order

**调研（first-hand 必查）**：

1. `/api/watch/timeline` events 排序 key（是否 timestamp 稳定 / 是否 fallback random / Map vs Array）
2. `/api/watch/stream` SSE 推送顺序（是否每次重新 hydrate 推全量 / 是否增量推）
3. UI render events.map 是否用稳定 key（key={index} = unstable / key={record.id} = stable）

**修复**：

- events 排序 key 用 strictly stable（按 lastUpdatedAt desc / fallback createdAt desc / fallback id 字典序）
- SSE 推送如重复推 hydrated record 改增量
- UI key 用 record.id 不用 index

### 2.3 Task C — Preview 实测稳定性验证（验收门槛）

Codex 完成 Task A + B 后必须**多次实测**：

- 同一 URL 连续 fetch `/api/watch/timeline` 5 次，确认 events 数量稳定 + symbol 分布稳定 + record id 不重复
- 打开 preview 浏览器多次刷新（≥5 次），确认 UI 渲染 records 顺序稳定 + 无重复
- 在多 locale 重复验证

报告必含每次实测结果（events 数量 / symbol 列表 / 顺序 hash）。

### 2.4 Out-of-Scope

- 不动 PM pipeline / evidenceDispatcher / memoryLoopEvidence
- 不撤 hotfix-1/2/3 改动
- 不上 prod
- 不擅自重构 timeline / stream API（仅修去重 + 排序）

---

## § 3 Edge Cases

### 3.1 调研

- 如 Codex first-hand 发现 events 本身就两条 BILL（不是 UI 问题，是数据问题）→ 在 timeline projection 层去重
- 如 events 是 HYPE+BILL（数据 OK）但 UI render 两条 BILL → UI render 去重
- 如多次 fetch 返回不同 events → KV 状态在变化（cron / user-trigger / hydration race），需稳定快照

### 3.2 排序

- events 同时间戳 record → 排序 key 必须含 tie-breaker（id / symbol）
- SSE stream 推送：如老 connection 维持，event 顺序应单调；新 connection reload events 应稳定

---

## § 4 Assumptions

1. Codex 不再按 F 推测盲修（hotfix-1/2/3 教训），first-hand 实测后基于真实根因修
2. hotfix-3 hydration 三机制保留但加去重，不撤
3. multi-locale i18n 不影响 events 数据层

---

## § 5 Measurable Success Criteria

### 5.1 Task A 重复 record

- ✅ `/api/watch/timeline` events 中**无重复 record**（按 record id / symbol+round 唯一）
- ✅ UI 工作台**无重复 BILL / 重复任何 symbol 卡片**
- ✅ Codex 报告含 root cause first-hand 因果链

### 5.2 Task B 顺序稳定

- ✅ 同 URL 连续 fetch 5 次 events 顺序**完全一致**（hash 相同）
- ✅ Preview 浏览器刷新 5 次 UI 顺序**稳定**
- ✅ Codex 报告含排序 key 设计 + 实测稳定性截图 / log

### 5.3 Task C 实测稳定性

- ✅ 多次实测报告 commit 进 PR
- ✅ 报告含 5 次连续 fetch events 数量 / symbol / 顺序 hash
- ✅ 报告含浏览器多次刷新 UI 截图（或 vercel curl 等价）

---

## § 6 实施流程

### 6.1 单 PR 三 task 串行

1. Codex 拉新 worktree
2. Task A 调研 + 修 dedupe → commit
3. Task B 调研 + 修 order → commit
4. Task C 多次实测 → 报告 commit
5. PR 推 → preview → 给 F → F 给 Dan 验收

### 6.2 关键纪律

- 调研 first → 实测 → 基于实测真因修（不盲信 F 推测）
- 报告 commit 进 PR（hotfix-1/2/3 经验）
- 单 PR 优先，如 first-hand 发现需要分阶段允许多 PR（同 hotfix-3 演进规则）

---

## § 13 不能做

1. 不动 PM pipeline / evidenceDispatcher / memoryLoopEvidence
2. 不撤 hotfix-1/2/3 改动（demo fallback 关 / watch-only badge / hydration backfill 保留）
3. 不擅自改 candidate ranking
4. 不上 prod
5. 不按 F 推测盲修，必须 first-hand 实测
6. 不只 unit / build 验证，必须含**多次实测稳定性** report
7. events 排序 key 不能用 random / Map 迭代顺序（必须 strictly stable）
8. UI events key 不能用 index（用 record.id）

---

## § 14 Constitution 对照检查

| Rule              | Check                                     | 答   |
| ----------------- | ----------------------------------------- | ---- |
| Rule 1 部署身份   | 全 preview                                | PASS |
| Rule 2 v0.1.2     | preview 自由 / prod 不动                  | PASS |
| Rule 3 视觉与品牌 | 修去重 + 排序 = bug fix 不动 UI 结构      | PASS |
| Rule 4 schema     | 不动 schema                               | PASS |
| Rule 5 AI 诚实性  | 修产品级 bug（重复 / 跳动 = 不诚实）      | PASS |
| Rule 6 协作闭环   | 单 PR + 调研 + 实测 + F 双脑              | PASS |
| Rule 7 验证门槛   | § 5 含 measurable + 多次实测稳定性 report | PASS |

---

## § 16 老板简报

claw42 工作台修复 4。本次做了啥：发现工作台同一币种重复显示、卡片顺序每次刷新都变。修通去重逻辑和稳定排序，每个币种只显示一次，顺序固定不再跳动。多次刷新验证体验稳定后才算完成。后续规划：稳定后恢复多 Agent 戏剧化和决策仪式感工作。

---

## § 17 Anti-Rationalization

| 逃逸路径                        | 为什么不行                                          | 正确做法                                        |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| 按 F 推测盲修                   | hotfix-1/2/3 三次 F 推测都被部分修正                | first-hand 实测确认真因再修                     |
| 跑 verify 套件全过就 ship       | 静态测试通过 ≠ 多次刷新稳定                         | Task C 必须含多次实测 stability report          |
| 修一层（如 UI 去重）就以为完了  | 重复来源可能在 hydration / projection / stream 多层 | 调研三层都查，定位真层                          |
| 排序用 timestamp 但不处理 tie   | 同时间戳两条记录顺序仍 unstable                     | tie-breaker 必须有（id / symbol 字典序）        |
| 单元测试只测 5 records 不测 100 | 边界条件触发不到                                    | 测试覆盖空 / 1 / 多 / 全同时间戳 / 重复 id 场景 |

---

## § 18 Decision-Log 联动

完成后追加：

```
[2026-05-16 深夜+] [架构] B.13 hotfix-4：duplicate dedupe + stable order
[2026-05-16 深夜+] [流程] B.13 hotfix 链验收教训：spec § 5 必含多次实测稳定性
```

---

## § 19 Tasks 索引

| Task  | Priority | Story                                                                            |
| ----- | -------- | -------------------------------------------------------------------------------- |
| T-A.1 | P0       | first-hand 查重复 record 真根因（timeline / projection / hydration / UI 哪层）   |
| T-A.2 | P0       | 修去重（在 first-hand 确认的真层）                                               |
| T-A.3 | P0       | 测试覆盖去重 edge cases（空 / 1 / 多 / 全同时间戳 / 重复 id）                    |
| T-B.1 | P0       | first-hand 查排序 key（events / stream / UI 三处）                               |
| T-B.2 | P0       | events 排序 key 改 strictly stable（lastUpdatedAt desc + tie-breaker id 字典序） |
| T-B.3 | P0       | UI events.map key 用 record.id 不用 index                                        |
| T-B.4 | P0       | SSE stream 推送如重复推 hydrated record 改增量                                   |
| T-C.1 | P0       | 多次 fetch /api/watch/timeline 5 次稳定性实测 + 报告 commit                      |
| T-C.2 | P0       | 浏览器多次刷新 UI 稳定性实测 + 截图 + 报告 commit                                |
| T-C.3 | P0       | build / typecheck / lint / test 全过                                             |

P0 = 10 / 总 10。

---

_版本：v1.0 (2026-05-16 深夜紧急 hotfix-4)_
