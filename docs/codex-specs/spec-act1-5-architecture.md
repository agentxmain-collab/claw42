# Claw42 Act 1.5 交互式 Agent 下单架构草案

> 状态：Discussion Draft  
> 日期：2026-04-25  
> 适用 repo：`claw42`  
> 主基调：Claw42 是入口和 Agent 体验层；CoinW 是隐藏在后面的真实服务商、账户体系、交易体系和履约方。

## 1. 已确认方向

当前版本不做 Agent Worker，不做后台自动运行，不做持续盯盘。

本版本要做的是：

> 用户在 Claw42 与 Agent 对话，Agent 生成结构化交易意图，用户在对话里确认后，由 Claw42 后端调用 CoinW API 完成真实现货 / 合约下单或挂单。

核心边界：

- Claw42 不做交易所。
- Claw42 不托管资金。
- Claw42 不成为订单系统的 source of truth。
- CoinW 是账户、资金、订单、成交、持仓、合约规则的真实服务方。
- Claw42 只保存对话、交易意图、用户确认记录、CoinW 返回的订单 ID 和审计日志。

## 2. 从旧 MVP Act 3 继承什么

旧 Act 3 的主线是：

```text
搭台 -> 进化 -> 回报
```

其中当前版本只取最短产品路径：

```text
官方 Claw42 Agent
  -> 策略卡 / Skill 能力
  -> 对话生成交易意图
  -> 用户确认采用
  -> CoinW 执行真实交易
```

暂时不取：

- 外部 Agent 接入
- Agent 排行榜
- 广场战绩墙
- 分润机制
- Marketplace
- 自动运行 Worker
- 外部 Agent SDK

旧 Act 3 的“策略卡 / 实盘验证 / 胜率指数 / 复用 / 汰换”这套交易语言可以保留为后续 Agent 能力包装，但本版本先服务于用户下单链路。

## 3. 产品流程

首版流程：

```text
用户进入 /agent
  -> Continue with CoinW
  -> 选择 / 进入 Claw42 Agent
  -> 用户用自然语言表达交易需求
  -> Agent 生成 Trade Intent
  -> 对话内展示确认卡
  -> 用户确认 / 修改 / 取消
  -> Claw42 后端调用 CoinW API
  -> CoinW 返回订单结果
  -> Claw42 展示结果，并保存审计记录
```

示例：

```text
用户：帮我挂一个 BTC 限价买单，价格 65000，用 100 USDT。

Agent：我准备为你创建以下订单：
市场：现货
交易对：BTC/USDT
类型：限价买入
价格：65,000 USDT
金额：100 USDT
预计买入：约 0.001538 BTC

订单将由 CoinW 执行，资金仍在你的 CoinW 账户中。
[确认下单] [修改] [取消]
```

合约确认卡需要额外展示：

- 开多 / 开空
- 杠杆
- 保证金模式
- 仓位模式
- 数量 / 保证金
- 止盈止损
- 预估强平价，如 CoinW API 提供

## 4. 身份与授权

Claw42 不做独立账号体系作为主路径。主路径使用 CoinW OAuth。

推荐拆成两段：

1. **登录授权**
   - 用户用 CoinW 账号进入 Claw42。
   - Claw42 获得 CoinW 用户身份。

2. **交易授权**
   - 当用户准备让 Agent 生成或执行订单时，再请求交易 scope。
   - scope 需要区分只读、现货交易、合约交易。

Claw42 仍需要一个很薄的用户映射，不是为了成为服务商，而是为了保存会话和审计：

```text
claw42_user_id
coinw_user_id
oauth_scope
token_reference
created_at
last_seen_at
```

这里的用户真实账户关系、资产关系、交易权限都属于 CoinW。

## 5. 路由设计

当前项目所有页面挂在 `src/app/[locale]/` 下，middleware 会把裸路径重定向到默认语言路径。

Act 1.5 采用真实产品入口：

```text
src/app/[locale]/agent/page.tsx
```

公开访问路径：

```text
/agent        -> middleware redirects to /{locale}/agent
/en_US/agent
/zh_CN/agent
```

后续交互页可以继续放在：

```text
/{locale}/agent/chat
/{locale}/agent/orders
/{locale}/agent/settings
```

是否拆成独立 dashboard，等 CoinW OAuth 和产品形态确认后再定。

## 6. 前端模块结构

Act 1.5 新增模块建议命名为 `agent-service`：

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

页面主线是 Agent 交互，而不是行情分析展示。

## 7. 执行后端：无 Worker 版本

当前不做 Worker，只做用户触发型后端。

最小后端模块：

### OAuth Handler

- 处理 CoinW OAuth 登录。
- 处理 callback。
- 处理 refresh token。
- 处理 revoke。

### Token Vault

- 加密保存 CoinW OAuth token。
- 前端永远拿不到 token。
- token 只在服务端调用 CoinW API 时使用。

### Agent Conversation API

- 接收用户自然语言消息。
- 调 Agent 推理能力。
- 返回自然语言解释 + 结构化交易意图。

### Trade Intent API

