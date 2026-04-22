# Spec D — HeroScene CoinsLayer（4 币自由漂浮 + hover 交互）

## 目标

一句话：实现 `src/modules/landing/HeroScene/CoinsLayer.tsx`，渲染 4 个币种图（BTC / ETH / SOL / USDT），每个币在锚点附近做椭圆自由漂浮，鼠标移动时叠加视差位移；hover 时币放大 1.3x + 旋转 360° + 显示一个 symbol 小气泡；不做点击跳转。本组件替换 Airy 在 task-04 里写的同路径 stub。

## 变更范围

### 修改
- `src/modules/landing/CoinsLayer.tsx` ← **不在这里**，正确路径是 `src/modules/landing/HeroScene/CoinsLayer.tsx`（这个路径是由 task-04 先建立的，你替换整个文件内容即可）

### 新建
- 无

### 删除
- 无

### 不动（明确禁止碰）
- `src/modules/landing/HeroScene/` 下除 `CoinsLayer.tsx` 以外的所有文件（`HeroScene.tsx` / `RobotLayer.tsx` / `PedestalLayer.tsx` / `SpeechBubble.tsx` / `useMouseNormalized.ts` / `useRobotPose.ts` / `index.tsx`）
- `src/app/[locale]/page.tsx`
- `src/i18n/*`（不新增字段）
- `src/lib/*`
- `package.json` / `package-lock.json`（不新增依赖）
- `public/images/*`（资源已存在，只引用不修改）
- Tailwind 配置 / `globals.css`
- 任何其他 `src/modules/` 下的文件

## 技术上下文

### 技术栈（硬约束）
- Next.js **14.2.35**（App Router）
- React **18**
- TypeScript **5.x**
- Tailwind CSS **3.4.1**
- framer-motion **^11.x**（已在依赖里）

### 禁用清单
- ❌ Tailwind v4 语法（`@theme` / `@utility` / 内联 theme config）
- ❌ React 19 only 特性（async client component / `use()` hook）
- ❌ 新增任何依赖
- ❌ 从项目内其他文件 import 类型或常量——本组件**完全自包含**（除 `react` / `framer-motion` 两个模块外不 import 任何东西）
- ❌ 使用 `localStorage` / `sessionStorage` / `window.*`（除 matchMedia，但本文件甚至不需要 matchMedia）
- ❌ 使用 `next/image`——用原生 `<img>` 即可（coin 图是绝对定位的装饰资源，`next/image` 在嵌套 absolute + transform 场景下不优雅）
- ❌ 点击跳转、`onClick` 导航、`<a href=...>` 包裹币图
- ❌ 改动 Props 接口（`{ mouseX: number; mouseY: number; reduceMotion: boolean }`，Airy 的 stub 就是这个接口，HeroScene 按这个传参）

### 已知可用资源（文件系统保证存在）
- `public/images/hero/coin-btc.png`（~130×130，透明底 PNG）
- `public/images/hero/coin-eth.png`
- `public/images/hero/coin-sol.png`
- `public/images/hero/coin-usdt.png`

### 父组件契约（你只需知道这些）
父组件 `HeroScene.tsx` 会这样调用你：
```tsx
<CoinsLayer mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />
```
- `mouseX` / `mouseY`：归一化到 [-1, 1]，中心是 (0, 0)；鼠标离开舞台时会平滑 lerp 回 0
- `reduceMotion`：`boolean`，true 时表示用户开启了系统 reduce-motion
- 本组件是舞台内 `absolute inset-0` 层，父容器已是 `position: relative`

### 导出约定（必须）
```tsx
export function CoinsLayer(props: CoinsLayerProps) { ... }
```
**命名导出**，不是 default。导出名必须是 `CoinsLayer`。

## 设计规格

### 币种锚点和视觉参数

四个币围绕机器人（舞台水平中心）散开分布。用百分比绝对定位（相对父容器，父容器是 21/9 舞台）。

| 币 | 桌面锚点 | 桌面直径 | 视差深度 | 漂浮半径 X / Y | 漂浮周期 | 相位偏移 |
|---|---|---|---|---|---|---|
| BTC | `top: 20%, left: 18%` | `76px` | 0.80 | 38 / 22 | 7.2s | 0s |
| ETH | `top: 15%, right: 19%` | `72px` | 0.70 | 42 / 26 | 8.3s | 1.8s |
| SOL | `top: 55%, left: 12%` | `64px` | 0.90 | 34 / 20 | 6.8s | 3.1s |
| USDT | `top: 48%, right: 13%` | `68px` | 0.75 | 36 / 24 | 9.1s | 0.6s |

