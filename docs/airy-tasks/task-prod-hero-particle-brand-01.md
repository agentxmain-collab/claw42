# Task — 正式版（main）3 项 Hero + 全局视觉升级

> ⚠️ **正式版 main 分支改动**——基于 `main`，**不动** task-12/13/14/15/17 等 act1.5 / news-debate 开发线。
>
> **执行者**：Codex
>
> **新分支**：`fix/prod-hero-particle-brand-01`（从 `main` 分出）
>
> **PR target**：`main`
>
> **不引入 Spline / 3D 库**——Dan 给的 Spline 链接是**视觉参考**（流畅感 / 追光感），实现仍用现有 framer-motion + Canvas/SVG，避免 200+ KB 3D 引擎 + 商业授权问题

---

## 1. 改动 #1 — 机器人转头平滑化 + 追光（环境光）

### 1.1 现状（生硬的根因）

`src/modules/landing/HeroScene/useRobotPose.ts` 当前是 **3-state 离散切换**：

```ts
if (mouseX < -0.02) return "left";
if (mouseX > 0.02) return "right";
return "center";
```

`RobotLayer.tsx` 根据 pose 切换 3 张静态 PNG（center / left / right），加 `parallax = mouseX * 6px`。Dan 反馈"生硬"——根因是离散切换 + 极小的 parallax 平移，转折瞬间没有平滑插值，看起来像"卡帧"。

Spline 参考链接（视觉目标，**不接入 Spline**）：

- https://my.spline.design/robotlesson-plsbkaKbfu355jyiT5FYzdmo/
- https://my.spline.design/robotfollowcursorforlandingpage-KKp40jUErcUP1mtaRo5VbQmi/

### 1.2 修订方案：spring 平滑 + 头部追光

#### 1.2.1 转头平滑化

保留 3 张 PNG 切换（视觉资产不变），但插入 **spring 物理 + 连续位移/缩放/光照插值**：

```ts
// RobotLayer.tsx 内
import { useSpring, useTransform } from "framer-motion";

// 替代当前的 mouseX/mouseY 直接乘法：
const smoothMouseX = useSpring(mouseX, { stiffness: 80, damping: 20, mass: 0.8 });
const smoothMouseY = useSpring(mouseY, { stiffness: 80, damping: 20, mass: 0.8 });

// 平移幅度从原 6px 增到 ~24px（让"转头"更明显）
const headTranslateX = useTransform(smoothMouseX, [-1, 1], [-24, 24]);
const headTranslateY = useTransform(smoothMouseY, [-1, 1], [-12, 12]);

// 鼠标越靠边，头略微"压缩 + 倾斜"模拟透视
const headScaleX = useTransform(smoothMouseX, [-1, 0, 1], [0.96, 1, 0.96]);
const headRotateZ = useTransform(smoothMouseX, [-1, 1], [-3, 3]);   // 单位 deg

// 渲染（替代当前 transform 字符串）
<motion.img
  ...
  style={{
    x: headTranslateX,
    y: headTranslateY,
    scaleX: headScaleX,
    rotate: headRotateZ,
  }}
/>
```

**关键纪律**：

- spring 参数 `stiffness: 80, damping: 20, mass: 0.8` 是给 Codex 的**起步值**——preview 后 Dan 可调
- 平移幅度 24px / 12px 是经验值，可调
- 不删除现有 `useRobotPose` 的 3-state 逻辑（PNG 切换仍按它判断，避免改动过大破坏现有图层结构）—— spring 只覆盖 transform 部分
- reduce-motion 用户：spring 退化为静态值（`reduceMotion ? 0 : smoothMouseX`），保持 a11y

#### 1.2.2 头部追光（环境光）

转头时头部一侧应该有"被光照亮"的感觉。实现方案：在机器人头部覆盖一个**跟随鼠标的径向 gradient overlay**（`mix-blend-mode: overlay`）。

```tsx
// RobotLayer.tsx 内，机器人 PNG 之上新增
<motion.div
  className="claw42-robot-spotlight pointer-events-none absolute inset-0"
  style={{
    background: useTransform(
      [smoothMouseX, smoothMouseY],
      ([x, y]) => `radial-gradient(
        circle at ${50 + (x as number) * 30}% ${40 + (y as number) * 20}%,
        rgba(255, 255, 255, 0.18) 0%,
        rgba(255, 255, 255, 0.08) 25%,
        transparent 55%
      )`,
    ),
    mixBlendMode: "overlay",
    opacity: reduceMotion ? 0 : 1,
  }}
/>
```

效果：鼠标在右上 → 头部右上角变亮；鼠标在左下 → 头部左下角变亮。视觉上的"追光"。

**注意**：`mix-blend-mode: overlay` 在 Safari/iOS 早期版本可能渲染不一致。Codex 实施时**用 Safari + Chrome 各看一眼**，若 Safari 偏色严重可降级到 `screen` 或 `lighten`。

