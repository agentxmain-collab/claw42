# Spec: task-18 v3.1 Minimal Patch (Critical Bug Fixes Only)

## 目标

修 task-18 PR #27 验收暴露的 **2 个 critical bug**，让 PR #27 能合 main，作为 v2.0 Batch 4 task-18-v2 的起点。

**不修内容层**——fewshot 扩充 / 派别人设强化 / prompt 多样性 / action 模板，这些全部留给 v2.0 Batch 4 task-18-v2（接 SignalEngine grounding 后一次性深度重做）。

## 范围

| 项                                | 处置                          |
| --------------------------------- | ----------------------------- |
| 币种错位（NIL 价 = 79890 BTC 价） | ✅ 必修                       |
| chatOrchestrator cache 60s 复读   | ✅ 必修                       |
| Few-shot 扩充到每派 8-10 条       | ❌ 留 Batch 4                 |
| 派别 prompt 多样化                | ❌ 留 Batch 4                 |
| 11 ChatAction 真改 content        | ❌ 留 Batch 4                 |
| SignalCard grounding              | ❌ 留 Batch 4（依赖 T1-core） |
| emotionalDebt 接入 prompt         | ❌ 留 Batch 4                 |

## 共同约束

继承 `spec-codex-sweep-batch01-finalization.md`：worktree 模式 / 临时 GitHub 账号切换 / 不动主 worktree dirty state。

工作分支：**`feature/watch-chat-immersive-01`**（task-18 PR #27 现有分支）。

修补完成后 push 自动更新 PR #27。

---

## 修补 1：币种错位（CRITICAL）

### 现象

截图反映 `$NIL 24h move 127.08%` 触发的 thread 中，Alpha/Beta/Gamma 都说 "$NIL 现价 79,890" —— 79890 是 BTC 价，NIL 实际是 0.几美元的 token。**这是数据错误，会摧毁用户信任**。

### 根因排查（Codex 自查）

可能原因（Codex 实施前先 audit 哪个真）：

A. **chatOrchestrator 取 ticker 没按 symbol 隔离**

- grep `chatOrchestrator.ts` 里 `tickerSnapshot` / `priceSnapshot` 取值代码
- 看是否取了默认/第一个币（如 hardcoded BTC fallback）

B. **fewshot 里 hardcode 了 BTC 价 79890**

- grep fewshot 文件（`factionRegistry.ts` / `fewshots.ts` / 类似）
- 看是否含 79890 / 67432 等 BTC 风格数字
- LLM 看到 hardcoded 数字会当成模板套到所有 symbol

C. **LLM prompt 模板写死了某币的价格**

- grep prompt 拼接代码
- 看是否写死 `BTC 现价 ${price}` 然后 symbol 变量没替换

### 实施步骤

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42

# 切账号 + worktree
ORIGINAL_GH_USER=$(gh auth status 2>&1 | awk '/Active account: true/{found=1} found && /account /{print $NF; exit}')
gh auth switch --user agentxmain-collab

git fetch origin
git worktree add /tmp/claw42-task18-patch origin/feature/watch-chat-immersive-01
cd /tmp/claw42-task18-patch

# Step 1: Audit
grep -rn "tickerSnapshot\|priceSnapshot\|currentPrice" src/lib/chatOrchestrator.ts src/lib/factionRegistry.ts src/lib/agentRelationship.ts 2>/dev/null
grep -rn "79890\|67432\|68500" src/lib/ src/modules/agent-watch/ 2>/dev/null
grep -rn "BTC 现价\|ETH 现价\|btc现价" src/ 2>/dev/null

# Step 2: 报告 audit 结果给 Session C（如发现 hardcoded 数字 / hardcoded BTC 引用）
# Session C 可能要给具体修订方案
# 但如果发现的问题在 spec 预期内（A/B/C 之一），Codex 可直接修

# Step 3: 修订（按 audit 结果）
# 必修的 invariant：
#   3.1 任何取 ticker 的代码必须按 message.symbol 精确取（不能 fallback 到 BTC）
#   3.2 fewshot 里所有数字替换为占位符 <PRICE> / <SYMBOL>，让 LLM 知道是模板不是值
#   3.3 LLM prompt 加 invariant 注入：
#       "当前讨论的 symbol 是 ${symbol}，当前价格是 ${price}。
#        你必须只引用 ${symbol} 的数据，严禁引用其他币的数字。
#        如果你不知道某个数字，写 <数据缺失> 而不是猜。"

# Step 4: tsc + lint + build
npx tsc --noEmit
npm run lint
npm run build

# Step 5: 验证（dev server 手测）
npm run dev &
DEV_PID=$!
sleep 5

# Codex 不能真打开浏览器手测，但可以：
# - 触发一个 NIL thread (dev override)
# - 看 LLM prompt 里 ${symbol}=NIL 是否正确注入
# 验证方法：在 chatOrchestrator 里加 console.log(prompt) → 跑 dev override → 看 console
# 如有 NIL prompt 仍出现 79890 → 修订未完成，停下报回

kill $DEV_PID 2>/dev/null

# Step 6: commit
git add -A
git commit -m "fix(chat): symbol isolation in ticker snapshot and prompt

