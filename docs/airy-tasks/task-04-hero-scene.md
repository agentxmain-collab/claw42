# Task 04 — Hero 交互场景：Robot Pose State Machine + Eye Tracking + 轮播气泡

> 分支：`feature/claw42-hero-scene-04`
> 依赖：Task 02（v1.1 Polish，已合并）+ `assets/hero-scene` 分支（已合并到 main，hero 资源就位）
> 预估：1-1.5 个工作日

## 目标

一段话：把 `src/app/[locale]/page.tsx` 里的 `HeroSection`（目前是一张 `hero-robot-scene.png` 整图 + framer-motion 上下浮动 + Title/CTA 分离）拆成真正的**分层交互场景**——底座 / 机器人（三姿态状态机 + 眼睛跟随鼠标）/ 币种占位层（留给 Spec D）/ 轮播气泡 / Title+CTA 叠加，21/9 宽屏舞台。资源已在 `public/images/hero/`，你直接用。

## 变更范围

### 新建
- `src/modules/landing/HeroScene/index.tsx` — 默认导出 `HeroScene`
- `src/modules/landing/HeroScene/HeroScene.tsx` — 主容器（21/9 舞台 + z-index 分层）
- `src/modules/landing/HeroScene/RobotLayer.tsx` — 机器人姿态状态机 + 面部覆盖层
- `src/modules/landing/HeroScene/PedestalLayer.tsx` — 底座
- `src/modules/landing/HeroScene/CoinsLayer.tsx` — 4 币种自由漂浮 + hover 交互（BTC / ETH / SOL / USDT）
- `src/modules/landing/HeroScene/SpeechBubble.tsx` — 轮播气泡
- `src/modules/landing/HeroScene/useMouseNormalized.ts` — 鼠标归一化坐标 Hook（相对舞台中心，范围 [-1, 1]）
- `src/modules/landing/HeroScene/useRobotPose.ts` — 姿态状态机 Hook（center / looking-left / looking-right + 滞后）

### 修改
- `src/app/[locale]/page.tsx` — 删除当前 `HeroSection` 组件定义，改为 `import { HeroScene } from "@/modules/landing/HeroScene"`，在 `<main>` 顶部渲染 `<HeroScene />`。保留 `QuickStartSection` / `ScenariosSection` / `WhySection` / `SkillsEcoSection` / `DisclaimerSection` 不动
- `src/i18n/types.ts` — 新增 `hero.speechBubble: string[]`（14 条文案池）和 `hero.speechBubbleAriaLabel: string`（无障碍描述）
- `src/i18n/dicts/*.json` — 10 个 dict 全加上述两个字段（本 spec 给出完整翻译，直接 paste）

### 删除
- `public/images/hero-robot-scene.png` — 已被单独资源替代，整图不再使用
- `src/app/[locale]/page.tsx` 里 `HeroSection` 函数（搬到新模块后删掉函数定义+ClipboardIcon 保留因为 QuickStart 还在用）

### 不动
- `QuickStartSection` / `WhySection` / `DisclaimerSection` 及其 i18n 字段
- `src/modules/landing/ScenariosSection.tsx` / `SkillsEcoSection.tsx`
- `src/lib/motion.ts`（可以 import 用，但不要改里面 variant）
- `src/i18n/I18nProvider.tsx` / `locales.ts` / `types.ts` 已有字段（只追加不改）
- `public/images/hero/*` 除了新增不要删任何资源
- `src/app/globals.css` 里 `.hero-fade` / `.card-glow` 规则（`.hero-fade` 现在没人用了但不删，留着以防回滚）

## 技术上下文

### 技术栈基线（重申，硬约束）
- Next.js 14.2.35（App Router）
- React 18
- Tailwind CSS 3.4.1
- TypeScript 5.x
- framer-motion ^11.x（已在依赖里，本 task 不新增依赖）

### 禁用清单
- ❌ Tailwind v4 语法
- ❌ React 19 only 特性（async client component / use() hook）
- ❌ 新依赖（连图标库/动画库都别加，现有 framer-motion 够用）
- ❌ 改 i18n provider 逻辑
- ❌ 用 `next/dynamic` 做 ssr:false 懒加载（本组件直接 `"use client"` 即可）
- ❌ 把 `HeroScene` 改成 Server Component（必须 client，因为要监听鼠标）