#### 1.2.3 改动文件

```
src/modules/landing/HeroScene/RobotLayer.tsx     # spring + 追光 overlay
```

不改 `useRobotPose.ts`（PNG 切换逻辑保留）。不改 PNG 资产。

#### 1.2.4 验收

- [ ] 鼠标在 hero 区慢速移动时，机器人头部跟随有**惯性感**（spring 物理）— 不是即时跟随
- [ ] 鼠标极快滑过时，机器人头部有**追赶 + 轻微回弹**（damping 20 的特征）
- [ ] 头部一侧出现明显"被光照"高光，光斑跟鼠标位置走
- [ ] reduce-motion 用户：机器人静止 + 无 spotlight overlay
- [ ] 移动端：保持原 8s 自动循环 pose 切换（`useMobilePoseCycle` 不动）；spring 在桌面才生效
- [ ] Safari 桌面 + iOS Safari + Chrome 实测无明显渲染异常

---

## 2. 改动 #2 — 粒子跟随鼠标（HeroScene 新增 ParticleLayer）

### 2.1 现状

`src/modules/landing/HeroScene/` 下当前无粒子组件。Dan 希望加上。

Spline 参考链接（视觉目标）：

- https://my.spline.design/followparticles-86yc0REhr6D0eaSG88eMmEIO/
- https://my.spline.design/magicalparticles001-kzuvg5DPXEgafw3WD9xMQVEH/

Dan 明确：**不要线条，只要粒子；动线流畅；效果可以大一些**。

### 2.2 实现方案：Canvas 2D + requestAnimationFrame

不引入 three.js / particles.js / Spline runtime 等大依赖。用原生 Canvas 2D 自实现，bundle 影响 ~3 KB（纯逻辑代码）。

#### 2.2.1 ParticleLayer 组件

新建 `src/modules/landing/HeroScene/ParticleLayer.tsx`：

```tsx
"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Container ref to size canvas to. */
  stageRef: React.RefObject<HTMLDivElement>;
  /** Normalised mouse coords from useMouseNormalized. */
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

interface Particle {
  x: number; // current pos
  y: number;
  vx: number; // velocity
  vy: number;
  size: number; // radius
  life: number; // 0-1, decays
  hue: number; // 240-280 (purple range)
}

const PARTICLE_COUNT_DESKTOP = 60;
const PARTICLE_LIFE_MS = 2200;
const SPAWN_RADIUS = 80; // 鼠标附近半径内 spawn
const FOLLOW_FORCE = 0.012; // 粒子向鼠标移动的吸引力
const FRICTION = 0.92; // 阻尼

export function ParticleLayer({ stageRef, mouseX, mouseY, reduceMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>();
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to stage with DPR
    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    // Mouse pos in stage coords (mouseX/mouseY are normalised -1..1)
    const stageRect = () => stage.getBoundingClientRect();

    const tick = (now: number) => {
      const rect = stageRect();
      const cx = rect.width / 2 + (mouseX * rect.width) / 2;
      const cy = rect.height / 2 + (mouseY * rect.height) / 2;

      // Spawn particles near mouse — limit to keep particle count bounded
      if (now - lastSpawnRef.current > 18 && particlesRef.current.length < PARTICLE_COUNT_DESKTOP) {
        lastSpawnRef.current = now;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * SPAWN_RADIUS;
        particlesRef.current.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: 1.5 + Math.random() * 2.5,
          life: 1,
          hue: 250 + Math.random() * 30, // 250-280 purple range
        });
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      const survivors: Particle[] = [];
      for (const p of particlesRef.current) {
        // Update — slight pull toward mouse + friction
        const dx = cx - p.x;
        const dy = cy - p.y;
        p.vx = p.vx * FRICTION + dx * FOLLOW_FORCE;
        p.vy = p.vy * FRICTION + dy * FOLLOW_FORCE;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 16 / PARTICLE_LIFE_MS;

        if (p.life > 0) {
          // Render: glowing dot, no lines
          const alpha = p.life * 0.7;
          ctx.beginPath();
          ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${alpha})`;
          ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, ${alpha})`;
          ctx.shadowBlur = 8;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          survivors.push(p);
        }
      }
      particlesRef.current = survivors;
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [stageRef, mouseX, mouseY, reduceMotion]);

  if (reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="claw42-hero-particles pointer-events-none absolute inset-0"
      style={{
        zIndex: 25, // above PedestalLayer (z-20) below RobotLayer (z-40)
        mixBlendMode: "screen",
      }}
      aria-hidden="true"
    />
  );
}
```

**关键设计点**：

