# spec-watch-B10-deploy-topology-and-provider (v1.0 · 2026-05-15)

> **B.10 — 部署拓扑修复 + Provider 健康度修复 + Telemetry 观测**
>
> Codex 2026-05-15 prod 接入调研 5 反转后 Dan 拍板：当前 main HEAD `a63043fe` 已被 GitHub-Vercel 自动 deploy 到 claw42.ai prod（违反 Constitution Rule 2）+ 25 次 LLM call 全 fallback 到 DeepSeek（其他 3 provider 缺位 / 大小写错）。**B.10 不修 rollback，B.10 修部署拓扑 + Minimax key 大小写 + provider telemetry，让后续 Step 2/3 纪律恢复**。
>
> **核心范围**：
>
> - **P0 部署拓扑**：Vercel claw42-site 配置改为"main merge → preview only，明确 --prod 才 deploy prod"
> - **P1 MINIMAX_API_KEY 大小写修**：env var rename `Minimax_API_KEY` → `MINIMAX_API_KEY`（让 minimax provider 真接入）
> - **P2 Provider telemetry**：每角色实际走哪个 provider + fallback 实际占比埋点
> - **P2 Fallback 占比 gate**：单 provider 占比 ≥ 阈值时 verify gate alert（不强制 fail，先观察）
>
> **不在范围**：
>
> - Anthropic / OpenAI key 配置（Dan 拍仅修 minimax，其他留后续）
> - Provider routing 重构（保持现有 chain 不动）
> - prod rollback（保留 `a63043fe` 作 A 线终态 reference）
> - 数据源接入 / 行情接入 / news 接入（已接，不动）
> - A 线视觉改动（v10 owned 不动）
>
> **架构定位**：B 模块完成后的运维 / 观测 / 部署纪律修复 phase。base main HEAD = `a63043fe056d5275ec50f58fe643fdb36d2556dc`。
>
> **决策档案**：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md` 2026-05-15 entry 详细记录反转 + Dan 拍板。

---

## 0. 必读纪律

### 0.1 三层防御

- **层 1 跨域刷新**：动 Vercel 配置前 cat 实测 `vercel.json` + 当前 production branch 设置；动代码前 cat 实测 provider chain 实现
- **层 2 首件检验**：Vercel 配置改完后先确认一次 main merge → preview only（不 prod）实际生效，再做后续任务
- **层 3 同根因熔断**：同类配置错连续出现 2 次 → 停 + 退到 Vercel project settings 全量 dump 重做

### 0.2 双脑诊断

Codex 实施前必须自己下判断 + 写到 codex-to-claude.md（§ 18 列必填判断点）。

### 0.3 Anti-rationalization

- "Vercel 配置 Codex 没权限改我就让 Dan 改吧" → ❌ Codex 先 verify Vercel CLI / API 能不能改，不能时再报 F + 给 Dan 操作步骤（不是默认 punt 给 Dan）
- "MINIMAX_API_KEY 大小写改一下顺便重构 provider routing" → ❌ scope 越界，B.10 仅修大小写
- "telemetry 加上 fallback 占比 gate 顺便设硬 fail 阈值" → ❌ P2 仅观察 + alert，不强制 fail（避免 prod / staging 立即跑挂）
- "prod 已经被 deploy `a63043fe` 不如顺便 rollback" → ❌ Dan 拍不 rollback，B.10 保留 prod 现状
- "Anthropic / OpenAI key 顺便配上反正小事" → ❌ Dan 明确拍仅修 minimax，其他留后续 + 涉及公司 procurement

---

## 1. Summary

修当前 main HEAD `a63043fe` 已暴露的三个运维问题：

1. **部署纪律失控**：GitHub merge auto-deploy prod 绕过 Constitution Rule 2 → Vercel 配置切 main → preview only
2. **Provider 配置错**：`Minimax_API_KEY` 大小写不匹配 → minimax fallback → 修大小写
3. **观测盲区**：25 次 LLM call 全走 DeepSeek 没人知道 → 加 telemetry 让 fallback 占比可见

**用户感知层**：B.10 不带新功能，纯运维。用户层无可见变化（决策仍跑、prod 仍是当前版本）。但内部：

- Dan / F 后续可以信心 merge main 而不怕意外上 prod
- Minimax 修后 25 次 LLM call 多一个 provider 候选（部分角色按 `defaultProvider` 真路由到 minimax 时不再 fallback DeepSeek）
- Provider telemetry 让 Dan / F 看到"实际每次跑了什么"

---

## 1.5 User Stories

### US-B10-1 — 部署纪律恢复（P0）

**作为** Dan / F session
**我希望** main merge 不再自动 deploy 到 claw42.ai prod，明确 --prod 命令 + 显式指令才动 prod
**这样** 后续 Step 2 / Step 3 iteration 时可以信心 merge main 进 staging preview，不怕意外影响真用户

### US-B10-2 — Minimax provider 真接入（P1）

**作为** 后端 pipeline
**我希望** Minimax API key 大小写匹配代码读取期望
**这样** Minimax provider 真接入 LLM call chain，不全 fallback 到 DeepSeek

### US-B10-3 — Provider 实际路由可见（P2）

**作为** Dan / F session 想看 prod / staging 实际 LLM 跑成什么样
**我希望** 每次 pipeline 跑后能看到：每角色实际走哪个 provider，多少次 fallback，单 provider 占比多少
**这样** 后续 Anthropic / OpenAI key 是否要加 / 质量是否打折，有数据支持决策

---

## 2. Acceptance Scenarios

### AC-B10-1 — Vercel main → preview only

**Given** main 有新 commit merge（如 B.10 PR squash）
**When** Vercel git integration 触发
**Then** 仅生成 preview deployment（URL 含 hash + branch name），**不更新 production**
**And** claw42.ai prod 仍保持上一个明确 --prod deploy 的版本不变

### AC-B10-2 — 明确 --prod deploy 才更新 prod

**Given** Dan / F 决定上 prod
**When** 跑 `npx vercel --prod` 命令
**Then** 触发 production deploy，claw42.ai 切到新 commit
**And** 命令日志显示 `Production: https://claw42.ai`

