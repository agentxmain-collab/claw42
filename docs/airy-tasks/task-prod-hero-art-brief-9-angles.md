# 美术 Brief — Claw42 Hero 机器人 9 角度 PNG + GLTF

> Dan 转发给美术的执行清单。**目标**：为方案 E（多角度 sprite cross-fade）准备 9 张 PNG，**同时**导出 1 个 .glb 备用（未来方案 B 升级）。
>
> 创建：2026-05-06
> 优先级：在方案 D（v1.1 当前 spec）落地后启动

---

## 0. 给美术的 30 秒摘要

需要：

1. **9 张机器人多角度 PNG**（@1x + @2x 各 9 张 = 共 18 张）
2. **1 个 GLTF binary 文件（`.glb`）**（备用资源，30 秒导出即可）

预估工作量：**1-2 天**（最快路径：用 Spline 编辑器 30 分钟出全套）

输出格式：ZIP 打包发给 Dan，命名严格按 § 5。

---

## 1. 背景（让美术理解为什么做）

claw42 主页 Hero 区中央有一个机器人 PNG，鼠标在屏幕移动时它会"看向"鼠标。当前实现是 3 张静态 PNG（center / left / right）切换，转头看起来"卡帧"不自然。

升级方案：**让你做 9 张不同角度的 PNG**，前端会根据鼠标位置选最近的两张做 cross-fade（淡入淡出），模拟连续转头的"看向鼠标"效果。视觉效果比 3 张切换流畅很多，接近 3D 真转头。

参考视觉目标（Dan 给的 Spline scene）：

- https://my.spline.design/robotlesson-plsbkaKbfu355jyiT5FYzdmo/
- https://my.spline.design/robotfollowcursorforlandingpage-KKp40jUErcUP1mtaRo5VbQmi/

---

## 2. 输出规格

### 2.1 9 张 PNG 角度规格

| 文件名                  | yaw（左右） | pitch（上下） | 说明                                     |
| ----------------------- | ----------- | ------------- | ---------------------------------------- |
| `robot-yaw-neg45.png`   | -45°        | 0°            | 左转 45°（最大左视角）                   |
| `robot-yaw-neg30.png`   | -30°        | 0°            | 左转 30°                                 |
| `robot-yaw-neg15.png`   | -15°        | 0°            | 左转 15°                                 |
| `robot-yaw-0.png`       | 0°          | 0°            | **正面**（与当前 center 等同，作为基准） |
| `robot-yaw-pos15.png`   | +15°        | 0°            | 右转 15°                                 |
| `robot-yaw-pos30.png`   | +30°        | 0°            | 右转 30°                                 |
| `robot-yaw-pos45.png`   | +45°        | 0°            | 右转 45°（最大右视角）                   |
| `robot-pitch-up5.png`   | 0°          | +5°           | 微仰头（鼠标在屏幕上方时用）             |
| `robot-pitch-down5.png` | 0°          | -5°           | 微低头（鼠标在屏幕下方时用）             |

> **关于 yaw / pitch 定义**：
>
> - **yaw（偏航）**：头部左右转动。负 = 看向画面左边（机器人本体相对镜头），正 = 看向右边
> - **pitch（俯仰）**：头部上下转动。正 = 抬头，负 = 低头
> - 不需要 roll（歪头）

### 2.2 文件格式规格

| 项       | 规格                                                       |
| -------- | ---------------------------------------------------------- |
| 格式     | PNG 24-bit + Alpha 通道                                    |
| 背景     | **透明**（不是黑色 / 白色）                                |
| 尺寸     | 与现有 robot.png 完全一致（具体尺寸 Dan 在交付前发给美术） |
| DPI      | 72（web 用）                                               |
| 色彩模式 | sRGB                                                       |
| 压缩     | 用 TinyPNG / ImageOptim 优化但不破坏 alpha                 |

### 2.3 双倍图（@2x retina）

每张 PNG 出 2 个版本：

- `robot-yaw-0@1x.png` — 标准分辨率
- `robot-yaw-0@2x.png` — 2 倍分辨率（用于 retina / 高 DPI 屏）

总文件数：9 × 2 = **18 张 PNG**。

### 2.4 GLTF binary（.glb）

额外交付 **1 个 `.glb` 文件**：

- 文件名：`robot.glb`
- 内容：完整机器人 3D 模型 + 材质 + 纹理（不需要动画）
- 用途：未来如果方案 E 不够 Dan 想升级到真 3D（方案 B），这个文件可以直接用 three.js / react-three-fiber 渲染

**最快导出路径**：

- Spline 编辑器：File → Export → glTF (.glb) 一键
- 30 秒事，请同步交付

---

## 3. 一致性要求（最重要！）

