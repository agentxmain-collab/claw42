# Claw 42 安全评审 PRD

> 版本：v1.0  
> 日期：2026-04-27  
> 评审对象：外部安全评审团队、CoinW OAuth/API 团队、后端团队、产品团队  
> 产品范围：Claw 42 公开站点 + 下一阶段 Agent 交易服务

## 1. 文档目的

本文档用于外部团队对 Claw 42 进行安全评审。文档以产品需求视角描述当前线上能力、下一阶段 Agent 交易服务范围、用户路径、数据流、权限边界、安全要求、上线门槛和待评审问题。

Claw 42 是面向 CoinW 用户的 Agent 化交易入口。当前线上版本主要提供多语言落地页、移动端首屏、复制类 CTA、语言切换和轻量匿名埋点。下一阶段将增加 CoinW OAuth 授权、Agent 对话、结构化交易意图、用户确认卡，以及由 Claw 42 后端调用 CoinW API 提交真实订单的能力。

CoinW 仍然是身份、账户、资产、余额、持仓、订单、成交、交易规则和交易所侧风控的最终服务方与最终数据源。Claw 42 不托管资金，不提供提币能力，不成为交易所，不作为订单账本的最终数据源。

## 2. 安全评审目标

外部安全评审需要判断：Claw 42 是否可以安全支持 CoinW OAuth 授权，以及用户在 Agent 对话中确认后提交真实交易。

重点评审范围：

- OAuth 授权流程、scope 边界、token 存储、刷新、撤销和紧急停用。
- CoinW access token、refresh token、OAuth app secret、API secret 的保护。
- Agent 生成交易意图后的校验、确认、幂等和防重复提交。
- 对话、交易意图、执行回执、审计日志和匿名埋点的数据处理。
- 日志和可观测性是否会泄露 token、密钥、个人信息或敏感交易信息。
- 前端是否被严格限制为交互层，不直接调用 CoinW 交易 API。
- Agent 推理服务的数据流、模型/供应商边界、提示词和输出安全。
- 事故处理能力，包括全局停用、单用户授权撤销、未知订单状态恢复。

## 3. 当前线上产品面

### 3.1 路由

```text
/{locale}
/{locale}/app
/api/analytics
```

### 3.2 已上线能力

- 多语言公开落地页。
- 移动端 app-like 首屏。
- Hero CTA 点击复制。
- API Docs CTA。
- Daily Report CTA 点击复制。
- Header 自定义语言下拉。
- 轻量匿名埋点，写入 Vercel logs。

### 3.3 当前线上安全边界

- 当前线上不包含 Claw 42 独立账户系统。
- 当前线上不包含 CoinW OAuth。
- 当前线上不处理 CoinW token。
- 当前线上不包含交易后端。
- 当前线上不能提交真实订单。
- 当前埋点不使用 cookie、localStorage 标识符、用户 ID 或数据库。

## 4. 下一阶段目标产品面

### 4.1 计划路由

```text
/{locale}/agent
/{locale}/agent/chat
/{locale}/agent/orders
/{locale}/agent/settings
```

### 4.2 目标能力

- 用户通过 CoinW OAuth 登录和授权。
- 用户根据产品动作授权只读或交易 scope。
- 用户在 Claw 42 与 Agent 进行自然语言对话。
- Agent 返回自然语言解释和机器可读的结构化交易意图。
- Claw 42 后端校验结构化交易意图。
- 前端展示交易确认卡。
- 用户确认、修改或取消交易意图。
- 用户明确确认后，Claw 42 后端调用 CoinW API 提交订单或撤单。
- Claw 42 展示 CoinW 返回的结果，并保存必要审计记录。

## 5. 明确不做

下一阶段不包含：

- Agent Worker。
- 后台自动运行。
- Claw 42 后台持续盯盘。
- Claw 42 托管式条件触发下单。
- 未经用户确认的自动下单。
- 资金托管、充值、提现或划转。
- Claw 42 自建交易账户体系。
- Claw 42 自建订单最终账本。
- 外部 Agent SDK。
- Agent Marketplace。
- Agent 排行榜。
- 战绩广场。
- 分润系统。

如果 CoinW 原生支持条件单、触发单、止盈止损或 TP/SL，Claw 42 只能在用户确认完整订单参数后提交对应 CoinW 原生订单，不在 Claw 42 后台自行托管触发逻辑。