### AC-B10-3 — MINIMAX_API_KEY 修正后 minimax 真接入

**Given** Vercel preview / prod env var 改名 `Minimax_API_KEY` → `MINIMAX_API_KEY`
**When** pmDecisionPipeline 跑 + 某角色 `defaultProvider = minimax`
**Then** 调用走 minimax provider，不 fallback DeepSeek
**And** Provider telemetry 报告显示该次 call 真走 minimax

### AC-B10-4 — Provider telemetry 可读

**Given** 一次完整 pipeline run（25 次 LLM call）
**When** 跑完后 query telemetry endpoint / 日志
**Then** 看到每角色 attempted provider chain（如 `[deepseek, minimax, fallback_deepseek]`）+ 最终成功 provider + 总 fallback 次数
**And** 单 provider 占比统计可见（如 "DeepSeek: 80% / Minimax: 20%"）

### AC-B10-5 — Fallback 占比 alert

**Given** Telemetry 显示单 provider 占比 ≥ 90%
**When** verify gate / cron run-status 检查
**Then** alert log 输出（不 fail gate）：`"Single provider concentration: deepseek 95% (threshold 90%)"`

---

## 3. Edge Cases 4 轴

| 轴       | Edge Case                                                      | 处理                                                                                                                      |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Input    | 老 `Minimax_API_KEY` env var 还在（同时存在新旧两个）          | 代码仅读 `MINIMAX_API_KEY`，老 var 留 Vercel env 仅作历史（B.10 完成后 Dan 清理）                                         |
| State    | Vercel main → preview only 切换瞬间正好 main 有新 commit merge | 该 commit 仍触发一次 preview（不触发 prod），prod 保持 `a63043fe`                                                         |
| State    | Codex Vercel CLI 无权改 project settings                       | T010 先 verify CLI 能力；不能时 stop + 给 Dan UI 操作 step-by-step 指南                                                   |
| Boundary | Telemetry 在 cron run 期间 KV write 失败                       | telemetry write 用 try/catch，失败 dev warn，不阻塞 pipeline                                                              |
| Boundary | Fallback 占比 0% / 100% 单端边界                               | alert threshold 仅看 ≥ 90% 单 provider；占比 0 表示该 provider 没参与，不 alert                                           |
| Failure  | Vercel 配置改完后 prod 意外被 redeploy                         | 立即 stop + 报 F + 不擅自 rollback；Dan 拍 next step                                                                      |
| Failure  | MINIMAX_API_KEY rename 后 minimax provider 仍 fail             | provider 本身可能不健康 / quota 满 / 网络问题；fallback chain 继续走 DeepSeek，不 panic                                   |
| Failure  | Telemetry 报告 25 次 call 全成功但全 fallback 到 DeepSeek      | symptom 是 fallback 逻辑设计本身有问题（如 defaultProvider 路由没生效），B.10 不修，记录到 codex-to-claude.md 留后续 spec |