### 资源清单（已在 `public/images/hero/`，已合并到 main）

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `robot-center.png` | 316×297 | 中间姿态（有眼睛嘴巴，但面部细节**不用这张图的**，用单独 face overlay 覆盖） |
| `robot-left.png` | 316×297 | 向左看姿态（无面部） |
| `robot-right.png` | 316×297 | 向右看姿态（无面部） |
| `robot-face.png` | 107×59 | 眼睛+嘴巴独立覆盖层（**只在 center 姿态叠加**） |
| `pedestal.png` | 456×148 | 发光底座 |
| `coin-btc.png` / `coin-eth.png` / `coin-sol.png` / `coin-usdt.png` | ~130×130 | 币种（Spec D 用，本 task 只占位） |

**重要**：`robot-center.png` 本身带原始面部，但我们要用 `robot-face.png` 独立覆盖实现眼球追踪。实现时 `RobotLayer` 的 z-index 叠加顺序：

```
robot-center.png（底层，带原始面部）
  └─ 用 CSS mask 或直接覆盖 robot-face.png（完全覆盖住原始面部区域）
```

**或者更稳妥**：让 `robot-face.png` 的定位和尺寸**完全盖住** `robot-center.png` 的原始面部。确认 face 图的位置在 robot 图里的偏移是：从 robot 顶部约 94px 开始，水平居中。即 `top: ~31.6%`，`left: 50%`，`translate(-50%, 0)`，size `107×59`（和原图 1:1）。切到 left/right 姿态时 face overlay 隐藏（left/right 图本身没面部）。

## 舞台布局（21/9，z-index 分层）

### 容器
- `<section>` 顶级，`aspect-[21/9]`，`relative`，`overflow-hidden`
- 桌面：宽度 100vw，高度自动（21/9 比）
- 移动端（< md 断点）：改用 `aspect-[4/5]` 或 `aspect-[5/6]`（舞台变竖），因为 21/9 在手机上太窄

### z-index stack（back → front）

| z | 层 | 内容 | depth（视差系数） |
|---|------|------|---|
| 0 | 背景 | 渐变 `bg-gradient-to-b from-[#0a0a12] via-[#0f0a1f] to-black` + 可选星点 noise | 0.05 |
| 10 | Pedestal | `pedestal.png`，绝对定位 `bottom: 20%`，水平居中，宽 `min(456px, 40vw)` | 0.10 |
| 20 | Robot body | 三姿态图，绝对定位 `bottom: 28%`，水平居中，宽 `min(316px, 28vw)` | 0.30 |
| 25 | Robot face overlay | `robot-face.png`，**仅在 center 姿态显示**，绝对定位到 robot 面部区 | 0.35 |
| 30 | Coins layer | `<CoinsLayer />` 4 币漂浮（BTC/ETH/SOL/USDT），各币独立 depth | 0.70-0.90 |
| 40 | Speech bubble | 轮播气泡，绝对定位到 robot **右上**（desktop）/ robot **正上方**（mobile） | 0.50 |
| 50 | Title overlay | Title + subtitle + 双 CTA，绝对定位到舞台 `bottom: 6%`，水平居中 | - |

**depth 的用途**：所有 z=10/20/25/30/40 的层都做鼠标视差位移 `translate(mouseX * depth * 20px, mouseY * depth * 12px)`。深度越大位移越大，产生空间感。背景（z=0）也可以做 `depth=0.05` 微量位移。

### Title overlay 的可读性
- Title 位置和 robot+pedestal 可能有重叠。为保证可读性，Title 下方垫一层 `bg-gradient-to-t from-black via-black/80 to-transparent`，高度约 `35%`，从舞台底部往上渐变。
- Title 字号沿用现有（`text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold`）
- Subtitle 字号沿用现有（`text-sm sm:text-base md:text-lg`）
- CTA 按钮样式沿用现有（primary `bg-[#7c5cff]` / secondary 边框样式）

## 组件详细设计

### 1. `useMouseNormalized.ts`

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 监听鼠标在指定元素（舞台）内的归一化坐标
 * 返回 { x: -1..1, y: -1..1 }，中心为 (0, 0)
 * 鼠标离开元素时缓慢回归到 (0, 0)
 */