## 6. 角色定义

| 角色          | 说明                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| 匿名访客      | 未登录情况下访问 Claw 42 公开页面的用户。                                              |
| CoinW 用户    | 通过 CoinW OAuth 登录并授权的用户。                                                    |
| Claw 42 前端  | 浏览器应用，负责落地页、OAuth 入口、Agent 对话、确认卡和订单结果展示。                 |
| Claw 42 后端  | 负责 OAuth callback、Token Vault、Agent 编排、交易意图状态、CoinW Adapter 和审计日志。 |
| Claw 42 Agent | 将用户自然语言请求解释为自然语言回复和结构化交易意图的 AI 交互层。                     |
| CoinW         | 身份、账户、资产、订单、成交、持仓、交易规则和交易所侧风控服务方。                     |
| 安全评审团队  | 评审权限、数据流、存储、日志、滥用场景和事故处理能力。                                 |

## 7. 用户主流程

```text
用户进入 Claw 42 Agent 页面
  -> 点击 Continue with CoinW
  -> 完成 CoinW OAuth 登录和授权
  -> 回到 Claw 42 Agent 对话页
  -> 用户发送自然语言交易请求
  -> Agent 生成交易意图
  -> Claw 42 校验交易意图
  -> 前端展示确认卡
  -> 用户确认 / 修改 / 取消
  -> Confirmation API 原子确认该 intent
  -> 后端使用幂等键提交 CoinW API
  -> CoinW 返回订单结果或错误
  -> Claw 42 保存执行回执和审计日志
  -> 前端展示最终状态或状态恢复入口
```

## 8. 功能需求

### 8.1 OAuth 与授权

- Claw 42 必须使用 CoinW OAuth 作为主登录和授权路径。
- OAuth callback 必须在 Claw 42 后端处理。
- 前端不得接收 CoinW access token 或 refresh token。
- token refresh、token revoke、token introspection 或等效权限检查必须在后端完成。
- 用户授权过期、scope 不足或授权被撤销时，前端必须引导重新授权。
- Claw 42 只请求当前动作所需的最小权限。
- 如 CoinW 支持，登录授权和交易授权应分步。
- 如 CoinW 支持，现货与合约权限应拆分。

建议评审 scope：

```text
identity.basic
account.read
spot.read
spot.trade
futures.read
futures.trade
```

交易 scope 必须明确不包含提币能力。

### 8.2 Agent 对话与交易意图

- 用户消息由 Agent Conversation API 接收。
- Agent 返回应拆分为自然语言解释和结构化交易意图。
- 结构化交易意图必须通过 schema 校验后才能进入可确认状态。
- 模糊请求必须回问用户，不得直接生成可确认订单。
- 缺少交易对、方向、订单类型、数量、价格或合约必要字段时，不得展示确认按钮。
- 不支持的 symbol、market type、order type 必须在确认前拦截。
- Agent 输出不得绕过后端校验直接提交订单。

### 8.3 交易确认卡

确认卡必须展示：

- 市场类型：现货 / 合约。
- 交易对或合约标的。
- 方向：买入 / 卖出 / 开多 / 开空。
- 订单类型：市价 / 限价 / CoinW 支持的其他类型。
- 数量、金额、价格。
- 合约杠杆、保证金模式、仓位模式，如适用。
- 止盈止损或触发条件，如 CoinW 原生支持。
- 执行方：CoinW。
- 资金所在位置：CoinW 账户。
- 最终成交和订单状态以 CoinW 回执为准。
- 用户确认后将提交真实订单。

高风险参数可触发更强确认摩擦，例如高杠杆、全仓、大额、非主流交易对。该确认摩擦只用于交互安全，不替代 CoinW 风控。

### 8.4 Trade Intent 状态

每个 `trade_intent` 至少包含：

```text
intent_id
source_message_id
claw42_user_id
coinw_user_id
agent_id
market_type
symbol
side
order_type
price
quantity_or_amount
leverage
margin_mode
position_mode
take_profit
stop_loss
status
confirmation_token
quote_or_snapshot_at
expires_at
confirmed_at
cancelled_at
submitted_at
created_at
updated_at
```

状态规则：

