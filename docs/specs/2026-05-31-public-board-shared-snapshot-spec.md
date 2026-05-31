# Spec: 公开分析板块共享快照架构（KV 配额根治）

状态：DRAFT v1 待 Codex 碰撞审核 → F 锁 → 全量执行
作者：Session F（架构）
日期：2026-05-31
关联：round52 诊断（根因=Upstash 500k 配额耗尽 / N=2 复发）+ round53 架构确认（codex-to-claude.md PHASE-X.kv-quota-arch-confirm）+ decision-log §3949-3961（首次 2026-05-26）
Dan 指令：分析+方案完整碰撞后直接做，整套做完一次性验收。

---

## 1. 灵魂句

公开分析板块是所有用户看同一份的共享内容，就该**算一次、存一份快照、缓存喂所有人**——数据库消耗和访问量脱钩，而不是每个访客每次轮询都重算重读一遍。

## 2. 根因（round52+53 确认）

直接故障 = Upstash 月度 500k 请求配额耗尽（`ERR max requests limit exceeded`）。**持久根因 = 设计被违背**：数据是全局共享状态，但服务层按"每用户动态数据"实现——`force-dynamic` + 每请求全量索引维护 + 逐卡读 + 每连接 SSE 每 0.5s 轮询 + 每卡关注数读。KV 成本 ∝ 用户 × 分钟 × 卡数。N=2 复发（5/26 已栽同一根因，当时只修写入侧没修读取侧）。

### 2.1 Codex round53 实测命令账（消费端证据，非估算）

- timeline 单请求 ≈ `M + R + N + E + J + 5`。M=320（当前索引）→ **每请求 340-455 次 KV 命令**（主凶 = prune 每请求 `zrange(0,-1)` 全扫 320 条 + 逐条读）。
- SSE `/api/watch/stream`：每连接每 0.5s 读版本，55s 内 ~110 次/分钟/用户；变更时再拉整份 payload → 一个在看用户光这条流 ~560 命令/分钟。
- follow-stats：每卡 3 命令 × 15 卡 = 45/轮，市场页 ~90/分钟/用户。
- 合计：一个用户开着板块 ≈ 600-1000+ KV 命令/分钟。几个并发即烧穿 500k/月。

### 2.2 共享 vs 按用户切分（Dan 核心问题，round53 确认）

- **真共享**（所有访客字节级相同，可做一份快照）：timeline `events / evidenceMap / oldestTs / hasMore / totalCount / residentStatus`、`pm_decision` 全字段、SSE 的 timeline 数据、history / decision-history / team-track-record（按 query+locale 共享）、关注**计数** watchCount/followCount。
- **真按用户**（量极小）：关注**状态** userFollowed（anon cookie + sismember）、anon cookie、follow POST/intent/callback/订单审计、每 IP 限流。
- 结论：烧额度的重头（timeline+stream）100% 共享 → 一份快照可服务所有人；按用户的只剩 follow 状态 + 动作，零头。**Dan 的设计成立，只是没实现。**

## 3. 方案总纲

读取侧从"每请求重算"改成"读一份共享快照 + CDN 缓存"，维护活全部移出请求路径，按用户的零头单独留小动态。分两段交付（一个版本候选，Dan 末端一次验收）。

---

## 4. Phase 1 — 止血（低风险、砍主凶、可独立先稳）

| ID   | 改动                                                                                                                                       | 目的                                           | 风险                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------- |
| P1.1 | **把 `prunePublicCardIndexByStrategy` 从 timeline GET 路径删除**，bounded prune 只在 cron/写入路径跑                                       | 砍掉每请求全扫 320 条索引（单请求 -320~ 命令） | 低（prune 仍在 cron 跑，索引照样维护） |
| P1.2 | **降级不报错**：timeline/stream 读 KV 抛错时吐"上一份好的"或合法空载（`residentStatus: degraded` + 明确"数据更新中"），**绝不空 body 500** | 板块不再看着像坏的；存储抖动有兜底             | 低                                     |
| P1.3 | **收住自动刷新**：去掉每访客 load 后自动 POST `/refresh`（走锁 + readAllDecisionRecords）；改成单一共享 freshness 检查 / 一个全局触发      | 砍掉每用户的 refresh 扇出                      | 中（改前端触发逻辑）                   |
| P1.4 | **SSE 临时降频**：500ms 版本轮询临时调到 5-10s + 限连接时长；或 Phase 1 先关公开 SSE 退回缓存短轮询                                        | 防 SSE 这条第二大烧穿源继续跑                  | 中                                     |
| P1.5 | **用量监控+预警**：KV 命令用量埋点，到月配额 60%/80% 报警（撞顶前介入）                                                                    | 让"不再发生"从口头变机制                       | 低                                     |

