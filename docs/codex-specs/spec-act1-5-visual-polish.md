# Spec — Act 1.5 旁观秀页面视觉对齐主页（增量修订）

## 目标

PR #11 (`feature/act1-5-watch-page-01`) 已经把功能完整跑起来，但视觉骨架和 claw42 主页（`/{locale}/`）不一致。本 spec 是**增量视觉修订**，在同一分支 `feature/act1-5-watch-page-01` 上加新 commit。

修订原则：

- 视觉对齐**主页 ScenariosSection / WhySection / SkillsEcoSection** 的设计语言
- 严格保持 claw42 蓝紫红配色体系，**禁用绿色作为主调**（绿色只能作为状态点 amber 的对位，且必须很克制）
- 删除生产期不该出现的 debug 标签
- 不改产品功能、不改 LLM 调度逻辑、不改 i18n 文案
- 不动 Agent 头像图片资源（等头像 PR 落地后再统一），只动配色 token

## 分支策略

```
git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
# 在此分支上加新 commit，不要新开分支
git add ...
git commit -m "polish(act1-5): align watch page visuals with main landing"
git push origin feature/act1-5-watch-page-01
```

PR #11 自动更新。

## 变更范围

### 修改

- `src/modules/agent-watch/AgentWatchBoard.tsx` — 整体 page bg + 删除 fallback banner / debug badge
- `src/modules/agent-watch/components/TopicHeader.tsx` — 简化标题区，去 card-glow 包裹
- `src/modules/agent-watch/components/AgentSidebar.tsx` — 简化 sidebar 卡片样式 + 状态点配色
- `src/modules/agent-watch/components/MessageStream.tsx` — Live tag 配色
- `src/modules/agent-watch/components/MessageBubble.tsx` — Live tag 配色（如出现）
- `src/modules/agent-watch/agents.ts` — Agent 配色 token 修订（Beta 改蓝、Alpha 调暖红）
- `src/modules/agent-watch/skills/{alpha,beta,gamma}.json` — color 字段同步修订
- `src/app/[locale]/agent/page.tsx` — 加 radial gradient 背景层

### 不动

- 任何 LLM 调度逻辑（`src/lib/llmFallbackChain.ts` / `src/lib/marketDataCache.ts` / `src/app/api/**`）
- `src/modules/agent-watch/types.ts` / `hooks/useAgentAnalysis.ts`
- `src/modules/landing/HeroScene/**`（hero 注入逻辑不动）
- 任何 i18n 文案和 types
- `src/components/SiteHeader.tsx`
- 主页 page.tsx（link 卡视觉如已 OK 不动）
- `globals.css`（card-glow 现有定义沿用）
- `package.json`

## 视觉锚点参考

修订时**对照** `src/modules/landing/`下面这几个组件取设计语言：