- 只有 `pending_confirmation` 状态可以被确认。
- 用户确认必须使用 `confirmation_token`。
- 确认动作必须使用数据库原子状态切换。
- 同一 intent 被多端重复确认时，只允许一次提交 CoinW。
- 过期 intent 必须重新查询 CoinW 并刷新确认卡。
- 用户取消后，不得再确认同一 intent。

### 8.5 订单提交与幂等

- 所有 CoinW API 调用必须通过 CoinW Adapter。
- 前端不得直接调用 CoinW 交易 API。
- 业务代码不得绕过 CoinW Adapter 分散调用 CoinW。
- 每次订单提交必须带 `clientOrderId` 或 CoinW 等效幂等键，如 CoinW 支持。

建议 `clientOrderId` 格式：

```text
claw42_{intent_id}_{attempt}
```

Claw 42 必须保存：

```text
receipt_id
intent_id
client_order_id
coinw_order_id
market_type
submitted_payload_summary
coinw_response_summary
status
error_code
created_at
```

如果 CoinW API 超时或状态未知，Claw 42 不得使用新的 id 盲目重试。必须通过 `clientOrderId` 或 CoinW order id 查询最终状态。

### 8.6 订单状态与恢复

- CoinW 是订单状态最终数据源。
- 打开订单详情页时应实时查询 CoinW。
- 订单列表可以显示本地缓存，但必须展示最近同步时间。
- 用户必须有手动刷新订单状态的入口。
- 如果 CoinW 支持 webhook，应优先使用 webhook 更新状态。
- 如果 CoinW 不支持 webhook，需要 CoinW 给出建议轮询频率和 rate limit。
- Webhook 必须支持签名、时间戳、事件 ID、重放防护和重复事件处理。

## 9. 安全需求

### 9.1 前端与浏览器边界

- 浏览器不得存储或展示 CoinW token。
- 浏览器不得包含 CoinW app secret。
- 浏览器不得直接请求 CoinW 交易 API。
- 订单确认必须来自用户在 Claw 42 UI 内的明确动作。
- 登录后的敏感操作需要符合最终 session/auth 方案下的 CSRF 防护要求。
- 前端错误提示不得暴露 token、签名、密钥、原始 provider payload 或堆栈。

### 9.2 Token Vault

- access token 和 refresh token 必须加密存储。
- token 明文不得进入日志、埋点、错误上报或前端响应。
- token 只能由后端授权模块、Token Vault 和 CoinW Adapter 使用。
- 用户断开连接、CoinW revoke、CoinW invalid_token 返回后，本地 token reference 必须立即标记不可用。
- OAuth app secret 需要支持轮换流程；如 CoinW 支持双 secret，应约定并行窗口。

### 9.3 后端 API 控制

- 后端必须校验用户身份、intent ownership、scope、intent status、confirmation token。
- OAuth、Agent 消息、intent 创建、确认、订单查询、埋点写入都需要限频策略。
- 请求 body 大小必须有限制。
- 埋点和日志字段名、字段值长度必须有限制。
- CoinW 错误需要归一化，区分可重试和不可重试。

### 9.4 CoinW API 控制

- CoinW Adapter 负责所有 CoinW 请求封装。
- 如 CoinW 支持，订单请求应携带来源标识：

```text
source = claw42
agent_id
intent_id
client_order_id
```

- 如 CoinW 支持固定出口 IP 白名单，Claw 42 生产后端出口 IP 应进入白名单。
- 如 CoinW 支持 OAuth app 紧急禁用，Claw 42 前端需要有明确的服务暂停提示。
- CoinW 需要提供完整错误码、rate limit、重复 `clientOrderId` 行为和订单状态流转说明。

### 9.5 Agent 推理边界

安全评审必须确认：

- 使用的模型或模型服务商。
- 是否调用第三方模型 API。
- 用户 prompts 和 completions 是否被模型服务保留。
- 用户 prompts 和 completions 是否用于训练。
- 是否会向模型发送 user id、account id、order id、余额、持仓或其他敏感字段。
- 如何处理用户消息中的 prompt injection。
- Agent 输出如何经过 schema 校验和业务校验后再进入确认卡。

在该方案确定前，Agent 推理服务应被视为高敏数据处理边界。

### 9.6 日志与审计

