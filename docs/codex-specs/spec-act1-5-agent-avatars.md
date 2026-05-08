# Spec — Act 1.5 三 Agent 头像生成

## 目标

为旁观秀页面的 3 个 Claw42 Agent 生成头像图片资源。视觉要：

- 和 claw42 现有 Hero 机器人 (`public/images/hero/robot-left.png` 等) **同一世界观**——3 个 Agent 是 Hero 机器人的"队友"，不是另一族物种
- 区分 3 个 Agent 的人设（激进 / 稳健 / 套利）通过形态 + 配色差异表达
- 适配 claw42 蓝光 card-glow 体系（深底 + 蓝紫光晕），不要用纯白底亮色风
- 输出 PNG 透明底，可在不同尺寸（24/40/72/120 px）下都能看清

## 输出文件

最终交付 12 个文件到 `public/images/agents/`：

| Agent | 文件名                                                                        | 规格                     |
| ----- | ----------------------------------------------------------------------------- | ------------------------ |
| Alpha | `alpha-72.png`                                                                | 72×72，PNG 透明底        |
| Alpha | `alpha-120.png`                                                               | 120×120                  |
| Alpha | `alpha-256.png`                                                               | 256×256（高清备用）      |
| Alpha | `alpha-color-token.json`                                                      | 配色 token（hex + rgba） |
| Beta  | `beta-72.png` / `beta-120.png` / `beta-256.png` / `beta-color-token.json`     | 同上                     |
| Gamma | `gamma-72.png` / `gamma-120.png` / `gamma-256.png` / `gamma-color-token.json` | 同上                     |

## 分支策略

合并到主 spec 的同一分支 `feature/act1-5-watch-page-01`，作为同一 PR 的资源。不单独开分支。

如果 Codex 实际工作流先做头像 spec 再做主 spec，则可以独立分支 `feature/act1-5-agent-avatars-01`，PR 目标 main。但建议同 PR 合并降低 review 成本。

## 变更范围

### 新建

- `public/images/agents/` 整个目录
- 12 个文件（见上方）

### 不动

- `public/images/hero/` 现有机器人资源（参考但不改）
- 任何 src/ 代码（本 spec 只产出资源文件，代码引用见主 spec）

## 实现路径

Codex 不能直接画图。三选一：

### 方案 A — 调用图像生成 API（推荐）

写一个一次性脚本 `scripts/generate-agent-avatars.ts`（脚本本身不进 commit，运行后产出 PNG 提交），调用：

- **OpenAI DALL-E 3**：质量高、API 简单（需要 `OPENAI_API_KEY`）
- 或 **Stable Diffusion**（如果 Dan 有 SD 服务）
- 或 **Anthropic Image API**（如果支持）

每个 Agent 用下方"视觉规格"小节里的英文 prompt 生成 1024×1024 原图 → 后期处理 resize 到 256/120/72 → 抠透明底 → 输出 PNG

抠图工具：`sharp` npm 包（已经在 Vercel 默认依赖里）+ 简单 alpha threshold 算法，或用 `rembg` Python 包（如果 Codex 环境有）

### 方案 B — 程序化 SVG 生成（如果 API 不可用）

每个 Agent 用纯 SVG 写一个 stylized 几何头像：

- Alpha：尖锐三角形 + 红色调
- Beta：稳重六边形 + 蓝色调
- Gamma：菱形格子 + 紫色调
- 加 claw42 蓝光呼吸边框

输出 SVG → 转 PNG（用 sharp）→ 各尺寸版本

视觉效果会比 API 生成弱，但可控可矢量化。**作为方案 A 失败时的兜底**。

### 方案 C — 用现有 Hero 机器人变体

复用 `public/images/hero/robot-left.png`，PIL 或 sharp 处理：

- Alpha 版：色相旋转到红
- Beta 版：色相旋转到蓝
- Gamma 版：色相旋转到紫

最快但视觉差异化弱（3 个 Agent 看起来还是同一只机器人）。**最次选**。

### 决策

Codex 自主选择。优先级 A > B > C。在 PR 描述里说明用了哪个方案 + 原因。

如果方案 A 选 DALL-E，需要 Dan 提供 `OPENAI_API_KEY`——Codex 在 PR 描述里**主动询问** Dan 是否有此 key 可用。

---

## 视觉规格

### 共同基调

- 和 Hero 机器人（`robot-left.png` / `robot-right.png`）**同一族**——蟹/虾型机械结构、双钳、复眼、blue/purple 发光关节
- 但是 3 个 Agent 是 Hero 机器人的不同子型态（等价于"军团里 3 个不同兵种"），有自己的特征装饰
- 透明底，深色环境友好（PNG 不能假定背景，但视觉权重要够强不被深底吃掉）
- 风格：cyberpunk + 机械 + 海洋甲壳类生物隐喻
- 不要拟人化（不要给机器人画人脸）
- 不要 mascot 卡通风（不要圆滚 mochi 风）

### Alpha — 激进派

- **角色定位**：短周期突破猎手，速度型
- **形态特征**：
  - 体型偏瘦长，钳子尖锐细长
  - 触须 / 雷达天线伸出（暗示侦测突破信号）
  - 关节缝有红色发光线条（代表激进色调）
  - 眼睛单只大复眼（聚焦突破点）
- **配色**：
  - 主体：暗灰金属 `#2a2832`
  - 强调色：暖红 `#ff5f5f` + 橙红渐变
  - 蓝光保留少量（关节末端一点蓝）做品牌一致性
