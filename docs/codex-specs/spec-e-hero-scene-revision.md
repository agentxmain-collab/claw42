# Spec E — HeroScene 交互修订（基于 Airy task-04 修补，v2）

## 目标

一句话：修 Airy task-04 HeroScene 的 5 个方向性问题——Coins 重做（尺寸/漂浮算法/hover）、Robot 悬浮感补齐 + Pedestal 能量光柱、面部拆分（robot-face 切成 eyes + mouth 两张已在 main）、**去掉 center pose 和 eye tracking**、气泡改 hover 触发锚定嘴边。

## v2 修订说明（2026-04-22，基于 Dan 纠正）

相对 v1 变更点：
- 实际只有 `robot-left` / `robot-right` 两种 pose（**没有 center pose 素材**）
- 不再生成 `robot-center-blank.png`；center 视作 left 默认朝向
- 眼+嘴素材已由 F 从 `robot-face.png` 切出 → `robot-eyes.png` + `robot-mouth.png`（107×59 全尺寸对齐，已在 `public/images/hero/`）
- **完全去除 eye tracking**（眼睛不再追鼠标）——根因是 right pose 镜像时追踪方向会反转
- `right` pose 的 eyes 用 `transform: scaleX(-1)` 镜像复用；mouth 不镜像（对称）
- 左/右 pose 都叠加 eyes + mouth（不再区分是否显示面部）
- body / coin / pedestal 的 parallax **保留**（这些元素不镜像，无方向冲突）

## 分支策略

```
git fetch origin
git checkout main
git pull origin main
git checkout feature/claw42-hero-scene-04
git pull origin feature/claw42-hero-scene-04
git checkout -b fix/hero-scene-revision-01
# 实现
git push origin fix/hero-scene-revision-01
# 开 PR 到 feature/claw42-hero-scene-04（不是 main）
```

F 审核通过后，`feature/claw42-hero-scene-04` 含本修复再整体合并到 `main`。

## 资源前提

以下文件**已在** `public/images/hero/`（F 已 push 到 main）：

| 文件 | 规格 | 内容 |
|------|------|------|
| `robot-eyes.png` | 107×59，PNG 透明底 | 从 `robot-face.png` 切出——仅保留双眼区域（y=0–29），嘴区域透明 |
| `robot-mouth.png` | 107×59，PNG 透明底 | 从 `robot-face.png` 切出——仅保留嘴区域（y=30–58），眼区域透明 |

关键：两张切分图**保持和原 `robot-face.png` 完全相同的 107×59 尺寸**，只是 alpha 不同。这意味着：

> 在 Airy task-04 的代码里，`robot-face.png` 原本叠加到 body 的 `top` / `left` / `width` 坐标，**直接复用给 `robot-eyes.png` 和 `robot-mouth.png`**，不需要重新计算对齐位置。两张图叠起来视觉上等价于 face 原图。

已有仍使用的资源：
- `robot-left.png`（316×297，**无面部**身体，头部朝左）
- `robot-right.png`（316×297，**无面部**身体，头部朝右）
- `pedestal.png`（456×148）
- `coin-btc.png` / `coin-eth.png` / `coin-sol.png` / `coin-usdt.png`

不再引用的资源（保留文件，代码里不再 src）：
- `robot-center.png`（**带面部**的 center 身体，不用——因为面部拆分后 center 身体要改用无脸版，但我们决定不要 center pose，这张图直接弃用）
- `robot-face.png`（已被切成 eyes + mouth 两张，原图保留备份）

## 变更范围

### 修改
- `src/modules/landing/HeroScene/HeroScene.tsx`
- `src/modules/landing/HeroScene/RobotLayer.tsx`
- `src/modules/landing/HeroScene/PedestalLayer.tsx`
- `src/modules/landing/HeroScene/CoinsLayer.tsx`
- `src/modules/landing/HeroScene/SpeechBubble.tsx`