日志严禁包含：

- CoinW access token。
- CoinW refresh token。
- OAuth app secret。
- API signing secret。
- 完整 Authorization header。
- Webhook signing secret。

以下信息需要最小化、脱敏或限制访问：

- CoinW user id。
- IP 地址。
- User-Agent。
- 设备和浏览器细节。
- 用户完整自然语言交易消息。
- 完整资产余额快照。
- 完整持仓详情。
- 大额订单细节或策略偏好。

审计日志需要足以支持排障、争议处理和事故调查：

```text
event_id
event_type
claw42_user_ref
coinw_user_ref
intent_id
client_order_id
coinw_order_id
action
request_summary
response_summary
status
error_code
created_at
```

## 10. 埋点隐私要求

当前匿名埋点约束：

- 不接入第三方 analytics SDK。
- 不使用 analytics cookie。
- 不上传用户 ID。
- 不在应用 payload 中上传 IP。
- referrer 只保留 origin + pathname。
- UTM 参数使用 allowlist。
- event name 使用 allowlist。
- 属性 key 和 value 长度有限制。
- 数据写入 Vercel logs，类型为 `claw42_analytics`。

未来如要在登录后加入用户级、session 级或跨页行为追踪，必须重新提交安全评审。

## 11. 数据分类

| 数据                | 敏感等级     | 来源            | Claw 42 是否保存               | 安全要求                           |
| ------------------- | ------------ | --------------- | ------------------------------ | ---------------------------------- |
| 公开落地页文案      | 公开         | Claw 42         | 静态文件                       | 不含用户数据。                     |
| 匿名埋点事件        | 低敏         | 前端            | Vercel logs                    | 不含 cookie、用户 ID、IP payload。 |
| CoinW user id       | 敏感标识符   | CoinW           | 用户映射表                     | 限制访问，脱敏展示。               |
| OAuth access token  | Secret       | CoinW           | Token Vault                    | 加密存储，严禁日志。               |
| OAuth refresh token | Secret       | CoinW           | Token Vault                    | 加密存储，支持 revoke。            |
| 用户消息            | 敏感用户内容 | 用户            | Agent messages                 | 可能包含策略、意图、资产规模。     |
| Agent 输出          | 敏感衍生内容 | Agent           | Agent messages / trade intents | 必须校验后才可确认。               |
| Trade intent        | 敏感交易指令 | Claw 42         | trade_intents                  | 需要 ownership、过期和确认 token。 |
| Execution receipt   | 敏感交易引用 | CoinW / Claw 42 | execution_receipts             | 保存摘要和 id，不保存密钥。        |
| Audit log           | 受限运营记录 | Claw 42         | audit_logs                     | 权限控制和保留期。                 |
| 余额/持仓快照       | 敏感金融数据 | CoinW           | 可选短缓存                     | 短 TTL，不作为最终数据源。         |

## 12. 数据保留建议

初始建议，需安全、法务和运营最终确认：

| 数据               | 建议保留期             | 删除策略                            |
| ------------------ | ---------------------- | ----------------------------------- |
| 匿名埋点日志       | 30-90 天               | 随日志保留策略删除。                |
| Agent messages     | 90-180 天              | 用户删除请求下按规则删除或匿名化。  |
| Trade intents      | 1-2 年                 | 涉及真实订单时用于客服和审计。      |
| Execution receipts | 1-2 年                 | 保存订单引用和摘要用于争议处理。    |
| Audit logs         | 1-2 年                 | 受限删除，需定义合规例外。          |
| OAuth tokens       | 到期、断连或 revoke 前 | revoke/断连后立即删除或标记不可用。 |
| 余额/持仓缓存      | 分钟级到小时级         | 短 TTL，不能作为 source of truth。  |

## 13. 滥用与异常场景

产品必须覆盖：

- 用户输入模糊交易请求。
- Agent 输出无效或缺字段 intent。
- 用户确认已过期 intent。
- 用户多端重复确认同一 intent。
- 用户确认后网络中断。
- CoinW API 收到订单但 Claw 42 超时。
- CoinW 订单成功但 Claw 42 未收到响应。
- 用户在 CoinW 侧撤销授权。
- CoinW app 被禁用或暂停。
- 用户只有只读权限，没有交易权限。
- 用户有现货权限，但没有合约权限。
- 用户所在地或账户状态不允许某类交易。
- Webhook 重复、延迟、乱序或被重放。
- 触发 API rate limit。
- CoinW 返回未知或未映射错误码。

