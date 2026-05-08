# claw42 v2.0 Master Plan — Locked v3

> **Status**: LOCKED-v3 — 整合 task-18 v3.final 验收暴露的内容层 gap + Dan 新方向决策（派别原型化 / action 真改 content / SignalCard grounding / periodic_analysis trigger / DeepSeek V4 Flash 默认）
> **Replaces**: `v2-master-plan-locked-v2.md` (locked-v2)
> **Date**: 2026-05-08

---

## § 0. v2 → v3 变更摘要

| 类别                       | 变更                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame / Segments / Metrics | 不变（仍 LOCKED）                                                                                                                                 |
| Q1-Q6 决策                 | 不变（仍 LOCKED）                                                                                                                                 |
| task-18 路径               | task-18 PR #27 仅修 v3.1 minimal patch（币种错位 + cache）后合 main；**所有内容深度重做移到 Batch 4 task-18-v2**                                  |
| 派别设计                   | 升级：从抽象人设 → **策略 + 数据原型**（不是真人 IP，可被任何分析师调教）                                                                         |
| 11 ChatAction              | 升级：从 metadata hint → **真改 content**（每个 action 有专属 prompt 模板）                                                                       |
| 触发逻辑                   | 新增 `periodic_analysis` trigger + 智能模式（最近访问保留）                                                                                       |
| LLM model                  | 锁定：**DeepSeek V4 Flash 默认**（fallback minimax / claude-haiku）                                                                               |
| LLM 月成本                 | 智能模式 ~$54/月（V4 Flash）                                                                                                                      |
| Batch 4 范围               | 大幅扩张：原 task-18-v2 = 接 SignalEngine grounding；新 task-18-v2 = 接 grounding + 派别原型化 + action templates + periodic trigger + 内容多样性 |

---

## § 1. 不变项（继承 v2 LOCKED）

- **Frame**：CoinW 转化漏斗（来 → 决策 → 去 CoinW 下单）
- **3 Segments**：跟单者 60% / 学习者 25% / 观察者 15%
- **4 Success Metrics**：Agent 累计胜率 > 50% / Watch → CoinW 转化率 ≥ 5% / 分享带回 > 月新增 10% / 14 天复盘
- **Q1-Q6 决策**：in-memory + KV / 三件套 / 胜率真实 / 用户分享 / 彻底废弃 llmFallbackChain / 不闭环数据
- **永久限制**：A1 affiliate URL（Q-A1 已解锁，URL 模板 = `https://www.coinw.com/{locale}/register?r={code}`）

---

## § 2. 派别设计升级（新）

### 2.1 派别 = 策略 + 数据原型（不是真人 IP）

**重要修正**：v3 之前讨论过"派别绑真实分析师 IP"（Owen/Blake AI 化身），**Dan 已驳回**——派别是**策略风格 + 数据视角**，不是人物 IP。任何分析师都可通过 prompt + fewshot 调教 Agent，不绑定具体真人。

| 派别                  | 策略原型                                              | SignalCard 数据视角                                     | 性格                                        |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| **alpha**（破位猎手） | 技术派：ATR / 布林带 / 成交量突破 / RSI 极值          | `facts` + `evidence` 层（实际成交、订单簿、K 线形态）   | 进攻型、爱嘲讽、短线视角、看到突破立刻 FOMO |
| **beta**（趋势守正）  | 宏观派：FED 利率 / ETF 资金流 / 美股相关性 / 风险偏好 | `impact` + `judgment` 层（宏观背景、跨市场联动）        | 谨慎型、爱用 hedge 词、长线视角、爱泼冷水   |
| **gamma**（极端猎手） | 链上派：巨鲸钱包 / 矿工流出 / 链上活跃 / 资金费率     | `explanation` + `engine` 层（链上数据、衍生品 metrics） | 数据驱动、不站队、爱抛冷僻数据              |

### 2.2 派别 prompt 模板（Batch 4 实施）

每派 prompt 必含 4 段：

```
# Role identity
你是 {nickname}（{role}），偏好 {strategy_archetype} 视角。

# Data anchor
你只关注 SignalCard 的 {data_layers} 层。其他层数据你**忽略**（让其他 Agent 看）。

# Style anchor
你的语气：{style_descriptors}（如 alpha：进攻、嘲讽、短句、emoji；beta：谨慎、长句、hedge；gamma：冷峻、数据、罕见词）。

# Forbidden patterns
你**禁止**：模板化句式（"距前低 X%, 下方止损单密集"）/ 报告口吻 / 派别前缀。
你**必须**：每条消息和上一条句式不同。
```

### 2.3 调教接口预留（Batch 4 实施 / v2.5+ 启用）

