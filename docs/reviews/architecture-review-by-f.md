# F 对两份评审稿的初评意见

> 评审者：F（claw42 web-dev session）
> 评审日期：2026-04-26
> 评审对象：
>
> - `docs/claw42-agent-service-architecture.md`（v1.0 评审稿）
> - `docs/coinw-integration-requirements.md`（v1.0 评审稿）
>   用途：交付 Codex 做交叉 meta-review，最终融合后用于 CoinW 跨团队评审会

---

## 总体定位（不打分，只描述）

两份文档技术骨架立得稳。Doc 1 把 CoinW = 数据真源、Claw 42 = 意图层这一权责关系定得清楚；Doc 2 用"必需 / 优先 / 待确认"三档把对 CoinW 的需求列得齐整。

问题集中在三处：

1. 边界场景和并发安全的设计缺口
2. 双文档之间评审问题、字段约束的双向引用缺失
3. 对 CoinW 评审的"提问效率"——CoinW 团队会被噪声淹没

---

# Doc 1: claw42-agent-service-architecture.md

## P0 — 必须先解决再交付评审

### F-D1-P0-1. 合约场景 setLeverage → placeOrder 串行没设计

- **位置**：§8.6 / §11
- **问题**：`CoinW Adapter` 列了 `placeFuturesOrder()`，但合约下单前必须先设置/确认杠杆 + 保证金模式 + 仓位模式。如果用户在同一对话里先要求"切到 50 倍"再下单，文档没说 setLeverage 是 trade intent 的一部分还是独立动作。两条 API 调用之间的状态丢失 → 用户用旧杠杆下单 → 风险全部转嫁用户。
- **建议**：(a) Confirmation API 内串行 setLeverage → wait → placeOrder（任一失败中止）；(b) trade_intents 数据模型加"前置依赖"字段标记。

### F-D1-P0-2. "已确认但订单状态未知"的兜底主体没指定

- **位置**：§12
- **问题**："应使用 clientOrderId 向 CoinW 查询"——谁去查？前端用户刷新触发？后端定时 reconciliation？webhook 拉？文档悬空。生产事故现场这是会被监管拷问的核心问题。
- **建议**：明确"submitted 状态超过 N 秒未结 → 后端 reconciliation 任务定期扫"，N 值约定下来。配合 §14 评审问题 5（webhook 是否支持）做兜底。

### F-D1-P0-3. OAuth token 反向 revoke 流程缺失

- **位置**：§8.1 / §8.2
- **问题**：用户在 CoinW App 撤销 Claw 42 授权后，Claw 42 怎么知道？如果 CoinW 不提供 webhook（Doc 2 §2 列为"优先支持"，意味着可能没有），当前流程会让 token 在 Vault 里僵尸停留，直到下次调 API 才发现 invalid——用户体验是"点了下单才提示授权失效"。
- **建议**：确认卡按钮按下时先 token-validity precheck（用 introspection 接口或最近一次成功 refresh 的时间窗 < 5 分钟），prefer 失败前置。

## P1 — 评审会上必被问

### F-D1-P1-4. Agent Conversation API 的 LLM 完全是黑盒

- **位置**：§8.3
- **问题**："调用 Agent 推理能力"一句话带过。安全团队会卡：用什么模型？外部 API 还是自部署？用户消息出境吗？合规团队会卡：消息会不会落到第三方训练数据？这是这份文档**对内评审最容易被打回的一条**。
- **建议**：补"使用 X 模型 / 部署方式 Y / 用户消息脱敏 Z"三件套，至少给安全团队一个评估锚点。

### F-D1-P1-5. 多设备并发对话没设计

- **位置**：§10 数据模型
- **问题**：用户桌面 + 手机同时开 Claw 42。agent_sessions 是否允许同一用户多 active session？同一 trade_intent 是否会被两端各自确认？文档没设防。

### F-D1-P1-6. "预计买入 ~0.001538 BTC"的责任界定缺

- **位置**：§5
- **问题**：这个数字 Claw 42 算的还是 CoinW pre-quote？市场快速波动下实际成交量 ≠ 显示——出 dispute 谁担责？
- **建议**：至少文案声明"indicative，最终以 CoinW 回执为准"。

### F-D1-P1-7. 撤单语义只覆盖 Claw 42 单向

- **位置**：§2
- **问题**：用户在 CoinW App 直接撤单，Claw 42 不感知。trade intent / receipt 状态过期。Claw 42 UI 上"我的订单"是否定时和 CoinW 对账？还是只显示 stale 数据？

## P2 — 可以延后但要标记

### F-D1-P2-8. trade_intents 字段缺

- 缺：`source_message_id`（关联 agent_messages）/ `confirmation_token`（防 CSRF/重放）/ `expires_at`（intent 有效期，2 小时后才点确认应过期）

### F-D1-P2-9. Agent 风险阈值校验没层

- **位置**：§11
- 用户说"全仓 100 倍开多"，Confirmation API 应触发二次确认或冷却期，不是无脑下发。

### F-D1-P2-10. 和 claw42.ai 当前对外文案的 gap 没列

- 落地页 Hero / Scenarios 卡片讲"自动化交易 / AgentFi"
- 本架构 §2 "本版本不包含" 明确不做这些
- 需要专门一节说"v1 对外说什么、不说什么"，避免落地页和产品对不上

---

# Doc 2: coinw-integration-requirements.md

## P0 — 评审效率核心问题

### F-D2-P0-1. 没区分"v1 必须"和"想要"——CoinW 团队会被噪声淹没