P1.1+P1.2 落地即大幅降耗 + 止 500，板块能转。

## 5. Phase 2 — 治本（共享快照架构，消耗与流量脱钩）

| ID   | 改动                                                                     | 说明                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2.1 | **建显式公开快照存储** `publicTimelineSnapshot:{locale}:{window}:{page}` | 含 `generatedAt / version / events / evidenceMap / residentStatus / 分页 meta / sourceHealth`。**新数据契约**——cron/写入路径每刷新周期写一次（原子换：写新 key + 指针翻转，读者不见半成品）                                                   |
| P2.2 | **timeline GET 改为读快照 + CDN 缓存**                                   | cache miss 时一次快照读，命中 0 KV。去 force-dynamic/no-store，挂 `Cache-Control: public, s-maxage=30-90, stale-while-revalidate=300-900`。**去掉/分桶 `before=Date.now()` 高基数缓存键**（只缓存默认 window + page1 热键，深翻页留廉价动态） |
| P2.3 | **SSE 重写**                                                             | 不再每连接每 0.5s 打 KV；读共享快照版本（内存/单一共享）推下去，或换成缓存短轮询。推共享快照不是每连接读库                                                                                                                                    |
| P2.4 | **关注数拆分**                                                           | 共享计数 watchCount/followCount 进快照或单独缓存计数块；userFollowed 只在交互时查 / follow 动作后客户端本地推导。follow-stats GET 不再每轮 3×N KV                                                                                             |
| P2.5 | **history / decision-history / team-track-record 加缓存**                | 按 query+locale 共享，分离 debug/auth 分支后挂 CDN/runtime 缓存                                                                                                                                                                               |
| P2.6 | **写侧降级**                                                             | cron 存不进去时 fail-closed（别把 LLM token 花进非持久内存），emit 降级状态 + 报警                                                                                                                                                            |

## 6. 兜底机制（贯穿两段）

1. **降级态**：存储故障 → 吐 last-good 快照，UI 显"数据更新中"，绝不 500。
2. **首次无快照**：快照未生成时读 → 合法空载 + degraded，不 500。
3. **写侧 fail-closed**：cron 存不进就停，不空烧 + 报警。
4. **容量层**：上面做完消耗与流量脱钩后，复评 free 500k 是否够（应够：成本≈每周期快照写+缓存填，非每访客）。作为显式决策记录，不当创可贴。
5. **监控**：真实 KV 用量曲线 + 阈值报警（P1.5），这是防 N=3 的机制层。

## 7. 五维碰撞（F 自检，待 Codex 复核）

1. **计算时序**：快照 cron 先写、请求后读；读早于首份快照 → 走兜底空载/degraded 不 500。cache miss → 单次快照读。无循环依赖。
2. **同类竞争**：多 cron / 并发写快照 → 必须写锁 + 原子换（写新 key + 指针翻转），读者永不见半成品。复用现有锁原语。
3. **跨层碰撞**：CDN 缓存有效期 vs 快照刷新周期必须对齐（s-maxage≈cron 间隔，stale-while-revalidate 兜过渡）；SSE 必须读同一份快照版本，不和缓存 timeline 漂移。
4. **修饰叠加**：10 locale × window × page 快照键基数 → 只缓存热键（默认 window+page1），`before=now` 必须去高基数化，否则缓存形同虚设。
5. **人类认知**：degraded 态（数据更新中）/ 真数据 / 错误三者 UI 必须可区分；用量报警要可操作。

