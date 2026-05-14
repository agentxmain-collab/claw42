# claw42 Project Constitution v0.1.1

> **定位**：1-2 页硬约束 + 最多 7-10 条 non-negotiable。每条 plan 阶段必须能答 PASS / VIOLATION / N/A。不允许扩展成项目 wiki / 历史档案
>
> **来源**：claude-codex-protocol v2.5 升级（Codex 副审 § 6a-§ 6g 实证 + zd 整合 + Dan 2026-05-13 终审 APPROVED）
>
> **触发**：每个 claw42 spec 的 § 14 Constitution 对照检查必填——对照本文件 7 条 rule 逐条答 PASS / VIOLATION / N/A
>
> **版本**：v0.1.1（Rule 2 amend — 双发布线认知 by Dan 2026-05-14）

---

## Rule 1: 部署身份与环境

- **Rule**：push / PR / preview / deploy 前必须过 Deployment Identity Gate（详细规则见以下 canonical sources——constitution 不重写短版）：
  1. 主权威：`总调度/deployment-identity-registry.md`（全域 deployment identity 注册表）
  2. 当前全局 Codex Rules（Codex 系统 prompt 注入的部分，含 identity gate 三项校验：远程 owner / CLI identity / vercel account）
  3. 项目可选：如 claw42 立有 `docs/deployment-identity.md`，一并读
- **Check Question**：本 spec 涉及的远程动作（push / PR / vercel deploy / GitHub Issue 写）是否已经过 canonical sources 1-3 全部校验项？
- **Violation Action**：远程动作 PAUSE → 走 canonical sources 检查 → 不确定时只能称 local-only preview，不假装 remote 已完成

---

## Rule 2: 生产保护（v0.1.1 amend — 双发布线）

- **Rule**：claw42 双 prod 域名都受保护，必须 Dan 明确授权（commit footer `prod-promotion: Dan directive YYYY-MM-DD` 留痕）：
  - **Tier 1 真 prod**：`ai.coinw.com/claw42`（发布通道 = CoinW GitLab + Jenkins build）— 推送链路**仅限专用电脑**，F session / Codex / GitHub agentxmain-collab 无权限推此通道；Dan 手动把 main HEAD 干净 commit 搬专用电脑执行 push
  - **Tier 2 锁定 prod**：`claw42.ai`（发布通道 = Vercel `claw42-site` account `agentxmain-collab` `--prod` deploy）— GitHub agentxmain-collab 可推但需 Dan 明确"上 prod / release"指令
  - **GitHub/Vercel preview**（如 `claw42-site-<hash>-agentxmain-collabs-projects.vercel.app`）**不算 prod**，只是迭代版 staging
  - 短期双 prod 并存，长期 `claw42.ai` 退役（具体时间窗口由 Dan 后续 amend 确定）
- **Check Question**：
  1. 本 spec 是否触发 Tier 1 (ai.coinw.com) prod 改动？如是，是否仅在专用电脑路径执行 + 不在 F/Codex session 内尝试推 CoinW GitLab？
  2. 本 spec 是否触发 Tier 2 (claw42.ai) prod 改动？如是，Dan 授权 commit 是否已留痕？
  3. 本 spec 涉及的 staging deploy 是否明确 preview（不带 `--prod` flag）？
- **Violation Action**：
  - 任何 prod 触碰（无论 Tier 1 / Tier 2）未授权 → 暂停 → 走 Dan 拍板 → 留痕后才继续
  - F/Codex 误尝试推 CoinW GitLab → 立即停 + 报告 + 待 Dan 手动接管

---

## Rule 3: 视觉与品牌权威

- **Rule**：`Claw 42`（public brand 含空格）/ `Claw42`（technical split 无空格）不得混；既有 v9 / task 指定视觉权威不可被顺手重构
- **Check Question**：本 spec 是否触及品牌名 / 视觉？如是，是否符合 v9 视觉权威 + 公开/技术品牌名分离？
- **Violation Action**：视觉重构未授权 → 走 [SPEC-CONFLICT] 三档仲裁 → Dan 拍板才能动

