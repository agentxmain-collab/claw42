# Claw 42 对 CoinW 的集成需求清单

> 版本：评审稿 v1.0  
> 日期：2026-04-26  
> 评审对象：CoinW OAuth、API、交易、安全、运营支持团队

## 1. 集成目标

Claw 42 将为 CoinW 用户提供 Agent 化交易入口。用户通过 CoinW OAuth 授权，在 Claw 42 与 Agent 对话，确认结构化交易意图后，由 Claw 42 后端调用 CoinW API 提交真实现货或合约订单。

CoinW 仍然是身份、账户权限、资产、余额、持仓、订单、成交和交易规则的最终数据源。

## 2. OAuth 与身份能力

### 必需能力

- Claw 42 OAuth 应用注册。
- Authorization Code Flow 文档。
- Redirect URI 配置。
- Access token 签发。
- Refresh token 签发。
- Token refresh 接口。
- Token revoke 接口。
- Token introspection 或权限查询接口。
- 稳定的 CoinW user id。
- 用户取消授权后的处理机制说明。

### Scope 拆分需求

建议 scope 可拆分为：

```text
identity.basic
account.read
spot.trade
futures.trade
```

如果 CoinW 当前 scope 模型不同，需要提供最接近的权限映射。

### 优先支持

- 登录授权与交易授权分步。
- 用户可见的授权确认页，清楚展示所请求权限。
- 查询当前用户已授权 scope 的接口。
- 用户撤销授权后的 webhook 或事件通知。
- OAuth app 紧急禁用能力。
- 单用户授权紧急 revoke 能力。

## 3. 现货交易 API

### 必需接口

- 查询现货账户余额。
- 提交现货市价单。
- 提交现货限价单。
- 撤销现货订单。
- 根据 CoinW order id 查询现货订单。
- 根据 clientOrderId 查询现货订单。
- 查询现货当前委托。
- 查询现货历史订单。
- 查询现货成交记录。
- 查询现货交易对与交易规则。

### 必需字段

- 交易对。
- 买入 / 卖出方向。
- 订单类型。
- 限价单价格。
- 数量或报价币金额。
- clientOrderId 或幂等键。
- 来源标识，如支持。

## 4. 合约交易 API

### 必需接口

- 查询合约账户余额。
- 查询合约持仓。
- 查询支持的合约与交易规则。
- 设置或查询杠杆。
- 设置或查询保证金模式。
- 设置或查询仓位模式。
- 提交合约市价单。
- 提交合约限价单。
- 撤销合约订单。
- 根据 CoinW order id 查询合约订单。
- 根据 clientOrderId 查询合约订单。
- 查询合约当前委托。
- 查询合约历史订单。
- 查询合约成交记录。

### 条件单能力确认

需要确认 CoinW 是否支持：

- 止盈单。
- 止损单。
- 开仓单附带 TP / SL。
- Reduce-only。
- Post-only。
- Time in force。
- 触发单。

### 必需字段

- 合约标的。
- 开多 / 开空。
- 买入 / 卖出方向。
- 订单类型。
- 限价单价格。
- 数量或保证金金额。
- 杠杆。
- 保证金模式。
- 仓位模式。
- 止盈，如支持。
- 止损，如支持。
- clientOrderId 或幂等键。
- 来源标识，如支持。

## 5. 幂等与重复下单防护

必需能力：

- 支持客户端生成的 clientOrderId，或等效幂等键。
- 支持通过 clientOrderId 查询订单。
- 明确重复提交同一 clientOrderId 的处理方式。
- 提供重复请求对应的错误码。

Claw 42 将使用该能力防止用户重复确认或网络重试导致重复下单。

## 6. 订单来源标识

如 CoinW 支持，订单应能携带：

```text
source = claw42
agent_id
intent_id
client_order_id
```

需要确认：

- CoinW 可保存哪些来源字段。
- 哪些字段会在订单查询响应中返回。
- 哪些字段可在 CoinW 内部审计工具中检索。
- 用户在 CoinW 订单历史中是否能看到来源标识。

## 7. 订单状态同步

必需能力：

- 标准订单状态列表。
- 状态流转说明。
- 部分成交的表达方式。
- 撤单成功与撤单失败的处理方式。
- 查询订单最新状态的接口。