- `PARTICLE_COUNT_DESKTOP = 60` — Dan 说"大一些"。当前是 0，60 是有体感但不爆 GPU
- `FOLLOW_FORCE = 0.012` + `FRICTION = 0.92` — 粒子有"被吸"的感觉但不死板瞬移；调这两个值改"灵敏度"
- `PARTICLE_LIFE_MS = 2200` — 粒子存活 2.2s，自然消散
- **不要线条**：禁止 `ctx.lineTo` / `ctx.stroke` 调用；只用 `ctx.arc + ctx.fill`
- 粒子色：HSL hue 250-280（紫色范围，匹配 CoinW brand 紫 #7650ff）+ shadowBlur 8 给柔光
- `mix-blend-mode: screen` 让粒子叠在背景星空上自然发光
- `reduceMotion === true` 时 return null，**不渲染 canvas**（不只是停动画，是不渲染）
- 移动端：先放开（mouseX/mouseY 在移动端是 0/0，粒子会在中心 spawn，可以接受；如果性能问题再加 isMobile 判断关）

#### 2.2.2 接入 HeroScene

```tsx
// src/modules/landing/HeroScene/HeroScene.tsx
import { ParticleLayer } from "./ParticleLayer";

// 在现有 layers 间插入（z 顺序按需）
<PedestalLayer ... />
<ParticleLayer stageRef={stageRef} mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />
<CoinsLayer ... />
<RobotLayer ... />
```

#### 2.2.3 改动文件

```
src/modules/landing/HeroScene/ParticleLayer.tsx    # 新建
src/modules/landing/HeroScene/HeroScene.tsx        # 接入 ParticleLayer
```

#### 2.2.4 验收

- [ ] 桌面端鼠标在 hero 区移动 → 粒子持续 spawn 并跟随鼠标
- [ ] 粒子存活 ~2 秒后自然消散，不会无限累积
- [ ] 鼠标快速移动 → 粒子拉长成"流光"轨迹（spring + friction 物理）
- [ ] **不出现任何线条 / 网格 / 连线**（grep ParticleLayer.tsx 无 `lineTo|stroke`）
- [ ] 粒子颜色为紫色调（HSL 250-280），匹配品牌
- [ ] 粒子数量稳定在 ~60 上限，不会爆增
- [ ] reduce-motion 用户：canvas 不渲染（DOM 中无 canvas 元素）
- [ ] Chrome DevTools Performance 录 5s：FPS 不低于 55
- [ ] 移动端 / 离开 hero 区：粒子继续衰减消散，不卡死

---

## 3. 改动 #3 — 全局 hover 边框换 CoinW brand 紫（带透明度）

### 3.1 现状

`src/app/globals.css` 内 `.card-glow:hover` 当前用浅蓝：

```css
.card-glow:hover {
  border-color: rgba(102, 188, 255, 0.18);
  box-shadow: ...0 18px 48px -28px rgba(74, 136, 255, 0.36)...;
}

.card-glow::after {
  border: 1px solid rgba(96, 186, 255, 0.65);
  box-shadow: 0 0 0 1px rgba(96, 186, 255, 0.24)...;
}
```

Dan 截图里的 Spot 卡 hover 紫色框（#5227FF）实际上**当前代码不是这个色** —— Dan 是希望**全局换成 CoinW brand 紫，带适当透明度**。

CoinW 主站官方 brand color：**`#7650ff`** (rgb 118, 80, 255)，根据 logotyp.us / altcoinsbox 等品牌资源站。Dan 给的 `#5227FF` 也是紫色系，比 #7650ff 更深更饱和；建议用 #7650ff（官方），如果 Dan 视觉对比后觉得不够浓再调。

### 3.2 修订方案

#### 3.2.1 加 CSS 变量

`src/app/globals.css` `:root` 段：

```css
:root {
  --brand-purple: #6c4fff; /* 已有，不动（其他地方用） */
  --brand-lime: #d1ff55; /* 已有 */

  /* 新增 — CoinW 主站 brand 紫，多透明度档位供不同场景用 */
  --coinw-brand: 118, 80, 255; /* RGB triplet for rgba() composition */
  --coinw-brand-hex: #7650ff;
  --coinw-brand-border-soft: rgba(118, 80, 255, 0.35);
  --coinw-brand-border-strong: rgba(118, 80, 255, 0.6);
  --coinw-brand-glow-soft: rgba(118, 80, 255, 0.18);
  --coinw-brand-glow-strong: rgba(118, 80, 255, 0.32);
}
```

#### 3.2.2 替换 .card-glow hover

