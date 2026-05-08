# Claw 42 Agent 交易服务架构设计

> 版本：评审稿 v1.0  
> 日期：2026-04-26  
> 评审对象：产品、后端、交易 API、安全、运营支持团队

## 1. 文档目的

Claw 42 为 CoinW 用户提供 Agent 化交易入口。用户通过自然语言与 Claw 42 Agent 交互，Agent 将用户意图转换为结构化交易指令，用户确认后，由 Claw 42 后端调用 CoinW API 提交真实现货或合约订单。

CoinW 是账户、资产、订单、成交、持仓、交易规则和履约结果的真实服务方。Claw 42 不托管用户资金，不替代 CoinW 账户系统，不作为订单系统的最终数据源。

## 2. 版本范围

### 本版本包含

- 用户通过 CoinW OAuth 登录和授权。
- 用户与 Claw 42 Agent 进行自然语言对话。
- Agent 生成结构化交易意图。
- 用户在对话中确认、修改或取消交易意图。
- 用户确认后，Claw 42 后端通过 CoinW API 提交真实现货或合约订单。
- 支持市价单、限价挂单、撤销由 Claw 42 创建的挂单。
- 展示 CoinW 返回的订单状态、余额和持仓信息。
- 保存对话、交易意图、确认记录、执行回执和审计日志。

### 本版本不包含

- Agent 后台自动运行。
- Claw 42 后台持续盯盘。
- 条件触发后由 Claw 42 自动下单。
- 外部 Agent SDK。
- Agent 排行榜。
- 战绩广场。
- Marketplace。
- 分润系统。
- Claw 42 自建交易账户体系。
- Claw 42 作为订单最终数据源。

## 3. 核心原则

1. CoinW 是交易服务商和订单最终数据源。
2. Claw 42 是 Agent 交互层和交易意图层。
3. 所有真实下单都必须由用户在对话中确认。
4. CoinW OAuth token 不暴露给浏览器。
5. 前端不直接调用 CoinW 交易接口。
6. Claw 42 只保存必要的本地记录，用于用户体验、排障和审计。
7. 订单、成交、余额和持仓信息以 CoinW 返回结果为准。

## 4. 用户流程

```text
用户进入 Claw 42
  -> 点击 Continue with CoinW
  -> 完成 CoinW OAuth 登录和授权
  -> 进入 Agent 对话界面
  -> 用户用自然语言描述交易需求
  -> Agent 生成交易意图
  -> Claw 42 展示交易确认卡
  -> 用户确认 / 修改 / 取消
  -> 确认后 Claw 42 后端调用 CoinW API
  -> CoinW 返回订单结果
  -> Claw 42 展示结果并保存审计记录
```

## 5. 交易确认卡示例

### 现货限价单

```text
用户输入：
帮我挂一个 BTC 限价买单，价格 65000，用 100 USDT。

Agent 确认卡：
市场：现货
交易对：BTC/USDT
方向：买入
类型：限价单
价格：65,000 USDT
金额：100 USDT
预计买入：约 0.001538 BTC
执行方：CoinW

操作：
确认下单 / 修改 / 取消
```

### 合约订单

合约确认卡应包含：

- 市场：合约
- 合约：如 BTC/USDT Perpetual
- 方向：开多 / 开空
- 类型：市价 / 限价
- 杠杆
- 保证金模式：逐仓 / 全仓
- 仓位模式：单向 / 双向
- 数量或保证金金额
- 止盈止损，如支持
- 预估强平价，如 CoinW API 支持
- 执行方：CoinW

## 6. 总体架构

```text
Browser
  |
  | HTTPS
  v
Claw 42 Frontend
  - Agent 对话界面
  - 交易意图确认卡
  - 订单结果展示
  - CoinW 服务说明
  |
  | HTTPS
  v
Claw 42 Backend API
  - OAuth Handler
  - Token Vault
  - Agent Conversation API
  - Trade Intent API
  - Confirmation API
  - CoinW Adapter
  - Audit Log
  |
  | OAuth / Trading API
  v
CoinW
  - 用户身份
  - 账户授权
  - 现货交易
  - 合约交易
  - 订单状态
  - 余额与持仓
  - 交易所侧风控
```

## 7. 前端设计

建议路由：

```text
/{locale}/agent
/{locale}/agent/chat
/{locale}/agent/orders
/{locale}/agent/settings
```

建议模块：

```text
src/modules/agent-service/
  index.tsx
  types.ts
  data/
    agents.ts
    strategyCards.ts
  components/
    AgentServiceHero.tsx
    AgentPicker.tsx
    AgentChatPanel.tsx
    TradeIntentCard.tsx
    OrderResultCard.tsx
    OAuthConnectPanel.tsx
    CoinWServiceNotice.tsx
```

前端文案需要持续表达：

- Claw 42 提供 Agent 交易入口。
- 订单由 CoinW 执行。
- 资金仍在用户 CoinW 账户中。
- 用户确认后才提交订单。

## 8. 后端模块

### 8.1 OAuth Handler

职责：

- 发起 CoinW OAuth 授权。
- 接收 OAuth callback。
- 换取 access token / refresh token。
- 刷新 access token。
- 处理授权撤销。

### 8.2 Token Vault

职责：

