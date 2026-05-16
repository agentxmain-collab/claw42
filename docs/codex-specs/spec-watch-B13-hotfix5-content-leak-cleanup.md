# Spec: Watch B.13 Hotfix 5 — Content Leak Cleanup（彻底清后台白话）

> **版本**：v1.0（2026-05-16 深夜 ++ 紧急）
> **作者**：F (Claude session)
> **状态**：Hotfix Draft，立即派 Codex
> **协议**：claude-codex-protocol v2.5
> **触发**：Dan 2026-05-16 chat 看 hotfix-4 preview 真实 BILL 输出，发现 14 角色输出含大量后台白话："无止损参考"、"无成交量验证"、"无事件驱动分析"、"缺乏交叉验证"、"前轮其他角色观点分歧"、"维持 wait，等待链上资金流"等

---

## § 1 Overview

### 1.1 现象（Dan 截取的真实 BILL 输出）

```
价格40.63，24h跌幅-10.45%触发rangechange警报，但链上数据缺失
（无持仓变化、大户动向），基本面数据空白。单一价格信号无法区分
流动性冲击、恐慌抛售或趋势反转。无止损参考、无成交量验证、无事件
驱动分析。前轮其他角色观点分歧（chartanalyst短多0.65 vs bullish_
researcher长多0.25），但均依赖价格行为，缺乏交叉验证。风险回报不
对称：若为恐慌性抛售可能反弹，但无数据确认底部。维持wait，等待链
上资金流或基本面更新后再参与。
```

**问题清单**：

1. **暴露后台数据状态**："链上数据缺失"、"基本面数据空白"、"无止损参考"、"无成交量验证"、"无事件驱动分析"
2. **引用其他角色名字**："前轮其他角色观点分歧（chartanalyst 短多 0.65 vs bullish_researcher 长多 0.25）"——直接暴露 TeamMemberId
3. **暴露 wait/no-key 工程白话**："维持 wait，等待链上资金流或基本面更新后再参与"
4. **专业分析师不会这么说话**：真分析师在数据稀疏时要么不发声，要么用专业语言陈述风险/不确定性，不会工程化罗列"缺啥"

### 1.2 F 判断 + B.13 Stage 1 T102 修不彻底

Stage 1 T102 改过 `pmDecisionPipeline.ts:301` + `evidenceDispatcher.ts:76/337` 的 fallback wording。但显然**只清了"暂时不可用 / 缺失"等显式工程词**，没拦住 LLM 在数据稀疏时**自己生成**新的工程白话变体。

F 推测漏点（Codex first-hand 必须验证 / 修正）：

- evidenceDispatcher 把"数据缺失 / 无 X" 当上下文喂给 LLM，LLM 自然在输出里"诚实陈述缺失"
- 14 角色 prompt（docs/agent-ip/team/\*.md）没硬约束"禁止陈述数据状态 / 禁止引用其他角色名字 / 禁止 wait/no-key 工程白话"
- PM 输出 detailedRationale 时直接引用 14 角色 oneLineSummary，没做白话过滤

**Codex 不要按 F 推测盲修**——Codex first-hand 实测 PM run 真输出 + grep prompt + 找真漏点。

### 1.3 修复策略（Codex 实测后基于真因决定）

可能修复方向：

- **方向 A 修 prompt 硬约束**：14 角色 prompt 顶部加"禁止清单"——禁止陈述数据状态 / 禁止 wait/等待/缺失/无 X 类工程白话 / 禁止引用其他角色名字 / 必须用专业分析师语言（如"风险信号不足以下判断"代替"数据缺失"）
- **方向 B 修 evidence dispatch**：数据稀疏时**跳过这个角色 LLM 调用**（设角色为 abstain），而不是让 LLM 在没数据时说"我没数据"。PM 在汇总时跳过 abstain 角色，不引用
- **方向 C 修 PM 汇总**：PM 输出 detailedRationale 时禁止引用 TeamMemberId / 禁止 inline 其他角色发言

可能三者都要做，Codex 实测后决定优先级。

---

## § 2 In-Scope / Out-of-Scope

### 2.1 In-Scope

**Task A 调研**（first-hand 必查）：

1. 实测 1-3 次 PM run（real LLM 调用），保存原始 `rationaleByMember` + PM `detailedRationale`
2. grep 14 角色 prompt（docs/agent-ip/team/\*.md）当前内容——有无禁止后台白话约束
3. grep evidenceDispatcher 当前 wording——数据稀疏时怎么 dispatch
4. grep PM 汇总逻辑——是否 inline 角色名/oneLineSummary