9 张 PNG 必须**严格一致**才能用于 cross-fade。前端 cross-fade 时机器人位置 / 表情 / 光照漂移会直接看起来"动画卡顿"。

### 3.1 必须一致的元素

- ✅ **身体姿态**：身体不动，**只有头部 / 脖子在转**（不是整个机器人转）
- ✅ **画布中心**：机器人在每张 PNG 的中心点 / 锚点必须**像素级**一致（Photoshop 叠加 9 张时机器人脚 / 底座完全重合）
- ✅ **表情**：眼睛形状 / 嘴巴 / 面板内容完全相同（不是不同帧）
- ✅ **环境光方向**：场景灯光从同一方向打（如左上 45°），9 张图阴影方向一致
- ✅ **材质 / 颜色**：金属高光 / 主体色 / logo 颜色完全相同
- ✅ **裁剪区域**：画布尺寸一样，机器人不会被某张图边缘剪裁

### 3.2 允许变化的元素

- ✅ 头部 yaw 角度（按规格）
- ✅ 头部 pitch 角度（按规格）
- ✅ 由于头部转动产生的**轻微**透视形变（如脸颊的露出）
- ✅ 头部一侧的高光位置（因为转头后受光面变化）

### 3.3 不允许的差异

- ❌ 整个机器人左右移动（必须固定中心）
- ❌ 缩放（每张机器人大小完全一致）
- ❌ 表情变化（不能某张眨眼某张睁眼）
- ❌ 不同帧（同一个 pose 的多个 frame）
- ❌ 脸部 / 眼睛颜色差异（除非头转后高光自然变化）

---

## 4. 推荐工具流（最快路径）

### 4.1 最快路径：Spline 编辑器（30 分钟全套出完）

**前提**：机器人 3D 模型已在 Dan 给的 Spline scene 里。

1. 浏览器打开 https://app.spline.design/
2. 注册账号 / 登录（Dan 可以创建团队账号让美术加入）
3. **Open** Dan 提供的 scene file（`.splinecode` 或 scene URL）
4. 选中机器人 head 节点（不是整个机器人 — 只选头）
5. 在右侧 Transform 面板调整 **Rotation Y**（yaw）：
   - 设 `-45` → File → Export → PNG → 命名 `robot-yaw-neg45.png` → 出 @1x 和 @2x（Spline 有 export at 2x 选项）
   - 设 `-30` → 同上 → `robot-yaw-neg30.png`
   - 重复 -15 / 0 / +15 / +30 / +45
6. 调整 **Rotation X**（pitch）：
   - 设 `+5`（X-axis 在 Spline 是上为正） → `robot-pitch-up5.png`
   - 设 `-5` → `robot-pitch-down5.png`
7. **导出 GLTF**：File → Export → glTF → 选 `.glb` 二进制 → 命名 `robot.glb`
8. ZIP 打包 18 张 PNG + 1 个 .glb

**总时间**：30-60 分钟，看美术对 Spline 的熟悉度。

### 4.2 备选路径：Blender + .glb（如果美术不会 Spline）

1. 美术让 Dan 先从 Spline 导出 `.glb`（让 Dan 自己点 Spline 导出按钮）
2. 美术 Blender 导入 .glb
3. 在 Blender 里建 9 个相机 angle（绕头部中心）
4. 批量渲染 PNG（Cycles 或 EEVEE 引擎，透明背景）
5. 同步出 @1x + @2x

**总时间**：2-4 小时（Blender 设置稍麻烦）。

### 4.3 不推荐路径

- ❌ AI 生图（Midjourney / SD）—— 一致性几乎不可能保证（每张表情 / 光照都不一样）
- ❌ Photoshop 透视变换 —— 大角度 yaw 会失真
- ❌ 重新建模 —— 时间太长，已有 Spline 模型直接用

---

## 5. 命名规范（严格）

文件名必须**精确匹配**下表（前端代码会按名字读取）：

```
robot-yaw-neg45@1x.png
robot-yaw-neg45@2x.png
robot-yaw-neg30@1x.png
robot-yaw-neg30@2x.png
robot-yaw-neg15@1x.png
robot-yaw-neg15@2x.png
robot-yaw-0@1x.png
robot-yaw-0@2x.png
robot-yaw-pos15@1x.png
robot-yaw-pos15@2x.png
robot-yaw-pos30@1x.png
robot-yaw-pos30@2x.png
robot-yaw-pos45@1x.png
robot-yaw-pos45@2x.png
robot-pitch-up5@1x.png
robot-pitch-up5@2x.png
robot-pitch-down5@1x.png
robot-pitch-down5@2x.png

robot.glb
```

⚠️ **不能**用：

- 中文文件名
- 空格（用连字符 `-`）
- 大写字母（全小写）
- 不同的角度数字格式（如 `-45` 写成 `_45` 或 `45left` 不可以）