### 不动（明确禁止碰）
- `src/modules/landing/HeroScene/useMouseNormalized.ts`
- `src/modules/landing/HeroScene/useRobotPose.ts`（**仍允许输出 "center"，RobotLayer 内部 collapse**）
- `src/modules/landing/HeroScene/index.tsx`
- `src/app/[locale]/page.tsx`
- `src/i18n/*`（不新增字段，复用 Airy 已加的 `hero.speechBubble` 数组和 `hero.speechBubbleAriaLabel`）
- `src/lib/*`
- Tailwind 配置 / `globals.css`
- `package.json` / `package-lock.json`（不新增依赖）
- `public/images/*` 已有资源只增不删

### 不在本 spec 范围
- useRobotPose 的 pose 决策逻辑（由 Airy 实现，保留）
- 鼠标归一化 Hook
- 舞台 21/9 / 4/5 响应式比例
- Header 双 logo 问题（独立 spec 处理）

## 技术栈（硬约束）
- Next.js 14.2.35（App Router）
- React 18
- Tailwind CSS 3.4.1
- TypeScript 5.x
- framer-motion ^11.x

### 禁用清单
- ❌ 新增依赖
- ❌ Tailwind v4 语法
- ❌ React 19 only 特性
- ❌ `localStorage` / `sessionStorage`
- ❌ `next/image`（装饰性 decal 原生 `<img>` 即可）
- ❌ 改动 props 接口的既有字段名

---

## Section 1 — CoinsLayer 重做

### 当前问题

Airy 实现：4 币椭圆轨道漂浮 + hover 放大 1.3x + 旋转 360° + 黑底 tooltip 显示 symbol。

问题：
1. 币尺寸 44-76px 太小
2. 椭圆轨道 infinite loop 运动轨迹可预测，**机械感**明显
3. hover 放大+旋转+tooltip 三件套过于 SaaS dashboard 风，和整体太空感不搭

### 目标行为

- 币尺寸放大：mobile `60px` / desktop `108px`
- 漂浮算法改为**多频正弦叠加**，模拟失重太空漂浮：
  - X 轴 = `sin(t * 0.6 + phaseX1) * 30 + sin(t * 0.23 + phaseX2) * 18`
  - Y 轴 = `cos(t * 0.5 + phaseY1) * 22 + sin(t * 0.31 + phaseY2) * 14`
  - 每个币 4 个相位常量不同 → 彻底异步
- 默认状态：币自带轻柔紫色发光 `drop-shadow(0 0 18px rgba(124,92,255,0.35))`
- Hover 状态：
  - 发光增强 `drop-shadow(0 0 48px rgba(124,92,255,0.9))` + `filter: saturate(1.4)`
  - 币本身**不放大、不旋转**
  - **保留 parallax 朝鼠标方向轻微漂移** 12-18px（非 eye tracking，不是方向性问题）
  - **拖尾光效**：hover 时在币正后方渲染 2 个半透明 ghost 副本，delay 80ms / 160ms 跟随位置，opacity 分别 0.35 / 0.15
- 取消 symbol tooltip（彻底删）
- 不做点击跳转

### 实现路径（关键）

**多频正弦漂浮**用 requestAnimationFrame 手写（framer-motion 的 keyframes 本质是线性插值，不够"飘"）：

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

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
  phaseX1: number;
  phaseX2: number;
  phaseY1: number;
  phaseY2: number;
  freqScale: number;
}

const COINS: CoinConfig[] = [
  { symbol: "BTC",  label: "Bitcoin",  src: "/images/hero/coin-btc.png",
    anchor: { top: "22%", left: "20%" }, sizeClass: "w-[60px] md:w-[108px]",
    depth: 0.8, phaseX1: 0,    phaseX2: 1.2, phaseY1: 0.4, phaseY2: 2.1, freqScale: 1.0 },
  { symbol: "ETH",  label: "Ethereum", src: "/images/hero/coin-eth.png",
    anchor: { top: "18%", right: "21%" }, sizeClass: "w-[58px] md:w-[104px]",
    depth: 0.7, phaseX1: 1.9,  phaseX2: 3.0, phaseY1: 1.1, phaseY2: 0.6, freqScale: 1.15 },
  { symbol: "SOL",  label: "Solana",   src: "/images/hero/coin-sol.png",
    anchor: { top: "58%", left: "14%" }, sizeClass: "w-[54px] md:w-[96px]",
    depth: 0.9, phaseX1: 2.7,  phaseX2: 0.4, phaseY1: 2.3, phaseY2: 1.5, freqScale: 0.88 },
  { symbol: "USDT", label: "Tether",   src: "/images/hero/coin-usdt.png",
    anchor: { top: "52%", right: "15%" }, sizeClass: "w-[56px] md:w-[100px]",
    depth: 0.75, phaseX1: 0.8, phaseX2: 2.5, phaseY1: 3.1, phaseY2: 0.2, freqScale: 1.27 },
];