Resolves critical data correctness bug where \$NIL thread displayed BTC price (79890).

Root cause(s): <Codex 填 audit 实际找到的根因>

Fix:
- ticker snapshot strict per-symbol lookup (no BTC fallback)
- fewshot price values replaced with <PRICE> placeholders
- LLM prompt invariant injection: 'must only reference \${symbol} data'

Validation: dev override NIL thread shows NIL real price, no BTC reference."

git push origin feature/watch-chat-immersive-01
```

### 验收

- [ ] grep audit 报告（Codex 报回找到的根因 A/B/C）
- [ ] 修订涵盖 3 个 invariant（ticker 隔离 + fewshot 占位符 + prompt invariant 注入）
- [ ] dev mode 触发 NIL thread → console.log 出来的 prompt 中 `${symbol}=NIL`，**无任何 BTC 数字**
- [ ] tsc + lint + build 全绿

---

## 修补 2：Cache 削弱

### 现象

截图反映约 1 分钟内同一 $ETH 话题被讨论了**两次**，Agent 说的话**几乎逐字重复**。

### 根因排查（Codex 自查）

```bash
grep -rn "cache\|memoize\|TTL\|expir" src/lib/chatOrchestrator.ts src/lib/llmFallbackChain.ts 2>/dev/null
```

可能原因：

A. **Cache key 太弱**：未把 thread_id + message_index + history hash 都进 key → 不同 thread 同一段 prompt 互相 hit
B. **TTL 60s 太长**：thread 内消息间隔 5-10s，但 prompt 含 thread 历史每条不同——理论不应 hit。除非 cache key 不区分历史。
C. **Cache 命中时不打 log**：调试时看不出是 cache 还是 LLM 真生成

### 实施步骤

```bash
# Step 1: Audit cache 实现
grep -A20 "cache\|getCachedResponse\|setCachedResponse" src/lib/chatOrchestrator.ts | head -50

# Step 2: 修订（按 audit 结果）
# 必修的 invariant：
#   2.1 Cache key 必须含：thread_id + message_index + agent_id + last_5_messages_hash
#       任一不同 → key 不同 → 不复用
#   2.2 TTL 从 60s 降到 5s（或完全关闭：CHAT_CACHE_DISABLED=1 时跳过 cache）
#   2.3 Cache hit 时 console.log("CACHE_HIT for key=...")，便于调试

# Step 3: 加 env flag
# 在 .env.local.example 加：
#   # Set to "1" to disable chat LLM response cache (debugging only)
#   CHAT_CACHE_DISABLED=

# Step 4: tsc + lint + build
npx tsc --noEmit && npm run lint && npm run build

# Step 5: commit
git add -A
git commit -m "fix(chat): tighten LLM response cache to prevent message duplication

Resolves critical UX bug where same \$ETH discussion repeated within 60s.

Root cause: cache TTL too long + key did not include enough context.

Fix:
- Cache key now includes thread_id + message_index + agent_id + last_5_messages_hash
- TTL reduced from 60s to 5s
- CHAT_CACHE_DISABLED env flag for debugging
- Cache hit logging for visibility

Result: same thread within 5s gap may still hit cache (acceptable for retry scenarios), but distinct thread states never collide."

git push origin feature/watch-chat-immersive-01
```

### 验收

- [ ] Cache key 含 thread_id + message_index + agent_id + history hash
- [ ] TTL ≤ 5s
- [ ] CHAT_CACHE_DISABLED env flag 工作
- [ ] Cache hit 有 log
- [ ] tsc + lint + build 全绿

---

## Cleanup

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-task18-patch
gh auth switch --user "$ORIGINAL_GH_USER"
```

## 完成后输出

```
task-18 v3.1 minimal patch:
  Branch: feature/watch-chat-immersive-01
  New commits: 2
    1. <hash> fix(chat): symbol isolation in ticker snapshot and prompt
    2. <hash> fix(chat): tighten LLM response cache to prevent duplication
  PR #27: updated (commit count before/after: X / X+2)

Audit findings:
  Root cause for symbol mix: <A | B | C | other>
  Root cause for cache duplication: <A | B | C | other>

Verify:
  tsc: pass
  lint: pass
  build: pass
  dev mode NIL thread audit: <pass / fail>

Worktree cleanup: done
GitHub account restored: <ORIGINAL_GH_USER>
```

## 约束

- ❌ 不要修内容多样性（fewshot / persona prompt / action templates 都留 Batch 4）
- ❌ 不要扩 fewshot 数量
- ❌ 不要改 11 ChatAction 实现
- ❌ 不要改 emotionalDebt 接入逻辑
- ❌ 不要 force push
- ❌ 不要把主 worktree dirty state 带进来
- ❌ 不要用真名 Mike

## 失败处理

- **Audit 找不到任何 hardcoded 数字 / 任何 cache key 弱点** → 报回所有 grep 结果，让 Session C 重新诊断
- **修订后 NIL thread 仍出现 BTC 数字** → 报回 prompt log，Session C 介入
- **tsc/lint/build 红** → 报回错误，不擅自修

---