---

## 4. Assumptions

1. base main HEAD = `a63043fe056d5275ec50f58fe643fdb36d2556dc`（B.9 PR #94 squash merge）
2. claw42.ai prod 当前 = `a63043fe`（GitHub-Vercel 自动 deploy）
3. Vercel project = `claw42-site`，account = `agentxmain-collab`
4. Vercel git integration 当前配置 = main → production（B.10 P0 改这个）
5. `Minimax_API_KEY` 当前在 Vercel preview + production env 都配错大小写
6. Codex 用 `agentxmain-collab` Vercel CLI 已 login（B.9 时验证过）
7. 不动主 worktree 30+ WIP
8. Constitution Rule 2 双 prod 锁定保留（Dan 2026-05-15 拍）
9. provider chain fallback 逻辑现状不动（B.10 不重构 routing）
10. DeepSeek 是当前唯一健康 provider，作 fallback last-resort

---

## 5. Measurable Success Criteria

| ID       | 指标                            | 测量方法                                                                                                                               | 阈值                                                          |
| -------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| SC-B10-1 | Vercel main → preview only 生效 | T020 完成后 trigger 一次 main merge（如 docs commit），看是否仅生成 preview，无 prod deploy                                            | prod URL 仍是上次 --prod 的 commit；preview URL 显示新 commit |
| SC-B10-2 | MINIMAX_API_KEY 大小写修复      | Vercel env list grep `MINIMAX_API_KEY` 命中（不是 `Minimax_API_KEY`）                                                                  | 命中 1，老 var 可保留作 backup                                |
| SC-B10-3 | Provider telemetry 写入         | 一次 cron run 后 telemetry KV / 日志含每角色 provider + fallback 数据                                                                  | 25 角色 × telemetry 字段全覆盖                                |
| SC-B10-4 | Fallback 占比 alert             | Telemetry 包含 `single_provider_concentration` 指标 + alert log 触发条件正确                                                           | DeepSeek 当前 ≥ 90% → alert 应触发                            |
| SC-B10-5 | Constitution Rule 2 恢复        | 后续任何 PR merge 默认不 deploy prod；--prod 命令日志保留                                                                              | 0 次 unauthorized prod deploy（Step 2/3 期间）                |
| SC-B10-6 | 全 verify gate                  | typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news | 全 PASS                                                       |
| SC-B10-7 | A 线 reference 不动             | git diff origin/main -- src/modules/agent-watch/v10/\*\*                                                                               | 0（除了 telemetry 如需读上下文加 import 行）                  |
| SC-B10-8 | 工程量收敛                      | git commit 数 / AI 天                                                                                                                  | ≤ 5 commit / ≤ 2 AI 天                                        |
| SC-B10-9 | SPEC-FEEDBACK 收敛              | 第 1 轮 ≤ 2 minor                                                                                                                      | >2 或 P1+ → 立即停                                            |

---

## 6. 现状盘点（基于 Codex 2026-05-15 调研）

### 6.1 已实施 / 不动

