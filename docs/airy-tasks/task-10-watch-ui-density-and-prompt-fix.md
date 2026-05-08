# Task 10 — Watch 页面信息密度 + Prompt 套话修订（v1.2 急修）

> **⚠️ 状态：已合并入 task-11（2026-04-28）**
>
> Dan 在 PR #16 preview 给出更深一轮反馈后，task-10 的 5 条修订全部合入 task-11，加上文案重写 / Sidebar 合并 / 信号流横向 / K 线 badge 删除等额外修订。
>
> **以 `task-11-watch-overhaul.md` 为准**。task-10 文件保留作历史参考，不要执行。
>
> ---

> **背景**：task-09 v1.1 PR #16 上 preview 后 Dan 发现 5 个产品问题（信号 ticker 重复 / LLM 套话 / 气泡无差异 / 集体信号脱节 / 信息过载）。本 task 急修这 5 条，让首屏价值密度提升、Agent 输出去模板化。
>
> **执行者**：Codex
>
> **基于**：PR #16 (`feature/act1-5-watch-sedimentation-01`) 已落地的 4 段 commit
>
> **分支**：在 PR #16 同分支 `feature/act1-5-watch-sedimentation-01` 加新 commit，**不开新 PR**——直接更新 PR #16
>
> **PR target**：保持 PR #16 现有 target `feature/act1-5-watch-page-01`，不变

---

## 0. 5 条修订对位

| #      | Dan 反馈                  | 根因                                                       | 本 task 修订                                                            |
| ------ | ------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| **R1** | "信号流和 ticker 重复"    | `range_change` 类信号对主流币和 ticker 100% 重叠           | range_change 限定到 trending / opportunity 币才生成，majors 不再产生    |
| **R2** | "Agent 内容重复 + 套话"   | LLM 每条复读 ticker（"ETH 现价 $X 24h -X%"）+ 套用固定开头 | Prompt 加"禁止套话开头 + 禁止复读 ticker + 必须引用 buffer 信号" 硬约束 |
| **R3** | "3 Agent 气泡无差异"      | MessageBubble 全部用同一边框，没用 AGENT_COLOR_TOKEN       | 按 agentId 给气泡左侧 accent 条 + 边框淡色                              |
| **R4** | "信号流和 Agent 输出脱节" | LLM 没强调 buffer 里 ≥3 个主流币同向信号（集体信号）       | Prompt 加"集体信号检测约束"，3 Agent 至少 1 个必须引用集体信号          |
| **R5** | "信息过载"                | Ticker + 信号流 + 3 FocusCard 各占 1/3 首屏                | 信号流瘦身（紧凑单行流）+ FocusCard 简化（失效条件折叠）+ padding 减半  |

---

## 1. 修改清单

| 文件                                                     | 改动                                                                                          | 对位    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| `src/lib/marketSignals.ts`                               | `generateSignals` 里 `range_change` 加 category 守卫，`category === "majors"` 时跳过          | R1      |
| `src/lib/llmFallbackChain.ts`                            | `buildPrompt` 加 4 条新硬约束（禁套话 / 禁复读 ticker / 必须引用 buffer 信号 / 集体信号引用） | R2 / R4 |
| `src/modules/agent-watch/components/MessageBubble.tsx`   | 按 agentId 应用 AGENT_COLOR_TOKEN：左侧 2px accent border + 边框颜色                          | R3      |
| `src/modules/agent-watch/components/MarketEventFeed.tsx` | 视觉瘦身：从大卡片网格改紧凑单行流，max 8 条，每行 ~28px 高                                   | R5      |
| `src/modules/agent-watch/components/AgentFocusCard.tsx`  | 失效条件默认折叠（hover / details expand 才显示），padding 从 p-5 → p-4，整体高度降 30%       | R5      |
| `src/i18n/dicts/zh_CN.json` 等 10 dict                   | `agentWatch.focusCard.expandFail` / `agentWatch.marketEvent.compact` 等新增小字段             | R5      |

不动：

- 数据流（task-09 v1.1 主架构）
- buffer / signal 类型（除 R1 守卫）
- focus 数据结构（仅 UI 折叠）
- middleware / Hero / 其他 Section

---

## 2. R1 — `range_change` 主流不生成

`src/lib/marketSignals.ts` 在 `generateSignals` 内部 range_change 那段加守卫：