export function CoinsLayer({ mouseX, mouseY, reduceMotion }: CoinsLayerProps) {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (reduceMotion) return;
    startRef.current = performance.now();
    const loop = (now: number) => {
      setTick((now - startRef.current) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {COINS.map((coin) => {
        const t = tick * coin.freqScale;
        const floatX = reduceMotion ? 0 :
          Math.sin(t * 0.6 + coin.phaseX1) * 30 +
          Math.sin(t * 0.23 + coin.phaseX2) * 18;
        const floatY = reduceMotion ? 0 :
          Math.cos(t * 0.5 + coin.phaseY1) * 22 +
          Math.sin(t * 0.31 + coin.phaseY2) * 14;
        const parallaxX = reduceMotion ? 0 : mouseX * coin.depth * 24;
        const parallaxY = reduceMotion ? 0 : mouseY * coin.depth * 14;

        return (
          <CoinItem
            key={coin.symbol}
            coin={coin}
            translateX={floatX + parallaxX}
            translateY={floatY + parallaxY}
            reduceMotion={reduceMotion}
          />
        );
      })}
    </div>
  );
}

interface CoinItemProps {
  coin: CoinConfig;
  translateX: number;
  translateY: number;
  reduceMotion: boolean;
}

function CoinItem({ coin, translateX, translateY, reduceMotion }: CoinItemProps) {
  const [hovered, setHovered] = useState(false);
  const [trailA, setTrailA] = useState({ x: 0, y: 0 });
  const [trailB, setTrailB] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!hovered || reduceMotion) {
      setTrailA({ x: 0, y: 0 });
      setTrailB({ x: 0, y: 0 });
      return;
    }
    const idA = setTimeout(() => setTrailA({ x: translateX, y: translateY }), 80);
    const idB = setTimeout(() => setTrailB({ x: translateX, y: translateY }), 160);
    return () => {
      clearTimeout(idA);
      clearTimeout(idB);
    };
  }, [translateX, translateY, hovered, reduceMotion]);

  const baseFilter = hovered
    ? "drop-shadow(0 0 48px rgba(124,92,255,0.9)) saturate(1.4)"
    : "drop-shadow(0 0 18px rgba(124,92,255,0.35))";

  return (
    <div
      className="absolute"
      style={{
        top: coin.anchor.top,
        left: coin.anchor.left,
        right: coin.anchor.right,
      }}
    >
      {hovered && !reduceMotion && (
        <img
          src={coin.src}
          alt=""
          aria-hidden="true"
          className={`${coin.sizeClass} absolute top-0 left-0 select-none pointer-events-none`}
          style={{
            transform: `translate(${trailB.x}px, ${trailB.y}px)`,
            opacity: 0.15,
            filter: "blur(4px) saturate(1.6)",
            transition: "transform 200ms ease-out, opacity 200ms ease-out",
          }}
        />
      )}
      {hovered && !reduceMotion && (
        <img
          src={coin.src}
          alt=""
          aria-hidden="true"
          className={`${coin.sizeClass} absolute top-0 left-0 select-none pointer-events-none`}
          style={{
            transform: `translate(${trailA.x}px, ${trailA.y}px)`,
            opacity: 0.35,
            filter: "blur(2px) saturate(1.5)",
            transition: "transform 160ms ease-out, opacity 160ms ease-out",
          }}
        />
      )}
      <img
        src={coin.src}
        alt=""
        aria-label={coin.label}
        draggable={false}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`${coin.sizeClass} relative select-none pointer-events-auto cursor-pointer`}
        style={{
          transform: `translate(${translateX}px, ${translateY}px)`,
          filter: baseFilter,
          transition: "filter 240ms ease-out",
        }}
      />
    </div>
  );
}
```

### 注意

- `setTick` 每帧 rerender 在 4-5 币情况下可接受。build 后性能差再改 `useRef + imperative style`，本 spec 不要求
- trail ghost 必须 `absolute top-0 left-0`，**相对于父的锚点**
- `cursor: pointer` 保留，**不加 onClick**

---

## Section 2 — Robot 悬浮感 + Pedestal 能量光柱

### 当前问题

- Robot `bottom: 28%`，pedestal `bottom: 20%` → 底部贴合，无间距
- Airy 可能没实现 pedestal 呼吸光或太弱

### 目标行为

- Robot 往上提：`bottom: 32%`（desktop）/ `bottom: 30%`（mobile）
- Robot idle 浮动幅度 `y: [0, -12, 0]`，周期 3.5s
- Pedestal 顶部加"能量光柱"层，夹在 pedestal 和 robot 之间
- 光柱视觉：向上发散紫色锥光，底宽 ~pedestal 宽的 60%，顶端到 robot 底部
- 光柱呼吸：opacity `[0.45, 0.85, 0.45]`，周期 3s
- reduce-motion：光柱固定 opacity 0.65，robot 不浮动

### 实现路径

#### 2.1 `HeroScene.tsx` 不动 robot 定位

RobotLayer 内部自管垂直定位（见 Section 3/4），HeroScene 无需改 robot 容器。

#### 2.2 `PedestalLayer.tsx` 加能量光柱

```tsx
"use client";