- `WhySection`（在 `page.tsx` 内）— 标题区 + 三卡布局的标准
- `SkillsEcoSection.tsx` — 卡片悬浮效果 + bg-[#111] 容器风格
- `ScenariosSection.tsx` — `ChatPreviewCard`（DailyReportCard 第二列）的紫色 glow shadow 是消息气泡的参考
- `HeroScene.tsx` — radial gradient 背景层叠组合

---

## Section 1 — 删除 debug / fallback 噪音

### 1.1 AgentWatchBoard.tsx

**当前问题**：在标题旁显示 `static-fallback` 标签 + 黄色 banner "行情服务暂时降级"——生产期用户看到这些会困惑、视觉抢戏。

**修订**：

- 删除标题区渲染 `data.source` 的 debug badge（应该已经在 TopicHeader 里渲染——见 1.2）
- 黄色 banner 完全删除（这是末日 fallback 用户看不见，无需告知）—— 如果 LLM 真挂了，前端走静态文案，用户没必要知道后端在降级
- 如果 PM 后续要 debug toggle，加 query param `?debug=1` 才显示——本 spec 不做

```tsx
// 删除类似下面的渲染:
{
  data?.source === "static-fallback" && (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      {t.agentWatch.fallbackNotice}
    </div>
  );
}
```

### 1.2 TopicHeader.tsx

**当前问题**：标题旁有一个 mono 字体的 `static-fallback` 小 badge（截图里贴着 "实时旁观"）—— 删除。

**修订**：

- 找到形如 `<span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/45">` 这样渲染 source 的位置，**整块删除**
- 保留 cw-green LIVE 脉动点（这个对的，Live 状态指示是合理的）—— 但配色改紫，见 Section 4

---

## Section 2 — Agent 配色 token 修订

### 2.1 改 Beta 从绿到蓝

**现状**：截图里 Beta sidebar 头像底色是绿色 `#3ddc97` / `#22c55e` 类。

**问题**：绿色不在 claw42 品牌色（紫 #7c5cff / 蓝 #4a88ff / 暖红 #ff5f5f），且 Beta 角色定位是"稳健派"——蓝色才是国际通用的稳健金融色。

**修订** `agents.ts` 和 `skills/beta.json` 的 color：

```ts
// skills/beta.json
"color": "#3a7bff"  // 主色调
```

加配色 token（如果还没有）：

```ts
// agents.ts
export const AGENT_COLOR_TOKEN: Record<AgentId, { primary: string; soft: string; glow: string }> = {
  alpha: {
    primary: "#ff5f5f",
    soft: "rgba(255, 95, 95, 0.18)",
    glow: "rgba(255, 95, 95, 0.42)",
  },
  beta: {
    primary: "#3a7bff",
    soft: "rgba(58, 123, 255, 0.18)",
    glow: "rgba(58, 123, 255, 0.42)",
  },
  gamma: {
    primary: "#9b6bff",
    soft: "rgba(155, 107, 255, 0.18)",
    glow: "rgba(155, 107, 255, 0.42)",
  },
};
```

### 2.2 Alpha / Gamma 微调

- Alpha：当前 `#ff6b6b` 偏粉，改 `#ff5f5f`（更暖红，对齐 hero 机器人 spec 里 Alpha 的暖红基调）
- Gamma：保留 `#9b6bff`（如果当前已是这个色就不改），未对齐就改

同步改 `skills/alpha.json` / `gamma.json` 的 `color` 字段。

### 2.3 状态点配色

**当前问题**：Sidebar 状态点 思考中/发言中/静默 三档，截图里 thinking 用 amber、speaking 用 cw-green、idle 灰。

**修订**：

- 思考中：amber `#fbbf24`（保留）
- 发言中：从 cw-green 改成**紫色 #b49cff** + 加 ping 脉动动画（参考 ScenariosSection 里 ChatPreviewCard 的紫色蓝光）
- 静默：白 12% 灰（保留）

`AgentSidebar.tsx` 状态点的 className 调整：

```tsx
// before:
const cls = status === "speaking" ? "bg-cw-green animate-pulse" : ...

// after:
const cls = status === "speaking"
  ? "bg-[#b49cff] shadow-[0_0_8px_rgba(124,92,255,0.6)] animate-pulse"
  : status === "thinking"
  ? "bg-amber-400 animate-pulse"
  : "bg-white/20";
```

---

## Section 3 — Sidebar 卡片简化

### 3.1 去 card-glow

**当前问题**：`AgentSidebar.tsx` 给 3 个 Agent 卡片加了 `card-glow` class——但 sidebar 里用户不 hover，双光晕层永远不显示，是死代码。视觉上没好处但有 z-index 干扰风险。

**修订**：去掉 `card-glow` class，保留其他视觉。

```tsx
// before:
className = "card-glow flex items-start gap-3 rounded-2xl border border-white/10 bg-[#111] p-4";

// after:
className = "flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#0e0e10] p-4";
```

### 3.2 头像背景用 token glow

把当前 sidebar Agent 头像的纯色块（A/B/G 字母按钮）改用 AGENT_COLOR_TOKEN 的 soft + glow：

```tsx
import { AGENT_COLOR_TOKEN } from "../agents";

const token = AGENT_COLOR_TOKEN[meta.id];

<div
  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black"
  style={{
    background: `linear-gradient(135deg, ${token.primary} 0%, ${token.soft} 100%)`,
    boxShadow: `0 0 18px ${token.glow}, inset 0 0 0 1px rgba(255,255,255,0.08)`,
    color: "#fff",
  }}
>
  {meta.avatar}
</div>;
```

效果：每个 Agent 头像不再是死板色块，而是带 glow 的渐变小章——视觉立刻有质感。

### 3.3 hover 微动效

3 Agent 卡片加 `hover:bg-white/[0.03] transition-colors`——克制的反馈，不需要主页那种 `whileHover={{ y: -8 }}`（sidebar 不需要那么张扬）。

---

## Section 4 — TopicHeader 标题区简化

### 4.1 去 card-glow 包裹

**当前问题**：TopicHeader 用 card-glow 包了一个大卡片包标题——主页其他 section title 都不这么做（直接 heading + p 在容器里）。card-glow 化的标题让"标题"读起来像"卡片"，重了。

**修订**：

```tsx
// before
<div className="card-glow rounded-2xl border border-white/10 bg-[#111] p-6 md:p-8">
  ...标题内容
</div>

// after
<div className="px-2 md:px-0 mb-6 md:mb-8">
  <div className="mb-3 flex items-center gap-3">
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7c5cff]" />
    </span>
    <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#b49cff]">
      {/* LIVE 标签文字保留 */}
    </span>
  </div>
  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-white tracking-tight">
    {/* 标题保留 */}
  </h1>
  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60 md:text-base">
    {/* 副标题保留 */}
  </p>
</div>
```

### 4.2 LIVE dot 配色

ping + 实心点都从 cw-green 改成**紫色 #7c5cff**：

- 外层 ping `bg-[#b49cff]` (淡紫)
- 内层实心 `bg-[#7c5cff]` (主紫)
- 文字色 `text-[#b49cff]`

主页里凡是 "LIVE" 标记都用紫色脉动点，不要绿色——保持品牌一致。

---

## Section 5 — Page 整体加 radial gradient ambient

### 5.1 Page-level 背景层

`src/app/[locale]/agent/page.tsx` 给 page 容器加一层固定的 radial gradient 背景层——参考 HeroScene 的多层 gradient 组合。

**修订**：

```tsx
// page.tsx
export default function AgentPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* Ambient layer 1: 顶部紫光 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 60% at 50% 0%, rgba(124, 92, 255, 0.16) 0%, rgba(0, 0, 0, 0) 60%)`,
        }}
      />
      {/* Ambient layer 2: 中部蓝光 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 40% at 50% 50%, rgba(58, 123, 255, 0.06) 0%, rgba(0, 0, 0, 0) 70%)`,
        }}
      />
      {/* 主内容层 */}
      <div className="relative z-10">
        <AgentWatchBoard />
      </div>
    </main>
  );
}
```

效果：页面顶部有淡紫色 ambient halo（暗示"AI 在场"），中部有微蓝呼吸（呼应行情与冷静）。比纯黑背景更有沉浸感。

---

## Section 6 — MessageStream 微调

### 6.1 LIVE tag 配色

如果 MessageBubble 或 MessageStream 里有 `<span className="...bg-cw-green...">LIVE</span>` 这样的标签，全部改成紫色：

```tsx
// before
<span className="... text-cw-green ...">LIVE</span>