```ts
// before
if (Math.abs(coin.change24h) >= THRESHOLDS.RANGE_CHANGE_PCT) {
  signals.push({
    id: ...,
    type: "range_change",
    ...
  });
}

// after — R1 修订
if (
  Math.abs(coin.change24h) >= THRESHOLDS.RANGE_CHANGE_PCT &&
  coin.category !== "majors"   // ← 主流币不发 range_change（ticker 已显示）
) {
  signals.push({
    id: ...,
    type: "range_change",
    ...
  });
}
```

效果：信号流不再出现 `BTC RANGE 24h -2.86%` 这种和 ticker 完全重复的信号。`PROS / ZKJ / CHIP / BCAP / HASH / M`（热门/机会）的 range_change 仍生成——这些 ticker chip 视觉权重低，信号流补强有意义。

---

## 3. R2 + R4 — Prompt 加硬约束

`src/lib/llmFallbackChain.ts` 的 `buildPrompt` 模板**末尾**加一段"输出纪律"：

```ts
return `
${existingPromptContent}

## 输出纪律（v1.2 修订，硬性遵守，违反则输出无效）

### 禁止套话开头
- ❌ "X 现价 \$Y，24h Z%" / "X 现价多少现价多少"
- ❌ "ETH/BTC/SOL 强弱排序已拉开"
- ❌ "目前 X 表现如何"
- ❌ 任何以行情概览或价格描述开头的句式

### 禁止复读 Ticker
用户已经在顶部 Ticker 看到：4 主流币 + 3 热门 + 3 机会的当前价 + 24h 涨跌幅。
- ❌ 不要在 stream content 或 focus.judgment 里再写"现价 \$X" / "24h -X%"
- ✅ 直接说判断、引用 buffer 信号事件、给条件

### 必须引用 buffer 信号事件
每个 Agent 的 stream + focus 必须引用至少 1 条 buffer 摘要里**具体的**信号事件作为论据：
- ✅ "BTC 接近前低 \$75,677 已经第 3 次"——引用了 NEAR_LOW 信号
- ✅ "ZKJ 24h +209% 已经飞起来"——引用了 RANGE_CHANGE 信号
- ✅ "BCAP 5m 放量 2.1x + 突破 \$103"——引用了 VOLUME_SPIKE + BREAKOUT 信号
- ❌ "市场偏弱"（无具体信号）
- ❌ "看着不太行"（无引用）

### 集体信号检测（关键）
如果 buffer 摘要里 **≥3 个主流币同时出现同方向同类型信号**（例：BTC ETH SOL 都 NEAR_LOW），3 Agent stream **至少 1 条必须引用这个集体信号**：
- ✅ Alpha "主流三个都接近前低，止损单密集，破一个就连环"
- ✅ Beta "BTC ETH SOL 同步测前低，趋势已经偏弱了"
- ✅ Gamma "三大主流同时进近期低位，集体偏离信号"

如果没有集体信号，3 Agent 各看各的币，可以分散视角。

### 句式风格（继续 task-07 人设约束）
- Alpha 短促 + 江湖气，必须用突破派术语
- Beta 中长 + 克制，必须用趋势派术语
- Gamma 数据 + 谨慎，必须用回归派术语
- 3 Agent 气泡内容明显风格差异（用户能区分）

输出 JSON 不变，按上面 schema。
`;
```

效果：

- LLM 输出不再"现价 $X 24h -X%"开头
- LLM 输出每条带具体信号引用
- 3 主流同方向时被强制集体表达
- 3 Agent 风格差异化加强（task-07 人设 + task-10 输出纪律双约束）

---

## 4. R3 — Agent 气泡按派别配色

`src/modules/agent-watch/components/MessageBubble.tsx`：

```tsx
import { AGENT_COLOR_TOKEN } from "../agents";
import type { AgentId } from "../types";

interface MessageBubbleProps {
  message: AgentWatchMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const token = message.agentId !== "system" ? AGENT_COLOR_TOKEN[message.agentId as AgentId] : null;

  return (
    <div className="flex items-start gap-3">
      {/* 头像 — 不动，PR #16 已实现 */}

      <div
        className="flex-1 rounded-2xl bg-[#111] px-4 py-3"
        style={
          token
            ? {
                borderLeft: `2px solid ${token.primary}`,
                border: `1px solid ${token.soft}`, // soft 是 0.18 透明度紫蓝红
                boxShadow: `0 0 0 1px ${token.soft}, 0 8px 24px ${token.glow}10`, // 加微妙 glow
              }
            : { border: "1px solid rgba(255,255,255,0.08)" }
        } // system 消息不带配色
      >
        {/* 现有 header (name + LIVE + time) + content 不动 */}
      </div>
    </div>
  );
}
```