```css
/* 原 */
.card-glow:hover {
  border-color: rgba(102, 188, 255, 0.18);
  box-shadow:
    0 26px 60px -30px rgba(0, 0, 0, 0.92),
    0 18px 48px -28px rgba(74, 136, 255, 0.36),
    0 0 22px rgba(74, 136, 255, 0.08);
}

/* 改为 */
.card-glow:hover {
  border-color: var(--coinw-brand-border-soft);
  box-shadow:
    0 26px 60px -30px rgba(0, 0, 0, 0.92),
    0 18px 48px -28px var(--coinw-brand-glow-strong),
    0 0 22px var(--coinw-brand-glow-soft);
}

/* 同步替换 ::before / ::after 用到的蓝色 */
.card-glow::before {
  border: 1px solid rgba(255, 255, 255, 0.06); /* 静态保留白色细边 */
}
.card-glow::after {
  border: 1px solid var(--coinw-brand-border-soft); /* 原 rgba(96,186,255,0.65) */
  box-shadow:
    0 0 0 1px var(--coinw-brand-glow-soft),
    0 0 12px var(--coinw-brand-glow-strong),
    0 0 22px var(--coinw-brand-glow-soft);
}
.card-glow:hover::before {
  border-color: var(--coinw-brand-border-strong);
  opacity: 1;
}
.card-glow:hover::after {
  opacity: 1;
  border-color: var(--coinw-brand-border-strong);
  box-shadow:
    0 0 0 1px var(--coinw-brand-border-soft),
    0 0 16px var(--coinw-brand-glow-strong),
    0 0 30px var(--coinw-brand-glow-strong);
}
```

#### 3.2.3 移动端适配段（globals.css 末尾）

```css
@media (hover: none) {
  .card-glow:hover {
    box-shadow:
      0 18px 40px -24px rgba(0, 0, 0, 0.88),
      0 10px 28px -18px var(--coinw-brand-glow-strong);
  }
}
```

替换原 `rgba(74, 136, 255, 0.32)` 为 `var(--coinw-brand-glow-strong)`。

#### 3.2.4 改动文件

```
src/app/globals.css   # CSS 变量 + .card-glow 全部 hover 蓝色替换为 CoinW 紫
```

#### 3.2.5 验收

- [ ] `:root` 新增 5 个 `--coinw-brand-*` CSS 变量
- [ ] grep `globals.css` 无 `rgba(102, 188, 255` / `rgba(96, 186, 255` / `rgba(74, 136, 255` / `rgba(108, 196, 255` 残留（全部替换为 var）
- [ ] hover 任一 card-glow 卡：边框 + glow 都呈紫色（非蓝色）
- [ ] 视觉强度比当前蓝色 hover 略显**柔和**（Dan 反馈 #5227FF 太突兀，所以改用 #7650ff + 0.35 透明度）
- [ ] mobile (hover: none) 媒体查询里也用变量
- [ ] 主站任意一个 card-glow 卡 hover preview 截图 vs Dan 截图比对（Dan 视觉对比）

---

## 4. 不要做的事（边界）

- ❌ **不引入 Spline / three.js / particles.js / pixi.js** 等 3D / 大粒子库
- ❌ 不改 `--brand-purple` 既有变量（影响范围广，可能波及 gradient-text / 其他 UI）
- ❌ 不改 `useRobotPose.ts` 的 3-state 切换逻辑（PNG 资产仍按它切）
- ❌ 不改 PNG 资产
- ❌ 不动 task-12/13/14/15/17 任何分支
- ❌ 不动 i18n / 文案 / 数据层
- ❌ 不顺手 prettier-format 整个 globals.css 制造大 diff —— 仅触及上述 hover/before/after 段
- ❌ 不引入 PostHog 新事件（粒子互动属于纯视觉，不需要追踪）

---

## 5. 提交命令

```sh
git checkout main
git pull origin main
git checkout -b fix/prod-hero-particle-brand-01

# 改动 #1：RobotLayer.tsx 加 spring + spotlight overlay
# 改动 #2：新建 ParticleLayer.tsx + HeroScene.tsx 接入
# 改动 #3：globals.css 加 CSS 变量 + 替换 hover 颜色

git add src/modules/landing/HeroScene/RobotLayer.tsx \
        src/modules/landing/HeroScene/ParticleLayer.tsx \
        src/modules/landing/HeroScene/HeroScene.tsx \
        src/app/globals.css

git commit -m "fix(prod): hero robot smoothing + spotlight + particle layer + brand-purple hover (3 visual upgrades)

Robot smoothing:
- Wrapped useMouseNormalized output in framer-motion useSpring (stiffness 80, damping 20, mass 0.8)
- Replaced direct mouseX*6px parallax with spring-driven translate (24px) + scaleX (0.96-1) + rotateZ (±3deg)
- Preserved 3-PNG pose switch via useRobotPose (no asset changes)

Robot spotlight (ambient light tracking):
- Added radial-gradient overlay above robot PNG, position driven by smoothMouseX/Y
- mix-blend-mode: overlay; opacity 0 under reduce-motion

Particle layer (new):
- Canvas 2D + requestAnimationFrame, ~60 particle cap, no third-party deps (~3KB code)
- Spawn near mouse, decay over 2.2s, spring-driven follow (FOLLOW_FORCE 0.012, FRICTION 0.92)
- Purple HSL 250-280, shadowBlur 8 for soft glow
- No lines: ctx.arc + ctx.fill only; no lineTo / stroke
- Disabled under prefers-reduced-motion (canvas not rendered)

Brand purple hover:
- Added 5 --coinw-brand-* CSS variables (hex + rgba() softs)
- Replaced .card-glow blue (rgba(102,188,255), rgba(74,136,255)) with CoinW #7650ff at 0.18-0.6 alpha
- Updated ::before / ::after / @media(hover:none) variants to use vars

References (visual targets, NOT integrations):
- Spline robot lesson / cursor follow (smooth-motion reference)
- Spline magical particles / follow particles (particle reference)
- CoinW brand color #7650ff (logotyp.us / altcoinsbox)"

git push origin fix/prod-hero-particle-brand-01
```

