# Codex 对 F 评审意见的交叉评审 + 独立补充

> 评审者：Codex（OpenAI Codex）
> 评审日期：2026-04-26
> 评审输入：
> - docs/claw42-agent-service-architecture.md v1.0
> - docs/coinw-integration-requirements.md v1.0
> - docs/reviews/architecture-review-by-f.md（F 初评）

---

## Part A — 对 F 评审的逐条交叉评审

### Doc 1 部分

#### F-D1-P0-1. 合约场景 setLeverage → placeOrder 串行没设计
- F 的判断：文档没有说明合约下单前杠杆、保证金模式、仓位模式与下单 API 的串行关系，可能用旧状态下单。
- Codex 判断：部分成立
- 理由：Doc 1 §5 已要求合约确认卡展示杠杆、保证金模式、仓位模式；Doc 2 §4 也要求设置或查询这些能力。F 抓到的缺口成立：展示字段不等于执行语义。但 F 直接假设一定需要 setLeverage → wait → placeOrder 串行，取决于 CoinW API 是否把杠杆、保证金模式作为订单参数、账户级状态，还是单独状态变更 API。这个不能在 Claw 42 文档里先替 CoinW 下结论。
- 建议修订：保留为高优先级问题，但改成条件化表述：如果 CoinW 合约下单需要先修改账户级杠杆、保证金模式或仓位模式，Confirmation API 必须把这些前置动作建模为 trade intent 的执行步骤，并在任一前置步骤失败时中止下单。不要提前锁死具体串行方案。

#### F-D1-P0-2. 已确认但订单状态未知的兜底主体没指定
- F 的判断：Doc 1 只说用 clientOrderId 或 order id 查询最终状态，没有说明由谁查、何时查、如何兜底。
- Codex 判断：成立
- 理由：Doc 1 §12 只定义了订单状态未知时的查询方式，没有定义责任主体和状态机。不采纳会导致用户确认后出现灰色地带：Claw 42 不知道订单是否成功，用户也无法判断是否应重试。
- 建议修订：补一个 unknown 状态处理流程。当前版本不做 Agent Worker，因此不必采用长期后台任务。可以定义为：确认 API 同步等待 CoinW 返回；超时则写入 execution_receipts.status = unknown；前端立即展示状态查询按钮；后端提供按 clientOrderId 查询的 reconciliation endpoint；用户打开订单页或点击刷新时触发查询；如果 CoinW 提供 webhook，再升级为 webhook 优先。

#### F-D1-P0-3. OAuth token 反向 revoke 流程缺失
- F 的判断：用户在 CoinW 侧撤销授权后，Claw 42 不知道，token 可能僵尸停留到下次调用才暴露。
- Codex 判断：部分成立
- 理由：Doc 2 §2 已把用户取消授权后的处理机制、token introspection、revoke、撤销 webhook 列为需求，所以 F 不是发现完全空白。但 Doc 1 §8.1 / §8.2 没说明 Claw 42 侧如何响应撤销或 invalid token。由于当前版本不做后台自动运行，僵尸 token 不会导致后台自动下单；主要代价是用户确认时才失败。
- 建议修订：降为 P1 更准确。Doc 1 需要补 token precheck：确认交易前检查 token scope 和有效性；CoinW 返回 invalid_token / revoked 时，立即标记 token_ref 为 revoked，阻止提交，前端引导重新授权。

#### F-D1-P1-4. Agent Conversation API 的 LLM 完全是黑盒
- F 的判断：Doc 1 只写调用 Agent 推理能力，没有说明模型、部署方式、数据出境、脱敏和训练数据边界。
- Codex 判断：成立
- 理由：这是安全和合规评审会一定会追问的点。用户消息可能包含交易意图、资产规模、策略偏好，不能只用 Agent 推理能力一句带过。不采纳会影响安全团队判断数据流向，也会影响后续隐私文案。
- 建议修订：Doc 1 加 Agent 推理服务边界：模型提供方、自部署或外部 API、请求字段、脱敏策略、日志保留、是否用于训练、失败降级。若暂未确定，也要列为待评审项。

