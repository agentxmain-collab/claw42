# Spec: C-Line UI Uplift v1 — 视觉造型替换（不动 backend）

> **版本**：v1.0-FINAL Dan APPROVED @ 2026-05-24
> **作者**：F
> **状态**：**READY-TO-DISPATCH**。v0.1 → v1.0 升级：v11-fix prod release 已完工（commit `8b141587` merged main / claw42.ai 已切 v11）/ Dan @ 2026-05-24 chat 4 答 + Constitution Rule 4 例外授权（前次 chat "go"）+ 一天后上线（外部时间节点）+ Claude Design 第二轮 zip 已重新入仓（17 SVG + how-it-works.html 1649 行 verify ✓）+ 加 T022 i18n 全 locale 文案补 + T023 手机端基础响应式。
> **协议**：claude-codex-protocol v2.5 19 段
> **依赖**：main HEAD `8b141587615be1525931677bff10209a79ae2979`（v11-fix prod release）`v10/Hero.tsx` + `v10/Constellation.tsx` + `v10/WatchTabs.tsx` + `v10/staticContent.ts` + `v10/useConstellationFocus.ts` 全 merged；hotfix 1-6 + v10/v11 + v11-fix Constitution Rule 4 例外（publicTimelineProjection 改动）全维持；C-Series 4 spec (Security / Blind-Spot / Prod-Release / B.15) 仍未派 / 不阻塞本期
> **关联设计源**：`42temp-handoff (1).zip` (2026-05-24 Dan 重新上传 / 之前临时路径已丢) → T001 已部分入仓 `claw42/design-source/c-line-ui-uplift-v1/`（含 `how-it-works.html` 1649 行主设计 + 17 SVG `avatars/*.svg`（14 角色 + 2 PM 备用 + 1 bot-base）+ `_hero_html.html` + `_hero_css.css` + `_combined_styles.css` + `canonical-base.html` + `README.md` + 探索版本 v1-v13 + `04-step-anims/` 等子目录）；6.6MB standalone html + 47MB uploads/ 子目录用 `.gitignore` 排除（不入 git / Codex T001 收尾时加规则）

---

## § 0 Dan @ 2026-05-24 directive 承接（v1.0 新增）

### § 0.1 Dan 4 答 chat 原话

| #   | Dan 答                                                                                                              | F 翻译                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 富交互且专业 / 细节满满值得信赖                                                                                     | 视觉品质 = "真团队在跑的专业感" / 拒绝 placeholder 感 / 细节做满                                                                                                                                                 |
| 2   | 公开                                                                                                                | 公开发布给所有人 / 非内部小圈子                                                                                                                                                                                  |
| 3   | 你来判断难度，web 优先                                                                                              | F 判断 = web 全做 + 手机端基础响应式（保证不丑、能用）/ 不做手机专属交互 / 后续单独 phase 优化手机                                                                                                               |
| 4   | 这次就是真的了。节奏是现在做的是原 prod+A+B 的合并，这个验收和 merge 后，就只剩一条主线，然后在这个主线上做 UI 迭代 | **F 后续 catch + Dan 纠正**：「真」= 纯 UI 真（视觉/文案/元素/动画做到精致）/ backend 仍**不动**（"UI 和实际功能分开" 元规则保持）/ face-off 真辩论 / PM 真切换 / memoryLoop 真闭环 等 = UI 完成后下一阶段单独推 |

### § 0.2 v0.1 → v1.0 核心变化

1. **状态升级**：DRAFT/NOT-READY-TO-DISPATCH → READY-TO-DISPATCH（v11-fix prod 已合 + main 单一主线 + Claude Design zip 已入仓 + Dan 一天后上线 directive）
2. **范围微扩**：v0.1 21 个 T### + **新增 T022 i18n 全 10 locale 文案补**（确保 en_US 等所有 locale 翻译完整 / 不再有 placeholder）+ **新增 T023 手机端基础响应式 fallback**（< 880px 不丑 / 不破 hero / 不引入 mobile 专属交互）
3. **元规则保持**：「UI 和实际功能分开」依旧 / backend / schema / pipeline / 14 TeamMemberId / hotfix 1-6 + v10/v11 红线全不动（Dan 4 答 catch 后纠正）
4. **Constitution Rule 4 例外承接**：v11-fix 已用 Dan "go" 字符级 apply 改了 `publicTimelineProjection.ts` / 本 spec 不再触及 / 已是 main / 不再属于 v1 范围内 carry-over 工作
5. **资源 verify**：F 实测 17 SVG / how-it-works.html 109KB（1649 行级别）/ canonical + hero + combined CSS 都齐
6. **24h 截止外部节点**：Dan 2026-05-24 凌晨 00:08 拍 "一天后上线" → 截止 2026-05-25 00:08。当前 2026-05-24 15:50 = 剩 ~8 小时

### § 0.3 派工方案

按 v0.1 Stage 1-6 顺序 / Stage 1 入仓 T001 已部分跑（zip 解压 + 17 SVG + 主 HTML 就位）/ Codex 收尾 T001 = 加 `.gitignore`（standalone + uploads/ 大文件排除）+ commit + verify。然后 T002-T021 + 新加 T022-T023 一波过。