**Task B 修补全**（基于 A 真因）：

- 修 prompt / evidence / PM 汇总三层（哪一层是真漏点修哪层，多层有漏多层修）
- 禁止清单（中英双语）：
  - 中：缺失 / 空白 / 没有 / 无 X / 等待 / wait / 维持观察 / 维持 wait / 暂无 / 数据不足 / 缺乏 / 待更新 / 后续 X 更新
  - 英：missing / absent / wait / pending / insufficient / unavailable / no data / null / awaiting
  - 引用角色：`chart_analyst` / `bullish_researcher` / `bearish_researcher` / `risk_lead` / 等 14 个 TeamMemberId 不能出现在 public payload
- 替换为专业分析师语言：
  - "数据稀疏时" → "信号面不足以下判断" / "当前条件不构成入场" / "观察中"（不要"等待"）
  - "前轮其他角色观点分歧" → 直接不写，或换成"市场观点分化"（不点名）

**Task C 实测验证**（验收门槛）：

- 修完后实测 ≥3 次新 PM run
- 抓取 `rationaleByMember` + PM `detailedRationale` 原文
- grep 禁止清单每个词在 public payload 出现次数 = 0
- 报告原始 LLM 输出截图 / 文本，让 F + Dan 验收

### 2.2 Out-of-Scope

- 不动 candidate selector / candidate pool / refresh trigger / hydration / timeline projection
- 不动 PM pipeline 整体架构
- 不动 hotfix-1/2/3/4 已 merge 改动
- 不上 prod
- 不实施 B.14 产品架构层改动（B.14 是独立 spec）

---

## § 3 Edge Cases

### 3.1 LLM 在禁止清单约束下硬要说缺失怎么办

- prompt 加强约束 + truncate 后处理：如果 LLM 输出含禁止词，evidence pipeline 触发 "abstain"——角色不发声
- 或 LLM 输出后过滤层（regex 检测 + reject 重新生成）

### 3.2 PM 不能引用角色名后怎么综合

- PM detailedRationale 用第三人称客观陈述："市场观点分化"、"短期与中期信号矛盾"，不点名
- oneLineSummary 14 角色各自的依然带 persistent voice，但内部互不引用

### 3.3 数据真的全没（no_signal）场景

- PM 直接出 `no_signal` 状态——前端显示"暂无足够信号触发新决策"empty state，不暴露后台细节
- 不要让 LLM 强行"硬编"一个看似有内容实则空话的决策

---

## § 4 Assumptions

1. Codex first-hand 实测能复现 Dan 看到的内容暴露问题
2. 修复优先 prompt 硬约束 + abstain 跳角色，不依赖纯 post-hoc regex 过滤（脆弱）
3. 修复完后新 PM run 真能产出干净内容（不让 LLM 在硬约束下硬编输出）

---

## § 5 Measurable Success Criteria

- ✅ Task A 报告含实测 PM run 原始输出 + 漏点 first-hand 因果链
- ✅ Task B 修完后跑 ≥3 次新 PM run，public payload 含**0 次**禁止清单词（grep verify）
- ✅ public payload 含 0 次 TeamMemberId 字串
- ✅ "wait" / "等待" / "维持观察" 类工程白话 0 次
- ✅ 单元测试覆盖：mock LLM 输出含禁止词时 pipeline 触发 abstain / regen
- ✅ Dan preview 验收实际看到的输出**符合专业分析师语言**

---

## § 6 实施流程

1. Codex 拉新 worktree
2. Task A 调研 → 报告 commit
3. Task B 修（prompt / evidence / PM 三层视真因决定）→ 跑 verify 套件
4. Task C 实测 ≥3 次 → 报告原始输出 commit
5. PR 推 → preview → 给 F → F 给 Dan 验收

---

## § 13 不能做

1. 不动 PM pipeline 整体架构 / candidate / refresh / hydration / timeline
2. 不撤 hotfix-1/2/3/4 改动
3. 不上 prod
4. 不按 F 推测盲修（先 Task A 实测）
5. 修完不实测 ≥3 次就 ship
6. 不能让 abstain 角色"硬编"垃圾输出（abstain = 不发声，不是说废话）
7. 禁止清单 grep 0 次是硬指标
8. UI 不动（hotfix 5 仅修内容质量，不动布局）