import { motion } from "framer-motion";

interface PedestalLayerProps {
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

export function PedestalLayer({ mouseX, mouseY, reduceMotion }: PedestalLayerProps) {
  const parallaxX = reduceMotion ? 0 : mouseX * 0.1 * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * 0.1 * 12;

  return (
    <>
      {/* 能量光柱（pedestal 上方，robot 下方） */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: "20%",
          width: "min(280px, 26vw)",
          height: "min(180px, 14vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 15,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 100% at 50% 100%, rgba(124,92,255,0.55) 0%, rgba(124,92,255,0.22) 35%, transparent 70%)",
            filter: "blur(8px)",
          }}
          animate={reduceMotion ? { opacity: 0.65 } : { opacity: [0.45, 0.85, 0.45] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>

      {/* Pedestal 本体 */}
      <div
        className="absolute left-1/2 pointer-events-none"
        style={{
          bottom: "20%",
          width: "min(456px, 40vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 10,
        }}
      >
        <img
          src="/images/hero/pedestal.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="w-full h-auto select-none"
        />
        {/* Pedestal 顶部发光 halo */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            top: "-8%",
            width: "70%",
            height: "40%",
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(124,92,255,0.6), transparent 70%)",
            filter: "blur(6px)",
          }}
          animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.4, 0.8, 0.4] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>
    </>
  );
}
```

### 注意

- 光柱层 `zIndex: 15`，在 pedestal（10）和 robot（20）之间
- 光柱 `blur(8px)` 必要，否则 radial-gradient 边缘硬
- pedestal / halo 的 parallax 保留（不镜像元素，无方向问题）

---

## Section 3 & 4 — 面部拆分（eyes/mouth）+ 无 center pose + 无 eye tracking

### 当前问题

Airy 实现：
- center 姿态用 `robot-center.png`（**带面部**）+ `robot-face.png` overlay → 冗余叠加，原图面部穿帮
- face overlay 作为独立子层，和 body idle 浮动**脱节**（身体飘，脸不跟）
- eyes 和 mouth 同一张图，眼动时嘴也动
- 追鼠标（eye tracking）在 right pose 镜像时方向反转

### 目标行为

**核心认知**：没有 center pose 素材。useRobotPose 仍可能输出 "center"（Airy 实现保留），但 RobotLayer 内部 collapse 到 "left" 作为默认朝向：

```ts
const displayPose: "left" | "right" = pose === "right" ? "right" : "left";
```

含义：
- `pose === "left"` → 显示 left 姿态
- `pose === "right"` → 显示 right 姿态
- `pose === "center"` → 视作 "left"（默认朝向）

其他要求：
- body 只用 `robot-left.png` / `robot-right.png`（都是**无面部**身体）
- 在 body 上叠加两个独立子元素：`<img src="robot-eyes.png">` 和 `<img src="robot-mouth.png">`
- eyes 和 mouth 都是 107×59 全尺寸，从 `robot-face.png` 切出——**叠加坐标直接复用 Airy 代码里 robot-face.png 原本叠加的 top/left/width**
- `right` pose 时 eyes 用 `transform: scaleX(-1)` 镜像（让瞳孔跟随朝向）
- mouth **不镜像**（对称）
- **body / eyes / mouth 共享同一个 `<motion.div>` 父节点**（带 idle y 动画）——三者统一浮动
- **完全不做 eye tracking**（眼不追鼠标）
- 眨眼：eyes 层 `scaleY: [1, 0.1, 1]` 150ms，每 3-5s 随机触发（left 和 right 都触发，不分 pose）
- body parallax 保留（不镜像元素，安全）

### 实现路径

#### RobotLayer.tsx 完整重写

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { SpeechBubble } from "./SpeechBubble";

type Pose = "center" | "left" | "right";

interface RobotLayerProps {
  pose: Pose;
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

const POSE_SRC: Record<"left" | "right", string> = {
  left: "/images/hero/robot-left.png",
  right: "/images/hero/robot-right.png",
};

export function RobotLayer({ pose, mouseX, mouseY, reduceMotion }: RobotLayerProps) {
  const [blink, setBlink] = useState(false);
  const [hovered, setHovered] = useState(false);

  // center 视作 left（默认朝向）
  const displayPose: "left" | "right" = pose === "right" ? "right" : "left";

  // 眨眼：left / right 都触发，3-5s 随机间隔
  useEffect(() => {
    if (reduceMotion) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 2000;
      timeoutId = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, [reduceMotion]);

  // body 整体 parallax（不镜像，安全保留）
  const parallaxX = reduceMotion ? 0 : mouseX * 0.3 * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * 0.3 * 12;

  // === 叠加坐标 ===
  // 重要：以下 top / left / width 数值必须和 Airy task-04 分支里 RobotLayer.tsx
  // 原本 robot-face.png 叠加到 body 的坐标**完全相同**。
  // 因为 robot-eyes.png / robot-mouth.png 是从 robot-face.png 直接切出，保持 107×59 尺寸，
  // 两张叠到原 face 位置 = 视觉上等价于原 face 图。
  // Codex 开工前先 checkout Airy 分支，grep "robot-face" 在 RobotLayer.tsx 里找到原坐标，
  // 复制到 FACE_OVERLAY 常量。
  const FACE_OVERLAY = {
    top: "34%",       // ← 占位：实际从 Airy 代码 copy
    leftPct: "50%",   // ← 占位
    widthPct: "34%",  // ← 占位（约 107/316 = 33.9%）
  };

  return (
    <div
      className="absolute left-1/2"
      style={{
        bottom: "32%",
        width: "min(316px, 28vw)",
        transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      {/* 共享 idle 浮动的父 motion.div —— body / eyes / mouth 都是它的子 */}
      <motion.div
        className="relative"
        animate={reduceMotion ? { y: 0 } : { y: [0, -12, 0] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {/* Body — 挂 hover 监听 */}
        <AnimatePresence mode="popLayout">
          <motion.img
            key={displayPose}
            src={POSE_SRC[displayPose]}
            alt=""
            aria-label="Claw 42 robot"
            draggable={false}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="w-full h-auto select-none block"
            style={{ pointerEvents: "auto" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>

        {/* Eyes 层：107×59 全尺寸，天然和原 face 坐标对齐 */}
        <motion.img
          src="/images/hero/robot-eyes.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={{
            top: FACE_OVERLAY.top,
            left: FACE_OVERLAY.leftPct,
            width: FACE_OVERLAY.widthPct,
            // right pose 镜像水平翻转；left / center→left 不镜像
            transform: `translate(-50%, 0)${displayPose === "right" ? " scaleX(-1)" : ""}`,
            transformOrigin: "center center",
          }}
          animate={blink ? { scaleY: [1, 0.1, 1] } : { scaleY: 1 }}
          transition={{ duration: 0.15 }}
        />

        {/* Mouth 层：不镜像（对称），无独立动画，只跟随 body idle float */}
        <img
          src="/images/hero/robot-mouth.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={{
            top: FACE_OVERLAY.top,
            left: FACE_OVERLAY.leftPct,
            width: FACE_OVERLAY.widthPct,
            transform: "translate(-50%, 0)",
          }}
        />
      </motion.div>

      {/* Speech bubble：不跟 idle float（放在 motion.div 外），锚定 robot 容器 */}
      <SpeechBubble visible={hovered} reduceMotion={reduceMotion} />
    </div>
  );
}
```