移动端（`< md` 即 `< 768px`）：
- 币直径缩到 `44-52px`
- 锚点同上（百分比定位在 4/5 竖版下一样成立）
- 漂浮半径减半（18-22 / 10-13），周期不变

实现：用 Tailwind responsive class 切尺寸即可，例如 BTC 用 `w-[44px] md:w-[76px]`。

### 漂浮动画（椭圆轨道）

每个币有独立 motion.div 做 infinite loop 的椭圆漂浮：
```ts
// 概念（不是最终代码，下方"参考实现"里有完整版本）
animate={{
  x: [0, radiusX, 0, -radiusX, 0],
  y: [0, -radiusY, 0, radiusY, 0],
}}
transition={{
  duration: period,
  delay: phaseOffset,
  repeat: Infinity,
  ease: "easeInOut",
}}
```

每个币的 `radiusX` / `radiusY` / `period` / `phaseOffset` 用上表数值，保证 4 个币不同步。

### 视差叠加

漂浮的 motion.div 外面再套一层 wrapper div，通过 inline style 做视差位移：
```ts
style={{
  transform: `translate(${mouseX * depth * 24}px, ${mouseY * depth * 14}px)`,
  transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
}}
```
`depth` 从上表取。24px / 14px 是最大位移系数，乘上 mouseX/Y（已归一化 [-1, 1]）再乘 depth 得到实际偏移。transition 让视差跟随有柔和的滞后感。

两层嵌套结构：
```
外层（视差 wrapper，inline style transform）
  └─ motion.div（椭圆漂浮 animate）
       └─ div.group（hover 触发 group-hover，relative，rounded-full）
            ├─ img（币图本体）
            ├─ motion.div（hover 放大 + 旋转的实现方式：整个 group 用 whileHover 更简单，见下）
            └─ tooltip（absolute 定位在币上方，group-hover:opacity-100）
```

**简化实现**：外层 wrapper 做视差，内层 motion.div 承担「椭圆漂浮 + hover 的 scale/rotate」两件事。用 framer-motion 的 `animate`（持续动画）+ `whileHover`（悬停覆盖）会互相冲突——`whileHover` 会暂停 `animate`。解决方案：漂浮放在 wrapper（外层 motion.div），hover 交互放在内层 motion.div。见「参考实现」。

### Hover 交互

鼠标移到币上时：
- 内层 motion.div：`scale: 1.3`，`rotateZ: 360`（一圈），`zIndex: 10`（让放大的币盖过其他币）
- 过渡：`scale` 280ms ease-out，`rotate` 800ms ease-out（让旋转慢于放大，视觉上先变大再转）
- tooltip：symbol 文字（`BTC` / `ETH` / `SOL` / `USDT`，就是大写三字母），渐入 120ms，位置在币正上方 `-40px`，小气泡样式

Tooltip 样式（Tailwind）：
```
absolute left-1/2 -translate-x-1/2 -top-10 px-3 py-1
rounded-full bg-black/80 text-white text-xs font-semibold tracking-wide
pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150
whitespace-nowrap
```

### reduce-motion 行为

当 `reduceMotion === true`：
- 不做椭圆漂浮（币固定在锚点）
- 视差 transform 仍保留（鼠标视差不属于动画，是响应式定位，保留无害；但如果实现简单就也关掉，二选一，关掉更保险）——**约定：reduce-motion 时视差也关，transform 直接设 `translate(0, 0)`**
- hover 仍生效但取消旋转（`rotate` 设 0），`scale` 改为 1.15（温和放大）
- tooltip 仍显示

### 键盘/无障碍

- 每个币用 `aria-label`，值为币种名（e.g. `aria-label="Bitcoin"`）
- 币本体是 `<img alt="" aria-label="...">`，父级 `div` 用 `role="img"` 更语义但也可省略（img 本身已有语义）
- 不需要 `tabIndex`（装饰层，不在交互流）

## 参考实现（完整可运行版）