#### F-D1-P1-5. 多设备并发对话没设计
- F 的判断：用户多端同时打开时，同一 trade intent 可能被两个端重复确认。
- Codex 判断：成立
- 理由：Doc 1 §10 有 trade_intents 状态，但没有原子确认、状态锁、确认 token 或幂等策略。多端问题会改变真实行为：同一个用户可能在手机和桌面重复点确认。
- 建议修订：加 confirmation_token、expires_at、confirmed_at，并规定 Confirmation API 必须用数据库条件更新从 pending_confirmation 原子切换到 confirmed。第二次确认返回 intent already confirmed，不再调用 CoinW。

#### F-D1-P1-6. 预计买入约 0.001538 BTC 的责任界定缺
- F 的判断：确认卡里的预计数量没有说明来自 Claw 42 估算还是 CoinW 报价，行情变化会造成争议。
- Codex 判断：成立
- 理由：Doc 1 §5 的示例会被产品和法务视为用户承诺。若最终成交数量不同，用户会质疑确认卡误导。
- 建议修订：确认卡统一加最终以 CoinW 回执为准。更好的方案是将 estimated_quantity 字段标为 indicative，并显示计算时间或报价来源。

#### F-D1-P1-7. 撤单语义只覆盖 Claw 42 单向
- F 的判断：用户在 CoinW App 直接撤单后，Claw 42 本地状态可能过期。
- Codex 判断：成立
- 理由：Doc 1 §9 已说 CoinW 是最终数据源，但没有定义 Claw 42 UI 何时重新查 CoinW。若不采纳，Claw 42 订单页可能展示已过期状态。
- 建议修订：补订单展示策略：任何订单详情页打开时都查 CoinW；列表页显示本地状态时必须标注最近同步时间；用户手动刷新和页面重进会触发查询。

#### F-D1-P2-8. trade_intents 字段缺
- F 的判断：trade_intents 缺 source_message_id、confirmation_token、expires_at。
- Codex 判断：成立
- 理由：这三个字段分别解决可追溯、防重放、过期确认。它们不属于重后台能力，却直接影响交互式下单安全。
- 建议修订：采纳，并补 confirmed_at、cancelled_at、submitted_at，便于排障和审计。

#### F-D1-P2-9. Agent 风险阈值校验没层
- F 的判断：用户提出全仓高杠杆请求时，Confirmation API 应触发二次确认或冷却期。
- Codex 判断：部分成立
- 理由：Claw 42 当前定位是不重做 CoinW 风控，F 的表述容易把范围推重。但交互层仍要有最小安全摩擦，否则 Agent 可把明显高风险意图直接变成确认卡。
- 建议修订：不要叫风险阈值层，改为确认摩擦策略。仅做最轻规则：高杠杆、全仓、非主流交易对、大额订单触发二次确认文案。最终交易风控仍归 CoinW。

#### F-D1-P2-10. 和 claw42.ai 当前对外文案的 gap 没列
- F 的判断：当前落地页讲自动化交易，但架构文档明确本版本不做自动运行，需要文案边界。
- Codex 判断：成立
- 理由：这是产品口径风险，不是代码问题。若外部评审看到自动化交易文案和本版本范围不一致，会质疑产品是否过度承诺。
- 建议修订：Doc 1 增加对外文案边界：本版本支持对话确认下单，不支持后台自动运行；涉及自动交易的文案标为后续能力。

### Doc 2 部分

#### F-D2-P0-1. 没区分 v1 必须和想要
- F 的判断：Doc 2 把必需和优先项分散在各节，CoinW 团队难以快速判断上线最小依赖。
- Codex 判断：成立
- 理由：Doc 2 内容齐，但评审效率不高。CoinW 会先问缺哪几项无法上线，而不是逐节扫完整清单。
- 建议修订：在 §1 后增加 v1 上线阻断清单，控制在 10 条内：OAuth code flow、identity、account read、spot/futures trade、clientOrderId、order query、balance/position query、trading rules、error codes、sandbox。

