# Task — 正式版（main）首页 2 项视觉修订

> ⚠️ **正式版（已上线 claw42.ai 的 Act 1）改动**——基于 `main` 分支，**不动** task-12/13/14/15 这些 act1.5 开发线。
>
> **执行者**：Codex
>
> **新分支**：`fix/prod-shadow-hover-01`（从 `main` 分出）
>
> **PR target**：`main`（**不是** feature/act1-5-watch-page-01）
>
> **关键纪律**：本 task 仅改 main 分支两个具体 CSS/UI 元素，不顺手改其他东西。

---

## 1. 改动 #1 — Quick Start Terminal 卡 box-shadow

### 1.1 现状

`src/app/[locale]/page.tsx` 内 `QuickStartSection` 函数下，Terminal 卡片使用 `terminal-glow` class。

`src/app/globals.css` 当前定义：

```css
/* Terminal glow */
.terminal-glow {
  box-shadow:
    0 0 40px rgba(108, 79, 255, 0.15),
    0 4px 30px rgba(0, 0, 0, 0.5);
}
```

### 1.2 修订

`globals.css` 替换 `.terminal-glow` 的 `box-shadow` 为：

```css
.terminal-glow {
  box-shadow: 0 20px 40px 0 rgba(0, 0, 0, 0.2);
}
```

### 1.3 验收

- [ ] `git diff` 在 globals.css 中 `.terminal-glow` 仅这一行 box-shadow 变化
- [ ] 不动 `.terminal-glow` 之外任何 CSS
- [ ] `src/app/[locale]/page.tsx` 不需要改（class 名不变）
- [ ] preview 看 Quick Start Terminal 卡阴影变成更克制的下方阴影（不再是紫色 glow）

---

## 2. 改动 #2 — Why 区 3 张卡 hover 紫色底条全局化

### 2.1 现状（问题）

`src/app/[locale]/page.tsx` 内 `WhySection` 函数渲染 3 张 Why 卡（Competitive Credibility / Cultivation Symbiosis / Self-Driven Ecosystem），当前**只有中间那张**（`i === 1`）有底部紫色 gradient 条作为**静态装饰**：

```tsx
// 当前代码
<motion.div className="card-glow relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] p-8">
  ...卡内容...
  {i === 1 && (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6c4fff] to-[#a78bfa]" />
  )}
</motion.div>
```

**Dan 反馈**：这个紫色底条**应该是 hover 状态触发的全局效果**，不是中间那张卡的独占静态装饰。

### 2.2 修订

把 `{i === 1 && ...}` 条件渲染**移除**，改成每张卡都有底部 gradient 条，但**仅在 hover 时显示**（透明度 0 → 1 过渡）。

```tsx
// 修订后
<motion.div
  ...
  whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
  className="card-glow group relative bg-[#111] border border-white/10 rounded-2xl p-8 flex flex-col overflow-hidden"
>
  ...卡内容（不含 {i === 1 && ...}）...

  {/* 全局底部 hover gradient — 每张卡都有，仅 hover 时显示 */}
  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6c4fff] to-[#a78bfa] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
</motion.div>
```

**关键改动点**：

1. 卡片 div 加 `group` class（让子元素能用 `group-hover:`）
2. 删除 `{i === 1 && ( ... )}` 条件渲染
3. 把 gradient div 移到 `cards.map` 内每张卡都渲染
4. gradient div 加 `opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`

### 2.3 关于 reduce-motion

如果用户设置 `prefers-reduced-motion: reduce`，`transition-opacity` 仍生效（200-300ms 过渡是温和动画，不属于强动效，符合 a11y）。但如果要严格匹配 spec 规范可以加：

```tsx
className={`... opacity-0 group-hover:opacity-100 ${reduceMotion ? '' : 'transition-opacity duration-300'} pointer-events-none`}
```

**判断**：fade transition 不算 motion，保持 transition 即可。**不需要为 reduce-motion 单独处理**。

