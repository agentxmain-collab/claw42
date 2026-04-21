# Task 03 — Real URL 替换 + QuickStart 命令更新

> 分支：`feature/claw42-v1-1-polish`（**在 task-02 的分支上继续，不开新分支**）
> 依赖：Task 02（在途开发中，task-03 和 task-02 合并到同一个 PR）
> 预估：0.3 个工作日

## 目标

Dan 给了真实的 CTA 跳转 URL：`https://github.com/connectCoinw/coinw-skills`。把 Task 02 里所有 `#signup` / `#api-docs` / `#` 占位和 Quick Start 的示例命令一次性替换成真实内容。

## 变更范围

### 修改
- `src/app/page.tsx` —— QuickStart terminal command + 5 处 CTA href
- 可选：`src/lib/constants.ts` —— 抽一个 `COINW_SKILLS_URL` 常量（见 #3）

### 不动
- 任何 i18n dict 字段（文案一字不改，只换 href / command）
- Task 02 的结构 / 样式 / 动效 / 新 dict 字段

---

## 具体要求

### 1. QuickStart terminal 命令更新

位置：`src/app/page.tsx` 的 `QuickStartSection` 组件。

改 `command` 常量：

```tsx
const command = "npx skills add https://github.com/connectCoinw/coinw-skills";
```

Terminal body 的可视分词（原先是 `pip install claw42-sdk && claw42 run daily-report` 带绿色高亮）改为：

```tsx
<div className="leading-relaxed break-all">
  <span className="text-gray-500">$ </span>
  <span className="text-white">npx </span>
  <span className="text-green-400">skills add</span>
  <span className="text-white"> </span>
  <span className="text-[#7c5cff]">https://github.com/connectCoinw/coinw-skills</span>
</div>
```

要点：
- `skills add` 用绿色 `text-green-400`（保持和原 `claw42-sdk` 同色系，表示命令关键词）
- URL 用紫色 `text-[#7c5cff]`（和全站主色对齐，让 URL 视觉上可识别）
- 加 `break-all` 让长 URL 在窄屏上能换行不溢出终端框

### 2. 全站 CTA href 替换

5 处外链统一指向 `https://github.com/connectCoinw/coinw-skills`：

| # | 位置 | 文件 / 组件 | 当前 href | 新 href |
|---|------|-------------|-----------|---------|
| 1 | Hero 主 CTA「立即开始 / Get Started」 | `page.tsx` HeroSection | `#signup` | `https://github.com/connectCoinw/coinw-skills` |
| 2 | Hero 次 CTA「API 文档 / API Docs」 | `page.tsx` HeroSection | `#api-docs` | `https://github.com/connectCoinw/coinw-skills` |
| 3 | Scenarios 主板块「立即试用 / Try Now」 | `page.tsx` ScenariosSection | `#signup` | `https://github.com/connectCoinw/coinw-skills` |
| 4 | SkillsEco 卡片 1「Contract 了解详情」 | `SkillsEcoSection.tsx` | `#` | `https://github.com/connectCoinw/coinw-skills` |
| 5 | SkillsEco 卡片 2「Spot 了解详情」 | `SkillsEcoSection.tsx` | `#` | `https://github.com/connectCoinw/coinw-skills` |

**全部 5 个都是外链，统一加 `target="_blank" rel="noopener noreferrer"`**：

```tsx
<a
  href="https://github.com/connectCoinw/coinw-skills"
  target="_blank"
  rel="noopener noreferrer"
  className="..."
>
  {t.hero.ctaPrimary}
</a>
```

说明：
- `target="_blank"` 让新 tab 打开——用户跳到 GitHub 看完还能回来
- `rel="noopener noreferrer"` 是 `target="_blank"` 的标准安全配套，防止新页面反向操作 opener window

### 3. 常量抽取（推荐，不强制）

5 处重复写同一个 URL 容易漏改。推荐在 `src/lib/constants.ts` 里抽一个：

```ts
// src/lib/constants.ts
export const COINW_SKILLS_URL = "https://github.com/connectCoinw/coinw-skills";
```

然后 5 处 href 都 `import { COINW_SKILLS_URL } from "@/lib/constants"` 后引用。QuickStart 的 `command` 常量也可以复用：

```tsx
const command = `npx skills add ${COINW_SKILLS_URL}`;
```

不抽也可以，Airy 自己权衡。Dan 这阶段 URL 大概率稳定，硬编码也不算大坑。

---

## 验收标准

- [ ] Quick Start terminal 显示：`$ npx skills add https://github.com/connectCoinw/coinw-skills`（URL 紫色、`skills add` 绿色）
- [ ] 点 Quick Start 复制按钮，剪贴板内容 = `npx skills add https://github.com/connectCoinw/coinw-skills`
- [ ] `git grep -n "#signup" src/` **无任何匹配**
- [ ] `git grep -n "#api-docs" src/` **无任何匹配**
- [ ] `git grep -nE 'href="#"' src/` **无任何匹配**（SkillsEco 两个占位已替换）
- [ ] `git grep -n "connectCoinw/coinw-skills" src/` **至少 6 个匹配**（QuickStart command + 5 个 CTA href）。如果抽了常量，匹配数会更少——Airy 自行核对每个 CTA 最终指向正确
- [ ] 浏览器点击任一 CTA → 新 tab 打开 `https://github.com/connectCoinw/coinw-skills`
- [ ] 窄屏（375px）下 QuickStart terminal 里的长 URL 能换行，不溢出终端框
- [ ] 所有 5 个外链 `<a>` 都带 `target="_blank"` 和 `rel="noopener noreferrer"`
- [ ] `npm run build` 通过，无新 TS / ESLint 报错

---

## 约束 / 不要做的事

- ❌ **不开新分支**。在 Task 02 的 `feature/claw42-v1-1-polish` 上继续 commit
- ❌ 不改 i18n dict 任何字段（文案不变，只改 href / command）
- ❌ 不引入新依赖
- ❌ 不动 Task 02 的其他部分（不要顺手改 Scenarios 布局 / 动效 / 样式）
- ❌ URL 写死 `https://github.com/connectCoinw/coinw-skills`，不要用 `github.com/connectCoinw/coinw-skills` 省略 scheme（所有 5 处必须带 `https://`）

---

## Commit 策略

建议两个原子 commit：
1. `feat(quickstart): switch CLI example to npx skills add <coinw-skills url>`
2. `feat: wire all CTA hrefs to coinw-skills github repo`

如果抽了常量，第 2 个 commit 前加一个：
1. `chore: extract COINW_SKILLS_URL constant`

---

## 有歧义时问 F

- URL 拼写不确定（`connectCoinw` 大小写）→ 以本 spec 里写死的 `https://github.com/connectCoinw/coinw-skills` 为准
- 是否需要新 tab 打开 → 本 spec 里指定了 `target="_blank"`，不要自作主张去掉
- QuickStart 分词颜色看起来不好看 → 以 spec 指定的配色为准，不要自选颜色

---

*Spec: F（总调度）*
*日期: 2026-04-21*
*分支: `feature/claw42-v1-1-polish`（和 task-02 同分支同 PR）*