#### F-D2-P0-2. 没说 Claw 42 自己的预期容量
- F 的判断：Doc 2 要求 rate limit 和 quota，但没有给 CoinW DAU、订单 QPS、授权并发数预估。
- Codex 判断：成立
- 理由：API 团队没有容量输入就无法给 rate limit、sandbox、告警阈值建议。不采纳会让评审会停在需求澄清。
- 建议修订：加 v1 容量预估，哪怕是区间：日活、峰值在线、每用户日均对话数、交易意图数、确认下单数、订单查询 QPS，并说明按 2 倍 buffer 评估。

#### F-D2-P0-3. OAuth scope 拆分缺 read-only
- F 的判断：scope 列了 account.read、spot.trade、futures.trade，但没有 spot.read 和 futures.read，渐进授权表达不够。
- Codex 判断：成立
- 理由：本产品需要先查余额、持仓和交易规则，再生成确认卡。只用 account.read 可能覆盖不清，只用 trade scope 又过度授权。
- 建议修订：scope 建议改为 identity.basic、account.read、spot.read、spot.trade、futures.read、futures.trade。trade scope 不应默认包含 read，除非 CoinW 明确这样设计。

#### F-D2-P1-4. clientOrderId 生成规则缺
- F 的判断：Doc 2 要求 CoinW 支持 clientOrderId，但没说 Claw 42 自己如何生成。
- Codex 判断：成立
- 理由：幂等不是只问 CoinW 支持即可。Claw 42 需要自己保证可追溯、长度合规、重试稳定。
- 建议修订：增加建议格式：claw42_{intent_id}_{attempt} 或 UUIDv7，并要求 CoinW 给出长度、字符集和唯一性窗口。

#### F-D2-P1-5. 订单来源标识是否对终端用户可见是商务问题
- F 的判断：来源标识不一定能展示给终端用户，需要 fallback。
- Codex 判断：成立
- 理由：Doc 2 §6 同时问内部审计和用户可见性，但没有给可接受方案。用户可见涉及 CoinW 交易历史产品口径，不是纯技术字段。
- 建议修订：明确最低要求是 CoinW 内部审计可见；终端用户可见为可选。

#### F-D2-P1-6. 错误码列表漏了 admin-side 禁用
- F 的判断：OAuth app 被 CoinW 禁用时，文档没有要求错误码和用户提示策略。
- Codex 判断：成立
- 理由：Doc 2 §12 要求 OAuth app 紧急禁用，但 §9 错误码没有覆盖 app_disabled 或 integration_suspended。若不补，Claw 42 无法区分服务暂停和用户授权失败。
- 建议修订：错误码增加 app_disabled、user_authorization_revoked、trading_scope_suspended，并要求 CoinW 给用户可展示文案建议。

#### F-D2-P1-7. Webhook 签名 / 重试 / replay 防护没要求
- F 的判断：Doc 2 只问 webhook 是否支持，没有列 webhook 安全和投递语义。
- Codex 判断：成立
- 理由：只拿到 webhook 但没有签名、事件 ID、重试策略，会把订单同步风险转移到 Claw 42。
- 建议修订：如支持 webhook，需提供签名算法、timestamp、event_id、重试次数、去重窗口、乱序处理建议和 replay 防护。

#### F-D2-P2-8. Sandbox 数据保留时长没问
- F 的判断：sandbox 数据可能清空，跨周 QA 会受影响。
- Codex 判断：成立
- 理由：这不会阻断架构评审，但会影响联调计划和测试复现。
- 建议修订：Sandbox 章节补数据保留时长、重置频率、测试账号余额重置方式。

#### F-D2-P2-9. OAuth app secret 轮换的 Claw 42 侧 SLA 没约定
- F 的判断：双方需要约定 app secret 轮换节奏和双 secret 重叠窗口。
- Codex 判断：成立
- 理由：Doc 2 §11 只问轮换流程，没有要求生效窗口。没有重叠窗口会造成生产短时不可用。
- 建议修订：要求 CoinW 支持双 secret 并行一段时间，Claw 42 承诺在窗口内完成切换。