- **prompt 关键词（给图像 API）**：
  ```
  a sleek mechanical crab-shrimp hybrid creature, agent persona,
  long sharp pincers, antenna sensors, dark metallic body,
  warm red glowing accents along joints, single large compound eye,
  cyberpunk underwater warrior aesthetic, dark navy background,
  subtle blue light remnants on tail joints,
  3d render, transparent background, square composition
  ```

### Beta — 稳健派

- **角色定位**：风险控制 + 长期持有
- **形态特征**：
  - 体型偏厚重稳固，钳子粗短
  - 装甲明显（多层叠片暗示防护）
  - 关节缝蓝色冷光（代表冷静）
  - 双复眼（暗示全面观察）
- **配色**：
  - 主体：暗蓝灰 `#1a2235`
  - 强调色：深蓝 `#3a7bff` + 蓝紫渐变
  - 银白点缀（装甲反光）
- **prompt 关键词**：
  ```
  a stocky armored mechanical crab creature, defensive agent persona,
  thick layered carapace plates, short powerful pincers,
  cool blue glowing accents along joints, twin compound eyes,
  cyberpunk fortress warrior aesthetic, dark navy background,
  silver white highlights on armor edges,
  3d render, transparent background, square composition
  ```

### Gamma — 套利派

- **角色定位**：跨市场套利 + 速度精准
- **形态特征**：
  - 体型介于 Alpha 和 Beta 之间，对称感强
  - 钳子等长（左右对称暗示价差套利）
  - 多触须（不同方向探测多个市场）
  - 关节缝紫色发光（代表精准）
  - 三复眼（暗示同时盯多市场）
- **配色**：
  - 主体：暗紫黑 `#251a2e`
  - 强调色：紫 `#9b6bff` + 粉紫渐变
  - 紫光呼吸感
- **prompt 关键词**：
  ```
  a balanced symmetrical mechanical crab creature, arbitrage agent persona,
  multiple sensor antennae extending in different directions,
  twin equal-length pincers, purple glowing accents along joints,
  triple compound eyes for multi-market vision,
  cyberpunk merchant calculator aesthetic, dark navy background,
  pink-purple gradient highlights,
  3d render, transparent background, square composition
  ```

---

## 后期处理

每个 Agent 1024×1024 原图生成后：

1. 抠透明底（如果原图带背景）
2. 居中裁剪到正方形
3. 用 sharp resize 到 256 / 120 / 72 三种尺寸
4. 每种尺寸 PNG-8 with alpha（小文件）
5. 文件命名严格：`{agent}-{size}.png`（lowercase agent name, no underscores）

## 配色 Token JSON

每个 Agent 一份 `{agent}-color-token.json`：

```json
{
  "agentId": "alpha",
  "primary": "#2a2832",
  "accent": "#ff5f5f",
  "accentRgba": "rgba(255, 95, 95, 1)",
  "glowRgba": "rgba(255, 95, 95, 0.45)",
  "secondaryAccent": "#ff8a3d"
}
```

主 spec 里 AgentSidebar.tsx 等组件读这份 JSON 拿配色，避免 hardcode。

## 验收标准

- [ ] 12 个文件全部存在于 `public/images/agents/`
- [ ] 每个 PNG 文件可以正常打开（PIL / sharp 验证）
- [ ] 256px / 120px / 72px 三个尺寸视觉清晰，72px 仍能看出 Agent 差异
- [ ] PNG 透明底（用 sharp metadata 验证 `hasAlpha = true`）
- [ ] 3 个 Agent 视觉差异明显（Alpha 红 / Beta 蓝 / Gamma 紫）
- [ ] 配色 token JSON 格式正确，4 个键都有
- [ ] 文件大小合理（72px < 10KB，120px < 25KB，256px < 80KB）
- [ ] 所有头像在深底（#0a0a0a）和浅底（#f5f5f5）背景下都能看清
- [ ] **PR 描述里写明用了方案 A/B/C**，如果是 A 写明用哪个图像 API + 提示是否需要 Dan 提供 API key

## 约束

- 不要使用真实人脸图像
- 不要使用著名作品的角色（不能像皮卡丘 / 蜘蛛侠）
- 风格要和 Hero 机器人统一，不能突兀
- 不能用粉色 / 黄色 / 绿色作主色（claw42 品牌色限制蓝紫红范围）
- 输出文件不能含可执行内容（仅 PNG + JSON）
- 不要 commit 临时生成的中间文件（`.tmp.png` / `*.psd` 等）

## 提交

如果作为主 spec 同 PR 提交，commit message 单独一条：

```
chore(assets): add 3 agent avatars (alpha/beta/gamma) for act 1.5
```

如果独立 PR，分支 `feature/act1-5-agent-avatars-01`，commit + push + open PR 到 main。

## 有疑问不要猜

- API key 没配 → 在 PR 描述里问 Dan，不要硬编码 key 进文件
- 方案 A 生成的图风格和 Hero 机器人差太远 → 调整 prompt 重生成，最多 3 轮，第 3 轮还差就退到方案 B
- Codex 环境装不了 sharp/rembg 等工具 → 在 PR 描述里说明，让 Dan 决定是否用方案 B
- 3 个 Agent 看起来太像 → 调整配色 + 形态，确保 72px 也能区分

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Codex_
_配套: spec-act1-5-watch-page-and-hero-injection.md（主 spec）_