优先支持：

- Claw 42 来源订单的订单状态 webhook。
- Claw 42 来源订单的成交 webhook。
- 如果不支持 webhook，需要提供推荐轮询频率。

## 8. 交易规则与前置校验数据

必需数据：

- 交易对列表。
- 最小下单数量。
- 最小名义金额。
- 价格精度 / tick size。
- 数量精度 / step size。
- 最大下单数量。
- 每个市场支持的订单类型。
- 合约每个标的的杠杆上限。
- 合约每个标的支持的保证金模式。
- 合约仓位模式规则。

Claw 42 需要这些数据在提交 CoinW 前校验交易确认卡。

## 9. 错误码与限频规则

必需文档：

- 完整错误码列表。
- 错误码含义。
- 可重试 / 不可重试分类。
- 各接口 rate limit。
- 单用户 rate limit。
- OAuth app 级 rate limit。
- 触发限频后的行为。
- 推荐重试策略。

重点错误类别：

- token 无效。
- scope 缺失。
- 授权过期。
- 余额不足。
- 交易对无效。
- 数量无效。
- 价格无效。
- 杠杆无效。
- 保证金模式无效。
- clientOrderId 重复。
- 订单不存在。
- 订单已成交。
- 订单已撤销。
- API 超时。
- 交易所内部错误。

## 10. Sandbox 与测试环境

必需能力：

- Sandbox 或 testnet。
- 测试 OAuth app credentials。
- 测试用户账号。
- 现货测试交易环境。
- 合约测试交易环境。
- 测试交易对与合约规则。
- 测试余额。
- 可模拟常见错误场景，如支持。

优先支持：

- 常见订单流程的确定性测试用例。
- 测试 webhook 事件。
- 示例请求与响应。

## 11. 安全要求

需要确认：

- OAuth token 是否可按 scope 限权。
- 所需 OAuth scope 是否完全不包含提币能力。
- token revoke 机制。
- token 过期与 refresh 策略。
- 是否支持 IP 白名单。
- API 请求签名方式。
- OAuth app secret 轮换流程。

优先支持：

- Claw 42 后端固定出口 IP 白名单。
- 安全集成联系人。
- token 存储和加密建议。

## 12. 运营与事故处理

必需能力：

- OAuth app 紧急禁用。
- 单用户 token 紧急 revoke。
- 生产事故联系人。
- Claw 42 来源 API 调用审计导出。
- CoinW 内部工具可识别 Claw 42 来源订单。
- 限频或异常调用的升级处理机制。

优先支持：

- Claw 42 来源 API 调用异常错误率告警。
- 按来源应用统计订单失败情况。
- 授权撤销事件流。

## 13. 需要 CoinW 提供的文档

请提供：

1. OAuth app 接入文档。
2. OAuth 授权流程文档。
3. Scope 列表与权限映射。
4. Token refresh / revoke 文档。
5. 现货 API 文档。
6. 合约 API 文档。
7. 交易规则 API 文档。
8. 错误码和 rate limit 文档。
9. Sandbox / testnet 接入说明。
10. Webhook 文档，如支持。
11. 安全和事故响应联系人。
12. 现货下单成功与失败示例。
13. 合约下单成功与失败示例。

## 14. 待 CoinW 评审确认的问题

1. CoinW OAuth 登录和交易授权是否可以分为两个用户步骤？
2. 现货交易和合约交易 scope 是否可以分开？
3. 交易 scope 是否能保证完全不具备提币能力？
4. 现货和合约是否都支持 clientOrderId？
5. CoinW 是否可以保存并返回 Claw 42 的订单来源字段？
6. CoinW 是否支持订单状态和成交 webhook？
7. CoinW 是否提供现货和合约 sandbox？
8. CoinW 内部工具是否可以筛选 Claw 42 来源订单？
9. API 超时导致订单状态未知时，CoinW 推荐如何处理？
10. 如 Claw 42 需要停止全部下单，CoinW 侧可提供哪些紧急控制？

## 15. 2026-05-20 beta 接入收敛

Dan 与 CoinW 侧沟通后的当前执行判断：