#### F-D2-P2-10. 合约结算币种没问
- F 的判断：Doc 2 没问 USDT 本位和币本位。
- Codex 判断：成立
- 理由：文档只写合约标的和保证金金额，没声明线性合约、反向合约、结算资产。对合约首版是否只支持 USDT 本位影响很大。
- 建议修订：提升到 P1。明确 v1 只支持哪些合约类型，CoinW 需返回 contract_type、margin_asset、settlement_asset。

### 跨文档一致性部分

#### F-X-1. 评审问题严重重叠且表述不一致
- F 的判断：Doc 1 §14 和 Doc 2 §14 问题重复，建议抽第三份问题文档。
- Codex 判断：部分成立
- 理由：重复和措辞差异成立。但新增第三份文档可能让评审材料更散。更低成本做法是让 Doc 2 成为 CoinW 问题清单，Doc 1 只保留架构评审问题并引用 Doc 2。
- 建议修订：不要先新建 coinw-review-questions.md。先把 Doc 2 §14 设为唯一 CoinW 问题清单，Doc 1 §14 删除重复问题，只保留架构侧开放问题或链接 Doc 2。

#### F-X-2. 数据模型字段和需求清单字段没双向对照
- F 的判断：Doc 1 trade_intents 字段和 Doc 2 合约必需字段没有映射，后续容易漂移。
- Codex 判断：成立
- 理由：架构字段和 CoinW 字段若不对照，API 返回结构变化会影响前端确认卡、intent 存储和 adapter。这个问题会改变开发落地方式。
- 建议修订：新增字段映射表：UI confirmation field -> trade_intents field -> CoinW API field -> required / optional -> unknown pending CoinW。

#### F-X-3. 安全约束的两面分别在两份里出现，没交叉引用
- F 的判断：Doc 1 说前端不直接调 CoinW，Doc 2 说固定出口 IP 白名单，两边没有互引。
- Codex 判断：成立
- 理由：同一安全边界分散在两份文档里，安全团队容易只看一边。互引可以减少误读。
- 建议修订：Doc 1 安全执行规则引用 Doc 2 安全要求；Doc 2 安全章节说明这些要求服务于 Doc 1 的后端代理模式。

### 写作层面

#### W-1. Claw 42 和 claw42 命名差异
- F 的判断：文档内用 Claw 42 是合理的，团队需意识到代码层面是 claw42。
- Codex 判断：成立
- 理由：外部评审文档使用 Claw 42 符合品牌表达；代码和路径使用 claw42 不影响评审。需要避免在同一文档正文混用。
- 建议修订：无须改动架构内容。可在内部执行 spec 里保留命名约定，外部文档保持 Claw 42。

#### W-2. 如支持是合理条件表达
- F 的判断：两份文档使用如支持合理，不是模糊措辞。
- Codex 判断：成立
- 理由：对 CoinW 能力未知的评审稿必须使用条件表达，否则会把外部系统能力写成事实。
- 建议修订：保留如支持，但把关键依赖拆成必需和优先支持，避免所有问题都看起来同等重要。

#### W-3. 未出现禁用词
- F 的判断：文档没有明显 AI 味禁用词。
- Codex 判断：成立
- 理由：两份文档风格偏工程评审，没有营销腔。语言问题不是当前风险。
- 建议修订：无须处理。

### F 自检条目

#### S-1. 合约语义精确性可能不足
- F 的判断：F 无法担保 cross-margin、isolated-margin、hedge mode 等合约细节。
- Codex 判断：成立
- 理由：原文档使用保证金模式、仓位模式，但没有枚举值、账户级或订单级生效范围。这个风险会影响合约确认卡和 CoinW Adapter。
- 建议修订：在 CoinW 需求清单中要求合约枚举值字典，包含保证金模式、仓位模式、结算资产、合约类型、是否订单级传参。