- claw42.ai prod 部署：main HEAD `a63043fe`（自动 deploy 的状态）
- LLM provider chain：DeepSeek 真接入 + Minimax 大小写错 + Anthropic / OpenAI 未配
- cron `/api/cron/strategy-replay` 真触发 pipeline
- pmDecisionPipeline 25 次 LLM call（11 输入 × 2 round + research + risk + pm）
- KV 数据路径默认走真路径（`STAGING_USE_FIXTURE` 未配）

### 6.2 B.10 工作（缺口）

- ⚠️ Vercel main → production auto-deploy 配置（需改为 preview only）
- ⚠️ `Minimax_API_KEY` env var 大小写
- ⚠️ Provider telemetry 不存在
- ⚠️ Fallback 占比观测 / alert 不存在

### 6.3 不动

- A 线 v10 视觉权威
- main HEAD 业务代码（除 telemetry 注入）
- prod 当前部署 commit `a63043fe`（保留，不 rollback）
- Anthropic / OpenAI key（Dan 拍后续处理）
- Provider routing chain fallback 逻辑（B.10 不重构）

---

## 7. 技术上下文

### 7.1 Vercel 部署拓扑改

**当前**：

- Vercel claw42-site project Git integration → production branch = `main`
- main 任何 merge 自动触发 production deploy

**B.10 目标**：

- Git integration production branch 改为某专用分支（如 `production-v1` 或 `release`），main 不再触发 prod
- 或：Disable auto-deploy from GitHub for production branch
- main merge 仅触发 preview deployment
- 明确 `vercel --prod` 命令才更新 production

**两个实施路径**：

- **路径 A（CLI 改）**：Codex 用 Vercel CLI `vercel project add` / `vercel git` 等命令改 production branch
- **路径 B（UI 改）**：F 给 Dan 详细 step-by-step Vercel UI 操作指南（Project Settings → Git → Production Branch），Dan 5 秒手动改

Codex T010 先 verify CLI 能不能做（具体 Vercel CLI 是否支持改 production branch / disable auto-deploy）；不能时 stop + 报 F 切路径 B。

### 7.2 MINIMAX_API_KEY rename

**当前**：Vercel env vars 列表 `Minimax_API_KEY`（大小写错），代码读 `process.env.MINIMAX_API_KEY` 取不到。

**B.10 目标**：

- Vercel preview env 改名 `Minimax_API_KEY` → `MINIMAX_API_KEY`
- Vercel production env 改名同上
- 保留老 var 作 backup（Dan 后续清理）
- 代码不改（已经读 `MINIMAX_API_KEY`）

CLI 改：`vercel env rm Minimax_API_KEY preview/production` + `vercel env add MINIMAX_API_KEY preview/production` 配新值。

### 7.3 Provider telemetry

**当前**：pipeline 不留 provider 选择痕迹，看不到每次实际走哪个 provider / 是否 fallback。

**B.10 目标**：

- 在 LLM call wrapper 加 telemetry：
  - 输入：roleId, defaultProvider, fallbackChain
  - 输出：finalProvider, fallbackCount, latency, success/fail
- 写到 KV 或专用 telemetry log
- 单 provider 占比统计（每次 cron run 后聚合）
- alert log：单 provider ≥ 90% → console.warn + KV write `alert:single-provider-concentration`

**位置**：新文件 `src/lib/team/providerTelemetry.ts`（B owned）+ 在 LLM provider wrapper 调用点加埋点

### 7.4 Fallback 占比 gate

**轻量实现**：不强制 fail，仅 alert log。Codex 实施时设默认阈值 90%（可后续调）。

---

## 8. 数据流（不动 schema）

```
[base: a63043fe + B.10 修正]

GitHub merge main
   ↓
Vercel git integration (B.10 改为 main → preview only)
   ↓
Preview deployment（仅）
   ↓
（手动 vercel --prod 才触发 prod deploy）
   ↓
claw42.ai prod 更新

Cron `/api/cron/strategy-replay`
   ↓
runPmDecisionPipeline
   ↓
LLM call wrapper (B.10 加 telemetry)
   ↓ defaultProvider → fallback chain
   ↓ DeepSeek / Minimax (B.10 修后真接) / Anthropic (未配) / OpenAI (未配)
   ↓
providerTelemetry.write { roleId, finalProvider, fallbackCount, latency }
   ↓
KV / log

Periodic aggregator (cron 或同步) → 单 provider 占比统计 + alert log
```