- 服务端加密保存 CoinW OAuth token。
- 前端不可读取 token。
- 仅在服务端调用 CoinW API 时使用 token。
- 支持 token refresh 和 revoke。

### 8.3 Agent Conversation API

职责：

- 接收用户自然语言消息。
- 调用 Agent 推理能力。
- 返回自然语言解释。
- 返回机器可读的结构化交易意图。

### 8.4 Trade Intent API

职责：

- 保存待确认交易意图。
- 跟踪交易意图状态。
- 避免同一个交易意图被重复确认。
- 为前端确认卡提供结构化数据。

### 8.5 Confirmation API

职责：

- 接收用户确认动作。
- 校验交易意图状态。
- 校验 CoinW OAuth scope。
- 调用 CoinW Adapter 提交订单。
- 保存执行回执。

### 8.6 CoinW Adapter

职责：

- 封装所有 CoinW API 调用。
- 归一化 CoinW 响应格式。
- 附加幂等键和来源标识。
- 处理错误、超时和可安全重试场景。

建议方法：

```text
placeSpotOrder()
placeFuturesOrder()
cancelOrder()
getOrder()
getBalances()
getPositions()
getTrades()
```

### 8.7 Audit Log

职责：

- 记录用户消息摘要。
- 记录 Agent 生成的交易意图。
- 记录用户确认、修改或取消动作。
- 记录提交给 CoinW 的请求摘要。
- 记录 CoinW 返回结果和错误码。
- 不记录 OAuth token 或其他密钥明文。

## 9. 数据归属

| 数据         | 最终数据源 | Claw 42 是否保存           |
| ------------ | ---------- | -------------------------- |
| 用户账户     | CoinW      | 仅保存 CoinW 用户映射      |
| 用户资产     | CoinW      | 不保存最终资产数据         |
| 余额         | CoinW      | 可缓存展示                 |
| 持仓         | CoinW      | 可缓存展示                 |
| 订单         | CoinW      | 保存 CoinW order id 和回执 |
| 成交         | CoinW      | 保存引用或摘要             |
| 对话         | Claw 42    | 保存                       |
| 交易意图     | Claw 42    | 保存                       |
| 用户确认动作 | Claw 42    | 保存                       |
| 审计日志     | Claw 42    | 保存                       |

如果 Claw 42 本地记录与 CoinW 订单、余额、持仓或成交数据冲突，以 CoinW 数据为准。

## 10. 最小数据模型

```text
coinw_user_links
oauth_token_refs
agent_sessions
agent_messages
trade_intents
execution_receipts
audit_logs
```

### trade_intents

```text
intent_id
claw42_user_id
coinw_user_id
agent_id
market_type: spot | futures
symbol
side
order_type: market | limit
price
quantity_or_amount
leverage
margin_mode
position_mode
take_profit
stop_loss
status: pending_confirmation | confirmed | cancelled | submitted | failed
created_at
updated_at
```

### execution_receipts

```text
receipt_id
intent_id
coinw_order_id
client_order_id
market_type
submitted_payload_summary
coinw_response_summary
status
error_code
created_at
```

## 11. 执行规则

- 前端不得直接调用 CoinW 交易 API。
- 前端不得接收 CoinW OAuth token。
- Agent 不得绕过用户确认直接提交订单。
- 同一个 trade intent 不得重复提交。
- 提交订单后必须保存 CoinW order id。
- 最终订单状态必须从 CoinW 查询。
- token 和密钥不得进入日志。

## 12. 错误处理

前端至少需要展示以下状态：

- CoinW OAuth 授权失败。
- 缺少交易权限。
- 授权过期。
- 余额不足。
- 交易对无效。
- 下单数量无效。
- 下单价格无效。
- 杠杆或保证金模式无效。
- 请求触发频率限制。
- CoinW API 超时。
- 用户已确认但订单状态未知。

订单状态未知时，应使用 `clientOrderId` 或 CoinW order id 向 CoinW 查询最终状态。

## 13. 埋点与可观测性

建议事件：

| 事件                     | 触发                |
| ------------------------ | ------------------- |
| `agent_service_view`     | 访问 Agent 服务页   |
| `coinw_oauth_start`      | 发起 CoinW 授权     |
| `coinw_oauth_success`    | CoinW 授权成功      |
| `agent_message_send`     | 用户发送 Agent 消息 |
| `trade_intent_created`   | Agent 生成交易意图  |
| `trade_intent_confirmed` | 用户确认交易意图    |
| `trade_intent_cancelled` | 用户取消交易意图    |
| `coinw_order_submitted`  | 订单提交到 CoinW    |
| `coinw_order_failed`     | CoinW 返回失败      |

运营日志需要支持问题排查，但不得暴露 token 和密钥。

## 14. 评审问题

1. CoinW OAuth 是否支持登录授权和交易授权分步？
2. CoinW OAuth 是否支持现货和合约 scope 拆分？
3. 首个生产版本是否同时开放现货和合约？
4. CoinW 支持哪些订单类型可由 Claw 42 提交？
5. CoinW 是否支持订单状态 webhook？
6. CoinW 是否支持 Claw 42 来源订单标识？
7. CoinW 是否支持 OAuth app 紧急禁用和单用户授权撤销？