#### S-2. CoinW 实际 API 风格可能不同
- F 的判断：F 只按通用 API 经验列需求，CoinW 实际接口可能不匹配。
- Codex 判断：成立
- 理由：Doc 2 当前是端点清单，但真实交易所 API 常按账户类型、产品线、版本号、签名方式拆分。单纯列接口名不够。
- 建议修订：把部分端点要求改成能力矩阵，让 CoinW 填充真实 endpoint、method、scope、rate limit、字段差异。

#### S-3. 国际化合规未考察
- F 的判断：阿语、俄语等市场金融合规未覆盖。
- Codex 判断：部分成立
- 理由：这不是 CoinW API 集成的核心阻断项，但 Claw 42 页面已有多语言，且产品涉及真实交易。至少需要地区可用性和展示限制，不应等上线后再补。
- 建议修订：作为 P2 加 region availability 需求：CoinW 返回用户所在地区是否允许现货、合约、Agent 交易入口展示。

#### S-4. 数据库容量预估未估
- F 的判断：trade_intents、agent_messages 的容量和查询性能未估。
- Codex 判断：成立
- 理由：Doc 1 定义本地保存对话和审计，Doc 2 又要求容量预估。没有保留期和行数估算，后端无法选表结构、索引、归档策略。
- 建议修订：加 v1 数据保留策略：agent_messages、trade_intents、execution_receipts、audit_logs 各自保留期、预计日增量、索引字段。

#### S-5. 冷启动状态缺专门流程
- F 的判断：用户第一次进入、未授权时 UI 流程没专门说明。
- Codex 判断：成立
- 理由：Doc 1 有用户流程，但没有未登录、已登录未交易授权、授权过期、scope 不足这些状态。冷启动会直接影响转化和客服解释。
- 建议修订：增加用户状态机：anonymous、coinw_logged_in、read_authorized、trade_authorized、authorization_expired、scope_insufficient。

## Part B — Codex 独立补充

### Doc 1 补充

#### C-D1-P0-1. Agent 输出到 Trade Intent 的结构化校验层缺失
- 位置：docs/claw42-agent-service-architecture.md §8.3 / §8.4
- 问题：文档说 Agent Conversation API 返回机器可读交易意图，但没有定义 schema 校验、字段置信度、歧义处理和禁止字段。用户说帮我开一点 BTC 这种模糊请求时，Agent 可能生成可执行订单。
- 建议：新增 Intent Parser / Validator。只有通过 schema 校验、交易对校验、数量明确、方向明确、订单类型明确的 intent 才能进入 pending_confirmation。模糊请求必须回问用户。
- 为什么 F 可能漏掉了这条：F 关注 LLM 数据流和黑盒问题，没有继续追到 LLM 输出如何变成可执行订单。

#### C-D1-P1-1. 账户快照有效期缺失
- 位置：docs/claw42-agent-service-architecture.md §8.6 / §12
- 问题：确认卡可能展示余额、预计数量、持仓或保证金信息，但文档没有说明这些数据的获取时间和有效期。用户停留几分钟后再确认，账户状态可能已经变化。
- 建议：确认卡增加 quote_or_snapshot_at 和 expires_at。超过有效期后必须重新查询 CoinW 并刷新确认卡。
- 为什么 F 可能漏掉了这条：F 提到预计数量责任界定，但没有把余额、持仓、保证金这些确认前置数据作为整体快照处理。

#### C-D1-P1-2. 用户冷启动状态机缺失
- 位置：docs/claw42-agent-service-architecture.md §4 / §7
- 问题：用户进入 Agent 页时可能处于未登录、已登录未授权、只读授权、交易授权、授权过期、scope 不足等状态。文档只写了理想路径。
- 建议：补状态机和每个状态的 UI CTA。未登录显示 Continue with CoinW；只读授权显示升级交易授权；授权过期显示重新授权；scope 不足显示缺少现货或合约权限。
- 为什么 F 可能漏掉了这条：F 在自检里标了冷启动，但主评审没有给具体状态设计。