效果：3 Agent 气泡视觉立刻区分——Alpha 暖红边、Beta 蓝边、Gamma 紫边，左侧 2px accent 条作为强标识。

---

## 5. R5 — 信号流瘦身 + FocusCard 简化

### 5.1 MarketEventFeed 紧凑单行流

```tsx
// 当前：6 个 grid 大卡片
// 改后：垂直单行流，每行 ~28px 高，max 8 条

export function MarketEventFeed({ signals, labels }: MarketEventFeedProps) {
  const visible = signals.slice(0, 8).reverse();

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
        </span>
        {labels.title}
      </div>

      <AnimatePresence>
        {visible.length === 0 && (
          <motion.div className="px-2 py-1.5 text-xs text-white/30">{labels.empty}</motion.div>
        )}
        {visible.map((sig) => {
          const severityColor = SEVERITY_DOT[sig.severity];
          return (
            <motion.div
              key={sig.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.03]"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${severityColor}`} />
              <span className="shrink-0 font-mono text-[10px] text-white/40">
                {formatTime(sig.ts)}
              </span>
              <span className="truncate text-xs text-white/85">
                {sig.payload.description ?? ""}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

视觉对比：

- 当前 6 卡片 grid（约 280px 高）
- 改后 8 行紧凑流（约 240px 高）+ 内容更密 + 视觉权重降 60%

### 5.2 AgentFocusCard 简化

```tsx
// 当前：symbol + judgment + trigger + fail + evidence + time = 6 块信息
// 改后：symbol + judgment + trigger（visible）+ fail（折叠到 details）+ evidence + time

<motion.div className="card-glow flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#111] p-4">
  {" "}
  {/* p-5 → p-4 */}
  {/* Header: agent + symbol — 不动 */}
  {/* Judgment — 不动 */}
  {/* Trigger — 默认显示 */}
  <div className="flex items-start gap-2 border-t border-white/[0.06] pt-2 text-xs">
    <span className="shrink-0 rounded bg-[#7c5cff]/15 px-1.5 py-0.5 font-semibold text-[#b49cff]">
      {labels.trigger}
    </span>
    <span className="text-white/70">{focus.trigger.description}</span>
  </div>
  {/* Fail — 折叠到 <details> */}
  <details className="text-xs">
    <summary className="flex cursor-pointer select-none list-none items-center gap-1 text-white/40 hover:text-white/60">
      <span className="text-[10px]">▸</span>
      {labels.expandFail}
    </summary>
    <div className="mt-1 flex items-start gap-2 pl-3">
      <span className="shrink-0 rounded bg-[#ff5f5f]/15 px-1.5 py-0.5 font-semibold text-[#ff8a8a]">
        {labels.fail}
      </span>
      <span className="text-white/70">{focus.fail.description}</span>
    </div>
  </details>
  {/* Footer — 不动 */}
</motion.div>
```

视觉对比：

- 当前 ~200px 高（含 fail 始终显示）
- 改后 ~140px 高（fail 折叠默认收起）
- 用户点击 "▸ 失效条件" 可展开

### 5.3 i18n 新增字段

```json
"agentWatch": {
  // ... 现有字段
  "focusCard": {
    "warmup": "...",
    "watching": "关注",
    "trigger": "触发",
    "fail": "失效",
    "expandFail": "失效条件",      // ← 新增
    "evidenceCount": "{count} 条信号支撑",
    "minutesAgo": "{minutes} 分钟前"
  },
  "marketEvent": {
    "title": "市场信号流",
    "empty": "等待信号..."
  }
}
```

10 语全加（英文 fallback）。

---

## 6. 验收

### Grep 验证

- [ ] `grep "category !== \"majors\"" src/lib/marketSignals.ts` 存在（R1 守卫）
- [ ] `grep "禁止套话开头\|禁止复读\|必须引用 buffer\|集体信号" src/lib/llmFallbackChain.ts` 4 处都有（R2 + R4 prompt 约束）
- [ ] `grep "AGENT_COLOR_TOKEN" src/modules/agent-watch/components/MessageBubble.tsx` 存在（R3 配色）
- [ ] `grep "h-1.5 w-1.5\|truncate" src/modules/agent-watch/components/MarketEventFeed.tsx` 存在（R5 紧凑流）
- [ ] `grep "<details>\|expandFail" src/modules/agent-watch/components/AgentFocusCard.tsx` 存在（R5 折叠）