### § 0.4 与 v11-fix 主线衔接

- 当前 prod = `8b141587` (v11-fix release) / claw42.ai 跑这个版本 / zh_CN dashboard ready / en_US 等 cron 多轮（§ 3.51 Codex 在补）
- 本期 UI 改版 PR base 从最新 main 拉 / 必须 rebase / 不基于 v0.1 旧 base
- merge 完直接走 prod release runbook（§ 3.39 模板）/ Dan 不字符级 apply（按 Dan 之前 directive「merge 也是你们」）/ Dan 一次性验收预发 + prod

---

## ★ 核心元规则（Dan 2026-05-20 chat 重复强调两次 + 2026-05-24 catch 再确认）

> **UI 和实际功能分开**——本次新版是"介绍性展示"，backend / schema / pipeline / 红线全部不动。

**2026-05-24 Dan 纠正补强**：「这次就是真的了」≠ backend 真。是「纯 UI 真」= 视觉 / 文案 / 元素 / 动画做到精致、富交互、专业、细节满满、值得信赖。face-off 真辩论 / PM 真切换 / memoryLoop 真闭环 = UI 完成后下一阶段单独推 / 不在本 v1 范围。

具体边界：

- **UI 视觉 / 文案展示 / 交互动画** = 按新版 Claude Design
- **backend / schema / pipeline / hotfix 1-6 红线 / leakCount=0 / canonical ordering / waitUntil / watch-only strict gate / 14 TeamMemberId / i18n 现有 displayName** = 不动
- visual placeholder / 介绍性 copy 标明"展示"性质，不承诺真实能力

此元规则在 § 1 / § 13 / § 17 重复出现，强制所有 task 受约束。

---

## § 1 Overview

### 1.1 背景

2026-05-20 Dan 上传 `42temp-handoff (1).zip` — Claude Design 第二轮 UI bundle（含 `how-it-works.html` 1649 行主设计 + 14 SVG + 多版本 Hero 探索 + 50+ screenshots）。

Dan 原话："新版UI来了，但和当前已经定了的板式，动画都有一定偏差，你先分析 我们一项一项确认"。

### 1.2 现状 verify（grep main 实测，不依赖 F 记忆）

main HEAD 已经实装 v10 架构——本次不是新增架构，是**造型资源替换 + 动画补强**：

| 已实装                                                                     | 文件                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Hero + Tab 切换 (flow / mkt)                                               | `src/modules/agent-watch/v10/Hero.tsx` + `WatchTabs.tsx` |
| 3D 星座 (3 tier perspective + dolly focus)                                 | `v10/Constellation.tsx` + `v10/useConstellationFocus.ts` |
| 11 anode static config (tier-c 4 / tier-b 4 / tier-a 3)                    | `v10/staticContent.ts`                                   |
| 6 flowStages                                                               | `v10/staticContent.ts` `flowStages`                      |
| `.fstage4` / `.fstage4.debate` / `.fstage4.final` / `.fstage4.memory` 形态 | `v9/dispatchConsoleV9.module.css:185+`                   |
| i18n `"11 roles · 6 stages"` 8 dict 已国际化                               | `src/i18n/dicts/*.json:406`                              |
| `Hero.test.tsx:21` assert `.anode` 数量 = 11                               | 测试已存在                                               |

### 1.3 本期范围

替换 **11 hero anode 造型** + **6 stage card 造型** + **加眨眼 / hover / 装饰动画**——backend / schema / 红线全部不碰。

---

## § 2 In-Scope

### 2.1 Stage 1 — Design source 入仓归档（P0）

- **T001**：把 `42temp-handoff (1).zip` 解压内容归档到 `claw42/design-source/c-line-ui-uplift-v1/`（design source 进 main 已是项目纪律）：
  - `how-it-works.html` 主设计
  - `avatars/*.svg` 14 个角色 SVG
  - `_hero_html.html` + `_hero_css.css` + `_combined_styles.css`
  - `canonical-base.html` + `README.md`
  - **不进**：`screenshots/*.png` 50+ 张（体积大，不进 git；保留外部备份路径在 README）

### 2.2 Stage 2 — Hero 11 anode 造型替换（P0）

- **T002**：用 `avatars/*.svg` 替换 `v10/AgentNode.tsx` 当前 CSS 头像
- **T003**：14 SVG → 11 hero anode 完整 mapping（保持 `staticContent.ts` 现有 11 个 `DispatchV10AgentRoleId` 不动）：