PR target：`main`

---

## 6. 风险与回滚

| 风险                                         | 缓解                                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| spring 参数手感不对（Dan 觉得太晃 / 太迟钝） | 给的是起步值，preview 后调 stiffness / damping 一行即可 |
| 粒子数量 60 在低端机器掉帧                   | DevTools FPS 实测；若 <55 则降到 40                     |
| `mix-blend-mode: overlay` Safari 偏色        | 改用 `screen` 或 `lighten` 兜底                         |
| `--coinw-brand` 变量改完色感不对             | Dan 视觉对比后调透明度（0.35 → 0.45 / 0.55）一行        |
| 粒子 canvas 占用 GPU 影响 LCP                | 确认不阻塞首屏渲染（canvas 在 layer-25，不在主路径）    |
| Vercel preview 直接部署                      | 标准流程，preview 验收 5 分钟                           |

**回滚**：单 commit revert，3 个改动同 commit 一起进出。

---

## 7. 给 Codex 的派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-prod-hero-particle-brand-01.md
新分支：fix/prod-hero-particle-brand-01（从 main 分出，⚠️ 不是 act1-5 任何分支）
PR target：main

3 项改动，单 commit：

1. RobotLayer.tsx：useSpring 包裹 mouseX/Y → 转头平滑（stiffness 80, damping 20, mass 0.8），加 scaleX/rotateZ + radial-gradient spotlight overlay 跟鼠标位置走
2. ParticleLayer.tsx 新建：Canvas 2D + RAF，~60 紫粒子跟鼠标，无线条只粒子，2.2s 衰减；HeroScene.tsx 接入
3. globals.css：加 --coinw-brand-* 5 个 CSS 变量，.card-glow:hover / ::before / ::after / @media(hover:none) 全部蓝色替换为 CoinW #7650ff at 0.18-0.6 alpha

⚠️ 严格不引入 Spline / three.js / particles.js 等 3D 库，纯 framer-motion + Canvas 2D 实现
⚠️ 不改 useRobotPose.ts 的 3-state 切换逻辑（PNG 资产保留）
⚠️ 不改 --brand-purple 既有变量（只新增 --coinw-brand-*）
⚠️ 不顺手 format globals.css 制造大 diff
verify 通过后 push，PR target 是 main。
```

---

## 8. 待 Dan 后续判断（preview 后）

- spring 手感（stiffness/damping）需要调吗
- 粒子数量 / 颜色饱和度合适吗
- CoinW 紫 hover 强度（0.35 alpha）够不够 / 太弱
- spotlight overlay 强度（0.18 alpha）够不够

这些都是单参数调整，不需要新 spec，preview 后直接给 Codex 改值。

---

_维护者: F_
_创建: 2026-05-06_
_执行者: Codex_
_分支: fix/prod-hero-particle-brand-01_
_Base: main（正式版，与 act1.5 / news-debate 开发线无关）_

---

Sources:

- [CoinW brand color — logotyp.us](https://logotyp.us/logo/coinw/)
- [Spline robot lesson reference](https://my.spline.design/robotlesson-plsbkaKbfu355jyiT5FYzdmo/)
- [Spline robot cursor follow reference](https://my.spline.design/robotfollowcursorforlandingpage-KKp40jUErcUP1mtaRo5VbQmi/)
- [Spline follow particles reference](https://my.spline.design/followparticles-86yc0REhr6D0eaSG88eMmEIO/)
- [Spline magical particles reference](https://my.spline.design/magicalparticles001-kzuvg5DPXEgafw3WD9xMQVEH/)

---

## 9. v1.1 修订（Codex 反审回应，2026-05-06）

> Codex 在审 spec 过程中发现关键事实 + 提了 5 个反审问题。F 反审结论：**Codex 5 个建议全部采纳，1 处加深**。原 spec § 1-§ 8 整体方向不变，但实施细节按本节修订。

### 9.1 Codex 发现的事实（v1.0 spec 漏掉）

`src/modules/landing/HeroScene/CoinsLayer.tsx` 已经有一套 **TrailOverlay**（line 514）—— 蓝色尾迹粒子，币 hover 时触发，跟随鼠标。如果新增 ParticleLayer 不删 TrailOverlay，会**双套粒子源**冲突（蓝色尾迹 + 紫色粒子层叠）。

**v1.0 spec 漏判**：F 扫描时 grep `particle/cursor/mouse` 没扫到 `trail`，错过这个组件。下次 hero 区改动 spec 必须先 `grep -i "trail\|overlay\|particle"` 全文。

### 9.2 5 个反审问题逐一回应

#### Q1. 有没有比"PNG 2.5D transform"更接近 Spline look-at 的方案，不引入 3D runtime？

**有 — 加 CSS 3D 透视**：

```tsx
// HeroScene 容器
<div className="claw42-hero-stage" style={{ perspective: "1200px" }}>
  ...