// after
<span className="... text-[#b49cff] bg-[#7c5cff]/12 border-[#7c5cff]/30 ...">LIVE</span>
```

### 6.2 消息气泡 hover 微 glow（可选）

MessageBubble 加一个克制的 hover glow（参考 ChatPreviewCard 的紫色阴影）：

```tsx
className = "... transition-shadow hover:shadow-[0_0_24px_rgba(124,92,255,0.18)]";
```

不强制，看 Codex 实施时视觉效果决定。

---

## 验收标准

### Grep 验证

- [ ] `grep "static-fallback" src/modules/agent-watch/components/TopicHeader.tsx` 无输出
- [ ] `grep "fallbackNotice\|amber-500\|amber-200" src/modules/agent-watch/AgentWatchBoard.tsx` 无 banner 渲染
- [ ] `grep "cw-green" src/modules/agent-watch/` 输出 ≤ 0（绿色完全清除）
- [ ] `grep "card-glow" src/modules/agent-watch/components/AgentSidebar.tsx` 无输出（sidebar 不再用 card-glow）
- [ ] `grep "card-glow" src/modules/agent-watch/components/TopicHeader.tsx` 无输出（标题区不再卡片化）
- [ ] `grep "AGENT_COLOR_TOKEN" src/modules/agent-watch/agents.ts` 有定义

### 视觉对照

- [ ] 访问 `/zh_CN/agent` 顶部能看到淡紫色 ambient halo（不是纯黑底）
- [ ] Sidebar 3 Agent 头像分别是：Alpha 暖红 / Beta 蓝 / Gamma 紫，渐变 + glow
- [ ] 标题区 "3 个 Agent 正在分析行情" 不再被卡片包裹，直接 heading + p
- [ ] LIVE 脉动点是紫色（不是绿色）
- [ ] 状态点 "发言中" 是紫色 ping，"思考中" amber，"静默" 灰
- [ ] 没有 "static-fallback" debug badge
- [ ] 没有黄色 "行情服务暂时降级" banner
- [ ] 整体 feel 和主页 ScenariosSection / WhySection 视觉语言连续

### 功能不退化

- [ ] tsc 通过
- [ ] build 通过
- [ ] LLM fallback chain 行为不变（grep 验证 `src/lib/llmFallbackChain.ts` 未被修改）
- [ ] middleware 非中文 redirect 仍生效
- [ ] Hero 中文 dynamic pool 注入仍生效

---

## 约束

- **不动 LLM 调度任何代码**——本次修订只改视觉
- **不动 i18n 文案**（删除 fallbackNotice 渲染但 i18n key 可保留，方便未来 debug 用）
- **不引新依赖**
- **不改 globals.css**——card-glow 现有定义复用
- 配色严格在 `#7c5cff` (主紫) / `#b49cff` (淡紫) / `#3a7bff` (主蓝) / `#ff5f5f` (暖红) / amber `#fbbf24` 范围内
- 不要重构组件树结构——只改 className / style / 局部增删
- TopicHeader 重写时保留所有 i18n 文本调用 `t.agentWatch.pageTitle` 等