---

## 9. 变更范围

### 9.1 新建

- `src/lib/team/providerTelemetry.ts`（telemetry helper + alert logic）
- 可能新建 `src/lib/team/__tests__/providerTelemetry.test.ts`

### 9.2 修改

- Vercel claw42-site project settings：Git production branch + auto-deploy 配置（**Vercel UI / CLI，不是 codebase 改动**）
- Vercel env vars：rename `Minimax_API_KEY` → `MINIMAX_API_KEY`（preview + production）
- `src/lib/team/llmProviderRouter.ts`（或当前 LLM call wrapper 实际位置，Codex grep 确认）：调用点加 telemetry 埋点
- `src/app/api/cron/strategy-replay/route.ts`：cron run 完成后调聚合器 + alert log
- 可能 `src/app/api/health/telemetry/route.ts`（新 endpoint 让 F / Dan query telemetry，可选）

### 9.3 删除

- 无

### 9.4 不动

- A1 owned v10 module 全部
- Constitution Rule 2 文本（保留双 prod 锁定，Dan 拍）
- main HEAD `a63043fe` 业务代码主体
- LLM provider routing chain fallback 逻辑
- prod 当前 deploy commit（不 rollback）
- Anthropic / OpenAI key 配置
- writer 文件（B.1 冻结 + B.9 解冻已收口，B.10 不动）

---

## 10. 依赖前置

- main HEAD `a63043fe` 含 B.9 PR #94 全部 merge ✓
- Codex Vercel CLI login = `agentxmain-collab` ✓（B.9 验证过）
- baseline verify gate 全过 ✓（B.9 报告确认）
- Codex 干净 worktree `/tmp/claw42-b10-deploy-topology-provider` 从 origin/main checkout
- 不动主 worktree

---

## 11. Tasks

### Phase 0 — Vercel CLI 能力 verify

- [ ] T-B10-001 worktree `/tmp/claw42-b10-deploy-topology-provider` + branch `feature/spec-b10-deploy-topology-provider` base `a63043fe`
- [ ] T-B10-010 [P] Vercel CLI verify: `vercel project ls` / `vercel git --help` / `vercel project list` 看是否能改 production branch / disable auto-deploy
- [ ] T-B10-011 [P] grep 实测：找 LLM call wrapper 实际位置（`src/lib/team/llmProviderRouter.ts` 或类似）+ defaultProvider 配置位置 + Minimax provider 实际 SDK / env var 读取行
- [ ] T-B10-012 双脑判断 Q-B10.1 写 codex-to-claude.md：CLI 能改还是要 Dan UI 改？telemetry 埋点最少改动方案？

### Phase 1 — P0 部署拓扑修

- [ ] T-B10-020 改 Vercel 配置（路径 A or B 按 T-B10-010 判断）：
  - 路径 A：`vercel project ...` CLI 命令切 production branch / disable auto
  - 路径 B：stop + 给 F 报 + 输出 Dan UI 操作步骤（精确 Vercel dashboard 路径 + 截图描述 + 验证步骤）
- [ ] T-B10-021 立即 trigger 一次 main merge 测试（如 docs commit 推 main）→ verify 仅生成 preview，prod 未变
- [ ] T-B10-022 报告：实际生效路径 + verify 输出 + Dan 可读的 "main → preview only 已生效" 确认

### Phase 2 — P1 MINIMAX_API_KEY 修

- [ ] T-B10-030 Vercel env 改名 preview env：`vercel env rm Minimax_API_KEY preview` + `vercel env add MINIMAX_API_KEY preview` 配新值（Dan 提供原 key value）
- [ ] T-B10-031 Vercel env 改名 production env：同上
- [ ] T-B10-032 redeploy preview verify Minimax provider 真接入（看 telemetry 后续验证 - 见 Phase 3）