### 关键点

- **body / eyes / mouth 全在同一 motion.div 里**（带 idle y 动画），整体浮动同步
- eyes/mouth 叠加尺寸 **`FACE_OVERLAY` 常量**——Codex 动手前先 checkout Airy 分支，grep `robot-face` 在 `RobotLayer.tsx` 里找到原坐标，**完全复制过来**（切分图和原 face 同尺寸，坐标零偏差）
- right pose 时 eyes 用 `scaleX(-1)` 镜像；`transform` 同时要保留 `translate(-50%, 0)` 居中
- scaleX(-1) 和眨眼 scaleY 不冲突——scaleY 走 framer-motion `animate` prop，scaleX 走 style transform，两者在实际渲染时会合并，但为稳妥：scaleX(-1) 放到 style transform，scaleY 走 animate——测试后若有冲突，把 scaleX 也迁移到 motion 的 animate prop 里一起走
- body 的 img 必须 `pointer-events: auto`，让 hover 监听到
- 外层 div 和 motion.div 都可以是 `pointer-events: none`，只 body img 是 auto——避免其他 pose 切换瞬间 hover 丢失
- `AnimatePresence mode="popLayout"` 切换 body src 做 fade 过渡
- SpeechBubble 放在 motion.div **外面**——不随 idle float 抖动（否则气泡读起来头晕）

