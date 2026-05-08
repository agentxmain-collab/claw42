# task-18 v3.final Codex 副审意见

## 0. Review Scope

来源判断：本次是 Claude v3.final 方案稿转 Codex 做交叉 peer review，不是直接实施任务。

审阅对象：

- `docs/task-18-v3-final-comprehensive-plan.md`，从主工作区读取。当前 `feature/watch-chat-immersive-01` 干净 worktree 中缺少该 spec 文件，这是流程风险。
- `docs/airy-tasks/task-18-watch-chat-immersive.md` 的 v3 / v3.1 / v3.2 相关段落，从主工作区读取。
- 当前实现分支 `feature/watch-chat-immersive-01`，基线 commit `20cf882 fix(watch): task-18 v3.1 tighten chat guardrails`。

全局结论：v3.final 的方向是对的，但**不建议按原稿直接进入 `v3.final.locked`**。需要先补 5 个 blocker，再锁版。

## 1. 评审问题 1-10 逐一回答

### 1. D5 链式互动启动参数够强吗？

不够稳。`FORCE_EXPECTS_REPLY_TURNS=4`、`FORCE_MENTION_PROBABILITY=0.7`、`MIN_TOTAL_MESSAGES=6` 是正确方向，但仅靠概率仍可能退化。

主要问题：

- 70% mention 是随机上限，不是验收下限。需要硬性保证前 6 条至少 2 条 `mentioning != null` 且带 `citedQuote`。
- 如果某条 LLM 输出违规后被沉默，`MIN_TOTAL_MESSAGES=6` 可能被 retry / drop 打破。需要 fallback/backfill 机制保证线程长度。
- `expectsReply` 被强制为 true 不等于下个 speaker 一定会引用它。链式感来自引用和反驳，不是布尔值本身。

建议锁版写法：

- 前 4 条强制 `expectsReply=true`。
- 第 2-6 条至少 2 条强制 mention，不满足时由 orchestrator 补齐，不交给概率。
- `MIN_TOTAL_MESSAGES=6` 前不允许进入 strategy synthesis。
- 增加 dev harness：跑 50 场 synthetic thread，全部满足 `message >= 6`、`first6 mention >= 2`、`mention has citedQuote`。

### 2. D7 派别 few-shot 每派 5 条够吗？

每派 5 条只能算最低启动量，不足以稳定覆盖不同触发场景。

建议每派至少 8-10 条，并按 action 类型分布：

- `open`
- `rebut`
- `agree`
- `question`
- `taunt`
- `concede`
- `gloat`
- `no-data / wait`

还需要加反例。只给正例，LLM 很容易把格式模仿成固定句式；反例可以明确禁止“报告口吻”“派别前缀”“有动作无方向”。

### 3. D8 typing 时长是否合理？

方向对，但部分参数会影响体感。

建议调整：

- `react: [200, 600]` 太短，用户可能看不到“正在思考”。建议 `500-900ms`。
- `concede: [2500, 4000]` 上限偏长，容易被理解成卡顿。建议 `1800-3000ms`。
- `rebut/question` 保持 1.2-3s 合理。
- 必须支持 `prefers-reduced-motion`，减少动画和等待时长。

注意：typing 不是为了真实模拟输入速度，而是为了让用户感知“Agent 在工作”。所以最短时间不能短到消失。

### 4. D9 同派别 10s 合并是否合理？

10s 阈值合理，但需要限制条件：

- 只能在同一 thread 内合并，不能跨 thread。
- 合并后仍需要保留 speaker identity，可以用左侧细色条、缩小头像占位或首条头像延伸。
- 合并气泡不应完全丢失数据时间。可只在首条显示完整头部，后续消息 hover / mobile 长按显示时间与数据 age。

如果只留空白占位，用户会觉得气泡归属不清，尤其在手机端快速滚动时。

### 5. D10 策略卡渐入是否过度？

不算过度，但 auto-scroll 需要约束。

建议：

- `1.5s meta typing + 200ms fade + 1.5s pulse` 可以保留。
- 自动滚动只在用户接近底部，或点击“直接看策略”时触发。
- 如果用户已经手动往上看历史，不要抢滚动。
- pulse 只做 1 次，且 reduced motion 下关闭。

否则“总结出来了”的仪式感会变成打断阅读。

### 6. D12 3 场 SEED_CHAT_THREADS 覆盖够吗？

三场覆盖了多头共识、分歧仍出策略、无共识，这三个核心结局是对的，但还缺两类关键体验：

- 数据失败 / 等数据场景：用户首次进入如果真实数据慢，seed 也要展示“Agent 不乱说”的能力。
- 无新闻 / 低波动闲聊场景：task-18 的一个核心目标是低波动时仍有工作感，这类 seed 必须出现。