### Phase 3 — P2 Provider telemetry + alert

- [ ] T-B10-040 新建 `src/lib/team/providerTelemetry.ts`：
  - `recordProviderCall({ roleId, defaultProvider, finalProvider, fallbackCount, latency, success })`
  - KV write (按现有 KV pattern) 或 log（Codex 自决，看 main 现有 telemetry / observability pattern）
- [ ] T-B10-041 在 LLM call wrapper 调用点加 `recordProviderCall` 埋点
- [ ] T-B10-042 在 `/api/cron/strategy-replay/route.ts` cron 完成后聚合 + 单 provider 占比统计 + alert log
- [ ] T-B10-043 单 provider ≥ 90% threshold + alert log 实施
- [ ] T-B10-044 可选：新 endpoint `/api/health/telemetry` 让 F / Dan query telemetry（如时间允许）
- [ ] T-B10-045 测试：providerTelemetry unit test + cron aggregator unit test

### Phase 4 — Verify + 报告

- [ ] T-B10-050 跑全 verify gate（typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news）
- [ ] T-B10-051 grep gate：A1 owned v10 0 diff（除 telemetry import 不可避免行）
- [ ] T-B10-052 grep gate：writer + cron resolution writer 调用 0 diff（B.9 收口后 B.10 不动）
- [ ] T-B10-053 部署 preview + verify telemetry 真写入 + alert 真触发（DeepSeek 当前 ≥ 90% 应 alert）
- [ ] T-B10-054 PR + review + squash merge（**不 --prod**，A 线 reference 保留；待 Dan 明确指令再 --prod）
- [ ] T-B10-055 报告 codex-to-claude.md + decision-log 联动 entry：B.10 完成 + telemetry 数据样本 + 部署拓扑生效确认

---

## 12. 约束

- 全程不动 A 线 v10 module（除 telemetry 调用如不可避免需加 import）
- 全程不动 prod 双线 deploy（保留 prod = `a63043fe` 不 rollback）
- 全程不动主 worktree
- 全程不动 writer + cron resolution writer 调用行（B.9 已收口）
- Anthropic / OpenAI key 不在 B.10 范围
- Provider routing chain 不重构
- Dan 拍仅修 Minimax，不擅自扩
- transient HTTP 502/503/504/timeout → retry 1-2 次；真阻塞 → 立即停 + 报告
- Codex Vercel CLI 无权改 production branch → 立即 stop + 给 Dan UI 操作指南，不擅自 punt 给 Dan 不给步骤
- ≤ 5 commit / ≤ 2 AI 天

---

## 13. 不能做清单

- ❌ 不能配 Anthropic / OpenAI API key（留后续）
- ❌ 不能 rollback prod 到 pre-`a63043fe` 状态（Dan 拍保留）
- ❌ 不能动 LLM provider routing chain fallback 逻辑（仅加 telemetry）
- ❌ 不能给 telemetry fallback 占比设硬 fail 阈值（仅 alert log）
- ❌ 不能改 Constitution Rule 2 文本（保留双 prod 锁定）
- ❌ 不能动 A1 owned v10 文件（除 telemetry import 不可避免）
- ❌ 不能 force-push / rewrite history
- ❌ 不能在 B.10 PR 内 --prod（部署拓扑修完后才能信心 --prod，但要 Dan 明确指令）
- ❌ 不能在 Vercel CLI 不支持时擅自决定让 Dan 做 → 必须给 step-by-step UI 指南

---

## 14. Constitution 对照检查（v0.1.1 7 Rule）