## 14. 上线门槛

Agent 交易服务上线前必须满足：

- CoinW 确认 OAuth flow、scope、revoke 行为和无提币权限边界。
- Token Vault 设计通过安全评审。
- OAuth app secret 轮换流程通过评审。
- Trade Intent schema validation 已实现。
- Confirmation API 已实现原子状态切换和 confirmation token。
- 幂等策略已与 CoinW 联调验证。
- 未知订单状态恢复流程已实现。
- 日志脱敏规则已实现并验证。
- Agent 推理服务商、数据保留和训练策略已明确。
- Sandbox/testnet 覆盖 OAuth、现货下单、合约下单、撤单和常见失败。
- 存在全局停止 Claw 42 下单的应急开关。
- 存在单用户断连/revoke 路径。
- 确认卡包含 CoinW 执行、资金在 CoinW、最终状态以 CoinW 为准、确认后提交真实订单等提示。

## 15. 需要外部团队提供的输入

CoinW/API/安全团队需要提供：

1. OAuth authorization code flow 文档。
2. Scope 列表和权限映射。
3. 请求 scope 不包含提币能力的确认。
4. Token refresh / revoke / introspection / app disable 文档。
5. OAuth app secret 轮换流程和双 secret 支持情况。
6. 现货交易 API 文档。
7. 合约交易 API 文档。
8. 交易规则 API 文档。
9. 错误码和 rate limit 文档。
10. `clientOrderId` 约束和重复请求行为。
11. 来源字段 `source / agent_id / intent_id` 的存储、返回和检索能力。
12. 订单查询和状态恢复建议。
13. Webhook 文档，包括签名、重放防护、重试、顺序和 schema version。
14. Sandbox/testnet 接入方式和数据保留策略。
15. IP 白名单支持和生产出口要求。
16. 安全事故升级联系人。
17. 地区/账户可用性能力，如支持。

## 16. 待安全评审确认问题

| 领域         | 问题                                               | 上线前是否必须确认 |
| ------------ | -------------------------------------------------- | ------------------ |
| OAuth        | 登录授权和交易授权是否可以分离？                   | 是                 |
| OAuth        | 现货和合约交易 scope 是否可以分离？                | 是                 |
| OAuth        | 请求 scope 是否能保证不包含提币能力？              | 是                 |
| Token Vault  | 使用哪种 KMS / secret storage？                    | 是                 |
| Agent 推理   | 哪个模型或服务商处理用户消息？                     | 是                 |
| Agent 推理   | prompt/completion 是否保留或用于训练？             | 是                 |
| Trade Intent | 哪套 schema 和校验规则定义可确认订单？             | 是                 |
| 幂等         | 最终 `clientOrderId` 格式和唯一性窗口是什么？      | 是                 |
| CoinW API    | 重复提交同一 `clientOrderId` 会发生什么？          | 是                 |
| 状态恢复     | 超时和 unknown status 的恢复流程是什么？           | 是                 |
| Webhook      | 是否支持签名、timestamp、event_id 和 replay 防护？ | 否，若批准轮询方案 |
| 日志         | 哪些字段允许进入运营日志和埋点日志？               | 是                 |
| 数据保留     | 最终保留期和删除策略是什么？                       | 是                 |
| 应急开关     | 如何立即停止 Claw 42 的全部交易提交？              | 是                 |
| 地区可用性   | CoinW 是否可返回账户/地区级产品可用性？            | 广泛开放前需要     |

## 17. 安全评审验收标准

安全评审完成时，评审团队应能清楚回答：

- 哪些用户数据进入 Claw 42？
- 哪些用户数据离开 Claw 42？
- 哪些系统保存敏感数据？
- 哪些系统能提交真实订单？
- 哪个用户动作会触发真实订单？
- Claw 42 如何防止重复下单？
- Claw 42 如何恢复未知订单状态？
- OAuth token 如何存储、刷新、撤销和轮换？
- 哪些日志可能包含敏感信息，如何限制访问？
- CoinW 或 Claw 42 需要紧急停止交易时，控制路径是什么？