#### C-D1-P2-1. 时间戳和时区标准缺失
- 位置：docs/claw42-agent-service-architecture.md §10 / §13
- 问题：trade_intents、execution_receipts、audit_logs 都有时间字段，但没有规定 UTC、毫秒精度、CoinW 返回时间戳格式、用户展示时区。
- 建议：所有存储使用 UTC ISO 8601 或 Unix ms；展示按用户 locale/timezone 转换；CoinW 原始时间戳保留 raw 字段。
- 为什么 F 可能漏掉了这条：F 的容量和并发关注点没有展开到时间语义。

#### C-D1-P2-2. 日志中的 PII 和交易敏感信息脱敏规则缺失
- 位置：docs/claw42-agent-service-architecture.md §8.7 / §13
- 问题：文档只禁止记录 token 和密钥。用户消息、交易意图、订单回执仍可能包含 user id、资产规模、策略偏好、IP、设备信息。
- 建议：Audit Log 拆成可排障摘要和受限敏感详情；默认日志脱敏 user id、IP、设备指纹和大额资产细节；敏感详情设置访问权限和保留期。
- 为什么 F 可能漏掉了这条：F 提到 LLM 合规，但没有单独审日志 PII 泄漏。

### Doc 2 补充

#### C-D2-P0-1. 端点清单应改成 CoinW 能力映射矩阵
- 位置：docs/coinw-integration-requirements.md §3 / §4 / §13
- 问题：文档列出许多必需接口，但真实 CoinW API 可能不是这些命名或分组。评审会上 CoinW API 团队更需要逐项映射能力、endpoint、scope、字段和限制。
- 建议：增加能力矩阵列：Claw 42 capability、CoinW endpoint、method、required scope、request fields、response fields、rate limit、sandbox support、owner。
- 为什么 F 可能漏掉了这条：F 只指出实际 API 风格可能不同，没有给出可落地的评审表结构。

#### C-D2-P1-1. 合约枚举值和账户级状态作用域需要 CoinW 明确
- 位置：docs/coinw-integration-requirements.md §4 / §8
- 问题：合约保证金模式、仓位模式、杠杆可能是账户级、交易对级或订单级状态。文档要求接口，但没有要求枚举值、默认值、作用域、切换生效时机。
- 建议：要求 CoinW 提供合约枚举字典，覆盖保证金模式、仓位模式、合约类型、结算资产、杠杆作用域和模式切换生效时间。
- 为什么 F 可能漏掉了这条：F 提到结算币种和 setLeverage 串行，但没有把所有合约枚举作为一个统一字典需求。

#### C-D2-P1-2. 地区可用性与产品展示限制接口缺失
- 位置：docs/coinw-integration-requirements.md §2 / §11
- 问题：多语言站点可能服务不同地区用户。Claw 42 需要知道某用户是否可使用现货、合约或交易授权，否则可能展示用户所在地区不可用的交易入口。
- 建议：要求 CoinW 提供 account eligibility 或 region availability 能力，至少返回 spot_enabled、futures_enabled、oauth_trade_enabled、restriction_reason。
- 为什么 F 可能漏掉了这条：F 自检提到国际化合规，但没有转化成具体 CoinW 能力需求。

#### C-D2-P1-3. Webhook 事件版本和顺序语义缺失
- 位置：docs/coinw-integration-requirements.md §7
- 问题：F 已提签名、重试和 replay，但还缺 event schema version、event_id、sequence、created_at、delivered_at。没有这些字段，Claw 42 难以处理乱序、重复和版本变更。
- 建议：Webhook 要求补 event_id、event_type、schema_version、sequence 或 update_time，并要求 CoinW 说明乱序事件处理。
- 为什么 F 可能漏掉了这条：F 聚焦 webhook 安全基础，没有展开事件演进和顺序问题。