| Rule                       | 状态    | 评估                                                                                                                                                  |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule 1 部署身份            | PASS    | preview only / 不推 CoinW GitLab / 走 agentxmain-collab registry                                                                                      |
| Rule 2 生产保护（双 prod） | RESTORE | **B.10 P0 修部署拓扑就是为了恢复 Rule 2** —— main → preview only + 明确 --prod 才动 prod。短期违规已发生（B.5-B.9 自动 deploy），不追究；长期纪律恢复 |
| Rule 3 视觉品牌权威        | PASS    | 不动 v9 / v10 视觉                                                                                                                                    |
| Rule 4 数据 schema 纪律    | PASS    | 不动 schema                                                                                                                                           |
| Rule 5 AI / 行情诚实性     | PASS    | telemetry 增加观测，不改 LLM 输出本身                                                                                                                 |
| Rule 6 协作闭环            | PASS    | 走 Codex 双脑判断 + sync READ/writeback + spec gate                                                                                                   |
| Rule 7 验证门槛            | PASS    | 全 verify gate + telemetry 数据样本验证 + 部署拓扑生效验证                                                                                            |

**Rule 2 RESTORE 说明**：B.10 是 Constitution Rule 2 的修复 phase，不是违反。当前 prod `a63043fe` 现状保留是 Dan 明示决定（不 rollback 是次优于 Rule 2 严格执行的产品决策）。修完 B.10 后 Rule 2 纪律恢复，后续 PR merge 不再自动上 prod。

---

## 15. Worktree