### 2.4 验收

- [ ] `WhySection` 内不再有 `i === 1` 字面量条件渲染（grep 确认）
- [ ] 3 张 Why 卡都有底部 gradient 条 div（每张都渲染，不是仅中间）
- [ ] 默认状态：3 张卡都**没有**底部紫色条（opacity-0）
- [ ] hover 任一张卡：该卡底部出现紫色 gradient 条（opacity-100）+ 200-300ms fade-in
- [ ] hover 离开：fade-out 回 opacity-0
- [ ] 多张卡同时 hover（虽然鼠标只能一个，但 keyboard focus 可能） → 各自独立显示
- [ ] reduce-motion 用户：fade 仍生效（这不算激进动效）

---

## 3. 不要做的事（边界）

- ❌ 不动 `card-glow` class 本身的样式（保持现有蓝色边框 hover 不变）
- ❌ 不动其他分支（feature/act1-5-\* 不碰）
- ❌ 不动 `QuickStartSection` 内的 React 代码（class 名不变，只改 CSS 定义）
- ❌ 不顺手"清理"其他 CSS / 不顺手 prettier-format 整个 globals.css 制造大 diff
- ❌ 不动 i18n（文案 / 按钮都不改）
- ❌ 不动其他 Section（Scenarios / SkillsEco / StartTrade / Hero）

---

## 4. 提交命令

```sh
git checkout main
git pull origin main
git checkout -b fix/prod-shadow-hover-01

# 改动 #1：globals.css 的 .terminal-glow
# 改动 #2：page.tsx 的 WhySection（移除 i===1 + 加 group + 全局 hover gradient）

git add src/app/globals.css src/app/\[locale\]/page.tsx
git commit -m "fix(prod): terminal shadow + why card hover gradient globalized

- terminal-glow box-shadow: replaced purple-tinted multi-layer glow with cleaner '0 20px 40px 0 rgba(0,0,0,0.20)' (Dan-requested)
- WhySection: removed i===1 conditional purple gradient bar; now every card has bottom hover gradient via group-hover (was middle-card-only static decoration, intent was global hover effect)
- No other changes; CSS-only diff for terminal-glow, JSX-only diff for WhySection map"

git push origin fix/prod-shadow-hover-01
```

PR target：`main`

---

## 5. 风险与回滚

| 项                                | 风险                                              | 缓解                                                            |
| --------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| terminal-glow 改阴影              | 用户视觉 "卡片浮起感"变弱（之前紫色 glow 有质感） | 改动符合 Dan 拍板，不阻塞；如不满意可后续单独调                 |
| Why 卡 hover gradient 全局化      | 可能用户更倾向中间那张"特殊"的视觉锚点            | spec 等于全部一致 — 如想保留中间特殊可后续加 "is_featured" prop |
| group / group-hover Tailwind 配置 | 项目用 Tailwind 3.4，group 是默认特性             | 无需配置，直接用                                                |
| Vercel preview / prod 直接部署    | 改动小，preview 验证 5 分钟即可                   | 标准 PR 流程                                                    |

**回滚**：单 commit revert 即可。

---

## 6. 转 Codex 派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-prod-shadow-hover-01.md
新分支：fix/prod-shadow-hover-01（从 main 分出，⚠️ 不是 act1-5 任何分支）
PR target：main

2 项 CSS/UI 改动：
1. globals.css 的 .terminal-glow box-shadow 替换为 "0 20px 40px 0 rgba(0,0,0,0.20)"
2. page.tsx 的 WhySection 移除 i===1 紫色 gradient 静态渲染，改成每张卡 group-hover:opacity-100 全局生效

⚠️ 严格只改这 2 处，不顺手 format 不顺手清理其他 CSS。
verify 通过后 push，PR target 是 main。
```

---

_维护者: F_
_创建: 2026-05-05_
_执行者: Codex_
_分支: fix/prod-shadow-hover-01_
_Base: main（正式版，与 act1.5 开发线无关）_