#### C-D2-P2-1. clientOrderId 和来源字段的字符集、长度限制缺失
- 位置：docs/coinw-integration-requirements.md §5 / §6
- 问题：文档要求 clientOrderId 和来源字段，但没有要求 CoinW 给长度上限、允许字符集、是否大小写敏感、唯一性窗口。
- 建议：要求 CoinW 返回 clientOrderId_constraints 和 source_metadata_constraints。
- 为什么 F 可能漏掉了这条：F 提到生成规则，但没有拆到交易所字段约束。

### 跨文档补充

#### C-X-P0-1. v1 灰度发布和停用策略缺失
- 位置：两份文档
- 问题：文档有紧急禁用需求，但没有发布策略。真实交易功能不应直接全量开放。
- 建议：新增 rollout policy：内部测试、白名单、1% 用户、扩大比例；每阶段有订单失败率、授权失败率、未知订单状态率的停止条件。
- 为什么 F 可能漏掉了这条：F 提到事故处理和 kill switch，但没有从上线切流角度看。

#### C-X-P1-1. 数据保留期与删除策略缺失
- 位置：两份文档
- 问题：Doc 1 要保存对话、交易意图、审计日志，Doc 2 要安全与合规联系人，但没有定义保存多久、用户是否可删除、审计日志是否例外。
- 建议：定义 retention policy：agent_messages、trade_intents、execution_receipts、audit_logs 分别保留多久，哪些支持用户删除，哪些因审计保留。
- 为什么 F 可能漏掉了这条：F 提到容量预估，但没有连接到隐私和删除策略。

#### C-X-P1-2. 用户授权与免责确认的产品位置缺失
- 位置：两份文档
- 问题：Claw 42 是入口，CoinW 是执行方，但用户在确认交易时需要看到这层关系和风险提示。文档没有定义确认页必须展示的用户同意内容。
- 建议：Trade Intent 确认卡固定展示执行方 CoinW、资金在 CoinW、最终成交以 CoinW 回执为准、用户确认后提交真实订单。首次交易可要求额外勾选。
- 为什么 F 可能漏掉了这条：F 关注工程边界，未单独审用户授权文案位置。

## Part C — 最终合并意见（Codex 给 Dan）

### 1. 先把 CoinW 评审问题压缩成 v1 阻断清单和能力矩阵
- 涉及编号：F-D2-P0-1、F-D2-P0-2、F-D2-P0-3、C-D2-P0-1、C-D2-P1-1
- ROI 论证：这能直接提高 CoinW 评审效率，让 OAuth、现货、合约、幂等、错误码、sandbox 的缺口一次对齐。否则会议会先消耗在范围澄清。

### 2. 补订单生命周期和状态未知兜底
- 涉及编号：F-D1-P0-2、F-D1-P1-7、F-D2-P1-7、C-D2-P1-3
- ROI 论证：真实下单最怕未知状态。把超时、webhook、轮询、用户刷新、CoinW 查询责任讲清楚，能减少生产事故和客服成本。

### 3. 加固 Trade Intent 到确认提交的安全链路
- 涉及编号：F-D1-P1-5、F-D1-P2-8、F-D2-P1-4、C-D1-P0-1、C-D2-P2-1
- ROI 论证：这是 Claw 42 自己能控制的核心链路。schema 校验、确认 token、过期、幂等和字段约束做好后，重复下单和模糊意图风险会明显下降。

### 4. 明确 OAuth token 生命周期和冷启动 UI
- 涉及编号：F-D1-P0-3、C-D1-P1-2、F-D2-P1-6
- ROI 论证：OAuth 是入口。如果授权过期、scope 不足、CoinW app 被禁用时没有明确状态和用户提示，交易链路会在第一步卡住。

### 5. 把推理服务、日志和用户确认文案补成合规可评审材料
- 涉及编号：F-D1-P1-4、F-D1-P1-6、C-D1-P2-2、C-X-P1-2
- ROI 论证：这组问题不一定阻断 API 联调，但会阻断安全、法务和外部评审。补清楚后，Claw 42 作为入口、CoinW 作为履约方的关系会更稳。