### 类型 / 构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功

### 行为（preview 上跑）

**场景 1 — 信号流不再有主流 RANGE 信号**：

1. 等 30s ticker 一轮
2. 看 MarketEventFeed：BTC/ETH/SOL/USDT 不再出现 RANGE 信号
3. 但 PROS / ZKJ / CHIP / BCAP / HASH / M 这些热门/机会币的 range_change 仍正常显示

**场景 2 — Agent 输出去套话**：

1. 等 10min LLM 一轮
2. 看 stream + focus 内容：
   - 不应该再出现 "X 现价 $Y, 24h Z%" 开头
   - 不应该再出现 "ETH/BTC/SOL 强弱排序已拉开"
   - 每条必须含具体信号引用（symbol + 数据 + 信号类型）

**场景 3 — 集体信号引用**：

1. 等到一个时刻：buffer 里 BTC + ETH + SOL 都 NEAR_LOW（或都 NEAR_HIGH 等同向信号）
2. 看下一轮 LLM 输出：3 Agent 之中至少 1 个引用这个集体信号

**场景 4 — 气泡视觉差异**：

1. MessageStream 滚动看连续多条消息
2. Alpha 气泡左侧暖红 accent 条，Beta 蓝色，Gamma 紫色
3. 边框颜色淡淡的 0.18 透明度，整体不喧宾夺主

**场景 5 — 信息密度降低**：

1. 首屏（无滚动）能看到：Ticker + 3 FocusCard + MarketEventFeed 头几行 + MessageStream 第一条消息
2. 而不是：Ticker + 信号流 + 3 FocusCard 占满，看不见 MessageStream

### 不退化

- [ ] task-09 v1.1 数据流不变
- [ ] focus 三路径（LLM / cache / static fallback）仍工作
- [ ] 三入口触发 buffer 仍生效
- [ ] 中文 locale 进 `/agent`，其他 locale 重定向

---

## 7. 约束

- 不动数据流和 buffer 类型（仅 R1 加 category 守卫）
- 不动 focus 字段结构（仅 UI 折叠）
- 不引新依赖
- 不改 task-07 人设（task-10 是 task-07 的"输出纪律"补充，不是替换）
- LLM prompt 中文输出仍中文，"输出纪律"段也用中文写

## 8. 提交

PR #16 同分支加 1 个 commit：

```sh
git checkout feature/act1-5-watch-sedimentation-01
git pull origin feature/act1-5-watch-sedimentation-01

# 实施 5 个文件改动 + i18n
git add src/lib/marketSignals.ts \
        src/lib/llmFallbackChain.ts \
        src/modules/agent-watch/components/MessageBubble.tsx \
        src/modules/agent-watch/components/MarketEventFeed.tsx \
        src/modules/agent-watch/components/AgentFocusCard.tsx \
        src/i18n/types.ts src/i18n/dicts/*.json

git commit -m "fix(watch): density + prompt discipline (task-10 v1.2)

- range_change signal skipped for majors (avoid ticker duplication)
- LLM prompt: ban opener cliches + ban ticker readback + force buffer signal evidence + collective signal detection
- MessageBubble: agent-faction color accent (red/blue/purple per Alpha/Beta/Gamma)
- MarketEventFeed: compact single-line flow (8 items max, ~28px each)
- AgentFocusCard: collapse fail condition into <details>, p-5 to p-4
- i18n: agentWatch.focusCard.expandFail + minor labels

Closes Dan v1.1 preview feedback (5 issues)"
git push origin feature/act1-5-watch-sedimentation-01
```

PR #16 自动更新。

---

## 9. 副审

不要求副审。Dan 验收逻辑是直接看 preview。

Codex 实施完后给 Dan 通知，Dan 在 preview 上：

1. 等 1 轮 ticker（30s）看信号流是否清理 majors RANGE
2. 等 1 轮 LLM（10min）看 Agent 输出是否去套话 + 引用信号
3. 滚 MessageStream 看 3 Agent 气泡是否配色差异
4. 整体首屏看信息密度是否合理

四项都过 → 整个 PR #11 stack 准备评审就绪。

---

_维护者: F_
_创建: 2026-04-28_
_执行者: Codex_
_基于: Dan v1.1 PR #16 preview 反馈_
_分支: 在 PR #16 同分支 feature/act1-5-watch-sedimentation-01 加 commit_