## 8. Edge Cases（4 轴）

- 输入：超界 window/page、before=未来/过去、未知 locale → 边界钳制（现有逻辑保留）。
- 状态：首次冷启无快照 / 快照过期 / 存储 degraded / cron 半成 → 全部走兜底吐 last-good 或 degraded，不 500。
- 边界：快照原子换瞬间的读 → 读到旧版完整快照（非半成品）。
- 失败：KV 抛错 / 超时 / 配额满 → 降级不报错 + 报警。

## 9. 可量化验收（机制非纸面账）

1. **流量脱钩实证**：N 个模拟在看用户下，KV 命令/分钟 ~平（不随 N 线性涨）。这是两次都缺的"消费端验证"，必须做。
2. timeline 单请求 KV 命令：缓存命中 0、miss ≈1（快照读），不再是 340-455。
3. SSE：不再每连接每 0.5s 打库。
4. claw42.ai 板块：冷启快、内容新鲜、无 500、hover 简报出真摘要。
5. 用量报警在阈值真触发（注入测试）。
6. 全套 format/typecheck/lint/build PASS + 焦点测试断言上述行为（消费端，非"改了字段"）。

## 10. Anti-Rationalization

- "只修 timeline 就够" → 不行，stream+follow-stats 是同级烧穿源，漏一个仍随流量泄漏（Codex round53 明确挑战）。
- "residentPrewarm 当快照" → 不行，它是预热计划/状态，不是响应缓存。单建快照存储，prewarm 只喂 residentStatus。
- "提额度就好" → 创可贴，不改架构第三次还满。
- "算份更准的额度账" → 正是栽两次的东西。要的是流量脱钩 + 真实用量监控，不是更准的纸面预测。
- "缓存挂上就完事" → `before=now` 高基数键会让缓存命中率≈0，必须去高基数化才真生效。

## 11. 任务拆分（Codex 执行，Phase 顺序）

- T1[P1.1] 删 GET prune，迁 cron 维护
- T2[P1.2] timeline/stream 降级不报错
- T3[P1.3] 收自动刷新触发
- T4[P1.4] SSE 临时降频/关
- T5[P1.5] KV 用量埋点+报警
- T6[P2.1] 快照存储数据契约 + 写入（原子换+锁）
- T7[P2.2] timeline 读快照 + CDN 缓存 + 去高基数键
- T8[P2.3] SSE 重写读快照
- T9[P2.4] 关注数拆共享/按用户
- T10[P2.5] history/decision-history/team-track-record 加缓存
- T11[P2.6] 写侧 fail-closed
- T12 验收：负载下 KV 命令脱钩实证 + 消费端断言 + claw42.ai 实拉

## 12. 部署 / 验收

- 全套做完 → 双变体部署（A claw42 prod-build --skip-domain 不 promote / B coinw preview）。
- F 验消费端（§9 全项，重点流量脱钩实证）→ present 给 Dan 一次性验收 → **Dan 字符级 promote**（高风险闸不变）。
- 新数据契约（快照存储）= 高风险，spec 经 Codex 碰撞审核 + Dan 末端验收。

## 13. Codex 碰撞审核确认点（round54 已审，结论见 §14）

1. 快照存储契约字段/键设计是否完整、原子换用什么原语。
2. SSE 重写具体路径（读内存共享版本 vs 缓存短轮询），连接数成本。
3. CDN 缓存在 Vercel 的落地方式（route segment config / headers / Edge），`before=now` 去高基数化的具体做法。
4. P1 与 P2 的依赖/回滚边界（P1 能否独立先稳、P2 是否必须一起上）。
5. follow 计数进快照 vs 单独缓存块，哪个耦合小。
6. 五维碰撞复核 + 漏的耦合。

---

## 14. v2 锁定执行契约（整合 round54 Codex 碰撞审核 — 本节为执行权威，与上文冲突以本节为准）

round54 判定：方向认同不重碰，补硬执行契约后可锁。以下全部采纳 + 锁定。

### 14.1 快照数据契约（锁定）

KV 键：