另外，seed 内容需要明确标识为历史/样例，不要显示成 `just now` 或刚发生，否则会和真实数据混淆。

建议锁版要求：

- 3 场为最低数量。
- 至少 1 场必须包含 “无共识 / 等数据 / 不开策略”。
- seed message 的 `createdAt` 使用相对历史时间，UI 展示为“历史复盘”或自然时间，不冒充实时。

### 7. D15 性能上限过紧还是过松？

单 thread 25 次 LLM 调用合理。全局 30/min 和每日 50 场需要分环境处理。

风险点：

- 如果用 Vercel serverless 内存计数，全局限流在多实例下不可靠。
- 如果 30/min 是所有用户共享，生产环境可能过紧；如果只是单实例内存，生产环境又过松。
- `MAX_THREADS_PER_DAY=50` 适合作 preview demo，不适合作公开生产默认值。

建议：

- `MAX_LLM_CALLS_PER_THREAD=25` 保留。
- `MAX_RETRY_PER_THREAD=5` 保留，但 sanitize/retry 都要计入。
- `MAX_LLM_CALLS_PER_MINUTE_GLOBAL=30` 作为 preview 默认值，生产改 env 配置。
- 全局计数必须使用集中状态，或在 spec 中明确“preview memory guard，不承诺生产全局限流”。

### 8. 15 个维度全做是否过度设计？

维度本身都成立，但一次性全做容易再次形成 patch 链。问题不在“维度多”，而在缺少合同测试和锁版边界。

必做：

- D1-D6：文案、禁词、方向、链式启动，这是防翻车基础。
- D9：聊天 UI 归属和引用展示，否则不像真聊天。
- D15：成本/限流，否则容易烧 LLM。
- D12 的冷启动兜底，但 seed 内容可以先精简。

可延后或弱化：

- D10 动效 polish 可以先做轻版。
- D11 下场预告 chip 可以后置。
- D14 深度人设可以先保留在 prompt 层，人工评估后再扩。
- 关系图可后置，不影响当前 watch 首屏价值感。

### 9. 是否有遗漏维度？

有。见第 2 节。最关键遗漏是持久化模型、验收 harness、scroll ergonomics、locale 策略、seed 内容所有权。

### 10. 建议实施顺序？

建议不要按 D1-D15 顺序实现，而按风险层拆：

1. Contract + validator：禁词、方向、plain speech、mention schema、测试 harness。
2. Orchestrator：链式启动、强制 mention floor、min messages、限流。
3. Prompt + persona：few-shot、反例、签名词、no-data prompt。
4. UI：ChatMessageBubble、thread status、strategy reveal、collapse。
5. Cold start：seed/history/persistence、presence bar。
6. Observability + i18n：PostHog、dict、docs。

## 2. 我看到但 Claude 漏的维度

### P0-1. 持久化模型没有锁清楚

当前方案多处依赖 history、relationship debt、rate limit、seed fallback、recent debates。若继续使用 `.cache` 或进程内存，在 Vercel serverless 上不可靠。

锁版前必须二选一：

- 明确写成 preview demo memory，不承诺跨实例持久化。
- 或引入真实持久层，例如 Vercel KV / Redis / Postgres，并写清 key、TTL、并发策略。

不锁这一点，冷启动、关系演化、全局限流都会在生产环境漂。

### P0-2. 缺少可执行验收 harness

v3.final 提到“100 条样本”“dev mode 跑 10 场”，但没有定义脚本入口和报告格式。

建议新增：

- `npm run verify:chat-v3-final`
- 输出 JSON summary：thread_count、min_messages_pass、mention_floor_pass、forbidden_prefix_hits、ambiguous_action_hits、strategy_validation_failures。
- CI 至少跑 deterministic mock LLM 场景。

没有 harness，locked spec 仍会变成截图验收。

### P0-3. Seed 内容所有权不清

D12 写“F 起草，Dan 审”，这是正确流程，但 locked spec 不能让 Codex 临场编 seed。

建议：

- locked spec 只定义 schema 和 placeholder。
- 真正 seed 文案由 F/Dan 单独给出，作为输入资产。
- Codex 只做校验和接入。

### P0-4. 语言和安全口吻冲突

D7 鼓励“操 / 妈的 / 草 / 卧槽”，同时又要求“不脏话”。这会在不同语言、不同用户场景下变成不可控风险。

建议锁版写成：

- zh_CN 可用轻度情绪词，但不做人身攻击。
- en_US 和其他 locale 不直接翻译脏话，改为 mild slang。
- 增加 `PERSONA_SLANG_POLICY_BY_LOCALE`。

### P1-1. Scroll control 没有定义

聊天页最容易被 auto-scroll 破坏。需要定义：

- 用户在底部附近时自动跟随。
- 用户上滚后暂停自动跟随，显示“有新讨论”浮动按钮。
- 点击按钮再滚到底部。