export function useMouseNormalized(ref: React.RefObject<HTMLElement>) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      setPos({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
    };

    const handleLeave = () => {
      // 缓慢 lerp 回 (0, 0)
      const start = performance.now();
      const from = posRef.current;
      const anim = (now: number) => {
        const t = Math.min((now - start) / 400, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        setPos({ x: from.x * (1 - ease), y: from.y * (1 - ease) });
        if (t < 1) rafRef.current = requestAnimationFrame(anim);
      };
      rafRef.current = requestAnimationFrame(anim);
    };

    const posRef = { current: pos }; // TS note: 实现时用 useRef 跟踪最新 pos
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [ref]);

  return pos;
}
```

（上面代码是示意，`posRef` 的实现细节你按 React 规范写好，不要复制成有 bug 的版本。目标是：返回实时归一化坐标 + 离开时平滑回中。）

### 2. `useRobotPose.ts`

```tsx
"use client";
import { useEffect, useState } from "react";

type Pose = "center" | "left" | "right";

/**
 * 根据鼠标 x 坐标切换机器人姿态，带滞后避免边界抖动
 * x < -0.33 → left，x > 0.33 → right，其余 → center
 * 从 left/right 回到 center 需要 x 进入 [-0.20, 0.20]（滞后区间）
 */
export function useRobotPose(mouseX: number, reduceMotion: boolean): Pose {
  const [pose, setPose] = useState<Pose>("center");

  useEffect(() => {
    if (reduceMotion) {
      setPose("center");
      return;
    }

    setPose((current) => {
      if (current === "center") {
        if (mouseX < -0.33) return "left";
        if (mouseX > 0.33) return "right";
        return "center";
      }
      if (current === "left") {
        return mouseX > -0.20 ? "center" : "left";
      }
      // current === "right"
      return mouseX < 0.20 ? "center" : "right";
    });
  }, [mouseX, reduceMotion]);

  return pose;
}
```

### 3. `RobotLayer.tsx`

职责：
- 根据 `pose` 渲染对应的 robot 图（center / left / right），用 `AnimatePresence mode="popLayout"` 做切换淡入淡出
- 仅 `pose === "center"` 时叠加 `robot-face.png`；叠加的 face 根据 `mouseX` / `mouseY` 做 `translate(mouseX * 4px, mouseY * 3px)` 眼球跟随
- 整个 RobotLayer 按 depth=0.3 做视差位移
- 空闲时 face 做自然眨眼（每 3-5s 随机，`scaleY: [1, 0.1, 1]` over 150ms）
- 点击整个 robot 触发一次短眨眼 + 轻微 scale bump（scale 1 → 0.97 → 1 over 200ms）
- 空闲 idle 上下浮动 `y: [0, -8, 0]`，4s 周期（保留原 HeroSection 的感觉）

props：
```tsx
interface RobotLayerProps {
  pose: "center" | "left" | "right";
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}
```

### 4. `PedestalLayer.tsx`

简单组件：渲染 `pedestal.png`，按 depth=0.1 做视差。空闲时加一层柔和的发光呼吸效果（`box-shadow` 或叠加 `radial-gradient` 层，`opacity: [0.4, 0.8, 0.4]` 3s 周期）。reduce-motion 时关闭呼吸。

### 5. `CoinsLayer.tsx`（4 币自由漂浮 + hover 交互）

#### 币种锚点与参数

4 个币围绕机器人散开。百分比绝对定位（相对舞台父容器）。

| 币 | 桌面锚点 | 桌面直径 | 移动端直径 | 视差深度 | 漂浮半径 X / Y | 漂浮周期 | 相位偏移 |
|---|---|---|---|---|---|---|---|
| BTC | `top: 20%, left: 18%` | 76px | 44px | 0.80 | 38 / 22 | 7.2s | 0s |
| ETH | `top: 15%, right: 19%` | 72px | 42px | 0.70 | 42 / 26 | 8.3s | 1.8s |
| SOL | `top: 55%, left: 12%` | 64px | 40px | 0.90 | 34 / 20 | 6.8s | 3.1s |
| USDT | `top: 48%, right: 13%` | 68px | 42px | 0.75 | 36 / 24 | 9.1s | 0.6s |

移动端（`< md`）：漂浮半径减半（18-22 / 10-13），周期不变。

#### 交互规格

- **漂浮**：每个币椭圆轨道 infinite loop，各自周期和相位不同——不同步
- **视差**：在漂浮之外叠加 `translate(mouseX * depth * 24, mouseY * depth * 14)`，过渡 220ms 柔和跟随
- **Hover**：`scale: 1.3` + `rotateZ: 360` + 提 `zIndex: 10` + 上方显示 symbol 小气泡（BTC/ETH/SOL/USDT）
  - scale 280ms ease-out，rotate 800ms ease-out（先变大再慢转）
  - tooltip 样式：`rounded-full bg-black/80 text-white text-xs font-semibold`，淡入 150ms
- **无点击跳转**：不加 onClick / href
- **reduce-motion**：漂浮完全关停（固定在锚点），视差也关（设 0），hover 只保留 `scale: 1.15`，不转
- **Aria**：`<img aria-label="Bitcoin|Ethereum|Solana|Tether">`，tooltip 加 `aria-hidden`

#### 实现关键点（**必读，不然会踩坑**）

1. **漂浮 animate 和 hover whileHover 必须拆到两层 motion.div**。放同一层，`whileHover` 触发时 `animate` 会 pause，币会瞬间回到 (0, 0) 再放大——视觉断裂。拆法：
   ```
   外层 div（视差 inline style transform）
     └─ motion.div（漂浮 animate 的椭圆 keyframes）
          └─ motion.div.group（whileHover 的 scale + rotate + zIndex）
               ├─ img
               └─ tooltip span（group-hover 触发）
   ```
2. **父层 `pointer-events-none`**（让鼠标穿透到舞台触发视差），**内层 hover motion.div 单独 `pointer-events-auto`**（接 hover 事件）
3. **reduce-motion 时 transition 的 duration 设 `0`**，不是 `0.01` 或省略——彻底跳过动画
4. 用原生 `<img>` 不用 `next/image`（绝对定位+嵌套 transform 场景下 next/image 更麻烦，本层是装饰资源不走 CDN 优化也无妨）

#### 参考实现

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
  anchor: { top: string; left?: string; right?: string };
  sizeClass: string;
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

### 6. `SpeechBubble.tsx`

职责：
- 从 `t.hero.speechBubble`（长度 14）随机（或顺序）选一条显示
- 每 **5.5s** 切换到下一条（平滑 fade + slight slide）
- 不要总是顺序播放——第一次 mount 随机选个起点，之后顺序轮播
- 气泡样式：圆角矩形，背景 `bg-white/95`，深色文字，小尾巴指向机器人（desktop 右上位置指向左下，mobile 正上方指向正下）
- 支持 reduce-motion（切换时直接 swap，不做 fade）
- 移动端气泡更小、文字行数可能要多（限制 max-width），desktop 可以到 `max-w-xs`

props：
```tsx
interface SpeechBubbleProps {
  reduceMotion: boolean;
}
```

实现细节（必须）：
- 用 `t.hero.speechBubble` 数组作为文案池
- Aria label 用 `t.hero.speechBubbleAriaLabel`
- 用 `AnimatePresence mode="wait"` 做切换
- 不要 cache 到 localStorage（无意义）

### 7. `HeroScene.tsx`（主容器）

```tsx
"use client";
import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { useMouseNormalized } from "./useMouseNormalized";
import { useRobotPose } from "./useRobotPose";
import { RobotLayer } from "./RobotLayer";
import { PedestalLayer } from "./PedestalLayer";
import { CoinsLayer } from "./CoinsLayer";
import { SpeechBubble } from "./SpeechBubble";