## 提交

同分支 `feature/act1-5-watch-page-01` 加新 commit：

```
polish(act1-5): align watch page visuals with main landing

- Remove static-fallback debug badge and amber fallback banner
- Beta color: green → blue (#3a7bff) for risk-control persona
- Alpha color tweak: pink → warm red (#ff5f5f)
- Add AGENT_COLOR_TOKEN with primary/soft/glow per agent
- Sidebar avatars use gradient + glow instead of flat color blocks
- Drop card-glow from sidebar items and topic header (no hover value)
- LIVE pulse + speaking dot: cw-green → claw42 purple
- Page-level ambient: dual radial gradient (purple top + blue mid)
- Remove all cw-green usages in agent-watch module
```

push 到 PR #11 自动更新，等 Vercel preview rebuild 后我审视觉。

## 有疑问不要猜

- 某个组件改完视觉变形 → 截图发 Dan，不要乱调
- TopicHeader 重写后字号或间距和主页 WhySection 还是不一致 → 直接看 `src/app/[locale]/page.tsx` 里 WhySection 的 `text-3xl md:text-4xl` 和 `mb-X` 数值复制
- card-glow 删掉后某些卡片显得"扁" → 加 `border-white/[0.08]` 比 `border-white/10` 略弱 + bg `#0e0e10` 比 `#111` 略深，重新拉出层次
- 头像渐变在 mobile 太亮 → 把 boxShadow 的 glow 透明度从 0.42 降到 0.28
- 不确定 Beta 改蓝后 Alpha/Gamma 三色是否还能区分 → 截图三个并排发 Dan 看

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Codex_
_基于: PR #11 已落地的 d8cc487_
_配套: spec-act1-5-agent-avatars.md（头像 PR 落地后再统一 Agent 头像图片）_