</div>

// RobotLayer 内
<motion.div style={{
  transformStyle: "preserve-3d",
  rotateY: smoothMouseX_rotateY,    // -7deg ~ 7deg
  rotateX: smoothMouseY_rotateX,    // 4deg ~ -4deg（注意反向：鼠标向下=头略仰是错的，应反向）
}}>
  <img ... />
</motion.div>
```

`perspective: 1200px` + `transform-style: preserve-3d` 让 PNG 在 3D 空间真旋转，比纯 2D `rotate` 多了"卡片有厚度"的感觉。**Bundle 0 增量**（CSS 原生属性）。

**坦诚边界**：PNG 终究是平面贴图，rotateY 后侧面会变窄但不会出现"另一侧"——和 Spline 真 3D 模型有差距。但配合 Q2 的 face/eyes 单独跟随，视觉欺骗能到 80%。

#### Q2. 外壳不动，只 face/eyes/spotlight 跟随？

**强烈赞同。这是核心修订。**

物理直觉对：人看东西时身体几乎不动，是头在转，眼球在跟。外壳大幅平移会让用户感觉"机器人在地板上滑"——廉价且容易导致 hero 区位置漂移。

**新设计**：layer 拆三层独立运动：

| Layer                    | 位移幅度           | rotateX/Y/Z                                   | spring 参数                                       |
| ------------------------ | ------------------ | --------------------------------------------- | ------------------------------------------------- |
| Body 外壳                | translateX/Y ≤ 6px | rotateY ±3deg / rotateX ±2deg                 | stiffness 30 / damping 30 / mass 1.2（**最慢**）  |
| Head（含追光 spotlight） | translateX/Y ≤ 4px | rotateY ±7deg / rotateX ±4deg / rotateZ ±2deg | stiffness 80 / damping 20 / mass 0.8（中速）      |
| Face / Eyes overlay      | translateX/Y ≤ 8px | (无 rotate，纯位移)                           | stiffness 150 / damping 18 / mass 0.5（**最快**） |

物理上对应：身体迟钝 / 头中速看 / 眼睛精确锁定。这就是 Spline look-at cursor 的核心机制 — **延迟链**。

**v1.0 spec 的 24px 大幅 translate 全部废止**——回到 ≤ 6px 微位移。

#### Q3. 粒子集中机器人附近 vs 整 Hero 都是粒子？

**赞同 — 改"魔法光晕"模型**。

**v1.0 spec 错误**：spawn point = 鼠标位置 → 哪都有粒子 → 廉价感。

**v1.1 修订**：

- **spawn point = 机器人中心附近**（`SPAWN_RADIUS = 60` 围绕机器人）
- 默认状态：粒子缓慢环绕机器人飘（`AMBIENT_DRIFT_SPEED = 0.3`）
- 鼠标靠近机器人（距 ≤ 200px）：粒子被激活，**FOLLOW_FORCE 从 0 提升到 0.018**，粒子涌向鼠标
- 鼠标离机器人 > 400px：粒子停止 spawn，现有粒子自然消散
- 数量上限 ≤ 50（v1.0 是 60，下调）

```ts
// ParticleLayer 修订
const robotCenter = { x: rect.width / 2, y: rect.height / 2 }; // 机器人在 hero 中心
const mouseDist = Math.hypot(cx - robotCenter.x, cy - robotCenter.y);

// 距离影响吸引力：远离时 0，靠近时 0.018
const dynamicFollowForce =
  mouseDist > 400 ? 0 : mouseDist < 100 ? 0.018 : (0.018 * (400 - mouseDist)) / 300;