export function HeroScene() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const { x: mouseX, y: mouseY } = useMouseNormalized(stageRef);
  const pose = useRobotPose(mouseX, reduceMotion);

  return (
    <section
      ref={stageRef}
      className="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden bg-gradient-to-b from-[#0a0a12] via-[#0f0a1f] to-black pt-[72px] md:pt-[80px]"
    >
      {/* z-0 背景已在上面 bg-gradient，这里可加 noise/stars 粒子 */}

      {/* z-10 Pedestal */}
      <PedestalLayer mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />

      {/* z-20/25 Robot */}
      <RobotLayer pose={pose} mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />

      {/* z-30 Coins (stub) */}
      <CoinsLayer mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />

      {/* z-40 Speech bubble */}
      <SpeechBubble reduceMotion={reduceMotion} />

      {/* z-50 Title overlay + gradient scrim */}
      <div className="absolute inset-x-0 bottom-0 z-50 h-[42%] bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-[6%] z-50 flex flex-col items-center text-center px-6 max-w-4xl mx-auto left-1/2 -translate-x-1/2">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight mb-4 text-white leading-tight">
          {t.hero.title}
        </h1>
        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 pointer-events-auto">
          <motion.a
            href={COINW_SKILLS_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="px-8 py-3 bg-[#7c5cff] text-white text-base font-semibold rounded-xl hover:bg-[#8e6bff] hover:shadow-[0_0_24px_rgba(124,92,255,0.5)] transition-all inline-flex items-center justify-center"
          >
            {t.hero.ctaPrimary}
          </motion.a>
          <motion.a
            href={COINW_SKILLS_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="px-8 py-3 bg-white/10 border border-white/20 text-white text-base font-semibold rounded-xl hover:bg-white/15 transition-all inline-flex items-center justify-center"
          >
            {t.hero.ctaSecondary}
          </motion.a>
        </div>
      </div>
    </section>
  );
}
```

### 8. `index.tsx`

```tsx
export { HeroScene } from "./HeroScene";
```

## 移动端降级

在 `< md` 断点：
- 舞台改 `aspect-[4/5]`（不是 21/9）
- 禁用鼠标视差和眼睛跟随（没鼠标）
- 机器人姿态自动循环：每 8s 切 center → left → center → right → center（reduce-motion 时锁 center）
- Speech bubble 放正上方，max-width 收窄到屏幕 70%
- CoinsLayer 的币尺寸用 `w-[40-44px]`（见 COINS 配置的 sizeClass），漂浮半径减半

实现建议：用 `window.innerWidth < 768` 或 `useMediaQuery` 自建（不新增依赖）判断移动端，把 `useMouseNormalized` 返回固定 `{ x: 0, y: 0 }`，`useRobotPose` 替换为定时切换的内部 state 逻辑。

## i18n 新增字段

### `src/i18n/types.ts`

在 `hero` 对象里追加两个字段：

```tsx
hero: {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  speechBubble: string[];           // 长度 14
  speechBubbleAriaLabel: string;    // 无障碍描述
};
```

### 10 个 dict 的 speechBubble 翻译

所有 dict 按下面顺序追加 `speechBubble` 数组（长度必须 14，顺序一致）和 `speechBubbleAriaLabel`。

#### zh_CN
```json
"speechBubble": [
  "42 出自《银河系漫游指南》——宇宙的终极答案。",
  "42 = For two。为双向而生。",
  "我是一只 AI 爪子。帮你抓住 market 的节奏。",
  "爪子只做一件事：抓住别人没看到的信号。",
  "Paws on, humans off.",
  "你教它市场。它陪你成长。",
  "For two：不是你用 AI，是你和 AI 一起跑。",
  "人 ⇄ AI。进化是双向的。",
  "共生、共训、共进化。",
  "42 不是答案，是起点。",
  "做交易不是赌博，是可以训练的习惯。",
  "不做情绪化决策。我只听数据说话。",
  "别问为什么是 42。懂的都懂。",
  "42 秒前我还在读链上数据，现在轮到你问我问题。"
],
"speechBubbleAriaLabel": "Claw 42 Agent 气泡提示"
```

#### zh_TW
```json
"speechBubble": [
  "42 出自《銀河便車指南》——宇宙的終極答案。",
  "42 = For two。為雙向而生。",
  "我是一隻 AI 爪子。幫你抓住 market 的節奏。",
  "爪子只做一件事：抓住別人沒看到的訊號。",
  "Paws on, humans off.",
  "你教它市場。它陪你成長。",
  "For two:不是你用 AI，是你和 AI 一起跑。",
  "人 ⇄ AI。進化是雙向的。",
  "共生、共訓、共進化。",
  "42 不是答案，是起點。",
  "做交易不是賭博，是可以訓練的習慣。",
  "不做情緒化決策。我只聽資料說話。",
  "別問為什麼是 42。懂的都懂。",
  "42 秒前我還在讀鏈上資料，現在輪到你問我問題。"
],
"speechBubbleAriaLabel": "Claw 42 Agent 氣泡提示"
```

#### en_US
```json
"speechBubble": [
  "42 is from The Hitchhiker's Guide to the Galaxy — the ultimate answer to the universe.",
  "42 = For two. Built for bidirectional growth.",
  "I'm an AI claw. Here to grip the market's rhythm for you.",
  "A claw has one job: catch the signals no one else sees.",
  "Paws on, humans off.",
  "You teach it the market. It grows with you.",
  "For two: you're not using AI — you're running alongside it.",
  "Human ⇄ AI. Evolution goes both ways.",
  "Symbiosis. Co-training. Co-evolution.",
  "42 isn't the answer. It's the starting point.",
  "Trading isn't gambling. It's a habit you can train.",
  "No emotional trades. I only listen to data.",
  "Don't ask why 42. If you know, you know.",
  "42 seconds ago I was reading on-chain data. Now it's your turn to ask."
],
"speechBubbleAriaLabel": "Claw 42 Agent speech bubble"
```

#### ja_JP
```json
"speechBubble": [
  "42 は『銀河ヒッチハイク・ガイド』より——宇宙の究極の答え。",
  "42 = For two。双方向に進化するために。",
  "僕は AI のクロー。市場のリズムをつかむ手だ。",
  "クローの仕事はひとつ。他の誰も見ないシグナルを掴むこと。",
  "Paws on, humans off.",
  "君が市場を教え、僕が共に育つ。",
  "For two:AI を使うんじゃない。AI と一緒に走るんだ。",
  "人 ⇄ AI。進化は双方向。",
  "共生、共訓、共進化。",
  "42 は答えじゃない。スタート地点だ。",
  "トレードは博打じゃない。訓練できる習慣だ。",
  "感情でトレードしない。データしか聞かない。",
  "なぜ 42 か、訊かないで。分かる人には分かる。",
  "42 秒前までオンチェーンを読んでた。次は君の番だ。"
],
"speechBubbleAriaLabel": "Claw 42 Agent 吹き出し"
```

#### ru_RU
```json
"speechBubble": [
  "42 — это из «Автостопом по галактике», окончательный ответ на вопрос о Вселенной.",
  "42 = For two. Создано для двустороннего роста.",
  "Я — ИИ-клешня. Ловлю ритм рынка за тебя.",
  "У клешни одна задача: ловить сигналы, которых не видят другие.",
  "Paws on, humans off.",
  "Ты учишь его рынку. Он растёт вместе с тобой.",
  "For two: ты не используешь ИИ — ты бежишь с ним рядом.",
  "Человек ⇄ ИИ. Эволюция идёт в обе стороны.",
  "Симбиоз. Совместное обучение. Совместная эволюция.",
  "42 — не ответ, а отправная точка.",
  "Трейдинг — не азарт. Это привычка, которую можно натренировать.",
  "Без эмоциональных решений. Слушаю только данные.",
  "Не спрашивай, почему 42. Кто в теме — тот в теме.",
  "42 секунды назад я читал ончейн-данные. Теперь твой ход."
],
"speechBubbleAriaLabel": "Всплывающее сообщение Claw 42 Agent"
```

#### uk_UA
```json
"speechBubble": [
  "42 — це з «Путівника для мандрівників по галактиці», остаточна відповідь на питання про Всесвіт.",
  "42 = For two. Створено для двостороннього росту.",
  "Я — ШІ-клешня. Ловлю ритм ринку замість тебе.",
  "У клешні одна справа: ловити сигнали, яких не бачать інші.",
  "Paws on, humans off.",
  "Ти вчиш його ринку. Він зростає разом з тобою.",
  "For two: ти не використовуєш ШІ — ти біжиш із ним поруч.",
  "Людина ⇄ ШІ. Еволюція йде в обидва боки.",
  "Симбіоз. Спільне навчання. Спільна еволюція.",
  "42 — не відповідь, а відправна точка.",
  "Трейдинг — не азарт. Це звичка, яку можна натренувати.",
  "Жодних емоційних рішень. Слухаю лише дані.",
  "Не питай, чому 42. Хто в темі — той в темі.",
  "42 секунди тому я читав ончейн-дані. Тепер твоя черга."
],
"speechBubbleAriaLabel": "Спливаюче повідомлення Claw 42 Agent"
```

#### fr_FR
```json
"speechBubble": [
  "42 vient du Guide du voyageur galactique — la réponse ultime à l'univers.",
  "42 = For two. Conçu pour une croissance bidirectionnelle.",
  "Je suis une pince IA. Je saisis le rythme du marché pour toi.",
  "Une pince n'a qu'un seul job : attraper les signaux que personne d'autre ne voit.",
  "Paws on, humans off.",
  "Tu lui apprends le marché. Il grandit avec toi.",
  "For two : tu n'utilises pas l'IA — tu cours avec elle.",
  "Humain ⇄ IA. L'évolution va dans les deux sens.",
  "Symbiose. Co-entraînement. Co-évolution.",
  "42 n'est pas la réponse. C'est le point de départ.",
  "Trader, ce n'est pas parier. C'est une habitude qu'on peut entraîner.",
  "Aucune décision émotionnelle. J'écoute uniquement les données.",
  "Ne demande pas pourquoi 42. Qui sait, sait.",
  "Il y a 42 secondes je lisais des données on-chain. Maintenant c'est ton tour."
],
"speechBubbleAriaLabel": "Bulle de dialogue Claw 42 Agent"
```

#### es_ES
```json
"speechBubble": [
  "42 viene de la Guía del autoestopista galáctico — la respuesta definitiva al universo.",
  "42 = For two. Creado para un crecimiento bidireccional.",
  "Soy una garra de IA. Atrapo el ritmo del mercado por ti.",
  "Una garra tiene un solo trabajo: cazar las señales que nadie más ve.",
  "Paws on, humans off.",
  "Tú le enseñas el mercado. Él crece contigo.",
  "For two: no usas IA — corres junto a ella.",
  "Humano ⇄ IA. La evolución va en ambas direcciones.",
  "Simbiosis. Co-entrenamiento. Co-evolución.",
  "42 no es la respuesta. Es el punto de partida.",
  "Tradear no es apostar. Es un hábito que puedes entrenar.",
  "Sin decisiones emocionales. Solo escucho los datos.",
  "No preguntes por qué 42. El que sabe, sabe.",
  "Hace 42 segundos leía datos on-chain. Ahora te toca a ti preguntar."
],
"speechBubbleAriaLabel": "Burbuja de diálogo de Claw 42 Agent"
```

#### ar_SA
```json
"speechBubble": [
  "42 من رواية «دليل المسافر إلى المجرة» — الإجابة النهائية عن الكون.",
  "42 = For two. صُمم للنمو ثنائي الاتجاه.",
  "أنا مخلب ذكاء اصطناعي. أمسك إيقاع السوق من أجلك.",
  "للمخلب مهمة واحدة: اقتناص الإشارات التي لا يراها غيرك.",
  "Paws on, humans off.",
  "تعلّمه السوق، ويكبر معك.",
  "For two: أنت لا تستخدم الذكاء الاصطناعي، بل تركض إلى جانبه.",
  "إنسان ⇄ ذكاء اصطناعي. التطور يسير في الاتجاهين.",
  "تكافل، تدريب مشترك، تطور مشترك.",
  "42 ليست الإجابة، بل نقطة الانطلاق.",
  "التداول ليس قمارًا، بل عادة يمكن تدريبها.",
  "لا قرارات عاطفية. أصغي للبيانات فقط.",
  "لا تسأل لماذا 42. من يعرف يعرف.",
  "قبل 42 ثانية كنت أقرأ بيانات السلسلة. الآن دورك لتسأل."
],
"speechBubbleAriaLabel": "فقاعة كلام وكيل Claw 42"
```

#### en_XA（镜像 en_US，和现有 dict 风格一致）
```json
"speechBubble": [
  "42 is from The Hitchhiker's Guide to the Galaxy — the ultimate answer to the universe.",
  "42 = For two. Built for bidirectional growth.",
  "I'm an AI claw. Here to grip the market's rhythm for you.",
  "A claw has one job: catch the signals no one else sees.",
  "Paws on, humans off.",
  "You teach it the market. It grows with you.",
  "For two: you're not using AI — you're running alongside it.",
  "Human ⇄ AI. Evolution goes both ways.",
  "Symbiosis. Co-training. Co-evolution.",
  "42 isn't the answer. It's the starting point.",
  "Trading isn't gambling. It's a habit you can train.",
  "No emotional trades. I only listen to data.",
  "Don't ask why 42. If you know, you know.",
  "42 seconds ago I was reading on-chain data. Now it's your turn to ask."
],
"speechBubbleAriaLabel": "Claw 42 Agent speech bubble"
```

## 验收标准

编译/类型：
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误

视觉/交互（桌面）：
- [ ] 打开 `/` 或 `/en_US`，看到 21/9 舞台，robot + pedestal 居中、4 币漂浮在 robot 周围、title+CTA 在下部
- [ ] 4 币各自椭圆漂浮，彼此不同步
- [ ] 鼠标悬停任一币 → 放大 1.3x + 旋转 360° + 上方黑色小气泡显示 symbol（BTC/ETH/SOL/USDT）
- [ ] 点击币无反应（无跳转、无报错）
- [ ] 鼠标移到舞台左 1/3 → robot 切到 left 姿态（无面部）
- [ ] 鼠标移到舞台右 1/3 → robot 切到 right 姿态（无面部）
- [ ] 鼠标回中心 → robot 回 center 姿态，face overlay 显示
- [ ] center 姿态下，face 眼睛有轻微跟随鼠标位移（不夸张，±4px 级别）
- [ ] 空闲时 face 偶尔眨眼（约 3-5s 一次）
- [ ] 点击 robot 触发一次眨眼 + 轻微缩放
- [ ] 鼠标离开舞台 → 所有层 lerp 回原位（不要突然归零）
- [ ] Speech bubble 每 5.5s 切到下一条，14 条循环
- [ ] Title / CTA 可点击，CTA 链接指向 `COINW_SKILLS_URL`

视觉/交互（移动端 / < 768px）：
- [ ] 舞台变 4/5 纵向比
- [ ] 无鼠标视差、无眼睛跟随
- [ ] Robot 每 8s 自动循环姿态
- [ ] Speech bubble 在 robot 正上方

i18n：
- [ ] 10 个 dict 全部有 `speechBubble`（长度 14）和 `speechBubbleAriaLabel`
- [ ] 切换 locale 气泡文案对应变化
- [ ] ar_SA 下整体 RTL 正常（title/CTA 方向，气泡文字方向）
- [ ] `npx tsc --noEmit` 过（types.ts 字段和 dict 形状一致）

reduce-motion：
- [ ] 系统 prefers-reduced-motion 开启时：robot 姿态锁 center，coins 不动，气泡切换无 fade，pedestal 发光呼吸关闭

其他：
- [ ] `public/images/hero-robot-scene.png` 被删除
- [ ] `page.tsx` 里 `HeroSection` 函数定义被删除
- [ ] 没引入任何新依赖（`package.json` 和 `package-lock.json` 除了 build hash 外无改动）

## 约束

- 不要用 `next/dynamic` 做 ssr:false（本组件是 client 组件，直接 `"use client"` 就行）
- 不要引入任何动画库/图标库（framer-motion 够用）
- 不要把 RobotLayer 切到 `<canvas>` 或 WebGL 实现——用 `<Image>` + CSS transform 就够了
- 不要把 mousemove 绑到 window（绑到 stageRef 元素，避免页面其他地方也触发）
- 不要 cache 气泡 index 到 localStorage（无意义，每次加载随机起点即可）
- Speech bubble 的文案池 14 条的顺序和内容必须和本 spec 一致，**不要自己改写**
- `useMouseNormalized` 和 `useRobotPose` 必须拆成独立 Hook，不要内联到 HeroScene（方便后续 Spec D 复用）

## 提交与 PR

1. 从最新 `main` 切分支 `feature/claw42-hero-scene-04`
2. 实现 + 自测（桌面 + 移动端模拟 + reduce-motion）
3. Commit message 清晰：
   ```
   feat(hero): interactive scene with pose state machine + speech bubble rotation

   - Split HeroSection into HeroScene module at src/modules/landing/HeroScene/
   - 3-pose robot state machine (center/left/right) with hysteresis based on mouse X
   - Eye+mouth overlay follows mouse in center pose + idle blinking + click bump
   - Pedestal + coins layer (stub for Spec D) + speech bubble 14-entry rotation
   - Depth-based parallax (pedestal 0.1 / robot 0.3 / coins 0.7-1.0)
   - 21/9 desktop stage, 4/5 mobile fallback with auto pose cycle
   - i18n: hero.speechBubble[14] + hero.speechBubbleAriaLabel across 10 locales
   - Remove legacy hero-robot-scene.png and HeroSection function
   ```
4. Push + 开 PR → 等 F 审核

## 有疑问不要猜

以下情况直接停下问 F（通过 Dan 中转）：
- face overlay 的定位算出来对不齐 robot 面部（面部偏移的具体像素，你测试后告诉 F 看到的实际情况）
- 气泡 tail（小尾巴）指向位置在 desktop/mobile 哪个方向更合适
- 21/9 在超宽屏（2560px+）下 robot 显得太小，是否要加 max-height
- 移动端 pose 自动循环周期 8s 是否太快/太慢

---

*维护者: F（总调度）*
*创建: 2026-04-22*
*依赖 Task：02（已合并）*