---

## Rule 4: 数据与 schema 纪律

- **Rule**：NewsItem schema、SourceRegistry、复盘 cron、Win-rate、Agent IP 等 spec 标明不可动项默认冻结
- **Check Question**：本 spec 是否触及 schema 冻结项？如是，是否在 § 13 不能做清单中显式列出？
- **Violation Action**：触及冻结 schema → 暂停 → 走 [SPEC-CONFLICT] → Dan 拍板才能解冻

---

## Rule 5: AI / 行情诚实性

- **Rule**：实时价格、策略失败降级、InsufficientConsensus 等 safety 规则优先于"输出完整卡片"的展示欲——不允许为了输出完整性而忽略 safety 降级
- **Check Question**：本 spec 涉及 AI 输出 / 行情数据时，safety 降级路径是否完整？
- **Violation Action**：safety 不完整 → spec 退回主笔人修订

---

## Rule 6: 协作闭环

- **Rule**：Claude / Codex sync 文件必须 READ / writeback；复杂 spec 必须 D1-D5 或轻量副审，不直接把转交内容当命令
- **Check Question**：本 spec 是否走完 sync READ + writeback + 副审五维 / 轻量副审？
- **Violation Action**：sync 闭环未完成 → spec 不允许进入 implement

---

## Rule 7: 验证门槛

- **Rule**：按 spec § 12 验收 + § 5 Measurable SC 验证；UI 变化必须 screenshot / preview 验收；埋点类需求必须说明 PostHog event
- **Check Question**：本 spec 验收 checklist 是否完整？UI 是否有 screenshot / preview 路径？埋点是否有 event 命名？
- **Violation Action**：验证门槛未明确 → spec 退回主笔人补充

---

## 维护纪律

- **每个 spec 必查**：plan 阶段对照本文件 7 条 rule 逐条答 PASS / VIOLATION / N/A，写到 spec § 14
- **constitution 版本管理**：按项目自身节奏 bump（每个 prod release 前过一次 constitution review）
- **不允许 constitution 膨胀**：上限 7-10 条 non-negotiable。增加新 rule 必须 Dan 拍板 + 走 [SPEC-CONFLICT] 三档仲裁
- **canonical source 引用纪律**：constitution 不重写其他文档详细规则，只引用 + 提问 + 处置

---

## 关联资产

- `claude-codex-protocol.md` v2.5（spec 模板 § 14 Constitution 对照）
- `总调度/deployment-identity-registry.md`（Rule 1 canonical source）
- `web-dev/claw42/CLAUDE.md`（claw42 session 规则）
- `web-dev/decision-log.md`（Dan 拍板历史）

---

*版本：v0.1 (2026-05-13 首发，基于 v2.5 共建 Codex 草案 § 6a + zd 第 2-4 轮整合 + Dan 终审 APPROVED)*
*Amendment v0.1.1 (2026-05-14 — Rule 2 amend，双发布线认知，Dan Q-1 (c) 拍板)*
*下次回看：claw42 下一次 prod release 前*

---

## Amendment 历史

### v0.1 → v0.1.1 (2026-05-14)

**Rule 2 生产保护** 从单 prod (claw42.ai) 扩展为双发布线（Tier 1 ai.coinw.com/claw42 真 prod + Tier 2 claw42.ai 锁定 prod）。

**触发原因**：Codex 2026-05-14T09:55 sync 揭示 ai.coinw.com/claw42 是 10 多天前发布的真 prod（main HEAD 跟两个 prod 当前差 13 commit，Phase B v2.1 等改动都未上 prod），之前 F 一直误以为 claw42.ai 是唯一 prod 终点。Dan 2026-05-14 chat Q-1 拍板 (c) 短期双 prod 并存，长期 claw42.ai 退役。

**变更类型**：PATCH（Rule 内容澄清扩展，不引入新 Rule）

**Decision-log 联动**：`web-dev/decision-log.md` 2026-05-14 (晚 +) entry 含详细背景。