```
claw42:public-timeline-snapshot:v1:{locale}:{windowMinutes}:{page}:{version}      # versioned blob
claw42:public-timeline-snapshot-current:v1:{locale}:{windowMinutes}:{page}        # 指针
claw42:public-timeline-snapshot-last-good:v1:{locale}:{windowMinutes}:{page}      # 兜底
lock:public-timeline-snapshot:v1:{locale}:{windowMinutes}:{page}                  # 写锁
```

- **指针值**：`{ version, snapshotKey, generatedAt, expiresAt, sourceHealth }`
- **blob 字段**：`{ version, generatedAt, locale, windowMinutes, page, pageSize, totalCount, oldestTs, hasMore, nextPollMs, events, evidenceMap, residentStatus, sourceHealth, snapshotStatus }`
- **snapshotStatus enum**：`fresh | stale | degraded | empty`
- **原子换原语**（不需要 Redis multi）：持写锁 → 写 versioned blob → schema/size 校验 → 单次 `set(currentPointer)` 翻指针 → 更新 last-good。**失败绝不翻 current。**
- **读路径**：`get(pointer) → get(blob)`；指针/blob 缺失 → 读 last-good → 再缺 → 合法 empty/degraded。**绝不 500。**
- **size budget**：blob 设上限（page=15 正常），超限告警并裁剪到合规，不写超大 blob。

### 14.2 与现有存储共存（不删）

`publicCardIndex` / `decisionRecordStore` 保留作写侧 projection/backfill 源。timeline GET **snapshot first**，debug/admin 或 snapshot miss 可短期 fallback index（受 §14.6 监控约束）。GET 路径**删除** `prunePublicCardIndexByStrategy`（`publicTimelinePayload.ts:241`）+ `schedulePublicCardIndexBackfill`（`:414-416` 空索引触发）。index cleanup 变 bounded/locked 留写侧（`decisionRecordStore.ts:439-479`）。

### 14.3 SSE：关闭 public SSE（锁定，替代原 P1.4 降频）

"读内存共享版本"在 Vercel serverless 多实例下不是共享态、会每实例漂移；靠 KV 查版本则每连接成本回来。**本轮直接关 public SSE**（`stream/route.ts` 的 public 路径；保留 debug/thread SSE no-store）。主页面改 snapshot `nextPollMs` 轮询，间隔 60-90s 且命中 CDN。真要推送另开 WebSocket/PubSub 方案，不在本次配额根治引入。

### 14.4 Vercel 缓存头 + 前端配合（锁定）

timeline public 200 响应：

```
Cache-Control: public, max-age=0, must-revalidate
Vercel-CDN-Cache-Control: public, s-maxage=60, stale-while-revalidate=300
Vary: Accept-Language   # 若 locale 来自 query 且 canonical 可免 Vary
```

- 可缓存前提：请求无 Authorization、响应无 set-cookie、Cache-Control 无 no-cache/no-store/private、状态可缓存。
- `diagnostics=storage` / debug / 400/403/429 / auth/operator 分支一律 `no-store`。
- **前端必须移除 `AgentWatchBoard.tsx:302-305` timeline fetch 的 `cache: "no-store"`**（否则 CDN 命中不了）。
- **`before=Date.now()` 从 hot path 移除**：默认 page1/window 不接受客户端 `before` 作缓存键；快照自带 cutoff/generatedAt。历史翻页用 `page` 或离散 cursor，不用每毫秒高基数 before。
- locale/window/page/pageSize **白名单 canonicalize 后再进 key**（防 cache poisoning）。

### 14.5 follow 计数拆分（锁定）

共享 `watchCount/followCount` 做**单独 cached count block**（按 recordId 集合或 snapshot version 生成，TTL 60-300s）。timeline snapshot 可内嵌生成时 count 初值，但 follow POST 只更 count block/局部响应，**不触发 timeline 快照重写**。`userFollowed` 留按用户态：页面初次不查，点击后本地推导；必须展示时只查少量 visible record，**取消 30s 对 15 卡全量轮询**。

### 14.6 监控（锁定，不耗 KV）