---

## § 14 Constitution 对照

| Rule           | Check                                      | 答   |
| -------------- | ------------------------------------------ | ---- |
| Rule 1 部署    | preview only                               | PASS |
| Rule 2 v0.1.2  | preview free / prod 不动                   | PASS |
| Rule 3 视觉    | 不动 UI                                    | PASS |
| Rule 4 schema  | 不动 schema（仅 prompt / dispatch / 汇总） | PASS |
| Rule 5 AI 诚实 | 修产品诚实性——专业分析师语言，不工程白话   | PASS |
| Rule 6 协作    | 单 PR + 调研 + 修 + 实测 + F 双脑          | PASS |
| Rule 7 验证    | § 5 含 grep 0 次硬指标 + 实测原始输出      | PASS |

---

## § 16 老板简报

claw42 工作台修复 5。本次做了啥：AI 团队的分析里之前会出现"无止损参考"、"数据缺失"、"维持等待"这种工程白话，听起来像后台调试在和用户说话。这次修通让 14 位 Agent 用专业分析师语言说话——数据不够时直接不发声或客观陈述风险，不暴露"我缺什么"，也不互相点名引用。多次实测验证输出干净后才算完成。后续规划：内容干净后立 B.14，产品架构层加大盘 + 热点常驻分析卡，币种分析按优先级抓（大币 / 热门 / 新闻驱动 优先于小币）。

---

## § 17 Anti-Rationalization

| 逃逸路径                                                         | 为什么不行                                              | 正确做法                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Stage 1 T102 已修过就觉得问题不大，只补几个新词                  | T102 显然没拦住 LLM 自创变体——表层补词不解决根因        | Task A first-hand 找系统性漏点（prompt / dispatch / 汇总三层），不只是补 regex |
| 加 post-hoc regex 过滤当主修                                     | 脆弱 + LLM 会继续生成绕过词                             | prompt 硬约束 + abstain 跳角色为主，regex 仅兜底                               |
| Abstain 角色硬编一段空话                                         | 用户看到空话比专业沉默更差                              | abstain = 不发声 + PM 跳过引用                                                 |
| 修完只跑单测就 ship                                              | LLM 输出 runtime 才暴露，单测覆盖不到                   | 必须 ≥3 次实测真 LLM run                                                       |
| 修 PM 汇总让它"不引用"，但 LLM 仍可能在 detailedRationale inline | LLM 服从 prompt 约束概率 < 100%，需要 post-hoc 过滤兜底 | prompt 硬约束 + post-hoc 兜底双层                                              |

---

## § 18 Decision-Log 联动

完成后追加：

```
[2026-05-16 深夜++] [产品] B.13 hotfix-5：14 角色内容暴露后台白话彻底清理
[2026-05-16 深夜++] [产品] Dan 拍 B.14 产品架构：常驻分析（大盘 + 热点）作为决策流中特殊卡 + 币种按优先级抓
```

---

## § 19 Tasks 索引

| Task  | Priority | Story                                                                 |
| ----- | -------- | --------------------------------------------------------------------- |
| T-A.1 | P0       | 实测 1-3 次 PM run 抓原始 rationaleByMember + PM detailedRationale    |
| T-A.2 | P0       | grep 14 角色 prompt + evidenceDispatcher + PM 汇总，找漏点 first-hand |
| T-A.3 | P0       | 调研报告 commit 进 PR                                                 |
| T-B.1 | P0       | 修真漏点（prompt / dispatch / PM 三层视真因决定哪层修）               |
| T-B.2 | P0       | 14 角色 prompt 顶部加禁止清单硬约束（中英双语）                       |
| T-B.3 | P0       | evidence dispatcher 数据稀疏时 abstain 角色（不让 LLM 在没数据时跑）  |
| T-B.4 | P0       | PM 汇总禁止引用 TeamMemberId + post-hoc regex 兜底过滤                |
| T-C.1 | P0       | 修完后跑 ≥3 次实测真 PM run + 抓原始 LLM 输出                         |
| T-C.2 | P0       | grep 禁止清单 + TeamMemberId 在 public payload 0 次 verify            |
| T-C.3 | P0       | 实测报告 commit 进 PR + verify 套件全过                               |

P0 = 10 / 总 10。

---

_版本：v1.0 (2026-05-16 深夜++ 紧急 hotfix-5)_