下面这段代码是你应当产出的样子。可以调整命名、注释、细节，但**结构、导出名、Props、4 个币的配置必须和这个保持一致**。

```tsx
"use client";

import { motion } from "framer-motion";

interface CoinsLayerProps {
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

interface CoinConfig {
  symbol: "BTC" | "ETH" | "SOL" | "USDT";
  label: string;
  src: string;
  anchor: {
    top: string;
    left?: string;
    right?: string;
  };
  sizeClass: string; // tailwind w-[..] md:w-[..]
  depth: number;
  radiusX: number;
  radiusY: number;
  period: number;
  phaseOffset: number;
}

const COINS: CoinConfig[] = [
  {
    symbol: "BTC",
    label: "Bitcoin",
    src: "/images/hero/coin-btc.png",
    anchor: { top: "20%", left: "18%" },
    sizeClass: "w-[44px] md:w-[76px]",
    depth: 0.8,
    radiusX: 38,
    radiusY: 22,
    period: 7.2,
    phaseOffset: 0,
  },
  {
    symbol: "ETH",
    label: "Ethereum",
    src: "/images/hero/coin-eth.png",
    anchor: { top: "15%", right: "19%" },
    sizeClass: "w-[42px] md:w-[72px]",
    depth: 0.7,
    radiusX: 42,
    radiusY: 26,
    period: 8.3,
    phaseOffset: 1.8,
  },
  {
    symbol: "SOL",
    label: "Solana",
    src: "/images/hero/coin-sol.png",
    anchor: { top: "55%", left: "12%" },
    sizeClass: "w-[40px] md:w-[64px]",
    depth: 0.9,
    radiusX: 34,
    radiusY: 20,
    period: 6.8,
    phaseOffset: 3.1,
  },
  {
    symbol: "USDT",
    label: "Tether",
    src: "/images/hero/coin-usdt.png",
    anchor: { top: "48%", right: "13%" },
    sizeClass: "w-[42px] md:w-[68px]",
    depth: 0.75,
    radiusX: 36,
    radiusY: 24,
    period: 9.1,
    phaseOffset: 0.6,
  },
];

export function CoinsLayer({ mouseX, mouseY, reduceMotion }: CoinsLayerProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {COINS.map((coin) => {
        const parallaxX = reduceMotion ? 0 : mouseX * coin.depth * 24;
        const parallaxY = reduceMotion ? 0 : mouseY * coin.depth * 14;

        return (
          <div
            key={coin.symbol}
            className="absolute"
            style={{
              top: coin.anchor.top,
              left: coin.anchor.left,
              right: coin.anchor.right,
              transform: `translate(${parallaxX}px, ${parallaxY}px)`,
              transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <motion.div
              animate={
                reduceMotion
                  ? { x: 0, y: 0 }
                  : {
                      x: [0, coin.radiusX, 0, -coin.radiusX, 0],
                      y: [0, -coin.radiusY, 0, coin.radiusY, 0],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: coin.period,
                      delay: coin.phaseOffset,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            >
              <motion.div
                className="group relative cursor-pointer pointer-events-auto"
                whileHover={
                  reduceMotion
                    ? { scale: 1.15 }
                    : { scale: 1.3, rotate: 360, zIndex: 10 }
                }
                transition={{
                  scale: { duration: 0.28, ease: "easeOut" },
                  rotate: { duration: 0.8, ease: "easeOut" },
                }}
              >
                <img
                  src={coin.src}
                  alt=""
                  aria-label={coin.label}
                  className={`${coin.sizeClass} drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] select-none`}
                  draggable={false}
                />
                <span
                  className="absolute left-1/2 -translate-x-1/2 -top-10 px-3 py-1 rounded-full bg-black/80 text-white text-xs font-semibold tracking-wide pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap"
                  aria-hidden="true"
                >
                  {coin.symbol}
                </span>
              </motion.div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
```

**关键实现说明**：