- **位置**：全文
- **问题**：13 节里"必需 / 优先支持"二分但全混在一起。CoinW 评审会问"你们最起码要哪几条"。
- **建议**：文档头加一节"v1 上线 must-have 清单（10 行内）"——把所有"必需"里**真没有就上不了线**的那些抽出来。其余都是"想要"。

### F-D2-P0-2. 没说 Claw 42 自己的预期容量

- **问题**：通篇问 CoinW rate limit / quota / sandbox。但 Claw 42 v1 预计多少 DAU、订单峰值 QPS、并发授权数？没数。CoinW 看到反应是"你们到底要打多少量？"，评审会拖一轮。
- **建议**：加一节"Claw 42 v1 预期容量"——粗估 + 留一倍 buffer，给 CoinW 一个评估锚点。

### F-D2-P0-3. OAuth scope 拆分缺 read-only

- **位置**：§2
- **问题**：列了 `identity.basic / account.read / spot.trade / futures.trade`。但 `spot.trade` 是否隐含读权限没明说。用户初授可能只想给 read，确认后才升级到 trade——这种渐进授权当前 scope 没法表达。
- **建议**：显式列 `spot.read` / `futures.read`，让 trade scope 严格只覆盖写动作。

## P1

### F-D2-P1-4. clientOrderId 生成规则缺

- **位置**：§5
- 只问 CoinW 怎么处理重复，没说 Claw 42 自己怎么生成。`claw42_<intent_id>` 还是 UUIDv4？字符长度受 CoinW 上限约束没？

### F-D2-P1-5. 订单来源标识"是否对终端用户可见"是商务问题

- **位置**：§6
- CoinW 合规可能不允许第三方 appId 暴露在用户订单历史。提前给 CoinW 一个 fallback："仅 CoinW 内部审计可见"我们也接受。

### F-D2-P1-6. 错误码列表漏了 admin-side 禁用

- **位置**：§9
- "OAuth app 被 CoinW 整体禁用"这种错误码 Claw 42 怎么应对？告诉用户"服务暂停"还是"重授权"？

### F-D2-P1-7. Webhook 签名/重试/replay 防护没要求

- **位置**：§7
- 任何 webhook 集成的基本盘，文档没列。

## P2

### F-D2-P2-8. Sandbox 数据保留时长没问

- sandbox 通常定期清空，QA 跨周测试会卡。

### F-D2-P2-9. OAuth app secret 轮换的 Claw 42 侧 SLA 没约定

- **位置**：§11
- 应该是双方约定"X 月轮换、Y 天双 secret 重叠"。

### F-D2-P2-10. 合约结算币种（USDT 本位 vs 币本位）没问

- **位置**：§4

---

# 两份文档间的一致性问题

### F-X-1. 评审问题严重重叠且表述不一致

- Doc 1 §14（7 条） vs Doc 2 §14（10 条）问的同一批事但措辞略有差异。CoinW 评审会上同一问题会被回答两次。
- **建议**：抽出来做第三份文档 `coinw-review-questions.md`，两份文档都引用，避免分裂。

### F-X-2. 数据模型字段和需求清单字段没双向对照

- Doc 1 §10 `trade_intents` 列了 leverage / margin_mode / position_mode
- Doc 2 §4 合约必需字段也列了同样几个
- 没显式说"trade_intents 字段全部来自 CoinW API 必需字段"，未来 CoinW 字段变更时这两份文档容易漂移。

### F-X-3. 安全约束的两面分别在两份里出现，没交叉引用

- Doc 1 §11 执行规则："前端不直接调 CoinW"
- Doc 2 §11 安全要求："Claw 42 后端固定出口 IP 白名单"
- 同一约束的两面，没显式互引。

---

# 写作层面（小问题）

- 产品名"Claw 42"在 Doc 1 里带空格，但当前 repo 代码里是 `claw42`，落地页 Hero 写 "Claw 42"。文档内统一"Claw 42"OK，团队需要意识到代码层面命名差异。
- 两份都用了"如支持"——是合理的条件性表述，不是 hedge。
- 没出现禁用词（"值得注意的是" / "综上所述" / "赋能" 等）。

---

# F 自检：哪些维度可能被我漏掉

F 评审的盲点候选（让 Codex 重点扫这些角度）：

1. **链上/合约语义层面的精确性**：F 不做合约具体的 cross-margin / isolated-margin / hedge mode 实现细节——文档里"保证金模式 / 仓位模式"是否表述准确，F 不能担保
2. **CoinW 的实际 API 风格**：F 只看了文档没接触过 CoinW 真实 API。某些"必需接口"列表可能 CoinW 实际叫法不一样、或某些字段 CoinW 不支持。需要 Codex 或 CoinW 团队补
3. **国际化合规**：阿语 / 俄语市场的金融合规细节（如俄罗斯央行的加密交易限制）F 没考察
4. **数据库容量预估**：trade_intents / agent_messages 表按 v1 预期 DAU 和保留时长，存储/查询性能 F 没估
5. **冷启动状态**：用户第一次进 Claw 42、还没授权时的 UI 流程，文档没专门一节说

---

# F 给的优先处理顺序建议

1. **先合并评审问题**到第三份文档（30 分钟工作量，最高 ROI）
2. **Doc 1 P0-1/2/3** 必须在评审会前补上，否则会议会卡死
3. **Doc 2 P0-1/2** 加"v1 must-have"和"Claw 42 容量预期"两小节，让 CoinW 评审能聚焦
4. **Doc 1 P1-4 LLM 黑盒** 内部安全/合规对齐后再发评审

---

_F 评审到此为止。下一步交 Codex 做交叉 meta-review。_