- **fewshot 库可外部追加**：JSON 文件，每派一个，分析师可 PR 加新 example
- **Agent 输出可标注**：每条 message 有 `requestForReview` flag，分析师 review 后 + 标记是否进 fewshot
- **调教反馈接口**：`/api/agent/calibrate?agent_id=alpha&fewshot_json=...`（v2.5+ 启用）

**v2.0 不实施调教接口的实际工作流**——只搭代码 stub，等分析师调教需求真出现后启用。

---

## § 3. 11 ChatAction 真改 content（新）

### 3.1 v2 之前

ChatAction 是 prompt hint：`action="rebut"` 进 prompt 后 LLM 自由生成。结果：LLM 用 base distribution 出"这点先别急"模板。

### 3.2 v3 升级

每个 action 有**专属 prompt 模板**强制 content 形态：

| Action     | Prompt 模板                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `open`     | "用 1-2 短句开启话题，必须含具体数据点（symbol + 数字）+ 你的判断方向"                           |
| `rebut`    | "明确反对 ${target_agent} 上一条某句话（用 citedQuote 引用）+ 给出**不同**的数据 + 你的反对理由" |
| `agree`    | "同意 ${target_agent} 但**补充**一个新数据 / 新角度（不能只说'同意'）"                           |
| `question` | "对 ${target_agent} 上一条提一个具体问题（必须能回答的，不是 rhetorical）"                       |
| `taunt`    | "嘲讽 ${target_agent}，必须用嘲讽语气词 / 表情，1-2 短句不超过 20 字"                            |
| `derail`   | "突然转移话题到一个相关但不同的 symbol / 事件"                                                   |
| `refocus`  | "把跑偏的话题拉回原 symbol，必须明确说出 symbol 名"                                              |
| `comment`  | "对市场状况发一个独立观察（不指向任何 agent），必须含具体数据"                                   |
| `react`    | "对刚发生的事件做即时反应，仅 1 短句 + emoji"                                                    |
| `concede`  | "承认之前判断错了，必须明确说错在哪 + 给出修正方向"                                              |
| `gloat`    | "胜利炫耀（你的预测应验时），必须含'我说过' / 'told you' 等回顾 + emoji"                         |

### 3.3 Action 选择算法（chatOrchestrator）

不是 LLM 自己选 action，是 orchestrator 按状态计算：

```
if (last_message.expectsReply && last_message.mentioning_me) {
  // 必须 reply
  if (emotionalDebt[me][last_speaker] > 2) action = 'rebut' or 'taunt';  // 积怨多
  else if (data_supports_them) action = 'agree';
  else action = 'question' or 'rebut';
}
else if (no_one_spoke_for_30s && I_have_signal) {
  action = 'open' or 'comment';
}
else if (my_prediction_proved_right) action = 'gloat';
else if (my_prediction_proved_wrong) action = 'concede';
// ... 等
```

每个 action 选定后，按 § 3.2 的模板组装 prompt 给 LLM。

---

## § 4. SignalCard Grounding（Batch 4 实施）

### 4.1 数据契约

每条 ChatMessage 必关联一个 `signalCardId`（指向 SignalEngine 输出的具体 SignalCard）：

```typescript
ChatMessage {
  // ... existing fields
  signalCardId: string,      // 必填，指向具体 SignalCard
  signalCardLayer: string,   // 'facts' | 'evidence' | 'impact' | 'judgment' | 'explanation' | 'engine'
}
```

LLM 生成 prompt 时：

```
SignalCard ${signalCardId} 的 ${signalCardLayer} 层数据：
${JSON of that layer}

你（${agent}）作为 ${strategy_archetype}，必须**仅基于上述数据**生成发言。
禁止编造未在数据中出现的数字 / 事件。
```

### 4.2 派别看哪些层

按 § 2.1 表格映射：alpha → facts+evidence；beta → impact+judgment；gamma → explanation+engine。

### 4.3 数据缺失降级

如果 SignalCard 某层数据缺失：

```
你（${agent}）只能看 ${data_layers}，但当前 SignalCard 该层数据缺失。
你的发言必须明确说"数据不足以判断 ${aspect}"，不要编造。
```

LLM 输出时强制带"数据不足"标签，UI 渲染为灰色 caveat 块。

---

## § 5. 触发逻辑升级 — periodic_analysis（新）

### 5.1 原 4 触发条件（v2）

- `cooldown_expired` (5min)
- `breaking_news`
- `price_volatility` (>2% 30min)
- `dev_override`

### 5.2 新增第 5 触发：`periodic_analysis`

任何币种没满足前 4 条件时，**仍生成 routine 讨论**（让 watch 页一直有内容）。

