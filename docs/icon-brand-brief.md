# Claw42 图标品牌化需求 Brief（v2）

> v1 方向错了——从 hero 3D 图推调性变成赛博朋克壁纸风。v2 对齐 claw42 logo 的**扁平极简几何**调性。

---

## 1. 品牌调性锚点（严格遵守）

### 视觉参考
**唯一参考对象：claw42 logo（方头机器人 + "claw42" 字样）**

从 logo 提取的品牌语言：
- 扁平（flat），无 3D 感
- 硬几何（方/圆/三角为基底）
- 线条描边为主，局部实心（如 logo 的眼睛圆点）
- 蓝色系 + 黑 + 白，极少量点缀
- 情绪克制，不卖弄

### 色彩系统
- 主色：深蓝 `#2563eb` → 亮蓝 `#60a5fa`（logo 眼睛色）
- 线条：白 `#ffffff` 或浅灰 `#e5e5e5`
- 背景：深灰 `#111` 或纯黑 `#000`
- （可选 accent，不必用）紫 `#7c5cff` 仅用于极小点缀

每个图标用色数 = **2-3 色封顶**。

### 形状语言
- 基础几何：方形、圆形、六边形、三角形
- 硬边 + 少量圆角
- 描边粗细：2-3 px 等效（512 尺寸下 10-14 px stroke）
- 构图元素数量：**2-3 个元素封顶**，留白要大

### 禁用清单（硬性）
- ❌ neon、glow、发光粒子
- ❌ 渐变光晕、金属感、反射
- ❌ 3D 透视、体积光
- ❌ 赛博朋克壁纸感
- ❌ **龙虾爪 / 螃蟹爪**（logo 里没有，强加只会让 AI 堆乱）
- ❌ 任何有机生物形态（除非极度几何化）

### 参考风格
- Linear.app 图标集
- Vercel UI 组件
- Heroicons（outline 风格）
- Phosphor Icons
- Feather Icons

**风格关键词（用在 prompt 里）**
```
minimal, flat, geometric, line art, clean,
blue on dark, stroke-based, tech UI icon,
Linear-style, Vercel-style, negative space
```

### 技术规范
- 格式：SVG 优先（矢量 + 可控色），PNG 备选（透明底 PNG-32）
- 尺寸：512×512 px，最终显示 48×48 px
- **背景完全透明**（图标周围不能有矩形底色）
- 8 张必须是**同一 prompt base 一次生成**，不能拼凑

---

## 2. 通用 Prompt Base（每个图标共用）

每次生图先用这个 base，再追加当个图标的具体语义。

```
Minimal flat tech icon, geometric composition, clean line art style,
blue accent color (#2563eb to #60a5fa), white strokes on dark background (#111),
stroke width 2-3px, no glow, no gradient, no neon, no particles, no 3D effects,
inspired by Linear app and Vercel UI icons,
2-3 elements maximum, flat vector style with large negative space,
512x512 pixels, transparent background
```

---

## 3. 8 个图标 Prompt（base + 具体语义）

### A1 · 竞技公信力（Why 卡 1）
**语义**：公开战绩、可验证、透明
**构图**：极简盾牌内含一个上升的简化条形图
**追加 prompt**：
```
[BASE] + a minimal shield outline with three ascending bars inside representing verified performance, clean geometric composition
```

### A2 · 养成共生力（Why 卡 2）
**语义**：培养、进化、个性化
**构图**：种子 / 萌芽几何形
**追加 prompt**：
```
[BASE] + a minimal sprout icon, two geometric leaves emerging from a simple base, representing growth and nurture
```

### A3 · 生态自驱力（Why 卡 3）
**语义**：网络、节点、协作
**构图**：三个点通过线连接成三角网络
**追加 prompt**：
```
[BASE] + three circular nodes connected by thin lines forming a triangular network pattern, one central node slightly larger
```

### B1 · Contract（合约）
**语义**：精密、杠杆、齿轮
**构图**：极简齿轮轮廓 + 中心圆点
**追加 prompt**：
```
[BASE] + a minimal outlined gear with six teeth, small filled dot at the center, clean geometric style
```

### B2 · Spot（现货）
**语义**：即时、直接、交换
**构图**：两个圆环 + 中间双向箭头
**追加 prompt**：
```
[BASE] + two simple coin circles side by side with a bidirectional arrow between them, minimal flat exchange symbol
```

### C1 · 创建 API Key
**语义**：钥匙、凭证、起点
**构图**：极简钥匙轮廓
**追加 prompt**：
```
[BASE] + a minimal geometric key icon, simple circular bow with rectangular teeth, outline style
```

### C2 · 授权 Claw42 Agent
**语义**：委托、权限传递、信任
**构图**：两个几何方块之间传递一把钥匙
**追加 prompt**：
```
[BASE] + two geometric squares facing each other with a small key symbol transferring between them, representing permission handoff
```

### C3 · 挑 Skill，开干
**语义**：启动、执行
**构图**：六边形里一个简化播放三角
**追加 prompt**：
```
[BASE] + a hexagonal frame with a simple play triangle at the center, representing launch and execution
```

---

## 4. 命名规范（交付后 F 使用）

文件放 `claw42/public/images/icons/`：

```
why-arena.svg          (A1 竞技公信力)
why-evolve.svg         (A2 养成共生力)
why-ecosystem.svg      (A3 生态自驱力)
eco-contract.svg       (B1 Contract)
eco-spot.svg           (B2 Spot)
step-key.svg           (C1 创建 API Key)
step-authorize.svg     (C2 授权 Claw42 Agent)
step-launch.svg        (C3 挑 Skill 开干)
```

PNG 同名 `.png`，SVG 优先使用。

---

## 5. 一致性自检（交付前放一起看）

8 张摆一起应该满足：

- [ ] 同一蓝色调，没有一张偏绿或偏紫
- [ ] 描边粗细一致
- [ ] 每张元素数量在 2-3 个封顶，没有一张塞满
- [ ] 都是透明背景（没有矩形底色）
- [ ] **没有 glow / particle / 3D** 任何一张都不能有
- [ ] 视觉复杂度一致（不能一张极简一张繁杂）
- [ ] 整体调性和 claw42 logo 放一起不违和

不满足 → 用同一 prompt base 重跑一批。

---

## 6. 生成流程建议

**Midjourney / DALL-E 用户**
1. 开一个 session
2. 第一张用 A1 prompt，生成 4 个候选选一个
3. 后续 7 张用 `--sref` 或 "same style as previous" 锁定风格
4. 全部生完放一起比对，不一致的重跑

**SD / Flux 用户**
1. 固定 seed 保证风格一致
2. 用同一个 LoRA（如果有极简 icon LoRA 最好）
3. 批量生成后筛选

**过渡方案**：如果 AI 生图一直出不好，fallback 到 **Heroicons / Phosphor / Feather 这些开源 icon 库**—— 直接找已有的"盾牌""齿轮""钥匙""播放"等图标，下载 SVG 改色即可。这种方案快、免费、风格绝对一致，只是不带"品牌独特性"。如果追求独特性做不到，先用开源图标上线，后续设计师重做。

---

*Brief 版本：v2.0 / 2026-04-23*
*v1 已废弃（方向误判：从 hero 3D 图推调性变赛博朋克风）*
*v2 对齐 claw42 logo 本体：扁平极简几何 + 蓝白双色 + 线条为主*