| Hero anode `id`           | SVG 文件                            | 备注                                     |
| ------------------------- | ----------------------------------- | ---------------------------------------- |
| `news` (NEWS·N)           | `avatars/news_analyst.svg`          | radar ping SMIL 替代 eye blink           |
| `technical` (TECH·T)      | `avatars/chart_analyst.svg`         | K 线 candle 眼                           |
| `aggressive` (AGGR·A)     | `avatars/aggressive_reviewer.svg`   | bolt flicker 替代 eye blink              |
| `neutral` (NEUT·N)        | `avatars/neutral_reviewer.svg`      | equal symbol 眼                          |
| `fundamental` (FUND·F)    | `avatars/fundamental_analyst.svg`   | $ dollar 眼                              |
| `onchain` (CHAIN·O)       | `avatars/onchain_analyst.svg`       | 4-node chain 跨双眼                      |
| `conservative` (CONS·C)   | `avatars/conservative_reviewer.svg` | shield 眼                                |
| `portfolioManager` (PM·★) | `avatars/pm-approve.svg` (default)  | 3 状态视情况切换；本期先 default approve |
| `bullish` (BULL·↑)        | `avatars/bullish_researcher.svg`    | caret-up 眼                              |
| `bearish` (BEAR·↓)        | `avatars/bearish_researcher.svg`    | caret-down 眼                            |
| `trader` (TRADE·$)        | `avatars/trader.svg`                | swap arrows 眼                           |

- **T004**：眨眼 / float / ring expand 动画统一接入（eye blink 4.6s / coreFloat 5.4s / ringExpand 4s 错相）
- **T005**：news radar ping SMIL / aggressive bolt flicker 差异化（design source README 已写明 timing 预算）

### 2.3 Stage 3 — 6 stage card 造型 + memoryLoop（P0）

- **T006**：6 个 `.fstage4` 卡片用同一套 14 SVG 中的 12 个（11 + memory_loop）
- **T007**：第 6 stage memoryLoop 用 `avatars/memory_loop.svg`（⟲ loop 眼）
- **T008**：卡片 hover 动画：fstage4 hover translateY(-1px) + border purple/lime 切换 + box-shadow + .fs4-cnt 背景脉冲 + 大数字 watermark stroke 颜色变化
- **T009**：`.fagent-avatar` 卡片内小机器人头复用 SVG（不再用字母 + CSS pseudo robot）

### 2.4 Stage 4 — 中央 core robot 装饰（P0）

- **T010**：Hero 中央 core robot —— **纯装饰**，不绑 TeamMemberId，不绑 PM
- **T011**：core robot 140px head + antenna pulse + chat indicator pill + eyeBlink 4.6s + ring × 3 stagger + podium glow + sceneBreath 18s（参考 `how-it-works.html` 850-1100 行 `.core` CSS）

### 2.5 Stage 5 — 装饰元素全采纳（P0）

按 Dan 拍 "D 新的"——8 项装饰全采纳：

- **T012**：`.stage-connector` 卡片间 SVG 曲线 + dashFlow 2.6s + nodule pulse
- **T013**：`.fstage4-side::after` 大数字 watermark stroke-only 200px
- **T014**：anode hover reticle 4 角 bracket
- **T015**：anode hover readout callout (ID / ROLE / STAT)，1.7s delay 弹出
- **T016**：anode `.screen` 内 scanline drift
- **T017**：news radar ping SMIL（已在 T005 含）
- **T018**：aggressive bolt flicker（已在 T005 含）
- **T019**：tier-b 部分 anode + tier-a 部分 anode `.speech-dot` "is talking" 3 点动画

### 2.6 Stage 6 — face-off Stage 2 布局（P0，介绍性 UI）

- **T020**：Stage 2 `.fstage4.faceoff` 布局 — bull(1fr) - VS(96px) - bear(1fr)，中间双向渐变线 + `.x` 24px display 字体 "VS"
- **T021**：标注介绍性 UI 注释——`/* visual-only debate layout; backend pipeline is multi-round generic synthesis, B.15 contract spec in progress */`

### 2.7 Out-of-Scope（红线，不可碰）

- ❌ 不动 `teamRegistry.ts` 14 TeamMemberId
- ❌ 不动 `i18n/dicts/*.json` 现有 `team.*.displayName` 翻译（按 Dan C1：用现有）
- ❌ 不动 `staticContent.ts` 11 `DispatchV10AgentRoleId`（按 Dan A1：就写 11，不动文字）
- ❌ 不动设计 token (`--bg` / `--card` / radius / 字体)（按 Dan B4：用现有）
- ❌ 不动 Hero meta cell 数字（`"11 roles · 6 stages"` 已 i18n）
- ❌ 不动 CTA "送入交易"按钮行为 / 文案（按 Dan C2：用现有 hotfix-5 strict gate）
- ❌ 不动 watch-only mode strict gate（hotfix-5 红线）
- ❌ 不动 backend stageTrace 5 stage → 6 stage（按 Dan A3：UI 和实际功能分开）
- ❌ 不动 multi-round pipeline（B.15 contract spec 范围）
- ❌ 不动 PM 3 状态切换 logic（视情况后续 phase，本期 PM 用 default approve SVG）
- ❌ 不上 prod（Constitution Rule 2 v0.1.2，待 Dan 显式授权）

---

## § 3 Edge Cases（4 轴枚举）

### 3.1 输入轴

- 14 SVG 内的 `<g>` / `<animate>` SMIL 标签在 Next 14 dangerouslyAllowSVG 已 true（C-Series Security Stage 6 T201 SVG inventory 待 Dan 拍）→ 不破现有 SVG-as-image 路径
- core robot 装饰 SVG 直接 inline 写 React component（避免 dangerouslyAllowSVG 依赖）