**监控不许每请求写 KV 计数**（否则加重消耗）。用 route-level estimated command budget + Vercel log/alert + 低频聚合 / 外部监控。到月配额 60%/80% 报警。**废弃/更新旧 `diag/budget` 的 34 commands/page 过时估算。**

### 14.7 写侧 producer 覆盖 + coalesce（锁定）

快照重建在**写侧 coalesce**，不是每张卡同步重建。必须覆盖全部 public record 写入点：`runSimplePipeline`（写完即 return 那条别漏）、`appendDecisionRecord` / `upsertKvRecord`（→ `writePublicCardStorage`）、resolution/manual close、cron replay。

### 14.8 兜底与 UI 诚实性（锁定）

CDN 允许 60s stale 可接受，但 **UI 必须显示 `generatedAt/snapshotStatus`**，degraded/stale 不许冒充 live（Constitution Rule 5）。KV/Redis snapshot 是 canonical 唯一事实源；Vercel Runtime Cache 只能做区域辅助层。

### 14.9 P1/P2 回滚边界（锁定）

P1 独立止血最小集 = 去 GET prune/backfill + 不 500 降级 + 关 public SSE + 收自动 refresh。本轮按 Dan 要求**整套一次候选**，但 commit/报告保留回滚单位：P1 能先稳；P2 快照化若 CDN/header 出问题，可回滚到"无 SSE + bounded GET fallback + no 500"的 P1 稳态，**不退回当前烧额度实现**。

### 14.10 任务顺序（锁定，替代 §11）

- T0 spec governance：本节 §14 + §14.11 Constitution 对照（已含）
- T1 快照 store + 原子指针 + last-good + 单测
- T2 producer/coalescer：现有 index/record 产物写成 snapshot + 一次性 backfill
- T3 timeline route 读 snapshot + 降级不 500 + cache headers + 去 before=now + debug/diag no-store
- T4 移除 GET prune/backfill，写侧 bounded/locked maintenance
- T5 前端移除 timeline no-store + 关 public SSE + 改 snapshot polling
- T6 收自动 refresh（不让每访客 POST refresh）
- T7 follow counts 拆 shared count block + userFollowed 动作态
- T8 history/decision-history/team-track-record 加缓存
- T9 写侧 fail-closed + 非 KV 重的 alert
- T10 流量脱钩 simulation + command-budget 断言
- T11 format/typecheck/lint/build/focused tests + preview deploy
- T12 候选实拉 + Dan promote 命令
- **可并行**（合同冻结后）：T1 / T3 cache tests / T7 / T8 / 监控测试。**不可并行**：`publicTimelinePayload`/timeline route/AgentWatchBoard 共享文件写改；producer 与 route consumer 须先冻结 snapshot type。

### 14.11 §14 Constitution 对照（claw42 constitution 强制）

- Rule 1 部署身份：执行/部署前读 registry + `docs/deployment-identity.md`。
- Rule 2 prod 保护：preview only + **Dan 字符级 promote**；Tier 1 不触碰。
- Rule 3 视觉品牌：除 degraded/stale copy 外不改 v9 视觉。
- Rule 4 数据/schema：新增 snapshot 数据契约（§14.1）；不碰 NewsItem/SourceRegistry 等冻结 schema。
- Rule 5 行情诚实性：stale/degraded UI 不冒充 live（§14.8）。
- Rule 6 协作闭环：round52-54 audit writeback 已闭环。
- Rule 7 验证门槛：§9 + §14 验收命令（header / cache 命中 / alert 注入 / 流量脱钩 sim / 消费端断言 / 实拉 screenshot）。

### 14.12 验收补充（在 §9 上加具体命令）

- 缓存命中：实拉 timeline 看 `x-vercel-cache: HIT`（二次请求）+ 响应头符合 §14.4。
- 流量脱钩 sim：模拟 N 并发，KV 命令/分钟随 N 平（非线性涨）——这是两次都缺的消费端实证，硬验收项。
- alert 注入测试：人造逼近阈值 → 报警真触发。
- 前端 no-store 已移除（grep AgentWatchBoard）+ public SSE 已关（实拉无 EventSource）。
- claw42.ai 板块：冷启快、内容带 generatedAt、无 500、hover 出真摘要。