1. 为什么 `pointer-events-none` 在父 div 但 `pointer-events-auto` 在 hover 的 motion.div 上：父层不拦截鼠标事件（让鼠标能穿透到舞台监听视差）；币本身要接收 hover，所以单独打开。
2. 为什么 `whileHover` 的 `zIndex: 10`：放大到 1.3x 的币可能和邻居重叠，提到顶层避免被剪。
3. 为什么 `scale` 和 `rotate` 分开 duration：视觉上先快速放大再慢慢转一圈，比同步更有节奏感。
4. 为什么漂浮和 hover 分两层 motion.div：framer-motion 里 `animate`（持续动画）和 `whileHover`（临时状态）在同一个 motion 组件上会相互打架，`whileHover` 触发时 `animate` 会 pause。拆两层各管一件事，互不干扰。
5. 为什么 `reduceMotion` 时 transition `duration: 0`：彻底跳过漂浮动画，不是让它变慢。

## 验收标准

编译/类型：
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误
- [ ] 只有一个文件被修改（`src/modules/landing/HeroScene/CoinsLayer.tsx`）

视觉/交互（桌面）：
- [ ] 开发模式打开 `/en_US`，看到 4 个币在舞台上分布：左上 BTC、右上 ETH、左中 SOL、右中 USDT
- [ ] 4 个币各自做椭圆漂浮，彼此不同步（因周期和相位不同）
- [ ] 鼠标移动 → 4 个币按各自 depth 做轻微视差位移（越远越慢）
- [ ] 鼠标悬停任一币 → 该币放大 1.3x + 旋转 360° + 上方出现黑色小气泡显示 symbol
- [ ] 鼠标离开 → 币回到正常大小和位置，气泡消失，漂浮继续
- [ ] 点击币 → 无反应（无跳转、无控制台报错）

视觉/交互（移动端 / < 768px）：
- [ ] 舞台变 4/5 竖版（task-04 已处理）
- [ ] 4 个币尺寸变小（40-44px 级别）
- [ ] 仍做椭圆漂浮（移动端不关）
- [ ] 视差基本看不到（因为移动端鼠标 mouseX/Y 恒为 0，这个是 task-04 的职责，本 spec 不处理）

reduce-motion：
- [ ] 打开系统 prefers-reduced-motion，4 个币静止在锚点不漂浮
- [ ] hover 仍生效，但只放大（scale 1.15），不旋转
- [ ] tooltip 仍显示

可访问性：
- [ ] 每个币 `<img>` 带 `aria-label` 为币种全名
- [ ] tooltip 带 `aria-hidden="true"`（视觉装饰，屏幕阅读器从 aria-label 读币种已足够）

边界：
- [ ] 文件内除 `"react"` 和 `"framer-motion"` 外不 import 任何模块（不要从 `@/lib/*` 或 `@/i18n/*` 引任何东西）
- [ ] 没有用 `next/image`
- [ ] 没有 `onClick` / 跳转链接
- [ ] `package.json` 不动

## 约束

- 导出名必须是 `CoinsLayer`（命名导出，不是 default）
- Props 接口字段名必须是 `mouseX` / `mouseY` / `reduceMotion`（不要改名）
- 4 个币的 symbol 和 src 路径必须和本 spec 一致
- 不要把币的锚点、尺寸、depth、周期等配置提到外部文件——全部内联在本文件的 `COINS` 常量里
- 不要添加滚动视差、IntersectionObserver、requestAnimationFrame 手动循环——用 framer-motion 的 `animate + repeat: Infinity` 就够了
- 不要加载外部字体、外部 CSS
- 不要 console.log 任何东西

## 为什么这样设计

（给 Codex 参考，不需要在代码里体现）

- **4 个币**：CoinW 主推交易对，BTC/ETH 是主流、SOL 是 alt 代表、USDT 是稳定币锚。让 Hero 传达"覆盖所有主流资产"
- **椭圆漂浮**：不是简单上下浮，让币有"在空中飘"的感觉，呼应 Hero 的未来感氛围
- **不同步**：4 个币同周期同相位会显得像整体统一动画，破坏自由感
- **hover 旋转**：3D 转币的微隐喻（比特币的经典视觉符号），比单纯放大有记忆点
- **无点击**：Hero 的 primary CTA 在下方（t.hero.ctaPrimary），币只是视觉装饰。加点击跳转会分散转化路径
- **tooltip 显示 symbol**：用户第一次看币不一定认得图标，tooltip 帮助识别。不写全称因为空间小

---

*维护者: F（总调度）*
*创建: 2026-04-22*
*执行者: Codex（OpenAI Codex）*
*依赖: task-04 已合并（CoinsLayer 路径和父组件契约由 task-04 先建立）*