保存待确认交易意图：

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
```

### Confirmation API

- 用户点击确认后调用。
- 后端读取 intent。
- 校验 OAuth scope。
- 调 CoinW Adapter。
- 写执行回执。

### CoinW Adapter

封装 CoinW API，不让业务代码到处直接调用 CoinW：

```text
placeSpotOrder()
placeFuturesOrder()
cancelOrder()
getOrder()
getBalances()
getPositions()
```

### Audit Log

记录：

- 用户原始请求
- Agent 生成的 intent
- 用户确认动作
- CoinW API 请求摘要
- CoinW 返回结果
- 错误码

不要记录 token 明文。

## 8. CoinW 是订单 Source of Truth

订单、成交、余额、持仓全部以 CoinW 为准。

Claw42 本地只保存：

- conversation messages
- trade intents
- confirmation records
- CoinW order id
- execution receipt
- audit logs

页面展示订单状态时：

- 优先实时查 CoinW。
- 可以缓存展示，但不能把缓存当最终状态。
- 如果 CoinW 订单状态和 Claw42 本地记录冲突，以 CoinW 为准。

## 9. 可做与不可做

当前无 Worker 版本可以做：

- 对话生成市价单。
- 对话生成限价挂单。
- 用户确认后提交真实订单。
- 撤销由 Claw42 创建的挂单。
- 查询订单状态。
- 查询余额和持仓。
- 在用户打开页面时刷新订单状态。

当前无 Worker 版本不做：

- 后台持续盯盘。
- 条件触发后自动下单，除非 CoinW 原生支持条件单 / TP / SL。
- 自动调仓。
- 自动止盈止损托管，除非由 CoinW 订单系统承接。
- Agent 定时运行。
- 长期任务队列。

## 10. 需要向 CoinW 提的需求

OAuth / 身份：

- OAuth 登录文档。
- OAuth scope 拆分：身份、账户读取、现货交易、合约交易。
- access token / refresh token / revoke。
- token 权限查询接口。
- 用户取消授权后的通知或查询机制。
- OAuth app 紧急禁用。
- 单用户授权紧急 revoke。

交易 API：

- 现货下单、撤单、查单、余额、成交记录。
- 合约下单、撤单、查单、持仓、杠杆、保证金模式、仓位模式、TP/SL。
- `clientOrderId` 或幂等键，防重复下单。
- 订单来源标识：`source=claw42`、`agent_id`、`intent_id`。
- 标准错误码和 rate limit。
- sandbox / 测试账户。
- 订单状态 webhook；如果没有，提供推荐轮询频率。

运营与事故：

- CoinW 侧能识别 Claw42 来源订单。
- CoinW 侧能导出 Claw42 来源 API 调用审计。
- 事故期间可禁用 Claw42 OAuth app。
- 事故期间可 revoke 单用户授权。
- 固定应急联系人或群。

## 11. 最小数据表

首版最小表：

```text
coinw_user_links
oauth_token_refs
agent_sessions
agent_messages
trade_intents
execution_receipts
audit_logs
```

暂不需要：

- agent_runs
- worker_jobs
- risk_events 独立表
- marketplace tables
- revenue tables
- external_agent_tokens

如果 CoinW 提供完整风控和错误码，Claw42 首版可以先把风控事件并入 `execution_receipts` 和 `audit_logs`。

## 12. i18n 与文案边界

现有 `Dict` 新增 `agentService`：

```ts
agentService: {
  hero: { ... };
  oauth: { ... };
  chat: { ... };
  intent: { ... };
  orderResult: { ... };
  coinwNotice: { ... };
}
```

文案主基调：

- Claw42 是 Agent 入口。
- CoinW 执行订单。
- 资金仍在 CoinW。
- 用户确认后才提交订单。
- 首版不承诺自动运行。

## 13. 埋点

新增事件：

| 事件                     | 触发               | 属性                                            |
| ------------------------ | ------------------ | ----------------------------------------------- |
| `agent_service_view`     | 访问 `/agent`      | `locale`                                        |
| `coinw_oauth_start`      | 点击 CoinW OAuth   | `locale`, `surface`                             |
| `coinw_oauth_success`    | OAuth 成功         | `locale`, `scopes`                              |
| `agent_message_send`     | 用户发送消息       | `locale`, `agent_id`                            |
| `trade_intent_created`   | Agent 生成交易意图 | `locale`, `market_type`, `symbol`, `order_type` |
| `trade_intent_confirmed` | 用户确认           | `locale`, `market_type`, `symbol`               |
| `trade_intent_cancelled` | 用户取消           | `locale`, `reason`                              |
| `coinw_order_submitted`  | 已提交 CoinW       | `locale`, `market_type`, `symbol`               |
| `coinw_order_failed`     | CoinW 返回失败     | `locale`, `error_code`                          |

## 14. 当前版本验收标准

- `/agent` 能正确重定向到 `/{locale}/agent`。
- 页面主叙事是 Claw42 Agent 交互式交易入口。
- 页面明确 CoinW 是实际交易服务方。
- OAuth 入口清晰。
- 对话中能展示交易意图确认卡。
- 现货和合约都在产品路径里，不做假自动运行承诺。
- 当前 Act 1 首页不回归。
- `npm run lint` 通过。
- `npm run build` 通过。
- Vercel staging preview 可验收后再合 main。

## 15. 暂不做

- Agent Worker。
- 自动运行。
- 后台持续盯盘。
- 外部 Agent SDK。
- Marketplace。
- 排行榜。
- 广场战绩墙。
- 分润。
- Claw42 自建重账户体系。
- Claw42 自建订单 source of truth。