### 3.2 状态轴

- watch-only mode → CTA "送入交易"按钮 hotfix-5 strict gate 仍生效（按现有）
- 6 stage card 中 memoryLoop（stage 6）数据源：现有 `pmDecisionReflection` cron 已 merge，本期视觉化即可，不增新数据源
- PM 3 状态本期不切（default approve）；后续 phase 跟进 B.15 PM verdict mapping

### 3.3 边界轴

- 移动端 < 880px：`@media` 已有 fallback，新动画必须 `prefers-reduced-motion: reduce` 兜底
- 11 anode + 14 SVG inline 总体积估算：单 SVG ~3KB × 14 = 42KB（gzip ~12KB）+ 6 stage card 复用 = 同样资源；core robot inline ~2KB。总增量 ~14KB gzip，可接受
- IntersectionObserver 出视口暂停 sceneSpin 42s / sceneBreath 18s（参考之前 v1.2 `cwc-engineering-standards` 性能要求）

### 3.4 失败轴

- SVG 渲染失败 → fallback `.anode` 当前 CSS 头像（保留 v10 现有实现作为 fallback layer）
- core robot 动画在 reduced-motion 下静止显示（不破 a11y）
- 14 SVG 中某个文件加载错 → 单独 anode fallback CSS（不影响其他 10 个）

---

## § 4 Assumptions