### 5.3 智能模式（最近访问保留）

完全持续生成成本太高（$134-1670/月，见 § 6）。改为：

```
对每个 symbol 维护 lastAccessedAt：
- 任何用户访问 watch?symbol=X → lastAccessedAt[X] = now
- chatOrchestrator 检查：if (now - lastAccessedAt[X] < 1 hour) → 允许 periodic 触发
- 否则暂停 routine generation
```

**用户访问首次落地体验**：

- 如果当前有 active thread → 直接显示
- 如果没有 + 距 lastAccessedAt > 1 小时 → 立刻 trigger（5s 内出第一条）+ 同时显示 seed thread 兜底
- 真实新 thread ready 后自动切换

### 5.4 routine vs hot 内容差异

| 维度        | hot（新闻 / 价格触发）           | routine（periodic）                |
| ----------- | -------------------------------- | ---------------------------------- |
| Trigger     | breaking_news / price_volatility | 距上次 thread 5+ min + 该币 active |
| 戏剧度      | 高（吵架、嘲讽、reverse）        | 中（巡检、闲聊、各自坚持）         |
| 长度        | 25 messages                      | 12-15 messages                     |
| Action 分布 | rebut / taunt / gloat 多         | comment / open / agree 多          |
| 数据点      | 引用新闻 + 实时价格              | 引用最近 1-4h 的 SignalCard        |

**关键：routine 不能机械化**——要像三个分析师等行情时各自坚持自己的判断。

---

## § 6. LLM Model 锁定 — DeepSeek V4 Flash 默认（新）

### 6.1 价格表（2026-05-08 实查）

| Model                         | Input        | Output  |
| ----------------------------- | ------------ | ------- |
| **DeepSeek V4 Flash**（默认） | $0.14/M      | $0.28/M |
| DeepSeek V4 Pro               | $1.74/M      | $3.48/M |
| MiniMax fallback              | 类似（保留） | 类似    |
| Claude Haiku emergency        | 已有         | 已有    |

### 6.2 月成本估算（智能模式）

| Mode                     | V4 Flash 月成本 | V4 Pro 月成本 |
| ------------------------ | --------------- | ------------- |
| 持续生成（10 币 24h）    | $134            | $1670         |
| 完全按需                 | $9              | $112          |
| **智能（最近 1h 保留）** | **$54**         | **$668**      |

### 6.3 v2.0 默认配置

```typescript
LLM_PROVIDER_CHAIN = {
  primary: "deepseek-chat", // V4 Flash entry
  fallback: "minimax",
  emergency: "claude-haiku",
};

LLM_MONTHLY_BUDGET_USD = 200; // V4 Flash 智能模式有 4x 冗余
LLM_BUDGET_ALARM_THRESHOLD = 0.8; // 80% → alarm
LLM_BUDGET_AUTOPAUSE_THRESHOLD = 0.95; // 95% → 暂停 routine（hot 仍触发）
```

### 6.4 Budget tracker（已 stub 在 T1-core）

`src/lib/signal-engine/llm-budget-tracker.ts`（T1-core 内化的 stub）在 Batch 2 T2 实施时升级为：

- 每次 LLM call 写 KV：`budget:${YYYY-MM}:${provider}` += token cost
- Periodic check（每分钟）vs `LLM_MONTHLY_BUDGET_USD`
- 超 80% → POST internal alarm endpoint
- 超 95% → set flag `LLM_AUTOPAUSE=true`，chatOrchestrator routine 触发被拦截

---

## § 7. Batch 4 范围扩张（v3 关键变化）

### 7.1 v2 原 Batch 4

- task-18-v2：接 SignalEngine grounding + UI 暴露 evidence panel + 保留派别人设
- T5 / T9 / T13a-d / T26a-b / T26.1 / A1a-d / A1.1

### 7.2 v3 扩张后的 Batch 4

| Subtask              | 内容                                                                 | 来源           |
| -------------------- | -------------------------------------------------------------------- | -------------- |
| task-18-v2-grounding | SignalCard grounding（每条 message 关联 signalCardId + layer）       | v3 § 4         |
| task-18-v2-persona   | 派别 prompt 模板（4 段：identity / data anchor / style / forbidden） | v3 § 2.2       |
| task-18-v2-actions   | 11 ChatAction 专属 prompt 模板 + Action 选择算法                     | v3 § 3         |
| task-18-v2-periodic  | 新增 periodic_analysis trigger + 智能模式（lastAccessedAt）          | v3 § 5         |
| task-18-v2-budget    | LLM budget tracker 接 KV + alarm + autopause                         | v3 § 6.4       |
| T5 / T9 / T13a-d     | UI 升级（保留 v2 范围）                                              | v2             |
| T26a-b / T26.1       | Agent 主页 + 多维度展示                                              | v2             |
| A1a-d / A1.1         | affiliate URL（无 No-GO 限制）                                       | v2 + Q-A1 解锁 |