---

## Section 5 — Speech bubble 改 hover 触发 + 锚定嘴边

### 当前问题

Airy 实现：挂在 HeroScene 上方，5.5s 自动轮播。位置和 robot 脱节，自动轮播像 banner。

### 目标行为

- 取消自动轮播
- 鼠标进入 robot body 区 → 从 14 条池随机选一条 → 气泡 fade-in
- 鼠标离开 → fade-out
- 气泡锚点：相对 robot 嘴巴**右上**（desktop）/ **正上方**（mobile）
- tail 方向：指向 robot 嘴
- 一次 hover 只显示一条（离开前不切换）
- reduce-motion：无 fade

### 架构变动

- Speech bubble **不再**挂在 HeroScene
- 改为作为 **RobotLayer 的子元素**（已在上面的 RobotLayer 重写里体现）
- hover state 放 RobotLayer 内部（无需 prop drilling）
- HeroScene 里**移除** `<SpeechBubble />` 调用

### 实现路径

#### 5.1 `HeroScene.tsx` 去掉 SpeechBubble

- 删掉 `import { SpeechBubble } from "./SpeechBubble"`
- 删掉 `<SpeechBubble ... />` 渲染
- 删掉任何自动轮播相关的 state / effect / timer

#### 5.2 `SpeechBubble.tsx` 完整重写

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface SpeechBubbleProps {
  visible: boolean;
  reduceMotion: boolean;
}