1. **14 SVG design source 内容稳定**：本期不再迭代视觉造型（Dan 已拍 D 新的），如需调整另起 spec
2. **42temp-handoff zip 完整**：已 verify zip 含全部 14 SVG + 主设计 HTML + Hero 独立 CSS，不缺资源
3. **Codex 派工时可读 design-source/c-line-ui-uplift-v1/**：先 T001 入仓再 T002+ 实施
4. **B.15 contract spec 4 件事进度独立**：本期 face-off UI 是介绍性视觉，不依赖 B.15 完成
5. **C-Series Security T201 SVG inventory 进度独立**：本期沿用现有 `dangerouslyAllowSVG: true`，T201 拍板后回看 SVG 替换 plan

---

## § 5 Measurable Success Criteria

- ✅ `claw42/design-source/c-line-ui-uplift-v1/` 入仓含 14 SVG + 主设计 HTML + Hero CSS + README
- ✅ `Hero.test.tsx` assert `.anode` 数量仍 = 11（不破现有测试）
- ✅ `staticContent.ts` `DispatchV10AgentRoleId` 11 项 + `flowStages` 6 项不变（git diff 0 行）
- ✅ `teamRegistry.ts` 14 TeamMemberId + displayNameKey 0 改动
- ✅ i18n 8 dict `"11 roles · 6 stages"` + `team.*.displayName` 0 改动
- ✅ 视觉验收：staging preview 11 anode 全换新 SVG + 眨眼动画 + 6 stage card 全换 SVG 头像 + face-off Stage 2 VS 布局 + core robot 装饰 + 8 装饰元素全上
- ✅ 移动端 < 880px responsive 不破
- ✅ `prefers-reduced-motion: reduce` 下所有动画静止
- ✅ leakCount=0 / canonical ordering / waitUntil / watch-only strict gate / hotfix 1-6 + v10/v11/v11-fix 红线全维持
- ✅ T022 — 全 10 locale 文案完整：所有新增 SVG `<title>` / aria-label / hover readout / VS 文字 / 介绍性 copy 在 zh_CN / en_US / ja_JP / ko_KR / ru_RU / fr_FR / es_ES / de_DE / pt_BR / vi_VN 全翻译；grep `placeholder|TODO|coming soon|FIXME` 0 命中
- ✅ T023 — 手机端 < 880px responsive：hero anode 单列 / stage card 单列或横滑 / face-off 竖排 / 字号自适应 / 6 stage memoryLoop 不溢出；prefers-reduced-motion 下所有动画静止
- ✅ lighthouse mobile 性能 > 75（pre-existing baseline 不退化）
- ✅ Dan staging preview 浏览器人工验收通过（桌面 + 手机模拟器各跑一遍）

---

## § 6 Implementation Stages

详见 § 2 Stage 1-6 + v1.0 新增 Stage 7-8。每 stage 独立 commit / 总体 1 个 PR + Codex first-hand 实测 + Dan staging 验收。

依赖序：T001 (Stage 1 design source 入仓收尾 + .gitignore) → T002-T005 (Stage 2 Hero 11 anode) → T006-T009 (Stage 3 6 stage card) → T010-T011 (Stage 4 core robot) → T012-T019 (Stage 5 装饰) → T020-T021 (Stage 6 face-off) → **T022 (Stage 7 i18n 10 locale 文案补)** → **T023 (Stage 8 手机端基础响应式 fallback)**。

**24h 上线节奏（外部时间节点 2026-05-25 00:08）**：Codex 一波拉完 T001-T023 / staging preview deploy / F 字符级 verify + grep gate / Dan staging 一次性验收（桌面 + 手机模拟器）/ 验收通过 → Codex merge to main + prod release runbook → claw42.ai 上 v1.0 UI。

---

## § 7 Detailed Design

### 7.1 14 SVG → 12 visible + 2 hidden mapping

| TeamMemberId (schema)   | 14 SVG                                           | UI 露出位置                                  |
| ----------------------- | ------------------------------------------------ | -------------------------------------------- |
| `fundamental_analyst`   | `fundamental_analyst.svg`                        | hero `fundamental` + stage 1 card            |
| `news_analyst`          | `news_analyst.svg`                               | hero `news` + stage 1 card                   |
| `chart_analyst`         | `chart_analyst.svg`                              | hero `technical` + stage 1 card              |
| `onchain_analyst`       | `onchain_analyst.svg`                            | hero `onchain` + stage 1 card                |
| `research_lead`         | `research_lead.svg`                              | **不进 UI**（synthesis 中间层）              |
| `risk_lead`             | `risk_lead.svg`                                  | **不进 UI**（synthesis 中间层）              |
| `pm`                    | `pm-approve.svg` (default) + caution + reject 备 | hero `portfolioManager` + stage 5 card       |
| `bullish_researcher`    | `bullish_researcher.svg`                         | hero `bullish` + stage 2 card                |
| `bearish_researcher`    | `bearish_researcher.svg`                         | hero `bearish` + stage 2 card                |
| `trader`                | `trader.svg`                                     | hero `trader` + stage 3 card                 |
| `aggressive_reviewer`   | `aggressive_reviewer.svg`                        | hero `aggressive` + stage 4 card             |
| `neutral_reviewer`      | `neutral_reviewer.svg`                           | hero `neutral` + stage 4 card                |
| `conservative_reviewer` | `conservative_reviewer.svg`                      | hero `conservative` + stage 4 card           |
| `memory_loop`           | `memory_loop.svg`                                | **不进 hero**（11 anode 不含）+ stage 6 card |

- **schema 14 不变**：完全保留 `teamRegistry.ts` 14 项
- **UI 露 12**：11 hero anode + 1 stage-only memoryLoop
- **UI 隐 2**：research_lead / risk_lead 仍参与 backend synthesis，UI 不显示

### 7.2 core robot 装饰

- 不绑 TeamMemberId / 不进 staticContent / 不进 i18n displayName
- inline React component，仅在 `Constellation.tsx` 内部 render
- 装饰意义：team lead 抽象 / 品牌吉祥物 / 视觉中心
- 后续如 Dan 拍 team lead schema 角色，独立 spec

### 7.3 face-off 布局

```css
.fstage4.faceoff .fagents-2 {
  grid-template-columns: 1fr 96px 1fr;
}
.fstage4.faceoff .vs {
  /* VS 文字 + 双向渐变线，见 how-it-works.html ~720-740 行 */
}
```

注释明示：`/* visual-only debate layout; backend pipeline is multi-round generic synthesis */`

---

## § 8 Variables / Constants

无新增 const。所有视觉 token 沿用现有 `:root` 变量（按 Dan B4 不动 token）。

---

## § 9 Files Touched

### 9.1 新建

- `claw42/design-source/c-line-ui-uplift-v1/` (Stage 1)
  - `how-it-works.html`
  - `avatars/*.svg` (14 files)
  - `_hero_html.html` + `_hero_css.css` + `_combined_styles.css`
  - `canonical-base.html` + `README.md`

### 9.2 修改

- `src/modules/agent-watch/v10/AgentNode.tsx` — 替换 CSS 头像 → SVG
- `src/modules/agent-watch/v10/Constellation.tsx` — 加 core robot 装饰节点 + scene 动画
- `src/modules/agent-watch/v10/staticContent.ts` — anode style 可能微调 + 0 改 ID
- `src/modules/agent-watch/v10/DispatchConsoleV10.module.css` — 加 .fstage4 hover / .stage-connector / 大数字 watermark / .anode reticle + readout + scanline / .speech-dot / .core CSS
- `src/modules/agent-watch/v9/dispatchConsoleV9.module.css` — face-off layout 补 + .fagent-avatar 改 SVG

### 9.3 不动

- `src/lib/team/teamRegistry.ts`（14 ID + displayNameKey 全保留）
- `src/i18n/dicts/*.json`（10 dict 0 改动）
- `src/lib/team/topicSelector.ts`（9 维度 type 不动；social hotfix-7 是另独立 spec）
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx` watch-only strict gate
- 所有 cron / KV / API route / Edge runtime 代码

---

## § 10 Migration / Compatibility

- 14 SVG 加入 → fallback layer 保留现有 CSS 头像 1 周（staging soak）后移除
- core robot 装饰新增 → 不影响现有 11 anode 测试
- face-off 布局 = `.fstage4.faceoff` className 新增（可选附加），不破 stage 2 现有渲染

---

## § 11 Tasks 索引

| Task | Stage               | Priority | Story                                                                                                                                                                                                                                                      |
| ---- | ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T001 | 1 Design source     | P0       | 42temp-handoff zip 入仓 `design-source/c-line-ui-uplift-v1/`                                                                                                                                                                                               |
| T002 | 2 Hero anode        | P0       | `AgentNode.tsx` 用 SVG 替换 CSS 头像                                                                                                                                                                                                                       |
| T003 | 2 Hero anode        | P0       | 14 SVG → 11 hero anode mapping 落地                                                                                                                                                                                                                        |
| T004 | 2 Hero anode        | P0       | 眨眼 4.6s + float 5.4s + ringExpand 4s 错相动画                                                                                                                                                                                                            |
| T005 | 2 Hero anode        | P0       | news radar ping SMIL + aggressive bolt flicker 差异化                                                                                                                                                                                                      |
| T006 | 3 Stage card        | P0       | 6 fstage4 用 14 SVG 替换头像                                                                                                                                                                                                                               |
| T007 | 3 Stage card        | P0       | stage 6 memoryLoop SVG ⟲                                                                                                                                                                                                                                   |
| T008 | 3 Stage card        | P0       | fstage4 hover 动画整套                                                                                                                                                                                                                                     |
| T009 | 3 Stage card        | P0       | fagent-avatar 卡片小机器人 SVG（替代字母 + CSS pseudo）                                                                                                                                                                                                    |
| T010 | 4 Core robot        | P0       | core robot 装饰节点（不绑 schema）                                                                                                                                                                                                                         |
| T011 | 4 Core robot        | P0       | core robot 动画（antenna pulse / eyeBlink / ring × 3 / podium glow / sceneBreath 18s）                                                                                                                                                                     |
| T012 | 5 装饰              | P0       | .stage-connector 卡片间 SVG + dashFlow                                                                                                                                                                                                                     |
| T013 | 5 装饰              | P0       | .fstage4-side::after 大数字 watermark                                                                                                                                                                                                                      |
| T014 | 5 装饰              | P0       | anode reticle 4 角 bracket hover                                                                                                                                                                                                                           |
| T015 | 5 装饰              | P0       | anode readout callout 1.7s delay                                                                                                                                                                                                                           |
| T016 | 5 装饰              | P0       | .screen scanline drift                                                                                                                                                                                                                                     |
| T017 | 5 装饰              | P0       | news radar ping（已在 T005）                                                                                                                                                                                                                               |
| T018 | 5 装饰              | P0       | aggressive bolt flicker（已在 T005）                                                                                                                                                                                                                       |
| T019 | 5 装饰              | P0       | speech-dot "is talking" 3 点                                                                                                                                                                                                                               |
| T020 | 6 face-off          | P0       | .fstage4.faceoff 布局                                                                                                                                                                                                                                      |
| T021 | 6 face-off          | P0       | 介绍性 UI 注释 + B.15 link                                                                                                                                                                                                                                 |
| T022 | 7 i18n              | P0       | 全 10 locale 文案补：所有新增 SVG `<title>` / aria-label / hover readout / VS 文字 / 介绍性 copy 全 10 dict（zh_CN / en_US / ja_JP / ko_KR / ru_RU / fr_FR / es_ES / de_DE / pt_BR / vi_VN）翻译完整。不出现「placeholder」/「TODO」/「coming soon」式字符 |
| T023 | 8 Mobile responsive | P0       | 手机端 < 880px 基础响应式 fallback：hero anode grid 单列堆叠 / 6 stage card 横滑 or 单列 / face-off 改竖排 / 字号缩放 / 动画 prefers-reduced-motion 静止。不引入 mobile-only 专属交互 / 不引入 hamburger menu / 保持桌面相同信息架构                       |

P0 = 23（v1.0 新增 T022 + T023）；P1 / P2 = 0（本期纯视觉 + 装饰 + i18n + 基础响应式，不分级延后）

---

## § 12 Workload Estimate

按 AI 驱动范式 v1.0 双时钟纪律——不承诺分钟数。

- 时钟 A（AI 连续推进）：6 stage 顺序，每 stage 1-3 个 PR
- 时钟 B（真实世界）：依赖 Codex 派工窗口 + Dan staging 验收节奏 + main 其他 hotfix 不冲突

---

## § 13 Cannot-Do（红线，不可碰）

1. **不动 backend / schema / pipeline / 14 TeamMemberId / i18n 现有 displayName**（核心元规则：UI 和实际功能分开）
2. **不动 hotfix 1-6 红线**：leakCount=0 / canonical ordering / waitUntil / watch-only strict gate / TeamMemberId 不进 public payload
3. **不动 Constitution Rule 2 v0.1.2**：不擅自上 prod，必须 Dan 显式授权
4. **不动设计 token**（按 Dan B4）
5. **不动 CTA "送入交易"按钮行为 / 文案**（按 Dan C2，仍按 hotfix-5 strict gate）
6. **不动 Hero meta cell 数字 / 标题**（按 Dan A1：就写 11，不动文字）
7. **不擅自把"介绍性 face-off UI"包装成"真 bull-vs-bear cross-examination"**（B.15 contract spec 才管真能力）
8. **不擅自把 core robot 升 schema 角色**（按 Dan A2：装饰）
9. **不擅自把 research_lead / risk_lead 从 teamRegistry 删除**（synthesis 中间层保留 backend）
10. **不擅自把 50+ screenshots 推进 git**（zip 备份在 design-source README 注明外部路径即可）
11. **不上 prod 验证**（必须 staging 验收，Dan 显式授权才 prod）
12. **不擅自把"UI 和实际功能分开"元规则升 Constitution Rule**（Dan 后续 amend 才能动）

---

## § 14 Constitution Check

对照 `claw42/docs/project-constitution.md` v0.1.1 7 条 rule：

| Rule                      | Check                                                                     | 答                                                                             |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rule 1 部署身份           | 本 spec 触发 push / PR / vercel deploy？                                  | **N/A**（DRAFT 不派工）→ 派工时 Codex 必须 gh / vercel whoami                  |
| Rule 2 生产保护           | 触发 prod 改动？                                                          | **PASS**（不上 prod；staging only；Dan 显式授权 prod 才动）                    |
| Rule 3 视觉与品牌权威     | `Claw 42` / `claw42` 不得混 / 既有 v9 / task 指定视觉权威                 | **PASS**（不动品牌名 / 不动 v9 task；造型替换属"既有视觉权威升级" Dan 已拍板） |
| Rule 4 数据与 schema 纪律 | NewsItem schema / SourceRegistry / 复盘 cron / Win-rate / Agent IP 不可动 | **PASS**（全部不碰）                                                           |
| Rule 5+ (未读完)          | 派工 Codex first-hand 补                                                  | **TBD**（v1.0 升级时填）                                                       |

---

## § 15 Risk Register

| 风险                                                    | 概率 | 影响 | 缓解                                                                                                                              |
| ------------------------------------------------------- | ---- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| SVG 渲染兼容性（旧 Safari / 移动浏览器）                | LOW  | LOW  | fallback CSS 头像保留 1 周 soak                                                                                                   |
| 14 SVG inline 影响初屏性能                              | LOW  | MED  | gzip ~14KB 增量；IntersectionObserver 出视口暂停动画                                                                              |
| Codex 误改 schema / i18n（"UI 和实际功能分开"边界飘移） | MED  | HIGH | 派工 spec § 13 红线 + 验收 grep gate（`teamRegistry.ts` diff 必须 0 行；`i18n/dicts/*.json` diff 不含 `team.*.displayName` 改动） |
| Claude Design 设计源后续迭代 → 本期入仓造型过时         | MED  | LOW  | design source 加版本号 v1；后续迭代起 v2 spec                                                                                     |
| Dan 视觉验收挑细节回炉                                  | HIGH | LOW  | 6 stage 独立 PR + 每 stage 单独 staging 验收，问题局部                                                                            |
| 误把"介绍性 face-off"承诺成真辩论                       | MED  | HIGH | § 13 红线 7 + face-off CSS 注释明示 + B.15 contract spec link                                                                     |

---

## § 16 老板简报

claw42 团队介绍页（用户进站第一个看到的位置）准备换一套统一的机器人视觉——14 个角色机器人头加眨眼动画，6 个流程卡片加 hover 动效，决策展示更生动。这次只换造型不改功能，团队 backend 和数据全部不动。完成后效果：用户打开主页看到 11 个机器人围着中央吉祥物呼吸悬浮，鼠标滑过有眼神聚焦反应，往下看 6 阶段流程卡片每张有不同的小动效；正在分析的角色头顶会冒"正在思考"的 3 点动画。本期不上线，先沉淀文档准备好，等其他几个安全卫生升级完成后再决定时机。

---

## § 17 Anti-Rationalization

| 逃逸路径                                                                             | 为什么不行                                                  | 正确做法                                                                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| "造型升级顺手把 displayName 也改新名"                                                | Dan C1 拍"用现有 i18n 不变"                                 | `i18n/dicts/*.json` `team.*.displayName` 段 grep diff = 0 行                              |
| "11 vs 14 不一致看起来怪，顺手把 teamRegistry 砍到 11"                               | Dan A1 拍"就写 11，不动文字"= schema 14 保留 UI 露 11       | `teamRegistry.ts` diff = 0 行                                                             |
| "core robot 这么显眼不进 schema 太可惜"                                              | Dan A2 拍"装饰"                                             | 不绑 TeamMemberId / 不绑 PM / 仅 inline 装饰 SVG                                          |
| "face-off 上了，顺手把 multi-round pipeline 也改成真 bull-vs-bear cross-examination" | Dan A3 + C3 拍"UI 和实际功能分开"                           | face-off 是 CSS layout，B.15 contract spec 才管真能力                                     |
| "CTA 这么丑顺手改成 lime 大按钮"送入交易""                                           | Dan C2 拍"用现有"+ hotfix-5 strict gate                     | CTA 行为 / 文案不动                                                                       |
| "design token 太老土顺手切 #000 + Manrope"                                           | Dan B4 拍"不动用现有"                                       | token 0 改动                                                                              |
| "screenshots 50 张装 git 反正小"                                                     | § 13 红线 10                                                | 备份外部路径 README 注明                                                                  |
| "本期 PR 多顺手再起 B.15 spec 升级版"                                                | 本 spec 仅造型替换；B.15 contract spec 独立                 | 不混 spec 范围                                                                            |
| "Codex 自评 SVG 加载够快，跳过性能 soak"                                             | Codex 自评 70% 不准（历史教训）                             | staging 实测 FPS + battery + bundle size diff                                             |
| **"UI 和实际功能分开" = 想偷工随便给 UI 上虚假承诺**                                 | 元规则的本意是 backend 不破 / UI 介绍性，不是 UI 可以骗用户 | face-off / Stage 6 memoryLoop 等"展示性"位置必须有真实 backend 数据 fallback，不能纯 mock |

---

## § 18 Open Questions（v1.0 全 close）

| #   | v0.1 问                                                                                        | v1.0 Dan apply 结论                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 派工时机：等 C-Series Security / Blind-Spot / Prod-Release / B.15 收敛后？还是 parallel 推进？ | **CLOSED 2026-05-24**：Dan「现在做的是原 prod+A+B 的合并，这个验收和 merge 后，就只剩一条主线，然后在这个主线上做 UI 迭代」→ v11-fix 已合 prod / main 单一主线 / 立即派 |
| 2   | PR 拆分粒度：6 stage 6 个独立 PR / 还是合 3 PR                                                 | **CLOSED 2026-05-24**：24h 截止 → 一波 1 个 PR T001-T023 / 不拆                                                                                                         |
| 3   | PM 3 状态切换：本期默认 approve / 后续是否绑 B.15 PM verdict mapping                           | **CLOSED 2026-05-24**：Dan catch 后纠正「这次纯 UI 真 / backend 不动 / face-off + PM 切换 + memoryLoop = UI 完成后下一阶段」→ 本期 PM 仅 default approve / 不绑 B.15    |
| 4   | C-Series Security T201 dangerouslyAllowSVG 决策：是否本 spec 跟进 / 还是 T201 单独 phase       | **CLOSED 2026-05-24**：沿用现有 `dangerouslyAllowSVG: true` / T201 仍独立 phase / 本期不动                                                                              |
| 5   | Codex 派工指令模板：固定 inbox 路径还是 chat 派？                                              | **CLOSED 2026-05-24**：实践已确立 = sync 文件 + SYNC-WAKE v4 wire-safe / 已用了 11+ 次 / 稳定                                                                           |

---

## § 19 Decision-Log Reference

本 spec 关联 `web-dev/decision-log.md` 同日 entry "2026-05-20 — C 线 UI Uplift v1 决策沉淀"（含 Dan 11 项拍板 + 元规则 + main 现状 verify）。

后续 v1.0 升级（真派工前）必须回看：

- decision-log 是否有 Dan 后续 amend
- C-Series 4 spec 是否进入 implementation
- B.15 contract spec 是否 APPROVED
- hotfix-7 social fake data 是否完成

---

## 附录 A · 42temp-handoff 资源清单

来源：Dan 2026-05-20 上传 `42temp-handoff (1).zip`，解压在 `/tmp/42temp-handoff-extract/42temp/`（session 临时路径，下次 session 可能丢失，必须 T001 入仓）。

清单：

- `project/how-it-works.html` 主设计 1649 行
- `project/how-it-works v1-v13 (*).html` 12 个探索版本
- `project/robot-designs.html` 机器人设计探索
- `project/claw42/design-source/c-line-ui-uplift-v1/` 子目录：
  - `README.md` 完整 14 SVG + persona dimension mapping
  - `canonical-base.html` 头部几何锁定
  - `14-symbol-eyes.html` 14 + 3 PM 状态预览（HTML animated）
  - `avatars-gallery.html` SVG export gallery
  - `avatars/*.svg` 16 个独立 SVG（14 角色 + 2 PM 备用状态 + 1 bot-base）
  - `_hero_html.html` + `_hero_css.css` + `_combined_styles.css`
  - `02-css-vs-svg-decision.html` / `03-hero-details.html` / `04-6step-timing.html` / `04-step-anims/` 设计 spec 子文档
  - `_articles.json` + `_combined_articles.html` 设计 narrative
- `project/screenshots/` 50+ PNG（**不进 git**，README 注明外部备份路径）
- `project/uploads/` 用户上传素材

---

_v0.1 (2026-05-20 草稿落档，沉淀决策 + main 现状 + 14 SVG mapping。Dan 拍真派工时机后升级 v1.0。)_

_v1.0-FINAL Dan APPROVED (2026-05-24 升级)：v11-fix prod release 已合 main → 单一主线；Dan @ 2026-05-24 chat 4 答 + Constitution Rule 4 例外承接 + 一天后上线 directive；42temp-handoff zip 重新入仓 verify 17 SVG + 主 HTML 齐；T022 i18n 10 locale + T023 mobile basic responsive 新增；Open Questions 全 close；派 Codex 一波实施 T001-T023 → staging → Dan 一次性验收 → merge prod。decision-log 关联 entry 2026-05-24 v11-fix prod release 完工 + UI v1.0 派工启动。_