// 距离影响 spawn：远离时不 spawn
const shouldSpawn = mouseDist <= 400 && particles.length < 50;
```

视觉效果：粒子永远围绕机器人光晕，鼠标靠近时被"吸引"出去 — 像魔法师挥手吸光。

#### Q4. 删 CoinsLayer 旧 trail 是否影响币 hover 反馈？需要补 coin pulse？

**verified：不需要补**。

CoinsLayer 现有币 hover 反馈是**3 重独立机制**（grep 证实）：

1. `hover:scale-105` Tailwind class（CSS hover 缩放）
2. `tooltipVisible` 触发 `scale(${tooltipVisible ? 1.05 : 1})` 内联 transform
3. `setBursting(true)` 触发 burst 视觉

TrailOverlay 是**独立的尾迹层**，与 hover 反馈解耦。删除后 3 重反馈全保留。

**实施纪律**：删 TrailOverlay 时**只删**：

- `TrailOverlay` function（line 514+）
- `TRAIL_LIFETIME_MS / TRAIL_POINT_THRESHOLD / MAX_TRAIL_POINTS / TRAIL_FOLLOW_AFTER_LEAVE_MS / TRAIL_PARTICLES` 常量
- `TrailPoint` interface
- 相关 `useState<TrailPoint[]>` / `pushTrailPoint*` / `trailIdRef / trailActiveRef / trailFollowUntilRef / lastWindowPointRef` state 和 ref
- `<TrailOverlay trail={trail} />` 渲染

**保留**：所有 `CoinItem` 内 hover 相关（onMouseEnter / setBursting / tooltipVisible / scale-105）—— 不动。

#### Q5. body 慢 / face 快双层 spring？

**赞同 + 加深为三层**（见 Q2 表）：body / head / face/eyes 三档 spring。这是 spec 的核心修订点。

### 9.3 修订后落地顺序（Codex 推荐顺序，F 确认）

1. **删 CoinsLayer 旧 TrailOverlay**（按 Q4 清单逐项删）
2. **HeroScene 容器加 `perspective: 1200px`**
3. **机器人交互重写**：原 v1.0 大幅 translate 废止，改 body/head/face 三层 spring + CSS 3D rotateY/X
4. **face/spotlight 快响应**：spotlight overlay 跟随 face layer（不是 head layer），更灵敏
5. **粒子改"魔法光晕"**：spawn 围机器人，鼠标距离驱动 follow-force
6. **CoinW 紫 hover 边框**（v1.0 § 3 不变）
7. **本地 preview 验证**：
   - 只有新紫粒子，无蓝尾迹
   - 币 hover 仍有 scale + tooltip + burst
   - 机器人不滑动而是"看向鼠标"
   - 鼠标离机器人远时粒子稀疏

### 9.4 修订后文件清单

```
src/modules/landing/HeroScene/RobotLayer.tsx         # 三层 spring + CSS 3D rotate
src/modules/landing/HeroScene/CoinsLayer.tsx         # 删 TrailOverlay 整套
src/modules/landing/HeroScene/ParticleLayer.tsx      # 新建，按"魔法光晕"模型
src/modules/landing/HeroScene/HeroScene.tsx          # 加 perspective + 接入 ParticleLayer
src/app/globals.css                                  # CoinW brand 紫（不变）
```

### 9.5 验收清单（合并 v1.0 + v1.1）

#### 机器人

- [ ] HeroScene 容器有 `perspective: 1200px`
- [ ] body / head / face 三个独立 motion 层，每层 useSpring 参数不同
- [ ] body translate ≤ 6px / head ≤ 4px / face ≤ 8px（按 § 9.2 Q2 表）
- [ ] body / head 都有 rotateY/X/Z（CSS 3D 透视）
- [ ] face/eyes 是最快响应层（stiffness 150）
- [ ] spotlight overlay 跟 face 同步（不是 head）
- [ ] 鼠标快速划过：face 立即跟，head 略晚，body 几乎不动
- [ ] reduce-motion：所有层静止

#### 粒子

- [ ] ParticleLayer 存在，纯 Canvas 2D，无第三方依赖
- [ ] 粒子 spawn 中心在机器人附近（距机器人中心 ≤ 60px）
- [ ] 鼠标离机器人 > 400px：停止 spawn，现有粒子衰减
- [ ] 鼠标离机器人 ≤ 100px：FOLLOW_FORCE = 0.018（粒子被强吸）
- [ ] 粒子数量 ≤ 50
- [ ] 无线条（grep `lineTo|stroke` = 0）
- [ ] 紫色 HSL 250-280
- [ ] reduce-motion：canvas 不渲染

#### TrailOverlay 删除

- [ ] CoinsLayer.tsx 不再有 `TrailOverlay` / `TrailPoint` / `TRAIL_*` 常量
- [ ] CoinsLayer.tsx 不再有 `trailIdRef / trailActiveRef / trailFollowUntilRef / lastWindowPointRef` 等 ref/state
- [ ] grep `Trail|trail` in CoinsLayer.tsx 0 命中
- [ ] 币 hover 仍有 scale-105 + tooltip + burst 三重反馈（功能不退化）

#### CoinW 紫 hover（v1.0 § 3）

- [ ] 5 个 `--coinw-brand-*` CSS 变量在 :root 内
- [ ] grep globals.css 无 `rgba(102, 188, 255` / `rgba(96, 186, 255` / `rgba(74, 136, 255` / `rgba(108, 196, 255` 残留

### 9.6 修订 commit message

```
fix(prod): hero 2.5D smoothing + magical particle field + brand-purple hover (v1.1)

[Hero robot — 2.5D look-at cursor, three-layer spring]
- HeroScene container: perspective: 1200px (CSS 3D, no runtime)
- Body layer:    spring(stiffness:30,damping:30,mass:1.2)  translate≤6px  rotateY±3 / rotateX±2
- Head layer:    spring(stiffness:80,damping:20,mass:0.8)  translate≤4px  rotateY±7 / rotateX±4 / rotateZ±2
- Face/eyes:     spring(stiffness:150,damping:18,mass:0.5) translate≤8px  (no rotate)
- Spotlight overlay synced to face layer (fastest response, not head)
- Result: robot does not glide; it tracks the cursor with realistic gaze delay

[CoinsLayer cleanup]
- Removed TrailOverlay component + TrailPoint type + 5 TRAIL_* constants + 4 trail refs
- Coin hover feedback unchanged: hover:scale-105 + tooltip scale + burst all preserved

[ParticleLayer — magical halo model]
- New Canvas 2D layer (~3KB code, no deps)
- Spawn center: robot vicinity (radius 60px), not mouse
- Distance-driven FOLLOW_FORCE: 0 at >400px, 0.018 at ≤100px
- Particle cap 50, HSL 250-280 purple, no lines (ctx.arc + ctx.fill only)
- Disabled under prefers-reduced-motion (canvas not rendered)

[CoinW brand purple hover — v1.0 § 3 unchanged]
- 5 --coinw-brand-* CSS variables (rgba 0.18-0.6 alpha bands)
- .card-glow:hover / ::before / ::after / @media(hover:none) blue replaced with CoinW #7650ff

References (visual targets, NOT runtime integrations):
- Spline robot lesson + cursor follow (smooth gaze reference)
- Spline magical particles + follow particles (halo reference)
- CoinW brand color #7650ff (logotyp.us / altcoinsbox)
```

---

## 10. 转给 Codex 的派发文本（更新版）

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-prod-hero-particle-brand-01.md（含 § 9 v1.1 修订段，**先看 § 9 再实施**）

新分支：fix/prod-hero-particle-brand-01（从 main 分出）
PR target：main

落地顺序（Codex 推荐 + F 确认）：
1. 删 CoinsLayer.tsx 内 TrailOverlay 整套（不影响币 hover scale/tooltip/burst）
2. HeroScene 容器加 perspective: 1200px
3. RobotLayer 三层 spring（body 慢 / head 中 / face/eyes 快）+ CSS 3D rotateX/Y/Z
4. spotlight overlay 同步 face 层（最快响应）
5. 新建 ParticleLayer.tsx：spawn 围机器人 + 距离驱动 FOLLOW_FORCE
6. globals.css 加 5 个 --coinw-brand-* 变量 + 替换蓝色 hover 为紫色

关键约束（必读）：
- v1.0 spec 的 24px 大幅 translate 已废止（v1.1 § 9.2 Q2），改 ≤ 6/4/8px 三层微位移
- v1.0 spec 粒子 spawn 在鼠标位置已废止（v1.1 § 9.2 Q3），改 spawn 围机器人
- 不引入 Spline / three.js / particles.js 任何 3D runtime
- 不改 useRobotPose.ts 3-state 切换逻辑（PNG 资产保留）
- 不改 --brand-purple 既有变量
- 不动其他 act1.5 / news-debate 任何分支
- 不顺手 prettier-format 整个 globals.css

verify 通过 + Vercel preview 验收 4 项（无蓝尾迹 / 币 hover 仍有 3 重反馈 / 机器人不滑动 / 远离机器人粒子稀疏）后 push。
PR target 是 main。
```

---

## 11. F 反审 Codex 的元判断

Codex 这次反审质量高：

- **抓到 v1.0 spec 漏的事实**（TrailOverlay 双源冲突）
- **建议 body/face/eyes 拆层** — 比我原 spec 的"单层 spring"更接近 Spline 精髓
- **粒子集中机器人附近** — 直接戳中"廉价感"问题，是产品级判断不是工程级
- **每个建议都有具体落地路径**，不是空泛意见

这种来回反审就是 v2.3 协议要的"实施者主动透明 + Claude 副审兜底"的正确模式。Codex 这一刻不是"按 spec 干活的工具"，是"产品共建者"。

未来类似 hero 区改动 spec，F 应该**先让 Codex 扫一遍现有组件再写 spec**——避免 v1.0 漏判 TrailOverlay 这种事。

---

_v1.1 修订: 2026-05-06（Codex 反审 + F 接受全部 5 项建议 + 1 处加深为三层 spring）_