- **Codex 实施 worktree**: `/tmp/claw42-b10-deploy-topology-provider`
- **base HEAD**: `a63043fe056d5275ec50f58fe643fdb36d2556dc`
- **branch**: `feature/spec-b10-deploy-topology-provider`
- **PR base**: `main`
- **不动**: 主 worktree
- **决策档案**: `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（repo 外只读引用）
- **Constitution**: `docs/project-constitution.md` v0.1.1

---

## 16. 老板简报

claw42 这次发现两个不太好但不影响用户使用的事：

第一，前段时间几次内部代码 merge 不知不觉把测试版本推到正式站了（claw42.ai）。所有页面都正常跑，用户没感知，但这违反我们立的"正式站要明确指令才动"规则。这次修一下部署配置，让以后内部 merge 只进测试站，明确推正式时才推。

第二，目前 watch 板的 AI 决策只有一个大模型在跑（DeepSeek），另一个本来应该用的模型（Minimax）因为环境变量名字大小写错没接上。修一下大小写，让它接上。其他模型（Anthropic、OpenAI）后续单独决定要不要加。

加一个监控：让我们能看到每次 AI 决策实际用了哪个模型 / 是否有 fallback / 比例多少。后续判断要不要扩 provider 时有数据支持。

这次不动正式站当前版本，不动产品视觉，纯运维。完成后后续迭代纪律恢复。

---

## 17. Anti-Rationalization

| 逃逸路径                                                             | 为什么不行                                                                                                        | 正确做法                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 觉得 Anthropic / OpenAI key 顺便配上反正小事                         | Dan 明确拍仅修 Minimax，扩 provider 涉及 key 申请 / 公司 procurement / cost 决策                                  | 严格仅修 Minimax 大小写，其他 [SPEC-FEEDBACK]      |
| 觉得 Vercel CLI 不支持改 production branch 不如让 Dan 改吧懒得给步骤 | Codex 必须给 Dan step-by-step UI 操作指南（精确路径 + 字段名 + 验证步骤），不能默认 punt 不给细节                 | T-B10-020 路径 B 必须含完整 UI 指南                |
| 觉得 telemetry 加上去顺便设硬 fail 阈值                              | 硬 fail 会让 prod / staging 立即跑挂；P2 仅 alert 观察                                                            | 仅 console.warn + KV alert log，不阻塞 pipeline    |
| 觉得 prod 已被 auto-deploy 不如顺便 rollback 到 pre-B.5              | Dan 拍不 rollback，保留 prod = `a63043fe` 作 A 线 reference                                                       | 严格不 rollback，B.10 修完后再决定何时 --prod 修复 |
| 觉得 provider routing chain 既然加 telemetry 顺便重构一下            | scope 越界；routing 重构是独立决策                                                                                | 仅加 telemetry 埋点，不动 routing 逻辑             |
| 觉得 Minimax rename 顺便清掉老 var                                   | Dan 拍后续清理；保留老 var 作 backup 避免 Vercel 配置回滚需求                                                     | 仅加新 var，老 var 保留                            |
| 觉得 B.10 PR squash merge 后顺便 --prod 修复一下 prod 部署           | 必须先 verify 部署拓扑修生效，再让 Dan 明确指令 --prod；不擅自 --prod                                             | T-B10-054 严格不 --prod；待 Dan 后续指令           |
| 觉得 v10 module 加 telemetry 一行也算改                              | telemetry import 如不可避免（如 LLM call 在 v10 内）必须显式声明 + grep gate 例外；优先选不动 v10 的 wrapper 位置 | 优先在 lib/team/ wrapper 加埋点；v10 不动          |

---

## 18. 双脑判断点

### Q-B10.1: Vercel CLI 能改 production branch 吗 + telemetry 埋点最少改动位置

- `vercel project ls` / `vercel git --help` / `vercel project list` 实测 CLI 能力
- 如 CLI 支持 → T-B10-020 路径 A 自动改
- 如 CLI 不支持 → stop + 写 Dan UI 操作 step-by-step 指南（含验证步骤）
- LLM call wrapper 实际位置 grep（看 `src/lib/team/` 哪个文件 / wrapper 函数 + provider chain 实现）
- telemetry 埋点最少改动位置自决

### 每 phase 必填实施前 grep check

- [ ] `vercel project ls --token=...` 看 production branch 当前配置
- [ ] `vercel env ls preview` + `vercel env ls production` 看 env vars 含 `Minimax_API_KEY` 实际命中
- [ ] `cat src/lib/team/*.ts | grep -A 5 "MINIMAX_API_KEY"` 看代码读取 env var 的位置
- [ ] `grep -r "process.env" src/lib/team/ | grep -i minimax` 确认大小写
- [ ] `cat src/app/api/cron/strategy-replay/route.ts` 看 cron 完成后是否有 telemetry hook 空位
- [ ] `grep -r "providerTelemetry\|callTelemetry\|llmTelemetry" src/` 看 main 是否已有 telemetry 框架
- [ ] `cat docs/project-constitution.md` v0.1.1 Rule 2 双 prod 文本

如任一不一致 → [SPEC-FEEDBACK]，立即停 + 报 F。

---

## 19. decision-log 联动

spec 起草 + 每 phase 完成都触发追加 entry 到 `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`：

- 2026-05-15（已加）: A 线终态拍板 + 3 步 roadmap + Codex 调研 5 反转
- 2026-05-15（待 F 追加）: B.10 spec v1.0 起草
- B.10 完成后（Codex 触发 F 追加）: B.10 完成 + 部署拓扑修生效 + Minimax 真接入 + Telemetry 数据样本

---

## 工作量预估

| Phase                            | 时间（AI 天）                                                              |
| -------------------------------- | -------------------------------------------------------------------------- |
| 0 Setup + Vercel CLI verify      | 0.2                                                                        |
| 1 P0 部署拓扑修（CLI 或 Dan UI） | 0.5                                                                        |
| 2 P1 MINIMAX_API_KEY rename      | 0.3                                                                        |
| 3 P2 Provider telemetry + alert  | 0.5-1                                                                      |
| 4 Verify + report                | 0.3                                                                        |
| **总计**                         | **1.8-2.3 AI 天** + Dan 配 Vercel UI 改 / 提供原 Minimax key value（如需） |

---

## 关联资产

- 前置：B-master spec v1.4 + B.5-B.9 全 merge（PR #90-94）
- 触发：Codex 2026-05-15 调研报告（codex-to-claude.md 反转 5 假设）
- Constitution：`claw42/docs/project-constitution.md` v0.1.1
- Decision-log：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md` 2026-05-15 entry

---

_v1.0 起草：2026-05-15 02:30 CST F session_
_起草前置：Codex 调研 5 反转 + Dan 拍立即修 Vercel 配置 + 仅修 Minimax 大小写_
_下一动作：Codex T-B10-010 verify Vercel CLI 能力 → 串行实施 → PR + squash merge（不 --prod）_