- OAuth 已存在，Claw 42 继续按 OAuth + 服务端 API 调用设计。
- 首版以合约为主；非 CoinW 合约支持币种不进入公开主分析列表，也不生成跟单入口。
- 现货 / 合约权限、只读 / 交易权限可以拆分时必须拆分；首版只申请合约交易所需最小权限。
- CoinW 可以提供测试账号，Claw 42 先用测试账号验证 TP / SL 与真实回执。
- CoinW 可以提供稳定的合约跳转入口；在精确合约交易对 URL 未确认前，Claw 42 使用安全的合约市场落地页。
- 当前官方合约下单接口支持 `thirdOrderId` 字段。Claw 42 先使用 `claw42_<intent_id>_<attempt>` 作为来源和重复提交保护标识。
- `thirdOrderId` 重复提交的具体行为、价格 / 数量精度和最小下单量的最终字段来源，仍需 CoinW 侧确认。

### API-first 与第三方应用代提交的区别

这里的 API-first 不是让浏览器直接调用 CoinW 交易接口，也不是让用户手动粘贴 API key。

Claw 42 的目标形态是：

1. 用户在 CoinW OAuth 页面授权 Claw 42。
2. Claw 42 后端保存受限 token 引用，不把 token 暴露给浏览器。
3. 用户在 Claw 42 确认交易意图后，Claw 42 后端调用 CoinW API 提交订单。
4. 订单最终状态、成交、持仓仍以 CoinW 返回为准。

“第三方应用代提交”指的是第 3 步：Claw 42 作为用户授权过的第三方应用，用用户授权的交易 scope 在服务端提交订单。它和“API 调用”为同一条技术路径；区别只在授权方式和责任边界。OAuth 模式下，用户可以撤销 Claw 42 授权，Claw 42 也不需要用户提供个人 API key。

### Claw 42 来源标识

首版请求标识采用三层：

- CoinW 请求字段：`thirdOrderId = claw42_<intent_id>_<attempt>`。
- Claw 42 本地审计字段：`source = claw42`、`intentId`、`recordId`、`createdAt`。
- 如 CoinW 后续支持额外来源字段，再补充 `source = claw42` / `agent_id` / `intent_id`。

### 首版环境变量命名

不在代码或文档中写入任何密钥值。当前只定义命名，等待测试账号和授权材料：

```text
COINW_FUTURES_API_BASE_URL
NEXT_PUBLIC_COINW_FUTURES_URL
NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE
COINW_OAUTH_CLIENT_ID
COINW_OAUTH_CLIENT_SECRET
COINW_OAUTH_REDIRECT_URI
COINW_OAUTH_AUTHORIZE_URL
COINW_OAUTH_TOKEN_URL
COINW_OAUTH_SCOPES
COINW_FUTURES_TEST_ACCOUNT_ID
COINW_FUTURES_ORDER_MODE
COINW_FUTURES_BETA_MAX_LEVERAGE
```

### Beta1 / Beta2 当前边界

- Beta1 公开分析只展示 CoinW 合约支持的币种分析卡；非 CoinW 合约币种直接不进入公开主列表。
- 大盘和热点是全局分析卡，不对应单币开单，保留展示但只显示"仅分析 / 不自动下单"。
- Beta2 当前只做到开单意图校验和准备状态检查，不提交真实订单。
- `/api/watch/follow-intents/status` 只返回配置就绪状态，不返回任何密钥值。
- `COINW_FUTURES_ORDER_MODE=live` 仍被阻断；真实提交需要单独 release 决策。

### 还需 CoinW / 运维确认的上线项

1. OAuth 授权页、token 接口、callback 白名单和 scope 名称。
2. 测试账号、测试 OAuth app、测试交易权限。
3. 精确合约交易对跳转 URL 模板。
4. `thirdOrderId` 重复提交语义。
5. TP / SL 是随单提交还是单独接口。
6. 合约下单前是否必须设置杠杆、保证金模式、持仓模式。
7. 精度、最小数量、最小名义金额、最大杠杆字段的最终来源。
8. 订单状态查询和成交回执字段。
9. OAuth token revoke / 过期 / refresh 行为。
10. Rate limit、异常升级、紧急关闭 OAuth app 的运维流程。