### P1-2. 数据来源和 staleness 需要进 message contract

每条 message 需要能说明：

- 使用哪个 snapshot。
- `fetchedAt` 是什么时候。
- ticker source 是 CoinW / CoinGecko / fallback。
- 失败时是否由 fallback 生成。

这可以避免之前“所有币价格一样”这类 bug 再次混入分析文字。

### P1-3. Analytics schema 需要具体字段

只列事件名不够。建议每个事件固定 properties：

- `thread_id`
- `seed_type`
- `symbol`
- `agent_id`
- `action`
- `retry_count`
- `llm_calls`
- `duration_ms`
- `strategy_direction`
- `failure_reason`

### P1-4. 旧 R1/R2/R3 迁移边界要更硬

当前代码仍保留 `Utterance`、`rounds`、`DebateRound` 等旧模型用于兼容。locked spec 需要说清：

- API projection 可保留兼容字段。
- UI 不再渲染 Round/R1/R2/R3。
- 新增代码不得再依赖 `roundNumber` 驱动展示。

## 3. 我建议的实施顺序

### Commit 1: contracts + guardrails

- `ChatMessage` / `ChatThread` 必要字段补齐。
- 禁词 10 类正则。
- sanitize fallback。
- 方向硬约束。
- mention/citedQuote schema。
- `verify:chat-v3-final` 最小 harness。

### Commit 2: orchestrator + budget

- deterministic mention floor。
- min message enforcement。
- retry/drop/backfill 策略。
- LLM per thread 限制。
- preview/global budget guard。

### Commit 3: prompt/persona

- 每派 8-10 条 few-shot。
- 正反例。
- no-data / ticker fail prompt。
- locale slang policy。

### Commit 4: chat UI

- IM 气泡。
- mention 高亮。
- citedQuote 引用块。
- same-agent merge。
- action badge。
- reduced motion。

### Commit 5: cold start + thread lifecycle

- recent threads preload。
- seed fallback。
- presence bar 人性化文案。
- thread active/completing/completed。
- strategy reveal。
- long thread collapse。

### Commit 6: i18n + analytics + docs

- zh/en 主文案。
- 其他 locale 按当前产品策略 fallback。
- PostHog schema。
- README / architecture 注记。

## 4. 我建议的参数调整

| 参数                              | 原方案      | 建议                                             |
| --------------------------------- | ----------- | ------------------------------------------------ |
| `FORCE_EXPECTS_REPLY_TURNS`       | 4           | 保留，前 4 条硬 true                             |
| `FORCE_MENTION_PROBABILITY`       | 0.7         | 保留概率，但叠加“前 6 条至少 2 条 mention”硬下限 |
| `MIN_TOTAL_MESSAGES`              | 6           | 保留，且 strategy synthesis 前强制满足           |
| `QUIET_STREAK_FOR_END`            | 5           | 保留                                             |
| `MAX_TOTAL_MESSAGES`              | 20          | 保留，配合长 thread 折叠                         |
| `MAX_RETRY_COUNT_PER_THREAD`      | 5           | 保留，sanitize retry 也计入                      |
| `react typing`                    | 200-600ms   | 调为 500-900ms                                   |
| `concede typing`                  | 2500-4000ms | 调为 1800-3000ms                                 |
| same-agent merge                  | 10s         | 保留，但限制同 thread                            |
| strategy auto-scroll              | 无条件      | 改为“用户接近底部或主动点击时”                   |
| `MAX_LLM_CALLS_PER_MINUTE_GLOBAL` | 30          | preview 默认 30；生产 env 配置且需集中状态       |
| `MAX_THREADS_PER_DAY`             | 50          | preview 可用；生产 env 配置                      |

## 5. 全局判断

v3.final 整体方向：**需调整后再 locked**。

GO / NO-GO：

- `NO-GO`：不建议按当前 v3.final 原稿直接生成 `v3.final.locked`。
- `GO after patch`：补齐下面 5 条后，可以进入 locked。

必须补进 locked spec 的 5 条：

1. 持久化模型：preview memory 还是真实存储，必须明确。
2. 验收 harness：`verify:chat-v3-final` 和 JSON report。
3. deterministic mention floor：前 6 条至少 2 条 mention + citedQuote，不靠概率。
4. seed 内容所有权：F/Dan 提供内容，Codex 不临场编。
5. locale + slang policy：中文情绪词可用边界、其他语言 fallback 策略。

必做维度：

- D1-D6
- D8-D9
- D12 的冷启动兜底
- D15

可弱化但不应删除：

- D10 动效
- D11 下场预告
- D13 长会话折叠
- D14 深度人设

实施方式建议：**多 commit 一次性锁定范围**，不要单 commit 巨改。每个 commit 独立可验证，最终 PR 仍作为一个 task-18 v3.final 修复包合并。