---

## 6. 一致性 QA 自检清单（美术交付前自查）

- [ ] 9 张 @1x PNG 在 Photoshop 同一文档不同图层叠加，**机器人底座 / 中心点完全重合**（不漂移）
- [ ] 9 张 PNG **画布尺寸完全一致**（如都是 800×800px）
- [ ] 9 张 PNG **表情一致**（眼睛形状 / 嘴 / 面板内容相同，只有头朝向不同）
- [ ] 9 张 PNG 都有干净 **alpha 透明背景**（用浅色背景层叠加测试，无白边 / 锯齿 / 半透明 artifact）
- [ ] 9 张 PNG 文件大小都在合理范围（@1x 单张 < 200 KB，@2x 单张 < 600 KB；用 TinyPNG 压一遍）
- [ ] @2x 的尺寸**精确**是 @1x 的两倍（如 @1x 是 800×800，则 @2x 必须 1600×1600）
- [ ] 文件名严格按 § 5 命名（无中文 / 无空格 / 全小写）
- [ ] `.glb` 文件能用任意 GLTF viewer 打开（如 https://gltf-viewer.donmccurdy.com/）确认模型完整
- [ ] ZIP 文件按格式打包，根目录直接是 18 张 PNG + 1 个 .glb（不要嵌套子文件夹）

---

## 7. 现有资源参考

美术开工前可向 Dan 索要：

- 当前线上 robot PNG（在 `claw42/public/images/` 下，Dan 知道路径）
- Dan 提供的 Spline scene 编辑权限（Dan 注册 Spline team / 邀请美术）
- 任何已有的 robot 3D 模型源文件（Blender / Maya / FBX 等，如果美术之前做过）

---

## 8. 交付时间线

由于不是阻塞性任务（方案 D 已经落地够用），不强制 deadline。建议节奏：

- 美术拿到 brief 后 **24 小时内**回 Dan 确认能不能做 + 报哪条路径（Spline / Blender / 其他）
- 拿到 Dan 给的 scene 资源后 **1-2 天**内交付（Spline 路径最快 30 分钟）
- 交付后 Dan 验收（按 § 6 QA 清单）
- 验收通过后 Dan 转给我，我落 v1.2 spec 让 Codex 接入

---

## 9. 给 Dan 的转发说明

把这份文档（或 § 0-§ 8）转给美术时，建议附上：

1. 当前线上 robot PNG 的实际尺寸（如 800×800）—— 让美术对齐画布尺寸
2. Spline scene 的访问权限 / `.splinecode` 文件
3. 一句产品 brief："这个机器人是 Claw42 主页门面，整页第一眼看到的元素，转头流畅度直接影响品牌质感"

如果美术报"不会 Spline / 没用过 Blender" → Dan 可以让美术先去 Spline 官网注册账号 + 跟个 5 分钟教学视频，Spline UI 学习曲线极平缓。

---

## 10. Code 端如何用（向美术解释，让他们安心）

前端不会动 PNG 内容、不会修图、不会强行变形。只会：

- 用鼠标位置 (mouseX, mouseY) 计算 yaw / pitch 角度
- 根据 yaw 选最近的 2 张 yaw PNG（如鼠标在 yaw=22° 位置 → 取 yaw-15 和 yaw-30 cross-fade）
- 根据 pitch 同理
- 用 framer-motion 平滑过渡 PNG opacity（200ms ease）
- @2x 浏览器自动按 devicePixelRatio 选

美术只要**保证 9 张图一致性**，前端做剩下的事。

---

## 11. 待 Dan 拍板（给美术的几个细节）

发给美术前 Dan 需要决定：

| 细节                                    | 决策                                                             |
| --------------------------------------- | ---------------------------------------------------------------- |
| 美术工具偏好                            | Spline / Blender / 其他？                                        |
| 是否需要美术注册 Spline team 共享 scene | 是否要付费（Spline Super $9/mo）                                 |
| 当前 robot PNG 实际尺寸                 | 量出来给美术（800×800 / 1024×1024 / 其他？）                     |
| 是否需要美术同步出 ar_SA RTL 镜像版本   | 推不需要——RTL 用户机器人朝向左右翻转可由前端 CSS scaleX(-1) 处理 |
| Deadline                                | 不阻塞当前 PR #21 集成；preview 后视效果决定优先级               |

---

_维护者: F_
_创建: 2026-05-06_
_目标用户: 美术 + Dan 路由_
_用途: 方案 E（多角度 PNG sprite cross-fade）资产准备_
_配套实施 spec: task-prod-hero-particle-brand-01.md（v1.1 落地 + v1.2 升级到 sprite 模式 — v1.2 待美术资源到位后落）_