export function SpeechBubble({ visible, reduceMotion }: SpeechBubbleProps) {
  const { t } = useI18n();
  const pool = t.hero.speechBubble;
  const [currentLine, setCurrentLine] = useState<string>("");

  // visible=true 时随机选一条；false 时不重置（避免 fade-out 时文字闪）
  useEffect(() => {
    if (visible) {
      const idx = Math.floor(Math.random() * pool.length);
      setCurrentLine(pool[idx]);
    }
  }, [visible, pool]);

  return (
    <div
      className="absolute pointer-events-none top-[-8%] left-1/2 -translate-x-1/2 md:top-[28%] md:left-[62%] md:translate-x-0"
      style={{ zIndex: 40 }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="bubble"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 6 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="relative bg-white/95 text-gray-900 rounded-2xl px-4 py-2 text-sm font-medium max-w-[240px] md:max-w-[280px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            aria-label={t.hero.speechBubbleAriaLabel}
            role="status"
          >
            {currentLine}
            {/* Tail 指向左下（桌面）/ 底部中央（移动）——简单用旋转方块 */}
            <span
              className="absolute w-3 h-3 bg-white/95 rotate-45 left-[16px] bottom-[-6px] md:left-[16px]"
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 注意

- `t.hero.speechBubble` 是 Airy 已加的 14 条字符串数组，复用不新增
- `role="status"` + `aria-label` 保持可访问性
- tail 方块是最简实现，不做 clip-path / SVG
- 气泡位置坐标（`top-[28%] left-[62%]`）是**相对 RobotLayer 的外层容器**，不是舞台。RobotLayer 外层宽度 = `min(316px, 28vw)`，所以 left=62% ≈ 离 robot 左边缘 196px ≈ 在 robot 右上方

---

## 验收标准

### 编译/类型
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误
- [ ] `git diff --name-only feature/claw42-hero-scene-04..HEAD` 只显示本 spec 允许的 5 个文件

### 资源依赖验证
- [ ] `public/images/hero/robot-eyes.png` 存在（107×59）
- [ ] `public/images/hero/robot-mouth.png` 存在（107×59）
- [ ] 代码里不再引用 `robot-center.png`（grep 确认）
- [ ] 代码里不再引用 `robot-face.png`（grep 确认）
- [ ] POSE_SRC 只有 `left` / `right` 两个 key

### 视觉/交互（桌面）

Coins：
- [ ] 4 币尺寸 ~108px 桌面
- [ ] 漂浮轨迹**看不出固定椭圆**
- [ ] 默认状态币自带柔和紫色发光
- [ ] hover：发光显著增强 + 币朝鼠标方向漂移 + 后方 2 层拖尾 ghost
- [ ] hover **不放大、不旋转**，**无 symbol tooltip**
- [ ] 鼠标离开 → ghost 消失，发光回默认

Robot + Pedestal：
- [ ] Robot 底部和 pedestal 顶部有明显视觉间距（悬浮感）
- [ ] Robot idle 上下浮动明显（±12px）
- [ ] Pedestal 顶部向上发散紫色光柱
- [ ] 光柱 + halo 呼吸节奏

面部（left 和 right pose 都生效）：
- [ ] body 使用 `robot-left.png` 或 `robot-right.png`（**无面部**身体）
- [ ] eyes（`robot-eyes.png`）和 mouth（`robot-mouth.png`）叠加位置和原 `robot-face.png` 在 Airy 分支里的位置**完全一致**
- [ ] body idle 浮动时，eyes 和 mouth **同步**上下浮动（不脱节）
- [ ] **没有** eye tracking（眼不跟随鼠标）
- [ ] left pose 下 eyes 和 mouth 正常显示，不镜像
- [ ] right pose 下 eyes **镜像**（scaleX(-1)），mouth 不镜像
- [ ] pose 切换时（left ↔ right）eyes 的镜像跟着切换
- [ ] 每 3-5s 眼睛眨眼一次（left / right 都触发）
- [ ] 初始状态（pose === "center"）视觉上显示 left 姿态

Speech bubble：
- [ ] 默认**不显示**
- [ ] 鼠标进入 robot body → 气泡 fade-in，位置在 robot 嘴巴右上方
- [ ] 气泡显示内容是从 14 条池随机选的一条
- [ ] 鼠标离开 robot body → 气泡 fade-out
- [ ] 单次 hover 期间文案不切换
- [ ] tail 方向指向 robot 嘴
- [ ] 气泡**不随 idle float 抖动**（在 motion.div 外）

### 视觉/交互（移动端 / < 768px）
- [ ] 币尺寸缩到 54-60px
- [ ] 漂浮幅度自然缩小
- [ ] Speech bubble 位置在 robot 正上方
- [ ] 触屏设备 hover 触发行为（没有真实 hover）作为已知限制，不在本 spec 解决

### reduce-motion
- [ ] Coins 不漂浮（静止在锚点），hover 不漂移（parallax 也关），只发光
- [ ] trail ghost 完全不渲染
- [ ] Robot body 不 idle 浮动
- [ ] Pedestal 光柱不呼吸（固定 opacity 0.65）
- [ ] Eyes 不眨眼
- [ ] Speech bubble 显示/隐藏无 fade

### 边界
- [ ] 不引入新依赖
- [ ] 不引用 robot-center.png / robot-face.png
- [ ] 不改 page.tsx / i18n / hook 文件
- [ ] 不修改 useRobotPose.ts（Pose 类型保留 "center"，RobotLayer 内 collapse）
- [ ] 所有 hover 状态用 React state 管理，不用 `:hover` CSS 伪类

---

## 约束

- 不要改 `useMouseNormalized.ts` / `useRobotPose.ts` / `index.tsx` / `src/app/[locale]/page.tsx` / `src/i18n/*`
- 不要新增 i18n 字段
- 不要新增资源文件到 `public/images/hero/` 以外目录
- 不要使用 `requestAnimationFrame` 以外的手写动画循环（CoinsLayer 已有 RAF，其他地方不要复刻）
- 眨眼频率 3-5s 是**随机区间**，不是固定 4s
- Speech bubble tail 是小方块旋转 45°，不要用 CSS clip-path 或 SVG
- FACE_OVERLAY 的 top/left/width 必须从 Airy 分支的 RobotLayer.tsx 里原 `robot-face` 叠加坐标直接 copy——不要自己估算，不要"看起来差不多就行"

---

## 提交与 PR

1. 从 `feature/claw42-hero-scene-04` checkout `fix/hero-scene-revision-01`
2. 实现 + 自测（桌面 + 移动端模拟 + reduce-motion）
3. Commit message：
   ```
   fix(hero): coins free-float + robot float-gap + eyes/mouth split + bubble hover

   - CoinsLayer: multi-sine free float, larger sizes, hover glow+trail, remove scale/rotate/tooltip
   - PedestalLayer: add energy pillar + halo breathing
   - RobotLayer: drop center pose (collapse to left), use robot-left/right only
                 + overlay robot-eyes.png (scaleX(-1) on right pose) + robot-mouth.png
                 + body/eyes/mouth share idle float, no eye tracking
   - SpeechBubble: hover-triggered, anchored to robot mouth, random line per hover
   - Assets: use pre-split robot-eyes.png + robot-mouth.png (already in main)
   ```
4. Push + 开 PR 到 `feature/claw42-hero-scene-04`

## 有疑问不要猜

- FACE_OVERLAY 坐标在 Airy 代码里找不到（Airy 可能用了不同命名）→ 告诉 Dan，不瞎估
- right pose 镜像后眼睛位置看起来偏了（因为镜像锚点不在 107×59 图的中心）→ 告诉 Dan
- scaleX(-1) 和 scaleY 眨眼 animate prop 同时应用产生冲突（视觉发抖）→ 告诉 Dan
- Coins 拖尾 ghost 性能差 → 标记问题，不自己改 hack

---

*维护者: F（总调度）*
*创建: 2026-04-22（v2）*
*执行者: Codex（OpenAI Codex）*
*基于: feature/claw42-hero-scene-04（Airy task-04 产出）*