### 7.3 task-18 PR #27 处置

- v3.1 minimal patch（spec: `spec-task-18-v3-1-minimal-patch.md`）修币种错位 + cache 削弱 → 合 main
- v2.0 Batch 4 task-18-v2 在 task-18 PR #27 合 main 后从 main 拉新分支，做深度重做

---

## § 8. 已知风险（v3 新增）

继承 v2 已知风险列表 + 以下新增：

| #   | 风险                                                  | 触发条件                      | 应对                                                      |
| --- | ----------------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
| 8   | LLM budget 超支                                       | 用户量超预期 / routine 失控   | § 6.4 alarm + autopause；最坏停 routine 保 hot            |
| 9   | DeepSeek V4 Flash 输出质量不够（句式机械 / 错误率高） | Batch 4 上线后实测            | fallback 升级到 V4 Pro（成本 ×12 但能力更强）             |
| 10  | 派别 prompt 模板 LLM 难精确遵守                       | LLM 自由度太大                | guardrails 检测违反模板的输出（强制 retry）               |
| 11  | Action 选择算法逻辑黑盒                               | orchestrator 误选导致对话生硬 | dev mode log + Dan 14 天复盘看实际 action 分布            |
| 12  | periodic_analysis 在 0 用户币种触发浪费               | 智能模式判断失效              | KV 存 lastAccessedAt 严格检查；fallback 写入 metrics 兜底 |

---

## § 9. v3 不变项（重申）

- 5 batch + ops workstream 切分（v2 § 4）
- 41 subtask 数量（v2 § 4，加 § 7.2 v3 扩张实际超过 41）
- 5 个事实修正（v2 § 2）
- 第六维（Codex 实施现实）（v2 § 3）
- 6 包依赖政策豁免（v2 § 5）
- v2.0 不做的事清单（v2 § 6）
- 评审节奏 14/30/60/90 天（v2 § 7）

---

## § 10. v3 实施顺序（更新）

```
[现已并行进行]
┌─────────────────────────────────────────────────────┐
│ Codex Sweep（spec-codex-sweep-batch01-finalization）│
│ - T29 contrast 修订 + push                           │
│ - 9 PR + T29 PR 按依赖顺序 merge main                │
│ - 每次 merge 后 main 健康检查                        │
└─────────────────────────────────────────────────────┘

[等 Sweep 完成]
┌─────────────────────────────────────────────────────┐
│ task-18 v3.1 Minimal Patch                           │
│ Spec: spec-task-18-v3-1-minimal-patch.md             │
│ - 仅修 2 critical bug（币种错位 + cache）            │
│ - 合 main 后 task-18 工作落地                         │
└─────────────────────────────────────────────────────┘

[task-18 PR #27 合 main 后]
┌─────────────────────────────────────────────────────┐
│ Batch 2: LLM Provider 合并（T2 / T3）                │
│ Spec: 待写（spec-batch2-llm-unification.md）         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Batch 3: Agent 历史预测（T24 / T25 / T24.1 / T24.2） │
│ Spec: 待写                                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Batch 4: UI 升级 + task-18-v2 深度重做（v3 扩张范围）│
│ Spec: 待写（spec-batch4-ui-and-task-18-v2.md）       │
│ - SignalCard grounding                                │
│ - 派别 prompt 模板                                    │
│ - 11 ChatAction 真改 content                          │
│ - periodic_analysis trigger                           │
│ - LLM budget tracker                                  │
│ - K 线 + Agent 战绩可视化                             │
│ - affiliate URL CTA                                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Batch 5: 分流 + 病毒（T22 / T21 / T17 / T20）        │
│ Spec: 待写                                            │
└─────────────────────────────────────────────────────┘
```

---

## § 11. 文档元信息

- **创建**：2026-05-08 by Session C
- **基础**：locked-v2 + task-18 v3.final 验收暴露的 gap + Dan 拍板新方向（Q-NEW-1 修正：策略不是 IP / Q-NEW-2 V4 Flash）
- **决策版本**：locked-v3
- **冻结清单**：§ 1（Frame/Segments/Metrics/Q1-Q6）+ § 2.1（派别 = 策略 + 数据）+ § 5.3（智能模式）+ § 6.3（V4 Flash 默认）
- **下次允许变更**：(a) Batch 4 实施暴露派别 prompt 模板不可行 / (b) LLM budget 实测超 $200/月 / (c) v2.0 上线 14 天复盘暴露重大盲区

---
